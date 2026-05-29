# Voice-first capture — design spec

> Status: brainstorm-approved. Next step: write implementation plan.
> Companion mockup: `docs/superpowers/brainstorm-visuals/2026-05-29-voice-first-capture/home-states.html`
> Source feedback: `docs/superpowers/feedback/2026-05-29-first-device-test.md`

## Goal

Restructure capture so that **voice is the default path** and reaches the
teacher in one tap from home, with text as an equally good fallback for
editing and longer entries. Wire the recorder for real (Task 14 from the v1
plan), make the summary respond in the language the teacher actually used,
and stop displaying raw Python repr when an upstream API error bubbles up.

After this slice ships, a teacher walking around a classroom can:

1. Glance at the home screen → tap a student tile.
2. Speak for as long as needed → tap Stop & save.
3. Glance at the toast → carry on or tap Edit to fix a Whisper miss.

No navigation, no extra page, no keyboard, ~3 seconds.

## Non-goals (explicitly out of scope for this slice)

- **Streaming / live transcription.** Whisper runs after Stop. Streaming
  is a different backend posture.
- **Translation between languages.** The summary matches the input
  language; we do not translate Danish notes into English on demand.
- **School-specific report templates.** Captured as a future surface that
  will read `primary_language` from Settings; not built here.
- **Voice activity detection (auto-stop on silence).** Explicit Stop only.
- **Editing notes inline on the home screen.** Edit still happens via the
  modal.
- **Switching microphones / Bluetooth headset selection.** Default mic only.

## Architecture overview

```
┌─────────────────┐      tap a tile        ┌──────────────────┐
│  app/index.tsx  │ ─────────────────────► │ useCaptureStore  │
│  (Home)         │                        │  (Zustand)       │
│                 │ ◄────────state────────│  start/stop/     │
│ StudentTile     │                        │  cancel + ref   │
│ RecordingTile   │                        │  to AudioRec    │
│ NoteRow         │                        └────────┬─────────┘
│ ToastUndoEdit   │                                 │
└────────┬────────┘                                 │
         │ long-press tile / tap note row           │ on Stop
         ▼                                          ▼
┌─────────────────┐                        ┌──────────────────┐
│ note/[id].tsx   │ ──── tap mic chip ───► │ /transcribe      │
│ (Text modal)    │ ◄──── transcript ──── │ (existing route) │
│  + Recording    │                        └────────┬─────────┘
│    bar slot     │                                 │
└────────┬────────┘                                 ▼
         │ Save / Update                  ┌──────────────────┐
         └───────────────────────────────►│ db/db.ts addNote │
                                          │ + notes.language │
                                          └──────────────────┘
```

One source of truth for the recording lifecycle is a tiny Zustand slice.
Both home and the text modal subscribe to it; the same state machine drives
the in-place tile transformation and the in-modal recording bar.

Why Zustand instead of local state in two places: the home screen needs to
disable other tiles while a recording is in progress, and the text modal
shouldn't allow a second recording to start when one is already running on
the tile (or vice-versa). A single store enforces the invariant naturally.
The existing project already uses Zustand for the tracking feature, so this
is one more thin slice, not a new library.

## Capture state machine

```
                       ┌───────────────────────┐
                       │        idle           │
                       │  recording: null      │
                       └──────────┬────────────┘
            tap tile / tap mic    │   long-press tile
              in modal            │   (no capture state change)
                       ▼          │            ▼
              ensurePermission()  │     open note modal
                       │          │
                  granted?        │
                  ├── no ─► snackbar "Microphone disabled
                  │              — long-press to type"
                  ▼   yes
                       ┌───────────────────────┐
                       │     recording         │
                       │  studentId, startedAt │ ◄── (re-entry
                       │  audioRecorder ref    │      blocked)
                       └──────────┬────────────┘
                           tap Cancel
                ┌──────────┤
                │          │ tap Stop
                ▼          ▼
        delete file   ┌───────────────────────┐
                      │     transcribing      │
                      │  uri, startedAt       │
                      └──────────┬────────────┘
                                 │
                          POST /transcribe
                                 │
                ┌────────────────┼──────────────┐
                ▼                ▼              ▼
        success +          backend 5xx       offline
        language            or 4xx          (no network)
            │                  │                │
            ▼                  ▼                ▼
       addNote(text,        addNote with    addNote with
       lang); toast        text = "(error  text = "(pending
       Undo/Edit            saving — tap   — tap to retry)";
                            note to retry)" persist .m4a uri
                                            in note.audio_uri
            │                  │                │
            └────────► idle ◄──┴────────────────┘
```

Hard rules:

- At most one `recording` at a time across the whole app. New start
  attempts while `recording !== null` are ignored (and silently swallowed
  on the home grid because the other tiles are dimmed + non-pressable).
- `Cancel` always discards the audio file (uses
  `cleanupOrphanRecordings` semantics or a direct delete on the URI).
- `Stop` is always destructive of the in-memory state — once tapped, the
  store transitions to `transcribing` regardless of network outcome, and
  the audio file is owned by the note row from then on.

## Home screen behavior

### Layout (idle)

`app/index.tsx` keeps its existing structure: top bar with title + status
pill + gear, voice-off switch, "Roster" section with the tile grid,
"Today's notes" section below, FAB at bottom-right for Generate Summary.

### Layout (recording)

When `recording !== null`:

- The recording student's tile transforms in place. It spans **2 columns**
  in the 2-column grid (so the recorder gets enough width for a usable
  Stop button while staying anchored where the teacher tapped). The tile
  takes the terracotta accent color (`colors.accent`).
- Tile contents change to: pulsing red dot + "Recording" label + tabular
  elapsed timer (top row); student name + 10-bar animated waveform
  (middle row); big "Stop & save" button + smaller "Cancel" button
  (bottom row).
- All other tiles dim to opacity 0.35 and become non-pressable. The
  "Voice off" switch, the "Today's notes" rows, and the Generate FAB
  also dim and disable to prevent navigation while recording.
- The status pill and gear stay live; the teacher can still see whether
  the backend is reachable.

### Gestures

| Surface | Gesture | Action |
|---|---|---|
| Student tile | tap | Start recording (only if `recording === null` AND mic permission OK) |
| Student tile | long-press (>500 ms) | Open text modal `note/[studentId].tsx` |
| Recording tile | tap "Stop & save" | Transition to `transcribing`, then save note |
| Recording tile | tap "Cancel" | Discard recording, return to idle |
| Today's-note row | tap | Open text modal in edit mode |
| Toast | tap "Undo" | Delete the just-saved note |
| Toast | tap "Edit" | Open text modal at the just-saved note |

Long-press discoverability is the one weak spot. Mitigation: when a
teacher has used the app for ≥1 day and has zero text-modal opens (i.e.
purely voice so far), show a one-time inline hint under the roster:
"Tip — hold a tile to type a note instead." Suppressed once dismissed
or after one text-modal open.

### Post-stop toast

`ToastUndoEdit` component renders fixed near the bottom of the screen
(above the FAB), centered. Shows for 5 s with two actions:

- **Undo** — calls `deleteNote(noteId)`. Toast disappears immediately.
- **Edit** — `router.push('/note/<studentId>?noteId=<noteId>')`. Toast
  disappears immediately.

If the user starts a second recording before the toast auto-dismisses,
the toast hides immediately (no stale toast over a recording UI).

### Component additions / edits

| File | Action | Why |
|---|---|---|
| `app/index.tsx` | edit | Subscribe to `useCaptureStore`; render `<RecordingTile>` in place of `<StudentTile>` for the recording student; dim others when `recording !== null`; render `<ToastUndoEdit>` when the store exposes a recent-save handle |
| `components/StudentTile.tsx` | edit | Add `onLongPress`, `disabled` props; visual dim when `disabled`; tap fires `onPress` only when `!disabled` |
| `components/RecordingTile.tsx` | new | Renders the recording-state UI; takes `studentName`, `startedAt`, `onStop`, `onCancel`; manages its own ticking timer + waveform animation |
| `components/ToastUndoEdit.tsx` | new | Self-contained timed toast; takes `studentName`, `noteId`, `onUndo`, `onEdit`, `onTimeout` |
| `store/useCaptureStore.ts` | new | Zustand slice; `recording: { studentId, startedAt, recorder } \| null`, `lastSaved: { noteId, studentName, savedAt } \| null`, actions `start(studentId)`, `stop()`, `cancel()`, `dismissToast()` |

## Text modal behavior

### Mic chip in header

The existing decorative mic chip in the modal header (`mobile/app/note/[studentId].tsx:103`)
becomes functional. Tap behavior:

- If `recording === null`: open the modal's in-modal recording bar (slides
  in from the bottom of the modal, sits **above the keyboard** via
  `KeyboardAvoidingView` with `behavior="padding"`).
- If `recording !== null` (recording already running for another student
  in the background — impossible from this flow since opening this modal
  doesn't start one, but defensive): mic chip is disabled.

The big "Coming up next" mic button at the bottom of the modal
(`mobile/app/note/[studentId].tsx:142`) is **removed** — the header chip
+ in-modal bar replace it. Cleaner, and removes the misleading Alert.

### Recording bar (inside modal)

Same recorder + Zustand store as on home, different post-Stop behavior:

- **Stop** — Whisper returns transcript; append to the textarea **at the
  current cursor position** (use the `TextInput` selection API). The
  modal stays open. The teacher can keep editing. The note is NOT saved
  until they tap Save / Update.
- **Cancel** — discard, modal stays open, textarea unchanged.

The recording bar inside the modal is its own component, mounted at the
bottom of the modal layout, anchored above the keyboard. The textarea
above it scrolls inside its remaining space; the Save / Update button
moves above the recording bar (or remains visible above the keyboard if
the keyboard is the dominant element).

### Dismissing the modal

Two ways out of the modal:

1. **Tap ✕** in header — existing path.
2. **Swipe down** — equivalent to ✕. Use the route's `presentation: "modal"`
   on iOS which already gives the system-native swipe-down, plus a
   `PanResponder` fallback on Android (or accept the back-button-only path
   on Android v1.1 and revisit).

Both run the existing `beforeRemove` dirty-check → `DiscardSheet` flow.

If a recording is active in the modal when dismiss fires:

- Cancel the recording first (discard audio file), THEN run the existing
  dismiss / dirty-check sequence. No silent leaks.

## Data model changes

### `db/db.ts` — `notes` table

Add a nullable `language` column:

```sql
ALTER TABLE notes ADD COLUMN language TEXT;
```

Populated by:
- **Voice notes**: Whisper's response `language` field (e.g. `da`, `en`).
- **Text notes**: left `NULL`. Backend will fall back to `primary_language`
  from Settings if needed.

Add a migration step in `db/migrations.ts` (or wherever existing
migrations live) — keep it idempotent (`IF NOT EXISTS` style or version
check).

### `db/db.ts` — orphan retry handle

Add a nullable `audio_uri` column to support the offline-retry path:

```sql
ALTER TABLE notes ADD COLUMN audio_uri TEXT;
```

When `/transcribe` fails (network or 5xx), the note is saved with
`text = "(voice note pending transcription — tap to retry)"` and
`audio_uri = <local m4a path>`. Tapping the note row in the modal exposes
a "Retry transcription" affordance (Save still works to commit the manual
text).

Orphan cleanup (`cleanupOrphanRecordings` in `lib/audio.ts`) must respect
notes with `audio_uri NOT NULL` — those are intentional, not orphans.

### `db/db.ts` — `settings` table

Two new settings rows, both wired into the existing `getSetting` /
`setSetting` API (single-row-per-key model already in use for
`voice_on`):

```ts
// db/db.ts new settings
const PRIMARY_LANGUAGE_DEFAULT = 'da';  // ISO 639-1
const GESTURE_HINT_DISMISSED_DEFAULT = '0';
```

`primary_language` powers the summary fallback (above) and future report
templates. `gesture_hint_dismissed` is the boolean for the one-time
long-press hint described below.

## Settings screen edits

`app/settings.tsx` gets one new row:

> **Primary language**  [Danish ▾]

Dropdown with 2 options for v1.1: Danish, English. Stored as ISO 639-1
two-letter code (`da`, `en`). Used by:

- Summary backend as a fallback when the dominant language of the day's
  notes cannot be determined (no notes, or text-only notes with no
  detected language).
- Future report templates (post-v1.1).

## Backend changes

### `/transcribe` — return language

The existing route already calls OpenAI Whisper. Whisper's response
object includes a `language` field. Surface it:

```jsonc
// Before
{ "text": "Det går fint i dag." }
// After
{ "text": "Det går fint i dag.", "language": "da" }
```

`backend/app/routes/transcribe.py` change is a one-liner on the response
shape. Mobile reads the new field and stores it on the note row.

### `/summary` — language plumbing

The summary endpoint accepts the list of today's notes for a student and
returns four sections. Add an optional `language` field on the request
body (ISO 639-1). Backend uses it to instruct Claude:

> "Write the response in {language}. Maintain the four-section structure
> regardless."

Mobile computes the dominant language client-side from the notes table
(`SELECT language, COUNT(*) FROM notes WHERE student_id = ? AND
date(created_at) = date('now') GROUP BY language ORDER BY 2 DESC LIMIT 1`)
and passes it. If the query returns no language (all text notes), use
`primary_language` from Settings.

### Error envelope cleanup

Backend currently surfaces upstream errors as a Python dict in the error
message:

```jsonc
{ "error": { "code": "anthropic_error",
             "message": "Error code: 500 - {'type': 'error', ...}" } }
```

Two fixes, both in `backend/app/clients/anthropic.py` (or wherever the
Claude wrapper catches exceptions):

1. **5xx from Anthropic** → return a friendly message:
   "The summary service is having a moment. Try again in a few seconds."
   with the request_id appended for support lookup.
2. **Stop double-encoding the dict.** Use `str(e.message)` only if it's
   already a string; never `repr()`.

Mobile renders only the `error.message` field, never the raw envelope.
Also wrap multi-line errors in scrollable text (current rendering blows
out the layout).

## Error handling

| Failure | Detected when | User-visible behavior |
|---|---|---|
| Mic permission denied | `ensurePermission()` returns false at tap | Snackbar: "Microphone disabled — long-press a tile to type, or enable mic in Settings." No state change. |
| `voice_on` setting is false (Voice-off switch enabled on home) | Home subscribes to `voice_on` setting | Tap on tile opens the text modal directly instead of starting a recording (same destination as long-press). Long-press still works too. |
| `/transcribe` fails (5xx) | response.status >= 500 | Note saved with text "(error transcribing — tap to retry)" and `audio_uri` populated. Toast: "Saved as a draft." |
| `/transcribe` fails (offline) | fetch throws / timeout | Same as 5xx path. |
| Whisper returns empty text | `response.text.trim() === ''` | Note saved with text "(empty recording)"; no `audio_uri`. Toast appears so user can Undo. |
| Recording starts but no audio data (recorder error) | `audioRecorder.prepareToRecordAsync()` throws | Snackbar: "Couldn't start recording. Check microphone permission." Recording state stays `null`. |
| `/summary` fails (5xx) | summary screen catches | Summary screen renders friendly message + retry button. No raw dict. |
| `/summary` fails (timeout) | 60-second client timeout fires | Same as 5xx. |

## Testing strategy

| Test | Type | Location | Why |
|---|---|---|---|
| `useCaptureStore.start` blocks when already recording | unit (jest) | `store/__tests__/useCaptureStore.test.ts` | Single-recording invariant |
| `useCaptureStore.cancel` deletes the audio file | unit (jest, mocked fs) | same | Don't leak files |
| `addNote` accepts the new `language` column | unit | `db/__tests__/db.test.ts` (extend) | Schema migration safety |
| Migration adds `language` + `audio_uri` columns idempotently | unit | `db/__tests__/db.test.ts` (new) | Don't crash on re-run |
| Backend dominant-language query | unit | `db/__tests__/language.test.ts` (new) | Logic for picking summary language |
| `/summary` request includes `language` field | unit | `api/__tests__/summary.test.ts` (extend) | Backend contract |
| `/transcribe` response includes `language` (backend) | pytest | `backend/tests/test_transcribe.py` (extend) | Backend contract |
| Friendly error message for Anthropic 5xx (backend) | pytest | `backend/tests/test_summary.py` (extend) | No raw repr leaking |

Manual / on-device:
- Tap a tile → recording state visible → stop → toast appears → tap Edit → modal opens with transcript.
- Tap → Cancel → no toast, audio file gone (check with `cleanupOrphanRecordings` immediately after).
- Long-press → modal opens → type → tap mic chip → recording bar appears above keyboard → speak → Stop → transcript appended at cursor.
- Settings → change Primary language → Danish-only-text-day → generate summary → response in Danish.
- Voice-off switch on → tap a tile → modal opens directly.
- Disable mic in iOS Settings → tap a tile → snackbar (not crash, not silent).
- Backend offline → tap → record → stop → draft note saved with retry hint.

## Migration / rollout

- `db/db.ts` migration adds `language` + `audio_uri` columns. Existing
  rows have `NULL` for both — backend tolerates this and falls back to
  Settings.
- Existing notes (text only, pre-this-change) summarize in
  `primary_language` (default `da`). No data backfill needed; the
  dominant-language query returns no language → falls back to Settings.
- `primary_language` row inserted with default `da` on first run after
  the migration; teachers can change in Settings.
- The dead "Coming up next" Alert is removed. Anyone who tapped the
  old mic and bookmarked the "Task 14" message will now find a working
  recorder; no docs update needed.

## Discoverability — long-press hint

The one weak spot in the gesture set is that tap = voice and
long-press = text is not visually labeled. Mitigation:

- **Onboarding screen** gains a one-line gesture summary in the
  "Allow microphone" step: "After onboarding, tap a tile to record, or
  hold a tile to type."
- **Inline hint on home** shown once per install: a small italic line
  under the roster ("Tip — hold a tile to type a note instead.") that
  dismisses on first tap, or auto-hides after the teacher opens a text
  modal once. Persisted in Settings as `gesture_hint_dismissed = 1`.

## Files touched (rough list, for plan estimation)

Mobile (~9 files):

```
mobile/app/index.tsx                       (edit — voice-first tile rendering, toast)
mobile/app/note/[studentId].tsx            (edit — wire mic chip, recording bar, swipe dismiss)
mobile/app/settings.tsx                    (edit — primary_language row)
mobile/app/summary.tsx                     (edit — friendlier error render, retry)
mobile/components/StudentTile.tsx          (edit — disabled prop, onLongPress)
mobile/components/RecordingTile.tsx        (new)
mobile/components/RecordingBar.tsx         (new — reusable, used in modal)
mobile/components/ToastUndoEdit.tsx        (new)
mobile/store/useCaptureStore.ts            (new)
mobile/db/db.ts                            (edit — migration, language col, audio_uri col, primary_language setting)
mobile/lib/audio.ts                        (edit — pass through Whisper language; orphan-cleanup respects audio_uri)
mobile/api/transcribe.ts                   (new or edit — typed response with language)
mobile/api/summary.ts                      (edit — accept language param)
```

Backend (~3 files):

```
backend/app/routes/transcribe.py           (edit — return language from Whisper response)
backend/app/routes/summary.py              (edit — accept + use language)
backend/app/clients/anthropic.py           (edit — friendly 5xx wrapping, no raw repr)
```

Tests (~5 files updated/added):

```
mobile/store/__tests__/useCaptureStore.test.ts        (new)
mobile/db/__tests__/db.test.ts                        (extend)
mobile/db/__tests__/language.test.ts                  (new)
mobile/api/__tests__/summary.test.ts                  (extend)
backend/tests/test_transcribe.py                      (extend)
backend/tests/test_summary.py                         (extend)
```

## Open questions for the plan stage (not blocking spec)

- Android swipe-down on modal — does `presentation="modal"` cover it on
  Expo Router for Android, or does the `PanResponder` fallback ship in
  v1.1? Plan will probe.
- Where does the orphan-recording cleanup (`cleanupOrphanRecordings`)
  run now? Currently presumed to be on `_layout.tsx` boot. Plan will
  confirm and update to respect `audio_uri NOT NULL` notes.
- Whisper language codes — confirm OpenAI returns ISO 639-1 (`da`) not
  ISO 639-3 (`dan`). Plan will check Whisper response shape against
  current SDK version.
