# EAS Build → TestFlight pipeline — design

**Date:** 2026-06-04
**Branch:** `feat/eas-testflight-pipeline`
**Type:** Build/distribution infrastructure (new, no existing pipeline)

## Context

The mobile app (`mobile/`) has been on-device validated for v1.1 voice-first
capture (see `docs/superpowers/feedback/2026-06-04-second-device-test.md`).
The next major thread is getting it into the hands of a small cohort of
special-education teachers for multi-week testing.

The Railway production backend is already running (free tier, see
`project_classroomlog_infra` memory) and the Apple Developer Program is paid.
What's missing is the pipeline from "code in `main`" to "app on a teacher's
iPhone via TestFlight."

Today's state of the relevant files:

- No `mobile/eas.json` exists.
- `mobile/app.json` has no `ios.bundleIdentifier`, no `ios.buildNumber`. The
  `expo.name` and `expo.slug` are both `"mobile"` (Expo scaffolding defaults).
- `mobile/api/config.ts:1`:
  ```ts
  export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://example.ngrok.app';
  ```
  Falls back to a sentinel ngrok URL if the env var isn't baked into the build
  — a footgun for a TestFlight build, which MUST have the real Railway URL.
- `mobile/AGENTS.md` directs us to read SDK 54 docs at
  `https://docs.expo.dev/versions/v54.0.0/` before touching code. The
  implementation plan will verify the exact `eas.json` schema against those
  docs.

## Decision

Set up a minimum-viable EAS Cloud pipeline that produces a TestFlight-ready
iOS build via one `eas build` command and submits it to App Store Connect via
one `eas submit` command. Distribute to teachers via an External TestFlight
group with a public link. Defer everything that doesn't serve the first cohort
build (App Store production profile, OTA updates, Android, push, CI).

### Decision trace from brainstorming

| Decision | Value | Rationale |
|---|---|---|
| App Store Connect record | Fresh; EAS auto-creates | No existing record |
| iOS bundle identifier | `com.pjmeijer.classroomlog` | Personal-identity prefix, no domain claim, survives product rename |
| `eas.json` profile count | Single (`preview`) | YAGNI for `production` until App Store ship is real |
| Env injection method | Plain `env` block in `eas.json` | Railway URL isn't secret; version-controlled is better |
| TestFlight tier | External + public link | Teachers don't need ASC team membership; 24-48h beta-review is acceptable for weeks-long testing |
| Push certificates | Defer | No push features in the app today |
| Build host | Windows PowerShell | Per `user_windows_host` memory; container is for grep + edits only |
| Versioning strategy | Manual `version`, auto-incremented `buildNumber` | Apple-required monotonic build number, user-visible version stays intentional |

## Specifics

### `mobile/eas.json` (new file — first-submit form)

This is the literal file content to commit. **`ascAppId` is intentionally
absent**; EAS Submit treats any non-empty string in that field as a real
numeric ASC App ID and skips the auto-create path, so a placeholder string
would break the first run.

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
        "EXPO_PUBLIC_API_BASE_URL": "<Railway production URL — filled at implementation>"
      }
    }
  },
  "submit": {
    "preview": {
      "ios": {
        "appleId": "<user's Apple ID email — filled at implementation>",
        "appleTeamId": "<10-char Apple Developer team ID — surfaced by `eas credentials`>",
        "appName": "Classroom Log",
        "language": "en-US",
        "sku": "classroomlog-001",
        "companyName": "<your name or entity — required for the very first ASC app record under this Apple account; ignored on subsequent submits>"
      }
    }
  }
}
```

**After the first successful `eas submit`**, the CLI prints the assigned
numeric ASC App ID. Add it to `submit.preview.ios` as a new line — for
example:

```json
"submit": {
  "preview": {
    "ios": {
      "appleId": "...",
      "appleTeamId": "...",
      "ascAppId": "1234567890",
      "appName": "Classroom Log",
      ...
    }
  }
}
```

Commit the change. Subsequent `eas submit` runs are now fully non-interactive
and skip the ASC auto-create branch.

Field choices:

- `appVersionSource: "remote"` — EAS tracks `ios.buildNumber` server-side so
  the user does not have to commit a bumped value back to git after every
  build. Marketing version (`expo.version` in `app.json`) is still manually
  controlled. This is the explicit fix for the `local` + `autoIncrement`
  pitfall: with `local`, EAS bumps `buildNumber` in the build container but
  does not push the change back, so a fresh checkout (different machine,
  CI runner, or even after `git reset`) reuses an old `buildNumber` and
  Apple rejects the upload with "build number already used."
- `distribution: "store"` — required for any TestFlight or App Store upload.
  (`"internal"` would mean ad-hoc UDID builds; not our path.)
- `autoIncrement: true` — Apple requires each upload to have a higher
  `ios.buildNumber` than the previous one. With `appVersionSource: "remote"`,
  EAS handles this server-side; no git churn.
- `resourceClass`: omitted. EAS's iOS default is `medium`, which is adequate
  for this app's bundle size. Upgrade to `large` later only if cold builds
  time out.
- The `env` block injects the Railway URL into `EXPO_PUBLIC_API_BASE_URL` at
  bundle time. Expo's `babel-preset-expo` resolves `process.env.EXPO_PUBLIC_*`
  at build, baking the value into the JS bundle.
- `appleTeamId`, `appName`, `language`, `sku`, `companyName`: EAS Submit needs
  these on the very first submit to auto-create the ASC app record (since
  `ascAppId` is omitted). On subsequent submits with `ascAppId` filled, these
  are ignored. `sku` is a one-time arbitrary internal identifier (must be
  unique within your ASC account); `companyName` is the seller-name shown in
  the App Store and is required ONLY on the first app under a brand-new
  Apple account.

### `mobile/app.json` changes

Add `ios.bundleIdentifier`, `ios.buildNumber`, and rename `name`/`slug` from
scaffolding defaults to the real values:

```diff
 {
   "expo": {
-    "name": "mobile",
-    "slug": "mobile",
+    "name": "Classroom Log",
+    "slug": "classroom-log",
     "version": "1.0.0",
     ...
     "ios": {
+      "bundleIdentifier": "com.pjmeijer.classroomlog",
+      "buildNumber": "1",
+      "config": {
+        "usesNonExemptEncryption": false
+      },
       "icon": "./assets/expo.icon"
     }
```

- `name`: home-screen display name and TestFlight listing label.
- `slug`: Expo's internal project identifier, surfaces in the `expo.dev`
  dashboard.
- `ios.bundleIdentifier`: locked to `com.pjmeijer.classroomlog`. One-way door
  once a real tester installs.
- `ios.buildNumber`: `"1"` initial. With `appVersionSource: "remote"` in
  `eas.json`, EAS overrides this server-side on every build; the value here
  is only the starting seed.
- `ios.config.usesNonExemptEncryption: false`: bakes the export-compliance
  answer into the Info.plist on every build. Without this, every upload lands
  in ASC with status `Missing Compliance` and cannot be added to a TestFlight
  group until you answer the encryption questionnaire manually in the ASC UI.
  The app only uses standard HTTPS and OS-provided cryptography — both
  categorized as exempt by Apple's BIS guidance — so the honest answer to
  "uses non-exempt encryption" is `false`.

**Open detail (deferred):** Danish display name (e.g. `"Klasselog"`) — defer
until first build is on a teacher's phone; the rename is a one-line edit and
doesn't require a new ASC record.

### Files added/touched

| File | Change |
|---|---|
| `mobile/eas.json` | NEW — full content above |
| `mobile/app.json` | Add `ios.bundleIdentifier`, `ios.buildNumber`, `ios.config.usesNonExemptEncryption: false`; rename `name` + `slug` |
| `mobile/api/config.ts` | EDIT — add a production-mode guard so an unset `EXPO_PUBLIC_API_BASE_URL` fails fast for store builds instead of silently shipping the `https://example.ngrok.app` sentinel to a tester. See sub-section below. |
| `mobile/package.json` | NONE — `eas-cli` installed globally on Windows, not a project dep |
| `mobile/.gitignore` | NONE |

#### `mobile/api/config.ts` change

Replace the single-line module with a guarded form so that if EAS forgets to
inject `EXPO_PUBLIC_API_BASE_URL`, a `preview`/`production` build crashes
loudly at module-load time rather than quietly hitting `example.ngrok.app`
in front of a teacher:

```ts
const url = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!url) {
  if (!__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is required for non-dev builds. ' +
      'Check eas.json build.<profile>.env or your local .env for dev.',
    );
  }
}
export const DEFAULT_API_BASE_URL = url ?? 'https://example.ngrok.app';
```

`__DEV__` is the React Native build-time flag that is `true` only for
Metro-served bundles. Store builds always have `__DEV__ === false`. The
existing tests (`mobile/api/__tests__/api.test.ts`,
`mobile/api/__tests__/transcribe.test.ts`) run under jest where `__DEV__` is
true by default; they will continue to use the sentinel and pass unchanged.

After `eas init` runs (in the implementation phase), `app.json` will also gain
an `expo.extra.eas.projectId` value injected by the CLI. That's expected; the
implementation plan includes it in the commit.

### Build / submit flow (commands user runs from Windows PowerShell)

One-time setup:

```powershell
npm install -g eas-cli@latest
eas login                    # opens browser; uses the Expo account
cd mobile
eas init                     # links this project to the Expo account; writes
                             # `expo.extra.eas.projectId` into app.json
eas credentials              # interactive: provisions iOS Distribution
                             # Certificate + Provisioning Profile in your
                             # Apple Developer account. Choose "Let EAS handle
                             # everything." This does NOT create the ASC app
                             # record — that happens automatically inside the
                             # first `eas submit` (since `ascAppId` is omitted
                             # from eas.json on first run).
```

Per-build:

```powershell
cd mobile
eas build --profile preview --platform ios
# ~15-25 min cloud build; produces .ipa
eas submit --profile preview --platform ios --latest
# uploads to App Store Connect → TestFlight
# wait 24-48h for Apple's Beta App Review (first build per version only)
```

On the FIRST submit only, EAS Submit notices `ascAppId` is absent and uses the
`appName`, `language`, `sku`, `appleTeamId`, and `companyName` from
`submit.preview.ios` to create the ASC app record under bundle id
`com.pjmeijer.classroomlog`. CLI output prints the assigned numeric ASC App ID
— copy it into `submit.preview.ios.ascAppId` in `eas.json` (and commit) so
later submits skip the auto-create branch.

### App Store Connect setup (browser, after first `eas submit`)

The first `eas submit` creates the app record and uploads the build. The
following steps happen in the App Store Connect UI to make that build
distributable to External testers.

1. Sign into [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. "My Apps" → "Classroom Log" → "TestFlight" tab → wait for the build to
   move through Apple's full status chain. The states a TestFlight build
   passes through, in order:
   - `Processing` (~5-15 min while ASC re-encodes the binary).
   - `Missing Compliance` — should be SKIPPED because the build carries
     `ITSAppUsesNonExemptEncryption = false` in Info.plist via the
     `ios.config.usesNonExemptEncryption` flag in `app.json`. If the build
     stops here anyway, the flag did not bake in — answer the encryption
     questionnaire in ASC one time as a fallback, then investigate the
     Expo config before the next build.
   - `Ready to Submit` — compliance is settled; you can attach the build
     to a testing group.
   - `Waiting for Review` — the build is queued for Apple's Beta App
     Review (External-group submissions only).
   - `In Beta Review` — Apple's reviewer is actively examining the build.
   - `Ready to Test` — Apple approved; the build is downloadable by
     testers in the group.
   - `Testing` — at least one tester has installed it.
   - `Expired` — 90 days after upload; the build is no longer
     installable. Ship a new build before this hits to keep cohort rolling.
3. **App Information** (one-time, left sidebar in "App Store" tab):
   complete the required fields ASC won't allow Beta App Review without:
   privacy-policy URL (Railway-side, even a placeholder TestFlight-only URL is
   accepted at this stage), primary category, subcategory.
4. **Test Information** ("TestFlight" tab → "Test Information"). The fields
   Apple requires before allowing Beta App Review submission, in priority
   order:
   - **Beta App Description** (required) — a short blurb describing the app's
     beta state. Visible to Apple's reviewer and to testers in TestFlight.
     Example: "Voice-first classroom observation log for special-education
     teachers. Currently in private cohort beta."
   - **Feedback email** (required) — typically the user's Apple ID or a
     dedicated address. Where testers' in-app feedback lands.
   - **Privacy Policy URL** (required for External Testing).
   - **Marketing URL** (optional).
   - **What to Test** notes (optional but recommended) — a short blurb
     teachers see when accepting an invite or installing an update.
   - **Sign-In Information** (only if the app requires login — N/A here).
5. **Internal Testing Group** (one-time prerequisite): "Internal Testing" →
   "+ New Group" → name e.g. "Devs". No testers required to exist in the
   group, but the group itself must exist. ASC's UI typically requires that
   the build has passed through Internal Testing eligibility before allowing
   it to be added to an External group. Creating an empty Internal group
   reliably satisfies that prerequisite.
6. **External Testing Group**: "External Testing" → "+ New Group" → name
   e.g. "Cohort 1" → "Builds" tab → "+" → add the just-uploaded build.
7. **Submit for Beta App Review** (button at the top of the External group's
   build page). Wait 24-48h for Apple's approval email. Each new version of
   the build needs this review again; the review is typically lighter than
   App Store review.
8. After approval: in the External group → "Public Link" → toggle ON. ASC
   generates a `https://testflight.apple.com/join/...` URL that survives
   across builds.
9. **Notify testers automatically**: in the External group's settings,
   enable "Automatically notify testers" so that whenever you add a new
   build to the group and Apple approves it, testers receive the
   TestFlight email + push without you having to manually trigger a
   notification. (Note: this is the per-tester notification toggle, NOT
   automatic build distribution — External groups still require each new
   build to be added to the group via the ASC UI per release. EAS Submit's
   `groups` field in `eas.json` only targets *Internal* TestFlight groups,
   not External — so per-release ASC steps are part of the cohort flow.)

### Tester onboarding flow

1. User sends teachers the public TestFlight URL.
2. Teacher installs the **TestFlight** app from the App Store (free, one-time).
3. Teacher opens the URL in Safari → "Accept" → "Install" → Classroom Log
   lands on home screen with TestFlight's orange dot for up to 90 days per
   build.
4. **Per-release flow for new builds**: for each new version, the user
   (a) runs `eas build` + `eas submit`, (b) waits for ASC `Processing` →
   `Ready to Submit`, (c) opens the External group in ASC and adds the new
   build under "Builds", (d) submits for Beta App Review, (e) after Apple
   approves, the build moves to `Ready to Test` and (with "Automatically
   notify testers" ON) testers receive a TestFlight prompt to update.
   Manual notification is also available if needed.

### Versioning + release cadence

- **Marketing version** (`app.json` → `expo.version`): manually bumped per
  meaningful change. `1.0.0` for first cohort build; `1.0.1` for bug fixes;
  `1.1.0` for new feature batches. Commit the bump along with the change.
- **Build number** (`app.json` → `ios.buildNumber`): with
  `appVersionSource: "remote"` in `eas.json`, EAS tracks the current value
  on its servers. The `"1"` in `app.json` is only the initial seed; EAS
  increments on every build server-side, and `git status` stays clean
  after each build.
- **Expected cadence**: ~1 build per week for cohort iteration. The 24-48h
  Beta App Review is the natural ceiling on faster cycles. Apple's Test
  Information changes (like updated "What to Test" notes) also require
  re-submission, but typically clear faster than full code changes.

### Push notifications posture

Push is deferred. The app does not request push capability today
(`app.json` has no `ios.entitlements.aps-environment`); EAS will not try to
generate an APNs key during `eas credentials`. When push features land in a
future plan, run `eas credentials` again and select "Set up Push
Notifications" — EAS will provision the APNs auth key automatically.

## Testing strategy

- **No new automated tests for EAS config.** Build YAML/JSON isn't
  unit-testable in a meaningful way.
- **Pre-build sanity** (Windows PowerShell, before every `eas build`):
  ```powershell
  cd mobile
  npm install
  npm run typecheck
  npm test
  ```
  All must pass. EAS Build does NOT run `typecheck`/`test` in the cloud
  unless a `package.json` `eas-build-pre-install`/`-post-install` lifecycle
  hook is configured (none is, by design — see Out of Scope). The local
  check is the only gate; running it first avoids burning a cloud-build
  slot on a known-broken bundle.
- **Manual verification on first build**:
  - `eas build` succeeds (~15-25 min); produces a downloadable `.ipa`.
  - `eas submit` succeeds; ASC TestFlight tab shows the build under "iOS
    Builds."
  - ASC build status moves `Processing` → `Ready to Submit` WITHOUT passing
    through `Missing Compliance`. If it stops at `Missing Compliance`, the
    `ios.config.usesNonExemptEncryption` flag did not bake into the binary
    correctly — fall back to answering the ASC encryption questionnaire by
    hand once, then investigate the Expo config in the next build.
  - User installs via TestFlight on their own iPhone first (before cohort).
  - Recording → backend hits Railway production logs (verify
    `EXPO_PUBLIC_API_BASE_URL` baked in correctly; the prod-mode guard in
    `mobile/api/config.ts` would have thrown at app-launch if the variable
    wasn't injected, so an installable build is its own evidence the env
    landed — but the request URL in the Railway logs is the second check).
  - All network traffic is HTTPS (matches the export-compliance answer).

## Out of scope

The following were considered and explicitly deferred:

- **Production App Store profile.** Adding a `production` profile and
  shipping to the public App Store. Defer until cohort feedback says the app
  is ready for public.
- **OTA updates via `eas update`.** Pushing JS-only changes between native
  builds to skip the 24-48h Beta App Review for non-native fixes. Useful
  later; not needed for cohort #1.
- **Android build pipeline.** No Google Play Console setup; no
  `android` profile in `eas.json`. Add when an Android tester appears.
- **CI-driven builds via GitHub Actions.** Manual `eas build` from Windows
  is fine at the current cadence and easier to debug.
- **APNs / push certificate provisioning.** No push features today; provision
  when first push feature is designed.
- **Crashlytics / Sentry integration.** Cohort feedback channel is direct
  (Slack/text). Error telemetry can wait.
- **Danish display name.** App `name` stays English for now; rename is a
  one-line edit when product-naming question is decided.

## Reversibility

- **Git side:** Single revert of the `feat: add EAS Build → TestFlight
  pipeline` commit drops `eas.json` and restores `app.json` to pre-EAS shape.
- **Apple side:** `git revert` does NOT undo the ASC app record, distribution
  certificate, or public TestFlight link. Cleanup, if ever needed:
  - Delete the ASC app record in Apple's dashboard (one click; loses
    TestFlight history).
  - Distribution cert + provisioning profile can stay (cheap, useful if you
    rebuild later under the same bundle id).
- **Public TestFlight link side**: revoking the link or deleting the
  External Testing Group invalidates the URL immediately. Teachers' installed
  builds keep working for the remainder of their 90-day TestFlight window.

## Cross-references

Repo-local artifacts:

- Voice-first plan (parent feature, shipped):
  `docs/superpowers/plans/2026-05-29-voice-first-capture.md`
- Modal-mic-icon design (style reference for this spec):
  `docs/superpowers/specs/2026-06-04-modal-mic-icon-design.md`
- Second device test feedback (the on-device validation that motivates
  cohort distribution):
  `docs/superpowers/feedback/2026-06-04-second-device-test.md`
- Mobile-specific contributor notes (read before any mobile/ change):
  `mobile/AGENTS.md` — directs implementers to the SDK 54 docs.

External:

- Expo SDK 54 reference (verify exact `eas.json` schema during
  implementation): https://docs.expo.dev/versions/v54.0.0/
- EAS Build reference (versioning, profiles, env injection):
  https://docs.expo.dev/build/introduction/
- Apple TestFlight build-status reference (the status chain in §ASC setup):
  https://developer.apple.com/help/app-store-connect/reference/app-build-statuses/

Project context outside this repo (paraphrased here so the spec is
self-contained; the canonical source is the user's own knowledge of the
project):

- Railway production backend is running on the free tier; the EAS `env`
  block needs the actual Railway URL pasted in at implementation time.
- The user runs `eas`/`npm`/`git` commands from Windows PowerShell. The
  WSL2 / Claude-container side is for file edits and grep only.
- Apple Developer Program is paid for the user's Apple ID; no team setup
  or extra purchase is required to ship to TestFlight.
