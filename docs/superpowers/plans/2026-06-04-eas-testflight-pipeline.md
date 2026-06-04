# EAS Build → TestFlight Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every subagent dispatched against this plan MUST be told to use superpowers:test-driven-development (Task 3) and superpowers:verification-before-completion (every task that runs commands).

**Goal:** Stand up the EAS Cloud → External TestFlight + public-link pipeline so classroom-log can be installed on the teacher cohort's iPhones via a single tap link.

**Architecture:** Container side (this repo) prepares `mobile/eas.json`, edits `mobile/app.json` to set the iOS bundle id / encryption flag, and changes `mobile/api/config.ts` to fail fast in non-dev builds. User side (Windows PowerShell + App Store Connect browser) runs `eas` CLI commands and clicks through the ASC TestFlight setup. The two sides are sequenced explicitly below; do NOT mix them.

**Tech Stack:** Expo SDK 54, EAS CLI (global, latest), App Store Connect, TestFlight, Apple Developer Program (already paid), Railway production backend (already running).

**Spec:** `docs/superpowers/specs/2026-06-04-eas-testflight-pipeline-design.md` (codex-reviewed three rounds; gate PASS).

**Branch:** `feat/eas-testflight-pipeline` (already on it — do NOT branch off `main` again; do NOT FF-merge from a subagent).

**Git identity for commits:** `pjmeijer <pjmeijer@me.com>`.

---

## Values the user fills at execution time

These are unknown until execution and must NOT be invented. Stop and ask the user before any task that needs one.

| Placeholder used in this plan | Real value source |
|---|---|
| `<RAILWAY_URL>` | Railway dashboard → classroom-log service → public URL. Looks like `https://classroom-log-production-XXXX.up.railway.app` |
| `<APPLE_ID>` | User's Apple ID email (the one with Developer Program enrollment) |
| `<APPLE_TEAM_ID>` | 10-char string surfaced by `eas credentials` (Task 5) or visible in `https://developer.apple.com/account` → Membership |
| `<COMPANY_NAME>` | Seller name shown in App Store for the first app under this account. Recommended: `pjmeijer` |

The plan parks these placeholders in the actual files and flags them again at each user-side task. Search the implementation diff for `<RAILWAY_URL>`, `<APPLE_ID>`, `<APPLE_TEAM_ID>`, `<COMPANY_NAME>` before running `eas build` to make sure none leaked into a committed file.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `mobile/eas.json` | Create | EAS Build + Submit config; single `preview` profile; plain `env` block; `appVersionSource: "remote"`; `ascAppId` deliberately omitted for first submit |
| `mobile/app.json` | Modify | Set `expo.name`, `expo.slug`, add `expo.ios.bundleIdentifier`, `expo.ios.buildNumber`, `expo.ios.config.usesNonExemptEncryption`. `expo.extra.eas.projectId` lands later via `eas init` (Task 5) |
| `mobile/api/config.ts` | Modify | Add `__DEV__` guard so non-dev builds throw at module-load when `EXPO_PUBLIC_API_BASE_URL` is unset (instead of silently shipping the `https://example.ngrok.app` sentinel to a tester) |
| `mobile/api/__tests__/config.test.ts` | Create | Jest tests for the guard: env-set returns value, env-unset + `__DEV__=true` returns sentinel, env-unset + `__DEV__=false` throws |

No other files touched in this plan. Spec §"Out of scope" is binding — do NOT add a `production` profile, an Android profile, EAS Update channels, GitHub Actions, APNs cert provisioning, Crashlytics/Sentry, or a Danish display name.

---

## Task 1: Create `mobile/eas.json` (first-submit form)

**Files:**
- Create: `mobile/eas.json`

This is the literal file content. `ascAppId` is intentionally absent — EAS Submit treats any non-empty string in that field as a real numeric ASC App ID and skips the auto-create path on first run.

- [ ] **Step 1: Write `mobile/eas.json`**

Create `mobile/eas.json` with this exact content (note `<RAILWAY_URL>`, `<APPLE_ID>`, `<APPLE_TEAM_ID>`, `<COMPANY_NAME>` are placeholders to fill before the first `eas build`):

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "store",
      "ios": {
        "autoIncrement": true
      },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "<RAILWAY_URL>"
      }
    }
  },
  "submit": {
    "preview": {
      "ios": {
        "appleId": "<APPLE_ID>",
        "appleTeamId": "<APPLE_TEAM_ID>",
        "appName": "Classroom Log",
        "language": "en-US",
        "sku": "classroomlog-001",
        "companyName": "<COMPANY_NAME>"
      }
    }
  }
}
```

- [ ] **Step 2: Verify the JSON parses**

Run from `/workspace`:

```bash
node -e "console.log(JSON.stringify(require('./mobile/eas.json'), null, 2))" | head -20
```

Expected: pretty-printed JSON echoed back, no syntax error. Exit 0.

- [ ] **Step 3: Verify `ascAppId` is NOT present**

Run from `/workspace`:

```bash
grep -n '"ascAppId"' mobile/eas.json && echo "FAIL: ascAppId must be absent" || echo "PASS: ascAppId absent"
```

Expected: `PASS: ascAppId absent`. If FAIL, remove the line — its presence on first submit breaks the ASC auto-create path (spec §"Important" note in `mobile/eas.json` section).

- [ ] **Step 4: Commit**

Run from `/workspace`:

```bash
git add mobile/eas.json
git -c user.email=pjmeijer@me.com -c user.name=pjmeijer commit -m "feat(mobile): add eas.json with preview profile for TestFlight builds

First-submit form per spec: single preview profile, distribution=store,
appVersionSource=remote so buildNumber tracking does not require git
commits, plain env block for the Railway URL (not a secret, version
control is fine), ascAppId omitted so EAS Submit auto-creates the ASC
app record on first run.

See docs/superpowers/specs/2026-06-04-eas-testflight-pipeline-design.md
for the full design rationale and field-by-field choices."
```

---

## Task 2: Edit `mobile/app.json` (bundle id, build number, encryption flag, app name, slug)

**Files:**
- Modify: `mobile/app.json:2-12` (the `expo.name`, `expo.slug`, `expo.ios` blocks)

Current relevant content (lines 2-12):

```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "mobile",
    "userInterfaceStyle": "automatic",
    "ios": {
      "icon": "./assets/expo.icon"
    },
```

- [ ] **Step 1: Rename `name` from `"mobile"` to `"Classroom Log"`**

In `mobile/app.json`, change line 3 from `"name": "mobile",` to `"name": "Classroom Log",`. This is the home-screen and TestFlight display name.

- [ ] **Step 2: Rename `slug` from `"mobile"` to `"classroom-log"`**

In `mobile/app.json`, change line 4 from `"slug": "mobile",` to `"slug": "classroom-log",`. This is Expo's internal project identifier surfaced on the `expo.dev` dashboard.

- [ ] **Step 3: Add `ios.bundleIdentifier`, `ios.buildNumber`, `ios.config.usesNonExemptEncryption`**

In `mobile/app.json`, change the `ios` block from:

```json
    "ios": {
      "icon": "./assets/expo.icon"
    },
```

to:

```json
    "ios": {
      "bundleIdentifier": "com.pjmeijer.classroomlog",
      "buildNumber": "1",
      "config": {
        "usesNonExemptEncryption": false
      },
      "icon": "./assets/expo.icon"
    },
```

`bundleIdentifier` is locked at `com.pjmeijer.classroomlog` per spec decision-trace D4. `buildNumber: "1"` is the initial seed — EAS server-tracks the live value via `appVersionSource: "remote"`. `usesNonExemptEncryption: false` bakes `ITSAppUsesNonExemptEncryption = false` into Info.plist on every build, so ASC builds skip the `Missing Compliance` state entirely (we only use exempt encryption — standard HTTPS + OS-provided crypto).

- [ ] **Step 4: Verify the JSON parses and the new fields are present**

Run from `/workspace`:

```bash
node -e "
const a = require('./mobile/app.json');
const c = (cond, label) => console.log((cond ? 'PASS: ' : 'FAIL: ') + label);
c(a.expo.name === 'Classroom Log', 'name = Classroom Log');
c(a.expo.slug === 'classroom-log', 'slug = classroom-log');
c(a.expo.ios.bundleIdentifier === 'com.pjmeijer.classroomlog', 'bundleIdentifier');
c(a.expo.ios.buildNumber === '1', 'buildNumber = 1');
c(a.expo.ios.config && a.expo.ios.config.usesNonExemptEncryption === false, 'usesNonExemptEncryption = false');
"
```

Expected: five `PASS:` lines. If any FAIL, fix and re-run.

- [ ] **Step 5: Run tsc to confirm no schema breakage anywhere else**

Run from `mobile/`:

```bash
cd mobile && npx tsc --noEmit
```

Expected: exit 0, no errors. `app.json` schema changes shouldn't touch TypeScript, but this is a cheap safety net.

- [ ] **Step 6: Commit**

Run from `/workspace`:

```bash
git add mobile/app.json
git -c user.email=pjmeijer@me.com -c user.name=pjmeijer commit -m "feat(mobile): set bundle id, encryption flag, app name in app.json

- name: 'mobile' -> 'Classroom Log' (home-screen + TestFlight display)
- slug: 'mobile' -> 'classroom-log' (Expo dashboard identifier)
- ios.bundleIdentifier: 'com.pjmeijer.classroomlog' (locked per D4)
- ios.buildNumber: '1' (seed; EAS tracks live value remotely)
- ios.config.usesNonExemptEncryption: false (skips Missing Compliance
  loop on every TestFlight upload; app uses only exempt encryption)"
```

---

## Task 3: TDD the `mobile/api/config.ts` prod-mode guard

**Files:**
- Create: `mobile/api/__tests__/config.test.ts`
- Modify: `mobile/api/config.ts` (1-line file → guarded form)

Subagent dispatch note: this task is the explicit RED → GREEN cycle. Whichever executor (or subagent) runs it MUST use **superpowers:test-driven-development** — verify each test fails for the right reason before writing the implementation.

Current `mobile/api/config.ts` (full file):

```ts
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://example.ngrok.app';
```

- [ ] **Step 1: Write the failing test file**

Create `mobile/api/__tests__/config.test.ts` with this exact content:

```ts
describe('DEFAULT_API_BASE_URL', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalDev = (global as any).__DEV__;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalEnv;
    }
    (global as any).__DEV__ = originalDev;
    jest.resetModules();
  });

  it('uses the env value when EXPO_PUBLIC_API_BASE_URL is set', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://prod.railway.app';
    jest.isolateModules(() => {
      const { DEFAULT_API_BASE_URL } = require('../config');
      expect(DEFAULT_API_BASE_URL).toBe('https://prod.railway.app');
    });
  });

  it('falls back to the sentinel in __DEV__ when env is unset', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    (global as any).__DEV__ = true;
    jest.isolateModules(() => {
      const { DEFAULT_API_BASE_URL } = require('../config');
      expect(DEFAULT_API_BASE_URL).toBe('https://example.ngrok.app');
    });
  });

  it('throws in non-dev builds when env is unset', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    (global as any).__DEV__ = false;
    expect(() => {
      jest.isolateModules(() => {
        require('../config');
      });
    }).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });
});
```

- [ ] **Step 2: Run the new test — confirm it FAILS for the right reason**

Run from `mobile/`:

```bash
cd mobile && npx jest api/__tests__/config.test.ts -v
```

Expected: the `throws in non-dev builds when env is unset` test FAILS because the current `config.ts` does NOT throw — it returns the sentinel. The other two tests should PASS (current implementation already covers env-set and env-unset-falls-back-to-sentinel paths).

If the failing test fails for any OTHER reason (e.g., `jest.isolateModules` not found, module-resolution errors), fix the test BEFORE writing implementation. RED must be for the right reason.

- [ ] **Step 3: Write the minimal implementation that makes the failing test pass**

Replace the entire contents of `mobile/api/config.ts` with:

```ts
const url = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!url) {
  if (!(global as any).__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is required for non-dev builds. ' +
      'Check eas.json build.<profile>.env or your local .env for dev.',
    );
  }
}
export const DEFAULT_API_BASE_URL = url ?? 'https://example.ngrok.app';
```

Note: `(global as any).__DEV__` access keeps this file working in both jest (where `__DEV__` is `true` by default) and React Native runtime (where `__DEV__` is a global flipped by Metro). The `as any` is necessary because TypeScript's `globalThis` typing doesn't include `__DEV__` without a custom ambient declaration, and we don't want to invent one for one usage.

- [ ] **Step 4: Re-run the test — confirm all three pass**

Run from `mobile/`:

```bash
cd mobile && npx jest api/__tests__/config.test.ts -v
```

Expected: 3 tests passed, 0 failed. Suite name "DEFAULT_API_BASE_URL".

- [ ] **Step 5: Run the full jest suite — no regressions**

Run from `mobile/`:

```bash
cd mobile && npx jest
```

Expected: `Test Suites: 12 passed, 12 total` (one more suite than the previous 11) and `Tests: 63 passed, 63 total` (three more than the previous 60). If any pre-existing test now fails, the guard's behavior is wrong — investigate `mobile/api/__tests__/api.test.ts` and `transcribe.test.ts` since they call into the same module graph.

- [ ] **Step 6: Run tsc — confirm no type errors**

Run from `mobile/`:

```bash
cd mobile && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 7: Commit**

Run from `/workspace`:

```bash
git add mobile/api/config.ts mobile/api/__tests__/config.test.ts
git -c user.email=pjmeijer@me.com -c user.name=pjmeijer commit -m "feat(mobile): add prod-mode guard to api/config.ts

Throw at module-load when EXPO_PUBLIC_API_BASE_URL is unset AND
__DEV__ is false. This converts the silent 'ship example.ngrok.app
to a tester' footgun into a loud module-load crash that EAS Build
catches before producing an IPA.

Dev builds (__DEV__ === true, jest, Metro-served) still fall back to
the sentinel so tunnel/local workflows are unaffected.

Three new jest tests in api/__tests__/config.test.ts verify the
three branches. Suite total: 60 -> 63 passing."
```

---

## Task 4: Verification gate — typecheck + full jest pass on the implementation diff

**Files:** none modified. This task is a sanity gate before invoking review subagents.

- [ ] **Step 1: Re-run typecheck from a clean state**

Run from `mobile/`:

```bash
cd mobile && npx tsc --noEmit
```

Expected: exit 0. Errors here block everything downstream.

- [ ] **Step 2: Re-run the full jest suite**

Run from `mobile/`:

```bash
cd mobile && npx jest
```

Expected: `Test Suites: 12 passed, 12 total`, `Tests: 63 passed, 63 total`. If counts differ, investigate which test changed and why before continuing.

- [ ] **Step 3: Verify branch state**

Run from `/workspace`:

```bash
git branch --show-current
git log --oneline main..HEAD
```

Expected: branch is `feat/eas-testflight-pipeline`. The log should show (top to bottom, most recent first) 3 implementation commits (`feat(mobile): add prod-mode guard…`, `feat(mobile): set bundle id…`, `feat(mobile): add eas.json…`) plus 4 spec commits from earlier. If the branch is wrong, STOP and re-check `git checkout feat/eas-testflight-pipeline` before continuing.

- [ ] **Step 4: Verify no placeholder leaked into a committed file**

Run from `/workspace`:

```bash
git diff main..HEAD -- mobile/ | grep -E '<RAILWAY_URL>|<APPLE_ID>|<APPLE_TEAM_ID>|<COMPANY_NAME>' && echo "FAIL: placeholders present in committed files" || echo "PASS: no placeholders in committed mobile/ files"
```

Expected: `PASS: no placeholders in committed mobile/ files`.

Wait — `mobile/eas.json` DOES contain these placeholders as committed (we deliberately didn't fill them in Task 1; they're meant to be filled by the user at Task 6 before first `eas build`). So the expected result is actually FAIL — placeholders ARE present in `mobile/eas.json`. That's the design.

Re-run with the correct expectation:

```bash
git diff main..HEAD -- mobile/eas.json | grep -E '<RAILWAY_URL>|<APPLE_ID>|<APPLE_TEAM_ID>|<COMPANY_NAME>' | wc -l
```

Expected: `4` — four placeholder strings in the diff (one each for RAILWAY_URL, APPLE_ID, APPLE_TEAM_ID, COMPANY_NAME). If less, a value got hard-coded; if more, an extra placeholder was added. Investigate before proceeding.

---

## Task 5: Spec-compliance subagent check + codex review

**Files:** none modified. Two gating reviews before user-side work begins.

**REQUIRED SUB-SKILL for the spec-compliance subagent:** superpowers:verification-before-completion (the subagent MUST verify its claims with grep/Read evidence, not assert from memory).

- [ ] **Step 1: Dispatch the spec-compliance subagent**

Use the Agent tool with subagent_type `general-purpose`. Prompt the subagent with the following (verbatim, fill in nothing extra):

> Audit whether the diff on branch `feat/eas-testflight-pipeline` (against `main`) faithfully implements the design spec at `docs/superpowers/specs/2026-06-04-eas-testflight-pipeline-design.md`. This is a mechanical plan-vs-code gap check, not a code-quality review. Use superpowers:verification-before-completion — every claim must cite a specific file/line or grep output, not a recollection.
>
> Steps:
> 1. Read the spec end to end.
> 2. Read each touched file (`mobile/eas.json`, `mobile/app.json`, `mobile/api/config.ts`, `mobile/api/__tests__/config.test.ts`).
> 3. For each spec assertion that says "do X" / "include Y" / "the file MUST contain Z", verify the assertion in the implementation. Mark each as PRESENT, MISSING, or DIFFERENT.
> 4. Specifically check: `cli.appVersionSource: "remote"`, `build.preview.distribution: "store"`, `build.preview.ios.autoIncrement: true`, `submit.preview.ios.ascAppId` ABSENT, `ios.bundleIdentifier: "com.pjmeijer.classroomlog"`, `ios.config.usesNonExemptEncryption: false`, the three jest test names exist and match the spec's behavior description, the prod-mode guard throws when `__DEV__` is false and env is unset.
>
> Report: a list of every gap (MISSING / DIFFERENT items) with file:line citations. If zero gaps, report "CLEAN — no gaps found."
>
> Do NOT modify any files. Do NOT commit anything. Do NOT push. Stay on the current branch. Report only.

- [ ] **Step 2: Address any gaps the subagent surfaces**

If the subagent reports MISSING / DIFFERENT items, fix each gap with a new commit BEFORE continuing to Step 3. Use exact `git add <file>` + the same `pjmeijer@me.com` identity. Then re-run Step 1.

If the subagent reports "CLEAN — no gaps found", proceed to Step 3.

- [ ] **Step 3: Run `/codex review` on the implementation diff**

Invoke the codex skill via the Skill tool:

```
Skill: codex
Args: review the implementation of docs/superpowers/specs/2026-06-04-eas-testflight-pipeline-design.md on branch feat/eas-testflight-pipeline (4 spec commits + 3 implementation commits). Focus on: (1) does mobile/eas.json match SDK 54 EAS schema exactly, (2) is the prod-mode guard in mobile/api/config.ts free of subtle bugs around __DEV__ access in jest vs. RN runtime, (3) is the app.json edit complete (bundleIdentifier, buildNumber, config.usesNonExemptEncryption, name, slug — nothing missing, nothing extra), (4) does the jest test set actually verify what the spec says it does. Mark P1 (would break first eas build / eas submit / on-device install) vs P2 (advisory). No compliments.
```

- [ ] **Step 4: Address P1 findings; decide on P2s**

Any `[P1]` in the codex output is a gate FAIL — fix with new commits, then re-run `/codex review` until PASS. `[P2]` is advisory; address if quick or note as a follow-up.

When codex returns PASS (no `[P1]`), proceed to Task 6.

---

## Task 6: User-side — install eas-cli, login, init, fill placeholders

**Side:** Windows PowerShell (the container CANNOT do this — no Apple-side auth, no browser for Expo login). The Claude container should STOP here and the user takes over.

**REQUIRED ACTION:** Before this task starts, the user collects the four open values from the table at the top of this plan: `<RAILWAY_URL>`, `<APPLE_ID>`, `<APPLE_TEAM_ID>`, `<COMPANY_NAME>`. `<APPLE_TEAM_ID>` is visible at `https://developer.apple.com/account` → Membership → Team ID. If unknown, Step 5 below also surfaces it.

- [ ] **Step 1: Install eas-cli globally**

Run from Windows PowerShell (any directory):

```powershell
npm install -g eas-cli@latest
eas --version
```

Expected: a version string like `eas-cli/16.x.y`. If the install fails with a permission error, run PowerShell as Administrator OR set `npm config set prefix "$env:USERPROFILE\AppData\Roaming\npm-global"` and add that path to `PATH`.

- [ ] **Step 2: Log in to Expo**

Run from Windows PowerShell:

```powershell
eas login
```

A browser will open. Sign in with the Expo account (or create one with the user's Apple ID email if first time). Back in the terminal, `eas whoami` should print the username.

- [ ] **Step 3: Pull the feature branch on the Windows side**

Run from `C:\Users\pjmei\source\repos\classroom-log` (or wherever the user's local clone is):

```powershell
git fetch origin
git checkout feat/eas-testflight-pipeline
git pull --ff-only
```

Expected: the branch is now at the HEAD created by the container (3 impl commits + the spec commits). If `pull --ff-only` fails, the Windows side has diverged — STOP and reconcile manually before continuing.

- [ ] **Step 4: Initialize EAS for this project**

Run from `mobile/`:

```powershell
cd mobile
eas init
```

This will prompt: "Would you like to link this project to your Expo account?" — yes. It writes `expo.extra.eas.projectId` (a UUID) into `app.json`. Commit that change:

```powershell
git add app.json
git -c user.email=pjmeijer@me.com -c user.name=pjmeijer commit -m "chore(mobile): link project to EAS via eas init"
git push origin feat/eas-testflight-pipeline
```

- [ ] **Step 5: Run `eas credentials` to provision iOS signing**

Run from `mobile/`:

```powershell
eas credentials
```

Pick: platform `iOS` → profile `preview` → "Set up Build Credentials" → "Let EAS handle everything." This will:
- Ask for Apple ID + password (or App Store Connect API key) — use the Apple Dev Program account.
- Prompt to sign into Apple. Surface the **10-char Apple Team ID** in the CLI output — copy that for Step 7 below if you didn't have it.
- Create or reuse an iOS Distribution Certificate.
- Create a Provisioning Profile for `com.pjmeijer.classroomlog`. Apple registers the bundle id at this step.

This does NOT create the ASC app record. That happens in Task 7 during first `eas submit`.

- [ ] **Step 6: Fill in the four placeholders in `mobile/eas.json`**

Open `mobile/eas.json` and replace:
- `<RAILWAY_URL>` → the actual Railway production URL.
- `<APPLE_ID>` → the user's Apple ID email.
- `<APPLE_TEAM_ID>` → the 10-char team ID from Step 5 output (or `https://developer.apple.com/account` → Membership → Team ID).
- `<COMPANY_NAME>` → seller name. Recommended: `pjmeijer`.

- [ ] **Step 7: Verify no placeholder remains**

Run from `mobile/`:

```powershell
Select-String -Path eas.json -Pattern '<RAILWAY_URL>|<APPLE_ID>|<APPLE_TEAM_ID>|<COMPANY_NAME>'
```

Expected: no output (no matches). If any placeholder is reported, fill it before continuing.

- [ ] **Step 8: Commit the filled eas.json**

⚠ This commit contains the Apple ID email. That is not strictly secret (it's the same address used to sign into Apple), but it's also not nothing — confirm the user is OK committing it before pushing. If preferred, the user can move the four values into an EAS Secret instead (see spec Out-of-scope note B for the tradeoff). Default path: commit it.

Run from `mobile/` (or `/workspace` — both work):

```powershell
git add eas.json
git -c user.email=pjmeijer@me.com -c user.name=pjmeijer commit -m "feat(mobile): fill eas.json placeholders with real Apple/Railway values"
git push origin feat/eas-testflight-pipeline
```

---

## Task 7: User-side — first build + first submit

**Side:** Windows PowerShell.

- [ ] **Step 1: Pre-build sanity**

Run from `mobile/`:

```powershell
npm install
npm run typecheck
npm test
```

Expected: clean install, tsc exit 0, jest `Test Suites: 12 passed, 12 total`. If any of these fail, fix before continuing — EAS Build does NOT re-run typecheck/test in the cloud.

- [ ] **Step 2: Kick off the first build**

Run from `mobile/`:

```powershell
eas build --profile preview --platform ios
```

This:
- Hashes the working tree, uploads to EAS Cloud.
- Provisions a macOS VM (m-medium iOS default).
- Runs `npm install`, `expo prebuild`, native iOS build, sign with the distribution cert from Task 5 Step 5.
- ~15-25 minutes typical. The CLI streams logs and prints a URL.

If the build fails: download the log via the URL, look for the failing step. Common causes: missing `xxx` declared in package.json (run `npm install` locally first), Apple Team ID mismatch (re-check `submit.preview.ios.appleTeamId` in eas.json matches what `eas credentials` printed).

- [ ] **Step 3: Submit the build to App Store Connect**

When the build finishes, run from `mobile/`:

```powershell
eas submit --profile preview --platform ios --latest
```

On the FIRST run only:
- EAS Submit sees `ascAppId` is absent.
- Uses `appName`, `language`, `sku`, `appleTeamId`, `companyName` from `submit.preview.ios` to create the ASC app record under bundle id `com.pjmeijer.classroomlog`.
- CLI prints the assigned numeric ASC App ID. **WRITE IT DOWN** — Step 4 needs it.

- [ ] **Step 4: Add `ascAppId` to `eas.json` and commit**

Open `mobile/eas.json` and add the `ascAppId` line under `submit.preview.ios`:

```json
"submit": {
  "preview": {
    "ios": {
      "appleId": "...",
      "appleTeamId": "...",
      "ascAppId": "<numeric ID from Step 3 output>",
      "appName": "Classroom Log",
      "language": "en-US",
      "sku": "classroomlog-001",
      "companyName": "..."
    }
  }
}
```

Commit:

```powershell
git add eas.json
git -c user.email=pjmeijer@me.com -c user.name=pjmeijer commit -m "chore(mobile): pin ascAppId in eas.json after first submit"
git push origin feat/eas-testflight-pipeline
```

Subsequent `eas submit` calls now skip the ASC auto-create branch. Full non-interactive submit ALSO requires `eas credentials` to have an ASC API key set (re-run `eas credentials` → "Add an App Store Connect API Key" if subsequent submits keep prompting for a password).

---

## Task 8: User-side — App Store Connect setup (browser, 9 steps)

**Side:** Browser at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).

This is the spec's §"App Store Connect setup" section turned into a checklist. Do them in order — Apple's UI hides options if prerequisites aren't met.

- [ ] **Step 1: Sign in**

Open `https://appstoreconnect.apple.com` and sign in with the user's Apple ID (same one used in `eas credentials`).

- [ ] **Step 2: Wait for the build to be processable**

"My Apps" → "Classroom Log" → "TestFlight" tab. The new build should appear under "iOS Builds" within ~2 minutes of `eas submit` completing. Its status will move:

`Processing` (5-15 min) → `Ready to Submit`

It should NOT stop at `Missing Compliance` (the `usesNonExemptEncryption: false` flag in app.json takes care of that). If it does, the flag didn't bake into Info.plist — manually answer the encryption questionnaire as a one-time fallback (No → "uses only exempt encryption"), then investigate the Expo config before the next build.

- [ ] **Step 3: Fill App Information (one-time, "App Store" tab)**

"App Store" tab → left sidebar → "App Information". Fill the required fields:
- **Privacy Policy URL** — required for any TestFlight distribution. If the user doesn't have one yet, a Railway-hosted placeholder page is acceptable for TestFlight (e.g. `https://classroom-log-production-XXXX.up.railway.app/privacy`). Apple does not validate the URL content for TestFlight; they just require one.
- **Primary Category** — pick "Education".
- **Subcategory** — optional. "Reference" or leave blank.

Save.

- [ ] **Step 4: Fill Test Information ("TestFlight" tab → "Test Information")**

Fill these fields. Apple requires the first two for Beta App Review submission:
- **Beta App Description** (required) — `"Voice-first classroom observation log for special-education teachers. Currently in private cohort beta."`
- **Feedback email** (required) — the user's Apple ID email or a dedicated address.
- **Privacy Policy URL** (required for External) — same as Step 3.
- **Marketing URL** (optional) — leave blank.
- **What to Test** notes (optional but recommended) — short blurb. Example: `"Open a student tile and record a 10-30 second observation. Verify the transcript and the daily summary."`

Save.

- [ ] **Step 5: Create an Internal Testing Group (one-time prerequisite)**

"TestFlight" → "Internal Testing" → "+ New Group" → name `Devs` → confirm. No testers needed in the group; its existence alone satisfies the prerequisite for creating an External group.

- [ ] **Step 6: Create the External Testing Group**

"TestFlight" → "External Testing" → "+ New Group" → name `Cohort 1` → confirm. Inside the group, click the "Builds" tab → "+" → select the just-uploaded build → "Next".

- [ ] **Step 7: Submit for Beta App Review**

Apple will prompt for one final piece of info: a confirmation that the build complies with export laws and content policies. Confirm. Click "Submit for Review".

Wait 24-48h for Apple's approval email. The build status will move: `Ready to Submit` → `Waiting for Review` → `In Beta Review` → `Ready to Test`.

- [ ] **Step 8: Enable the public link**

After approval (status = `Ready to Test`): in the External group → "Public Link" → toggle ON. ASC generates a `https://testflight.apple.com/join/<8-char-id>` URL. Save this URL — it survives across builds.

- [ ] **Step 9: Enable "Automatically notify testers"**

Still in the External group → settings/edit → "Automatically notify testers" toggle → ON. Future approved builds (added to this group via ASC UI per release) will email + push existing testers automatically.

---

## Task 9: First-install verification

**Side:** User's iPhone (the developer's own device, BEFORE inviting any teacher).

- [ ] **Step 1: Install TestFlight on iPhone**

If TestFlight is not already installed, install it from the App Store (free, Apple-published). One-time setup.

- [ ] **Step 2: Open the public link on the iPhone**

Open the URL from Task 8 Step 8 in Safari on the iPhone. Tap "Accept" → "Install". Classroom Log appears on the home screen with TestFlight's orange dot.

- [ ] **Step 3: Cold-launch the app**

Tap the icon. Expected:
- App launches without crashing.
- The home screen renders (student tiles, gear icon, mic chip).
- If the prod-mode guard fires (env var didn't bake into the build), the app crashes immediately on launch — that signals `mobile/eas.json` build.env wasn't passed through. STOP and investigate before reverting; this is exactly the failure the guard was designed to surface.

- [ ] **Step 4: Make a real recording**

Tap a student tile → record a short Danish phrase ("Test, en to tre") → stop → wait for transcription.

- [ ] **Step 5: Verify the backend hit the Railway production URL**

Open the Railway dashboard in a separate tab → classroom-log service → Logs. Within ~10 seconds of stopping the recording, expect:
- A POST to `/transcribe` (200 OK, ~200-2000 ms latency depending on whisper).
- A POST to `/summary` if a daily summary was requested (also 200).
- The Origin / User-Agent header should match an Expo-built iOS app.

If the Railway logs show NO request, the env var did NOT bake in — the app would be hitting the sentinel `example.ngrok.app` (which doesn't resolve, so the recording would fail silently or with a network error). Confirm by checking the device's network state and the app's error messaging.

- [ ] **Step 6: Confirm HTTPS-only**

In Safari Web Inspector (if the device is on a Mac-paired iPhone) OR by inspecting the prod traffic via Charles/Proxyman on Wi-Fi: every request from the app is `https://...`. There should be zero `http://` calls. This matches the `usesNonExemptEncryption: false` claim.

- [ ] **Step 7: Smoke-check the full v1.1 flow**

Per the most recent device-test feedback (`docs/superpowers/feedback/2026-06-04-second-device-test.md`): record from home tile, record from modal mic, edit a note, discard a dirty draft, settings gear works. All should pass — this build is the same code as the on-device-validated v1.1.

If everything passes, the cohort can be invited.

---

## Task 10: Land — merge to main and push

**Side:** Either side (container or Windows); container is fine.

- [ ] **Step 1: Confirm branch is clean**

Run from `/workspace`:

```bash
git status
```

Expected: working tree clean. If there are uncommitted CRLF-only changes (the WSL2 vs Windows-git CRLF issue noted in the restored checkpoint), `git checkout -- .` is safe to reset them since the pre-existing CRLF state isn't ours to touch.

- [ ] **Step 2: Fast-forward main to the feature branch**

Run from `/workspace`:

```bash
git fetch origin
git update-ref refs/heads/main "$(git rev-parse feat/eas-testflight-pipeline)" "$(git rev-parse origin/main)"
git checkout main
git push origin main
```

(`git update-ref` is used instead of `git fetch . src:dst` to sidestep the WSL2 "dubious ownership" issue noted in the restored checkpoint.)

If the user prefers, this can also be done from Windows via:

```powershell
git checkout main
git merge --ff-only feat/eas-testflight-pipeline
git push origin main
```

- [ ] **Step 3: Verify main is up to date and matches the feature branch**

Run from `/workspace`:

```bash
git log --oneline main..origin/main
git log --oneline origin/main..feat/eas-testflight-pipeline
```

Expected: both are empty (main and remote main are in sync; nothing on the feature branch that isn't on main).

- [ ] **Step 4: Leave the feature branch alive OR delete**

By default, leave `feat/eas-testflight-pipeline` alive — it's useful as a reference if any future EAS-config work spawns from it. If the user wants it cleaned up:

```bash
git branch -d feat/eas-testflight-pipeline
git push origin --delete feat/eas-testflight-pipeline
```

(Optional. The voice-first branch is still alive per the earlier checkpoint; same pattern.)

---

## Self-Review

**Spec coverage:**

| Spec requirement | Plan task |
|---|---|
| `mobile/eas.json` with single `preview` profile, `appVersionSource: "remote"`, `autoIncrement: true`, plain `env`, `ascAppId` omitted | Task 1 Steps 1-3 |
| `submit.preview.ios` with `appleId`, `appleTeamId`, `appName`, `language`, `sku`, `companyName` | Task 1 Step 1 |
| `app.json`: `name = "Classroom Log"`, `slug = "classroom-log"` | Task 2 Steps 1-2 |
| `app.json`: `ios.bundleIdentifier`, `ios.buildNumber`, `ios.config.usesNonExemptEncryption` | Task 2 Step 3 |
| `mobile/api/config.ts` prod-mode guard | Task 3 Step 3 |
| Jest tests for the guard (3 cases) | Task 3 Step 1 |
| Pre-build sanity (npm install, typecheck, test) | Task 7 Step 1 |
| `eas-cli` install + login + init + credentials | Task 6 Steps 1-5 |
| `eas init` commits `expo.extra.eas.projectId` back to git | Task 6 Step 4 |
| First `eas build` + `eas submit` | Task 7 Steps 2-3 |
| Pin `ascAppId` after first submit | Task 7 Step 4 |
| ASC: status chain through `Ready to Submit` (no `Missing Compliance`) | Task 8 Step 2 |
| ASC: App Information (privacy, category) | Task 8 Step 3 |
| ASC: Test Information including Beta App Description | Task 8 Step 4 |
| ASC: Internal Group prerequisite | Task 8 Step 5 |
| ASC: External Group + add build | Task 8 Step 6 |
| ASC: Submit for Beta App Review | Task 8 Step 7 |
| ASC: Public Link toggle | Task 8 Step 8 |
| ASC: Automatically notify testers toggle | Task 8 Step 9 |
| First-install verification on developer's own iPhone | Task 9 Steps 1-7 |
| Railway log check, HTTPS-only check | Task 9 Steps 5-6 |
| `/codex review` gate on the implementation diff | Task 5 Step 3 |
| Spec-compliance subagent gate | Task 5 Step 1 |
| Merge to main, push | Task 10 |
| Open values (`<RAILWAY_URL>`, `<APPLE_ID>`, `<APPLE_TEAM_ID>`, `<COMPANY_NAME>`) flagged for user fill | Top of plan + Task 6 Step 6 |

All spec sections map to a task.

**Placeholder scan:** Every code step shows complete code. Every command step shows the full command. No "TBD", "TODO", "similar to Task N", or "add appropriate error handling." The four explicit `<RAILWAY_URL>` etc. placeholders are deliberate — they are flagged at the top of the plan and at Task 6 Step 6 as user-fill values, not engineering placeholders.

**Type consistency:** `DEFAULT_API_BASE_URL` (existing export, kept), `__DEV__` (RN global, `as any` cast for jest+RN compatibility), `Error` (standard JS), `EXPO_PUBLIC_API_BASE_URL` (env var name, identical across `eas.json`, `mobile/api/config.ts`, the jest tests). `ios.bundleIdentifier`, `ios.buildNumber`, `ios.config.usesNonExemptEncryption` consistent with the Expo SDK 54 schema and used identically in spec + plan.

**Scope check:** Ten tasks. Tasks 1-5 are container-side (file edits + gating reviews). Tasks 6-9 are user-side (Windows + Apple browser + iPhone). Task 10 is land. The container/user-side boundary is explicit at every task header — no mixing.

**Out-of-scope guardrails:** No `production` profile, no Android profile, no EAS Update channels, no GitHub Actions, no APNs cert, no Crashlytics/Sentry, no Danish display name. The plan does not introduce any of these.
