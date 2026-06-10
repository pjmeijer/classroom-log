# Design & implementation archive

**These are historical records, not active work.** Each spec/plan is a dated
snapshot from when a feature was designed and built — kept for the design
rationale, tradeoffs, and explicitly-deferred decisions they capture (and as
context for gbrain search). Everything below has **shipped to `main`**. The
checkbox (`- [ ]`) plans were execution checklists at the time; don't treat
unchecked boxes as outstanding TODOs.

For current setup/run/deploy instructions, see the root [`README.md`](../../README.md).

## Features (newest first)

| Feature | Design spec | Implementation plan | Status |
| --- | --- | --- | --- |
| EAS Build → TestFlight pipeline | [spec](specs/2026-06-04-eas-testflight-pipeline-design.md) | [plan](plans/2026-06-04-eas-testflight-pipeline.md) | Shipped — app in TestFlight |
| Modal mic icon upgrade | [spec](specs/2026-06-04-modal-mic-icon-design.md) | [plan](plans/2026-06-04-modal-mic-icon.md) | Shipped |
| Voice-first capture | [spec](specs/2026-05-29-voice-first-capture-design.md) | [plan](plans/2026-05-29-voice-first-capture.md) | Shipped |
| Expo SDK 56 → 54 downgrade | — | [plan](plans/2026-05-29-sdk-54-downgrade.md) | Shipped |
| Classroom-Log V1 | [spec](specs/2026-05-26-classroom-log-design.md) | [plan](plans/2026-05-26-classroom-log-v1.md) | Shipped |

## Other artifacts

- `brainstorm-visuals/2026-05-29-voice-first-capture/` — HTML mockups of home-screen
  states explored during voice-first design.
- `feedback/2026-05-29-first-device-test.md` — first on-device test notes (pre-voice;
  some details are superseded — e.g. voice is now wired).
- `feedback/2026-06-04-second-device-test.md` — second on-device test notes.

## Notes

- These predate the move to `main` as the single branch; branch names referenced
  inside (e.g. `feat/v1-implementation`, `feat/eas-testflight-pipeline`) are
  historical.
- The privacy policy is **not** archived — it's live: [`docs/privacy-policy.md`](../privacy-policy.md),
  served at `/privacy`.
