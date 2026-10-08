# Releasing Pizza Courier to the App Store (from Windows)

You don't need a Mac. EAS Build compiles and signs the app in the cloud, and EAS Submit uploads it to App Store
Connect.

**You need:** an [Apple Developer Program](https://developer.apple.com/programs/) membership (99 USD/year), a free
[Expo account](https://expo.dev/signup), and Node.js. EAS has a free tier with a monthly build allowance. See
[expo.dev/pricing](https://expo.dev/pricing).

## 1. Fill in the placeholders (before the first build)

| What | Where | Current value |
|---|---|---|
| **Bundle ID.** Permanent once the App Store record exists. | `app.json` → `ios.bundleIdentifier` (and `android.package`) | `com.ukarabulut.pizzacourier` |
| Copyright holder | `store.config.json` → `apple.copyright` | `2026 REPLACE_WITH_YOUR_NAME` |
| Privacy policy URL and support URL | `store.config.json` → `apple.info.en-US` | `https://umutkarr.github.io/pizza-courier/...`. Live once GitHub Pages is on (below). |
| Support email | `docs/privacy-policy.html`, `docs/support.html` | `REPLACE_WITH_SUPPORT_EMAIL` |

App Store names must be unique. The listing title is **Pizza Courier: Route Puzzle**, and the home-screen name is
**Pizza Courier**. If the title is taken, change `title` in `store.config.json` and, optionally, `name` in
`app.json`.

### Host the privacy policy and support page

Apple requires public URLs for both. This repo (`github.com/umutkarr/pizza-courier`) already holds the two pages in
`docs/`, so GitHub Pages can serve them:

1. Replace `REPLACE_WITH_SUPPORT_EMAIL` in both pages, then commit and push.
2. On GitHub, go to **Settings → Pages → Build and deployment**, choose *Deploy from a branch*, select `main` and
   `/docs`, and save.
3. After a minute, check that https://umutkarr.github.io/pizza-courier/privacy-policy.html and `.../support.html`
   load. These are the URLs already in `store.config.json`.

Pages needs a public repo on a free GitHub plan. If you keep the repo private, host the two files anywhere public and
update the URLs.

The app also has a built-in Privacy page (Settings → Privacy), as Apple requires.

## 2. Check everything still passes

```bash
cd pizza-courier
npm install
npm run verify         # typecheck, lint, logic tests, headless-Chrome smoke test
git add -A && git commit -m "Pizza Courier 1.0"   # EAS packages the project from git
```

## 3. Link the project to EAS

```bash
npm install -g eas-cli
eas login
eas init               # creates the EAS project and writes extra.eas.projectId into app.json
```

## 4. Build and upload to TestFlight

```bash
eas build -p ios --profile production --auto-submit
```

- On the first run, EAS asks for your Apple ID, then creates the distribution certificate and provisioning profile.
  Let it manage them.
- `--auto-submit` uploads the finished build to App Store Connect. If no App Store record exists for the bundle ID
  yet, EAS Submit offers to create one (app name, SKU, language).
- Build numbers increment automatically (`appVersionSource: remote`). The user-facing version is `version` in
  `app.json` (`1.0.0`).
- Apple processes the upload in 5–30 minutes. It then appears under **TestFlight** in App Store Connect. Install it
  on your iPhone through the TestFlight app and play a few levels.

Upload only, without building again: `eas submit -p ios --latest`.

## 5. Push the store listing

```bash
eas metadata:push      # title, subtitle, description, keywords, categories, age-rating answers, URLs
```

This works once the app record exists, which happens after the first submit.

## 6. Finish in App Store Connect (web)

1. **Screenshots.** Drag `store/screenshots/iphone-6.9/*.jpg` into the 6.9" iPhone slot and
   `store/screenshots/ipad-13/*.jpg` into the 13" iPad slot. They're the real game at Apple's required sizes (1290×2796
   and 2048×2732). They were rendered on Windows, so the font is Segoe UI rather than the Avenir Next you'll see on
   iOS. If you want pixel-exact shots, take them on a device from the TestFlight build. Re-generate them with
   `npm run screenshots`.
2. **App Privacy** → Get Started → *"No, we do not collect data from this app"*. The privacy label then reads **Data
   Not Collected**.
3. **Age rating.** `eas metadata:push` answers the classic content questions with "None". If App Store Connect asks
   any newer questions (ads, user content, messaging, web access, in-app controls), the answer is **No** for all of
   them. Expected rating: **4+**.
4. **Pricing and Availability.** Free, all territories (or your choice).
5. **App Review Information.** Your contact details. No sign-in required. Suggested notes:
   > No account or network needed; the game is fully offline. Drag from the pizzeria (rounded square) through every
   > house, or tap crossings, then press the red button to deliver.
6. Open the **1.0** version, select the processed build, then **Add for Review → Submit for Review**. Choose manual
   or automatic release. Review usually takes 1–2 days.

## Later releases

1. Bump `version` in `app.json` (e.g. `1.0.1`). The build number takes care of itself.
2. `npm run verify`, commit, then `eas build -p ios --profile production --auto-submit`.
3. In App Store Connect, create the new version, add "What's New" text, select the build and submit.

## Other builds

| Command | Gives you |
|---|---|
| `npm start` + Expo Go | Instant testing on your phone (dev mode: all levels unlocked, tuning panel). |
| `eas build -p ios --profile preview` | Ad-hoc install for registered devices (`eas device:create` first). |
| `eas build -p android --profile production` | Play Store bundle (`.aab`). Submit with `eas submit -p android`. Needs a Google Play account. |

## Review notes

- The game runs from a bundled HTML file inside a WebView. It is fully offline, has native haptics, saves locally,
  and has no browser UI or external links. This is a common, accepted setup for games (guideline 4.2 is about apps
  that only wrap a website).
- Export compliance is pre-answered: `ITSAppUsesNonExemptEncryption = false`, because the app uses no encryption.
- The store text does not mention other games by name. Keep it that way, because guideline 2.3.7 forbids it.
