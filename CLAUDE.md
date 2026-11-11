# Dinner Recipes

A single-page, phone-first website (GitHub Pages) for planning dinners and shopping. Everything lives in `index.html`; `firebase-config.js` holds the Firebase web config.

## What the page does

- **Meals tab**: pick a saved meal or tick individual components. The page builds one merged shopping list (shared ingredients appear once, with each component's amount) and a cooking plan (a "game plan" so all components finish together, then each component's numbered steps with timers).
- **Grocery list tab**: a general list people add to by hand. "Add this meal to my grocery list" (under the component picker) copies a meal's non-optional ingredients into it.
- **Store menu**: Walmart, Publix, Target or Aldi. Both lists are ordered by that store's typical layout. Walmart-specific brands and prices show only when Walmart is selected.

## Data model (all in the script in `index.html`)

- `G_SECTIONS`: store sections (`produce`, `bakery`, `meat`, `pantry`, `spices`, `snacks`, `frozen`, `dairy`, `household`, `personal`, `other`).
- `STORES`: each store's walking order of those sections.
- `ITEMS`: ingredient catalog keyed by id: `section`, `name`, optional `buy` note, optional `walmart: {buy, price}`.
- `COMPONENTS`: reusable dish parts. Each has `id`, `name`, `short`, `kind` (Main / Side / Side or base), `minutes` (total time, used for the game plan), `uses` (`[itemKey, amount, optional?]`), `steps` (`{title, when?, p: [html paragraphs], tip?, timer?: [seconds, label], extra?: {otherComponentId: html}}`), and optional `with: {otherComponentId: {note, plan}}` for instructions that apply only when two components are cooked together.
- `MEALS`: named presets, each a list of component ids.

## Adding a dish

The user wants every dish split into components that can be recombined with others. When adding a recipe:

1. Split it into components (for example a main and a side, or a protein and a sauce/base). Each component must make sense cooked on its own, serving 4.
2. Add any new ingredients to `ITEMS` with the right store section. Reuse existing keys when the ingredient is the same so shopping lists merge.
3. Add the components to `COMPONENTS` with realistic `minutes`, clear steps, and timers on anything that waits (boiling, baking, resting).
4. Add `with` notes / step `extra` text where two components share a pan or timing.
5. Add the original dish to `MEALS`.

Copy style for steps: plain, direct sentences; amounts wrapped in `<span class="amt">`; US units first.

## Grocery list storage

The page picks a store at runtime:

1. Inside a Claude artifact (`window.claude.use` exists): the artifact's `db` capability, collection `groceries`.
2. `window.FIREBASE_CONFIG` set (this website): Firebase Firestore, collection `groceries`, with Google sign-in. Who can read and write is controlled by Firestore security rules in the Firebase console (an email allowlist), not by anything in this repo. Never put people's email addresses in this public repo.
3. Otherwise: `localStorage` on that device only.

Grocery documents: `{name, note, section, checked, createdAt}`.

Meal checklists and cooking-step checks are per-device (`localStorage`) on purpose.

The Firebase store keeps an offline copy (`enablePersistence`). Its write promises settle only when the server confirms, so never chain shared-list writes one after another; use `writeAll`. Sign-in uses a pop-up only: the redirect flow can't work on GitHub Pages because the auth domain differs from the site's.

## Design and conventions

- Colors are CSS tokens on `:root` with dark-mode overrides; keep every color a token.
- Must work at ~400px wide with no horizontal scroll; big tap targets.
- No build step and no framework. Firebase SDK (compat, 10.12.2) loads from gstatic only when a config is present.
- Check script syntax after edits, e.g. extract the inline script and run `node --check`.
