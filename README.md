# Pizza Courier (iOS / Android app)

The route-planning puzzle from `../index.html`, packaged as a native app with Expo so it can be built in the cloud
and submitted to the App Store from Windows. Release steps: **[RELEASE.md](RELEASE.md)**.

## How it is put together

```
web/index.html          ← the game. Single file, vanilla JS + Canvas 2D. THE source of truth.
src/GameScreen.tsx      ← full-screen WebView that loads the game and bridges it to native
src/game/bridge.ts      ← message types, saves (AsyncStorage), haptics (expo-haptics)
App.tsx                 ← splash screen + safe-area provider
scripts/                ← build, solve, test, screenshot and icon scripts (Node)
tests/                  ← unit tests for the game logic
store.config.json       ← App Store listing (EAS Metadata)
store/screenshots/      ← App Store screenshots (generated)
docs/                   ← privacy policy + support pages to host
```

The game runs offline inside a WKWebView. `scripts/build-web.mjs` inlines `web/index.html` into
`src/game/gameHtml.generated.ts` (git-ignored; generated on `npm install` and `npm start`).

The bridge works in both directions:

| Direction | What |
|---|---|
| app → game | `window.__PC_NATIVE__` before load: saved progress, safe-area insets, app version, dev flag. Later inset changes go through `PC.fromNative()`. |
| game → app | `ready` hides the splash, `save` persists progress, `haptic` plays feedback, `error` is logged in dev builds. |

The page also works on its own in any browser, where progress goes to `localStorage`. Add `?dev` to the URL to get the
mechanics tuning panel.

### What changed from the prototype (`../index.html`)

The `LOGIC START … END` block is byte-for-byte unchanged. Around it:

- **Phone layout.** HUD respects the notch and home indicator. On portrait screens the city is transposed so its
  long side runs down the screen. This is safe because transposing keeps every length and turn angle, so times are
  unchanged (there is a test for this). Narrow-screen HUD sizes, SVG icons instead of emoji-prone glyphs.
- **Touch.** Bigger touch targets that never overlap neighbouring crossings. Single-pointer tracking. No sticky
  hover states. No text selection, callouts or zoom.
- **Fast par times.** The solver takes up to ~3 s on the hardest levels. The 9 fixed levels ship with precomputed
  best routes (`npm run solve`, checked by `npm test`). Random maps and tuned physics are solved in a Web Worker,
  so the UI never stalls.
- **Game shell.** How-to-play card on first launch with a level-1 hint line. Levels unlock as you finish the previous
  one, and random cities unlock after level 9. Settings: sound, haptics, drive speed, how to play, privacy, reset
  progress. Personal best times.
- **Juice.** Soft synthesized sounds (WebAudio, no files): snap plucks, house chime, delivery bell, star tones. Haptics
  on snaps, deliveries and results.
- **Dev only.** The physics tuning panel shows only in dev builds or with `?dev`.

## Commands

```bash
npm install            # also generates src/game/gameHtml.generated.ts
npm start              # Expo dev server. Scan the QR code with Expo Go on your iPhone
npm run web:watch      # regenerate the inlined game while you edit web/index.html (run next to npm start)

npm run solve          # after changing levels or the logic block: re-embed the best routes
npm run verify         # typecheck + lint + unit tests + headless-Chrome smoke test
npm run screenshots    # App Store screenshots → store/screenshots/{iphone-6.9,ipad-13}
npm run icons          # re-render assets/*.png (app icon, splash, Android layers)
```

The smoke test, screenshots and icons drive your installed Chrome or Edge through `puppeteer-core`. Set `CHROME_PATH`
if it is not found.

### Trying it on your iPhone without a Mac

Install **Expo Go** from the App Store, run `npm start` on this PC (same Wi-Fi), and scan the QR code with the
Camera app. Expo Go runs as a dev build, so all levels are unlocked and the tuning panel is visible. A real
installable build comes from EAS: see [RELEASE.md](RELEASE.md) (`preview` profile for testers, `production` for
TestFlight and the App Store).

### Editing the game

Edit `web/index.html` and open it straight in a browser (double-click works). Keep game rules inside the
`LOGIC START … END` block, which `tests/` and the solver tooling load in Node. If you touch levels or that block, run
`npm run solve`. Otherwise `npm test` fails, and the game falls back to solving in the background.
