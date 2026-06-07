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

  const COLORS = ["#2dd4bf", "#60a5fa", "#f59e0b", "#fb7185", "#a78bfa", "#84cc16"];
  const DRAG_LIFT = { x: 0, y: -28 };

  function getVisualViewportSize() {
    if (typeof window === "undefined") {
      return { width: 540, height: 720 };
    }
    const viewport = window.visualViewport;
    const doc = document.documentElement;
    const width = Math.floor((viewport && viewport.width) || window.innerWidth || doc.clientWidth || 540);
    const height = Math.floor((viewport && viewport.height) || window.innerHeight || doc.clientHeight || 720);
    return {
      width: Math.max(280, width),
      height: Math.max(420, height),
    };
  }

  function syncCssViewportSize() {
    const size = getVisualViewportSize();
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--blockzzle-viewport-width", `${size.width}px`);
      document.documentElement.style.setProperty("--blockzzle-viewport-height", `${size.height}px`);
    }
    return size;
  }

  function getGameSurfaceSize(target) {
    const viewportSize = syncCssViewportSize();
    if (!target) return viewportSize;
    const rect = target.getBoundingClientRect();
    return {
      width: Math.max(280, Math.floor(rect.width || viewportSize.width)),
      height: Math.max(420, Math.floor(rect.height || viewportSize.height)),
    };
  }

  function cloneCells(cells) {
    return cells.map((cell) => [cell[0], cell[1]]);
  }

  function getPieceBounds(piece) {
    const cells = (piece && piece.cells) || [];
    return cells.reduce((acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      maxX: Math.max(acc.maxX, x),
      minY: Math.min(acc.minY, y),
      maxY: Math.max(acc.maxY, y),
    }), { minX: 99, maxX: -99, minY: 99, maxY: -99 });
  }

  function pointToBoardCell(point, layout) {
    if (!point || !layout || !layout.boardOrigin || !layout.cellSize) return null;
    const x = Math.floor((point.x - layout.boardOrigin.x) / layout.cellSize);
    const yFromTop = Math.floor((point.y - layout.boardOrigin.y) / layout.cellSize);
    const y = BOARD_SIZE - 1 - yFromTop;
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
    return { x, y };
  }

  function getDragPlacementCell(piece, pointer, layout, lift) {
    if (!piece || !piece.cells || !piece.cells.length || !pointer) return null;
    const cellSize = layout && layout.cellSize;
    if (!cellSize) return null;
    const bounds = getPieceBounds(piece);
    const dragLift = lift || DRAG_LIFT;
    const centerX = pointer.x + (dragLift.x || 0);
    const centerY = pointer.y + (dragLift.y || 0);
    const width = (bounds.maxX - bounds.minX + 1) * cellSize;
    const height = (bounds.maxY - bounds.minY + 1) * cellSize;
    const originCenter = {
      x: centerX - width / 2 + (0 - bounds.minX) * cellSize + cellSize / 2,
      y: centerY + height / 2 - (0 - bounds.minY) * cellSize - cellSize / 2,
    };
    return pointToBoardCell(originCenter, layout);
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
      const sequence = this.pieceSequence++;
      const color = (sequence + this.randomIndex(COLORS.length)) % COLORS.length;
      const piece = normalizePiece(shape, `piece_${sequence}`, color);
      piece.color = color;
      return piece;
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
      this.feedbackItems = [];
      this.layout = null;
      this.resizeFrame = 0;
      this.viewportResizeHandler = null;
    }

    create() {
      this.gameModel = new Game();
      this.cameras.main.setBackgroundColor("#10192a");
      this.cellRects = [];
      this.trayGroups = [];
      this.buildStaticUi();
      this.input.on("pointermove", this.handlePointerMove, this);
      this.input.on("pointerup", this.handlePointerUp, this);
      this.addViewportListeners();
      this.scheduleViewportResize();
      this.events.once("shutdown", () => this.removeViewportListeners());
    }

    addViewportListeners() {
      if (typeof window === "undefined") return;
      this.viewportResizeHandler = () => this.scheduleViewportResize();
      window.addEventListener("resize", this.viewportResizeHandler, { passive: true });
      window.addEventListener("orientationchange", this.viewportResizeHandler, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", this.viewportResizeHandler, { passive: true });
        window.visualViewport.addEventListener("scroll", this.viewportResizeHandler, { passive: true });
      }
    }

    removeViewportListeners() {
      if (typeof window === "undefined" || !this.viewportResizeHandler) return;
      window.removeEventListener("resize", this.viewportResizeHandler);
      window.removeEventListener("orientationchange", this.viewportResizeHandler);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", this.viewportResizeHandler);
        window.visualViewport.removeEventListener("scroll", this.viewportResizeHandler);
      }
      if (this.resizeFrame) {
        window.cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = 0;
      }
    }

    scheduleViewportResize() {
      if (typeof window === "undefined") {
        this.resizeLayout();
        return;
      }
      if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = 0;
        const target = document.getElementById("blockzzle-game");
        const size = getGameSurfaceSize(target);
        if (this.scale && typeof this.scale.resize === "function") {
          this.scale.resize(size.width, size.height);
        }
        this.resizeLayout();
      });
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
      this.destroyFeedbackItems();
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
      const compact = width < 560 || height < 760;
      const short = height < 700;
      const tiny = height < 610;
      const margin = compact ? Math.max(10, Math.min(16, Math.floor(width * 0.04))) : 22;
      const topY = tiny ? 8 : compact ? 10 : 18;
      const headerBottom = tiny ? 96 : short ? 112 : compact ? 126 : 142;
      const trayGap = tiny ? 8 : compact ? 10 : 18;
      const trayHeight = tiny ? 72 : short ? 78 : compact ? 84 : 98;
      const statusHeight = tiny ? 22 : compact ? 28 : 36;
      const bottomGap = compact ? 8 : 14;
      this.cellSize = Math.floor(Math.min(
        (width - margin * 2) / 8,
        (height - headerBottom - trayGap - trayHeight - statusHeight - bottomGap) / 8,
        compact ? 48 : 54
      ));
      this.cellSize = Math.max(28, this.cellSize);
      const boardWidth = this.cellSize * 8;
      const availableForBoard = height - headerBottom - trayGap - trayHeight - statusHeight - bottomGap;
      const verticalExtra = Math.max(0, availableForBoard - boardWidth);
      const boardY = Math.floor(headerBottom + Math.min(verticalExtra * 0.3, compact ? 12 : 24));
      const trayY = boardY + boardWidth + trayGap;
      const slotWidth = Math.min(compact ? 104 : 116, (width - margin * 2) / 3);
      this.boardOrigin = {
        x: Math.floor((width - boardWidth) / 2),
        y: boardY,
      };
      this.layout = {
        trayY,
        trayHeight,
        slotWidth,
        trayPieceSize: Math.max(tiny ? 14 : 16, Math.floor(this.cellSize * (tiny ? 0.36 : 0.4))),
      };
      this.titleText.setFontSize(tiny ? 22 : short ? 25 : compact ? 28 : 36);
      this.subtitleText.setFontSize(tiny ? 11 : compact ? 12 : 15);
      this.howToText.setFontSize(tiny ? 11 : compact ? 12 : 13);
      this.howToText.setWordWrapWidth(Math.min(width - margin * 2, compact ? 352 : 680));
      this.titleText.setPosition(margin, topY);
      this.subtitleText.setPosition(margin, topY + (tiny ? 28 : compact ? 34 : 40));
      this.howToText.setPosition(margin, topY + (tiny ? 47 : compact ? 55 : 64));
      this.howToText.setVisible(!tiny);
      const chipY = tiny ? 82 : short ? 98 : compact ? 112 : 118;
      const chipGap = compact ? 6 : 8;
      const chipHeight = tiny ? 30 : compact ? 34 : 38;
      const chipWidths = compact ? [104, 102, 78] : [124, 124, 104];
      let chipX = margin;
      this.metricBacks.forEach((back, index) => {
        back.setSize(chipWidths[index], chipHeight);
        back.setPosition(chipX + chipWidths[index] / 2, chipY);
        chipX += chipWidths[index] + chipGap;
      });
      this.scoreText.setFontSize(tiny ? 13 : compact ? 15 : 17);
      this.bestText.setFontSize(tiny ? 12 : compact ? 13 : 14);
      this.linesText.setFontSize(tiny ? 12 : compact ? 13 : 14);
      this.scoreText.setPosition(margin + 10, chipY - (tiny ? 9 : 10));
      this.bestText.setPosition(margin + chipWidths[0] + chipGap + 10, chipY - (tiny ? 8 : 9));
      this.linesText.setPosition(margin + chipWidths[0] + chipWidths[1] + chipGap * 2 + 10, chipY - (tiny ? 8 : 9));
      this.restartButton.setFontSize(compact ? 13 : 15);
      this.restartButton.setPadding(compact ? 10 : 16, compact ? 7 : 10);
      this.homeLink.setFontSize(compact ? 12 : 14);
      this.homeLink.setPadding(compact ? 9 : 12, compact ? 6 : 8);
      this.restartButton.setPosition(width - this.restartButton.width - margin, topY);
      this.homeLink.setPosition(width - this.restartButton.width - this.homeLink.width - margin - (compact ? 8 : 12), topY + 2);
      this.statusText.setFontSize(tiny ? 12 : compact ? 13 : 15);
      this.statusText.setPosition(margin, Math.min(height - bottomGap - statusHeight + 4, trayY + trayHeight + 6));
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
      // Phaser pointer coordinates are already in canvas game space after Scale.RESIZE.
      // Keep this raw conversion strict for non-drag board reads.
      return pointToBoardCell(pointer, {
        boardOrigin: this.boardOrigin,
        cellSize: this.cellSize,
      });
    }

    getDragBoardCell(pointer, piece) {
      // Drag placement uses the lifted visual ghost, not the raw finger/mouse point.
      // This keeps touch drops aligned with what the player sees while still letting
      // Game.canPlace reject pieces that would extend outside or overlap the board.
      return getDragPlacementCell(piece, pointer, {
        boardOrigin: this.boardOrigin,
        cellSize: this.cellSize,
      }, DRAG_LIFT);
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
        this.statusText.setText("No more moves. Play again?");
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
      const layout = this.layout || {};
      const trayY = layout.trayY || this.boardOrigin.y + this.cellSize * 8 + (compact ? 10 : 18);
      const slotWidth = layout.slotWidth || Math.min(compact ? 104 : 116, (width - 48) / 3);
      const slotHeight = layout.trayHeight || (compact ? 84 : 98);
      const pieceSize = layout.trayPieceSize || Math.max(16, Math.floor(this.cellSize * 0.4));
      const startX = (width - slotWidth * 3) / 2;
      this.gameModel.tray.forEach((piece, index) => {
        const x = startX + index * slotWidth + slotWidth / 2;
        this.trayOrigins[index] = { x, y: trayY + slotHeight / 2 };
        const isSelected = Boolean(this.dragState && this.dragState.slotIndex === index && piece);
        const group = [];
        const bg = this.add.rectangle(x, trayY + slotHeight / 2, slotWidth - 10, slotHeight, 0x172238, isSelected ? 0.42 : 0.95);
        bg.setStrokeStyle(
          1,
          piece ? (isSelected ? 0x5eead4 : 0x3f5577) : 0x273751,
          piece ? (isSelected ? 0.55 : 0.95) : 0.68
        );
        group.push(bg);
        if (piece) {
          if (!isSelected) {
            group.push(...this.drawPiece(piece, x, trayY + slotHeight / 2 + Math.min(6, pieceSize * 0.25), pieceSize));
          }
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

    destroyFeedbackItems() {
      this.feedbackItems.forEach((item) => item.destroy());
      this.feedbackItems = [];
    }

    renderGameOverPanel() {
      this.destroyGameOverPanel();
      if (!this.gameModel.gameOver) return;

      const width = this.scale.width;
      const panelWidth = Math.min(338, width - 36);
      const panelHeight = 246;
      const boardSize = this.cellSize * 8;
      const centerX = width / 2;
      const centerY = this.boardOrigin.y + boardSize / 2;
      const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x101827, 0.97);
      panel.setStrokeStyle(2, 0x5eead4, 0.85);
      panel.setDepth(90);
      const title = this.add.text(centerX, centerY - 95, "Out of moves", this.smallTextStyle(27, "#f8fbff", "800"));
      title.setOrigin(0.5, 0);
      title.setDepth(91);
      const reason = this.add.text(
        centerX,
        centerY - 54,
        "Nice run. Try a fresh board and beat your best.",
        this.smallTextStyle(15, "#b8c4d8", "700")
      );
      reason.setOrigin(0.5, 0);
      reason.setAlign("center");
      reason.setWordWrapWidth(panelWidth - 48);
      reason.setDepth(91);
      const stats = this.add.text(
        centerX,
        centerY + 2,
        `Score ${this.gameModel.score}    Best ${this.gameModel.highScore}\nLines ${this.gameModel.linesCleared}`,
        this.smallTextStyle(14, "#d6e2f4", "800")
      );
      stats.setOrigin(0.5, 0);
      stats.setAlign("center");
      stats.setDepth(91);
      const button = this.add.text(centerX, centerY + 66, "Play again", this.smallTextStyle(16, "#07111f", "800"))
        .setOrigin(0.5, 0)
        .setPadding(28, 11)
        .setBackgroundColor("#8ee8d2")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.restartGame());
      button.setDepth(91);
      this.gameOverItems.push(panel, title, reason, stats, button);
    }

    showFloatingText(text, x, y, color, options) {
      const opts = options || {};
      const label = this.add.text(
        x,
        y,
        text,
        this.smallTextStyle(opts.fontSize || 18, color || "#f8fbff", "800")
      );
      label.setOrigin(0.5, 0.5);
      label.setAlign("center");
      label.setStroke("#101827", 5);
      label.setDepth(80);
      this.feedbackItems.push(label);
      this.tweens.add({
        targets: label,
        y: y - (opts.lift || 28),
        alpha: 0,
        scale: opts.scale || 1.08,
        duration: opts.duration || 720,
        ease: "Cubic.easeOut",
        onComplete: () => {
          label.destroy();
          this.feedbackItems = this.feedbackItems.filter((item) => item !== label);
        },
      });
      return label;
    }

    playLineClearFeedback(result) {
      if (!result.linesCleared || !result.cells || !result.cells.length) return;
      const boardCenterX = this.boardOrigin.x + this.cellSize * 4;
      const boardCenterY = this.boardOrigin.y + this.cellSize * 4;
      const label = result.linesCleared === 1 ? "Line clear" : `${result.linesCleared} lines clear`;
      this.showFloatingText(`${label}! +${result.scoreDelta}`, boardCenterX, boardCenterY, "#fde68a", {
        fontSize: 21,
        lift: 34,
        duration: 850,
        scale: 1.12,
      });
      result.cells.forEach(([cellX, cellY], index) => {
        const pos = this.boardToScreen(cellX, cellY);
        const burst = this.add.rectangle(
          pos.x + this.cellSize / 2,
          pos.y + this.cellSize / 2,
          this.cellSize - 7,
          this.cellSize - 7,
          0xfde68a,
          0.58
        );
        burst.setStrokeStyle(2, 0xffffff, 0.5);
        burst.setDepth(70);
        this.feedbackItems.push(burst);
        this.tweens.add({
          targets: burst,
          alpha: 0,
          scaleX: 1.42,
          scaleY: 1.42,
          duration: 420,
          delay: Math.min(120, index * 10),
          ease: "Cubic.easeOut",
          onComplete: () => {
            burst.destroy();
            this.feedbackItems = this.feedbackItems.filter((item) => item !== burst);
          },
        });
      });
    }

    playInvalidFeedback(pointer, failureReason) {
      const message = failureReason === "occupied" ? "Blocked spot" : "Try another spot";
      const x = pointer ? pointer.x : this.boardOrigin.x + this.cellSize * 4;
      const y = pointer ? Math.max(40, pointer.y - 18) : this.boardOrigin.y + this.cellSize * 4;
      this.showFloatingText(message, x, y, "#fda4af", {
        fontSize: 15,
        lift: 18,
        duration: 520,
        scale: 1.02,
      });
    }

    getPieceCellDrawPositions(piece, centerX, centerY, size) {
      const bounds = getPieceBounds(piece);
      const width = (bounds.maxX - bounds.minX + 1) * size;
      const height = (bounds.maxY - bounds.minY + 1) * size;
      return piece.cells.map(([cellX, cellY]) => ({
        x: centerX - width / 2 + (cellX - bounds.minX) * size + size / 2,
        y: centerY + height / 2 - (cellY - bounds.minY) * size - size / 2,
      }));
    }

    drawPiece(piece, centerX, centerY, size, alpha, depth) {
      return this.getPieceCellDrawPositions(piece, centerX, centerY, size).map((pos) => {
        const rect = this.add.rectangle(
          pos.x,
          pos.y,
          size - 3,
          size - 3,
          Phaser.Display.Color.HexStringToColor(COLORS[piece.color % COLORS.length]).color,
          alpha || 1
        );
        rect.setStrokeStyle(1, 0xffffff, 0.22);
        rect.setDepth(depth || 20);
        return rect;
      });
    }

    startDrag(slotIndex, pointer) {
      if (this.gameModel.gameOver) return;
      const piece = this.gameModel.tray[slotIndex];
      if (!piece) return;
      const trayOrigin = this.trayOrigins[slotIndex] || { x: pointer.x, y: pointer.y };
      const ghostSize = Math.max(22, Math.floor(this.cellSize * 0.54));
      this.dragState = {
        slotIndex,
        piece,
        trayOrigin: { ...trayOrigin },
        ghostSize,
        ghost: this.drawPiece(piece, trayOrigin.x, trayOrigin.y, ghostSize, 0.9, 60),
        valid: false,
        boardCell: null,
        returning: false,
      };
      this.statusText.setText("");
      this.renderTray();
      this.handlePointerMove(pointer);
    }

    handlePointerMove(pointer) {
      if (!this.dragState || this.dragState.returning) return;
      const boardCell = this.getDragBoardCell(pointer, this.dragState.piece);
      this.previewCells = [];
      if (boardCell) {
        this.previewCells = this.dragState.piece.cells.map(([offsetX, offsetY]) => [boardCell.x + offsetX, boardCell.y + offsetY]);
        this.dragState.valid = this.gameModel.canPlace(this.dragState.piece, boardCell.x, boardCell.y);
        this.dragState.boardCell = boardCell;
        this.statusText.setText(this.dragState.valid ? "Release to place." : "Try another spot.");
      } else {
        this.dragState.valid = false;
        this.dragState.boardCell = null;
        this.statusText.setText("Drag over the board.");
      }
      this.renderBoard();
      this.moveDragGhost(pointer, false);
    }

    handlePointerUp(pointer) {
      if (!this.dragState || this.dragState.returning) return;
      const state = this.dragState;
      const boardCell = this.getDragBoardCell(pointer, state.piece);
      this.previewCells = [];
      if (!boardCell) {
        this.statusText.setText("Drop onto the board.");
        this.renderBoard();
        this.playInvalidFeedback(pointer, "out_of_bounds");
        this.animateGhostBackToTray(state);
        return;
      }
      const result = this.gameModel.placeTrayPiece(state.slotIndex, boardCell.x, boardCell.y);
      if (!result.placed) {
        this.statusText.setText(result.failureReason === "occupied" ? "Blocked spot." : "Try another spot.");
        this.invalidFlashCells = state.piece.cells
          .map(([offsetX, offsetY]) => [boardCell.x + offsetX, boardCell.y + offsetY])
          .filter(([x, y]) => this.gameModel.isInside(x, y));
        this.renderBoard();
        this.playInvalidFeedback(pointer, result.failureReason);
        this.animateGhostBackToTray(state);
        return;
      }
      state.ghost.forEach((item) => item.destroy());
      this.dragState = null;
      this.clearFlashCells = result.cells || [];
      this.statusText.setText(result.linesCleared ? `Nice clear! +${result.scoreDelta}` : `Placed +${result.scoreDelta}`);
      this.render();
      if (this.clearFlashCells.length) {
        this.playLineClearFeedback(result);
        this.time.delayedCall(360, () => {
          this.clearFlashCells = [];
          this.render();
        });
      }
    }

    moveDragGhost(pointer, immediate) {
      if (!this.dragState || !this.dragState.ghost) return;
      const centerX = pointer.x + DRAG_LIFT.x;
      const centerY = pointer.y + DRAG_LIFT.y;
      const positions = this.getPieceCellDrawPositions(this.dragState.piece, centerX, centerY, this.dragState.ghostSize);
      this.dragState.ghost.forEach((item, index) => {
        const target = positions[index];
        this.tweens.killTweensOf(item);
        if (immediate) {
          item.setPosition(target.x, target.y);
          return;
        }
        this.tweens.add({
          targets: item,
          x: target.x,
          y: target.y,
          duration: 55,
          ease: "Sine.easeOut",
        });
      });
    }

    animateGhostBackToTray(state) {
      if (!state || !state.ghost || state.returning) return;
      state.returning = true;
      const layout = this.layout || {};
      const trayPieceSize = layout.trayPieceSize || Math.max(16, Math.floor(this.cellSize * 0.4));
      const targetY = state.trayOrigin.y + Math.min(6, trayPieceSize * 0.25);
      const positions = this.getPieceCellDrawPositions(state.piece, state.trayOrigin.x, targetY, trayPieceSize);
      let remaining = state.ghost.length;
      state.ghost.forEach((item, index) => {
        const target = positions[index];
        this.tweens.killTweensOf(item);
        this.tweens.add({
          targets: item,
          x: target.x,
          y: target.y,
          scaleX: trayPieceSize / state.ghostSize,
          scaleY: trayPieceSize / state.ghostSize,
          alpha: 0.58,
          duration: 180,
          ease: "Cubic.easeOut",
          onComplete: () => {
            remaining -= 1;
            if (remaining > 0) return;
            state.ghost.forEach((ghostItem) => ghostItem.destroy());
            if (this.dragState === state) this.dragState = null;
            this.invalidFlashCells = [];
            this.previewCells = [];
            this.render();
          },
        });
      });
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
    const surfaceSize = getGameSurfaceSize(target);
    return new PhaserRef.Game({
      type: PhaserRef.AUTO,
      parent: "blockzzle-game",
      width: surfaceSize.width,
      height: surfaceSize.height,
      backgroundColor: "#10192a",
      scale: {
        mode: PhaserRef.Scale.RESIZE,
        parent: "blockzzle-game",
        width: surfaceSize.width,
        height: surfaceSize.height,
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
      getDragPlacementCell,
    },
    bootPhaserGame,
  };
});
