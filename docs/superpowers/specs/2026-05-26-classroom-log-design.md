# Classroom-Log — Design Spec

**Date:** 2026-05-26
**Status:** V1 prototype design, pre-implementation
**Owner:** pjmeijer

## 1. Overview

A real-time note-taking app for special-education teachers to log student
incidents and observations throughout the day. Capture is the core experience:
tap a student button, speak or type a note, save. A secondary feature uses
Claude to generate a structured daily summary per student.

V1 is a prototype intended to be demoed to special-education teachers with the
builder physically nearby. Validation, not production, is the goal.

## 2. Goals and non-goals

### Goals

- Single-tap capture: from open app to "speaking a note about Alex" in under
  three seconds.
- On-device voice transcription with zero audio retention.
- Structured Claude-generated summary that reads like something a teacher
  would actually send to a parent or specialist.
- Runs on iPhone and Android via Expo Go during demos; multiple testers can
  use it concurrently on their own phones.

### Non-goals (V1)

- Authentication, accounts, multi-tenant infrastructure
- Cross-device sync, shared data between teachers, cloud database
- Offline LLM behavior, request queueing
- App Store / TestFlight / Play Store distribution
- Categories or tags on notes
- React Native Testing Library UI tests, E2E tests
- Audio file retention or replay
- Web build (deferred to V2)
- Multi-day or multi-week summary views (V1 = daily, by student)

## 3. Architecture

Two processes during a demo, both running on the builder's Windows laptop:

```
┌────────────────────┐        HTTPS         ┌──────────────────────┐        HTTPS         ┌──────────────┐
│  Teacher's phone   │ ───────────────────▶ │  Builder's laptop    │ ───────────────────▶ │  Claude API  │
│   (Expo Go app)    │                      │                      │                      │  (Anthropic) │
│                    │                      │  • Metro bundler     │                      └──────────────┘
│  • UI screens      │                      │    (Expo tunnel)     │
│  • expo-sqlite     │                      │  • FastAPI proxy     │
│  • on-device STT   │                      │    (uvicorn :8000,   │
│                    │                      │     ngrok tunnel)    │
└────────────────────┘                      └──────────────────────┘
```

**Networking.** The phone reaches Metro via `npx expo start --tunnel` and
reaches the FastAPI proxy via an ngrok tunnel on port 8000. The ngrok URL is
read by the Expo app at build time as `EXPO_PUBLIC_API_BASE_URL`. Same-WiFi
is not required.

**Multi-tester capacity.** Multiple Expo Go instances can connect to the same
Metro tunnel and the same FastAPI proxy concurrently. Each phone keeps its own
SQLite database — testers are fully isolated. Practical capacity: 3–10
concurrent testers on free ngrok / Expo tiers.

### Repo layout

```
classroom-log/
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx               # root layout, DB init on mount
│   │   ├── index.tsx                 # Home: roster + global toggle + today's notes
│   │   ├── settings.tsx              # Roster + LLM toggle
│   │   ├── summary.tsx               # Generate report
│   │   └── note/[studentId].tsx      # Modal route for note capture
│   ├── db/db.ts                      # expo-sqlite wrapper
│   ├── api/summary.ts                # fetch wrapper for FastAPI
│   ├── lib/stt.ts                    # expo-speech-recognition wrapper
│   ├── app.config.ts                 # reads EXPO_PUBLIC_API_BASE_URL
│   └── .env                          # ngrok URL (gitignored)
├── backend/
│   ├── app/main.py                   # FastAPI, single endpoint
│   ├── .env                          # ANTHROPIC_API_KEY (gitignored)
│   └── requirements.txt
└── docs/
    ├── manual-smoke.md               # repeatable manual test checklist
    └── superpowers/specs/
        └── 2026-05-26-classroom-log-design.md
```

## 4. Components

### Mobile

**`app/index.tsx` — Home**
- Top bar: app title, global "Do Not Record" toggle (writes `settings` row),
  Settings gear navigates to `/settings`.
- Roster grid: one button per student, auto-sized for 7–10 entries. Tap →
  `/note/[studentId]`.
- "Today's notes" list grouped by student, chronological. Each row: time,
  student name, first ~80 chars. Tap → opens `/note/[studentId]?noteId=...`
  in edit mode.
- Floating "Generate Summary" button bottom-right → `/summary`.

**`app/note/[studentId].tsx` — Note capture**
- Header: student name, close button (returns to Home), Recording toggle.
- Recording toggle default: `student.recordingEnabled AND NOT settings.globalDoNotRecord`.
  Disabled (greyed) if global toggle is on.
- Multiline text input, auto-focused, always editable.
- Mic FAB: tap to start STT, tap again to stop. Interim STT results write to
  the input (debounced 100 ms); final results append at the cursor.
- Editing during recording is allowed — when the user types, STT continues
  appending below their edits (no interleaving).
- Save button writes the note row and closes the modal. On modal close with
  non-empty text, auto-save (no silent discards).
- Edit mode (existing `noteId` param): same UI; Save becomes Update; a
  hold-to-confirm delete button is shown.

**`app/settings.tsx` — Settings**
- Section "Students": list with name, per-student "Recording allowed" toggle,
  swipe-to-delete. Header row: text input + add button.
- Section "AI": "Generate summaries with Claude" toggle. When off, Summary
  screen still works but shows raw chronological notes only.
- Section "About": API base URL (read-only), version.

**`app/summary.tsx` — Summary**
- Student picker (dropdown), date picker (defaults to today), Generate button.
- Below: rendered summary with four sections — Positives, Concerns,
  Patterns, Suggested next steps. Markdown rendered with a small inline renderer.
- Loading state during FastAPI call. Error state with retry on failure.
- Copy-to-clipboard button per section.

**`db/db.ts`**
Initializes schema on first run using `PRAGMA user_version` for migrations.
Exports typed functions:
- `getStudents()`, `addStudent({name})`, `removeStudent(id)`, `setStudentRecording(id, enabled)`
- `getNote(id)`, `addNote({studentId, text})`, `updateNote(id, text)`, `deleteNote(id)`
- `getNotesForDate(date)`, `getNotesForStudentInRange(studentId, start, end)`
- `getSetting(key)`, `setSetting(key, value)`

No ORM; parameterised `db.execAsync` and `db.getAllAsync` only.

**`lib/stt.ts`**
Thin wrapper over `expo-speech-recognition`:
- `start()`, `stop()`, `onInterim(cb)`, `onFinal(cb)`
- Handles iOS/Android permission prompts; surfaces "not granted" as a typed
  error the modal renders inline.

**`api/summary.ts`**
Wrapper around `fetch(${EXPO_PUBLIC_API_BASE_URL}/summary, ...)`. Returns a
discriminated union: `{ok: true, sections}` or `{ok: false, error}`.

### Backend

**`backend/app/main.py`**
Single FastAPI app, ~80 lines.

`POST /summary`
- Request body: `{student_name: str, notes: [{timestamp: int, text: str}]}`
- Response (success): `{positives: str, concerns: str, patterns: str, next_steps: str}`
- Response (error): `{error: {code: str, message: str}}` with appropriate
  HTTP status.
- System prompt is fixed and uses Anthropic prompt caching.
- Model: `claude-sonnet-4-6`.
- If Claude returns malformed JSON, the proxy retries once with a stricter
  system reminder before surfacing the error.
- CORS: open to the Expo tunnel origin and ngrok subdomain pattern.

## 5. Data model

SQLite schema (created on first run, migrated via `PRAGMA user_version`):

```sql
CREATE TABLE students (
  id              TEXT PRIMARY KEY,            -- uuid v4
  name            TEXT NOT NULL,
  recording_enabled INTEGER NOT NULL DEFAULT 1, -- 0 or 1
  created_at      INTEGER NOT NULL              -- unix ms
);

CREATE TABLE notes (
  id              TEXT PRIMARY KEY,            -- uuid v4
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  created_at      INTEGER NOT NULL,            -- unix ms
  updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_notes_student_created ON notes(student_id, created_at);
CREATE INDEX idx_notes_created ON notes(created_at);

CREATE TABLE settings (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL
);
```

Settings keys used in V1: `global_do_not_record` (`"0"` | `"1"`),
`llm_enabled` (`"0"` | `"1"`).

## 6. Data flow

**Add a student.** Settings → user types name → `db.addStudent({name})` →
new row inserted → local `useState` of student list updated → list re-renders.

**Capture a note.** Home tap on student button → router pushes
`/note/[studentId]` → modal mounts, reads global and per-student recording
prefs → text input ready. Mic tap → `stt.start()` → `onInterim` updates the
text field → second mic tap or save closes STT. Save → `db.addNote(...)` →
router back to Home → Home's `useFocusEffect` re-runs `db.getNotesForDate(today)`
→ list refreshes.

**Generate summary.** Summary screen → user picks student and date → reads
notes via `db.getNotesForStudentInRange(studentId, start, end)` → POSTs to
`${API_BASE_URL}/summary` → FastAPI builds Claude messages with cached system
prompt → returns four sections → screen renders.

**State location.**
- SQLite (source of truth): students, notes, settings.
- Component `useState`: current modal text, current STT session, current
  summary result, picker selections.
- Environment: `EXPO_PUBLIC_API_BASE_URL` read once at startup.

## 7. Error handling

| Failure | App behavior |
|---|---|
| STT permission denied (OS) | Inline message: "Mic disabled — tap to enable in Settings." Text input still works. |
| STT not available on device | Recording toggle hidden, text-only capture. |
| Note save with empty text | Modal closes silently. No row written. |
| Backgrounded mid-recording | STT auto-stops, flushes final result into the text field, modal stays open. |
| FastAPI unreachable | Summary screen falls back to raw chronological view. Banner: "AI summary unavailable — tunnel down?" with retry. |
| Claude API 4xx/5xx | Typed error from FastAPI; screen shows "Try again" + the error code. Previous summary stays rendered if any. |
| Claude returns malformed JSON | FastAPI retries once with stricter system reminder; if it fails again, returns error. |
| Empty roster | Home shows empty state with "Add your first student" → Settings. |
| Empty notes for selected day | Summary disables Generate, shows "No notes for this day yet." |
| DB write fails (rare) | Toast: "Couldn't save — tap to retry." Note text held in component state, not lost. |

Explicitly **not handled in V1**: offline queueing of summary requests,
multi-device sync conflicts, partial-network states. Single device,
online-during-demo is the explicit assumption.

## 8. Testing

**Unit (`mobile/`, Jest):**
- `db/db.ts` — every exported function against an in-memory SQLite (`better-sqlite3`
  in Node test env). Schema migration tested.
- `lib/stt.ts` — mocks `expo-speech-recognition`; verifies wrapper emits the
  expected interim/final events and surfaces permission errors.
- `api/summary.ts` — mocks `fetch`; verifies request shape and response
  parsing, including error paths.

**Backend (`backend/`, pytest):**
- `POST /summary` — mocked Anthropic client; verifies request mapping, the
  4-section response contract, the malformed-JSON retry path, and error
  surfacing.

**Manual smoke checklist (`docs/manual-smoke.md`):**
A repeatable checklist run after each significant change:
cold start → add 2 students → log a typed note → log a voice note → toggle
global do-not-record → verify mic disabled → generate summary → edit a note →
delete a note.

**Out of scope for V1:** RNTL UI tests, Detox/Maestro E2E, load testing of
the proxy.

**TDD.** The implementation plan will sequence work red → green → refactor
per the superpowers `test-driven-development` skill. Unit tests precede the
function they cover; UI surfaces are exercised via the manual checklist.

## 9. Distribution and demo setup

The builder runs two terminals on their laptop:

1. `cd mobile && npx expo start --tunnel` — Metro bundler with tunnel.
2. `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
   plus `ngrok http 8000` — proxy + tunnel. The ngrok URL is written into
   `mobile/.env` as `EXPO_PUBLIC_API_BASE_URL` before step 1.

Teachers install Expo Go from the App Store / Play Store, scan the Metro QR
code, and the app loads. The same QR works for any number of testers in the
session.

## 10. Future (V2 — explicitly out of scope)

These are noted to clarify what V1 is *not*, not as commitments:

- Web build (Expo universal target)
- Categories / tags on notes, inferred by Claude or chosen by teacher
- Multi-day and multi-week summary views, trend summaries
- Shared roster across teachers (real backend, auth)
- App Store / TestFlight distribution
- Offline-first behavior with summary queueing

V2 work begins only if real teachers using V1 say they would use a refined
version. The shape of V2 is influenced by what they say.
