# Expo SDK 56 → 54 Downgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Downgrade `mobile/` from Expo SDK 56 to Expo SDK 54 so the app loads in App Store Expo Go (no TestFlight, no dev build, no Apple Developer Program required). Aligns with the user's other SDK 54 project so both run side-by-side in the same Expo Go.

**Architecture:** Single feature branch off `feat/v1-implementation`. Mechanical bumps in `package.json` + `app.json`, then `npx expo install --fix` resolves all `expo-*` and React Native sub-dep versions. One real code change: `expo-audio` permission API call sites (SDK 54 uses an `Audio` namespace; SDK 56 dropped it). `expo-file-system/legacy` import path still exists in SDK 54 (verified against docs) — no FS code changes needed. Drop unused expo packages entirely rather than downgrade them. Codex review on the diff before merging back.

**Tech Stack:**
- Expo SDK 54.0.0 (was 56.0.6)
- React 19.1.0 (was 19.2.3)
- React Native 0.81 (was 0.85.3)
- `expo-audio` SDK 54 with `Audio` namespace import
- `expo-file-system/legacy` (unchanged — same path exists in SDK 54)
- TypeScript 6.0.3, jest 29, expo-router (versions resolved by `expo install --fix`)

---

### Task 0: Branch + docs URL update

**Files:**
- Modify: `mobile/AGENTS.md`

- [ ] **Step 1: Create feature branch from current `feat/v1-implementation`**

Run from `/workspace`:
```bash
git checkout -b chore/sdk-54-downgrade
git status
```
Expected: "On branch chore/sdk-54-downgrade, nothing to commit, working tree clean"

- [ ] **Step 2: Update the SDK docs URL in mobile/AGENTS.md**

The file currently says:
```markdown
# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.
```

Change `v56.0.0` to `v54.0.0` so the project rule points at the new target SDK.

- [ ] **Step 3: Commit**

```bash
git add mobile/AGENTS.md
git commit -m "chore(mobile): point AGENTS docs URL at SDK 54"
```

---

### Task 1: Drop unused `expo-*` and `@expo/ui` deps

**Files:**
- Modify: `mobile/package.json`

These packages are listed but **never imported** anywhere in `mobile/app/`, `mobile/lib/`, `mobile/db/`, `mobile/components/`, or `mobile/api/` (verified via grep before planning). Removing them eliminates an entire class of SDK-incompatibility risk and shrinks `node_modules`.

- [ ] **Step 1: Edit `mobile/package.json`, remove these lines from `dependencies`:**

```
"@expo/ui": "~56.0.14",
"expo-device": "~56.0.4",
"expo-glass-effect": "~56.0.4",
"expo-haptics": "~56.0.3",
"expo-image": "~56.0.9",
"expo-linking": "~56.0.12",
"expo-status-bar": "~56.0.4",
"expo-symbols": "~56.0.5",
"expo-system-ui": "~56.0.5",
"expo-web-browser": "~56.0.5",
```

- [ ] **Step 2: Verify no imports break**

```bash
cd mobile && grep -rEn "from ['\"](@expo/ui|expo-device|expo-glass-effect|expo-haptics|expo-image|expo-linking|expo-status-bar|expo-symbols|expo-system-ui|expo-web-browser)" app components db api lib --include='*.ts' --include='*.tsx' 2>/dev/null
```
Expected: no output (zero matches).

- [ ] **Step 3: Stage but DO NOT commit yet — wait until Task 2 finishes so the lock and package.json land in one commit.**

---

### Task 2: Pin remaining deps to SDK 54 baseline + run `expo install --fix`

**Files:**
- Modify: `mobile/package.json` (the kept expo deps)
- Modify: `mobile/package-lock.json` (regenerated)

- [ ] **Step 1: Edit `mobile/package.json` `dependencies`**, change every `expo` / `expo-*` package version from `~56.x.y` to `~54.0.0`:

```json
"expo": "~54.0.0",
"expo-audio": "~54.0.0",
"expo-clipboard": "~54.0.0",
"expo-constants": "~54.0.0",
"expo-crypto": "~54.0.0",
"expo-file-system": "~54.0.0",
"expo-font": "~54.0.0",
"expo-router": "~54.0.0",
"expo-splash-screen": "~54.0.0",
"expo-sqlite": "~54.0.0"
```

And in `devDependencies`:
```json
"jest-expo": "^54.0.0"
```

Also drop React/RN versions so `expo install --fix` can resolve the SDK 54 baseline cleanly:
```json
"react": "19.1.0",
"react-dom": "19.1.0",
"react-native": "0.81.0"
```

Leave `@react-native/jest-preset`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-web`, `react-native-worklets`, `@expo/ngrok` versions as-is — `expo install --fix` will adjust the RN community libs in step 2.

- [ ] **Step 2: Run `expo install --fix` to resolve all transitive RN/Expo versions**

From `mobile/`:
```bash
npx expo install --check
# answer: yes
```
Then re-run if it prompts again:
```bash
npx expo install --check
```
until it reports "Dependencies are up to date."

Expected: package.json gets exact resolved versions for React/RN/Reanimated/Screens/etc; package-lock.json fully regenerated.

- [ ] **Step 3: Commit the dep alignment**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): downgrade deps to Expo SDK 54 baseline"
```

---

### Task 3: Fix `expo-audio` permission API call sites for SDK 54

**Files:**
- Modify: `mobile/lib/audio.ts:1,5`
- Modify: `mobile/app/onboarding.tsx:4,16`
- Modify: `mobile/lib/__tests__/audio.test.ts:1-15` (mock surface)

SDK 56 dropped the `Audio` namespace and exposed permission functions as top-level exports. SDK 54 still uses the namespace: `import { Audio } from 'expo-audio'; Audio.requestRecordingPermissionsAsync()`. The recorder hook + `AudioRecorder` methods are unchanged.

- [ ] **Step 1: Update `mobile/lib/audio.ts`**

Current top of file:
```ts
import { AudioModule, useAudioRecorder, RecordingPresets, type AudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

export async function ensurePermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}
```

Replace with:
```ts
import { Audio, useAudioRecorder, RecordingPresets, type AudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

export async function ensurePermission(): Promise<boolean> {
  const status = await Audio.requestRecordingPermissionsAsync();
  return status.granted;
}
```

(Rest of the file is unchanged. `useRecorder`, `startRecording`, `stopRecording`, `deleteRecording`, `cleanupOrphanRecordings` all use APIs that exist identically in SDK 54.)

- [ ] **Step 2: Update `mobile/app/onboarding.tsx`**

Current line 4:
```ts
import { requestRecordingPermissionsAsync } from 'expo-audio';
```
Change to:
```ts
import { Audio } from 'expo-audio';
```

Current line ~16 (the call site):
```ts
const status = await requestRecordingPermissionsAsync();
```
Change to:
```ts
const status = await Audio.requestRecordingPermissionsAsync();
```

- [ ] **Step 3: Update the jest mock in `mobile/lib/__tests__/audio.test.ts`**

Current mock setup (lines 1-15):
```ts
jest.mock('expo-audio', () => {
  ...
  return {
    AudioModule: {
      requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    },
    ...
  };
});
```

Change to mock the `Audio` namespace instead:
```ts
jest.mock('expo-audio', () => {
  ...
  return {
    Audio: {
      requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    },
    ...
  };
});
```

Read the full file first; the rest of the mock (the recorder factory) is unchanged. Keep `useAudioRecorder` and `RecordingPresets` mock exports identical.

- [ ] **Step 4: Run the audio test**

```bash
cd mobile && npm test -- --testPathPattern audio
```
Expected: PASS for `lib/__tests__/audio.test.ts` (all assertions).

If a test fails because `Audio.requestRecordingPermissionsAsync` isn't picked up by `ensurePermission`, re-check the import in `lib/audio.ts`.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/audio.ts mobile/app/onboarding.tsx mobile/lib/__tests__/audio.test.ts
git commit -m "feat(mobile): use Audio namespace for SDK 54 expo-audio API"
```

---

### Task 4: Strip `reactCompiler` experiment if SDK 54 doesn't support it

**Files:**
- Possibly modify: `mobile/app.json:42-45`

`reactCompiler` is a recent experiment. If `expo start` errors on it under SDK 54, remove the line. If it just warns, leave it.

- [ ] **Step 1: Try `npm start -- --tunnel` first (just to see if Metro starts)**

```bash
cd mobile && timeout 30 npm start -- --tunnel 2>&1 | head -40
```

Look for any errors mentioning `reactCompiler`. If none, skip to Step 3.

- [ ] **Step 2: If `reactCompiler` errors, remove it from `mobile/app.json`**

Current:
```json
"experiments": {
  "typedRoutes": true,
  "reactCompiler": true
}
```

Change to:
```json
"experiments": {
  "typedRoutes": true
}
```

- [ ] **Step 3: If Task 4 made a change, commit:**

```bash
git add mobile/app.json
git commit -m "chore(mobile): drop reactCompiler experiment for SDK 54"
```

If Task 4 made no change, skip the commit and move on.

---

### Task 5: Full test + typecheck verification

**Files:** none (verification only)

- [ ] **Step 1: Full jest run**

```bash
cd mobile && npm test
```
Expected: 24 tests pass (same count as on `feat/v1-implementation`). If a different test fails, read its name and the failure message and fix before continuing. Do NOT commit a broken test suite.

- [ ] **Step 2: TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```
Expected: zero errors.

If errors mention `expo-audio` types, the most likely cause is the `Audio` namespace import; re-verify Task 3. If errors mention removed deps (`expo-haptics`, etc), search for the offending import and either restore the dep or remove the usage.

- [ ] **Step 3: Metro bundle smoke**

```bash
cd mobile && npm start -- --tunnel
```
Watch for: "Tunnel ready" + QR code rendering with NO red errors above it. Press Ctrl+C after confirming.

This is the local smoke. Real-device verification belongs in T12 of the v1 plan, not this plan.

- [ ] **Step 4: No commit yet — go to Task 6 for codex review first.**

---

### Task 6: Codex review of full diff

**Files:** none (review only)

- [ ] **Step 1: Inspect the full diff vs `feat/v1-implementation` first**

```bash
git log --oneline feat/v1-implementation..HEAD
git diff feat/v1-implementation..HEAD --stat
```

Confirm the changed files match the plan: `mobile/package.json`, `mobile/package-lock.json`, `mobile/AGENTS.md`, `mobile/lib/audio.ts`, `mobile/app/onboarding.tsx`, `mobile/lib/__tests__/audio.test.ts`, possibly `mobile/app.json`. Nothing else should be touched.

- [ ] **Step 2: Run codex review**

Invoke the `/codex` skill with mode `review`:

```
/codex review
```

Pass the SDK 54 downgrade as scope context: "Review the diff vs feat/v1-implementation. Goal: downgrade mobile/ from Expo SDK 56 to 54 so the app loads in App Store Expo Go. Concerns to scrutinize: (1) expo-audio permission API correctness in SDK 54 (Audio namespace), (2) any leftover SDK 56 patterns I missed, (3) drop in coverage from removing unused deps. Pass/fail."

- [ ] **Step 3: Address findings**

If codex finds issues, fix them as additional commits on this branch. Re-run jest + tsc after each fix. If a finding is wrong or out of scope, reply to codex with the reason; do NOT silently ignore it.

- [ ] **Step 4: Final verification before declaring done**

```bash
cd /workspace/mobile && npm test && npx tsc --noEmit
```
Expected: 24/24 pass, zero TS errors.

---

### Task 7: Merge back into `feat/v1-implementation`

**Files:** none

- [ ] **Step 1: Fast-forward merge**

From `/workspace`:
```bash
git checkout feat/v1-implementation
git merge --ff-only chore/sdk-54-downgrade
```

If FF fails (someone committed to feat/v1-implementation while we were on the sub-branch), rebase first:
```bash
git checkout chore/sdk-54-downgrade
git rebase feat/v1-implementation
git checkout feat/v1-implementation
git merge --ff-only chore/sdk-54-downgrade
```

- [ ] **Step 2: Delete the sub-branch (local)**

```bash
git branch -d chore/sdk-54-downgrade
```

- [ ] **Step 3: STOP — do not push.** The user pushes from Windows. Tell them: "SDK 54 downgrade complete and merged into feat/v1-implementation locally. Push from Windows when ready, then rescan QR with App Store Expo Go."

---

## Verification gates (must all pass before declaring DONE)

- [x] `npm test` in `mobile/` → 24/24 pass
- [x] `npx tsc --noEmit` in `mobile/` → zero errors
- [x] On-device smoke test (App Store Expo Go, LAN mode): golden path
      onboarding → settings → capture (text) → summary works. Voice
      capture still pending (Task 14 in v1 plan — not in scope here).
- [x] `git diff feat/v1-implementation..chore/sdk-54-downgrade --stat`
      shows only SDK deps + lock + AGENTS URL + plan + UX feedback +
      README updates + .env.example — no scope creep.
- [x] Codex review returns PASS (1 P2 advisory on `.env.example`
      placeholder).
- [ ] Branch fast-forwarded into `feat/v1-implementation`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | PASS | 1 finding (P2), 0/1 fixed |
| Eng Review | `/plan-eng-review` | Architecture & tests | 0 | not run | mechanical SDK pin swap; in-container jest + tsc + on-device smoke covered it |

**CODEX:** PASS gate. One P2 advisory: `mobile/.env.example:10` ships a
placeholder URL (`https://example.ngrok.app`) that looks plausible enough
to be mistaken for a default. Suggests an obviously-invalid placeholder
(`EXPO_PUBLIC_API_BASE_URL=` or `https://your-backend.ngrok-free.app`).
Decision deferred to controller (the user committed an explicit value
intentionally during dev testing).

**UNRESOLVED:** 1 (the P2 above — decided not to block merge on it).

**VERDICT:** Codex CLEARED — ready to FF-merge into
`feat/v1-implementation`. Eng review skipped for this scope (pure dep
swap with full test + on-device smoke coverage).
