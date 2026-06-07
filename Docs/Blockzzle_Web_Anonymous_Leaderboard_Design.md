# Blockzzle Web Anonymous Leaderboard Design

Status: planning only. This document does not implement a backend, change gameplay, or change Cloudflare/domain settings.

## Purpose

Blockzzle Web needs repeat-play motivation beyond local high score. The first leaderboard should feel honest, lightweight, and safe:

- Give players a reason to keep improving after a run ends.
- Avoid fake rankings or any wording that implies global data before a real backend exists.
- Keep the first version anonymous, browser-friendly, and free of login requirements.
- Preserve the current Classic game as the main `/play/` experience.

## Recommended First Version

The recommended MVP is an anonymous score submission flow shown after game over:

- `Today Top 100`
- `All-Time Top 100`
- Nickname input after game over
- Submitted fields: score, lines, best clear, and score tier
- Optional browser-generated player id stored locally
- No login, email, account, password, profile, or social sign-in

Public copy should use wording like `Anonymous leaderboard`, `Today Top 100`, and `All-Time Top 100`. Do not use `World Rank`, `global rank`, or numbered rank claims unless backed by actual queried leaderboard rows.

## Data Fields

Suggested score entry fields:

| Field | Purpose |
| --- | --- |
| `id` | Server-generated unique score entry id. |
| `nickname` | Player-provided display name, length-limited and moderated. |
| `score` | Final score from the completed game. |
| `lines` | Total lines cleared in the completed game. |
| `best_clear` | Largest simultaneous line clear in that run. |
| `tier` | Score tier label at game over. |
| `duration_seconds` | Time from run start to game over. |
| `board_version` | Gameplay/scoring rule version, for future compatibility. |
| `client_version` | Web asset/game client version, such as `v022`. |
| `created_at` | Server timestamp for submission. |
| `day_key` | Server-derived day key for Today Top 100. |
| `browser_player_id` | Local anonymous browser id, not an account. |

Server timestamps and server-derived day keys should be preferred over trusting client clock for ranking windows.

## Anti-Cheat And Sanity Checks

The first version should be clear that it is lightweight, but it still needs basic abuse controls before any public leaderboard is shown:

- Reject impossible score values.
- Reject runs with unrealistically short `duration_seconds`.
- Reject invalid score/lines/best-clear relationships based on known scoring rules.
- Reject missing or unsupported `board_version` / `client_version`.
- Rate limit submissions by IP and `browser_player_id`.
- Limit nickname length.
- Normalize nickname whitespace.
- Add a profanity/blocklist moderation pass for nicknames.
- Reserve the right to hide or delete abusive entries.
- Mark top scores as reviewable manually before making them prominent.

Client-side checks can improve UX, but server-side checks must be authoritative.

## Privacy

The MVP should collect the minimum data needed to show an anonymous leaderboard:

- No email.
- No account.
- No login.
- No real name requirement.
- Nickname only for public display.
- Browser-generated local player id for rate limiting and repeat submissions.
- Explain the leaderboard data in the privacy page before launch.
- Make clear that submitted leaderboard entries are public.

The browser player id should be random, local, and resettable by clearing browser data. It should not be positioned as an account.

## Backend Options

### Cloudflare Workers + D1

Pros:

- Natural fit for a Cloudflare Pages-hosted static Hugo site.
- Small serverless API surface for submit/read endpoints.
- D1 is enough for Top 100 queries and moderation flags.
- Keeps hosting and backend in one platform.
- Good path for rate limiting with Cloudflare platform features.

Cons:

- Requires schema, migrations, deployment process, and operational discipline.
- D1 SQL and Workers code need careful versioning and rollback notes.
- More custom implementation than a turnkey backend product.

### Supabase

Pros:

- Fast to model tables and query leaderboard rows.
- Built-in dashboard and Postgres features.
- Could add moderation/admin workflows quickly.

Cons:

- Adds a separate hosted backend vendor outside the current Cloudflare Pages flow.
- Easy to accidentally expand into auth/account features before they are needed.
- Requires API key and policy handling that may be heavier than the first MVP.

### Firebase

Pros:

- Familiar realtime database/document patterns.
- Simple client SDK path for basic reads/writes.

Cons:

- Adds a larger client/backend dependency surface.
- Security rules and abuse controls must be designed carefully.
- Less aligned with the current static Hugo + Cloudflare Pages deployment.

## Recommendation

Use Cloudflare Workers + D1 for the future implementation. It fits the existing Cloudflare Pages hosting model, keeps the leaderboard API small, and avoids introducing login or a second product backend. The first backend phase should be limited to two read endpoints and one submit endpoint:

- `GET /api/leaderboard/today`
- `GET /api/leaderboard/all-time`
- `POST /api/leaderboard/submit`

Do not implement these endpoints in this planning phase.

## UI Flow

Recommended player flow:

1. Player finishes a Classic game.
2. Game-over panel shows local score summary as it does today.
3. A compact `Submit Score` button appears if backend leaderboard is enabled.
4. Tapping `Submit Score` opens a nickname field.
5. Player enters nickname and submits.
6. UI shows either `Today Top 100` or a friendly message if the score does not place.
7. Leaderboard panel can switch between `Today Top 100` and `All-Time Top 100`.
8. Copy should say `Anonymous leaderboard`.

The leaderboard UI should not crowd the live play HUD. Keep submission and rank browsing inside game-over or a separate lightweight panel.

## Rollout Phases

### Phase 0: Local Score Tiers Done

- Local score tiers, best score, today best, best lines, best clear, and repeat-play stats already exist.
- No server.
- No public ranking claim.

### Phase 1: Docs And Design

- Define fields, copy, backend recommendation, privacy needs, and stop conditions.
- No runtime/backend implementation.

### Phase 2: Read-Only Mock Leaderboard UI

- Add static/mock UI behind a local fixture or disabled state.
- Make copy honest: `Leaderboard preview` or `Coming later`.
- Do not accept submissions.

### Phase 3: Backend Submit/Read API

- Add Cloudflare Workers + D1 implementation.
- Add submit/read endpoints.
- Add server-side sanity checks and rate limiting.
- Add privacy-page copy before public launch.

### Phase 4: Anti-Cheat Improvements

- Tighten score validation.
- Add moderation tooling.
- Add manual review for suspicious top scores.
- Add operational reset/hide tools.

### Phase 5: Daily Challenge Leaderboard Later

- Reintroduce Daily Challenge only as a separate entry mode or route.
- Do not add an in-game Classic/Daily toggle that can reset an active board.
- Daily Challenge should use server-aligned day keys if it feeds a public leaderboard.

## Stop Conditions

Do not launch or claim a public leaderboard if any of these are true:

- Rankings are fake, local-only, or not backed by real submitted leaderboard data.
- Abuse controls, rate limits, and nickname moderation are not in place.
- The flow requires login for the first version.
- Monetization, ads, IAP, or reward mechanics are being bundled into the leaderboard phase.
- Privacy copy is missing.
- Score validation cannot reject obviously impossible scores.

## Open Decisions For Implementation

- Exact score validation thresholds by `board_version`.
- Whether `Today Top 100` should use UTC day or a fixed product timezone.
- Whether duplicate entries from the same browser player id should keep only the best score per day.
- Whether all-time leaderboard should keep multiple entries per browser player id or only that player's best.
- Admin/moderation workflow for hiding nicknames and scores.
