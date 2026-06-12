# Blockzzle Web Game-First Homepage Plan

Date: 2026-06-12

Status: implemented for the Hugo homepage. This plan does not change gameplay rules, leaderboard APIs, D1 schema, backend functions, DNS, Cloudflare Pages settings, or old Unity WebGL files.

## What Changed

- The homepage is now game-first: visitors can play Blockzzle immediately on `https://blockzzle.com/`.
- The existing `/play/` page is embedded in the homepage with an iframe so the stable Phaser game implementation is reused instead of copied.
- The old click-through marketing hero was replaced with a compact header, playable game area, mobile app/download card, and short SEO/help copy below the game.
- `/play/`, `/leaderboard/`, `/privacy/`, `/terms/`, `/contact/`, robots, and sitemap behavior remain preserved.

## Homepage Game-First Decision

The homepage uses an iframe pointing at `/play/` instead of loading the Phaser bundle directly into the Hugo homepage. This keeps the game runtime isolated and avoids duplicating or refactoring the current Phaser layout, sound, drag/drop, leaderboard submission, and mobile orientation code.

This is the lowest-risk route for a Sudoku.com-style first page because the game appears immediately while the standalone `/play/` route remains unchanged.

## `/play/` Preservation

The `/play/` route remains the canonical standalone play surface:

- Same Phaser assets.
- Same 8x8 board and 3-piece tray.
- Same scoring, line clears, stats, sound policy, score tiers, and leaderboard submit flow.
- Same mobile Safari safe-area and orientation behavior.

No `/play/` asset version bump was needed for this homepage change.

## Mobile App Download Behavior

Homepage app-store configuration lives in:

```text
data/blockzzle_app.toml
```

Current values:

- `android_app_url = ""`
- `ios_app_url = ""`
- `qr_target_url = "https://blockzzle.com/play/"`

Because no public app store URLs are configured yet:

- Google Play is shown as `Coming soon`.
- App Store is shown as `Coming soon`.
- No fake store badges, ratings, reviews, downloads, or app links are shown.
- The mobile link/QR area points to the web game at `https://blockzzle.com/play/`.

When a public store listing is available, set the matching URL in `data/blockzzle_app.toml`. The homepage will render that store as an active link.

## Platform Ordering

A small homepage script uses `navigator.userAgent` to lightly prefer the relevant store row:

- Android visitors see Google Play first.
- iOS visitors see App Store first.
- Desktop visitors keep the default order.

If a store URL is missing, the row remains disabled with `Coming soon` copy.

## Desktop Layout

Desktop uses a two-column layout:

- Main column: playable Blockzzle iframe.
- Side column: app download card and mobile link target.

The side card is intentionally secondary so it does not push the game down.

## SEO And Content

The homepage keeps short factual copy below the playable game:

- What Blockzzle is.
- How to play.
- No-install browser play.
- Anonymous leaderboard link.

The homepage title and meta description describe Blockzzle as a free online block puzzle game playable immediately in the browser.

## What Was Not Changed

- Gameplay rules.
- Phaser game assets.
- Leaderboard API routes.
- D1 schema or migrations.
- Moderation or nickname logic.
- Backend functions.
- Login, email capture, analytics, ads, IAP, monetization, or Daily Challenge.
- Old Unity WebGL Build/TemplateData files.
- Other repos such as Ringzzle, Puzzlepia, HotGames, or NewGames.

## Manual Smoke Checklist

Before deployment:

- Run `hugo --minify`.
- Run `node tests/blockzzle_logic.test.cjs`.
- Run `git diff --check`.
- Confirm `/` renders the playable game near the top.
- Confirm `/play/` still loads standalone.
- Confirm `/leaderboard/` still renders and can fetch real rows or show a safe unavailable message.
- Confirm mobile widths around 390px and 430px show the game first and app card below.
- Confirm desktop shows game plus side app card.
- Confirm no fake app store links or fake popularity claims appear.
- Confirm generated `public/` files are not staged unless the repo intentionally tracks them.
