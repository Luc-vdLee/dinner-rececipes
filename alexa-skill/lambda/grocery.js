"use strict";
/* Turns what someone said ("milk, eggs and two pounds of potatoes") into grocery list items
   shaped like the website's: {name, note, section}. No dependencies. */

/* Keep this identical to GUESS in ../../index.html. `node alexa-skill/test.js` fails if they drift. */
var GUESS = [
  [/ice cream|frozen|popsicle|pizza/, "frozen"],
  [/peanut butter|olive oil|vegetable oil|cooking spray|pasta|spaghetti|rice|cereal|oatmeal|oats|beans|soup|canned|sauce|salsa|ketchup|mustard|mayo|honey|jam|jelly|vinegar|broth|noodle|tuna/, "pantry"],
  [/sour cream|cream cheese|milk|cheese|butter|yogurt|yoghurt|eggs?\b|cream|parmesan/, "dairy"],
  [/bell pepper|jalape/, "produce"],
  [/flour|sugar|salt|pepper|spice|paprika|cinnamon|cumin|oregano|baking|yeast|vanilla|cayenne|chili flakes|powder/, "spices"],
  [/chicken|beef|pork|sausage|bacon|turkey|steak|\bham\b|fish|salmon|shrimp|ground|meat/, "meat"],
  [/paper towel|toilet|trash|foil|soap|detergent|sponge|napkin|cleaner|\bbags?\b|plastic wrap|batter(y|ies)|light bulb/, "household"],
  [/shampoo|conditioner|toothpaste|toothbrush|deodorant|razor|lotion|vitamin|floss|sunscreen/, "personal"],
  [/bread|bagel|\bbuns?\b|tortilla|\brolls?\b|croissant|muffin|cake/, "bakery"],
  [/apple|banana|lettuce|onion|shallot|potato|tomato|garlic|carrot|avocado|lemon|lime|spinach|fruit|berr|grape|cucumber|celery|herb|parsley|cilantro|basil|mushroom|broccoli|orange|salad|kale|zucchini/, "produce"],
  [/chips|cookie|cracker|soda|juice|water|coffee|\btea\b|beer|wine|snack|candy|chocolate|nuts/, "snacks"]
];
function guessSection(name) {
  var s = name.toLowerCase();
  for (var i = 0; i < GUESS.length; i++) if (GUESS[i][0].test(s)) return GUESS[i][1];
  return "other";
}

/* Things with "and" in the name that are one item, not two. */
var COMPOUNDS = [
  "macaroni and cheese", "mac and cheese", "salt and pepper", "half and half", "peanut butter and jelly",
  "pork and beans", "rice and beans", "chips and salsa", "fish and chips", "oil and vinegar",
  "sweet and sour", "cookies and cream", "biscuits and gravy", "m and m's", "m and ms"
];
var AND = "\u0001";

var NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20
};
var NUM = "(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|half a dozen|a dozen|a couple(?: of)?|a few|half an?|" + Object.keys(NUMBERS).join("|") + ")";
var UNIT = "(pounds?|lbs?|ounces?|oz|gallons?|quarts?|pints?|cups?|liters?|cans?|jars?|bottles?|bags?|box(?:es)?|" +
  "six packs?|packs?|packages?|cartons?|bunch(?:es)?|heads?|loaf|loaves|sticks?|dozen|cases?|rolls?|slices?|" +
  "pieces?|cloves?|containers?|tubs?|blocks?|sleeves?)";
var QTY_UNIT = new RegExp("^" + NUM + "\\s+" + UNIT + "(?:\\s+of)?\\s+(.+)$");
var QTY_ONLY = new RegExp("^" + NUM + "\\s+(.+)$");
/* "two percent milk", "seven up", "five spice": the number belongs to the name. */
var NUMBER_IS_NAME = /^(percent|up\b|spice|cheese|bean|grain|layer|alarm|in one|ply)/;

function tidy(s) {
  return String(s || "").toLowerCase().replace(/[.!?"]/g, " ").replace(/\s+/g, " ").trim();
}

function parseOne(raw) {
  var s = raw.replace(new RegExp(AND, "g"), " and ").replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:(?:and|also|then|plus|please|some|to add|add|put|buy|get|we need|i need)\s+)+/, "");
  s = s.replace(/\s+(?:please|too|as well)$/, "");
  if (!s) return null;
  var name = s, note = "";
  var m = QTY_UNIT.exec(s);
  if (m) {
    note = sayNumber(m[1]) + " " + m[2];
    name = m[3];
  } else if ((m = QTY_ONLY.exec(s)) && !NUMBER_IS_NAME.test(m[2])) {
    name = m[2];
    if (m[1] !== "a" && m[1] !== "an") note = sayNumber(m[1]);
  }
  name = name.replace(/^(?:of|the)\s+/, "").trim().slice(0, 80);
  if (!name) return null;
  return { name: name.charAt(0).toUpperCase() + name.slice(1), note: note, section: guessSection(name) };
}
function sayNumber(n) {
  if (Object.prototype.hasOwnProperty.call(NUMBERS, n)) return String(NUMBERS[n]);
  return n.replace(/\s+of$/, "").replace(/\s*\/\s*/, "/");
}

/* "milk eggs" with no "and" stays one item: there is no safe way to split it. */
function parseItems(spoken) {
  var s = " " + tidy(spoken) + " ";
  s = s.replace(/\s(?:to|on|onto|in|for)\s(?:the|my|our)\s(?:(?:grocery|shopping|dinner|groceries)\s)?list\s/g, " ");
  COMPOUNDS.forEach(function (c) { s = s.split(" " + c).join(" " + c.replace(/ and /g, AND)); });
  var seen = {}, out = [];
  s.split(/\s*[,;]\s*|\s+and\s+|\s+plus\s+|\s+also\s+/).forEach(function (part) {
    var it = parseOne(part);
    if (!it || out.length >= 15) return;
    var k = it.name.toLowerCase();
    if (seen[k]) return;
    seen[k] = true; out.push(it);
  });
  return out;
}

function listWords(names) {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

module.exports = { GUESS: GUESS, guessSection: guessSection, parseItems: parseItems, listWords: listWords };
