# Blockzzle Web Mobile Embed Layout Gutters Fix

Date: 2026-06-12

Status: implemented for the homepage mobile embed and v029 play assets. This pass does not change gameplay rules, scoring, saves, leaderboard APIs, D1 schema, backend functions, app store links, or domain settings.

## iPhone Safari Issue Summary

Owner testing found three homepage embed problems on iPhone Safari:

- The game iframe/card was nearly full width, leaving little side area for normal page scrolling.
- Restart and Sound controls could visually collide with the score panels in the embedded mobile game.
- The `Next: Beginner 1,000` target text was still shown in mobile embed mode and could overlap the board area.

## Side Gutter Decision

On mobile homepage widths, the game card is now centered and slightly narrower than the viewport:

```css
width: min(94vw, 430px);
```

This leaves small left/right gutters where the page can scroll normally. Touches inside the game canvas are still reserved for Blockzzle drag/drop reliability.

## Restart And Sound Overlap Fix

The embedded play profile now uses:

- Smaller mobile Restart/Sound button padding and font size.
- A lower score chip row.
- Narrower score chip widths for the iframe layout.
- A slightly larger embedded header reserve so the controls, score chips, board, tray, and status have separate space.

Standalone `/play/` keeps the normal full controls and layout.

## Target Text Decision

The `Next: Beginner 1,000` style goal text is hidden in homepage embedded mode. The score tier/goal system remains available in standalone `/play/` and game-over summaries.

This keeps the mobile homepage game surface focused on the board, tray, score chips, Restart, and Sound.

## Standalone `/play/` Preservation

Direct `/play/` remains the full play route:

- Same rules and board.
- Same scoring and local stats.
- Same sound behavior.
- Same leaderboard behavior.
- Same Ranks control.
- Same score tier target text.
- Same mobile safe-area and orientation recovery behavior.

Only the homepage embedded presentation changes.

## Manual Smoke Checklist

Before deployment, verify:

- Homepage game is centered with small side gutters.
- Side gutters allow page scrolling.
- Drag/drop still works inside the game iframe.
- Restart/Sound no longer overlap score panels.
- Target text does not overlap the board in mobile embed.
- Board and tray remain visible.
- Below-game app/info sections are reachable.
- Standalone `/play/` still works normally.
- `/leaderboard/` still works.
- No generated `public/` files are staged unless intentionally tracked.
