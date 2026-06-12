# Blockzzle Web Mobile Scroll Content Homepage

Date: 2026-06-12

Status: implemented for the Hugo homepage. This pass changes homepage structure and copy only; it does not change Phaser gameplay, leaderboard APIs, D1 schema, backend functions, store links, or domain settings.

## Sudoku.com-Inspired Scroll Structure

The homepage keeps the playable Blockzzle game immediately near the top, then continues into normal web-page content below the game. This makes the page feel like a full game service instead of only an iframe wrapper.

The homepage still embeds:

```text
/play/?embed=home
```

That route keeps using the existing Phaser implementation while hiding duplicate in-game title/header copy inside the homepage embed.

## Mobile Content Order

Mobile uses this order:

1. Compact site header and navigation.
2. Blockzzle title and short subtitle.
3. Playable game iframe.
4. App/download card.
5. How to Play Blockzzle.
6. Blockzzle Tips.
7. Compete on the Leaderboard.
8. Responsible Play.
9. Footer.

The iframe height is kept practical so the game remains playable, but visitors can naturally continue scrolling to the app card and content below. The app card stays below the game on mobile and does not sit above the playable area.

## Desktop Content Order

Desktop keeps the game as the main first-screen element:

- Main column: playable Blockzzle iframe.
- Side column: app/download card and mobile link target.
- Below the first game area: how-to-play, tips, leaderboard, and responsible-play sections.

The side card remains secondary and should not dominate the game.

## App Card Behavior

App store URLs are configured in:

```text
data/blockzzle_app.toml
```

Current public store URLs are empty, so the homepage renders:

- Google Play: Coming soon.
- App Store: Coming soon.
- Mobile link target: `https://blockzzle.com/play/`.

No fake app store URLs, ratings, reviews, downloads, or popularity claims are shown.

## Responsible Play Wording Policy

The homepage uses this wording:

```text
Blockzzle is designed for quick, thoughtful play sessions. We aim to make lightweight puzzle games easy to access across devices, with no install required on the web. Our broader product direction is inspired by social value themes such as learning, creativity, accessibility, and well-being, without implying any official certification or affiliation.
```

This copy is intentionally factual and non-promotional. It does not claim UN recognition, social-enterprise certification, official affiliation, medical benefit, educational certification, or any other third-party endorsement.

## Manual Smoke Checklist

Before deployment, verify:

- Homepage game appears immediately near the top.
- Board is visible in the homepage embed.
- Tray and status text are visible in the homepage embed.
- Dragging pieces works in the homepage embed.
- The page scrolls naturally below the game.
- App/download card appears below the game on mobile.
- How to Play, Tips, Leaderboard, and Responsible Play sections appear below the game.
- `/play/` standalone still works.
- `/leaderboard/` still works.
- `/privacy/`, `/terms/`, sitemap, and robots behavior are preserved.
- No fake app store links, ratings, reviews, downloads, or popularity claims appear.
- No generated `public/` files are staged unless intentionally tracked.
