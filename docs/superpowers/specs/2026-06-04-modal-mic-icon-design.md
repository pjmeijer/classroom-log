# Modal mic icon upgrade — design

**Date:** 2026-06-04
**Branch:** `feat/voice-first-capture`
**Type:** Visual polish (UI dependency swap, no functional change)

## Context

The note text-edit modal (`mobile/app/note/[studentId].tsx`) shows a small
mic chip at the top right of the header (between the student name and the
close ✕). Tapping it starts an in-modal voice recording that appends a
transcribed Danish phrase at the cursor — the secondary voice-capture path,
complementing the primary home-tile tap-to-record flow.

The chip currently renders the 🎙 emoji at 14pt inside a 36×36 rounded
container. Two problems with the current visual:

1. **Inconsistent with the rest of the chrome.** On iOS the 🎙 emoji
   renders as a colorful multi-tone glyph, sitting jarringly next to the
   monochrome ✕ close icon. It reads as decorative rather than tappable.
2. **State is illegible.** The chip greys out via `opacity: 0.5` when
   disabled (voice off, student opt-out, or recording in progress
   elsewhere), but the icon itself doesn't change. A user has to know
   the system to interpret the state.

The mic in this modal is intentionally a secondary action — the voice-first
plan (Task 14 series) designates home-tile tap-to-record as the primary
voice path, and the modal mic is "I'm typing and want to dictate a
portion." So the goal here is visual hygiene, not promotion to a more
prominent placement.

## Decision

Replace the 🎙 emoji with an outlined vector mic icon from
`@expo/vector-icons` (Expo-blessed package, font-asset only, no native
build). Keep the chip's size, shape, and position. Tighten the
enabled / disabled visual state via icon color so it's legible without
relying on opacity alone.

### Specifics

- **Dependency:** add `@expo/vector-icons` via `npx expo install
  @expo/vector-icons` (auto-pins to the SDK-compatible version).
- **Icon:** `Feather.mic`. Outlined single-weight set, matches the
  Source Sans body font and the warm-paper palette better than the
  filled alternatives (Ionicons.mic is filled and heavy;
  MaterialCommunityIcons looks too Android).
- **Render:** `<Feather name="mic" size={20} color={iconColor} />`
  - `iconColor = micAllowed ? colors.accent : colors.inkMuted`
  - When recording is in progress in this modal, the chip is already
    disabled via existing logic (`micAllowed` becomes false), so no
    extra state needed.
- **Chip background and size:** unchanged. 36×36 rounded, background
  `colors.accentSoft` when enabled, `colors.surface2` when disabled
  (existing logic). Outer `opacity: 0.5` when disabled stays.
- **Position:** unchanged. Header right, to the left of the close ✕.
- **Accessibility:** `accessibilityLabel={copy.recording}` unchanged.
  The icon is decorative — the label provides the screen-reader text.

## Files touched

- `mobile/package.json` — add `@expo/vector-icons` (via `expo install`).
- `mobile/app/note/[studentId].tsx` — import `Feather`, replace the
  `<Text>🎙</Text>` JSX, swap icon color for `colors.accent` /
  `colors.inkMuted`.

No other files. Specifically NOT touched:

- `mobile/app/index.tsx` — home-tile recording flow stays as designed.
- `mobile/components/RecordingTile.tsx` — the in-progress recording
  visual is its own concern.
- `mobile/components/RecordingBar.tsx` — the in-modal stop bar is its
  own concern.

## Testing strategy

- **No new automated tests.** The change is a pure visual swap; no logic
  is added or moved.
- **Existing tests still pass.** Component tests don't snapshot the
  modal's icon; jest suite remains 60/60.
- **tsc clean** — `Feather` is typed by `@expo/vector-icons`.
- **On-device verification:** user inspects the modal mic chip on
  iPhone. Checks: (a) icon renders as outlined mic, not emoji; (b)
  enabled state shows terracotta-accent color on warm-soft background;
  (c) disabled state shows muted-ink on neutral background; (d) tap
  still starts a recording.

## Out of scope

The following were considered and explicitly deferred:

- **Repositioning the mic chip.** Moving it into the textarea or below
  it (floating button, primary-action bar) conflicts with the voice-
  first plan's "modal is secondary" design intent. Revisit only if user
  research surfaces discoverability problems.
- **Recording-state indicator on the mic chip.** A pulsing red dot or
  waveform inside the chip would communicate "live recording" — but
  the `RecordingBar` already serves that purpose at the bottom of the
  modal. Don't double up.
- **Home-tile icon upgrade.** The home recording flow doesn't use a
  mic icon (the whole tile becomes the recording surface). Out of
  scope.

## Reversibility

Single-commit revert restores the emoji. The dependency add is harmless
to leave even if reverted — `@expo/vector-icons` is broadly useful and
likely to be needed elsewhere.

## Cross-references

- Voice-first plan: `docs/superpowers/plans/2026-05-29-voice-first-capture.md`
- First device test feedback (original mic chip note):
  `docs/superpowers/feedback/2026-05-29-first-device-test.md`
- Second device test feedback (this session):
  `docs/superpowers/feedback/2026-06-04-second-device-test.md`
