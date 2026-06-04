# Second on-device test feedback — 2026-06-04

Real-device test on iPhone (dev build via Metro `npm start --clear`, Wi-Fi/LAN,
Danish keyboard, backend on Windows uvicorn at LAN IP). Branch
`feat/voice-first-capture` at HEAD `1905d67` plus the post-smoke fixes documented
below.

This is the smoke test deferred from the 2026-05-29 session, after Tasks 10–22
landed but before the FF-merge to `feat/v1-implementation`. Three bugs surfaced;
all three were root-caused and fixed inline this session.

## What works

- Cold-start → onboarding → mic permission → roster appears.
- Tap a student tile → red `RecordingTile` spans both columns; other tiles
  dim; generate FAB dims; voice-switch dims. (After the iOS audio-session
  fix below — initially this broke.)
- Stop & gem flow, 5s toast, Fortryd, Annuller all behave correctly.
- Long-press → modal opens with native iOS sheet presentation.
- Voice-to-text round-trip works end-to-end. Transcribed Danish ("Eleven var
  rolig i timen") appears in the note within ~2s of Stop.

## What was broken

### 1. RecordingTile flashed and immediately disappeared on tile tap

**Symptom.** Tap a student tile → red `RecordingTile` appears for ~50ms
→ disappears. No note saved. No visible error.

**Root cause.** `mobile/app/index.tsx:61-66` silently swallowed the error from
`startRecording`. The actual exception was:

```
RecordingDisabledException: Recording not allowed on iOS.
Enable with Audio.setAudioModeAsync
(at ExpoAudio/AudioRecorder.swift:104)
```

`mobile/lib/audio.ts startRecording` called `rec.prepareToRecordAsync()`
without first activating the iOS audio session via
`AudioModule.setAudioModeAsync({ allowsRecording: true })`. expo-audio SDK 54
on iOS refuses to start recording if the AVAudioSession isn't in a
recording-capable mode. The test file (`lib/__tests__/audio.test.ts:11`) had
been mocking `setAudioModeAsync` since SDK 54 — strong signal someone planned
the call and never wired it in production.

**Fix.** Added at the top of `startRecording`:

```ts
await AudioModule.setAudioModeAsync({
  allowsRecording: true,
  playsInSilentMode: true,
});
```

`playsInSilentMode: true` was added defensively — without it, an iPhone with
the physical silent switch flipped can refuse to activate the audio session
even when `allowsRecording` is set.

**Test coverage.** New jest test
`audio.startRecording › calls setAudioModeAsync({ allowsRecording: true })
before prepareToRecordAsync` enforces both the presence AND the call order
(setAudioMode must precede prepareToRecord — out of order and iOS still
throws). Uses `mock.invocationCallOrder` to assert order without flakiness.

**Lesson.** The original catch block was silent-recovery by design — but
silent recovery hides root-cause information at exactly the wrong moment
(first on-device run of a new audio path). For future audio work, the
silent-catch pattern should be paired with at least a `console.error` so
Metro logs show the failure, even if the user-facing UX stays graceful.
Not changing the existing handler for now (Danish copy + UX decision
required), but flagging for the post-smoke P2 backlog.

### 2. Save button hidden behind keyboard in note modal

**Symptom.** Tap a student tile to open the text-edit modal (or long-press to
go directly), tap inside the text field, keyboard slides up. The "Gem" save
button is hidden under the keyboard.

**First attempt (insufficient).** Swapped the wrapping order in
`mobile/app/note/[studentId].tsx` so `KeyboardAvoidingView` lives outside
`SafeAreaView` (the documented Expo Router native-modal pattern). User
retested: keyboard still obscured the button.

**Root cause (with new information).** In expo-router's
`presentation: 'modal'` (iOS native sheet), the keyboard frame is
reported in *screen* coordinates but `KeyboardAvoidingView` computes
its avoidance from inside the modal's frame. The two coordinate spaces
don't agree, so `behavior="padding"` always shifts by the wrong amount.
This is a known RN + iOS-modal-sheet limitation; the bare KAV cannot
fix it from JS alone without native bridging.

**Final fix.** Replaced KAV with a manual `Keyboard.addListener` pattern.
The modal subscribes to `keyboardWillShow` / `keyboardWillHide` (iOS) /
`keyboardDidShow`/`keyboardDidHide` (Android), tracks the keyboard
height in component state, and applies it as `paddingBottom` on a
wrapper around the modal content. When the keyboard opens, the wrapper
shrinks by `keyboardHeight`, the `flex:1` textarea compresses, and the
save button — which sits at the bottom of the wrapper — moves up above
the keyboard.

No new tests (keyboard-event timing is OS-level; verified on device).

### 3. Whisper transcription accuracy was inconsistent and worse from the modal mic chip

**Symptom.** Recording from a home-screen tile → reliably accurate Danish
transcription. Recording from inside the note modal → noticeably worse, with
visible language-detection mistakes (Whisper occasionally tagged audio as a
non-Danish language).

**Why the entry point seemed to matter (it doesn't, intrinsically).** Both
entry points call the same `startRecording(recorder)` from `lib/audio.ts`
with the same `RecordingPresets.HIGH_QUALITY` config, then upload the same
audio file via the same `fetchTranscript` to the same backend endpoint. The
recorded audio is identical in quality regardless of entry point. The
*perceived* difference came from two confounds:

1. Whisper's auto-language-detect is variance-heavy on short or quiet clips.
   In-modal recordings tend to be shorter (the user is mid-text-edit,
   capturing a sentence-level addition) while home-tile recordings tend to
   be longer (full observation). Shorter clip → less detection signal →
   more wrong-language outcomes.
2. Whisper's response uses the detected language to bias the decoded
   transcript. When detection is wrong, the transcript quality collapses
   (it's effectively decoding Danish phonemes through a non-Danish prior).

**Decision: pin `language='da'` on every Whisper request.**

This is a Danish-only product. The mobile UI copy is Danish, the backend
`SYSTEM_PROMPT` is locked to Danish third-person, and the user persona is
Danish-speaking special-education teachers. There is no legitimate reason
to let Whisper guess — and pinning the language hint (per the OpenAI Whisper
docs: "Supplying the input language in ISO-639-1 format will improve accuracy
and latency") eliminates the entire failure mode.

**Fix.** `backend/app/clients/openai_client.py`'s `transcribe_audio`
unconditionally passes `language='da'` to `client.audio.transcriptions.create`.
Mobile contract unchanged — no wire format change, no new request field.

**Test coverage.** New pytest
`test_transcribe_pins_danish_language_hint_to_whisper` patches the OpenAI
SDK and asserts the call kwargs include `language='da'`. RED-verified
against the pre-fix code (failed with `language=None`).

**Reversibility / future multi-language.** If a future product requirement
demands non-Danish recording, this is a one-line change to accept an
optional `language` parameter through the route (`backend/app/routes/
transcribe.py`) and forward to `transcribe_audio`. Mobile would then pass
the user's preferred language from a settings entry. Not building that
infrastructure now (YAGNI — the product is Danish-only and there's no
near-term plan to change).

## Status at end of session

- Mobile: jest 12 suites / 60 tests passing, tsc clean.
- Backend: pytest 17 tests passing (was 16; +1 for the language-pin test).
- Three commits ready to land on `feat/voice-first-capture` once the user
  confirms a final on-device pass with all three fixes in place.

## Path references

- Mobile audio wrapper: `mobile/lib/audio.ts`
- Mobile audio test: `mobile/lib/__tests__/audio.test.ts`
- Mobile home screen: `mobile/app/index.tsx`
- Mobile note modal: `mobile/app/note/[studentId].tsx`
- Backend transcribe route: `backend/app/routes/transcribe.py`
- Backend OpenAI client: `backend/app/clients/openai_client.py`
- Backend transcribe test: `backend/tests/test_transcribe.py`
- Prior session checkpoint:
  `~/.gstack/projects/pjmeijer-classroom-log/checkpoints/20260529-201649-voice-first-tasks-10-22-complete-ready-for-on-device-smoke.md`
