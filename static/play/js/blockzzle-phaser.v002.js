(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.BlockzzleCore = api.BlockzzleCore;
  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", () => {
      if (root.Phaser) {
        api.bootPhaserGame(root.Phaser);
      }
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BOARD_SIZE = 8;
  const TRAY_SIZE = 3;
  const SCORE_PER_PLACED_CELL = 10;
  const SCORE_PER_CLEARED_LINE = 100;
  const STORAGE_KEY = "blockzzleHighScoreV1";

  const SHAPES = [
    { id: "single", cells: [[0, 0]] },
    { id: "two_h", cells: [[0, 0], [1, 0]] },
    { id: "two_v", cells: [[0, 0], [0, 1]] },
    { id: "three_h", cells: [[0, 0], [1, 0], [2, 0]] },
    { id: "three_v", cells: [[0, 0], [0, 1], [0, 2]] },
    { id: "corner_l", cells: [[0, 0], [1, 0], [0, 1]] },
    { id: "corner_r", cells: [[0, 0], [1, 0], [1, 1]] },
    { id: "four_h", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { id: "four_v", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { id: "square", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { id: "tee", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { id: "l_long", cells: [[0, 0], [1, 0], [2, 0], [0, 1]] },
    { id: "zig", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { id: "zag", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  ];

  const COLORS = ["#2dd4bf", "#60a5fa", "#f59e0b", "#fb7185"];

  function cloneCells(cells) {
    return cells.map((cell) => [cell[0], cell[1]]);
  }

  function normalizePiece(piece, fallbackId, fallbackColor) {
    return {
      id: piece.id || fallbackId,
      cells: cloneCells(piece.cells || [[0, 0]]),
      color: typeof piece.color === "number" ? piece.color : fallbackColor,
    };
  }

  function createBoard(width, height) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
  }

  class Game {
    constructor(options) {
      const opts = options || {};
      this.width = opts.width || BOARD_SIZE;
      this.height = opts.height || BOARD_SIZE;
      this.traySize = opts.traySize || TRAY_SIZE;
      this.rng = opts.rng || Math.random;
      this.storage = opts.storage || (typeof window !== "undefined" ? window.localStorage : null);
      this.shapes = (opts.shapes && opts.shapes.length ? opts.shapes : SHAPES).map((shape, index) =>
        normalizePiece(shape, `shape_${index}`, 0)
      );
      this.board = createBoard(this.width, this.height);
      this.score = 0;
      this.linesCleared = 0;
      this.gameOver = false;
      this.highScore = this.loadHighScore();
      this.pieceSequence = 0;
      this.tray = [];
      this.refillTray();
    }

    loadHighScore() {
      if (!this.storage) return 0;
      const stored = Number.parseInt(this.storage.getItem(STORAGE_KEY) || "0", 10);
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    }

    saveHighScore() {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        if (this.storage) {
          this.storage.setItem(STORAGE_KEY, String(this.highScore));
        }
      }
    }

    restart() {
      this.saveHighScore();
      this.board = createBoard(this.width, this.height);
      this.score = 0;
      this.linesCleared = 0;
      this.gameOver = false;
      this.pieceSequence = 0;
      this.tray = [];
      this.refillTray();
    }

    randomIndex(max) {
      return Math.max(0, Math.min(max - 1, Math.floor(this.rng() * max)));
    }

    createRandomPiece() {
      const shape = this.shapes[this.randomIndex(this.shapes.length)];
      const color = this.randomIndex(COLORS.length);
      return normalizePiece(shape, `piece_${this.pieceSequence++}`, color);
    }

    refillTray() {
      this.tray = Array.from({ length: this.traySize }, () => this.createRandomPiece());
      this.checkGameOver();
    }

    allTraySlotsEmpty() {
      return this.tray.every((piece) => !piece);
    }

    isInside(x, y) {
      return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    getPlacementFailureReason(piece, originX, originY) {
      if (!piece || !piece.cells || piece.cells.length === 0) return "piece_null";
      for (const [offsetX, offsetY] of piece.cells) {
        const x = originX + offsetX;
        const y = originY + offsetY;
        if (!this.isInside(x, y)) return "out_of_bounds";
        if (this.board[y][x]) return "occupied";
      }
      return "";
    }

    canPlace(piece, originX, originY) {
      return this.getPlacementFailureReason(piece, originX, originY) === "";
    }

    canPlaceAny(piece) {
      if (!piece) return false;
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          if (this.canPlace(piece, x, y)) return true;
        }
      }
      return false;
    }

    canPlaceAnyTrayPiece() {
      return this.tray.some((piece) => this.canPlaceAny(piece));
    }

    getFullRowsAndColumns() {
      const rows = [];
      const columns = [];
      for (let y = 0; y < this.height; y += 1) {
        if (this.board[y].every(Boolean)) rows.push(y);
      }
      for (let x = 0; x < this.width; x += 1) {
        let full = true;
        for (let y = 0; y < this.height; y += 1) {
          if (!this.board[y][x]) {
            full = false;
            break;
          }
        }
        if (full) columns.push(x);
      }
      return { rows, columns };
    }

    clearFullRowsAndColumns() {
      const { rows, columns } = this.getFullRowsAndColumns();
      const cellsToClear = new Set();
      rows.forEach((y) => {
        for (let x = 0; x < this.width; x += 1) cellsToClear.add(`${x},${y}`);
      });
      columns.forEach((x) => {
        for (let y = 0; y < this.height; y += 1) cellsToClear.add(`${x},${y}`);
      });
      cellsToClear.forEach((key) => {
        const [x, y] = key.split(",").map(Number);
        this.board[y][x] = 0;
      });
      return {
        rowsCleared: rows.length,
        columnsCleared: columns.length,
        linesCleared: rows.length + columns.length,
        cellsCleared: cellsToClear.size,
        cells: Array.from(cellsToClear).map((key) => key.split(",").map(Number)),
      };
    }

    place(piece, originX, originY) {
      if (this.gameOver) {
        return { placed: false, failureReason: "game_over" };
      }
      const failureReason = this.getPlacementFailureReason(piece, originX, originY);
      if (failureReason) {
        return { placed: false, failureReason };
      }
      piece.cells.forEach(([offsetX, offsetY]) => {
        this.board[originY + offsetY][originX + offsetX] = (piece.color % COLORS.length) + 1;
      });
      const clearResult = this.clearFullRowsAndColumns();
      const scoreDelta = piece.cells.length * SCORE_PER_PLACED_CELL + clearResult.linesCleared * SCORE_PER_CLEARED_LINE;
      this.score += scoreDelta;
      this.linesCleared += clearResult.linesCleared;
      this.saveHighScore();
      return {
        placed: true,
        scoreDelta,
        placedCells: piece.cells.map(([offsetX, offsetY]) => [originX + offsetX, originY + offsetY]),
        ...clearResult,
      };
    }

    placeTrayPiece(slotIndex, originX, originY) {
      if (slotIndex < 0 || slotIndex >= this.tray.length) {
        return { placed: false, failureReason: "piece_index_out_of_range" };
      }
      const piece = this.tray[slotIndex];
      if (!piece) {
        return { placed: false, failureReason: "piece_empty" };
      }
      const result = this.place(piece, originX, originY);
      if (!result.placed) return result;
      this.tray[slotIndex] = null;
      if (this.allTraySlotsEmpty()) {
        this.refillTray();
      } else {
        this.checkGameOver();
      }
      return result;
    }

    checkGameOver() {
      this.gameOver = !this.canPlaceAnyTrayPiece();
      if (this.gameOver) this.saveHighScore();
      return this.gameOver;
    }
  }

  const SceneBase = typeof Phaser !== "undefined" ? Phaser.Scene : class {};

  class BlockzzleScene extends SceneBase {
    constructor() {
      super("BlockzzleScene");
      this.cellSize = 40;
      this.boardOrigin = { x: 0, y: 0 };
      this.trayOrigins = [];
      this.dragState = null;
      this.previewCells = [];
      this.clearFlashCells = [];
      this.invalidFlashCells = [];
      this.gameOverItems = [];
    }

    create() {
      this.gameModel = new Game();
      this.cameras.main.setBackgroundColor("#10192a");
      this.cellRects = [];
      this.trayGroups = [];
      this.buildStaticUi();
      this.input.on("pointermove", this.handlePointerMove, this);
      this.input.on("pointerup", this.handlePointerUp, this);
      window.addEventListener("resize", () => this.resizeLayout());
      this.resizeLayout();
    }

    buildStaticUi() {
      this.titleText = this.add.text(0, 0, "Blockzzle", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "34px",
        fontStyle: "800",
        color: "#f8fbff",
      });
      this.subtitleText = this.add.text(0, 0, "Free block puzzle game. No install. Just play.", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "15px",
        color: "#b8c4d8",
      });
      this.howToText = this.add.text(
        0,
        0,
        "Drag blocks onto the board. Fill rows or columns to clear lines. Keep going for a high score.",
        this.smallTextStyle(13, "#d6e2f4", "600")
      );
      this.metricBacks = [
        this.add.rectangle(0, 0, 120, 38, 0x172238, 0.96),
        this.add.rectangle(0, 0, 118, 38, 0x172238, 0.96),
        this.add.rectangle(0, 0, 98, 38, 0x172238, 0.96),
      ];
      this.metricBacks.forEach((back) => back.setStrokeStyle(1, 0x34445f, 0.9));
      this.scoreText = this.add.text(0, 0, "", this.smallTextStyle(17, "#f8fbff", "800"));
      this.bestText = this.add.text(0, 0, "", this.smallTextStyle(14, "#d6e2f4", "800"));
      this.linesText = this.add.text(0, 0, "", this.smallTextStyle(14, "#d6e2f4", "800"));
      this.statusText = this.add.text(0, 0, "", this.smallTextStyle(15, "#f8fbff", "700"));
      this.boardBack = this.add.rectangle(0, 0, 100, 100, 0x111b2f, 0.92);
      this.boardBack.setStrokeStyle(2, 0x30425f, 1);
      this.restartButton = this.add.text(0, 0, "Restart", this.smallTextStyle(15, "#07111f", "800"))
        .setPadding(16, 10)
        .setBackgroundColor("#8ee8d2")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.restartGame());
      this.homeLink = this.add.text(0, 0, "Home", this.smallTextStyle(14, "#b8c4d8", "700"))
        .setPadding(12, 8)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          window.location.href = "/";
        });
    }

    restartGame() {
      this.gameModel.restart();
      this.destroyDragGhost();
      this.dragState = null;
      this.previewCells = [];
      this.clearFlashCells = [];
      this.invalidFlashCells = [];
      this.statusText.setText("");
      this.destroyGameOverPanel();
      this.render();
    }

    smallTextStyle(size, color, weight) {
      return {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: `${size}px`,
        fontStyle: weight,
        color,
      };
    }

    resizeLayout() {
      const width = this.scale.width;
      const height = this.scale.height;
      const compact = width < 560;
      const margin = compact ? 18 : 22;
      const headerBottom = compact ? 158 : 142;
      const trayHeight = compact ? 112 : 122;
      const statusHeight = 42;
      this.cellSize = Math.floor(Math.min(
        (width - margin * 2) / 8,
        (height - headerBottom - trayHeight - statusHeight) / 8,
        compact ? 48 : 54
      ));
      this.cellSize = Math.max(32, this.cellSize);
      const boardWidth = this.cellSize * 8;
      const availableForBoard = height - headerBottom - trayHeight - statusHeight;
      const verticalExtra = Math.max(0, availableForBoard - boardWidth);
      this.boardOrigin = {
        x: Math.floor((width - boardWidth) / 2),
        y: Math.floor(headerBottom + Math.min(verticalExtra / 2, compact ? 18 : 28)),
      };
      this.titleText.setFontSize(compact ? 31 : 36);
      this.subtitleText.setFontSize(compact ? 14 : 15);
      this.howToText.setFontSize(compact ? 12 : 13);
      this.howToText.setWordWrapWidth(Math.min(width - margin * 2, compact ? 352 : 680));
      this.titleText.setPosition(margin, 18);
      this.subtitleText.setPosition(margin, 58);
      this.howToText.setPosition(margin, 82);
      const chipY = compact ? 135 : 118;
      const chipGap = 8;
      const chipWidths = compact ? [112, 108, 88] : [124, 124, 104];
      let chipX = margin;
      this.metricBacks.forEach((back, index) => {
        back.setSize(chipWidths[index], 38);
        back.setPosition(chipX + chipWidths[index] / 2, chipY);
        chipX += chipWidths[index] + chipGap;
      });
      this.scoreText.setPosition(margin + 12, chipY - 11);
      this.bestText.setPosition(margin + chipWidths[0] + chipGap + 12, chipY - 10);
      this.linesText.setPosition(margin + chipWidths[0] + chipWidths[1] + chipGap * 2 + 12, chipY - 10);
      this.restartButton.setPosition(width - this.restartButton.width - margin, 18);
      this.homeLink.setPosition(width - this.restartButton.width - this.homeLink.width - margin - 12, 20);
      this.statusText.setFontSize(compact ? 14 : 15);
      this.statusText.setPosition(margin, height - 34);
      this.boardBack.setPosition(this.boardOrigin.x + boardWidth / 2, this.boardOrigin.y + boardWidth / 2);
      this.boardBack.setSize(boardWidth + 8, boardWidth + 8);
      this.render();
    }

    boardToScreen(x, y) {
      return {
        x: this.boardOrigin.x + x * this.cellSize,
        y: this.boardOrigin.y + (7 - y) * this.cellSize,
      };
    }

    screenToBoard(pointer) {
      const x = Math.floor((pointer.x - this.boardOrigin.x) / this.cellSize);
      const yFromTop = Math.floor((pointer.y - this.boardOrigin.y) / this.cellSize);
      const y = 7 - yFromTop;
      if (!this.gameModel.isInside(x, y)) return null;
      return { x, y };
    }

    render() {
      if (!this.gameModel) return;
      this.scoreText.setText(`Score ${this.gameModel.score}`);
      this.bestText.setText(`Best ${this.gameModel.highScore}`);
      this.linesText.setText(`Lines ${this.gameModel.linesCleared}`);
      this.renderBoard();
      this.renderTray();
      this.renderGameOverPanel();
      if (this.gameModel.gameOver) {
        this.statusText.setText("No more valid moves.");
      }
    }

    renderBoard() {
      this.cellRects.forEach((rect) => rect.destroy());
      this.cellRects = [];
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const pos = this.boardToScreen(x, y);
          const value = this.gameModel.board[y][x];
          const isPreview = this.previewCells.some((cell) => cell[0] === x && cell[1] === y);
          const isClearFlash = this.clearFlashCells.some((cell) => cell[0] === x && cell[1] === y);
          const isInvalidFlash = this.invalidFlashCells.some((cell) => cell[0] === x && cell[1] === y);
          let fill = "#182338";
          let alpha = 1;
          let strokeColor = 0x31415f;
          let strokeAlpha = 0.7;
          let strokeWidth = 1;
          if (value) fill = COLORS[(value - 1) % COLORS.length];
          if (isPreview) {
            fill = this.dragState && this.dragState.valid ? "#99f6e4" : "#fda4af";
            alpha = this.dragState && this.dragState.valid ? 0.78 : 0.82;
            strokeColor = this.dragState && this.dragState.valid ? 0x5eead4 : 0xfb7185;
            strokeAlpha = 1;
            strokeWidth = 2;
          }
          if (isInvalidFlash) {
            fill = "#fb7185";
            alpha = 0.92;
            strokeColor = 0xf43f5e;
            strokeAlpha = 1;
            strokeWidth = 2;
          }
          if (isClearFlash) {
            fill = "#fde68a";
            alpha = 0.94;
            strokeColor = 0xfacc15;
            strokeAlpha = 1;
            strokeWidth = 2;
          }
          const rect = this.add.rectangle(
            pos.x + this.cellSize / 2,
            pos.y + this.cellSize / 2,
            this.cellSize - 5,
            this.cellSize - 5,
            Phaser.Display.Color.HexStringToColor(fill).color,
            alpha
          );
          rect.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
          this.cellRects.push(rect);
        }
      }
    }

    renderTray() {
      this.trayGroups.forEach((group) => group.forEach((item) => item.destroy()));
      this.trayGroups = [];
      this.trayOrigins = [];
      const width = this.scale.width;
      const compact = width < 560;
      const trayY = this.boardOrigin.y + this.cellSize * 8 + (compact ? 18 : 22);
      const slotWidth = Math.min(compact ? 104 : 116, (width - 48) / 3);
      const slotHeight = compact ? 92 : 98;
      const startX = (width - slotWidth * 3) / 2;
      this.gameModel.tray.forEach((piece, index) => {
        const x = startX + index * slotWidth + slotWidth / 2;
        this.trayOrigins[index] = { x, y: trayY + 40 };
        const group = [];
        const bg = this.add.rectangle(x, trayY + slotHeight / 2, slotWidth - 10, slotHeight, 0x172238, 0.95);
        bg.setStrokeStyle(piece ? 1 : 1, piece ? 0x3f5577 : 0x273751, piece ? 0.95 : 0.68);
        group.push(bg);
        if (piece) {
          group.push(...this.drawPiece(piece, x, trayY + slotHeight / 2 + 8, Math.max(16, Math.floor(this.cellSize * 0.42))));
          bg.setInteractive({ useHandCursor: true })
            .on("pointerdown", (pointer) => this.startDrag(index, pointer));
        }
        this.trayGroups.push(group);
      });
    }

    destroyGameOverPanel() {
      this.gameOverItems.forEach((item) => item.destroy());
      this.gameOverItems = [];
    }

    renderGameOverPanel() {
      this.destroyGameOverPanel();
      if (!this.gameModel.gameOver) return;

      const width = this.scale.width;
      const panelWidth = Math.min(338, width - 36);
      const panelHeight = 232;
      const boardSize = this.cellSize * 8;
      const centerX = width / 2;
      const centerY = this.boardOrigin.y + boardSize / 2;
      const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x101827, 0.97);
      panel.setStrokeStyle(2, 0x5eead4, 0.85);
      const title = this.add.text(centerX, centerY - 84, "Game over", this.smallTextStyle(28, "#f8fbff", "800"));
      title.setOrigin(0.5, 0);
      const reason = this.add.text(centerX, centerY - 45, "No more valid moves.", this.smallTextStyle(15, "#b8c4d8", "700"));
      reason.setOrigin(0.5, 0);
      const stats = this.add.text(
        centerX,
        centerY - 10,
        `Score ${this.gameModel.score}   Best ${this.gameModel.highScore}   Lines ${this.gameModel.linesCleared}`,
        this.smallTextStyle(14, "#d6e2f4", "800")
      );
      stats.setOrigin(0.5, 0);
      const button = this.add.text(centerX, centerY + 48, "Restart", this.smallTextStyle(16, "#07111f", "800"))
        .setOrigin(0.5, 0)
        .setPadding(28, 11)
        .setBackgroundColor("#8ee8d2")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.restartGame());
      this.gameOverItems.push(panel, title, reason, stats, button);
    }

    drawPiece(piece, centerX, centerY, size, alpha) {
      const bounds = piece.cells.reduce((acc, [x, y]) => ({
        minX: Math.min(acc.minX, x),
        maxX: Math.max(acc.maxX, x),
        minY: Math.min(acc.minY, y),
        maxY: Math.max(acc.maxY, y),
      }), { minX: 99, maxX: -99, minY: 99, maxY: -99 });
      const width = (bounds.maxX - bounds.minX + 1) * size;
      const height = (bounds.maxY - bounds.minY + 1) * size;
      return piece.cells.map(([cellX, cellY]) => {
        const x = centerX - width / 2 + (cellX - bounds.minX) * size + size / 2;
        const y = centerY + height / 2 - (cellY - bounds.minY) * size - size / 2;
        const rect = this.add.rectangle(
          x,
          y,
          size - 3,
          size - 3,
          Phaser.Display.Color.HexStringToColor(COLORS[piece.color % COLORS.length]).color,
          alpha || 1
        );
        rect.setStrokeStyle(1, 0xffffff, 0.22);
        return rect;
      });
    }

    startDrag(slotIndex, pointer) {
      if (this.gameModel.gameOver) return;
      const piece = this.gameModel.tray[slotIndex];
      if (!piece) return;
      this.dragState = {
        slotIndex,
        piece,
        ghost: this.drawPiece(piece, pointer.x, pointer.y - 24, Math.max(20, Math.floor(this.cellSize * 0.5)), 0.78),
        valid: false,
      };
      this.statusText.setText("");
      this.handlePointerMove(pointer);
    }

    handlePointerMove(pointer) {
      if (!this.dragState) return;
      const boardCell = this.screenToBoard(pointer);
      this.previewCells = [];
      if (boardCell) {
        this.previewCells = this.dragState.piece.cells.map(([offsetX, offsetY]) => [boardCell.x + offsetX, boardCell.y + offsetY]);
        this.dragState.valid = this.gameModel.canPlace(this.dragState.piece, boardCell.x, boardCell.y);
        this.statusText.setText(this.dragState.valid ? "Release to place." : "That space is blocked.");
      } else {
        this.dragState.valid = false;
        this.statusText.setText("Drag over the board.");
      }
      this.renderBoard();
      this.dragState.ghost.forEach((item) => item.destroy());
      this.dragState.ghost = this.drawPiece(
        this.dragState.piece,
        pointer.x,
        pointer.y - 28,
        Math.max(22, Math.floor(this.cellSize * 0.52)),
        0.84
      );
    }

    handlePointerUp(pointer) {
      if (!this.dragState) return;
      const state = this.dragState;
      const boardCell = this.screenToBoard(pointer);
      state.ghost.forEach((item) => item.destroy());
      this.dragState = null;
      this.previewCells = [];
      if (!boardCell) {
        this.statusText.setText("Drop onto the board.");
        this.render();
        return;
      }
      const result = this.gameModel.placeTrayPiece(state.slotIndex, boardCell.x, boardCell.y);
      if (!result.placed) {
        this.statusText.setText(result.failureReason === "occupied" ? "That space is blocked." : "That piece does not fit there.");
        this.invalidFlashCells = state.piece.cells
          .map(([offsetX, offsetY]) => [boardCell.x + offsetX, boardCell.y + offsetY])
          .filter(([x, y]) => this.gameModel.isInside(x, y));
        this.render();
        this.time.delayedCall(220, () => {
          this.invalidFlashCells = [];
          this.render();
        });
        return;
      }
      this.clearFlashCells = result.cells || [];
      this.statusText.setText(result.linesCleared ? `Nice clear! +${result.scoreDelta}` : `Placed +${result.scoreDelta}`);
      this.render();
      if (this.clearFlashCells.length) {
        this.time.delayedCall(260, () => {
          this.clearFlashCells = [];
          this.render();
        });
      }
    }

    destroyDragGhost() {
      if (!this.dragState || !this.dragState.ghost) return;
      this.dragState.ghost.forEach((item) => item.destroy());
    }
  }

  function bootPhaserGame(PhaserRef) {
    const target = document.getElementById("blockzzle-game");
    if (!target || target.dataset.booted === "true") return null;
    target.dataset.booted = "true";
    return new PhaserRef.Game({
      type: PhaserRef.AUTO,
      parent: "blockzzle-game",
      width: Math.min(540, window.innerWidth),
      height: window.innerHeight,
      backgroundColor: "#10192a",
      scale: {
        mode: PhaserRef.Scale.RESIZE,
        parent: "blockzzle-game",
        width: "100%",
        height: "100%",
      },
      input: {
        activePointers: 3,
      },
      scene: [BlockzzleScene],
    });
  }

  return {
    BlockzzleCore: {
      Game,
      SHAPES,
      COLORS,
      BOARD_SIZE,
      TRAY_SIZE,
      SCORE_PER_PLACED_CELL,
      SCORE_PER_CLEARED_LINE,
      STORAGE_KEY,
    },
    bootPhaserGame,
  };
});
