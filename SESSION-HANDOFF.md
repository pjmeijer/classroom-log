# Session Handoff — 2026-06-08

> Drop this file in the new sandboxed session and ask Claude to read it first.
> It contains the full restored context from `gstack /context-restore` (source
> checkpoint: `~/.gstack/projects/pjmeijer-classroom-log/checkpoints/20260606-045610-testflight-white-screen-bug2-undiagnosed-waiting-for-mac.md`).

---

## Project / Branch / HEAD

- **Repo:** classroom-log (Expo SDK 54, special-ed teacher observation log)
- **Branch:** `feat/eas-testflight-impl`
- **HEAD:** `5a5c6db` — `chore(mobile): add temporary white-screen diagnostic to _layout.tsx`
- **Saved:** 2026-06-06 04:56 UTC
- **Status:** in-progress (paused mid-debug of TestFlight Bug 2, waiting on Mac Mini)

### Recent commits (newest first)

```
5a5c6db chore(mobile): add temporary white-screen diagnostic to _layout.tsx
94cf989 fix(mobile): wire iOS splash backgroundColor by adding top-level splash image
4a22756 feat(mobile): fill eas.json placeholders + re-init EAS link
77a1748 eas update
baf1714 chore(mobile): link project to EAS via eas init
3d87a8f docs(plan): fold README update into Task 10 of the EAS plan
6fe3067 fix(mobile): treat empty-string EXPO_PUBLIC_API_BASE_URL as unset
6e92f57 feat(mobile): add prod-mode guard to api/config.ts
```

---

## What we're working on

EAS Build → TestFlight pipeline is complete (plan: `docs/superpowers/plans/2026-06-04-eas-testflight-pipeline.md`). Two consecutive iOS bugs were identified on this branch.

### Bug 1 — FIXED (commit `94cf989`)

iOS splash background was white instead of `#208AEF`.

**Root cause:** confirmed via local `expo prebuild` in container + reading `@expo/prebuild-config` plugin source. `withIosSplashScreenStoryboardImage.js:34` only wires `backgroundColor` through `applyImageToSplashScreenXML` when `splash.image` is truthy. With image absent, `removeImageFromSplashScreen` runs and drops `backgroundColor` on the floor.

**Fix:** hoisted `image` + `imageWidth` to top-level of `expo-splash-screen` plugin config in `mobile/app.json`.

**Verified:** local prebuild → `ios/ClassroomLog/SplashScreen.storyboard` line 29 now references `name="SplashScreenBackground"` instead of `systemColor="systemBackgroundColor"`. TestFlight rebuild confirmed blue splash with default Expo logo renders.

**⚠️ Don't regress:** if future Claude removes the top-level `image` from the splash config, the bug returns silently. Full repro is in commit `94cf989`'s message.

### Bug 2 — UNDIAGNOSED (diagnostic patch in `5a5c6db`)

After Bug 1 fix, app shows blue splash but **never transitions past it**.

**Diagnostic patch added to `mobile/app/_layout.tsx`:**
- Destructured `fontError` from `useFonts`
- Force-hide splash after 1.5s
- `DiagnosticBoundary` class ErrorBoundary
- try/catch in `RouterGate.useEffect`
- All rendering visible orange/red labeled overlays with error text

**TestFlight result:** blue splash > 1.5s, never transitions, **no diagnostic overlay appears**.

**Interpretation:** the 1.5s force-hide `useEffect` itself never fires → `RootLayout` never mounts → JS bundle isn't reaching `expo-router/entry`. This is a **native-level init failure**, not app code.

**Pause point:** user getting a Mac Mini on 2026-06-06 — Xcode device console will name the failing module in seconds. The cost/value math obviously favors Mac arriving over more blind 15–25 min EAS rebuild cycles from Windows.

---

## Decisions made (don't relitigate)

- **Pause Windows debugging, resume on Mac.** Windows has no iOS device logs; each EAS rebuild is 15-25 min. Xcode Console via USB shows native crash trace at app launch in seconds.
- **Splash fix (`94cf989`) ships.** Local prebuild verification + Codex docs cross-check + TestFlight rebuild result all confirm. Not reverting.
- **Diagnostic patch (`5a5c6db`) stays for now.** Even with Xcode Console available, on-screen diagnostics may help cross-correlate JS-level errors with native logs. Revert once Mac debugging confirms root cause.
- **`splash-icon.png` is the default Expo starter (3.3KB, unmodified).** That's why "Expo logo" appears on splash. Cosmetic only; not the bug.
- **Used `/codex` consult mid-debug.** Codex reframe ("two stacked white screens — 'no blue' doesn't prove JS innocent") was the key insight. Per `feedback_codex_for_reviews` memory: also ran `/codex review` on the diagnostic patch before committing. Passed clean (one P2 advisory applied: `SplashScreen.hideAsync()` moved out of render into `useEffect` keyed on `fontError`).
- **No `babel.config.js` / `metro.config.js` needed in SDK 54.** Codex confirmed via docs lookup.

---

## Remaining work (in order)

1. **Mac Mini setup (when ready).**
   - Install Xcode (free, Mac App Store, ~10GB).
   - Install Node via nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash` then `nvm install 22`.
   - Install eas-cli: `npm i -g eas-cli`.
   - Clone repo: `git clone <url>` on branch `feat/eas-testflight-impl`.
   - `cd mobile && npm install`.

2. **First debug attempt on Mac.**
   - Plug iPhone in via USB → unlock → tap "Trust This Computer".
   - Open Xcode → Window → Devices and Simulators → confirm device appears.
   - `cd mobile && npx expo run:ios --device --configuration Release`.
   - Crash trace will appear in terminal AND in Xcode → Window → Devices and Simulators → select device → View Device Logs.

3. **Diagnose Bug 2 from native crash trace.**
   Likely suspects per Codex:
   - reanimated 4 / worklets 0.5.1 (New Architecture init)
   - expo-sqlite native module
   - Hermes runtime
   - expo-audio
   - react-native-screens (`~4.16.0`)
   - react-native-safe-area-context

   The trace will name the failing module + line.

4. **Fix Bug 2.** Apply targeted fix once root cause identified. Sub-minute iteration on Mac (Cmd+R in Xcode or restart `expo run:ios`).

5. **Revert diagnostic patch.** `git revert 5a5c6db` once Bug 2 fixed and Mac-based debugging confirmed reliable.

6. **Resume EAS plan remaining tasks (deferred):**
   - **Task 7 Step 4:** pin numeric `ascAppId` into `mobile/eas.json` under `submit.preview.ios`. Get from https://expo.dev/accounts/pjmeijer/projects/classroom-log/submissions or App Store Connect → My Apps → Classroom Log → App Information.
   - **Task 8:** ASC browser setup — App Information, Test Information, Internal Group `Devs`, External Group `Cohort 1`, Beta App Review submit, Public Link toggle.
   - **Task 10:** FF land + update root `README.md` + `mobile/README.md` with Testing/Distribution sections per `project_readme_testflight_update` memory.

7. **Cosmetic cleanup:**
   - Swap `mobile/assets/images/splash-icon.png` from default Expo logo to actual app logo.
   - Remove dead `"buildNumber": "1"` from `mobile/app.json:12` (EAS-warned dead field under `appVersionSource: "remote"`).

---

## Active sessions / artifacts

- **Codex consult session:** `019e9b0c-6ea5-7450-be16-447930e260b1` (white-screen diagnosis thread). Resume with `/codex` → Continue option. Stored at `.context/codex-session-id`.
- **Last TestFlight IPA (before diagnostic patch):** https://expo.dev/artifacts/eas/8D8sLYVjHgr1Usmt4e27TE.ipa
- **`mobile/check-ipa.ps1`** — PowerShell diagnostic on user's Windows working tree at `C:\Users\pjmei\source\repos\classroom-log\mobile\`. Downloads latest IPA, extracts `main.jsbundle`, greps for `classroom-log-production.up.railway.app` to verify `EXPO_PUBLIC_API_BASE_URL` inlining + checks for splash hex strings. Re-runnable with updated `$ipaUrl` after each new EAS build. **Last run confirmed env var IS inlined** (config.ts guard hypothesis killed).

---

## Stack versions (Mac setup reference)

```
expo                          ~54.0.0
expo-router                   ~6.0.24
expo-splash-screen            ~31.0.13
expo-sqlite                   ~16.0.10
expo-audio                    ~1.1.1
expo-font                     ~14.0.12
react-native                  0.81.5
react                         19.1.0
react-native-reanimated       ~4.1.1
react-native-worklets         0.5.1
react-native-screens          ~4.16.0
react-native-safe-area-context ~5.6.0
```

No `newArchEnabled` set in `app.json` — SDK 54 default is `true`. Confirmed not the bug (reanimated 4 requires New Arch, would have crashed differently).

---

## Environment gotchas

- **AGENTS.md mandates** reading SDK 54 docs (https://docs.expo.dev/versions/v54.0.0/) before changing mobile code.
- **Repo has 80+ CRLF-noise files** in `git status` from WSL2 ↔ Windows line endings. Known, ignore when staging, **never `git add -A`**.
- **No `babel.config.js` / `metro.config.js`** in `mobile/`. SDK 54 doesn't need them. Codex docs-verified.
- **Windows host (this user):** backend at `C:\Users\pjmei\source\repos\AI-coach`, started with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`. Give PowerShell/Python, not bash, for runnable scripts.

---

## Relevant memories (still accurate)

- `project_classroomlog_infra` — Railway running (free tier), Apple Dev paid, cohort path is EAS Build → TestFlight. Distinct from AI-coach's parked Railway.
- `project_readme_testflight_update` — Task 10 of EAS plan; root + mobile READMEs need Testing/Distribution sections, drop "TestFlight out of scope" wording.
- `feedback_codex_for_reviews` — use `/codex review`, not in-session subagent reviewers.
- `user_windows_host` — Windows host limitation drove the pause-and-wait-for-Mac decision.
- `feedback_invoke_skills_first` — invoke the relevant superpowers skill via Skill tool BEFORE the action.
- `feedback_no_gbrain_in_classroomlog` — no gbrain CLI / MCP / `/sync-gbrain` in classroom-log at all.
- `feedback_subagent_git_boundary` — subagents must be told "stay on feature branch, controller does merges".

---

## How to use this file in the new session

1. Open the new sandboxed session in this repo.
2. Tell Claude: **"Read `SESSION-HANDOFF.md` first, then we're resuming."**
3. The new Claude should:
   - Confirm branch is `feat/eas-testflight-impl` and HEAD is `5a5c6db` (or note any diff).
   - Skip relitigating Bug 1 — it's shipped.
   - Pick up at "Remaining work → Step 2" (first debug attempt on Mac) unless you redirect.
4. Once Bug 2 is fixed and `5a5c6db` is reverted, delete this file.

---

*Generated by `/context-restore` on 2026-06-08. Source checkpoint:*
`~/.gstack/projects/pjmeijer-classroom-log/checkpoints/20260606-045610-testflight-white-screen-bug2-undiagnosed-waiting-for-mac.md`
