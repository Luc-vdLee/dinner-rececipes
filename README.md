# Dinner Recipes

Mix-and-match dinner components with cooking steps and timers, plus a grocery list sorted by the layout of the store you pick (Walmart, Publix, Target or Aldi).

Open `index.html`, or visit the GitHub Pages site for this repository.

## Shared grocery list

The grocery list is shared through Firebase when `firebase-config.js` contains a Firebase web app config. Everyone signs in with Google, and the Firestore security rules decide which email addresses can read and change the list. Without a config, the list is saved on each device only.
