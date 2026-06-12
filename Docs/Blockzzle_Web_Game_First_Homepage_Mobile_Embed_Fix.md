# Blockzzle Web Homepage Mobile Embed Fix

Date: 2026-06-12

Status: implemented for the game-first homepage embed. This does not change gameplay rules, scoring, leaderboard APIs, D1 schema, backend functions, app store links, or domain settings.

## iPhone Safari Issue Summary

After the homepage became game-first, it embedded the stable `/play/` route in an iframe. The direct `/play/` page was designed to own the full mobile viewport, so it still rendered its in-canvas title, subtitle, helper spacing, and Home control inside the iframe.

On iPhone Safari this made the embedded game feel cramped:

- Duplicate title/header content consumed vertical space already provided by the homepage.
- The board and tray were pushed down inside the iframe.
- The tray/status area could sit too close to Safari's bottom browser UI.
- Direct `/play/` still worked, but the homepage embed needed a compact profile.

## Embedded Mode Behavior

The homepage now loads:

```text
/play/?embed=home
```

The Phaser client reads the `embed=home` query parameter and switches only layout presentation:

- Hide duplicate in-canvas `Blockzzle` title.
- Hide duplicate subtitle/helper copy.
- Hide the in-canvas `Home` link because the homepage already provides site navigation.
- Keep Score, Best, Today, Lines, Next Goal, Sound, Restart, Ranks, board, tray, status, drag/drop, game over, and leaderboard submission behavior.

Standalone `/play/` without the query parameter keeps the normal full-page layout.

## Iframe And Height Strategy

The homepage iframe now reserves more mobile-safe height for the game:

- Uses `svh`/`dvh` height expressions.
- Keeps the game near the top of the homepage.
- Uses a larger minimum iframe height for typical iPhone portrait viewports.
- Lets the app/download card remain below the game on mobile.

Inside `/play/?embed=home`, the Phaser layout profile reduces the internal header reserve and moves the HUD/board upward. This gives the board, tray, and status text more usable vertical room without changing the game rules.

No heavy dependencies or QR libraries were added.

## Standalone `/play/` Preservation

Direct `/play/` remains the standalone play surface:

- Same core rules.
- Same 8x8 board.
- Same 3-piece tray.
- Same scoring, line clear, stats, sound, score tiers, and leaderboard behavior.
- Same mobile orientation recovery.
- Same direct page navigation behavior.

Only the query-param embed presentation changes the canvas header spacing.

## Manual Smoke Checklist

Before deployment, verify:

- Homepage game is visible immediately.
- Board is visible.
- Tray is visible.
- Dragging tray pieces onto the board works.
- Status text is visible.
- Safari bottom toolbar does not cover core controls in normal portrait view.
- App card appears below the game on mobile and beside it on desktop.
- `/play/` standalone still works without `embed=home`.
- `/leaderboard/` still renders and reads real scores or a safe unavailable state.
- No fake app store links, fake ratings, fake reviews, or fake download claims appear.
- No generated `public/` files are staged.
