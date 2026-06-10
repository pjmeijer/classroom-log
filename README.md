# classroom-log

A note-taking tool for special-education teachers. Tap a student, speak or type, save. Then let Claude draft a daily summary for review.

Built as a two-piece demo: a React Native (Expo SDK 54) phone app and a FastAPI proxy that talks to OpenAI Whisper (for voice → text) and Anthropic Claude (for daily summaries). All notes live on the phone; the proxy holds nothing.

## Architecture

```
┌───────────────────────┐                  ┌──────────────────────────┐
│  iPhone               │                  │  Backend                 │
│  (TestFlight or       │  POST /transcribe│  FastAPI + uvicorn        │
│   Expo Go in dev)     │ ───────────────► │  - /health                │
│  - SQLite (local)     │  POST /summary   │  - /transcribe → OpenAI   │
│  - Roster, notes,     │ ◄─────────────── │  - /summary    → Anthropic│
│    settings           │                  │  - /privacy (policy page) │
└───────────────────────┘                  └──────────────────────────┘
   prod: Railway · dev: ngrok tunnel              │
                                                  ├─► api.openai.com (Whisper)
                                                  └─► api.anthropic.com (Claude)
```

No cloud database. No accounts. The phone keeps the only persistent copy of notes; the backend is a thin pass-through that retains nothing after each request returns.

**Backend URL.** In production the backend runs on **Railway** at
`https://classroom-log-production.up.railway.app` — that's what the TestFlight
build talks to (baked in at build time via `mobile/eas.json`). For **local
development** you run the backend on your laptop and expose it with an **ngrok**
tunnel (see "Run the backend"), then point the app at that tunnel via
`mobile/.env` or the in-app Settings screen.

## Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.13** on Windows (use `py -3.13`). Python 3.14 doesn't yet have prebuilt wheels for our pinned `pydantic==2.9.2` / `pydantic-core==2.23.4`, so the install will hang on a Rust build. Grab 3.13 from <https://www.python.org/downloads/release/python-3131/>.
- **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- **ngrok** (free tier is fine) — phone hits the backend through a public tunnel
- **OpenAI API key** (Whisper) and **Anthropic API key** (Claude)

## Run the backend

From the repo root in PowerShell:

```powershell
cd backend

# If you have a half-built .venv from a previous attempt, nuke it first:
# Remove-Item -Recurse -Force .\.venv

# First time only — create and populate the virtualenv. Pin to 3.13 (see Prerequisites).
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Set keys (copy .env.example → .env and fill in)
Copy-Item .env.example .env
notepad .env   # paste your ANTHROPIC_API_KEY and OPENAI_API_KEY

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal, expose it via ngrok:

```powershell
ngrok http 8000
```

Note the `https://*.ngrok-free.app` URL — that's what the phone will talk to.

Smoke test the tunnel:

```powershell
curl.exe https://YOUR-NGROK-URL/health
# Expect: {"ok":true,"anthropic_ok":true,"openai_ok":true}
```

Use `curl.exe`, not `curl`. In PowerShell, `curl` is an alias for `Invoke-WebRequest`, which prompts about script parsing and wraps the response in an object. `curl.exe` calls the real curl binary that ships with Windows 10+ and just prints the JSON body.

## Run the mobile app

From the repo root in a third terminal:

```powershell
cd mobile

# First time only
npm install

# Optional: set the backend ngrok URL as the build-time default
Copy-Item .env.example .env
notepad .env   # paste your https://*.ngrok-free.app URL

# Start the Metro bundler on your local network (phone + laptop on same Wi-Fi)
npm start

# Or, if your phone is on cellular / a different network from the laptop
npm run start:tunnel
```

A QR code appears. Open **App Store Expo Go** on your phone and scan it. The app opens at the Onboarding screen on first launch.

**Heads up — two tunnels, only one is yours.** `ngrok http 8000` is your own backend tunnel; you control its auth via the `ngrok` CLI. `npm run start:tunnel` is a *separate* ngrok exposing Metro, and Expo CLI bakes in a **shared** auth token (`AsyncNgrok.js`) that every Expo user worldwide hits — there is no env-var override (`NGROK_AUTHTOKEN` is ignored). If Metro fails with `ngrok tunnel took too long to connect`, use plain `npm start` (LAN mode, phone + laptop on same Wi-Fi). See `mobile/README.md` for the full troubleshooting list.

In the app:
1. **Onboarding** — read the privacy disclosure, tap "Allow microphone", tap "Start using the app"
2. **Settings** (gear icon top right) — paste the backend URL into Server, tap "Test connection" (should say "connected"), then add a few students
3. **Home** — **short-tap** a student tile to record a voice note (audio → Whisper → text appears on the note); **long-press** a tile to type a note instead
4. **Generate Summary** (FAB bottom right) — pick a student, tap Generate, four sections render from Claude

> Note: voice recording does not work on the **iOS Simulator** (its audio
> recorder fails to initialize); test voice on a real device or a TestFlight build.

## Production & distribution

**Backend (Railway).** The production backend is deployed on Railway at
`https://classroom-log-production.up.railway.app` and redeploys from `main`.
Sanity-check it any time:

```
curl https://classroom-log-production.up.railway.app/health   # {"ok":true,...}
```

**Mobile (EAS Build → TestFlight).** The iOS app is built in Expo's cloud and
distributed via TestFlight. Config lives in `mobile/eas.json` (the `preview`
profile bakes in the Railway URL as `EXPO_PUBLIC_API_BASE_URL`). From `mobile/`,
with node 22 + `eas-cli`:

```
eas login
eas build --platform ios --profile preview --auto-submit
```

This builds in the cloud (~15–25 min) and submits the result to App Store Connect
→ TestFlight. `appVersionSource: remote` + `autoIncrement` means EAS bumps the
build number for you. Privacy Policy URL for App Store Connect:
`https://classroom-log-production.up.railway.app/privacy`
(source of truth: `docs/privacy-policy.md` and `backend/app/routes/privacy.py`).

## Routes the backend exposes

| Method | Path         | What it does                                      |
| ------ | ------------ | ------------------------------------------------- |
| GET    | `/health`    | Probe Anthropic + OpenAI key shape, return status |
| POST   | `/transcribe`| Multipart audio file → Whisper → `{ text }`       |
| POST   | `/summary`   | Note list → Claude → four structured sections     |
| GET    | `/privacy`   | Bilingual (DA/EN) privacy policy page (HTML)      |

All routes return a uniform error envelope on failure: `{ "error": { "code": "...", "message": "..." } }`.

## Project layout

```
classroom-log/
├── backend/                 # FastAPI proxy
│   ├── app/
│   │   ├── main.py          # FastAPI app + error handlers
│   │   ├── routes/          # health, summary, transcribe, privacy
│   │   └── clients/         # Anthropic + OpenAI wrappers
│   ├── tests/
│   └── requirements.txt
├── mobile/                  # Expo SDK 54 React Native app
│   ├── eas.json             # EAS Build / TestFlight config (preview profile)
│   ├── app/                 # expo-router file-based routes
│   │   ├── _layout.tsx      # SQLiteProvider + RouterGate + onboarding redirect
│   │   ├── index.tsx        # Home (roster + today's notes + FAB)
│   │   ├── onboarding.tsx
│   │   ├── settings.tsx
│   │   ├── summary.tsx
│   │   └── note/[studentId].tsx
│   ├── components/          # PrimaryButton, StudentTile, NoteRow, ...
│   ├── db/                  # SQLite schema, migrations, CRUD
│   ├── api/                 # client + summary wrapper + tests
│   ├── lib/                 # theme, dates, audio, id
│   └── __mocks__/           # jest manual mocks for native modules
└── docs/
    ├── privacy-policy.md    # privacy policy (served at /privacy)
    └── superpowers/
        ├── specs/           # design spec
        └── plans/           # implementation + EAS/TestFlight plans
```

## Test

Backend (from `backend/` with venv active):

```powershell
pytest
```

Mobile (from `mobile/`):

```powershell
npm test
```

Both should be green on `main`. The mobile test suite uses better-sqlite3 as a node-side SQLite for jest (the real `expo-sqlite` is a native module that doesn't run under jest-expo) — production still uses real `expo-sqlite` on the phone.

## Development status

V1 is feature-complete and on `main`: text + **voice** capture, daily summaries,
local SQLite storage, and the FastAPI proxy are all wired. The backend is live on
Railway and the iOS app is in **TestFlight** (EAS Build pipeline — see "Production
& distribution"). See `docs/superpowers/plans/` for the original implementation
plan and the EAS/TestFlight pipeline plan.

## License

See `mobile/LICENSE`.
