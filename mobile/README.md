# Halal Chicagoland — Mobile (Expo Go demo)

A thin native wrapper that loads the deployed Halal Chicagoland site in a
full-screen WebView, so it can be demoed on a phone via Expo Go without an
app store build.

## Before you run it

Open [`App.js`](./App.js) and set `SITE_URL` at the top of the file to the
deployed site's URL (e.g. your Netlify URL). It ships with a placeholder:

```js
const SITE_URL = 'https://REPLACE-ME.netlify.app';
```

The app will not load anything useful until this is set.

## Run instructions

From the `mobile/` directory:

```bash
npm install
npx expo start
```

This prints a QR code in the terminal (and opens Expo Dev Tools in your
browser). Make sure your phone and computer are on the same Wi‑Fi network,
then:

- **iPhone**: Open the built-in **Camera** app and point it at the QR code.
  A notification will appear — tap it to open the project in **Expo Go**
  (install Expo Go from the App Store first if you don't have it).
- **Android**: Install the **Expo Go** app from the Play Store, open it, and
  use its built-in "Scan QR code" option to scan the QR code from the
  terminal/browser.

The app will build and load on your device inside Expo Go.

## What it does

- Loads `SITE_URL` in a full-screen `react-native-webview`.
- Shows a spinner while the page loads.
- Shows a "Couldn't load the menu" screen with a **Retry** button if the site
  is unreachable.
- On Android, the hardware back button navigates back through the WebView's
  history instead of exiting the app.
- Requests camera and photo library access so the site's menu-photo upload
  (`<input type="file" accept="image/jpeg,image/png" capture="environment">`)
  can open the native camera/gallery picker on both iOS and Android.

## Notes

- This app has no native code checked in (no `ios/`/`android/` folders) — it
  runs entirely through Expo Go for the demo. If you later need a standalone
  build (TestFlight, Play Store, or custom native modules), you'll need to
  run `npx expo prebuild` or use EAS Build.
