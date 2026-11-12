# To do

Three planned additions to the grocery list. Each needs new data in Firebase, so step 0 comes first.

## 0. Update the Firestore rules (once, covers all three)

Firebase console → Firestore Database → Rules. Replace the rules with the block below, keep your real email addresses in the list, and press Publish. Never commit the addresses to this repository.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function household() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in ['you@gmail.com', 'housemate@gmail.com'];
    }
    match /groceries/{item}   { allow read, write: if household(); }
    match /history/{item}     { allow read, write: if household(); }
    match /mealChecks/{doc}   { allow read, write: if household(); }
  }
}
```

- [ ] Rules published with the two new collections
- [ ] Shared list still loads on both phones afterwards

## 1. "Buy again" suggestions

Remember when each item was bought and suggest it when it's probably due.

- [ ] **Record purchases.** When an item is checked off, write to `history/<normalised name>` (reuse `normName`): `{name, section, dates: [timestamps]}`. Keep the last 10 dates and ignore a second check-off on the same day, so unchecking and rechecking doesn't count twice.
- [ ] **Work out the rhythm.** With 3 or more dates, take the median gap between purchases. An item is due when the time since the last purchase is at least 90% of that gap.
- [ ] **Show a "Probably due" row** above the list: one chip per due item that isn't already on the list unchecked. Tapping a chip adds it (with `stamp`, the remembered section, no amount).
- [ ] **Let people dismiss a suggestion** ("not this time"), which hides it until the next expected date.
- [ ] Only for the shared (Firebase) list at first; signed-out and artifact use show no suggestions.
- [ ] Decide: should meal ingredients count toward the history, or only hand-typed items? (Suggested: both.)

Note: the history starts empty, so suggestions appear only after an item has been bought three times.

## 2. Staples

One-tap re-add for things bought all the time, without waiting for history.

- [ ] **Star toggle** on each grocery item. It sets `staple: true` on the same `history/<name>` document as item 1.
- [ ] **"Staples" row** next to "Probably due": every staple not currently on the list, as one-tap chips.
- [ ] **Manage staples**: a way to un-star something that's no longer on the list (long list behind a "Edit staples" button).
- [ ] Build after item 1, since it shares the storage and the chip row.

## 3. Shared meal checklist

The check marks on a meal's shopping list sync between phones instead of staying on one device.

- [ ] **Store checks in** `mealChecks/shop` as `{checks: {<item key>: true}}`, subscribed live like the grocery list.
- [ ] **Fall back to `localStorage`** (`shop-checks-v2`, as now) when signed out or inside the artifact.
- [ ] **"Uncheck everything"** clears the shared document, so it resets for everyone. Use the same two-tap confirm as "Remove checked items".
- [ ] Update the note in `CLAUDE.md` that says meal checklists are per-device. Cooking-step checks stay per-device.

## Parked

- A mic button on the Grocery list tab (browser speech recognition). The Alexa route is done: see `alexa-skill/`.
- Collapse checked items into an "In the cart" group at the bottom of the grocery list.
