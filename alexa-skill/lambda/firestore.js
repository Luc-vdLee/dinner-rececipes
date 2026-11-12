"use strict";
/* Minimal Firestore client for the shared grocery list, using a Google service account.
   Built on Node's own https and crypto so the skill has no packages to install.
   A service account bypasses the Firestore security rules, so its key must stay in the
   skill backend only (see ../README.md). */
var https = require("https");
var crypto = require("crypto");

var COLLECTION = "groceries";

function loadKey() {
  var raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    raw = raw.trim();
    if (raw.charAt(0) !== "{") raw = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(raw);
  }
  return require("./service-account.json");
}

function httpsJson(method, url, headers, body) {
  return new Promise(function (resolve, reject) {
    var req = https.request(url, { method: method, headers: headers, timeout: 6000 }, function (res) {
      var chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        var text = Buffer.concat(chunks).toString("utf8"), json = null;
        try { json = text ? JSON.parse(text) : {}; } catch (e) {}
        if (res.statusCode >= 200 && res.statusCode < 300 && json) return resolve(json);
        var err = new Error("HTTP " + res.statusCode + " from " + url.split("?")[0] + ": " + text.slice(0, 300));
        err.status = res.statusCode;
        reject(err);
      });
    });
    req.on("timeout", function () { req.destroy(new Error("Timed out calling " + url.split("?")[0])); });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function b64url(x) {
  return Buffer.from(x).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signJwt(key, nowSec) {
  var head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  var claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec, exp: nowSec + 3600
  }));
  var sig = crypto.createSign("RSA-SHA256").update(head + "." + claims).sign(key.private_key);
  return head + "." + claims + "." + b64url(sig);
}

function newId() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", out = "";
  var bytes = crypto.randomBytes(40);
  for (var i = 0; i < bytes.length && out.length < 20; i++) if (bytes[i] < 248) out += chars.charAt(bytes[i] % 62);
  return out;
}

/* opts (for tests): {key, request, now} */
function makeClient(opts) {
  opts = opts || {};
  var request = opts.request || httpsJson;
  var now = opts.now || Date.now;
  var key = null, token = null, tokenExp = 0;

  function getKey() { if (!key) key = opts.key || loadKey(); return key; }
  function base() {
    return "https://firestore.googleapis.com/v1/projects/" + getKey().project_id + "/databases/(default)/documents";
  }
  function auth() {
    if (token && now() < tokenExp) return Promise.resolve(token);
    var body = "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" + signJwt(getKey(), Math.floor(now() / 1000));
    return request("POST", "https://oauth2.googleapis.com/token",
      { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) }, body)
      .then(function (r) {
        token = r.access_token;
        tokenExp = now() + ((r.expires_in || 3600) - 300) * 1000;
        return token;
      });
  }
  function call(method, url, payload) {
    return auth().then(function (t) {
      var body = payload ? JSON.stringify(payload) : null;
      var headers = { Authorization: "Bearer " + t };
      if (body) { headers["Content-Type"] = "application/json"; headers["Content-Length"] = Buffer.byteLength(body); }
      return request(method, url, headers, body);
    });
  }

  /* Every item on the list: [{name, checked}] */
  function list() {
    var out = [];
    function page(tok, n) {
      var url = base() + "/" + COLLECTION + "?pageSize=300&mask.fieldPaths=name&mask.fieldPaths=checked" +
        (tok ? "&pageToken=" + encodeURIComponent(tok) : "");
      return call("GET", url).then(function (r) {
        (r.documents || []).forEach(function (d) {
          var f = d.fields || {};
          out.push({ name: f.name && f.name.stringValue || "", checked: !!(f.checked && f.checked.booleanValue) });
        });
        return r.nextPageToken && n < 10 ? page(r.nextPageToken, n + 1) : out;
      });
    }
    return page(null, 1);
  }

  /* Adds all items in one atomic write, shaped exactly like the website's documents. */
  function add(items) {
    if (!items.length) return Promise.resolve();
    var t = now();
    var root = base().replace("https://firestore.googleapis.com/v1/", "");
    var writes = items.map(function (it, i) {
      return {
        update: {
          name: root + "/" + COLLECTION + "/" + newId(),
          fields: {
            name: { stringValue: it.name },
            note: { stringValue: it.note || "" },
            section: { stringValue: it.section || "other" },
            checked: { booleanValue: false },
            createdAt: { integerValue: String(t + i) }
          }
        },
        currentDocument: { exists: false }
      };
    });
    return call("POST", base() + ":commit", { writes: writes });
  }

  return { list: list, add: add };
}

module.exports = { makeClient: makeClient, signJwt: signJwt };
