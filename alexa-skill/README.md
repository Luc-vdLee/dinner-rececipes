# Alexa skill: add to the grocery list by voice

A private Alexa custom skill that writes to the same Firestore `groceries` collection the website uses, so items show up on everyone's phone within a second or two.

What you say:

- "Alexa, ask pantry helper to add milk and eggs"
- "Alexa, ask pantry helper to add two pounds of potatoes"
- "Alexa, open pantry helper" → "milk" → "paper towels and dish soap" → "done"
- "Alexa, ask pantry helper what's on the list"

"Alexa, add milk to my shopping list" (without the skill name) always goes to Amazon's own list. Amazon closed that list to outside apps in July 2024, so the skill name is required.

Items are split on "and" and commas, a leading amount becomes the note ("two pounds of potatoes" → Potatoes, note "2 pounds"), the store section is guessed the same way the website guesses it, and anything already on the list unchecked is skipped. On the website these items show "Added by Alexa".

## Files

- `interaction-model.json`: the voice model (invocation name, phrases). English (US).
- `lambda/index.js`: handles Alexa's requests.
- `lambda/grocery.js`: splits speech into items and guesses sections. Its `GUESS` table is a copy of the one in `index.html`.
- `lambda/firestore.js`: reads and writes Firestore with a Google service account.
- `test.js`: `node alexa-skill/test.js`. No packages to install; the skill has no dependencies.

## The key (read this first)

The skill signs in to Firestore with a **service-account key**. That key skips the email allowlist in the security rules, so anyone holding it can read and change the list.

- It is never committed here. This repository is public, and `.gitignore` blocks `service-account*.json`.
- It lives only in the skill backend (step 4).
- Give it the smallest role that works (step 1), and delete the key in Google Cloud if you ever stop using the skill.

## Setup (about 20 minutes, once)

### 1. Create the service account

1. Open the [Google Cloud console service accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts) and pick the Firebase project (the `projectId` in `firebase-config.js`).
2. Create service account → name it `alexa-grocery-list` → role **Cloud Datastore User** (that is Firestore read and write, nothing else) → Done.
3. Open the new account → Keys → Add key → Create new key → JSON. A `.json` file downloads. Keep it out of this repo folder.

### 2. Create the skill

1. Sign in at the [Alexa developer console](https://developer.amazon.com/alexa/console/ask) with **the same Amazon account your Echo is registered to**. That is what lets an unpublished skill run on your speakers.
2. Create Skill → name `Pantry Helper` → primary locale **English (US)** (it must match the language your Echo is set to; if yours is set to another English, pick that one).
3. Experience type Other → model **Custom** → hosting **Alexa-hosted (Node.js)** → template **Start from Scratch**.

### 3. Voice model

Build tab → Interaction Model → JSON Editor → replace everything with the contents of `interaction-model.json` → Save → **Build skill**.

To use a different name than "pantry helper", change `invocationName` there. Two or more words, lower case. Avoid "list", "shopping", "message" and other words Alexa has her own features for: the first name tried, "dinner list", sent "open dinner list" to Alexa's lists and "tell dinner list…" to messaging, and never reached the skill.

### 4. Code and key

Code tab:

1. Replace `lambda/index.js` with this folder's `lambda/index.js`.
2. Create `lambda/grocery.js` and `lambda/firestore.js` with the contents from here.
3. Replace `lambda/package.json` with the one from here.
4. Create `lambda/service-account.json` and paste the whole downloaded key file into it.
5. Save, then **Deploy**.

Alexa-hosted code is kept in a private repository that Amazon manages for your developer account. That is the only place the key is stored.

### 5. Try it

1. Test tab → set "Skill testing is enabled in" to **Development**.
2. Type or say `open pantry helper`, then `add milk`. Alexa should answer "Added Milk. Anything else?" and Milk should appear on the website under Dairy & eggs.
3. Say the same to your Echo.

Leave the skill in Development. Do not submit it for certification; it stays private to your Amazon account and works on every Echo registered to that account, for anyone in the room.

## If something is off

- **"Sorry, I couldn't reach the grocery list"**: Code tab → CloudWatch Logs shows the reason. `HTTP 403` means the service account lacks the Cloud Datastore User role; a missing-module error means `service-account.json` wasn't created or deployed.
- **Alexa adds to her own shopping list instead**: the skill name wasn't heard. Say "ask pantry helper to add…" or open the skill first. Use "ask", not "tell": Alexa can take "tell …" as sending a message.
- **Alexa says she doesn't know that skill**: the skill's locale doesn't match the Echo's language, or the Echo is on a different Amazon account.
- **Alexa+ speakers**: Amazon says existing-style skills stay available on original Alexa, and that being called by name on Alexa+ is something developers apply for. Whether a Development-stage skill answers on a speaker upgraded to Alexa+ is not confirmed; if yours doesn't, the Test tab and non-upgraded Echos still work.

## Running on your own AWS Lambda instead

Same three files, Node.js 18 or newer, handler `index.handler`, trigger "Alexa Skills Kit". Instead of the `service-account.json` file, set environment variables:

- `FIREBASE_SERVICE_ACCOUNT`: the key file's contents (JSON, or base64 of it).
- `SKILL_ID`: your skill's ID, so the function refuses requests from any other skill.

## Changing the code

- Keep `GUESS` in `lambda/grocery.js` identical to `GUESS` in `index.html`; the test checks it.
- After changes here, run `node alexa-skill/test.js`, then paste the changed files into the Alexa console's Code tab and Deploy. Nothing deploys from this repo automatically.
