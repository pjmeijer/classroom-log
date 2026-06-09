# Bug 2 — iOS Release: blue splash never transitions (ExpoAsset native module missing)

## Symptom
Release/TestFlight build shows the blue (#208AEF) native splash with the Expo
logo and never transitions to the app. No JS diagnostic overlay appears (the
1.5s force-hide `useEffect` in `app/_layout.tsx` never fires).

Reproduced locally 2026-06-09 in the iOS Simulator (iPhone 17 Pro, iOS 26.5)
with `npx expo run:ios --configuration Release`, cold-launched via `simctl`
with no Metro running (embedded bundle = TestFlight conditions).
Pre-fix screenshot: `expo-asset-missing-splash-hang-pre.png`.

## Reproducing console error (simctl system log, <500ms after launch)
```
ClassroomLog: (React) [com.facebook.react.log:javascript] [runtime not ready]: Error: Cannot find native module 'ExpoAsset'
ClassroomLog: (React) [com.facebook.react.log:native] Unhandled JS Exception: [runtime not ready]: Error: Cannot find native module 'ExpoAsset'
```

## Root cause
`expo-audio@1.1.1` declares `expo-asset` as a peerDependency with range `*`.
npm resolved `*` to the latest published `expo-asset@56.0.15` and hoisted it to
top-level `node_modules/expo-asset`, shadowing the SDK-54-correct `12.0.13`
that `expo@54.0.35` depends on. `expo-asset@56` is incompatible with this
project's `expo-modules-core`; its native module never autolinks (absent from
`ios/Podfile.lock` and `ios/Pods`). At launch the JS `expo-asset` package calls
`requireNativeModule('ExpoAsset')`, which isn't registered → unhandled JS
exception while `runtime not ready` → `SplashScreen.hideAsync()` never runs →
permanent native splash.

Confirmed not Mac-local: committed HEAD `mobile/package-lock.json` also pins
top-level `expo-asset` to 56.0.15, so the TestFlight IPA had the same bug.

## Fix
Pin `expo-asset` tree-wide to the SDK-54 version via `overrides` in
`mobile/package.json`:
```json
"overrides": { "expo-asset": "12.0.13" }
```
Then `npm install`, `npx expo prebuild --platform ios` (integrates ExpoAsset
pod), rebuild. Verified: app boots past splash (post screenshot:
`expo-asset-missing-splash-hang-post.png`).

## Regression guard
`npx expo-doctor` / `npm ls expo-asset` must show a single `expo-asset@12.x`.
If `expo-audio` is bumped, re-check that its `expo-asset` peer still resolves
to the SDK version and the override still matches.
