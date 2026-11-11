# Dinner Recipes

Mix-and-match dinner components with cooking steps and timers, plus a grocery list sorted by the layout of the store you pick (Walmart, Publix, Target or Aldi).

Website: https://luc-vdlee.github.io/dinner-rececipes/ (served by GitHub Pages from the `main` branch). You can also open `index.html` directly.

There is no build step. The whole app is `index.html`; `firebase-config.js` holds the Firebase web config; `icon.svg` and `apple-touch-icon.png` are the browser and home-screen icons.

## Shared grocery list

The grocery list is shared through Firebase when `firebase-config.js` contains a Firebase web app config. Everyone signs in with Google, and the Firestore security rules decide which email addresses can read and change the list. Without a config, or while signed out, the list is saved on each device only.

Once signed in, the list is also kept on the phone, so it opens and can be changed with no signal. Changes sync when the connection is back.

## One-time setup

1. **GitHub Pages**: repository Settings → Pages → Deploy from a branch → `main` / `(root)`.
2. **Firebase Authentication**: enable the Google sign-in provider.
3. **Authorized domains** (Authentication → Settings): add `luc-vdlee.github.io`.
4. **Firestore rules**: publish the rules below with the household's email addresses. Keep the addresses in the Firebase console only; this repository is public.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groceries/{item} {
      allow read, write: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in ['you@gmail.com', 'housemate@gmail.com'];
    }
  }
}
```

Sign-in opens a pop-up window, so use the site in Safari or Chrome rather than inside another app's built-in browser.

## Checking changes

Extract the inline script from `index.html` and run `node --check` on it, then open the page at about 400px wide and try both tabs.
