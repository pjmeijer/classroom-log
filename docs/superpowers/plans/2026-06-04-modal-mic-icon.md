# Modal Mic Icon Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 🎙 emoji in the note-modal mic chip with an outlined Feather.mic vector icon and tighten the enabled/disabled visual state via icon color.

**Architecture:** Add `@expo/vector-icons` (Expo-blessed font-asset package, no native build). Touch a single JSX node in `mobile/app/note/[studentId].tsx`. No tests added — pure visual swap verified by on-device smoke.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, `@expo/vector-icons` (new dep), existing theme tokens from `mobile/lib/theme.ts`.

**Spec:** `docs/superpowers/specs/2026-06-04-modal-mic-icon-design.md`

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `mobile/package.json` | Modify | Add `@expo/vector-icons` dep at the SDK-pinned version |
| `mobile/package-lock.json` | Modify (auto) | Lockfile updated by `expo install` |
| `mobile/app/note/[studentId].tsx` | Modify | Swap the mic chip's emoji `<Text>` node for `<Feather name="mic" ... />` with dynamic color |

No other files touched. Spec §"Out of scope" is binding — do NOT extend to home-tile icons, the gear/close glyphs, or repositioning the chip.

---

## Task 1: Install `@expo/vector-icons`

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/package-lock.json` (auto)

- [ ] **Step 1: Install via the Expo CLI (auto-pins to SDK 54 compatible version)**

Run from `mobile/`:

```bash
npx expo install @expo/vector-icons
```

Expected output (version string may differ slightly — accept whatever Expo's compat matrix picks for SDK 54):

```
✔ Found compatible version: @expo/vector-icons@^15.0.x
✔ Installed
```

- [ ] **Step 2: Verify the dep landed in `mobile/package.json`**

Run:

```bash
grep '"@expo/vector-icons"' mobile/package.json
```

Expected: one line, e.g. `    "@expo/vector-icons": "^15.0.0",` (version may vary).

- [ ] **Step 3: Smoke-import the icon set to confirm typings resolve**

Run from `mobile/`:

```bash
npx tsc --noEmit
```

Expected: exit 0, no errors. (The dep isn't used yet but its types should still load cleanly.)

- [ ] **Step 4: Commit**

```bash
cd /workspace
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): add @expo/vector-icons for the modal mic icon swap"
```

---

## Task 2: Swap the emoji for `Feather.mic` with dynamic color

**Files:**
- Modify: `mobile/app/note/[studentId].tsx`

The file currently has, at the mic-chip JSX (around line 236 inside the `<Pressable style={[styles.micToggle, ...]}>` block):

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={copy.recording}
  disabled={!micAllowed}
  onPress={handleMicTap}
  style={[styles.micToggle, { backgroundColor: micAllowed ? colors.accentSoft : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
>
  <Text style={{ fontSize: 14 }}>🎙</Text>
</Pressable>
```

- [ ] **Step 1: Add the `Feather` import at the top of the file**

In `mobile/app/note/[studentId].tsx`, add this import alongside the existing imports (after the `expo-router` import, before the local imports — placement doesn't affect behavior, this is the conventional grouping):

```tsx
import { Feather } from '@expo/vector-icons';
```

- [ ] **Step 2: Replace the emoji `<Text>` node with a `<Feather>` component**

In the same file, find the `<Text style={{ fontSize: 14 }}>🎙</Text>` inside the mic-chip `<Pressable>`. Replace it with:

```tsx
<Feather
  name="mic"
  size={20}
  color={micAllowed ? colors.accent : colors.inkMuted}
/>
```

This drops the inline `fontSize` (irrelevant for vector icons), bumps the visible size from ~14px to 20px in the existing 36×36 chip, and binds the icon color to the same `micAllowed` predicate the chip background uses — so enabled = terracotta accent on warm soft background, disabled = muted ink on neutral surface.

DO NOT remove or rename the surrounding `<Pressable>`, its `accessibilityLabel`, the `styles.micToggle`, the background-color logic, or the outer `opacity: 0.5` when disabled. Those all stay exactly as they are — only the inner `<Text>` line changes.

- [ ] **Step 3: Verify type-check passes**

Run from `mobile/`:

```bash
npx tsc --noEmit
```

Expected: exit 0, no errors. `Feather`'s `name` prop is a literal-union type; "mic" is a valid member.

- [ ] **Step 4: Run the full jest suite — no regression**

Run from `mobile/`:

```bash
npx jest
```

Expected: `Test Suites: 11 passed, 11 total` and `Tests: 60 passed, 60 total`. (No tests touch this JSX node; the suite is run as a safety net for any unintended import-graph changes.)

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add mobile/app/note/\[studentId\].tsx
git commit -m "feat(mobile): swap modal mic emoji for outlined Feather icon

Replace the 🎙 emoji in the note-modal header mic chip with
<Feather name=\"mic\" size={20} />. Icon color now flips between
colors.accent (enabled) and colors.inkMuted (disabled) so the
mic's state is legible from the icon itself, not just the chip
opacity. Chip size, shape, and position unchanged.

See docs/superpowers/specs/2026-06-04-modal-mic-icon-design.md
for the design rationale."
```

---

## Task 3: On-device verification

**Files:** none modified — this is a manual smoke step.

- [ ] **Step 1: Ensure Metro has the new dep loaded**

If Metro is already running, it may need a cache clear to pick up the new font asset from `@expo/vector-icons`. From `mobile/` on the dev machine:

```bash
npm start --clear
```

(Reuse the existing terminal if one is running and the bundle is already current — `--clear` is only needed if the icon renders as a blank box or a missing-font glyph on the device, which signals a stale Metro asset cache.)

- [ ] **Step 2: Reload the app on the device**

Fully kill and relaunch the Classroom Log app on the iPhone (swipe up in app switcher, swipe the app away, relaunch from home screen). This ensures the new font asset is bundled into the JS bundle the device pulls.

- [ ] **Step 3: Visual check — enabled state**

On the home screen: tap any student tile to start a recording, then immediately tap **Annuller** to cancel. Then long-press the same tile to open the modal in create-new mode.

Look at the top-right of the modal header. Expected:

- The mic icon is a clean outlined microphone glyph (not a colorful emoji).
- The icon color is terracotta (`colors.accent`, the same color as the FAB).
- The icon sits inside the same rounded warm-soft (`colors.accentSoft`) background chip as before.
- The icon is visibly larger than the previous emoji (20px vs ~14).

- [ ] **Step 4: Visual check — disabled state**

In Settings (gear icon, top-right of home), toggle "Lyd fra" (voice off) ON. Return to the home screen, long-press a student tile to open the modal.

Expected:

- The mic icon is muted ink color (`colors.inkMuted`), not terracotta.
- The chip background is the neutral `colors.surface2`, not warm-soft.
- The whole chip is at 50% opacity.
- Tapping the chip does nothing.

Toggle "Lyd fra" back OFF before moving on, so the rest of the smoke flow uses the recording-enabled path.

- [ ] **Step 5: Visual check — recording-in-this-modal state**

Open a modal (long-press a tile). Tap the (now-vector) mic icon. The RecordingBar slides up above the keyboard, and the mic chip in the header dims (recording is in progress; the chip is no longer the way to start another one).

Expected:

- During recording the chip uses the disabled visual (muted-ink icon, surface2 background, 50% opacity).
- Tapping the dim chip does nothing.
- Stop & gem on the RecordingBar appends transcript at cursor and the chip returns to the enabled visual.

- [ ] **Step 6: Report back**

If all three states look right, this work is done — the existing branch HEAD now includes Tasks 1+2 commits and the spec.

If any state looks wrong (icon misrendered, color wrong, blank-box where icon should be), report what you see and we triage. Most likely cause for "blank box" is Metro asset cache — see Step 1.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Plan task |
|---|---|
| Add `@expo/vector-icons` dep via `expo install` | Task 1 |
| Replace `<Text>🎙</Text>` with `<Feather name="mic" size={20} />` | Task 2 Step 2 |
| Icon color flips on `micAllowed` (`colors.accent` / `colors.inkMuted`) | Task 2 Step 2 |
| Keep chip background / size / opacity logic unchanged | Task 2 Step 2 (explicit DO NOT) |
| Keep position unchanged | Task 2 Step 2 (only inner Text replaced) |
| `accessibilityLabel` preserved | Task 2 Step 2 (explicit DO NOT touch the Pressable) |
| No new tests | Task 2 has no test step; Task 3 covers on-device |
| Out-of-scope items (home tile, gear, ✕, repositioning) | Stated in File Structure section |

All spec sections map to a task.

**Placeholder scan:** No "TBD", "TODO", "Similar to Task N", or "add appropriate error handling". Every code step has the full code shown.

**Type consistency:** `Feather` (from `@expo/vector-icons`), `name="mic"`, `micAllowed` (existing var), `colors.accent` / `colors.inkMuted` (existing tokens) — all consistent and resolvable.

**Scope check:** Three tasks, single file changes in Task 2, on-device manual smoke in Task 3. Bounded.
