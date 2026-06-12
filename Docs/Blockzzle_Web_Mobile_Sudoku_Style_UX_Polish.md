# Blockzzle Web Mobile Sudoku-Style UX Polish

Date: 2026-06-12

Status: implemented for the game-first homepage and `/play/?embed=home`. This pass does not change gameplay rules, scoring, save behavior, leaderboard APIs, D1 schema, backend functions, store links, or domain settings.

## iPhone Safari Issue Summary

After the homepage became game-first, the mobile first screen still felt heavier than a Sudoku.com-style play surface:

- The site header, homepage title/subtitle, and embedded game controls repeated too much Blockzzle/header information.
- The in-game Ranks button added clutter near the top of the embedded game.
- The iframe captured touch input during play, which made the page feel less like a normal scroll page when the finger started inside the game.

## Duplicated Top Content Removed Or Minimized

On mobile homepage widths, the large homepage title/subtitle is now visually hidden while remaining present for accessibility and SEO. The compact site header keeps the Blockzzle brand visible, then the playable game appears immediately below it.

Desktop keeps the visible homepage title/subtitle for a more conventional SEO-friendly landing layout.

## Embedded Play Header Changes

The existing `/play/?embed=home` mode continues to hide duplicate in-canvas title, subtitle, helper copy, and Home link. It now also hides the in-game Ranks button in embedded homepage mode.

Standalone `/play/` without `embed=home` keeps the expected full controls, including Ranks.

## Rank And Leaderboard Decision

The Ranks button is hidden only inside the homepage iframe to simplify the first mobile screen. The leaderboard remains reachable from:

- The homepage top navigation.
- The below-game Leaderboard content section.
- The standalone `/play/` game controls.
- The dedicated `/leaderboard/` page.

No leaderboard feature or API behavior was removed.

## Scroll Behavior Decision

The game canvas intentionally captures touch input while the player is dragging pieces. This protects drag/drop reliability and prevents the browser from scrolling the page mid-placement.

The homepage itself does not add a body scroll lock. Page scroll works naturally outside the game iframe, and the iframe height is kept practical so the app card and content sections are reachable below the game.

## Standalone `/play/` Preservation

Direct `/play/` remains the full game route:

- Same gameplay rules.
- Same scoring and local stats.
- Same sound behavior.
- Same leaderboard submit/read behavior.
- Same Ranks button.
- Same mobile safe-area and orientation recovery behavior.

Only the homepage embedded presentation changes.

## Manual Smoke Checklist

Before deployment, verify:

- Homepage first screen is simpler on iPhone Safari.
- Game appears near the top.
- No duplicate Blockzzle title stack appears above the game on mobile.
- Board and tray are visible.
- Drag/drop still works inside the game iframe.
- Page scrolls into app/download and info sections when starting outside the game canvas.
- Leaderboard remains reachable from homepage nav and below-game section.
- Standalone `/play/` still shows full controls, including Ranks.
- `/leaderboard/` still works.
- No generated `public/` files are staged unless intentionally tracked.
