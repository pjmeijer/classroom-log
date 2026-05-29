# First on-device test feedback — 2026-05-29

Real-device test on iPhone (App Store Expo Go, Wi-Fi/LAN, Danish keyboard).
SDK 54 downgrade landed and the golden path works:

1. Onboarding → mic permission → settings
2. Add student "Stine", paste backend ngrok URL, test connection
3. Tap tile → modal → type Danish note ("Det går fint i dag.") → save
4. Generate Summary → first attempt 500'd from Anthropic upstream, second attempt rendered four sections

The platform downgrade itself is validated. What follows is product feedback to fold
into the v1.1 work, not a SDK 54 blocker.

## What works

- LAN-mode `npm start` after the package.json script flip.
- Modal opens fast, keyboard appears without lag.
- Generate flow returns four sections (Positives / Concerns / Patterns / Next steps).
- Per-section "Draft — review before sharing" framing reads well.

## What's broken / lies about itself

### Mic button is fake
`mobile/app/note/[studentId].tsx:142` — the big round mic button calls
`Alert.alert('Coming up next', 'Voice recording is wired in Task 14.')`. It does not
record. The small mic chip next to the X is decorative-only. User thought it worked
because iOS keyboard dictation (the "DA" mic on the Danish keyboard) IS functional
at the OS level — but that's system dictation, not our recorder. Fix as part of
Task 14 / voice-first refactor below.

### Anthropic 500 surfaces as raw Python repr
Summary screen renders:
```
anthropic_error: Error code: 500 - {'type': 'error', 'error': {'type': 'api_error', ...
```
That's a stringified Python dict from the backend's exception envelope. Quick win:
backend should map upstream 5xx to a friendlier message; mobile should render the
human field, not the dict.

### Summary language mismatches input language
User typed "Det går fint i dag" (Danish) → got an English summary back. Should
match input language by default. Later add-on: optional translation to a target
language for the parent-facing report (which may need to be in the school's
language, not the teacher's).

## UX feedback — voice-first restructure

User's intuition (worth quoting exactly):
> "It would be much better if the input — at least voice — is combined with the
> first page so that the user doesn't have to get another page and then click out
> of that. I don't know if we can fit the text wiring in there as well on the
> front page. When the keyboard pops up there is hardly any room. So maybe text
> fields can be in a second page, also including the voice. But only voice as
> well on the front page. It should be easy for the user."

Design intent: **voice is the primary capture path; everything else gets out of
the way.** Two-tier:

- **Home (tier 1):** tap student → start recording inline, right there. Tap-to-stop
  or VAD-detected silence. No navigation. Optional path to text mode.
- **Modal (tier 2):** text entry + voice as fallback. Reached only when the user
  explicitly chooses to type or edit.

### Specific frictions to fix

1. **Modal escape.** Only the X dismisses. Add at least one of: swipe-down
   gesture (native iOS modal sheet), tap-outside, swipe-from-left-edge
   system gesture. Pick a primary and document.
2. **Cramped text area when keyboard is up.** Modal becomes nearly unusable
   for longer notes because the keyboard eats most of the screen. Mitigations:
   make modal a near-full-screen sheet with `KeyboardAvoidingView`, hide chrome
   when the keyboard is up, or accept this as a "text is secondary" tradeoff
   if the voice-first refactor lands.
3. **Mic button placement.** Currently bottom-right under the textarea — but
   that's the path the user *shouldn't* need to take. In the new flow the
   primary mic affordance is on the home screen tile.

## Open questions for brainstorm

- Tap-and-hold to record, or tap-to-start / tap-to-stop?
- What does the home tile show while a recording is in progress (waveform,
  timer, the in-progress transcript)?
- If recording fails (no mic permission, no backend, offline), where does the
  error appear without breaking the home grid?
- Does text-mode keep its own route, or fold into a bottom-sheet over home?
- How does editing an existing note work in a voice-first home? (Modal stays
  for edit?)
- Language matching: detect from transcript text (Whisper returns the detected
  language) and pass to Claude as a system instruction, or always pass the
  Settings-screen "primary language" preference?

## Distribution / tunnel issue (track for later)

Expo's `--tunnel` mode (Metro exposed via `@expo/ngrok`) is globally
rate-limited because `@expo/cli` hardcodes a SHARED ngrok auth token in
`AsyncNgrok.js` (line 96 of `node_modules/expo/node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js`).
There is no env-var override (`NGROK_AUTHTOKEN` is ignored; only
`EXPO_TUNNEL_SUBDOMAIN` is honored, and that's just for naming).

For local dev this is fine — LAN mode (`npm start`, default after the
script flip) skips ngrok entirely. **The problem appears for testers who
are not on the same Wi-Fi as the laptop** (off-site teachers, remote
demos, cellular). When they try to scan a tunnel QR, Metro times out
under the shared-token rate limit.

Options to evaluate before scaling beyond local-only testing:

1. **Dev build via EAS** — skip Expo Go entirely, distribute via TestFlight
   / Internal App Sharing. Requires Apple Developer Program ($99/yr) and
   either EAS Build (free tier exists) or local Xcode. Standard answer
   for "I have testers."
2. **Self-host the tunnel** — `--tunnel` accepts `EXPO_TUNNEL_SUBDOMAIN`
   for naming, but the auth is still Expo's shared token. Could fork
   `@expo/cli` locally and patch the token, but that's brittle.
3. **Paid ngrok + manual setup** — run `ngrok http 8081` separately,
   point testers at the resulting URL (similar pattern to the backend
   tunnel). Works for one tester at a time per token.
4. **Switch tunnel transport entirely** — `@expo/ws-tunnel` exists in
   the codebase but is currently only auto-selected when
   `envIsWebcontainer()` is true. Worth checking if Expo has a flag to
   force it on Windows native.

Decision is post-v1. For now, the on-Wi-Fi tester path works.

## Source-of-truth references

- Existing modal route: `mobile/app/note/[studentId].tsx`
- Audio wrapper (already wired, just not called from the modal):
  `mobile/lib/audio.ts` — `ensurePermission`, `useRecorder`, `startRecording`,
  `stopRecording`, `cleanupOrphanRecordings`
- Backend transcribe route: `backend/app/routes/transcribe.py` (Whisper)
- Backend summary route: `backend/app/routes/summary.py` (Claude)
- V1 plan that named Task 14 (voice wiring): `docs/superpowers/plans/2026-05-26-classroom-log-v1.md`
