# To do

## Done

- [x] Firestore rules published with the `history` and `mealChecks` collections (template in `README.md`)
- [x] Duplicate prompt, "added by / checked by" names
- [x] "In the cart" group for checked items
- [x] Shared meal checklist (`mealChecks/shop`; "Uncheck everything" resets for everyone after a second tap)
- [x] Old Claude artifact copy retired; its storage code is removed. The artifact page itself was left online, unused.

## Still to check by hand

- [ ] Sign in on two phones and confirm an item added on one appears on the other
- [ ] Check an item on a meal's shopping list on one phone and confirm it's checked on the other
- [ ] Rename the repository to `dinner-recipes` (GitHub → Settings → General → Repository name). The site address becomes `https://luc-vdlee.github.io/dinner-recipes/`; update home-screen shortcuts and the address in `README.md`. The Firebase authorized domain stays the same.

## Next: "Buy again" suggestions

Remember when each item was bought and suggest it when it's probably due. Decisions already made: everything checked off counts (typed items and meal ingredients), and items are suggested a bit early.

- [ ] **Record purchases.** When an item is checked off, write to `history/<normalised name>` (reuse `normName`): `{name, section, dates: [timestamps]}`. Keep the last 10 dates and ignore a second check-off on the same day, so unchecking and rechecking doesn't count twice.
- [ ] **Work out the rhythm.** With 3 or more dates, take the median gap between purchases. An item is due when the time since the last purchase is at least 90% of that gap.
- [ ] **Show a "Probably due" row** above the list: one chip per due item that isn't already on the list unchecked (`findListed`). Tapping a chip adds it (with `stamp`, the remembered section, no amount).
- [ ] **Let people dismiss a suggestion** ("not this time"), which hides it until the next expected date.
- [ ] Shared list only; signed out shows no suggestions.

Note: the history starts empty, so suggestions appear only after an item has been bought three times.

## Then: Staples

One-tap re-add for things bought all the time, without waiting for history.

- [ ] **Star toggle** on each grocery item. It sets `staple: true` on the same `history/<name>` document.
- [ ] **"Staples" row** next to "Probably due": every staple not currently on the list, as one-tap chips.
- [ ] **Manage staples**: an "Edit staples" button to un-star things that aren't on the list.

## Parked: voice input

Decided November 2026: not now, because the only official Alexa route needs a clunky phrase.

- Amazon closed third-party access to Alexa's built-in shopping list on 1 July 2024, so "Alexa, add milk to my shopping list" can't reach this site by official means.
- A custom skill would work as "Alexa, tell grocery list to add milk". It can stay private in the Development stage on the owner's own Echo devices. Unconfirmed: whether that still works on Alexa+ speakers. Its backend would write to Firestore with a service-account key, which must never be in this repo.
- Alternatives: a mic button on the Grocery list tab using the browser's speech recognition (no Amazon work, not hands-free), or an unofficial import of Alexa's own list (fragile, needs Amazon credentials stored somewhere).
