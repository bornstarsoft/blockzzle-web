const assert = require("assert");
const { BlockzzleCore } = require("../static/play/js/blockzzle-phaser.v005.js");

function piece(cells, id = "test") {
  return { id, cells, color: 0 };
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
