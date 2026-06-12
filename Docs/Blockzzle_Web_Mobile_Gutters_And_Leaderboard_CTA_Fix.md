# Blockzzle Web Mobile Gutters And Leaderboard CTA Fix

Date: 2026-06-12

Status: implemented for the Hugo homepage and leaderboard templates. This pass does not change gameplay rules, scoring, saves, localStorage behavior, leaderboard APIs, D1 schema, backend functions, or app store links.

## iPhone Safari Issue Summary

Owner testing found that the homepage game card still felt too wide on iPhone Safari. The iframe left only a very small side area, so normal page scrolling was hard when touching near the game. The leaderboard page also sent the main `Play Blockzzle Online` CTA to standalone `/play/`, which can resume an existing standalone game state instead of the new game-first homepage.

## Mobile Game Card Width Decision

On mobile homepage widths, the game card is now centered at:

```css
width: min(90vw, 400px);
```

This replaces the previous wider mobile setting and creates clearer left/right gutters for normal page scrolling. The iframe remains large enough to play comfortably, while the page feels less trapped inside the game surface.

## Iframe Height Decision

The iframe height remains on the current v029 mobile range. Only width changed in this pass. Keeping the height stable avoids reintroducing board/tray clipping while still letting the app card and below-game content remain reachable by page scroll.

## Drag Versus Scroll Behavior

Touches inside the game canvas may still be captured by Phaser to preserve drag/drop reliability. The intended behavior is:

- Drag pieces inside the game iframe.
- Scroll the page from the side gutters or other areas outside the game card.
- Reach the app card, how-to-play, tips, leaderboard, responsible play, and footer sections below the game.

## Leaderboard CTA Route Decision

The public `Play Blockzzle Online` CTA on `/leaderboard/` now points to `/`, the game-first homepage. The shared public-page `Play Online` nav link also points to `/`.

Standalone `/play/` is preserved for direct access and internal use, but public marketing CTAs should prefer the homepage now that it is playable immediately.

## Manual Smoke Checklist

Before deployment, verify:

- Homepage game card has visible side gutters on iPhone Safari.
- Side gutters allow page scroll.
- Drag/drop inside the game still works.
- Board and tray remain visible.
- Below-game sections are reachable.
- Leaderboard CTA goes to `/`.
- Standalone `/play/` still works.
- `/leaderboard/` still works.
- No generated `public/` files are staged unless intentionally tracked.
