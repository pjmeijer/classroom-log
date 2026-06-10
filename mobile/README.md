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

# Start Metro on the local network (default — phone + laptop on same Wi-Fi)
npm start

# Or, if your phone is on cellular / a different network from the laptop:
npm run start:tunnel
```

Scan the QR code with **App Store Expo Go** on your phone. The backend tunnel (ngrok) must be running separately — see the root README.

> **Building for TestFlight?** The `npm start` flow above is for local
> development against an ngrok backend. For the cloud build + TestFlight
> distribution (EAS Build, pointing at the Railway backend), see
> [Production & distribution](../README.md#production--distribution) in the
> root README.

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

## Troubleshooting `npm run start:tunnel`

### `CommandError: ngrok tunnel took too long to connect.`

Expo's `--tunnel` uses `@expo/ngrok` with a **shared, hardcoded auth token** baked into `@expo/cli` itself (see `AsyncNgrok.js`). Every Expo user on `--tunnel` worldwide hits the same token, so it gets rate-limited and times out under load. You **cannot** override it — `NGROK_AUTHTOKEN` in `.env` or shell env has no effect; only `EXPO_TUNNEL_SUBDOMAIN` is read by Expo CLI, and that's just for custom subdomain naming.

Real options:

1. **Use LAN — that's what `npm start` already does.** Metro listens at `exp://192.168.x.x:8081`; phone + laptop must share Wi-Fi. No ngrok, no rate limit, much faster. If Windows Defender prompts on first start, allow Node.js on Private networks.

2. **Retry `npm run start:tunnel`** if you genuinely need it (testing on a phone on cellular while your laptop is on Wi-Fi). The shared token recovers within a minute or so most days.

3. **Use a dev build** instead of Expo Go. The long-term answer if you ship to testers via TestFlight / Internal App Sharing — skips Expo Go's tunnel entirely. Out of scope for v1.

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
