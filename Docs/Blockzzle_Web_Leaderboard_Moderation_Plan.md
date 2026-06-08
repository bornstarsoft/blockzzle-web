# Blockzzle Web Leaderboard Moderation Plan

Date: 2026-06-08

Status: documentation only. This plan does not implement an admin UI, change D1 schema, change API code, change gameplay, or change Cloudflare/domain settings.

## Purpose

The Blockzzle anonymous leaderboard should stay useful, motivating, and trustworthy while the product is still lightweight.

This plan defines how to handle abusive nicknames, impossible scores, spam submissions, and suspicious entries during the MVP phase. It is an operations plan for manual moderation, not full anti-cheat and not a tournament-grade integrity system.

## Current Protection Summary

The current leaderboard MVP already includes basic anti-abuse controls:

- Nickname length: 2-16 characters after trimming.
- Nickname characters: letters, numbers, spaces, underscore, and hyphen.
- Nickname whitespace normalization before storage.
- Reserved-name blocklist for obvious protected names such as `admin`, `moderator`, `support`, `staff`, and `owner`.
- Score range check from `0` to `1,000,000`.
- Duration sanity checks:
  - Non-zero scores require at least 5 seconds.
  - Scores above 3,000 are rejected below 10 seconds.
  - Scores above 15,000 are rejected below 30 seconds.
- Lines must be within the MVP range.
- `best_clear` must be between `0` and `16`.
- Tier must be one of the supported score tiers: `Rookie`, `Beginner`, `Skilled`, `Expert`, `Master`, or `World Class`.
- Daily submission limits:
  - Up to 50 accepted submissions per `browser_player_id` per day.
  - Up to 10 accepted submissions per nickname per day when `browser_player_id` is missing.
  - Basic burst limit for repeated browser-player submissions.
- Public leaderboard rows are deduped by normalized nickname so lower scores from the same nickname do not crowd the board.
- Public leaderboard queries filter `rejected = 0`.

## Known Limitations

The MVP protections reduce obvious abuse, but they are not complete anti-cheat:

- HTML5 client scores can be tampered with by a determined user.
- `duration_seconds` is client-reported and can be manipulated.
- `browser_player_id` is local browser data and can be reset or forged.
- There is no account identity, login, or verified player ownership.
- There is no server-side replay verification yet.
- There is no move-log validation yet.
- Nickname moderation is intentionally small.
- The current leaderboard is good enough for MVP motivation, but it is not tournament-grade or prize-grade.

## Moderation Triggers

Review leaderboard entries when any of these appear:

- Impossible or implausible score.
- Very high score with unrealistic duration.
- Offensive nickname.
- Nickname impersonating staff, support, or the product owner.
- Repeated spam nickname.
- Duplicate abuse that evades normal nickname dedupe.
- Suspicious Top 10 score.
- Player report from a future contact or support channel.
- A sudden burst of many entries from similar nicknames or timing.

## Manual D1 Moderation Workflow

Use manual D1 moderation until an admin UI exists.

1. Open the Cloudflare Dashboard.
2. Go to D1.
3. Open the Blockzzle leaderboard database, currently expected to be `blockzzle-leaderboard` or the active production D1 database bound to Pages Functions as `DB`.
4. Use Explore Data or Console.
5. Inspect the `blockzzle_scores` table.
6. Identify the row by `nickname`, `score`, `created_at`, and `id`.
7. Prefer hiding over deleting.
8. Set `rejected = 1` for entries that should not appear publicly.
9. Re-check the row after updating.
10. Confirm `/leaderboard/` no longer shows the rejected entry after deployment/cache refresh.

Start by reviewing top entries:

```sql
SELECT id, nickname, score, lines, best_clear, tier, created_at, rejected
FROM blockzzle_scores
ORDER BY score DESC
LIMIT 50;
```

Hide one suspicious score:

```sql
UPDATE blockzzle_scores
SET rejected = 1
WHERE id = 'PASTE_ROW_ID_HERE';
```

Verify the moderation update:

```sql
SELECT id, nickname, score, rejected
FROM blockzzle_scores
WHERE id = 'PASTE_ROW_ID_HERE';
```

## Emergency Hide All Suspicious Nickname Rows

Use this only after verifying the affected rows. Do not run broad updates casually.

First inspect the rows:

```sql
SELECT id, nickname, score, lines, best_clear, tier, created_at, rejected
FROM blockzzle_scores
WHERE lower(trim(nickname)) = lower(trim('BADNAME'))
ORDER BY score DESC, created_at ASC;
```

Then hide them if they are clearly abusive:

```sql
UPDATE blockzzle_scores
SET rejected = 1
WHERE lower(trim(nickname)) = lower(trim('BADNAME'));
```

Verify afterward:

```sql
SELECT id, nickname, score, rejected
FROM blockzzle_scores
WHERE lower(trim(nickname)) = lower(trim('BADNAME'))
ORDER BY score DESC, created_at ASC;
```

## Restore A Mistake

If a valid score was hidden by accident, restore it by setting `rejected = 0`.

```sql
UPDATE blockzzle_scores
SET rejected = 0
WHERE id = 'PASTE_ROW_ID_HERE';
```

Verify the restored row:

```sql
SELECT id, nickname, score, rejected
FROM blockzzle_scores
WHERE id = 'PASTE_ROW_ID_HERE';
```

## Deletion Policy

Do not delete rows by default.

- Use `rejected = 1` first so the entry disappears from the public leaderboard while preserving evidence for debugging.
- Delete only if legally or operationally necessary.
- Keep hidden rows available for abuse pattern review.
- If deletion becomes necessary, document why it happened and which row ids were affected.

## Privacy Policy Implications

The leaderboard MVP intentionally avoids account data:

- No email.
- No account.
- No password.
- No login.
- Public nickname and gameplay score only.
- Anonymous browser id is used for dedupe and rate limiting.
- Public leaderboard responses do not expose `browser_player_id`.
- IP addresses are not stored by the current implementation.

Before adding user reports, admin accounts, stronger identifiers, or expanded moderation tooling, update the privacy page and public copy to explain the new data handling.

## Future Admin UI Plan

### Phase 1: Manual D1 Moderation

- Use Cloudflare D1 Console to inspect, hide, and restore rows.
- Keep documentation current with current table names, indexes, and moderation examples.

### Phase 2: Protected Admin Suspicious-Score List

- Add a protected admin-only view of suspicious scores.
- Sort by score, duration, submission burst, and nickname risk.
- Do not expose this tool publicly.

### Phase 3: One-Click Reject And Unreject

- Add admin actions to set `rejected = 1` or `rejected = 0`.
- Require a confirmation step for broad nickname actions.
- Log admin decisions if moderation volume grows.

### Phase 4: Nickname Blocklist Update Flow

- Add a way to update blocked or reserved nicknames without redeploying normal gameplay code.
- Keep the blocklist conservative to avoid blocking normal players by accident.

### Phase 5: Daily Challenge Seed And Move-Log Verification

- Reintroduce Daily Challenge only as a separate entry mode or route.
- Use a server-provided seed for public Daily leaderboards.
- Submit a move log or scoring event log.
- Replay the score server-side before accepting top scores.

## Future Anti-Cheat Improvements

Potential future hardening:

- Server-issued game session id.
- Server-provided seed for challenge modes.
- Move log submission.
- Server-side score replay.
- Stricter duration and score model by board version.
- More detailed score-to-lines sanity checks.
- Cloudflare Turnstile or platform-based rate limiting if abuse appears.
- Top score review queue.
- Admin moderation notes.
- Automated suspicious-score flags.
- Safer nickname moderation workflow.

These features should be added only after real leaderboard traffic shows which risks matter.

## Stop Conditions

Stop backend expansion if any of these become true:

- The plan requires login too early.
- It risks breaking current Classic play.
- It adds invasive tracking.
- It introduces fake rankings or fake score data.
- It requires complex anti-cheat before there is meaningful traffic.
- It bundles ads, analytics, monetization, IAP, or mobile app CTAs into leaderboard work.
- It distracts from keeping the existing web game fast, playable, and honest.
