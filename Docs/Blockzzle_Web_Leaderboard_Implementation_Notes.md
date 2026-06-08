# Blockzzle Web Anonymous Leaderboard MVP Notes

Date: 2026-06-08

This document describes the first real Blockzzle anonymous leaderboard MVP. It is not a production-secure leaderboard yet. It is a lightweight Pages Functions + D1 implementation designed to give players real score motivation without login, email, accounts, fake rankings, or external backend services.

## Scope

- Today Top 100
- All-Time Top 100
- Nickname-only score submission after game over
- Browser-generated anonymous player id stored locally
- Score, lines, best clear, score tier, duration, board version, client version
- No login, email, password, account, ads, analytics, monetization, or mobile app CTA
- No fake scores or fake player names

## Files

- `functions/api/leaderboard/index.js`
  - `GET /api/leaderboard?scope=today`
  - `GET /api/leaderboard?scope=alltime`
- `functions/api/leaderboard/submit.js`
  - `POST /api/leaderboard/submit`
- `functions/api/leaderboard/_shared.js`
  - shared JSON, validation, public-entry helpers
- `migrations/0001_create_blockzzle_leaderboard.sql`
  - D1 schema and indexes
- `wrangler.example.toml`
  - example D1 binding configuration only

## D1 Setup

Create a D1 database manually from the Cloudflare account or with Wrangler:

```bash
npx wrangler d1 create blockzzle_leaderboard
```

Apply the migration:

```bash
npx wrangler d1 migrations apply blockzzle_leaderboard
```

Bind the database to Cloudflare Pages Functions with binding name:

```text
DB
```

The active Cloudflare Pages project must expose this binding to Pages Functions. This repo intentionally includes `wrangler.example.toml` instead of changing live Cloudflare project settings directly.

## Schema

Table: `blockzzle_scores`

- `id TEXT PRIMARY KEY`
- `nickname TEXT NOT NULL`
- `score INTEGER NOT NULL`
- `lines INTEGER NOT NULL`
- `best_clear INTEGER NOT NULL`
- `tier TEXT NOT NULL`
- `duration_seconds INTEGER`
- `board_version TEXT`
- `client_version TEXT`
- `browser_player_id TEXT`
- `day_key TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `rejected INTEGER NOT NULL DEFAULT 0`

Indexes:

- `(day_key, score DESC, created_at ASC)`
- `(score DESC, created_at ASC)`
- `(created_at)`
- `(browser_player_id, created_at)`

## API

### `GET /api/leaderboard?scope=today`

Returns up to 100 public entries for the current server day key.

### `GET /api/leaderboard?scope=alltime`

Returns up to 100 public entries across all submitted scores.

### `POST /api/leaderboard/submit`

Accepts:

```json
{
  "nickname": "Player",
  "score": 12345,
  "lines": 30,
  "best_clear": 4,
  "tier": "Master",
  "duration_seconds": 300,
  "client_version": "v023",
  "browser_player_id": "bz_..."
}
```

Returns the submitted public entry plus today and all-time rank among actual submitted scores.

## Missing Binding Fallback

If the `DB` binding is missing, the API returns HTTP 503 JSON:

```json
{
  "ok": false,
  "error": "leaderboard_unavailable",
  "message": "Leaderboard is coming soon."
}
```

The frontend keeps gameplay and local stats working and shows an unavailable or coming-soon message.

## Validation And Abuse Limits

Current MVP checks:

- Nickname must be 2-16 characters after trim
- Nickname may use letters, numbers, spaces, underscore, and hyphen
- Tiny reserved-name blocklist: `admin`, `moderator`, `support`, `staff`, `owner`, `badword`
- Score must be an integer from 0 to 1,000,000
- Lines must be an integer from 0 to 10,000
- Best clear must be an integer from 0 to 16
- Tier must match a known local score tier
- Duration must be an integer if provided
- Duration must be at least 5 seconds for non-zero scores
- Reject score above 3,000 when duration is below 10 seconds
- Reject score above 15,000 when duration is below 30 seconds
- Client version must be 20 characters or fewer
- Browser player id must be 80 characters or fewer
- Maximum 50 accepted submissions per browser player id per day
- Maximum 10 accepted submissions per nickname per day when browser player id is missing
- Basic burst limit for repeated browser-player submissions
- Public Today and All-Time leaderboard queries show the best score per browser player id per scope to reduce duplicate clutter
- Public leaderboard queries always filter `rejected = 0`

Limitations:

- Client-reported scores can still be manipulated.
- The browser player id is not identity proof.
- Nickname moderation is minimal.
- Top scores may require manual review.
- The MVP limits reduce obvious spam and impossible submissions, but they are not production-grade anti-cheat.
- Future production hardening should add Daily Challenge seed verification, move-log or score-event validation, stronger abuse review tools, an admin delete/moderation flow, and rate limiting tied to Cloudflare platform signals.

## Privacy

- No email
- No account
- No password
- No login
- Nickname only
- Local browser player id only
- Public leaderboard responses do not expose `browser_player_id`
- IP addresses are not stored by this implementation

Before public launch of the backend leaderboard, update the privacy page to explain nickname submissions and the local anonymous browser id.

## Frontend Flow

1. Player finishes a game.
2. Game-over panel still shows local stats first.
3. Player taps `Submit Score`.
4. Browser asks for a nickname.
5. Client validates the nickname and score payload.
6. Server validates again and stores the submitted score if D1 is available.
7. Today and All-Time lists refresh from real submitted data.

Submission is never automatic.

## Rollback Plan

- Deploy the previous commit if the leaderboard causes unexpected problems.
- Or point `/play/` back to the previous versioned assets in `static/play/index.html`.
- Keep D1 data intact unless there is a specific privacy or abuse reason to remove it.
- If the backend binding is removed, the frontend safely falls back to unavailable copy.

## Deployment Checklist

- Create D1 database.
- Apply `migrations/0001_create_blockzzle_leaderboard.sql`.
- Add Pages Functions binding `DB`.
- Deploy Hugo + Pages Functions.
- Verify:
  - `/api/leaderboard?scope=today`
  - `/api/leaderboard?scope=alltime`
  - `/api/leaderboard/submit`
  - `/leaderboard/`
  - `/play/` game-over score submission
- Confirm no fake scores appear.
- Confirm local stats still work if the API is unavailable.
