const assert = require("assert");
const { BlockzzleCore } = require("../static/play/js/blockzzle-phaser.v012.js");

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

test("sound preference is off by default and uses compact labels", () => {
  assert.strictEqual(BlockzzleCore.parseSoundPreference(null), false);
  assert.strictEqual(BlockzzleCore.parseSoundPreference("true"), true);
  assert.strictEqual(BlockzzleCore.parseSoundPreference("false"), false);
  assert.strictEqual(BlockzzleCore.getSoundToggleLabel(false), "Sound Off");
  assert.strictEqual(BlockzzleCore.getSoundToggleLabel(true), "Sound On");
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
  assert.strictEqual(result.scoreDelta, 210);
  assert.strictEqual(game.score, 210);
  assert.strictEqual(game.board[0][7], 0);
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
