"use strict";
/* Run with: node alexa-skill/test.js   (no packages needed) */
var assert = require("assert");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var grocery = require("./lambda/grocery");
var firestore = require("./lambda/firestore");
var skill = require("./lambda/index");

var tests = [];
function test(name, fn) { tests.push([name, fn]); }
function parsed(s) { return grocery.parseItems(s).map(function (i) { return i.name + "|" + i.note + "|" + i.section; }); }

test("section guesses match the website's", function () {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var m = /var GUESS = (\[[\s\S]*?\n  \]);/.exec(html);
  assert.ok(m, "GUESS not found in index.html");
  var site = eval(m[1]);
  assert.deepStrictEqual(grocery.GUESS.map(String), site.map(String));
});

test("splits items and guesses sections", function () {
  assert.deepStrictEqual(parsed("milk, eggs and two pounds of potatoes"),
    ["Milk||dairy", "Eggs||dairy", "Potatoes|2 pounds|produce"]);
  assert.deepStrictEqual(parsed("milk and eggs to the grocery list"), ["Milk||dairy", "Eggs||dairy"]);
  assert.deepStrictEqual(parsed("paper towels"), ["Paper towels||household"]);
});
test("keeps compound names together", function () {
  assert.deepStrictEqual(parsed("mac and cheese and half and half"), ["Mac and cheese||dairy", "Half and half||other"]);
  assert.deepStrictEqual(parsed("salt and pepper and bread"), ["Salt and pepper||spices", "Bread||bakery"]);
});
test("quantities", function () {
  assert.deepStrictEqual(parsed("a gallon of milk"), ["Milk|1 gallon|dairy"]);
  assert.deepStrictEqual(parsed("a dozen eggs"), ["Eggs|1 dozen|dairy"]);
  assert.deepStrictEqual(parsed("3 onions"), ["Onions|3|produce"]);
  assert.deepStrictEqual(parsed("an avocado"), ["Avocado||produce"]);
  assert.deepStrictEqual(parsed("two percent milk"), ["Two percent milk||dairy"]);
  assert.deepStrictEqual(parsed("2 cans of black beans"), ["Black beans|2 cans|pantry"]);
  assert.deepStrictEqual(parsed("half a pound of ground beef"), ["Ground beef|half a pound|meat"]);
  assert.deepStrictEqual(parsed("some bananas and also add a loaf of bread please"), ["Bananas||produce", "Bread|1 loaf|bakery"]);
});
test("empty and duplicate input", function () {
  assert.deepStrictEqual(parsed(""), []);
  assert.deepStrictEqual(parsed("and"), []);
  assert.deepStrictEqual(parsed("milk and milk"), ["Milk||dairy"]);
});

function fakeStore(existing) {
  var s = { added: [], list: function () { return Promise.resolve(existing || []); }, add: function (items) { s.added = s.added.concat(items); return Promise.resolve(); } };
  return s;
}
function intent(name, slots, open) {
  var sl = {};
  Object.keys(slots || {}).forEach(function (k) { sl[k] = { name: k, value: slots[k] }; });
  return { session: { attributes: open ? { open: true } : {} }, request: { type: "IntentRequest", intent: { name: name, slots: sl } } };
}

test("one-shot add writes items and ends the session", function () {
  var store = fakeStore([{ name: "Eggs", checked: false }, { name: "Bread", checked: true }]);
  return skill.handle(intent("AddItemsIntent", { items: "milk eggs, and bread" }), store).then(function (r) {
    assert.deepStrictEqual(store.added.map(function (i) { return i.name; }), ["Milk eggs", "Bread"]);
    assert.strictEqual(r.response.shouldEndSession, true);
  });
});
test("skips items already on the list, re-adds checked ones", function () {
  var store = fakeStore([{ name: "Eggs", checked: false }, { name: "Bread", checked: true }]);
  return skill.handle(intent("AddItemsIntent", { items: "milk and eggs and bread" }), store).then(function (r) {
    assert.deepStrictEqual(store.added.map(function (i) { return i.name; }), ["Milk", "Bread"]);
    assert.deepStrictEqual(store.added.map(function (i) { return i.addedBy; }), ["Alexa", "Alexa"]);
    assert.strictEqual(r.response.outputSpeech.text, "Added Milk and Bread. Eggs is already on the list.");
  });
});
test("open session keeps listening; bare items work", function () {
  var store = fakeStore();
  return skill.handle({ request: { type: "LaunchRequest" } }, store).then(function (r) {
    assert.strictEqual(r.response.shouldEndSession, false);
    assert.strictEqual(r.sessionAttributes.open, true);
    return skill.handle(intent("BareItemIntent", { item: "milk", itemTwo: "eggs" }, true), store);
  }).then(function (r) {
    assert.deepStrictEqual(store.added.map(function (i) { return i.name; }), ["Milk", "Eggs"]);
    assert.strictEqual(r.response.shouldEndSession, false);
    assert.ok(/Anything else\?$/.test(r.response.outputSpeech.text));
    return skill.handle(intent("AMAZON.StopIntent", {}, true), store);
  }).then(function (r) { assert.strictEqual(r.response.shouldEndSession, true); });
});
test("reads the list", function () {
  return skill.handle(intent("ReadListIntent"), fakeStore([{ name: "Milk", checked: false }, { name: "Old", checked: true }])).then(function (r) {
    assert.strictEqual(r.response.outputSpeech.text, "On the list: Milk.");
  });
});
test("a failed write is spoken, not silent", function () {
  var store = fakeStore();
  store.add = function () { return Promise.reject(new Error("boom")); };
  var log = console.error; console.error = function () {};
  return skill.handle(intent("AddItemsIntent", { items: "milk" }), store).then(function (r) {
    console.error = log;
    assert.ok(/Nothing was added/.test(r.response.outputSpeech.text));
  });
});
test("rejects requests from another skill when SKILL_ID is set", function () {
  process.env.SKILL_ID = "amzn1.ask.skill.mine";
  var ev = intent("AddItemsIntent", { items: "milk" });
  ev.session.application = { applicationId: "amzn1.ask.skill.other" };
  var store = fakeStore();
  return skill.handle(ev, store).then(function () { throw new Error("should have rejected"); }, function () {
    delete process.env.SKILL_ID;
    assert.strictEqual(store.added.length, 0);
  });
});

test("firestore client: signed token request, list, and atomic add", function () {
  var pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  var key = { project_id: "demo-proj", client_email: "skill@demo-proj.iam.gserviceaccount.com", private_key: pair.privateKey.export({ type: "pkcs8", format: "pem" }) };
  var calls = [];
  function request(method, url, headers, body) {
    calls.push({ method: method, url: url, headers: headers, body: body });
    if (url.indexOf("oauth2") > -1) return Promise.resolve({ access_token: "tok", expires_in: 3600 });
    if (method === "GET") return Promise.resolve({ documents: [{ fields: { name: { stringValue: "Eggs" }, checked: { booleanValue: true } } }, { fields: { name: { stringValue: "Milk" } } }] });
    return Promise.resolve({});
  }
  var c = firestore.makeClient({ key: key, request: request, now: function () { return 1700000000000; } });
  return c.list().then(function (items) {
    assert.deepStrictEqual(items, [{ name: "Eggs", checked: true }, { name: "Milk", checked: false }]);
    var jwt = /assertion=(.+)$/.exec(calls[0].body)[1].split(".");
    assert.ok(crypto.createVerify("RSA-SHA256").update(jwt[0] + "." + jwt[1]).verify(pair.publicKey, Buffer.from(jwt[2], "base64url")));
    var claims = JSON.parse(Buffer.from(jwt[1], "base64url").toString());
    assert.strictEqual(claims.iss, key.client_email);
    assert.strictEqual(claims.scope, "https://www.googleapis.com/auth/datastore");
    assert.strictEqual(calls[1].headers.Authorization, "Bearer tok");
    return c.add([{ name: "Milk", note: "1 gallon", section: "dairy" }, { name: "Eggs", note: "", section: "dairy", addedBy: "Alexa" }]);
  }).then(function () {
    assert.strictEqual(calls.length, 3, "token is reused");
    var commit = calls[2];
    assert.strictEqual(commit.url, "https://firestore.googleapis.com/v1/projects/demo-proj/databases/(default)/documents:commit");
    var writes = JSON.parse(commit.body).writes;
    assert.strictEqual(writes.length, 2);
    assert.ok(/^projects\/demo-proj\/databases\/\(default\)\/documents\/groceries\/[A-Za-z0-9]{20}$/.test(writes[0].update.name));
    assert.deepStrictEqual(writes[0].update.fields, {
      name: { stringValue: "Milk" }, note: { stringValue: "1 gallon" }, section: { stringValue: "dairy" },
      checked: { booleanValue: false }, createdAt: { integerValue: "1700000000000" }
    });
    assert.strictEqual(writes[1].update.fields.createdAt.integerValue, "1700000000001");
    assert.deepStrictEqual(writes[1].update.fields.addedBy, { stringValue: "Alexa" });
    assert.deepStrictEqual(writes[0].currentDocument, { exists: false });
  });
});

test("interaction model is valid JSON and covers every intent the code handles", function () {
  var model = JSON.parse(fs.readFileSync(path.join(__dirname, "interaction-model.json"), "utf8")).interactionModel.languageModel;
  var names = model.intents.map(function (i) { return i.name; });
  ["AddItemsIntent", "BareItemIntent", "ReadListIntent", "AMAZON.HelpIntent", "AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"]
    .forEach(function (n) { assert.ok(names.indexOf(n) > -1, n); });
  assert.ok(/^[a-z][a-z .']+ [a-z .']+$/.test(model.invocationName));
});

(function run(i, failed) {
  if (i === tests.length) { console.log(failed ? failed + " failed" : "all " + tests.length + " passed"); process.exit(failed ? 1 : 0); }
  Promise.resolve().then(tests[i][1]).then(function () { console.log("ok   " + tests[i][0]); run(i + 1, failed); },
    function (e) { console.log("FAIL " + tests[i][0] + "\n     " + (e && e.message)); run(i + 1, failed + 1); });
})(0, 0);
