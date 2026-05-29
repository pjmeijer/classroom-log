# classroom-log

A note-taking tool for special-education teachers. Tap a student, speak or type, save. Then let Claude draft a daily summary for review.

Built as a two-piece demo: a React Native (Expo SDK 56) phone app and a FastAPI proxy that talks to OpenAI Whisper (for voice → text) and Anthropic Claude (for daily summaries). All notes live on the phone; the proxy holds nothing.

## Architecture

```
┌───────────────────────┐                  ┌──────────────────────────┐
│  iPhone / Android     │                  │  Backend (your laptop)   │
│  Expo Go              │   POST /transcribe   │  FastAPI + uvicorn        │
│  - SQLite (local)     │ ───────────────► │  - /health                │
│  - Roster, notes,     │   POST /summary  │  - /transcribe → OpenAI   │
│    settings           │ ◄─────────────── │  - /summary    → Anthropic│
└───────────────────────┘   (via ngrok)    └──────────────────────────┘
                                                  │
                                                  ├─► api.openai.com (Whisper)
                                                  └─► api.anthropic.com (Claude)
```

No cloud database. No accounts. The phone keeps the only persistent copy of notes; the backend is a thin pass-through that retains nothing after each request returns.

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

# Start the Metro bundler with the tunnel transport
npm start -- --tunnel
```

A QR code appears. Open **Expo Go** on your phone and scan it. The app opens at the Onboarding screen on first launch.

In the app:
1. **Onboarding** — read the privacy disclosure, tap "Allow microphone", tap "Start using the app"
2. **Settings** (gear icon top right) — paste the ngrok URL into Server, tap "Test connection" (should say "connected"), then add a few students
3. **Home** — tap a student tile → modal opens → type a note → tap Save
4. **Generate Summary** (FAB bottom right) — pick a student, tap Generate, four sections render from Claude

Voice capture lands in Task 14; today it's the text path only.

## Routes the backend exposes

| Method | Path         | What it does                                      |
| ------ | ------------ | ------------------------------------------------- |
| GET    | `/health`    | Probe Anthropic + OpenAI key shape, return status |
| POST   | `/transcribe`| Multipart audio file → Whisper → `{ text }`       |
| POST   | `/summary`   | Note list → Claude → four structured sections     |

All routes return a uniform error envelope on failure: `{ "error": { "code": "...", "message": "..." } }`.

## Project layout

```
classroom-log/
├── backend/                 # FastAPI proxy
│   ├── app/
│   │   ├── main.py          # FastAPI app + error handlers
│   │   ├── routes/          # health, summary, transcribe
│   │   └── clients/         # Anthropic + OpenAI wrappers
│   ├── tests/
│   └── requirements.txt
├── mobile/                  # Expo SDK 56 React Native app
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
└── docs/superpowers/
    ├── specs/               # design spec
    └── plans/               # implementation plan + status
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

Both should be green at every commit on `feat/v1-implementation`. The mobile test suite uses better-sqlite3 as a node-side SQLite for jest (the real `expo-sqlite` is a native module that doesn't run under jest-expo) — production still uses real `expo-sqlite` on the phone.

## Development status

Currently on branch `feat/v1-implementation`. Tasks 0–11 and 13 are complete; tasks 12 (manual smoke), 14 (voice wiring), 15 (real health pill), 16 (move/edit notes), 17 (docs), 18 (final review) are next. See `docs/superpowers/plans/2026-05-26-classroom-log-v1.md` for the full plan.

## License

See `mobile/LICENSE`.
