# classroom-log — mobile

The Expo SDK 56 phone app. See the [repo root README](../README.md) for the full picture; this file covers mobile-specific commands and layout.

## Run

From this directory (`mobile/`):

```powershell
# First time only
npm install

# Start Metro with the tunnel transport — phone connects via Expo Go
npm start -- --tunnel
```

Scan the QR code with Expo Go on your phone. The backend tunnel (ngrok) must be running separately — see the root README. Set the ngrok URL on the Settings screen in-app.

## Test

```powershell
npm test           # one-shot
npm run test:watch # watch mode
```

24 tests across `db/`, `lib/`, `api/`. Both jest preset and tsconfig are configured for Expo SDK 56 + TypeScript strict.

## Typecheck

```powershell
npm run typecheck   # equivalent to: npx tsc --noEmit
```

## Layout

- `app/` — expo-router file-based routes (`_layout.tsx` provides SQLiteProvider + onboarding gate)
- `components/` — reusable bits (PrimaryButton, StudentTile, NoteRow, StatusPill, DiscardSheet)
- `db/` — SQLite schema, migrations, CRUD. Single owner of all SQL.
- `api/` — backend wrapper (`client.ts` for AbortController + 60s timeout, `summary.ts` for `/summary`)
- `lib/` — theme tokens, date utilities (`localYmd` / `localDayStartMs` / `localDayEndMs`), audio recorder, UUIDs
- `__mocks__/` — jest manual mocks for `expo-sqlite` (better-sqlite3-backed) and `expo-crypto` (node `randomUUID`). Production uses the real native modules; these only load under jest.

## Versioned docs

This project pins Expo SDK 56. **Read the versioned docs at <https://docs.expo.dev/versions/v56.0.0/> before changing native-module imports** — SDK 56 dropped namespaces (`Audio.*` → top-level) and moved several legacy APIs (e.g. `expo-file-system` → `expo-file-system/legacy`). See `AGENTS.md` for the agent-facing version pin.

## Reset

```powershell
npm run reset-project
```

Moves starter scaffolding to `app-example/` and gives you a blank `app/`. You almost certainly don't want this — the project's screens already live in `app/`.
