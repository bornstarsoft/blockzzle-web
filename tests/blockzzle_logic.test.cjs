const assert = require("assert");
const { BlockzzleCore } = require("../static/play/js/blockzzle-phaser.v023.js");

function piece(cells, id = "test", color = 0) {
  return { id, cells, color };
}

function makeGame(options = {}) {
  return new BlockzzleCore.Game({
    rng: () => 0,
    shapes: [piece([[0, 0]], "single")],
    ...options,
  });
}

function fill(game, cells) {
  cells.forEach(([x, y]) => {
    game.board[y][x] = 1;
  });
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("uses an 8x8 board and 3-piece tray by default", () => {
  const game = makeGame();

  assert.strictEqual(game.width, 8);
  assert.strictEqual(game.height, 8);
  assert.strictEqual(game.tray.length, 3);
  assert.strictEqual(game.tray.filter(Boolean).length, 3);
});

test("new tray pieces use stable varied colors", () => {
  const game = makeGame({
    shapes: [
      piece([[0, 0]], "a"),
      piece([[0, 0]], "b"),
      piece([[0, 0]], "c"),
    ],
  });

  assert.deepStrictEqual(game.tray.map((trayPiece) => trayPiece.color), [0, 1, 2]);
});

test("rejects out-of-bounds and occupied placements", () => {
  const game = makeGame();
  const twoWide = piece([[0, 0], [1, 0]], "two-wide");
  fill(game, [[2, 2]]);

  assert.strictEqual(game.canPlace(twoWide, 7, 0), false);
  assert.strictEqual(game.getPlacementFailureReason(twoWide, 7, 0), "out_of_bounds");
  assert.strictEqual(game.canPlace(piece([[0, 0]], "single"), 2, 2), false);
  assert.strictEqual(game.getPlacementFailureReason(piece([[0, 0]], "single"), 2, 2), "occupied");
});

test("drag hit testing maps the visible piece center to the intended board origin", () => {
  const pieceShape = piece([[0, 0], [1, 0], [2, 0], [3, 0]], "four-wide");
  const layout = { boardOrigin: { x: 10, y: 100 }, cellSize: 40 };
  const pointer = { x: 250, y: 428 };
  const lift = { x: 0, y: -28 };

  const cell = BlockzzleCore.getDragPlacementCell(pieceShape, pointer, layout, lift);

  assert.deepStrictEqual(cell, { x: 4, y: 0 });
});

test("drag preview style uses the selected piece color", () => {
  const validStyle = BlockzzleCore.getPreviewCellStyle(piece([[0, 0]], "purple", 4), true);
  const invalidStyle = BlockzzleCore.getPreviewCellStyle(piece([[0, 0]], "purple", 4), false);

  assert.strictEqual(validStyle.fill, "#a78bfa");
  assert.strictEqual(invalidStyle.fill, "#a78bfa");
  assert.strictEqual(validStyle.strokeColor, 0xa78bfa);
  assert.strictEqual(invalidStyle.strokeColor, 0xfb7185);
  assert.ok(validStyle.alpha > invalidStyle.alpha);
  assert.ok(validStyle.alpha < 1);
});

test("invalid drop return scale shrinks the drag ghost toward the tray", () => {
  const scale = BlockzzleCore.getReturnGhostScale(44, 22);

  assert.strictEqual(scale, 0.5);
});

test("drag piece uses board-scale cells instead of tray-scale cells", () => {
  assert.strictEqual(BlockzzleCore.getDragPieceSize(44), 44);
  assert.ok(BlockzzleCore.getDragPieceSize(44) >= BlockzzleCore.getTrayPieceSize(44) * 2);
});

test("tray piece size keeps tall pieces inside square tray slots", () => {
  const tallPiece = piece([[0, 0], [0, 1], [0, 2], [0, 3]], "four-v");
  const layout = BlockzzleCore.getTraySlotLayout({
    width: 390,
    cellSize: 44,
    bottomGap: 12,
  });

  assert.ok(layout.slotHeight >= layout.slotWidth - 10);
  assert.ok(BlockzzleCore.pieceFitsInSlot(tallPiece, layout.trayPieceSize, layout.slotWidth, layout.slotHeight));
});

test("mobile touch edge inset keeps board away from iPhone screen edges", () => {
  const compactInset = BlockzzleCore.getTouchEdgeInset({ width: 390, compact: true });
  const wideInset = BlockzzleCore.getTouchEdgeInset({ width: 1180, compact: false });

  assert.ok(compactInset >= 18);
  assert.ok(compactInset <= 22);
  assert.strictEqual(wideInset, 22);
});

test("orientation changes use delayed multi-pass relayout on mobile browsers", () => {
  assert.deepStrictEqual(BlockzzleCore.getOrientationRelayoutDelays(), [0, 100, 300, 600]);
});

test("portrait prompt only appears for cramped mobile landscape viewports", () => {
  assert.strictEqual(BlockzzleCore.shouldShowPortraitPrompt({ width: 844, height: 390 }), true);
  assert.strictEqual(BlockzzleCore.shouldShowPortraitPrompt({ width: 390, height: 844 }), false);
  assert.strictEqual(BlockzzleCore.shouldShowPortraitPrompt({ width: 1180, height: 720 }), false);
});

test("sound preference is off by default and uses compact labels", () => {
  assert.strictEqual(BlockzzleCore.parseSoundPreference(null), false);
  assert.strictEqual(BlockzzleCore.parseSoundPreference("true"), true);
  assert.strictEqual(BlockzzleCore.parseSoundPreference("false"), false);
  assert.strictEqual(BlockzzleCore.getSoundToggleLabel(false), "Sound Off");
  assert.strictEqual(BlockzzleCore.getSoundToggleLabel(true), "Sound On");
});

test("saved sound on is not restored as a ready state after page load", () => {
  assert.strictEqual(BlockzzleCore.shouldRestoreSoundOnPageLoad(null), false);
  assert.strictEqual(BlockzzleCore.shouldRestoreSoundOnPageLoad("false"), false);
  assert.strictEqual(BlockzzleCore.shouldRestoreSoundOnPageLoad("true"), false);
});

test("local today key uses the browser calendar date", () => {
  assert.strictEqual(BlockzzleCore.getTodayKey(new Date(2026, 5, 7, 23, 30)), "2026-06-07");
  assert.strictEqual(BlockzzleCore.getTodayKey(new Date(2026, 0, 9, 2, 15)), "2026-01-09");
});

test("repeat stats reset today best when the local date changes", () => {
  const stats = BlockzzleCore.normalizeRepeatStats({
    todayBestDate: "2026-06-06",
    todayBest: "1200",
    gamesPlayed: "4",
    lastScore: "300",
    bestLines: "9",
    bestClearLines: "3",
  }, "2026-06-07");

  assert.strictEqual(stats.todayBestDate, "2026-06-07");
  assert.strictEqual(stats.todayBest, 0);
  assert.strictEqual(stats.gamesPlayed, 4);
  assert.strictEqual(stats.lastScore, 300);
  assert.strictEqual(stats.bestLines, 9);
  assert.strictEqual(stats.bestClearLines, 3);
});

test("completed game stats update games played, last score, today best, best lines, and best clear", () => {
  const first = BlockzzleCore.completeRepeatStats({
    todayBestDate: "2026-06-07",
    todayBest: 500,
    gamesPlayed: 2,
    lastScore: 440,
    bestLines: 6,
    bestClearLines: 3,
  }, 720, 5, "2026-06-07", 2);

  assert.deepStrictEqual(first, {
    todayBestDate: "2026-06-07",
    todayBest: 720,
    gamesPlayed: 3,
    lastScore: 720,
    bestLines: 6,
    bestClearLines: 3,
  });

  const second = BlockzzleCore.completeRepeatStats(first, 410, 8, "2026-06-07", 4);
  assert.deepStrictEqual(second, {
    todayBestDate: "2026-06-07",
    todayBest: 720,
    gamesPlayed: 4,
    lastScore: 410,
    bestLines: 8,
    bestClearLines: 4,
  });
});

test("classic-only build does not expose daily challenge helpers", () => {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(BlockzzleCore, "getDailyPieceSequence"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(BlockzzleCore, "normalizeDailyStats"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(BlockzzleCore, "completeDailyStats"), false);
});

test("clear tier labels make multi-line clears distinct", () => {
  assert.strictEqual(BlockzzleCore.getClearTier(1).label, "Line Clear");
  assert.strictEqual(BlockzzleCore.getClearTier(2).label, "Double Clear!");
  assert.strictEqual(BlockzzleCore.getClearTier(3).label, "Triple Clear!");
  assert.strictEqual(BlockzzleCore.getClearTier(4).label, "Mega Clear!");
  assert.strictEqual(BlockzzleCore.getClearTier(5).label, "Ultra Clear!");
});

test("score tiers use honest local goal labels", () => {
  assert.deepStrictEqual(BlockzzleCore.getScoreTier(0), {
    label: "Rookie",
    minScore: 0,
    nextLabel: "Beginner",
    nextScore: 1000,
  });
  assert.strictEqual(BlockzzleCore.getScoreTier(1000).label, "Beginner");
  assert.strictEqual(BlockzzleCore.getScoreTier(3000).label, "Skilled");
  assert.strictEqual(BlockzzleCore.getScoreTier(5000).label, "Expert");
  assert.strictEqual(BlockzzleCore.getScoreTier(10000).label, "Master");
  assert.deepStrictEqual(BlockzzleCore.getScoreTier(20000), {
    label: "World Class",
    minScore: 20000,
    nextLabel: "",
    nextScore: 0,
  });
});

test("score tier goal text names the next reachable tier", () => {
  assert.strictEqual(BlockzzleCore.getScoreTierGoalText(570), "Next: Beginner 1,000");
  assert.strictEqual(BlockzzleCore.getScoreTierGoalText(6400), "Next: Master 10,000");
  assert.strictEqual(BlockzzleCore.getScoreTierGoalText(20000), "Top local tier reached");
});

test("leaderboard nickname validation trims and restricts public names", () => {
  assert.deepStrictEqual(BlockzzleCore.validateLeaderboardNickname(" Player_1 "), {
    ok: true,
    nickname: "Player_1",
  });
  assert.strictEqual(BlockzzleCore.validateLeaderboardNickname("A").ok, false);
  assert.strictEqual(BlockzzleCore.validateLeaderboardNickname("Player!").ok, false);
  assert.strictEqual(BlockzzleCore.validateLeaderboardNickname("badword").ok, false);
});

test("leaderboard submission validation rejects impossible MVP values", () => {
  const valid = BlockzzleCore.validateLeaderboardSubmission({
    nickname: "Player-1",
    score: 1200,
    lines: 12,
    best_clear: 4,
    tier: "Beginner",
    duration_seconds: 120,
    client_version: "v023",
    browser_player_id: "bz_1234567890abcdef",
  });

  assert.strictEqual(valid.ok, true);
  assert.strictEqual(valid.entry.nickname, "Player-1");
  assert.strictEqual(valid.entry.score, 1200);
  assert.strictEqual(valid.entry.best_clear, 4);
  assert.strictEqual(BlockzzleCore.validateLeaderboardSubmission({ ...valid.entry, score: 1000001 }).ok, false);
  assert.strictEqual(BlockzzleCore.validateLeaderboardSubmission({ ...valid.entry, duration_seconds: 4 }).ok, false);
  assert.strictEqual(BlockzzleCore.validateLeaderboardSubmission({ ...valid.entry, duration_seconds: 8, score: 6000 }).ok, false);
  assert.strictEqual(BlockzzleCore.validateLeaderboardSubmission({ ...valid.entry, best_clear: 17 }).ok, false);
});

test("browser player id generation stores one anonymous local id", () => {
  const store = {};
  const storage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
  };
  const rng = () => 0.5;

  const first = BlockzzleCore.getOrCreateBrowserPlayerId(storage, rng);
  const second = BlockzzleCore.getOrCreateBrowserPlayerId(storage, () => 0.1);

  assert.match(first, /^bz_[0-9a-f]{32}$/);
  assert.strictEqual(second, first);
  assert.strictEqual(store.blockzzleAnonPlayerIdV1, first);
});

test("sound cue definitions stay subtle and asset-free", () => {
  const cues = BlockzzleCore.SOUND_CUES;

  assert.strictEqual(cues.place.type, "pop");
  assert.strictEqual(cues.invalid.type, "thud");
  assert.strictEqual(cues.clear.type, "chime");
  assert.strictEqual(cues.gameOver.type, "down");
  assert.ok(cues.clear.volume <= 0.12);
  assert.ok(cues.place.durationMs <= 120);
});

test("gesture audio unlock uses a short low-volume oscillator test tick", () => {
  const cue = BlockzzleCore.AUDIO_UNLOCK_CUE;

  assert.strictEqual(cue.type, "unlock");
  assert.strictEqual(cue.wave, "sine");
  assert.ok(cue.volume > 0.002);
  assert.ok(cue.volume <= 0.02);
  assert.ok(cue.durationMs <= 70);
});

test("saved sound on primes audio on the next user gesture", () => {
  assert.strictEqual(BlockzzleCore.shouldPrimeAudioOnGesture(false, null), false);
  assert.strictEqual(BlockzzleCore.shouldPrimeAudioOnGesture(true, null), true);
  assert.strictEqual(BlockzzleCore.shouldPrimeAudioOnGesture(true, "suspended"), true);
  assert.strictEqual(BlockzzleCore.shouldPrimeAudioOnGesture(true, "running"), false);
  assert.strictEqual(BlockzzleCore.shouldPrimeAudioOnGesture(true, "closed"), true);
});

test("saved sound on stays pending until a gesture unlocks audio", () => {
  assert.deepStrictEqual(BlockzzleCore.getAudioUnlockStatus(false, null, false), {
    pending: false,
    ready: false,
  });
  assert.deepStrictEqual(BlockzzleCore.getAudioUnlockStatus(true, null, false), {
    pending: true,
    ready: false,
  });
  assert.deepStrictEqual(BlockzzleCore.getAudioUnlockStatus(true, "running", false), {
    pending: true,
    ready: false,
  });
  assert.deepStrictEqual(BlockzzleCore.getAudioUnlockStatus(true, "suspended", false), {
    pending: true,
    ready: false,
  });
  assert.deepStrictEqual(BlockzzleCore.getAudioUnlockStatus(true, "running", true), {
    pending: false,
    ready: true,
  });
  assert.deepStrictEqual(BlockzzleCore.getAudioUnlockStatus(true, null, true), {
    pending: true,
    ready: false,
  });
});

test("sound unlock attempts are throttled while pending", () => {
  assert.strictEqual(BlockzzleCore.shouldAttemptAudioUnlock(false, false, 5000, 0), false);
  assert.strictEqual(BlockzzleCore.shouldAttemptAudioUnlock(true, true, 5000, 0), false);
  assert.strictEqual(BlockzzleCore.shouldAttemptAudioUnlock(true, false, 5000, 0), true);
  assert.strictEqual(BlockzzleCore.shouldAttemptAudioUnlock(true, false, 5000, 4900), false);
  assert.strictEqual(BlockzzleCore.shouldAttemptAudioUnlock(true, false, 5000, 4200), true);
});

test("placed board cells stay full opacity while previews stay translucent", () => {
  const placedStyle = BlockzzleCore.getBoardCellStyle({
    value: 5,
    isPreview: false,
  });
  const previewStyle = BlockzzleCore.getBoardCellStyle({
    value: 0,
    isPreview: true,
    previewPiece: piece([[0, 0]], "purple", 4),
    previewValid: true,
  });
  const clearStyle = BlockzzleCore.getBoardCellStyle({
    value: 5,
    isClearFlash: true,
  });

  assert.strictEqual(placedStyle.fill, "#a78bfa");
  assert.strictEqual(placedStyle.alpha, 1);
  assert.ok(previewStyle.alpha < 1);
  assert.strictEqual(clearStyle.alpha, 1);
  assert.ok(clearStyle.strokeWidth >= 3);
});

test("places cells, clears full rows and columns, and scores the move", () => {
  const game = makeGame();
  fill(game, [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7],
  ]);

  const result = game.place(piece([[0, 0]], "single"), 7, 0);

  assert.strictEqual(result.placed, true);
  assert.strictEqual(result.rowsCleared, 1);
  assert.strictEqual(result.columnsCleared, 1);
  assert.strictEqual(result.linesCleared, 2);
  assert.strictEqual(result.cellsCleared, 15);
  assert.strictEqual(result.clearBonus, 100);
  assert.strictEqual(result.scoreDelta, 310);
  assert.strictEqual(game.score, 310);
  assert.strictEqual(game.board[0][7], 0);
});

test("single-line clear keeps base line score without multi-line bonus", () => {
  const game = makeGame();
  fill(game, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);

  const result = game.place(piece([[0, 0]], "single"), 7, 0);

  assert.strictEqual(result.linesCleared, 1);
  assert.strictEqual(result.clearBonus, 0);
  assert.strictEqual(result.scoreDelta, 110);
});

test("double-line clear awards a bonus above base line score", () => {
  const game = makeGame();
  fill(game, [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7],
  ]);

  const result = game.place(piece([[0, 0]], "single"), 7, 0);

  assert.strictEqual(result.linesCleared, 2);
  assert.strictEqual(result.clearBonus, 100);
  assert.strictEqual(result.scoreDelta, 310);
});

test("triple-line clear awards a bigger bonus than double-line clear", () => {
  const game = makeGame();
  fill(game, [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7],
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7],
  ]);

  const result = game.place(piece([[0, 0], [1, 0]], "two-wide"), 6, 0);

  assert.strictEqual(result.linesCleared, 3);
  assert.strictEqual(result.clearBonus, 250);
  assert.strictEqual(result.scoreDelta, 570);
  assert.strictEqual(game.bestClearLinesThisGame, 3);
});

test("consumes a tray piece and refills only after all 3 pieces are placed", () => {
  const game = makeGame({
    shapes: [
      piece([[0, 0]], "a"),
      piece([[0, 0]], "b"),
      piece([[0, 0]], "c"),
    ],
  });
  const firstIds = game.tray.map((trayPiece) => trayPiece.id);

  game.placeTrayPiece(0, 0, 0);
  assert.strictEqual(game.tray[0], null);
  assert.deepStrictEqual(game.tray.map((trayPiece) => trayPiece && trayPiece.id), [null, firstIds[1], firstIds[2]]);

  game.placeTrayPiece(1, 1, 0);
  game.placeTrayPiece(2, 2, 0);
  assert.strictEqual(game.tray.filter(Boolean).length, 3);
});

test("marks game over when no tray piece can fit", () => {
  const game = makeGame({ shapes: [piece([[0, 0], [1, 0]], "two-wide")] });
  for (let y = 0; y < game.height; y += 1) {
    for (let x = 0; x < game.width; x += 1) {
      game.board[y][x] = 1;
    }
  }
  game.board[0][0] = 0;

  assert.strictEqual(game.canPlaceAnyTrayPiece(), false);
  assert.strictEqual(game.checkGameOver(), true);
  assert.strictEqual(game.gameOver, true);
});

test("restart clears the board and preserves high score", () => {
  const storage = {};
  const game = makeGame({
    storage: {
      getItem: (key) => storage[key] || null,
      setItem: (key, value) => {
        storage[key] = String(value);
      },
    },
  });
  game.score = 320;
  game.saveHighScore();

  game.restart();

  assert.strictEqual(game.score, 0);
  assert.strictEqual(game.highScore, 320);
  assert.strictEqual(storage.blockzzleHighScoreV1, "320");
  assert.strictEqual(game.board.flat().every((cell) => cell === 0), true);
});

test("restart recovers from game over with a fresh tray", () => {
  const game = makeGame({ shapes: [piece([[0, 0], [1, 0]], "two-wide")] });
  for (let y = 0; y < game.height; y += 1) {
    for (let x = 0; x < game.width; x += 1) {
      game.board[y][x] = 1;
    }
  }
  game.board[0][0] = 0;
  game.checkGameOver();

  game.restart();

  assert.strictEqual(game.gameOver, false);
  assert.strictEqual(game.tray.filter(Boolean).length, 3);
});
