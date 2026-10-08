Pizza Courier: a canvas puzzle game (`web/index.html`) hosted full screen in a WebView by a small Expo app. See
README.md for the architecture and RELEASE.md for shipping.

## Project rules

- `web/index.html` is the game and the single source of truth. `src/game/gameHtml.generated.ts` is generated from it
  (`npm run web:watch` / `npm start`). Never edit the generated file.
- The `// ===== LOGIC START … END` block must stay pure (no DOM). Node tests and the solver tooling load it. After
  changing it or `LEVELS`, run `npm run solve`.
- The native ↔ game contract is `window.__PC_NATIVE__` (in) and `ReactNativeWebView.postMessage` (out). It is typed
  in `src/game/bridge.ts` and exercised by `scripts/smoke-test.mjs`. Change both sides together.
- Single-screen app: no navigation library. Don't add Expo Router unless the app gains real native screens.
- Run `npm run verify` (typecheck, lint, unit tests, browser smoke test) before declaring a task done.

## Expo has changed: don't trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently SDK 57).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt and follow its links. Never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add, so versions match the SDK
npm start                   # regenerate the game module, then start the dev server
npm run verify              # typecheck + lint + tests + smoke test
npx expo-doctor             # diagnose dependency and config issues
```

## Building with EAS

Build, sign and submit in the cloud with `eas build` / `eas submit` (see RELEASE.md). No local Xcode needed.
`ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them by hand; configure
native behaviour in `app.json`.
