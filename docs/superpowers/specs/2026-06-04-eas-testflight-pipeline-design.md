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

### `mobile/eas.json` (new file)

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "preview": {
      "distribution": "store",
      "ios": {
        "autoIncrement": "buildNumber",
        "resourceClass": "m-medium"
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
        "ascAppId": "<leave blank for first submit; copy from CLI output and paste back here for subsequent non-interactive submits>"
      }
    }
  }
}
```

Field choices:

- `appVersionSource: "local"` — `app.json` is the source of truth. Avoids
  EAS's remote-versioning service (one less thing to learn).
- `distribution: "store"` — required for any TestFlight or App Store upload.
  (`"internal"` would mean ad-hoc UDID builds; not our path.)
- `autoIncrement: "buildNumber"` — Apple requires each upload to have a higher
  `ios.buildNumber` than the previous one. EAS bumps it automatically so the
  user never has to remember.
- `resourceClass: "m-medium"` — EAS's default iOS build VM size. Adequate for
  this app's bundle size. Upgrade to `m-large` later if cold builds time out.
- The `env` block injects the Railway URL into `EXPO_PUBLIC_API_BASE_URL` at
  bundle time. Expo's `babel-preset-expo` resolves `process.env.EXPO_PUBLIC_*`
  at build, baking the value into the JS bundle.

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
       "icon": "./assets/expo.icon"
     }
```

- `name`: home-screen display name and TestFlight listing label.
- `slug`: Expo's internal project identifier, surfaces in the `expo.dev`
  dashboard.
- `ios.bundleIdentifier`: locked to `com.pjmeijer.classroomlog`. One-way door
  once a real tester installs.
- `ios.buildNumber`: `"1"` initial; EAS auto-increments thereafter.

**Open detail (deferred):** Danish display name (e.g. `"Klasselog"`) — defer
until first build is on a teacher's phone; the rename is a one-line edit and
doesn't require a new ASC record.

### Files added/touched

| File | Change |
|---|---|
| `mobile/eas.json` | NEW — full content above |
| `mobile/app.json` | Add `ios.bundleIdentifier`, `ios.buildNumber`; rename `name` + `slug` |
| `mobile/api/config.ts` | NONE — already reads `EXPO_PUBLIC_API_BASE_URL` at line 1 |
| `mobile/package.json` | NONE — `eas-cli` installed globally on Windows, not a project dep |
| `mobile/.gitignore` | NONE |

After `eas init` runs (in the implementation phase), `app.json` will also gain
an `expo.extra.eas.projectId` value injected by the CLI. That's expected; the
implementation plan includes it in the commit.

### Build / submit flow (commands user runs from Windows PowerShell)

One-time setup:

```powershell
npm install -g eas-cli@latest
eas login                    # uses Expo account; opens browser
cd mobile
eas init                     # links this project; writes projectId into app.json
eas credentials              # interactive iOS credentials setup
                             # choose "Let EAS handle it" for cert + provisioning profile
                             # creates the ASC app record under com.pjmeijer.classroomlog
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

### App Store Connect setup (browser, after first `eas submit`)

1. Sign into [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. "My Apps" → find the new "Classroom Log" record (EAS created it).
3. App → "TestFlight" tab → wait for the build to reach `Ready to Test`
   (~5 min of post-upload processing).
4. **Export compliance**: answer the encryption question with "No, does not
   use non-exempt encryption." Whisper-over-HTTPS is exempt. One-time per
   app record.
5. **External Testing Group**: "External Testing" → "New Group" → name e.g.
   "Cohort 1" → add the just-uploaded build.
6. Submit for **Beta App Review** (one click). Wait 24-48h for Apple's
   approval email.
7. After approval: enable **Public Link** for the group. ASC generates a
   `https://testflight.apple.com/join/...` URL that survives across builds.

### Tester onboarding flow

1. User sends teachers the public TestFlight URL.
2. Teacher installs the **TestFlight** app from the App Store (free, one-time).
3. Teacher opens the URL in Safari → "Accept" → "Install" → Classroom Log
   lands on home screen with TestFlight's orange dot for up to 90 days per
   build.
4. New builds auto-prompt teachers to update; no re-invite needed.

### Versioning + release cadence

- **Marketing version** (`app.json` → `expo.version`): manually bumped per
  meaningful change. `1.0.0` for first cohort build; `1.0.1` for bug fixes;
  `1.1.0` for new feature batches.
- **Build number** (`app.json` → `ios.buildNumber`): EAS overrides each build
  via `autoIncrement: "buildNumber"`. Never edit manually after the initial
  `"1"`.
- **Expected cadence**: ~1 build per week for cohort iteration. The 24-48h
  Beta App Review is the natural ceiling on faster cycles.

### Push notifications posture

Push is deferred. The app does not request push capability today
(`app.json` has no `ios.entitlements.aps-environment`); EAS will not try to
generate an APNs cert. When push features land in a future plan, run
`eas credentials` and select "Set up Push Notifications" — EAS will provision
the APNs key automatically.

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
  All must pass. EAS reruns these in the cloud, but local catches it faster
  and avoids burning a cloud-build slot.
- **Manual verification on first build**:
  - `eas build` succeeds (~15-25 min); produces a downloadable `.ipa`.
  - `eas submit` succeeds; ASC TestFlight tab shows the build under "iOS
    Builds."
  - User installs via TestFlight on their own iPhone first (before cohort).
  - Recording → backend hits Railway production logs (verify
    `EXPO_PUBLIC_API_BASE_URL` baked in correctly; should never see the
    `example.ngrok.app` sentinel).
  - All network traffic is HTTPS (export-compliance answer is honest).

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

- Restored checkpoint that set EAS as the next thread:
  `~/.gstack/projects/pjmeijer-classroom-log/checkpoints/20260604-123626-v1.1-post-smoke-shipped-to-main-icons-polished-eas-as-next.md`
- Voice-first plan (parent feature, shipped):
  `docs/superpowers/plans/2026-05-29-voice-first-capture.md`
- Modal-mic-icon design (style reference for this spec):
  `docs/superpowers/specs/2026-06-04-modal-mic-icon-design.md`
- Second device test feedback (the on-device validation that motivates
  cohort distribution):
  `docs/superpowers/feedback/2026-06-04-second-device-test.md`
- Infra state memory:
  `~/.claude/projects/-workspace/memory/project_classroomlog_infra.md`
- Build-host memory:
  `~/.claude/projects/-workspace/memory/user_windows_host.md`
- Expo SDK 54 docs (per `mobile/AGENTS.md` — verify schema during
  implementation): https://docs.expo.dev/versions/v54.0.0/
