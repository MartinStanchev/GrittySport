# Expo SDK 58 upgrade

Upgraded the mobile app from Expo SDK 54 to SDK 58 (React Native 0.81 → 0.88, React 19.1 → 19.3, TypeScript 5.9 → 6.0, Jest 29 → 30). Prerequisite for Live Activities / Dynamic Island via `expo-widgets` (stable since SDK 56).

## Dependencies
- `npx expo install expo@^58 --fix` aligned every Expo-managed package (all `expo-*` now `~58.x`, datetimepicker 9, netinfo 12, react-native-maps 1.29, screens 4.30, svg 15.16, safe-area-context 5.10).
- Third-party native libs bumped: `@kingstinct/react-native-healthkit` 13 → 16 (now ships `@react-native-healthkit/core`, autolinked transitively by Expo), `react-native-nitro-modules` 0.34 → 0.37, `react-native-health-connect` 3.5 → 4.1 (we already used the `react-native-health-connect` plugin, so the 4.0 Expo-plugin change needs nothing).
- `react-native-ble-plx` stays on 3.5.1 (latest upstream; unmaintained). If iOS/Android native builds fail, the maintained fork `@sfourdrinier/react-native-ble-plx` targets RN 0.86+.
- Removed: `react-native-edge-to-edge` (unused, unmaintained, edge-to-edge is built in), `react-native-linear-gradient` (unused; gifted-charts falls back to `expo-linear-gradient`), `jest-expo` (unused — Jest runs ts-jest).
- Added: `expo-splash-screen` (splash config now lives in its plugin). `ts-jest` 29.4.15 for TS 6 support.

## Config (`app.json`)
- Removed `newArchEnabled` and `android.edgeToEdgeEnabled` (no longer exist), and `ios.backgroundModes` (was never a valid field — the `location` background mode always came from the `expo-location` plugin; verified in prebuild output).
- Top-level `splash` → `["expo-splash-screen", { image, imageWidth: 200, resizeMode, backgroundColor }]`.
- Android permissions de-duplicated (every entry was listed twice, short + fully-qualified).
- `expo-build-properties`: dropped the `compileSdkVersion`/`targetSdkVersion: 34` pins (SDK defaults now; Play requires newer), kept `minSdkVersion: 26` (Health Connect), and set `enableMinifyInReleaseBuilds: false` — SDK 58 turns R8 on by default, which can break reflection-based native libs (BLE, Health Connect, Nitro). Re-enable after a verified release build.
- iOS deployment target is now 16.4 (SDK 56 floor); prebuild generates the iOS scene lifecycle.

## Code
- TS 6 no longer auto-includes `@types/*`: `tsconfig.json` sets `types: ["jest"]`. Added `moduleSuffixes: [".native", ""]` so tsc resolves platform-split modules (`importedWorkoutsStore.native.ts` etc.) — fixes 2 pre-existing errors.
- RN 0.88 strict types: `StyleSheet.absoluteFillObject` → `absoluteFill`; TextInput refs typed `TextInputInstance`; `ListFooterComponent` uses `undefined` instead of `null`.
- Fixed pre-existing type errors: notification handler uses `shouldShowBanner`/`shouldShowList` (replacing deprecated `shouldShowAlert`); removed non-existent gifted-charts props `hideXAxisText` and `invertYAxis` (they never had any effect — note the pace chart therefore isn't inverted).
- Workout file import reads files via `expo-file-system` `File` (`text()` / `bytes()`) instead of `fetch(file://)` + `FileReader`, since SDK 56 made `expo/fetch` the global `fetch`. FIT and ZIP parsers now take raw `Uint8Array` bytes (no base64 round trip; ZIP entries use `async('uint8array')`).
- File-system test mock trimmed to the `File`/`Directory`/`Paths` API actually used.

## Lint
- `eslint-config-expo` 58 enables React Compiler rules (`react-hooks/refs`, `set-state-in-effect`, `immutability`, `purity`) — 83 pre-existing violations across 23 files, mostly the "latest value ref" pattern. The compiler is not enabled, so they're downgraded to warnings **only for those 23 files** in `eslint.config.js`; all other files keep them as errors. Follow-up: migrate those files (carefully — RecordGPSScreen has 26) and shrink the list.

## Validation
- `tsc --noEmit`: 0 errors (was 7 pre-existing). Jest: 312/312. Lint: 0 errors. `expo export` bundles for iOS/Android/web. `expo prebuild` (scratch copy) succeeds for both platforms with all config plugins.
- Not verified here (no Xcode/Android SDK): native compile and on-device behaviour. Needs a new EAS dev build and device testing of BLE HR, Apple Health / Health Connect import, background GPS, maps, notifications, file import.

## Remaining notes
- `expo-doctor` still flags non-square `icon.png` (1024×883) and `adaptive-icon.png` (844×750) — pre-existing, App Store requires a square 1024² icon.
- `eas update` now requires `--environment`.
- EAS builds pin Node 24.13.0 (npm 11) via a `base` profile in `eas.json`. The EAS default image (npm 10) rejects the npm 11 lock file in `npm ci` ("Missing: @emnapi/core / @emnapi/runtime" — optional wasm peers that npm 11 leaves out). Keep this pin in sync with the local Node version.
