# Blockzzle Web Leaderboard Plan

This note keeps the current v016 work honest: Blockzzle Web only shows local score tiers today. It does not claim a real global rank, and it does not store scores on a server.

## Phase 1: Local Score Tiers

- Add browser-local score tiers based on the player's score.
- Show the current tier, best tier, and next score goal.
- Keep all stats in localStorage.
- Avoid any "global rank" or "world rank" claim.

## Phase 2: Anonymous Top 100

- Add an anonymous Top 100 leaderboard using Cloudflare Workers/D1 or an equivalent serverless store.
- Store only the minimum fields needed for a leaderboard entry.
- Keep account creation optional or absent for the first version.
- Add clear copy explaining that leaderboard entries are public.

## Phase 3: Daily Challenge Seed Leaderboard

- Add a daily fixed seed so every player gets the same piece sequence for that challenge.
- Separate Daily Challenge scores from normal free-play scores.
- Reset the daily board by local or UTC date after choosing a clear policy.

## Phase 4: Score Validation And Anti-Cheat

- Add server-side validation rules for score submissions.
- Reject impossible scores based on moves, line clears, and elapsed time.
- Rate-limit submissions.
- Add moderation and reset tools before making the leaderboard prominent.
