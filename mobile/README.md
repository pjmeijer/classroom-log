# classroom-log — mobile

The Expo SDK 54 phone app. See the [repo root README](../README.md) for the full picture; this file covers mobile-specific commands and layout.

## Run

From this directory (`mobile/`):

```powershell
# First time only
npm install

# Optional but recommended: copy the env template and set the backend URL
Copy-Item .env.example .env
notepad .env   # paste your backend's https://*.ngrok-free.app URL

# Start Metro with the tunnel transport — phone connects via Expo Go
npm start -- --tunnel
```

Scan the QR code with **App Store Expo Go** on your phone. The backend tunnel (ngrok) must be running separately — see the root README.

## Two tunnels, not one

There are two independent ngrok tunnels in this setup. They confuse easily.

| Tunnel | What it exposes | Run by | URL kind |
| --- | --- | --- | --- |
| **Backend ngrok** | FastAPI on `localhost:8000` | You: `ngrok http 8000` | `https://*.ngrok-free.app` — the app sends `/transcribe`, `/summary`, `/health` here |
| **Metro `--tunnel`** | Metro bundler on `localhost:8081` | Expo via `@expo/ngrok` (bundled, automatic when you pass `--tunnel`) | An ngrok URL Expo opens — Expo Go fetches the JS bundle from it |

Both default to anonymous ngrok subdomains and share its free-tier rate limits.

## Configure the backend URL

The mobile app has two ways to know your backend's address. Pick one.

1. **In-app Settings** (always works) — open Settings (gear icon top right), paste the `https://*.ngrok-free.app` URL into the Server field, tap "Test connection". The app stores it in SQLite. Persists across reloads, doesn't need a rebuild.

2. **`EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`** (build-time default) — handy if you want testers to start with a working URL pre-baked instead of typing it. The Settings screen still overrides this. Expo reads `EXPO_PUBLIC_*` at bundle time, so **restart Metro after changing `.env`**.

`mobile/.env` is gitignored; `mobile/.env.example` is the template.

## Troubleshooting `npm start -- --tunnel`

### `CommandError: ngrok tunnel took too long to connect.`

This is the Metro tunnel (Expo's bundled `@expo/ngrok`) failing the handshake. It's not a missing env var. Try in order:

1. **Retry once or twice.** Flaky.
2. **Drop to LAN mode** if your phone is on the same Wi-Fi as your laptop:
   ```powershell
   npm start            # no --tunnel — defaults to LAN
   # or explicitly:
   npx expo start --lan
   ```
   LAN mode skips ngrok entirely. Faster, more reliable. Only fails if your laptop's firewall blocks port 8081 or you're on different networks.
3. **Raise the rate limit with an ngrok auth token** (free signup at <https://dashboard.ngrok.com/get-started/your-authtoken>):
   ```powershell
   $env:NGROK_AUTHTOKEN="your_token_here"
   npm start -- --tunnel
   ```
   Or persist the token globally:
   ```powershell
   npx @expo/ngrok config add-authtoken your_token_here
   ```

### `Metro waiting on exp://...` but the QR doesn't load on the phone

Same network? Open Wi-Fi settings on the phone — laptop and phone must be on the same SSID for LAN mode. For `--tunnel`, both can be on different networks.

### `React Compiler enabled` log line

Informational, not an error. `reactCompiler` is enabled in `app.json` `experiments`. Leave it unless Metro errors on it (SDK 54 supports it).

## Test

```powershell
npm test           # one-shot
npm run test:watch # watch mode
```

24 tests across `db/`, `lib/`, `api/`. Both jest preset and tsconfig are configured for Expo SDK 54 + TypeScript strict.

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

This project pins **Expo SDK 54** (so the app loads in App Store Expo Go without TestFlight). **Read the versioned docs at <https://docs.expo.dev/versions/v54.0.0/> before changing native-module imports.** See `AGENTS.md` for the agent-facing version pin.

## Reset

```powershell
npm run reset-project
```

Moves starter scaffolding to `app-example/` and gives you a blank `app/`. You almost certainly don't want this — the project's screens already live in `app/`.
