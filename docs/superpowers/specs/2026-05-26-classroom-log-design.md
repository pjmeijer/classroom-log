# Classroom-Log — Design Spec

**Date:** 2026-05-26
**Status:** V1 prototype design, pre-implementation
**Owner:** pjmeijer
**Revision:** v2 — incorporates codex review findings (2026-05-26)

## 1. Overview

A real-time note-taking app for special-education teachers to log student
incidents and observations throughout the day. Capture is the core experience:
tap a student button, speak or type a note, save. A secondary feature uses
Claude to generate a structured draft daily summary per student.

V1 is a prototype intended to be demoed to special-education teachers with the
builder physically nearby. Validation, not production, is the goal.

## 2. Goals and non-goals

### Goals

- Single-tap capture: from open app to "speaking a note about Alex" in under
  three seconds (after the first-launch permission preflight).
- Cloud voice transcription via the builder's backend; audio is buffered in
  memory during the request and never written to disk on phone or laptop, and
  never retained after the transcription response returns.
- Structured Claude-generated draft summary the teacher reviews before
  sharing.
- Runs on iPhone and Android via Expo Go during demos; multiple testers can
  use it concurrently on their own phones.

### Non-goals (V1)

- Authentication, accounts, multi-tenant infrastructure
- Cross-device sync, shared data between teachers, cloud database
- Offline LLM behavior, offline transcription, request queueing
- App Store / TestFlight / Play Store distribution
- Categories or tags on notes
- React Native Testing Library UI tests, E2E tests
- Audio file retention or replay
- Web build (deferred to V2)
- Multi-day or multi-week summary views (V1 = daily, by student)
- Edit-while-recording (cut: recording locks the field; edit after stop)
- Markdown rendering of summaries (cut: backend returns plain strings)
- Prompt caching on summary calls (cut: no measurable V1 benefit)
- Malformed-JSON retry on summary calls (cut: replaced by structured output)
- CORS configuration (not needed for native fetch)

## 3. Architecture

Two processes during a demo, both running on the builder's Windows laptop:

```
┌────────────────────┐        HTTPS         ┌──────────────────────┐
│  Teacher's phone   │ ───────────────────▶ │  Builder's laptop    │
│   (Expo Go app)    │                      │                      │
│                    │                      │  • Metro bundler     │
│  • UI screens      │                      │    (Expo tunnel)     │
│  • expo-sqlite     │                      │  • FastAPI proxy     │
│  • expo-av         │                      │    (uvicorn :8000,   │
│    (audio capture) │                      │     ngrok tunnel)    │
│                    │                      │                      │
└────────────────────┘                      └──────────────────────┘
                                                       │
                                            ┌──────────┴──────────┐
                                            │                     │
                                       HTTPS▼                HTTPS▼
                                  ┌──────────────┐    ┌──────────────┐
                                  │ Anthropic    │    │ OpenAI       │
                                  │ Claude       │    │ Whisper      │
                                  │ (summaries)  │    │ (transcribe) │
                                  └──────────────┘    └──────────────┘
```

**Networking.** The phone reaches Metro via `npx expo start --tunnel` and
reaches the FastAPI proxy via an ngrok tunnel on port 8000. ngrok free tier
provides a stable assigned dev domain; use that to avoid URL rotation between
restarts. The phone reads its API base URL from a `settings` row in the
local SQLite (not from a build-time env var), so the URL can be edited in the
Settings screen without rebuilding the JS bundle. First-run default is read
from `EXPO_PUBLIC_API_BASE_URL` and persisted into `settings` on first launch.

**School-network caveat.** School Wi-Fi may block Expo tunnel, ngrok, or
arbitrary HTTPS WebSockets. The demo plan must include a cellular-hotspot
fallback path; tunnels should be verified working on the demo network before
the session.

**Multi-tester capacity.** Multiple Expo Go instances can connect to the same
Metro tunnel and the same FastAPI proxy concurrently. Each phone keeps its own
SQLite database — testers are fully isolated. Practical capacity: 3–10
concurrent testers on free ngrok / Expo tiers.

### Repo layout

```
classroom-log/
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx               # root layout, DB init + permission preflight
│   │   ├── index.tsx                 # Home: roster + Voice toggle + today's notes
│   │   ├── settings.tsx              # Roster + LLM toggle + API URL + demo reset
│   │   ├── summary.tsx               # Generate draft summary
│   │   ├── onboarding.tsx            # Permission preflight + privacy disclosure
│   │   └── note/[studentId].tsx      # Modal route for note capture
│   ├── db/db.ts                      # expo-sqlite wrapper
│   ├── api/transcribe.ts             # POST audio → backend → transcript
│   ├── api/summary.ts                # POST notes → backend → summary
│   ├── api/health.ts                 # GET /health (status indicator)
│   ├── lib/audio.ts                  # expo-av record wrapper
│   ├── app.config.ts                 # reads EXPO_PUBLIC_API_BASE_URL (first-run default)
│   └── .env                          # ngrok URL (gitignored)
├── backend/
│   ├── app/main.py                   # FastAPI: /transcribe, /summary, /health
│   ├── .env                          # ANTHROPIC_API_KEY, OPENAI_API_KEY (gitignored)
│   └── requirements.txt
└── docs/
    ├── manual-smoke.md               # repeatable manual test checklist
    ├── tunnel-setup.md               # demo-day setup order + verification
    └── superpowers/specs/
        └── 2026-05-26-classroom-log-design.md
```

## 4. Components

### Mobile

**`app/_layout.tsx` — Root**
- DB init (`open`, run pending migrations, `PRAGMA foreign_keys = ON`).
- On first launch ever, routes to `/onboarding`. On subsequent launches,
  routes to `/`.

**`app/onboarding.tsx` — First-launch permission preflight**
- One screen, three short paragraphs:
  1. What stays on the phone (typed notes, transcripts, settings).
  2. What goes to the laptop temporarily (audio buffer during transcription,
     note text during summary).
  3. What goes to OpenAI Whisper / Anthropic Claude (audio bytes for
     transcription, note text for summary). Nothing is stored by those
     services per their respective APIs.
- "Allow microphone" button triggers the OS permission prompt.
- "Start using the app" button writes a `settings.onboarding_complete = 1`
  row and routes to `/`.

**`app/index.tsx` — Home**
- Top bar: app title, global "Voice off" toggle (writes `settings`),
  Settings gear navigates to `/settings`.
- Status pill near the gear: "AI: connected" / "AI: offline" — driven by
  `GET /health` on focus.
- Roster grid: one button per non-archived student, auto-sized for 7–10
  entries. Tap → `/note/[studentId]`.
- "Today's notes" list grouped by student, chronological in local time.
  Each row: time, student name, first ~80 chars. Tap → opens
  `/note/[studentId]?noteId=...` in edit mode. Long-press → "Move to
  different student" picker.
- Floating "Generate Summary" button bottom-right → `/summary`.

**`app/note/[studentId].tsx` — Note capture**
- Header: student name, close button, mic toggle button.
- Mic toggle default: `student.recording_enabled AND settings.voice_on`.
  Disabled (greyed) if `voice_on = 0`.
- Multiline text input, auto-focused, always editable when not recording.
- Mic button: tap once to start recording (uses `expo-av`); the text input
  becomes read-only during recording with a "Recording…" indicator. Tap
  again (or tap Stop) to finalize: audio is streamed/POSTed to
  `${api_base_url}/transcribe`, response replaces the text field contents
  if it was empty, or appends with a space separator if not.
- Save button writes the note row (`runAsync` INSERT) and closes the modal.
- Closing with unsaved text shows a small sheet: **Save**, **Discard**,
  **Keep editing**. No silent auto-save.
- Edit mode (existing `noteId` param): same UI; Save becomes Update; a
  hold-to-confirm delete button is shown.
- Hard cap on note text length: 5,000 characters. Reached cap → input stops
  accepting; inline message: "Note is at the 5,000-character limit."

**`app/settings.tsx` — Settings**
- Section "Students": list with name, per-student "Voice allowed" toggle,
  hold-to-confirm archive button (soft delete via `archived_at`). Header
  row: text input + add button. Duplicate names are allowed but flagged
  with a yellow warning chip beside the second occurrence.
- Section "AI": "Generate summaries with Claude" toggle. When off, Summary
  screen shows raw chronological notes with a banner: "AI summaries are
  off. Showing your raw notes."
- Section "Server": editable API base URL field (writes `settings.api_base_url`),
  "Test connection" button (calls `/health`).
- Section "Demo": "Reset demo data" button — hold to confirm — wipes all
  notes and students.
- Section "About": app version.

**`app/summary.tsx` — Summary**
- Student picker (non-archived students only), date picker (defaults to
  today, local timezone), Generate button.
- Subtitle on Generate button: "Sends today's notes for [student] to
  Claude. Audio never leaves the phone for this step — only the typed/
  transcribed text."
- Below: rendered summary as four labelled plain-text sections — Positives,
  Concerns, Patterns, Suggested next steps. Each section header says
  "Draft — review before sharing".
- Loading state during FastAPI call. Error state with retry on failure.
- "Copy all" button copies the four sections concatenated with section
  headings into one paste-ready block.

**`db/db.ts`**
- Initializes schema on first run using `PRAGMA user_version` for migrations.
- Enables `PRAGMA foreign_keys = ON` on every connection open.
- Exports typed functions using Expo's actual API names:
  - reads: `getAllAsync`, `getFirstAsync`
  - writes: `runAsync` (parameterised) for INSERT / UPDATE / DELETE
- Surface: `listActiveStudents()`, `addStudent({name})`,
  `archiveStudent(id)`, `setStudentVoiceAllowed(id, allowed)`,
  `getNote(id)`, `addNote({studentId, text})`, `updateNote(id, text)`,
  `deleteNote(id)`, `moveNote(noteId, newStudentId)`,
  `getNotesForLocalDate(yyyymmdd)`,
  `getNotesForStudentInLocalRange(studentId, fromYmd, toYmd)`,
  `getSetting(key)`, `setSetting(key, value)`.
- All "date" filtering uses local-timezone YYYYMMDD strings derived in JS
  before the query (the DB doesn't know about timezones).

**`lib/audio.ts`**
- `start()`: request `expo-av` recording permission if needed, start
  recording to a temp file in app cache dir.
- `stop()`: stop recording, return path + duration. Caller is responsible
  for sending the bytes and deleting the temp file in a `finally`.
- `cleanup()`: delete any orphan recordings in the cache dir (called from
  root layout on app start).

**`api/transcribe.ts`**
- `POST ${api_base_url}/transcribe` with multipart audio. Returns
  `{ok: true, text}` or `{ok: false, error}`. Aborts on a 30-second
  timeout and surfaces a typed error.

**`api/summary.ts`**
- `POST ${api_base_url}/summary` with `{student_name, notes: [{ts, text}]}`.
  Returns `{ok: true, sections: {positives, concerns, patterns, next_steps}}`
  or `{ok: false, error}`. 60-second timeout.

**`api/health.ts`**
- `GET ${api_base_url}/health`. Returns `{ok: true, anthropic_ok, openai_ok}`
  or throws on network error. 5-second timeout.

### Backend

**`backend/app/main.py`**
Single FastAPI app, ~120 lines.

`GET /health` — verifies environment + reachability of both Anthropic and
OpenAI clients (cheap "list models" or equivalent). Used by the phone's
status pill.

`POST /transcribe` — multipart audio in. Calls OpenAI Whisper API. Returns
`{text: str}`. Audio buffer is held in memory for the request only; no
file write, no logging of audio bytes. 25-second internal timeout.

`POST /summary` — JSON `{student_name, notes}`. Calls Claude (sonnet-4-6)
with a fixed system prompt that requests structured output (Anthropic tool
use) for the four sections. Returns `{positives, concerns, patterns, next_steps}`.
50-second internal timeout.

**Error contract.** Every endpoint returns either the success body above or
`{error: {code: str, message: str}}` with an HTTP 4xx/5xx status. Mobile
discriminated unions decode against this contract.

## 5. Data model

SQLite schema (created on first run, migrated via `PRAGMA user_version`):

```sql
PRAGMA foreign_keys = ON;     -- run on every connection open, not just at create

CREATE TABLE students (
  id                 TEXT PRIMARY KEY,            -- uuid v4
  name               TEXT NOT NULL,
  recording_enabled  INTEGER NOT NULL DEFAULT 1,  -- per-student voice allowed
  archived_at        INTEGER,                     -- soft delete; NULL = active
  created_at         INTEGER NOT NULL             -- unix ms
);

CREATE TABLE notes (
  id          TEXT PRIMARY KEY,                   -- uuid v4
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,                   -- unix ms, set on insert
  updated_at  INTEGER NOT NULL                    -- unix ms, equals created_at on insert
);

CREATE INDEX idx_notes_student_created ON notes(student_id, created_at, id);
CREATE INDEX idx_notes_created ON notes(created_at, id);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
```

`ON DELETE RESTRICT` on notes prevents accidental cascade-wipe; the
`archiveStudent` function sets `archived_at` instead of deleting the row.

Settings keys used in V1:
- `voice_on` (`"0"` | `"1"`) — global Voice toggle
- `llm_enabled` (`"0"` | `"1"`) — generate-summary toggle
- `api_base_url` — runtime-editable API base URL
- `onboarding_complete` (`"0"` | `"1"`)

Secondary sort by `id` resolves same-millisecond ordering.

## 6. Data flow

**Add a student.** Settings → user types name → `runAsync("INSERT ...")` →
local `useState` of student list updated → list re-renders.

**Capture a note (voice path).** Home tap on student button → router pushes
`/note/[studentId]` → modal mounts. User taps mic → `audio.start()` →
text field becomes read-only with "Recording…" indicator → user taps stop →
`audio.stop()` returns file path → modal POSTs to `${api_base_url}/transcribe`
(streaming the bytes), shows "Transcribing…" spinner → response text fills
the field → user can edit. User taps Save → `runAsync("INSERT INTO notes ...")` →
modal closes. Recording temp file is deleted in a `finally`.

**Capture a note (text path).** Same modal, user just types and taps Save.

**Generate summary.** Summary screen → user picks student + date →
`getNotesForStudentInLocalRange(studentId, yyyymmdd, yyyymmdd)` →
POST to `${api_base_url}/summary` → display four sections.

**State location.**
- SQLite (source of truth): students, notes, settings (including api_base_url).
- Component `useState`: current modal text, current recording session,
  current summary result, picker selections.
- Environment: `EXPO_PUBLIC_API_BASE_URL` is read once at first launch to
  seed `settings.api_base_url`. After first launch, the env var is ignored.

## 7. Error handling

| Failure | App behavior |
|---|---|
| Mic permission denied (OS) | Onboarding shows "Mic disabled — text-only mode. Enable in iOS/Android Settings." Voice toggle remains disabled. Text capture still works. |
| `expo-av` recording failure mid-session | Stop the recording, drop temp file, show inline error: "Couldn't record — try again or type your note." Text field becomes editable again. |
| Transcribe call network failure | Inline error in modal: "Couldn't reach transcription server. Tap retry or just type the note." Recorded temp file is deleted; raw audio is not held for replay. |
| Transcribe returns empty text | Inline message: "Didn't catch that — try again or type the note." Field stays empty. |
| Note save with empty text | Save button is disabled; closing with empty field closes silently. |
| Backgrounded mid-recording | `expo-av` is stopped, temp file deleted, modal stays open with text field re-enabled. |
| FastAPI unreachable on summary | Summary screen falls back to a raw chronological view of the notes (locally generated). Banner: "AI summary unavailable — showing raw notes." No retry-storm. |
| Claude API 4xx/5xx | Typed error from FastAPI; screen shows "Try again" + the error code. If a previous summary was already on screen, it stays rendered; on a cold first attempt, the section area shows an inline error state. |
| DB write fails (rare) | Inline error: "Couldn't save — tap to retry." Note text held in modal state until user dismisses. |
| Empty roster | Home shows empty state with "Add your first student" → Settings. |
| Empty notes for selected day | Summary disables Generate, shows "No notes for this day yet." |

Explicitly **not handled in V1**: offline queueing of summary requests,
multi-device sync conflicts, partial-network states, retrying transcription
on flaky cellular.

## 8. Privacy

The app makes a small, explicit set of network calls. The onboarding screen
explains this verbatim:

- **Stays on the phone:** typed notes, transcribed text, settings, roster.
- **Goes to the laptop (yours, during the demo) and is held in memory only:**
  audio bytes during a transcription request, note text during a summary
  request. The laptop does not write either to disk.
- **Goes to third parties:** audio bytes are sent to OpenAI Whisper for
  transcription; note text is sent to Anthropic Claude for summary
  generation. Whisper and Claude do not retain inputs for training when
  called via the API per their respective stated policies. The builder
  pays for both API calls.
- **Never sent:** the raw audio is never stored anywhere persistent — not on
  phone, not on laptop, not by OpenAI when called via API.

Every demo session reminds the teacher of this on the onboarding screen.

## 9. Testing

**Unit (`mobile/`, Jest with `jest-expo` preset):**
- `db/db.ts` — every exported function against `expo-sqlite` in the
  `jest-expo` Node environment. Migration is tested by running the
  schema-create path against a fresh DB. **Caveat:** the Node adapter does
  not perfectly mirror device behavior; manual smoke (§10) is the
  authoritative test for DB code.
- `lib/audio.ts` — mocks `expo-av`; verifies start/stop/cleanup contract
  and permission error surfacing.
- `api/transcribe.ts`, `api/summary.ts`, `api/health.ts` — mock `fetch`;
  verify request shape, response parsing, timeout abort, and error paths.

**Backend (`backend/`, pytest):**
- `POST /transcribe` — mocked OpenAI client; verifies multipart parsing,
  in-memory-only handling (no disk writes), error mapping.
- `POST /summary` — mocked Anthropic client; verifies request mapping,
  structured-output decoding, error mapping.
- `GET /health` — both clients mocked, both reachable / one down / both
  down branches covered.

**Manual smoke checklist (`docs/manual-smoke.md`):**
A repeatable checklist run after each significant change:
cold start → onboarding → permissions granted → add 2 students → log a
typed note → log a voice note → toggle Voice off → verify mic disabled →
generate summary → edit a note → archive a student → reset demo data.

**Out of scope for V1:** RNTL UI tests, Detox / Maestro E2E, load testing
of the proxy.

**TDD.** The implementation plan will sequence work red → green → refactor
per the superpowers `test-driven-development` skill. Unit tests precede the
function they cover; UI surfaces are exercised via the manual checklist.

## 10. Distribution and demo setup

The builder runs three things on the laptop, in this order, before any
teacher scans a QR code. The exact checklist lives in `docs/tunnel-setup.md`:

1. `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. `ngrok http --domain=<assigned-dev-domain> 8000`
3. `cd mobile && npx expo start --tunnel`

Verification before handing out the QR:
- `curl https://<ngrok-domain>/health` returns `{ok: true, anthropic_ok: true, openai_ok: true}`.
- Builder's own phone scans the QR, opens the app, reaches the onboarding
  screen, taps "Test connection" in Settings — sees a green status.

If the ngrok domain changes between sessions, teachers update it in
Settings → Server → API base URL. They do not need a new build.

Teachers install Expo Go from the App Store / Play Store, scan the Metro QR
code, and the app loads. The same QR works for any number of testers.

**Demo-network fallback.** If school Wi-Fi blocks tunnels, the builder
switches to a cellular hotspot before the session. The tunnel-setup doc
includes a 60-second "network sanity" check that catches this case before
teachers arrive.

## 11. Future (V2 — explicitly out of scope)

These are noted to clarify what V1 is *not*, not as commitments:

- Web build (Expo universal target with web-speech-API for free in-browser
  on-device STT)
- Custom dev client to enable true on-device STT via `expo-speech-recognition`
- Categories / tags on notes, inferred by Claude or chosen by teacher
- Multi-day and multi-week summary views, trend summaries
- Shared roster across teachers (real backend, auth)
- App Store / TestFlight distribution
- Offline-first behavior with summary queueing
- Per-mode summary outputs (parent-facing vs. specialist-facing)

V2 work begins only if real teachers using V1 say they would use a refined
version. The shape of V2 is influenced by what they say.
