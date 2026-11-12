"use strict";
/* Alexa custom skill: "Alexa, tell dinner list to add milk and eggs".
   Adds items to the same Firestore `groceries` collection the website uses.
   Handles the raw Alexa request JSON, so it needs no packages. */
var grocery = require("./grocery");
var firestore = require("./firestore");

var client = null;
function db() { if (!client) client = firestore.makeClient(); return client; }

function speak(text, keepOpen, attrs) {
  var res = {
    version: "1.0",
    sessionAttributes: attrs || {},
    response: { outputSpeech: { type: "PlainText", text: text }, shouldEndSession: !keepOpen }
  };
  if (keepOpen) res.response.reprompt = { outputSpeech: { type: "PlainText", text: "What else should I add? Say done when you're finished." } };
  return res;
}

function slotValues(intent) {
  var slots = intent.slots || {}, out = [];
  Object.keys(slots).forEach(function (k) { if (slots[k] && slots[k].value) out.push(slots[k].value); });
  return out;
}

function addItems(spoken, open, store) {
  var attrs = open ? { open: true } : {};
  var items = grocery.parseItems(spoken);
  if (!items.length) return Promise.resolve(speak("I didn't catch the item. What should I add?", true, { open: true }));
  return store.list().then(function (existing) {
    var have = {};
    existing.forEach(function (i) { if (!i.checked) have[i.name.toLowerCase()] = true; });
    var fresh = items.filter(function (i) { return !have[i.name.toLowerCase()]; });
    var dupes = items.filter(function (i) { return have[i.name.toLowerCase()]; });
    return store.add(fresh).then(function () {
      var parts = [];
      if (fresh.length) parts.push("Added " + grocery.listWords(fresh.map(function (i) { return i.name; })) + ".");
      if (dupes.length) parts.push(grocery.listWords(dupes.map(function (i) { return i.name; })) + (dupes.length === 1 ? " is" : " are") + " already on the list.");
      if (open) parts.push("Anything else?");
      return speak(parts.join(" "), open, attrs);
    });
  });
}

function readList(open, store) {
  return store.list().then(function (existing) {
    var names = existing.filter(function (i) { return !i.checked && i.name; }).map(function (i) { return i.name; });
    var text;
    if (!names.length) text = "The grocery list is empty.";
    else if (names.length > 12) text = "There are " + names.length + " items on the list. The first twelve are " + grocery.listWords(names.slice(0, 12)) + ".";
    else text = "On the list: " + grocery.listWords(names) + ".";
    return speak(text + (open ? " Anything else?" : ""), open, open ? { open: true } : {});
  });
}

/* store is passed in by tests; Alexa calls handler(event) */
function handle(event, store) {
  var req = event.request || {};
  var open = !!(event.session && event.session.attributes && event.session.attributes.open);
  var wantId = process.env.SKILL_ID;
  var gotId = event.session && event.session.application && event.session.application.applicationId ||
    event.context && event.context.System && event.context.System.application && event.context.System.application.applicationId;
  if (wantId && gotId !== wantId) return Promise.reject(new Error("Request is not from this skill."));

  if (req.type === "LaunchRequest") return Promise.resolve(speak("What should I add to the grocery list?", true, { open: true }));
  if (req.type === "SessionEndedRequest") return Promise.resolve({ version: "1.0", response: {} });
  if (req.type !== "IntentRequest") return Promise.resolve(speak("Sorry, I can't do that.", false));

  var intent = req.intent || {}, name = intent.name;
  var work;
  if (name === "AddItemsIntent" || name === "BareItemIntent") work = addItems(slotValues(intent).join(" and "), open, store || db());
  else if (name === "ReadListIntent") work = readList(open, store || db());
  else if (name === "AMAZON.HelpIntent") work = Promise.resolve(speak("Say add, then what you need. For example: add milk, eggs and two pounds of potatoes. What should I add?", true, { open: true }));
  else if (name === "AMAZON.StopIntent" || name === "AMAZON.CancelIntent" || name === "AMAZON.NoIntent" || name === "AMAZON.NavigateHomeIntent") work = Promise.resolve(speak("Okay.", false));
  else work = Promise.resolve(speak("I didn't get that. Say add, then the item.", true, { open: true }));

  return work.catch(function (err) {
    console.error("Grocery list error:", err && err.message);
    return speak("Sorry, I couldn't reach the grocery list. Nothing was added. Please try again.", false);
  });
}

exports.handle = handle;
exports.handler = function (event) { return handle(event); };
