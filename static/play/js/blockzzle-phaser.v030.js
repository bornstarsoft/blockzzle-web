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
  const SOUND_STORAGE_KEY = "blockzzleSoundEnabledV1";
  const TODAY_BEST_STORAGE_KEY = "blockzzleTodayBestV1";
  const TODAY_BEST_DATE_STORAGE_KEY = "blockzzleTodayBestDateV1";
  const GAMES_PLAYED_STORAGE_KEY = "blockzzleGamesPlayedV1";
  const LAST_SCORE_STORAGE_KEY = "blockzzleLastScoreV1";
  const BEST_LINES_STORAGE_KEY = "blockzzleBestLinesV1";
  const BEST_CLEAR_LINES_STORAGE_KEY = "blockzzleBestClearLinesV1";
  const ANON_PLAYER_ID_STORAGE_KEY = "blockzzleAnonPlayerIdV1";
  const NICKNAME_STORAGE_KEY = "blockzzleNicknameV1";
  const CLIENT_VERSION = "v030";
  const BOARD_VERSION = "classic-v1";
  const EMBED_HOME_MODE = "home";

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
  const SOUND_CUES = {
    place: { type: "pop", frequency: 360, endFrequency: 520, durationMs: 90, volume: 0.075, wave: "sine" },
    invalid: { type: "thud", frequency: 120, endFrequency: 72, durationMs: 110, volume: 0.08, wave: "triangle" },
    clear: { type: "chime", frequency: 660, endFrequency: 990, durationMs: 180, volume: 0.105, wave: "sine" },
    clearDouble: { type: "chime", frequency: 760, endFrequency: 1140, durationMs: 190, volume: 0.112, wave: "sine" },
    clearTriple: { type: "chime2", frequency: 820, endFrequency: 1230, durationMs: 210, volume: 0.116, wave: "sine" },
    clearMega: { type: "fanfare", frequency: 660, endFrequency: 1320, durationMs: 245, volume: 0.118, wave: "sine" },
    gameOver: { type: "down", frequency: 320, endFrequency: 170, durationMs: 240, volume: 0.07, wave: "triangle" },
    restart: { type: "click", frequency: 420, endFrequency: 520, durationMs: 55, volume: 0.045, wave: "sine" },
  };
  const AUDIO_UNLOCK_CUE = { type: "unlock", frequency: 420, endFrequency: 420, durationMs: 45, volume: 0.008, wave: "sine" };
  const AUDIO_UNLOCK_EVENTS = ["pointerdown", "touchstart", "mousedown", "keydown"];
  const AUDIO_UNLOCK_LISTENER_OPTIONS = { capture: true, passive: true };
  const AUDIO_UNLOCK_RETRY_MS = 650;
  const SCORE_TIERS = [
    { label: "Rookie", minScore: 0 },
    { label: "Beginner", minScore: 1000 },
    { label: "Skilled", minScore: 3000 },
    { label: "Expert", minScore: 5000 },
    { label: "Master", minScore: 10000 },
    { label: "World Class", minScore: 20000 },
  ];
  const LEADERBOARD_BLOCKED_NICKNAMES = ["admin", "moderator", "support", "staff", "owner", "badword"];
  const ORIENTATION_RELAYOUT_DELAYS = [0, 100, 300, 600];

  function getEmbedModeFromSearch(search) {
    const input = String(search || "");
    const normalized = input.charAt(0) === "?" ? input.slice(1) : input;
    if (!normalized) return "";
    return normalized.split("&").reduce((mode, part) => {
      if (mode) return mode;
      const pieces = part.split("=");
      const key = decodeURIComponent((pieces[0] || "").replace(/\+/g, " ")).trim();
      if (key !== "embed") return "";
      return decodeURIComponent((pieces.slice(1).join("=") || "").replace(/\+/g, " ")).trim().toLowerCase();
    }, "");
  }

  function isHomeEmbedMode(search) {
    return getEmbedModeFromSearch(search) === EMBED_HOME_MODE;
  }

  function getPlayLayoutProfile(options) {
    const opts = options || {};
    const width = Math.floor(opts.width || 390);
    const height = Math.floor(opts.height || 720);
    const compact = width < 560 || height < 760;
    const short = height < 700;
    const tiny = height < 610;
    const embedHome = Boolean(opts.embedHome);
    if (!embedHome) {
      return {
        compact,
        short,
        tiny,
        topY: tiny ? 8 : compact ? 10 : 18,
        headerBottom: tiny ? 118 : short ? 132 : compact ? 146 : 142,
        trayGap: tiny ? 8 : compact ? 10 : 18,
        statusHeight: tiny ? 22 : compact ? 28 : 36,
        bottomGap: compact ? 8 : 14,
        chipY: tiny ? 78 : short ? 92 : compact ? 104 : 118,
        showTitle: true,
        showSubtitle: true,
        showHowTo: !compact,
        showHomeLink: true,
        showLeaderboardButton: true,
        showNextGoalText: true,
        ...getMetricChipLayout({ width, compact, tiny, embedHome }),
      };
    }
    return {
      compact,
      short,
      tiny,
      topY: tiny ? 6 : 8,
      headerBottom: tiny ? 104 : short ? 112 : compact ? 114 : 118,
      trayGap: tiny ? 7 : compact ? 8 : 14,
      statusHeight: tiny ? 22 : compact ? 26 : 32,
      bottomGap: compact ? 10 : 14,
      chipY: tiny ? 62 : compact ? 66 : 72,
      showTitle: false,
      showSubtitle: false,
      showHowTo: false,
      showHomeLink: false,
      showLeaderboardButton: false,
      showNextGoalText: false,
      ...getMetricChipLayout({ width, compact, tiny, embedHome }),
    };
  }

  function getMetricChipLayout(options) {
    const opts = options || {};
    const width = Math.max(280, Math.floor(opts.width || 390));
    const compact = typeof opts.compact === "boolean" ? opts.compact : width < 560;
    const tiny = Boolean(opts.tiny);
    const embedHome = Boolean(opts.embedHome);
    const margin = typeof opts.margin === "number"
      ? opts.margin
      : getTouchEdgeInset({ width, compact });
    const chipGap = embedHome ? 4 : compact ? 5 : 8;
    const chipHeight = tiny ? (embedHome ? 28 : 30) : compact ? (embedHome ? 32 : 34) : 38;
    const available = Math.max(220, width - margin * 2);
    const desired = compact
      ? embedHome
        ? [82, 82, 84, 70]
        : [94, 94, 94, 78]
      : [132, 126, 132, 104];
    const minimum = tiny
      ? [62, 62, 66, 56]
      : compact
        ? [74, 74, 78, 62]
        : [96, 96, 104, 84];
    const totalGap = chipGap * (desired.length - 1);
    const targetWidth = Math.max(0, available - totalGap);
    const desiredTotal = desired.reduce((total, value) => total + value, 0);
    const minimumTotal = minimum.reduce((total, value) => total + value, 0);
    let chipWidths;
    if (desiredTotal <= targetWidth) {
      chipWidths = desired.slice();
    } else if (minimumTotal < targetWidth) {
      const scale = (targetWidth - minimumTotal) / (desiredTotal - minimumTotal);
      chipWidths = desired.map((value, index) => Math.floor(minimum[index] + (value - minimum[index]) * scale));
    } else {
      const equalWidth = Math.floor(targetWidth / desired.length);
      chipWidths = desired.map((value, index) => Math.max(Math.min(value, equalWidth), Math.min(minimum[index], equalWidth)));
    }

    let renderedTotal = chipWidths.reduce((total, value) => total + value, 0) + totalGap;
    while (renderedTotal > available && chipWidths.some((value) => value > 48)) {
      const widestIndex = chipWidths.reduce((widest, value, index) => (
        value > chipWidths[widest] ? index : widest
      ), 0);
      chipWidths[widestIndex] -= 1;
      renderedTotal -= 1;
    }

    const textPadding = tiny ? 6 : compact ? 7 : 10;
    const scoreFontSize = tiny ? 13 : compact ? 15 : 17;
    const metaFontSize = tiny ? 11 : compact ? 12 : 14;
    const minFontSize = tiny ? 8 : compact ? 9 : 11;
    return {
      metricChipGap: chipGap,
      metricChipHeight: chipHeight,
      metricChipWidths: chipWidths,
      metricTextPadding: textPadding,
      metricScoreFontSize: scoreFontSize,
      metricMetaFontSize: metaFontSize,
      metricMinFontSize: minFontSize,
      metricTextMaxWidths: chipWidths.map((chipWidth) => Math.max(34, chipWidth - textPadding * 2)),
    };
  }

  function getMetricTextFontSize(text, maxWidth, preferredSize, minSize) {
    const value = String(text || "");
    const preferred = Math.max(1, Math.floor(preferredSize || 14));
    const minimum = Math.max(1, Math.floor(minSize || 10));
    const width = Math.max(1, Math.floor(maxWidth || 1));
    const approximateWidth = Math.max(1, value.length * preferred * 0.58);
    if (approximateWidth <= width) return preferred;
    return Math.max(minimum, Math.min(preferred, Math.floor(width / Math.max(1, value.length * 0.58))));
  }

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
      height: Math.max(280, height),
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
    return {
      width: Math.max(280, Math.floor(viewportSize.width)),
      height: Math.max(280, Math.floor(viewportSize.height)),
    };
  }

  function getOrientationRelayoutDelays() {
    return ORIENTATION_RELAYOUT_DELAYS.slice();
  }

  function shouldShowPortraitPrompt(size) {
    const width = Math.floor((size && size.width) || 0);
    const height = Math.floor((size && size.height) || 0);
    return width > height && height < 560 && width < 1000;
  }

  function cloneCells(cells) {
    return cells.map((cell) => [cell[0], cell[1]]);
  }

  function parseSoundPreference(value) {
    return value === "true";
  }

  function shouldRestoreSoundOnPageLoad() {
    // A saved preference cannot restore an unlocked AudioContext on iOS Safari.
    // Boot honestly as Sound Off, then let the Sound button perform activation.
    return false;
  }

  function getSoundToggleLabel(isEnabled) {
    return isEnabled ? "Sound On" : "Sound Off";
  }

  function shouldPrimeAudioOnGesture(isSoundEnabled, audioState) {
    return Boolean(isSoundEnabled && (!audioState || audioState === "suspended" || audioState === "closed"));
  }

  function getAudioUnlockStatus(isSoundEnabled, audioState, audioUnlocked) {
    const ready = Boolean(isSoundEnabled && audioState === "running" && audioUnlocked);
    return {
      pending: Boolean(isSoundEnabled && !ready),
      ready,
    };
  }

  function shouldAttemptAudioUnlock(isSoundEnabled, audioReady, now, lastAttemptAt) {
    if (!isSoundEnabled || audioReady) return false;
    if (!lastAttemptAt) return true;
    return now - lastAttemptAt >= AUDIO_UNLOCK_RETRY_MS;
  }

  function getLineClearBonus(linesCleared) {
    const lines = Math.max(0, Number.parseInt(linesCleared || 0, 10) || 0);
    if (lines <= 1) return 0;
    if (lines === 2) return 100;
    if (lines === 3) return 250;
    if (lines === 4) return 500;
    return 800 + (lines - 5) * 200;
  }

  function getClearTier(linesCleared) {
    const lines = Math.max(0, Number.parseInt(linesCleared || 0, 10) || 0);
    if (lines >= 5) return { label: "Ultra Clear!", level: 5, sound: "clearMega" };
    if (lines >= 4) return { label: "Mega Clear!", level: 4, sound: "clearMega" };
    if (lines === 3) return { label: "Triple Clear!", level: 3, sound: "clearTriple" };
    if (lines === 2) return { label: "Double Clear!", level: 2, sound: "clearDouble" };
    if (lines === 1) return { label: "Line Clear", level: 1, sound: "clear" };
    return { label: "", level: 0, sound: "" };
  }

  function formatScore(value) {
    const score = Math.max(0, Number.parseInt(value || 0, 10) || 0);
    return score.toLocaleString("en-US");
  }

  function getScoreTier(score) {
    const value = Math.max(0, Number.parseInt(score || 0, 10) || 0);
    let tierIndex = 0;
    for (let index = 0; index < SCORE_TIERS.length; index += 1) {
      if (value >= SCORE_TIERS[index].minScore) tierIndex = index;
    }
    const tier = SCORE_TIERS[tierIndex];
    const next = SCORE_TIERS[tierIndex + 1];
    return {
      label: tier.label,
      minScore: tier.minScore,
      nextLabel: next ? next.label : "",
      nextScore: next ? next.minScore : 0,
    };
  }

  function getScoreTierGoalText(score) {
    const tier = getScoreTier(score);
    if (!tier.nextScore) return "Top local tier reached";
    return `Next: ${tier.nextLabel} ${formatScore(tier.nextScore)}`;
  }

  function parseStoredStat(value) {
    const parsed = Number.parseInt(value || "0", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function getTodayKey(date) {
    const localDate = date || new Date();
    return [
      localDate.getFullYear(),
      padDatePart(localDate.getMonth() + 1),
      padDatePart(localDate.getDate()),
    ].join("-");
  }

  function normalizeRepeatStats(raw, todayKey) {
    const input = raw || {};
    const dateKey = todayKey || getTodayKey();
    const storedDate = input.todayBestDate || "";
    return {
      todayBestDate: dateKey,
      todayBest: storedDate === dateKey ? parseStoredStat(input.todayBest) : 0,
      gamesPlayed: parseStoredStat(input.gamesPlayed),
      lastScore: parseStoredStat(input.lastScore),
      bestLines: parseStoredStat(input.bestLines),
      bestClearLines: parseStoredStat(input.bestClearLines),
    };
  }

  function completeRepeatStats(stats, score, lines, todayKey, bestClearLines) {
    const dateKey = todayKey || getTodayKey();
    const current = normalizeRepeatStats(stats, dateKey);
    const completedScore = Math.max(0, Number.parseInt(score || 0, 10) || 0);
    const completedLines = Math.max(0, Number.parseInt(lines || 0, 10) || 0);
    const completedBestClear = Math.max(0, Number.parseInt(bestClearLines || 0, 10) || 0);
    return {
      todayBestDate: dateKey,
      todayBest: Math.max(current.todayBest, completedScore),
      gamesPlayed: current.gamesPlayed + 1,
      lastScore: completedScore,
      bestLines: Math.max(current.bestLines, completedLines),
      bestClearLines: Math.max(current.bestClearLines, completedBestClear),
    };
  }

  function normalizeInteger(value) {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      return Number.parseInt(value, 10);
    }
    return null;
  }

  function validateLeaderboardNickname(value) {
    const nickname = String(value || "").trim().replace(/\s+/g, " ");
    if (nickname.length < 2 || nickname.length > 16) {
      return { ok: false, error: "Nickname must be 2-16 characters." };
    }
    if (!/^[A-Za-z0-9 _-]+$/.test(nickname)) {
      return { ok: false, error: "Nickname can use letters, numbers, spaces, underscore, and hyphen." };
    }
    if (LEADERBOARD_BLOCKED_NICKNAMES.includes(nickname.toLowerCase())) {
      return { ok: false, error: "Please choose another nickname." };
    }
    return { ok: true, nickname };
  }

  function validateLeaderboardSubmission(input) {
    const body = input || {};
    const nicknameResult = validateLeaderboardNickname(body.nickname);
    if (!nicknameResult.ok) return nicknameResult;
    const score = normalizeInteger(body.score);
    const lines = normalizeInteger(body.lines);
    const bestClear = normalizeInteger(body.best_clear);
    const durationSeconds = body.duration_seconds === undefined || body.duration_seconds === null || body.duration_seconds === ""
      ? null
      : normalizeInteger(body.duration_seconds);
    const tier = String(body.tier || "").trim();
    const clientVersion = String(body.client_version || CLIENT_VERSION).trim();
    const browserPlayerId = String(body.browser_player_id || "").trim();
    const allowedTiers = SCORE_TIERS.map((scoreTier) => scoreTier.label);
    if (score === null || score < 0 || score > 1000000) {
      return { ok: false, error: "Score is outside the MVP leaderboard range." };
    }
    if (lines === null || lines < 0 || lines > 10000) {
      return { ok: false, error: "Line count is outside the MVP leaderboard range." };
    }
    if (bestClear === null || bestClear < 0 || bestClear > 16) {
      return { ok: false, error: "Best clear is outside the MVP leaderboard range." };
    }
    if (!allowedTiers.includes(tier)) {
      return { ok: false, error: "Score tier is not supported." };
    }
    if (durationSeconds !== null && durationSeconds < 0) {
      return { ok: false, error: "Run duration is outside the MVP leaderboard range." };
    }
    if (durationSeconds !== null && score > 0 && durationSeconds < 5) {
      return { ok: false, error: "Run duration is too short for leaderboard submission." };
    }
    if (durationSeconds !== null && durationSeconds < 10 && score > 3000) {
      return { ok: false, error: "Score is too high for the submitted duration." };
    }
    if (durationSeconds !== null && durationSeconds < 30 && score > 15000) {
      return { ok: false, error: "Score is too high for the submitted duration." };
    }
    if (clientVersion.length > 20) {
      return { ok: false, error: "Client version is outside the MVP leaderboard range." };
    }
    if (browserPlayerId.length > 80) {
      return { ok: false, error: "Browser player id is outside the MVP leaderboard range." };
    }
    return {
      ok: true,
      entry: {
        nickname: nicknameResult.nickname,
        score,
        lines,
        best_clear: bestClear,
        tier,
        duration_seconds: durationSeconds,
        board_version: BOARD_VERSION,
        client_version: clientVersion || CLIENT_VERSION,
        browser_player_id: browserPlayerId,
      },
    };
  }

  function getLeaderboardSubmitErrorMessage(error, fallback) {
    if (error === "rate_limited") {
      return "Leaderboard submission was limited. Try again later.";
    }
    if (error === "invalid_submission") {
      return "Score could not be submitted.";
    }
    if (error === "leaderboard_unavailable") {
      return "Leaderboard is coming soon.";
    }
    return fallback || "Leaderboard is temporarily unavailable.";
  }

  function createRandomHex(length, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    let text = "";
    for (let index = 0; index < length; index += 1) {
      text += Math.floor(random() * 16).toString(16);
    }
    return text;
  }

  function getOrCreateBrowserPlayerId(storage, rng) {
    const targetStorage = storage || (typeof window !== "undefined" ? window.localStorage : null);
    try {
      const stored = targetStorage && targetStorage.getItem(ANON_PLAYER_ID_STORAGE_KEY);
      if (stored && /^bz_[0-9a-f]{32}$/.test(stored)) return stored;
      let hex = "";
      if (!rng && typeof crypto !== "undefined" && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      } else {
        hex = createRandomHex(32, rng);
      }
      const id = `bz_${hex}`;
      if (targetStorage) targetStorage.setItem(ANON_PLAYER_ID_STORAGE_KEY, id);
      return id;
    } catch (error) {
      return `bz_${createRandomHex(32, rng)}`;
    }
  }

  function getLeaderboardGameOverLayout(options) {
    const opts = options || {};
    const centerX = Number.isFinite(opts.centerX) ? opts.centerX : 0;
    const centerY = Number.isFinite(opts.centerY) ? opts.centerY : 0;
    const panelHeight = Number.isFinite(opts.panelHeight) ? opts.panelHeight : 412;
    const panelTop = centerY - panelHeight / 2;
    const panelBottom = centerY + panelHeight / 2;
    const playAgainTop = panelBottom - 49;
    return {
      panelTop,
      panelBottom,
      title: { x: centerX, y: panelTop + 15 },
      reason: { x: centerX, y: panelTop + 46 },
      stats: { x: centerX, y: panelTop + 73 },
      divider: { x: centerX, y: panelTop + 169 },
      leaderboardHeading: { x: centerX, y: panelTop + 179 },
      nickname: { x: centerX, y: panelTop + 198 },
      submitButton: {
        x: centerX,
        y: panelTop + 218,
        height: 34,
        bottom: panelTop + 252,
      },
      tabButtons: { y: panelTop + 258 },
      todayButton: { x: centerX - 42, y: panelTop + 258 },
      allTimeButton: { x: centerX + 52, y: panelTop + 258 },
      leaderboardText: { x: centerX, y: panelTop + 292 },
      submitStatus: { x: centerX, y: panelTop + 330 },
      playAgainButton: {
        x: centerX,
        y: playAgainTop,
        height: 37,
        bottom: playAgainTop + 37,
      },
    };
  }

  function getLeaderboardButtonLayout(options) {
    const opts = options || {};
    const width = Number.isFinite(opts.width) ? opts.width : 390;
    const margin = Number.isFinite(opts.margin) ? opts.margin : 20;
    const restartButton = opts.restartButton || {};
    const buttonWidth = Number.isFinite(opts.buttonWidth) ? opts.buttonWidth : 52;
    const buttonHeight = Number.isFinite(opts.buttonHeight) ? opts.buttonHeight : 26;
    const boardTop = Number.isFinite(opts.boardTop) ? opts.boardTop : Infinity;
    const restartX = Number.isFinite(restartButton.x) ? restartButton.x : width - margin - buttonWidth;
    const restartY = Number.isFinite(restartButton.y) ? restartButton.y : 0;
    const restartWidth = Number.isFinite(restartButton.width) ? restartButton.width : buttonWidth;
    const restartHeight = Number.isFinite(restartButton.height) ? restartButton.height : 32;
    const rightAlignedX = restartX + restartWidth - buttonWidth;
    const maxYBeforeBoard = boardTop - buttonHeight - 8;
    const preferredY = restartY + restartHeight + 7;
    return {
      x: Math.max(margin, Math.min(rightAlignedX, width - margin - buttonWidth)),
      y: Math.max(restartY + restartHeight + 2, Math.min(preferredY, maxYBeforeBoard)),
      width: buttonWidth,
      height: buttonHeight,
      bottom: Math.max(restartY + restartHeight + 2, Math.min(preferredY, maxYBeforeBoard)) + buttonHeight,
    };
  }

  function getLeaderboardSubmitCta(options) {
    const opts = options || {};
    if (opts.submitted) {
      return {
        buttonLabel: "Submitted",
        message: "Score submitted",
        primary: false,
        fill: "#a7f3d0",
        text: "#07111f",
      };
    }
    if (opts.submitting) {
      return {
        buttonLabel: "Submitting...",
        message: "Submitting score...",
        primary: true,
        fill: "#facc15",
        text: "#07111f",
      };
    }
    const score = Math.max(0, Number.parseInt(opts.score || 0, 10) || 0);
    const previousTodayBest = Math.max(0, Number.parseInt(opts.previousTodayBest || 0, 10) || 0);
    const isNewTodayBest = score > previousTodayBest;
    return {
      buttonLabel: isNewTodayBest ? "Submit Score" : "Submit anyway",
      message: isNewTodayBest ? "New Today Best!" : "Score saved locally.",
      primary: isNewTodayBest,
      fill: isNewTodayBest ? "#facc15" : "#172238",
      text: isNewTodayBest ? "#07111f" : "#d6e2f4",
    };
  }

  function colorForPiece(piece) {
    const colorIndex = piece && typeof piece.color === "number" ? piece.color : 0;
    return COLORS[((colorIndex % COLORS.length) + COLORS.length) % COLORS.length];
  }

  function hexToNumber(hex) {
    return Number.parseInt(String(hex).replace("#", ""), 16);
  }

  function getPreviewCellStyle(piece, isValid) {
    const fill = colorForPiece(piece);
    return {
      fill,
      alpha: isValid ? 0.56 : 0.34,
      strokeColor: isValid ? hexToNumber(fill) : 0xfb7185,
      strokeAlpha: isValid ? 0.95 : 1,
      strokeWidth: 2,
    };
  }

  function getBoardCellStyle(options) {
    const opts = options || {};
    const value = opts.value || 0;
    let fill = value ? COLORS[(value - 1) % COLORS.length] : "#182338";
    let alpha = 1;
    let strokeColor = 0x31415f;
    let strokeAlpha = 0.7;
    let strokeWidth = 1;
    if (opts.isPreview) {
      const style = getPreviewCellStyle(opts.previewPiece, opts.previewValid);
      fill = style.fill;
      alpha = style.alpha;
      strokeColor = style.strokeColor;
      strokeAlpha = style.strokeAlpha;
      strokeWidth = style.strokeWidth;
    }
    if (opts.isInvalidFlash) {
      fill = "#fb7185";
      alpha = 0.92;
      strokeColor = 0xf43f5e;
      strokeAlpha = 1;
      strokeWidth = 2;
    }
    if (opts.isClearFlash) {
      fill = "#fff8cf";
      alpha = 1;
      strokeColor = 0xffffff;
      strokeAlpha = 1;
      strokeWidth = 3;
    }
    return { fill, alpha, strokeColor, strokeAlpha, strokeWidth };
  }

  function getReturnGhostScale(ghostSize, trayPieceSize) {
    if (!ghostSize || !trayPieceSize) return 0.68;
    return Number((trayPieceSize / ghostSize).toFixed(4));
  }

  function getDragPieceSize(cellSize) {
    return Math.max(28, Math.floor(cellSize || 0));
  }

  function getTrayPieceSize(cellSize) {
    return Math.max(15, Math.floor((cellSize || 0) * 0.46));
  }

  function getTouchEdgeInset(options) {
    const opts = options || {};
    const width = Math.max(280, Math.floor(opts.width || 390));
    const compact = typeof opts.compact === "boolean" ? opts.compact : width < 560;
    if (!compact) return 22;
    return Math.max(18, Math.min(22, Math.floor(width * 0.05)));
  }

  function getTraySlotLayout(options) {
    const opts = options || {};
    const width = opts.width || 390;
    const compact = typeof opts.compact === "boolean" ? opts.compact : width < 560;
    const short = Boolean(opts.short);
    const tiny = Boolean(opts.tiny);
    const margin = typeof opts.margin === "number"
      ? opts.margin
      : compact
        ? getTouchEdgeInset({ width, compact })
        : 22;
    const slotWidth = Math.floor(Math.min(compact ? 112 : 124, (width - margin * 2) / 3));
    const squareHeight = Math.max(72, slotWidth - 10);
    const minimumHeight = tiny ? 82 : short ? 90 : compact ? 96 : 108;
    const slotHeight = Math.floor(Math.max(squareHeight, minimumHeight));
    return {
      slotWidth,
      slotHeight,
      trayPieceSize: getTrayPieceSize(opts.cellSize || 40),
    };
  }

  function pieceFitsInSlot(piece, pieceSize, slotWidth, slotHeight) {
    if (!piece || !piece.cells || !piece.cells.length) return false;
    const bounds = getPieceBounds(piece);
    const widthCells = bounds.maxX - bounds.minX + 1;
    const heightCells = bounds.maxY - bounds.minY + 1;
    return (
      widthCells * pieceSize <= slotWidth - 18 &&
      heightCells * pieceSize <= slotHeight - 14
    );
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
      this.storage = Object.prototype.hasOwnProperty.call(opts, "storage")
        ? opts.storage
        : (typeof window !== "undefined" ? window.localStorage : null);
      this.shapes = (opts.shapes && opts.shapes.length ? opts.shapes : SHAPES).map((shape, index) =>
        normalizePiece(shape, `shape_${index}`, 0)
      );
      this.board = createBoard(this.width, this.height);
      this.score = 0;
      this.linesCleared = 0;
      this.bestClearLinesThisGame = 0;
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
      this.bestClearLinesThisGame = 0;
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
      const clearBonus = getLineClearBonus(clearResult.linesCleared);
      const scoreDelta = piece.cells.length * SCORE_PER_PLACED_CELL
        + clearResult.linesCleared * SCORE_PER_CLEARED_LINE
        + clearBonus;
      this.score += scoreDelta;
      this.linesCleared += clearResult.linesCleared;
      this.bestClearLinesThisGame = Math.max(this.bestClearLinesThisGame, clearResult.linesCleared);
      this.saveHighScore();
      return {
        placed: true,
        scoreDelta,
        clearBonus,
        clearTier: getClearTier(clearResult.linesCleared),
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
      this.leaderboardOverlayItems = [];
      this.feedbackItems = [];
      this.layout = null;
      this.resizeFrame = 0;
      this.resizeTimers = [];
      this.viewportResizeHandler = null;
      this.orientationResizeHandler = null;
      this.audioLifecycleHandler = null;
      this.audioGestureHandler = null;
      this.audioUnlockListenersAttached = false;
      this.portraitPromptItems = [];
      this.portraitPromptActive = false;
      this.audioReady = false;
      this.audioUnlockPending = false;
      this.audioUnlockPromise = null;
      this.lastUnlockAttemptAt = 0;
      this.soundEnabledPreference = false;
      this.soundEnabled = false;
      this.audioContext = null;
      this.repeatStats = normalizeRepeatStats({}, getTodayKey());
      this.completedGameStatsSaved = false;
      this.completedGamePreviousStats = null;
      this.runStartedAt = 0;
      this.leaderboardScope = "today";
      this.leaderboardEntries = { today: null, alltime: null };
      this.leaderboardLoadingScope = null;
      this.leaderboardSubmitting = false;
      this.leaderboardSubmitted = false;
      this.leaderboardStatus = "";
      this.leaderboardSubmitStatus = "";
      this.leaderboardOverlayOpen = false;
      this.embedHome = false;
    }

    create() {
      this.gameModel = new Game();
      this.repeatStats = this.loadRepeatStats();
      this.completedGameStatsSaved = false;
      this.completedGamePreviousStats = null;
      this.runStartedAt = Date.now();
      this.soundEnabledPreference = this.loadSoundPreference();
      this.soundEnabled = this.soundEnabledPreference;
      this.embedHome = typeof window !== "undefined" && isHomeEmbedMode(window.location.search);
      this.audioReady = false;
      this.audioUnlockPending = this.soundEnabledPreference;
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
      this.viewportResizeHandler = () => this.scheduleViewportResize({ reason: "viewport" });
      this.orientationResizeHandler = () => this.scheduleViewportResize({ reason: "orientation", cancelDrag: true });
      this.audioGestureHandler = () => this.unlockAudioFromGesture("global-gesture");
      this.audioLifecycleHandler = () => {
        this.handleAudioLifecycleChange();
        this.scheduleViewportResize({ reason: "lifecycle" });
      };
      window.addEventListener("resize", this.viewportResizeHandler, { passive: true });
      window.addEventListener("orientationchange", this.orientationResizeHandler, { passive: true });
      window.addEventListener("pageshow", this.audioLifecycleHandler, { passive: true });
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", this.audioLifecycleHandler, { passive: true });
      }
      if (this.soundEnabledPreference) this.addAudioUnlockListeners();
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", this.viewportResizeHandler, { passive: true });
        window.visualViewport.addEventListener("scroll", this.viewportResizeHandler, { passive: true });
      }
    }

    removeViewportListeners() {
      if (typeof window !== "undefined" && this.viewportResizeHandler) {
        window.removeEventListener("resize", this.viewportResizeHandler);
        if (this.orientationResizeHandler) window.removeEventListener("orientationchange", this.orientationResizeHandler);
        if (this.audioLifecycleHandler) window.removeEventListener("pageshow", this.audioLifecycleHandler);
        if (typeof document !== "undefined" && this.audioLifecycleHandler) {
          document.removeEventListener("visibilitychange", this.audioLifecycleHandler);
        }
        if (window.visualViewport) {
          window.visualViewport.removeEventListener("resize", this.viewportResizeHandler);
          window.visualViewport.removeEventListener("scroll", this.viewportResizeHandler);
        }
      }
      this.removeAudioUnlockListeners();
      if (this.resizeFrame) {
        window.cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = 0;
      }
      this.clearViewportRelayoutTimers();
    }

    getAudioUnlockTargets() {
      const targets = [];
      if (typeof window !== "undefined") targets.push(window);
      if (typeof document !== "undefined") targets.push(document);
      return targets;
    }

    addAudioUnlockListeners() {
      if (!this.audioGestureHandler || this.audioUnlockListenersAttached) return;
      this.getAudioUnlockTargets().forEach((target) => {
        AUDIO_UNLOCK_EVENTS.forEach((eventName) => {
          target.addEventListener(eventName, this.audioGestureHandler, AUDIO_UNLOCK_LISTENER_OPTIONS);
        });
      });
      this.audioUnlockListenersAttached = true;
    }

    removeAudioUnlockListeners() {
      if (!this.audioGestureHandler || !this.audioUnlockListenersAttached) return;
      this.getAudioUnlockTargets().forEach((target) => {
        AUDIO_UNLOCK_EVENTS.forEach((eventName) => {
          target.removeEventListener(eventName, this.audioGestureHandler, AUDIO_UNLOCK_LISTENER_OPTIONS);
        });
      });
      this.audioUnlockListenersAttached = false;
    }

    handleAudioLifecycleChange() {
      if (!this.soundEnabledPreference) return;
      const state = this.audioContext ? this.audioContext.state : null;
      if (state === "running" && this.audioReady) return;
      // Saved preference is not the same as an unlocked AudioContext; iOS
      // Safari can suspend audio across refreshes, page restores, or tab hides.
      this.audioReady = false;
      this.audioUnlockPending = true;
      this.audioUnlockPromise = null;
      this.lastUnlockAttemptAt = 0;
      this.addAudioUnlockListeners();
      this.updateSoundButton();
    }

    clearViewportRelayoutTimers() {
      if (typeof window === "undefined") {
        this.resizeTimers = [];
        return;
      }
      this.resizeTimers.forEach((timerId) => window.clearTimeout(timerId));
      this.resizeTimers = [];
    }

    scheduleViewportResize(options) {
      if (typeof window === "undefined") {
        this.resizeLayout();
        return;
      }
      const opts = options || {};
      if (opts.cancelDrag) this.cancelActiveDragForRelayout();
      this.clearViewportRelayoutTimers();
      getOrientationRelayoutDelays().forEach((delay) => {
        if (delay === 0) {
          this.queueViewportRelayout();
          return;
        }
        const timerId = window.setTimeout(() => this.queueViewportRelayout(), delay);
        this.resizeTimers.push(timerId);
      });
    }

    queueViewportRelayout() {
      if (typeof window === "undefined") {
        this.performViewportRelayout();
        return;
      }
      if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.performViewportRelayout();
      });
    }

    performViewportRelayout() {
      const target = typeof document !== "undefined" ? document.getElementById("blockzzle-game") : null;
      const size = getGameSurfaceSize(target);
      if (this.scale && typeof this.scale.resize === "function") {
        this.scale.resize(size.width, size.height);
      }
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
        "Drag blocks. Clear rows or columns.",
        this.smallTextStyle(13, "#d6e2f4", "600")
      );
      this.metricBacks = [
        this.add.rectangle(0, 0, 120, 38, 0x172238, 0.96),
        this.add.rectangle(0, 0, 118, 38, 0x172238, 0.96),
        this.add.rectangle(0, 0, 112, 38, 0x172238, 0.96),
        this.add.rectangle(0, 0, 98, 38, 0x172238, 0.96),
      ];
      this.metricBacks.forEach((back) => back.setStrokeStyle(1, 0x34445f, 0.9));
      this.scoreText = this.add.text(0, 0, "", this.smallTextStyle(17, "#f8fbff", "800"));
      this.bestText = this.add.text(0, 0, "", this.smallTextStyle(14, "#d6e2f4", "800"));
      this.todayBestText = this.add.text(0, 0, "", this.smallTextStyle(14, "#d6e2f4", "800"));
      this.linesText = this.add.text(0, 0, "", this.smallTextStyle(14, "#d6e2f4", "800"));
      this.metricTexts = [this.scoreText, this.bestText, this.todayBestText, this.linesText];
      this.nextGoalText = this.add.text(0, 0, "", this.smallTextStyle(13, "#facc15", "800"));
      this.statusText = this.add.text(0, 0, "", this.smallTextStyle(15, "#f8fbff", "700"));
      this.boardBack = this.add.rectangle(0, 0, 100, 100, 0x111b2f, 0.92);
      this.boardBack.setStrokeStyle(2, 0x30425f, 1);
      this.restartButton = this.add.text(0, 0, "Restart", this.smallTextStyle(15, "#07111f", "800"))
        .setPadding(16, 10)
        .setBackgroundColor("#8ee8d2")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.restartGame());
      this.soundButton = this.add.text(0, 0, getSoundToggleLabel(this.soundEnabled), this.smallTextStyle(13, "#d6e2f4", "800"))
        .setPadding(10, 7)
        .setBackgroundColor("#172238")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.toggleSound());
      this.leaderboardButton = this.add.text(0, 0, "Ranks", this.smallTextStyle(12, "#facc15", "800"))
        .setPadding(9, 6)
        .setBackgroundColor("#172238")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.openLeaderboardOverlay());
      this.homeLink = this.add.text(0, 0, "Home", this.smallTextStyle(14, "#b8c4d8", "700"))
        .setPadding(12, 8)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          window.location.href = "/";
        });
      this.updateSoundButton();
    }

    restartGame() {
      this.playCueAfterGestureUnlock("restart", "restart")
        .then((ready) => {
          if (!ready) this.updateSoundButton();
        })
        .catch(() => {});
      if (this.gameModel && this.gameModel.gameOver) this.recordCompletedGameStats();
      this.repeatStats = this.loadRepeatStats();
      this.completedGameStatsSaved = false;
      this.completedGamePreviousStats = null;
      this.runStartedAt = Date.now();
      this.leaderboardSubmitted = false;
      this.leaderboardSubmitStatus = "";
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

    loadSoundPreference() {
      try {
        const savedValue = window.localStorage.getItem(SOUND_STORAGE_KEY);
        const shouldRestore = shouldRestoreSoundOnPageLoad(savedValue);
        if (!shouldRestore && parseSoundPreference(savedValue)) {
          window.localStorage.setItem(SOUND_STORAGE_KEY, "false");
        }
        return shouldRestore;
      } catch (error) {
        return false;
      }
    }

    saveSoundPreference() {
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(this.soundEnabledPreference));
      } catch (error) {
        // Sound preference is optional; gameplay should not depend on storage.
      }
    }

    loadRepeatStats() {
      const todayKey = getTodayKey();
      try {
        return normalizeRepeatStats({
          todayBestDate: window.localStorage.getItem(TODAY_BEST_DATE_STORAGE_KEY),
          todayBest: window.localStorage.getItem(TODAY_BEST_STORAGE_KEY),
          gamesPlayed: window.localStorage.getItem(GAMES_PLAYED_STORAGE_KEY),
          lastScore: window.localStorage.getItem(LAST_SCORE_STORAGE_KEY),
          bestLines: window.localStorage.getItem(BEST_LINES_STORAGE_KEY),
          bestClearLines: window.localStorage.getItem(BEST_CLEAR_LINES_STORAGE_KEY),
        }, todayKey);
      } catch (error) {
        return normalizeRepeatStats({}, todayKey);
      }
    }

    saveRepeatStats(stats) {
      try {
        window.localStorage.setItem(TODAY_BEST_DATE_STORAGE_KEY, stats.todayBestDate);
        window.localStorage.setItem(TODAY_BEST_STORAGE_KEY, String(stats.todayBest));
        window.localStorage.setItem(GAMES_PLAYED_STORAGE_KEY, String(stats.gamesPlayed));
        window.localStorage.setItem(LAST_SCORE_STORAGE_KEY, String(stats.lastScore));
        window.localStorage.setItem(BEST_LINES_STORAGE_KEY, String(stats.bestLines));
        window.localStorage.setItem(BEST_CLEAR_LINES_STORAGE_KEY, String(stats.bestClearLines));
      } catch (error) {
        // Repeat-play stats are browser-local extras; gameplay must keep moving.
      }
    }

    recordBestClearIfNeeded(linesCleared) {
      const lines = Math.max(0, Number.parseInt(linesCleared || 0, 10) || 0);
      if (!lines) return;
      const current = this.loadRepeatStats();
      if (lines <= current.bestClearLines) {
        this.repeatStats = current;
        return;
      }
      this.repeatStats = { ...current, bestClearLines: lines };
      this.saveRepeatStats(this.repeatStats);
    }

    recordCompletedGameStats() {
      if (!this.gameModel || !this.gameModel.gameOver || this.completedGameStatsSaved) return;
      const todayKey = getTodayKey();
      const previousStats = this.loadRepeatStats();
      this.completedGamePreviousStats = previousStats;
      this.repeatStats = completeRepeatStats(
        previousStats,
        this.gameModel.score,
        this.gameModel.linesCleared,
        todayKey,
        this.gameModel.bestClearLinesThisGame
      );
      this.saveRepeatStats(this.repeatStats);
      this.completedGameStatsSaved = true;
    }

    getRunDurationSeconds() {
      if (!this.runStartedAt) return null;
      return Math.max(0, Math.round((Date.now() - this.runStartedAt) / 1000));
    }

    loadStoredNickname() {
      try {
        return window.localStorage.getItem(NICKNAME_STORAGE_KEY) || "";
      } catch (error) {
        return "";
      }
    }

    saveStoredNickname(nickname) {
      try {
        window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
      } catch (error) {
        // Nickname is optional local convenience; score submission can still work.
      }
    }

    getLeaderboardPayload(nickname) {
      return validateLeaderboardSubmission({
        nickname,
        score: this.gameModel ? this.gameModel.score : 0,
        lines: this.gameModel ? this.gameModel.linesCleared : 0,
        best_clear: this.gameModel ? this.gameModel.bestClearLinesThisGame : 0,
        tier: getScoreTier(this.gameModel ? this.gameModel.score : 0).label,
        duration_seconds: this.getRunDurationSeconds(),
        board_version: BOARD_VERSION,
        client_version: CLIENT_VERSION,
        browser_player_id: getOrCreateBrowserPlayerId(window.localStorage),
      });
    }

    requestNicknameForLeaderboard() {
      const saved = this.loadStoredNickname();
      const fallback = saved || "Player";
      const entered = window.prompt("Nickname for anonymous leaderboard (2-16 letters, numbers, spaces, _ or -)", fallback);
      if (entered === null) return null;
      return entered;
    }

    leaderboardUnavailableMessage(response) {
      if (!response || response.status === 404 || response.status === 503) return "Leaderboard is coming soon.";
      return "Leaderboard is temporarily unavailable.";
    }

    async loadLeaderboard(scope) {
      const resolvedScope = scope === "alltime" ? "alltime" : "today";
      if (this.leaderboardLoadingScope === resolvedScope) return;
      if (typeof fetch === "undefined") {
        this.leaderboardStatus = "Leaderboard is coming soon.";
        this.leaderboardEntries[resolvedScope] = [];
        return;
      }
      this.leaderboardLoadingScope = resolvedScope;
      this.leaderboardStatus = "Loading leaderboard...";
      try {
        const response = await fetch(`/api/leaderboard?scope=${encodeURIComponent(resolvedScope)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          this.leaderboardEntries[resolvedScope] = [];
          this.leaderboardStatus = this.leaderboardUnavailableMessage(response);
          return;
        }
        const data = await response.json();
        this.leaderboardEntries[resolvedScope] = Array.isArray(data.entries) ? data.entries.slice(0, 100) : [];
        this.leaderboardStatus = this.leaderboardEntries[resolvedScope].length
          ? ""
          : "No submitted scores yet.";
      } catch (error) {
        this.leaderboardEntries[resolvedScope] = [];
        this.leaderboardStatus = "Leaderboard is temporarily unavailable.";
      } finally {
        this.leaderboardLoadingScope = null;
        this.render();
      }
    }

    setLeaderboardScope(scope) {
      const resolvedScope = scope === "alltime" ? "alltime" : "today";
      this.leaderboardScope = resolvedScope;
      if (!this.leaderboardEntries[resolvedScope]) this.loadLeaderboard(resolvedScope);
      this.render();
    }

    async submitLeaderboardScore() {
      if (!this.gameModel || !this.gameModel.gameOver || this.leaderboardSubmitting || this.leaderboardSubmitted) return;
      const nicknameInput = this.requestNicknameForLeaderboard();
      if (nicknameInput === null) return;
      const nicknameResult = validateLeaderboardNickname(nicknameInput);
      if (!nicknameResult.ok) {
        this.leaderboardSubmitStatus = nicknameResult.error;
        this.render();
        return;
      }
      const payloadResult = this.getLeaderboardPayload(nicknameResult.nickname);
      if (!payloadResult.ok) {
        this.leaderboardSubmitStatus = payloadResult.error;
        this.render();
        return;
      }
      if (typeof fetch === "undefined") {
        this.leaderboardSubmitStatus = "Leaderboard is coming soon.";
        this.render();
        return;
      }
      this.leaderboardSubmitting = true;
      this.leaderboardSubmitStatus = "Submitting score...";
      this.render();
      try {
        const response = await fetch("/api/leaderboard/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payloadResult.entry),
        });
        let data = null;
        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }
        if (!response.ok || !data || !data.ok) {
          this.leaderboardSubmitStatus = getLeaderboardSubmitErrorMessage(
            data && data.error,
            this.leaderboardUnavailableMessage(response)
          );
          return;
        }
        this.saveStoredNickname(nicknameResult.nickname);
        this.leaderboardSubmitted = true;
        const todayRank = Number.isFinite(data.today_rank) ? `Today #${data.today_rank}` : "Today submitted";
        const allTimeRank = Number.isFinite(data.alltime_rank) ? `All-Time #${data.alltime_rank}` : "All-Time submitted";
        this.leaderboardSubmitStatus = `${todayRank} / ${allTimeRank}`;
        this.leaderboardEntries = { today: null, alltime: null };
        this.loadLeaderboard(this.leaderboardScope);
      } catch (error) {
        this.leaderboardSubmitStatus = "Leaderboard is temporarily unavailable.";
      } finally {
        this.leaderboardSubmitting = false;
        this.render();
      }
    }

    getLeaderboardPreviewLines(limit) {
      const maxLines = Number.isFinite(limit) ? limit : 3;
      const entries = this.leaderboardEntries[this.leaderboardScope];
      if (!entries) return [this.leaderboardStatus || "Loading leaderboard..."];
      if (!entries.length) return [this.leaderboardStatus || "No submitted scores yet."];
      return entries.slice(0, maxLines).map((entry) => (
        `#${entry.rank} ${entry.nickname} ${formatScore(entry.score)}`
      ));
    }

    clearLeaderboardOverlayItems() {
      this.leaderboardOverlayItems.forEach((item) => item.destroy());
      this.leaderboardOverlayItems = [];
    }

    openLeaderboardOverlay() {
      if (this.leaderboardOverlayOpen) return;
      this.cancelActiveDragForRelayout();
      this.leaderboardOverlayOpen = true;
      if (!this.leaderboardEntries[this.leaderboardScope] && !this.leaderboardLoadingScope) {
        this.loadLeaderboard(this.leaderboardScope);
      }
      this.renderLeaderboardOverlay();
    }

    closeLeaderboardOverlay() {
      this.leaderboardOverlayOpen = false;
      this.clearLeaderboardOverlayItems();
      this.render();
    }

    renderLeaderboardOverlay() {
      this.clearLeaderboardOverlayItems();
      if (!this.leaderboardOverlayOpen) return;
      if (!this.leaderboardEntries[this.leaderboardScope] && !this.leaderboardLoadingScope) {
        this.loadLeaderboard(this.leaderboardScope);
      }

      const width = this.scale.width;
      const height = this.scale.height;
      const compact = width < 560 || height < 760;
      const panelWidth = Math.min(compact ? 342 : 420, width - 28);
      const panelHeight = Math.min(compact ? 390 : 440, height - 58);
      const centerX = width / 2;
      const centerY = height / 2;
      const panelTop = centerY - panelHeight / 2;
      const entries = this.getLeaderboardPreviewLines(compact ? 8 : 10);
      const title = this.leaderboardScope === "today" ? "Today Top 100" : "All-Time Top 100";
      const scrim = this.add.rectangle(centerX, centerY, width + 8, height + 8, 0x07111f, 0.78)
        .setInteractive();
      scrim.setDepth(100);
      const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x101827, 0.98);
      panel.setStrokeStyle(2, 0x8ee8d2, 0.9);
      panel.setDepth(101);
      const heading = this.add.text(centerX, panelTop + 18, "Leaderboard", this.smallTextStyle(compact ? 22 : 24, "#f8fbff", "800"));
      heading.setOrigin(0.5, 0);
      heading.setDepth(102);
      const subhead = this.add.text(centerX, panelTop + 50, "Anonymous scores. Nickname only.", this.smallTextStyle(11, "#b8c4d8", "700"));
      subhead.setOrigin(0.5, 0);
      subhead.setDepth(102);
      const todayButton = this.add.text(centerX - 52, panelTop + 76, "Today", this.smallTextStyle(12, this.leaderboardScope === "today" ? "#07111f" : "#d6e2f4", "800"))
        .setOrigin(0.5, 0)
        .setPadding(14, 8)
        .setBackgroundColor(this.leaderboardScope === "today" ? "#8ee8d2" : "#172238")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.setLeaderboardScope("today"));
      todayButton.setDepth(102);
      const allTimeButton = this.add.text(centerX + 54, panelTop + 76, "All-Time", this.smallTextStyle(12, this.leaderboardScope === "alltime" ? "#07111f" : "#d6e2f4", "800"))
        .setOrigin(0.5, 0)
        .setPadding(14, 8)
        .setBackgroundColor(this.leaderboardScope === "alltime" ? "#8ee8d2" : "#172238")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.setLeaderboardScope("alltime"));
      allTimeButton.setDepth(102);
      const listTitle = this.add.text(centerX, panelTop + 116, title, this.smallTextStyle(13, "#facc15", "800"));
      listTitle.setOrigin(0.5, 0);
      listTitle.setDepth(102);
      const listText = this.add.text(
        centerX,
        panelTop + 142,
        entries.join("\n"),
        this.smallTextStyle(compact ? 12 : 13, "#d6e2f4", "800")
      );
      listText.setOrigin(0.5, 0);
      listText.setAlign("center");
      listText.setWordWrapWidth(panelWidth - 42);
      listText.setDepth(102);
      const note = this.add.text(
        centerX,
        panelTop + panelHeight - 78,
        "Viewing does not change your current game.",
        this.smallTextStyle(10, "#b8c4d8", "700")
      );
      note.setOrigin(0.5, 0);
      note.setAlign("center");
      note.setWordWrapWidth(panelWidth - 42);
      note.setDepth(102);
      const closeButton = this.add.text(centerX, panelTop + panelHeight - 46, "Close", this.smallTextStyle(15, "#07111f", "800"))
        .setOrigin(0.5, 0)
        .setPadding(28, 10)
        .setBackgroundColor("#8ee8d2")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.closeLeaderboardOverlay());
      closeButton.setDepth(102);
      this.leaderboardOverlayItems.push(
        scrim,
        panel,
        heading,
        subhead,
        todayButton,
        allTimeButton,
        listTitle,
        listText,
        note,
        closeButton
      );
    }

    updateSoundButton() {
      if (!this.soundButton) return;
      this.soundButton.setText(getSoundToggleLabel(this.soundEnabledPreference));
      this.soundButton.setColor(this.soundEnabledPreference ? "#07111f" : "#d6e2f4");
      this.soundButton.setBackgroundColor(this.soundEnabledPreference ? "#facc15" : "#172238");
    }

    toggleSound() {
      if (this.soundEnabledPreference && this.audioReady) {
        this.setSoundEnabled(false, "sound-toggle").catch(() => {});
        return;
      }
      this.activateSoundFromButtonGesture("sound-toggle").catch(() => {});
    }

    primeAudioForGesture() {
      this.unlockAudioFromGesture("phaser-pointer", { force: true });
    }

    refreshAudioUnlockStatus() {
      const status = getAudioUnlockStatus(
        this.soundEnabledPreference,
        this.audioContext ? this.audioContext.state : null,
        this.audioReady
      );
      this.audioUnlockPending = status.pending;
      if (status.pending) {
        this.addAudioUnlockListeners();
      } else {
        this.removeAudioUnlockListeners();
      }
      return status;
    }

    createAudioContextIfNeeded() {
      if (typeof window === "undefined") return null;
      if (this.audioContext && this.audioContext.state !== "closed") return this.audioContext;
      const AudioContextRef = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextRef) return null;
      try {
        this.audioContext = new AudioContextRef();
        return this.audioContext;
      } catch (error) {
        return null;
      }
    }

    getAudioContext() {
      if (!this.soundEnabledPreference) return null;
      return this.createAudioContextIfNeeded();
    }

    prepareAudioActivationState() {
      this.audioReady = false;
      this.audioUnlockPending = true;
      this.audioUnlockPromise = null;
      this.lastUnlockAttemptAt = 0;
      if (this.audioContext && this.audioContext.state === "closed") {
        this.audioContext = null;
      }
      this.removeAudioUnlockListeners();
    }

    markSoundDisabled() {
      this.soundEnabledPreference = false;
      this.soundEnabled = false;
      this.audioReady = false;
      this.audioUnlockPending = false;
      this.audioUnlockPromise = null;
      this.lastUnlockAttemptAt = 0;
      this.saveSoundPreference();
      this.removeAudioUnlockListeners();
      this.updateSoundButton();
    }

    activateSoundFromButtonGesture(reason) {
      this.prepareAudioActivationState();
      const context = this.createAudioContextIfNeeded();
      if (!context) {
        this.markSoundDisabled();
        return Promise.resolve(false);
      }
      if (this.audioUnlockPromise) return this.audioUnlockPromise;

      const activation = Promise.resolve()
        .then(() => {
          // Sound On is only saved after this user gesture schedules a real
          // low-volume source; a page-load preference alone cannot unlock iOS audio.
          const scheduledBeforeResume = this.playUnlockTick(context, reason);
          if (context.state === "suspended" && typeof context.resume === "function") {
            return context.resume().then(() => scheduledBeforeResume || this.playUnlockTick(context, reason));
          }
          return scheduledBeforeResume;
        })
        .then((scheduled) => {
          const ready = Boolean(context.state === "running" && scheduled);
          if (!ready) {
            this.markSoundDisabled();
            return false;
          }
          this.soundEnabledPreference = true;
          this.soundEnabled = true;
          this.audioReady = true;
          this.audioUnlockPending = false;
          this.audioUnlockPromise = null;
          this.saveSoundPreference();
          this.removeAudioUnlockListeners();
          this.updateSoundButton();
          return true;
        })
        .catch(() => {
          this.markSoundDisabled();
          return false;
        })
        .finally(() => {
          this.audioUnlockPromise = null;
        });

      this.audioUnlockPromise = activation;
      return activation;
    }

    setSoundEnabled(enabled, reason) {
      if (!enabled) {
        this.markSoundDisabled();
        return Promise.resolve(false);
      }

      return this.activateSoundFromButtonGesture(reason || "sound-toggle");
    }

    ensureAudioReady() {
      return this.unlockAudioFromGesture("legacy");
    }

    unlockAudioFromGesture(reason, options) {
      const opts = options || {};
      if (!this.soundEnabledPreference) {
        this.audioUnlockPending = false;
        return Promise.resolve(false);
      }
      const currentStatus = this.refreshAudioUnlockStatus();
      if (currentStatus.ready) return Promise.resolve(true);
      const now = this.getAudioNow();
      if (!opts.force && !shouldAttemptAudioUnlock(this.soundEnabledPreference, this.audioReady, now, this.lastUnlockAttemptAt)) {
        return Promise.resolve(false);
      }
      const context = this.getAudioContext();
      if (!context) {
        this.audioUnlockPending = true;
        this.addAudioUnlockListeners();
        return Promise.resolve(false);
      }
      if (this.audioUnlockPromise) return this.audioUnlockPromise;
      this.lastUnlockAttemptAt = now;

      try {
        // Saved Sound On can show the label on load, but iOS Safari still
        // requires a later user gesture and an actual WebAudio source start.
        // Use the same oscillator/gain path as normal cues for the test tick.
        const scheduledBeforeResume = this.playUnlockTick(context, reason);
        const finish = () => {
          const scheduledAfterResume = scheduledBeforeResume || this.playUnlockTick(context, reason);
          this.audioReady = Boolean(context.state === "running" && scheduledAfterResume);
          this.audioUnlockPromise = null;
          return this.refreshAudioUnlockStatus().ready;
        };
        if (context.state === "suspended" && typeof context.resume === "function") {
          this.audioUnlockPromise = context.resume()
            .then(finish)
            .catch(() => {
              this.audioUnlockPromise = null;
              this.audioReady = false;
              this.refreshAudioUnlockStatus();
              return false;
            });
          return this.audioUnlockPromise;
        }
        return Promise.resolve(finish());
      } catch (error) {
        this.audioUnlockPromise = null;
        this.audioReady = false;
        this.refreshAudioUnlockStatus();
        return Promise.resolve(false);
      }
    }

    getAudioNow() {
      if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
      return Date.now();
    }

    playUnlockTick(context) {
      try {
        return this.playTone(context, AUDIO_UNLOCK_CUE, 0);
      } catch (error) {
        // Optional sound unlock: ignore WebAudio differences across browsers.
        return false;
      }
    }

    playSoundCue(name) {
      if (!this.soundEnabledPreference) return;
      const cue = SOUND_CUES[name];
      if (!cue) return;
      const status = this.refreshAudioUnlockStatus();
      if (!status.ready) return;
      const context = this.getAudioContext();
      if (!context) return;
      try {
        if (context.state !== "running") {
          this.audioReady = false;
          this.audioUnlockPending = true;
          this.addAudioUnlockListeners();
          return;
        }
        if (cue.type === "chime") {
          this.playTone(context, cue, 0);
          this.playTone(context, { ...cue, frequency: 880, endFrequency: 1170, volume: cue.volume * 0.72 }, 54);
          return;
        }
        if (cue.type === "chime2") {
          this.playTone(context, cue, 0);
          this.playTone(context, { ...cue, frequency: 980, endFrequency: 1320, volume: cue.volume * 0.78 }, 58);
          this.playTone(context, { ...cue, frequency: 1230, endFrequency: 1480, durationMs: 150, volume: cue.volume * 0.58 }, 126);
          return;
        }
        if (cue.type === "fanfare") {
          this.playTone(context, { ...cue, frequency: 620, endFrequency: 920, durationMs: 150, volume: cue.volume * 0.72 }, 0);
          this.playTone(context, { ...cue, frequency: 820, endFrequency: 1240, durationMs: 180 }, 72);
          this.playTone(context, { ...cue, frequency: 1040, endFrequency: 1560, durationMs: 205, volume: cue.volume * 0.82 }, 152);
          return;
        }
        this.playTone(context, cue, 0);
      } catch (error) {
        // Sound is optional; never let WebAudio quirks interrupt play.
      }
    }

    playCueAfterGestureUnlock(name, reason) {
      const attempt = this.refreshAudioUnlockStatus().ready
        ? Promise.resolve(true)
        : this.unlockAudioFromGesture(reason || `cue-${name}`, { force: true });
      return attempt
        .then((ready) => {
          if (ready) this.playSoundCue(name);
          return ready;
        })
        .catch(() => false);
    }

    playTone(context, cue, delayMs) {
      const start = context.currentTime + (delayMs || 0) / 1000;
      const end = start + cue.durationMs / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = cue.wave || "sine";
      oscillator.frequency.setValueAtTime(cue.frequency, start);
      oscillator.frequency.linearRampToValueAtTime(cue.endFrequency || cue.frequency, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(cue.volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.025);
      return true;
    }

    smallTextStyle(size, color, weight) {
      return {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: `${size}px`,
        fontStyle: weight,
        color,
      };
    }

    fitMetricTexts() {
      if (!this.metricLayout) return;
      this.metricTexts.forEach((text, index) => {
        const preferred = index === 0
          ? this.metricLayout.metricScoreFontSize
          : this.metricLayout.metricMetaFontSize;
        const maxWidth = this.metricLayout.metricTextMaxWidths[index];
        let fontSize = getMetricTextFontSize(text.text, maxWidth, preferred, this.metricLayout.metricMinFontSize);
        text.setFontSize(fontSize);
        while (text.width > maxWidth && fontSize > this.metricLayout.metricMinFontSize) {
          fontSize -= 1;
          text.setFontSize(fontSize);
        }
      });
    }

    resizeLayout() {
      const width = this.scale.width;
      const height = this.scale.height;
      const profile = getPlayLayoutProfile({ width, height, embedHome: this.embedHome });
      const compact = profile.compact;
      const short = profile.short;
      const tiny = profile.tiny;
      const margin = getTouchEdgeInset({ width, compact });
      const topY = profile.topY;
      const headerBottom = profile.headerBottom;
      const trayGap = profile.trayGap;
      const statusHeight = profile.statusHeight;
      const bottomGap = profile.bottomGap;
      const traySlot = getTraySlotLayout({ width, margin, compact, short, tiny, cellSize: this.cellSize });
      const trayHeight = traySlot.slotHeight;
      this.cellSize = Math.floor(Math.min(
        (width - margin * 2) / 8,
        (height - headerBottom - trayGap - trayHeight - statusHeight - bottomGap) / 8,
        compact ? 48 : 54
      ));
      this.cellSize = Math.max(28, this.cellSize);
      const resolvedTraySlot = getTraySlotLayout({ width, margin, compact, short, tiny, cellSize: this.cellSize });
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
        trayHeight: resolvedTraySlot.slotHeight,
        slotWidth: resolvedTraySlot.slotWidth,
        trayPieceSize: resolvedTraySlot.trayPieceSize,
      };
      this.titleText.setFontSize(tiny ? 22 : short ? 25 : compact ? 28 : 36);
      this.subtitleText.setFontSize(tiny ? 11 : compact ? 12 : 15);
      this.howToText.setText("Drag blocks onto the board. Fill rows or columns to clear lines. Keep going for a high score.");
      this.howToText.setFontSize(tiny ? 10 : compact ? 11 : 13);
      this.howToText.setWordWrapWidth(Math.min(width - margin * 2, compact ? 352 : 680));
      this.titleText.setPosition(margin, topY);
      this.subtitleText.setPosition(margin, topY + (tiny ? 28 : compact ? 34 : 40));
      this.howToText.setPosition(margin, topY + (tiny ? 47 : compact ? 55 : 64));
      this.titleText.setVisible(profile.showTitle);
      this.subtitleText.setVisible(profile.showSubtitle);
      this.howToText.setVisible(profile.showHowTo);
      const metricLayout = getMetricChipLayout({
        width,
        margin,
        compact,
        tiny,
        embedHome: this.embedHome,
      });
      this.metricLayout = metricLayout;
      const chipY = profile.chipY;
      const chipGap = metricLayout.metricChipGap;
      const chipHeight = metricLayout.metricChipHeight;
      const chipWidths = metricLayout.metricChipWidths;
      let chipX = margin;
      this.metricBacks.forEach((back, index) => {
        back.setSize(chipWidths[index], chipHeight);
        back.setPosition(chipX + chipWidths[index] / 2, chipY);
        chipX += chipWidths[index] + chipGap;
      });
      this.scoreText.setFontSize(metricLayout.metricScoreFontSize);
      [this.bestText, this.todayBestText, this.linesText].forEach((text) => {
        text.setFontSize(metricLayout.metricMetaFontSize);
      });
      let textX = margin;
      this.metricTexts.forEach((text, index) => {
        text.setPosition(textX + metricLayout.metricTextPadding, chipY - (tiny ? 8 : 9));
        textX += chipWidths[index] + chipGap;
      });
      const embedControls = this.embedHome && compact;
      this.restartButton.setFontSize(embedControls ? 12 : compact ? 13 : 15);
      this.restartButton.setPadding(embedControls ? 8 : compact ? 10 : 16, embedControls ? 5 : compact ? 7 : 10);
      this.homeLink.setFontSize(compact ? 12 : 14);
      this.homeLink.setPadding(compact ? 9 : 12, compact ? 6 : 8);
      this.soundButton.setFontSize(embedControls ? 10 : compact ? 11 : 13);
      this.soundButton.setPadding(embedControls ? 7 : compact ? 8 : 10, embedControls ? 5 : compact ? 6 : 7);
      this.leaderboardButton.setFontSize(compact ? 11 : 12);
      this.leaderboardButton.setPadding(compact ? 8 : 9, compact ? 6 : 6);
      this.updateSoundButton();
      const controlGap = compact ? 7 : 10;
      this.restartButton.setPosition(width - this.restartButton.width - margin, topY);
      this.soundButton.setPosition(this.restartButton.x - this.soundButton.width - controlGap, topY + 2);
      this.homeLink.setVisible(profile.showHomeLink);
      if (profile.showHomeLink) {
        this.homeLink.setInteractive({ useHandCursor: true });
        this.homeLink.setPosition(this.soundButton.x - this.homeLink.width - controlGap, topY + 2);
      } else {
        this.homeLink.disableInteractive();
        this.homeLink.setPosition(-999, -999);
      }
      this.nextGoalText.setVisible(profile.showNextGoalText);
      if (profile.showNextGoalText) {
        this.nextGoalText.setFontSize(tiny ? 11 : compact ? 12 : 13);
        this.nextGoalText.setPosition(margin + 2, chipY + chipHeight / 2 + (tiny ? 16 : compact ? 17 : 24));
      } else {
        this.nextGoalText.setPosition(-999, -999);
      }
      this.leaderboardButton.setVisible(profile.showLeaderboardButton);
      if (profile.showLeaderboardButton) {
        this.leaderboardButton.setInteractive({ useHandCursor: true });
        const ranksLayout = getLeaderboardButtonLayout({
          width,
          margin,
          restartButton: {
            x: this.restartButton.x,
            y: this.restartButton.y,
            width: this.restartButton.width,
            height: this.restartButton.height,
          },
          buttonWidth: this.leaderboardButton.width,
          buttonHeight: this.leaderboardButton.height,
          boardTop: this.boardOrigin.y,
        });
        this.leaderboardButton.setPosition(ranksLayout.x, ranksLayout.y);
      } else {
        this.leaderboardButton.disableInteractive();
        this.leaderboardButton.setPosition(-999, -999);
      }
      this.statusText.setFontSize(tiny ? 12 : compact ? 13 : 15);
      this.statusText.setPosition(margin, Math.min(height - bottomGap - statusHeight + 4, trayY + trayHeight + 6));
      this.boardBack.setPosition(this.boardOrigin.x + boardWidth / 2, this.boardOrigin.y + boardWidth / 2);
      this.boardBack.setSize(boardWidth + 8, boardWidth + 8);
      this.render();
      this.updatePortraitPrompt(width, height);
    }

    destroyPortraitPrompt() {
      this.portraitPromptItems.forEach((item) => item.destroy());
      this.portraitPromptItems = [];
      this.portraitPromptActive = false;
    }

    updatePortraitPrompt(width, height) {
      const shouldShow = shouldShowPortraitPrompt({ width, height });
      if (!shouldShow) {
        this.destroyPortraitPrompt();
        return;
      }
      this.destroyPortraitPrompt();
      this.portraitPromptActive = true;
      const centerX = width / 2;
      const centerY = height / 2;
      const panelWidth = Math.min(360, width - 32);
      const scrim = this.add.rectangle(centerX, centerY, width + 8, height + 8, 0x0b1220, 0.86)
        .setInteractive();
      scrim.setDepth(120);
      const panel = this.add.rectangle(centerX, centerY, panelWidth, 138, 0x101827, 0.96);
      panel.setStrokeStyle(2, 0xfacc15, 0.92);
      panel.setDepth(121);
      const title = this.add.text(centerX, centerY - 44, "Rotate to portrait", this.smallTextStyle(22, "#f8fbff", "800"));
      title.setOrigin(0.5, 0);
      title.setDepth(122);
      const message = this.add.text(
        centerX,
        centerY - 4,
        "Turn your phone back to portrait to keep playing.",
        this.smallTextStyle(13, "#d6e2f4", "700")
      );
      message.setOrigin(0.5, 0);
      message.setAlign("center");
      message.setWordWrapWidth(panelWidth - 48);
      message.setDepth(122);
      this.portraitPromptItems.push(scrim, panel, title, message);
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
      if (this.gameModel.gameOver) this.recordCompletedGameStats();
      if (!this.repeatStats) this.repeatStats = this.loadRepeatStats();
      this.scoreText.setText(`Score ${this.gameModel.score}`);
      this.bestText.setText(`Best ${this.gameModel.highScore}`);
      this.todayBestText.setText(`Today ${this.repeatStats.todayBest}`);
      this.linesText.setText(`Lines ${this.gameModel.linesCleared}`);
      this.nextGoalText.setText(getScoreTierGoalText(this.gameModel.score));
      this.fitMetricTexts();
      this.renderBoard();
      this.renderTray();
      this.renderGameOverPanel();
      if (this.gameModel.gameOver) {
        this.statusText.setText("No more moves. Play again?");
      }
      if (this.leaderboardOverlayOpen) this.renderLeaderboardOverlay();
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
          const style = getBoardCellStyle({
            value,
            isPreview,
            previewPiece: this.dragState && this.dragState.piece,
            previewValid: this.dragState && this.dragState.valid,
            isClearFlash,
            isInvalidFlash,
          });
          const rect = this.add.rectangle(
            pos.x + this.cellSize / 2,
            pos.y + this.cellSize / 2,
            this.cellSize - 5,
            this.cellSize - 5,
            Phaser.Display.Color.HexStringToColor(style.fill).color,
            style.alpha
          );
          rect.setStrokeStyle(style.strokeWidth, style.strokeColor, style.strokeAlpha);
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
      const pieceSize = layout.trayPieceSize || getTrayPieceSize(this.cellSize);
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
            group.push(...this.drawPiece(piece, x, trayY + slotHeight / 2, pieceSize));
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
      this.recordCompletedGameStats();
      const repeatStats = this.repeatStats || this.loadRepeatStats();
      const scoreTier = getScoreTier(this.gameModel.score);
      const bestScoreTier = getScoreTier(this.gameModel.highScore);
      const nextGoalText = scoreTier.nextLabel
        ? `${scoreTier.nextLabel} at ${formatScore(scoreTier.nextScore)}`
        : "Top local tier reached";
      const statsLines = [
        `Score ${this.gameModel.score}    Best ${this.gameModel.highScore}`,
        `Today ${repeatStats.todayBest}    Lines ${this.gameModel.linesCleared}`,
        `Tier ${scoreTier.label}    Best Tier ${bestScoreTier.label}`,
        `Next Goal: ${nextGoalText}`,
        `Games ${repeatStats.gamesPlayed}    Best Lines ${repeatStats.bestLines}`,
        `Best Clear: ${repeatStats.bestClearLines} ${repeatStats.bestClearLines === 1 ? "Line" : "Lines"}`,
      ];
      if (!this.leaderboardEntries[this.leaderboardScope] && !this.leaderboardLoadingScope) {
        this.loadLeaderboard(this.leaderboardScope);
      }
      const leaderboardTitle = this.leaderboardScope === "today" ? "Today Top 100" : "All-Time Top 100";
      const leaderboardLines = this.getLeaderboardPreviewLines(2);
      const storedNickname = this.loadStoredNickname();
      const previousTodayBest = this.completedGamePreviousStats
        ? this.completedGamePreviousStats.todayBest
        : repeatStats.todayBest;
      const submitCta = getLeaderboardSubmitCta({
        score: this.gameModel.score,
        previousTodayBest,
        submitted: this.leaderboardSubmitted,
        submitting: this.leaderboardSubmitting,
      });
      const nicknameLine = submitCta.message;
      const defaultSubmitStatus = this.leaderboardSubmitted
        ? "Thanks for submitting."
        : storedNickname ? `Nickname: ${storedNickname}` : "Tap submit to choose nickname.";

      const width = this.scale.width;
      const panelWidth = Math.min(338, width - 36);
      const panelHeight = 412;
      const boardSize = this.cellSize * 8;
      const centerX = width / 2;
      const centerY = this.boardOrigin.y + boardSize / 2;
      const panelLayout = getLeaderboardGameOverLayout({ centerX, centerY, panelHeight });
      const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x101827, 0.97);
      panel.setStrokeStyle(2, 0xfacc15, 0.92);
      panel.setDepth(90);
      const title = this.add.text(panelLayout.title.x, panelLayout.title.y, "Game over", this.smallTextStyle(24, "#f8fbff", "800"));
      title.setOrigin(0.5, 0);
      title.setDepth(91);
      const reason = this.add.text(
        panelLayout.reason.x,
        panelLayout.reason.y,
        "Beat your best tier.",
        this.smallTextStyle(14, "#b8c4d8", "700")
      );
      reason.setOrigin(0.5, 0);
      reason.setAlign("center");
      reason.setWordWrapWidth(panelWidth - 48);
      reason.setDepth(91);
      const stats = this.add.text(
        panelLayout.stats.x,
        panelLayout.stats.y,
        statsLines.join("\n"),
        this.smallTextStyle(11, "#d6e2f4", "800")
      );
      stats.setOrigin(0.5, 0);
      stats.setAlign("center");
      stats.setStroke("#101827", 4);
      stats.setDepth(91);
      const divider = this.add.rectangle(panelLayout.divider.x, panelLayout.divider.y, panelWidth - 44, 1, 0x34445f, 0.88);
      divider.setDepth(91);
      const leaderboardHeading = this.add.text(
        panelLayout.leaderboardHeading.x,
        panelLayout.leaderboardHeading.y,
        `Anonymous leaderboard · ${leaderboardTitle}`,
        this.smallTextStyle(12, "#facc15", "800")
      );
      leaderboardHeading.setOrigin(0.5, 0);
      leaderboardHeading.setDepth(91);
      const leaderboardCopy = this.add.text(
        panelLayout.nickname.x,
        panelLayout.nickname.y,
        nicknameLine,
        this.smallTextStyle(10, "#b8c4d8", "700")
      );
      leaderboardCopy.setOrigin(0.5, 0);
      leaderboardCopy.setDepth(91);
      const submitButton = this.add.text(panelLayout.submitButton.x, panelLayout.submitButton.y, submitCta.buttonLabel, this.smallTextStyle(13, submitCta.text, "800"))
        .setOrigin(0.5, 0)
        .setPadding(submitCta.primary ? 22 : 18, 8)
        .setBackgroundColor(submitCta.fill)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.submitLeaderboardScore());
      submitButton.setAlpha(submitCta.primary || this.leaderboardSubmitted ? 1 : 0.9);
      submitButton.setDepth(91);
      const todayButton = this.add.text(panelLayout.todayButton.x, panelLayout.todayButton.y, "Today", this.smallTextStyle(11, this.leaderboardScope === "today" ? "#07111f" : "#d6e2f4", "800"))
        .setOrigin(0.5, 0)
        .setPadding(10, 7)
        .setBackgroundColor(this.leaderboardScope === "today" ? "#8ee8d2" : "#172238")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.setLeaderboardScope("today"));
      todayButton.setDepth(91);
      const allTimeButton = this.add.text(panelLayout.allTimeButton.x, panelLayout.allTimeButton.y, "All-Time", this.smallTextStyle(11, this.leaderboardScope === "alltime" ? "#07111f" : "#d6e2f4", "800"))
        .setOrigin(0.5, 0)
        .setPadding(10, 7)
        .setBackgroundColor(this.leaderboardScope === "alltime" ? "#8ee8d2" : "#172238")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.setLeaderboardScope("alltime"));
      allTimeButton.setDepth(91);
      const leaderboardText = this.add.text(
        panelLayout.leaderboardText.x,
        panelLayout.leaderboardText.y,
        leaderboardLines.join("\n"),
        this.smallTextStyle(10, "#d6e2f4", "800")
      );
      leaderboardText.setOrigin(0.5, 0);
      leaderboardText.setAlign("center");
      leaderboardText.setWordWrapWidth(panelWidth - 48);
      leaderboardText.setDepth(91);
      const submitStatus = this.add.text(
        panelLayout.submitStatus.x,
        panelLayout.submitStatus.y,
        this.leaderboardSubmitStatus || defaultSubmitStatus,
        this.smallTextStyle(9, "#b8c4d8", "700")
      );
      submitStatus.setOrigin(0.5, 0);
      submitStatus.setAlign("center");
      submitStatus.setWordWrapWidth(panelWidth - 44);
      submitStatus.setDepth(91);
      const button = this.add.text(panelLayout.playAgainButton.x, panelLayout.playAgainButton.y, "Play Again", this.smallTextStyle(15, "#07111f", "800"))
        .setOrigin(0.5, 0)
        .setPadding(26, 10)
        .setBackgroundColor("#8ee8d2")
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.restartGame());
      button.setDepth(91);
      this.gameOverItems.push(
        panel,
        title,
        reason,
        stats,
        divider,
        leaderboardHeading,
        leaderboardCopy,
        submitButton,
        todayButton,
        allTimeButton,
        leaderboardText,
        submitStatus,
        button
      );
    }

    showFloatingText(text, x, y, color, options) {
      const opts = options || {};
      const label = this.add.text(
        x,
        y,
        text,
        this.smallTextStyle(opts.fontSize || 18, color || "#f8fbff", opts.weight || "800")
      );
      label.setOrigin(0.5, 0.5);
      label.setAlign("center");
      label.setStroke("#101827", opts.strokeWidth || 5);
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
      const tier = result.clearTier || getClearTier(result.linesCleared);
      const tierLevel = tier.level || 1;
      const label = tierLevel === 1 ? `${tier.label}!` : tier.label;
      const textColor = tierLevel >= 4 ? "#fff8cf" : tierLevel >= 3 ? "#fde68a" : "#fff4b8";
      this.showFloatingText(`${label} +${result.scoreDelta}`, boardCenterX, boardCenterY, textColor, {
        fontSize: tierLevel >= 4 ? 34 : tierLevel === 3 ? 31 : tierLevel === 2 ? 28 : 24,
        lift: tierLevel >= 4 ? 58 : tierLevel === 3 ? 52 : tierLevel === 2 ? 46 : 42,
        duration: tierLevel >= 4 ? 1180 : tierLevel === 3 ? 1080 : 980,
        scale: tierLevel >= 4 ? 1.44 : tierLevel === 3 ? 1.36 : tierLevel === 2 ? 1.3 : 1.24,
        strokeWidth: tierLevel >= 3 ? 8 : 7,
      });
      if (tierLevel >= 4) {
        const boardPulse = this.add.rectangle(
          boardCenterX,
          boardCenterY,
          this.cellSize * 8 + 10,
          this.cellSize * 8 + 10,
          0xfff1a8,
          0.08
        );
        boardPulse.setStrokeStyle(4, 0xfacc15, 0.88);
        boardPulse.setDepth(69);
        this.feedbackItems.push(boardPulse);
        this.tweens.add({
          targets: boardPulse,
          alpha: 0,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 520,
          ease: "Cubic.easeOut",
          onComplete: () => {
            boardPulse.destroy();
            this.feedbackItems = this.feedbackItems.filter((item) => item !== boardPulse);
          },
        });
      }
      result.cells.forEach(([cellX, cellY], index) => {
        const pos = this.boardToScreen(cellX, cellY);
        const burst = this.add.rectangle(
          pos.x + this.cellSize / 2,
          pos.y + this.cellSize / 2,
          this.cellSize - 4,
          this.cellSize - 4,
          tierLevel >= 3 ? 0xfff8cf : 0xfff1a8,
          tierLevel >= 3 ? 0.98 : 0.92
        );
        burst.setStrokeStyle(3, 0xffffff, 1);
        burst.setDepth(70);
        this.feedbackItems.push(burst);
        burst.setScale(tierLevel >= 3 ? 0.8 : 0.86);
        this.tweens.add({
          targets: burst,
          alpha: 0,
          scaleX: 1.88 + tierLevel * 0.16,
          scaleY: 1.88 + tierLevel * 0.16,
          duration: tierLevel >= 3 ? 720 : 620,
          delay: Math.min(tierLevel >= 3 ? 110 : 150, index * (tierLevel >= 3 ? 7 : 10)),
          ease: "Cubic.easeOut",
          onComplete: () => {
            burst.destroy();
            this.feedbackItems = this.feedbackItems.filter((item) => item !== burst);
          },
        });
        if (index % Math.max(1, 3 - tierLevel) === 0) {
          const sparkle = this.add.circle(
            pos.x + this.cellSize * 0.68,
            pos.y + this.cellSize * 0.32,
            Math.max(2, this.cellSize * (tierLevel >= 3 ? 0.075 : 0.055)),
            0xffffff,
            0.95
          );
          sparkle.setDepth(74);
          this.feedbackItems.push(sparkle);
          this.tweens.add({
            targets: sparkle,
            x: sparkle.x + this.cellSize * 0.18,
            y: sparkle.y - this.cellSize * 0.2,
            alpha: 0,
            scale: tierLevel >= 3 ? 2.45 : 2.1,
            duration: tierLevel >= 3 ? 460 : 380,
            delay: Math.min(130, index * (tierLevel >= 3 ? 6 : 8)),
            ease: "Sine.easeOut",
            onComplete: () => {
              sparkle.destroy();
              this.feedbackItems = this.feedbackItems.filter((item) => item !== sparkle);
            },
          });
        }
      });
    }

    playPlacedPieceFeedback(result, piece) {
      if (!result.placedCells || !result.placedCells.length || result.linesCleared) return;
      const fill = Phaser.Display.Color.HexStringToColor(colorForPiece(piece)).color;
      result.placedCells.forEach(([cellX, cellY], index) => {
        const pos = this.boardToScreen(cellX, cellY);
        const settle = this.add.rectangle(
          pos.x + this.cellSize / 2,
          pos.y + this.cellSize / 2,
          this.cellSize - 5,
          this.cellSize - 5,
          0xffffff,
          0.1
        );
        settle.setStrokeStyle(3, fill, 0.92);
        settle.setScale(0.82);
        settle.setDepth(68);
        this.feedbackItems.push(settle);
        this.tweens.add({
          targets: settle,
          alpha: 0,
          scaleX: 1.34,
          scaleY: 1.34,
          duration: 280,
          delay: Math.min(60, index * 12),
          ease: "Sine.easeOut",
          onComplete: () => {
            settle.destroy();
            this.feedbackItems = this.feedbackItems.filter((item) => item !== settle);
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
      if (this.portraitPromptActive) return;
      if (this.leaderboardOverlayOpen) return;
      this.primeAudioForGesture();
      const piece = this.gameModel.tray[slotIndex];
      if (!piece) return;
      const trayOrigin = this.trayOrigins[slotIndex] || { x: pointer.x, y: pointer.y };
      const ghostSize = getDragPieceSize(this.cellSize);
      this.dragState = {
        slotIndex,
        piece,
        trayOrigin: { ...trayOrigin },
        ghostSize,
        ghost: this.drawPiece(piece, trayOrigin.x, trayOrigin.y, ghostSize, 0.82, 60),
        valid: false,
        boardCell: null,
        returning: false,
      };
      this.statusText.setText("");
      this.renderTray();
      this.handlePointerMove(pointer);
    }

    handlePointerMove(pointer) {
      if (this.leaderboardOverlayOpen) return;
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
      this.moveDragGhost(pointer, true);
    }

    handlePointerUp(pointer) {
      if (this.leaderboardOverlayOpen) return;
      if (!this.dragState || this.dragState.returning) return;
      this.unlockAudioFromGesture("placement-attempt", { force: true });
      const state = this.dragState;
      const boardCell = this.getDragBoardCell(pointer, state.piece);
      this.previewCells = [];
      if (!boardCell) {
        this.statusText.setText("Drop onto the board.");
        this.renderBoard();
        this.playInvalidFeedback(pointer, "out_of_bounds");
        this.playSoundCue("invalid");
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
        this.playSoundCue("invalid");
        this.animateGhostBackToTray(state);
        return;
      }
      state.ghost.forEach((item) => item.destroy());
      this.dragState = null;
      this.clearFlashCells = result.cells || [];
      if (result.linesCleared) this.recordBestClearIfNeeded(result.linesCleared);
      const clearTier = result.clearTier || getClearTier(result.linesCleared);
      this.statusText.setText(result.linesCleared ? `${clearTier.label} +${result.scoreDelta}` : `Placed +${result.scoreDelta}`);
      this.playSoundCue(result.linesCleared ? clearTier.sound : "place");
      if (this.gameModel.gameOver) {
        this.time.delayedCall(160, () => this.playSoundCue("gameOver"));
      }
      this.render();
      this.playPlacedPieceFeedback(result, state.piece);
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
      const trayPieceSize = layout.trayPieceSize || getTrayPieceSize(this.cellSize);
      const targetY = state.trayOrigin.y;
      const positions = this.getPieceCellDrawPositions(state.piece, state.trayOrigin.x, targetY, trayPieceSize);
      const returnScale = getReturnGhostScale(state.ghostSize, trayPieceSize);
      let remaining = state.ghost.length;
      state.ghost.forEach((item, index) => {
        const target = positions[index];
        this.tweens.killTweensOf(item);
        this.tweens.add({
          targets: item,
          x: target.x,
          y: target.y,
          scaleX: returnScale,
          scaleY: returnScale,
          alpha: 0.5,
          duration: 210,
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

    cancelActiveDragForRelayout() {
      if (!this.dragState) return;
      if (this.dragState.ghost) {
        this.dragState.ghost.forEach((item) => {
          this.tweens.killTweensOf(item);
          item.destroy();
        });
      }
      this.dragState = null;
      this.previewCells = [];
      this.invalidFlashCells = [];
      this.statusText.setText("");
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
      SOUND_STORAGE_KEY,
      ANON_PLAYER_ID_STORAGE_KEY,
      NICKNAME_STORAGE_KEY,
      CLIENT_VERSION,
      BOARD_VERSION,
      EMBED_HOME_MODE,
      TODAY_BEST_STORAGE_KEY,
      TODAY_BEST_DATE_STORAGE_KEY,
      GAMES_PLAYED_STORAGE_KEY,
      LAST_SCORE_STORAGE_KEY,
      BEST_LINES_STORAGE_KEY,
      BEST_CLEAR_LINES_STORAGE_KEY,
      SOUND_CUES,
      AUDIO_UNLOCK_CUE,
      getDragPlacementCell,
      getBoardCellStyle,
      getPreviewCellStyle,
      getReturnGhostScale,
      getDragPieceSize,
      getTrayPieceSize,
      getTouchEdgeInset,
      getTraySlotLayout,
      pieceFitsInSlot,
      getOrientationRelayoutDelays,
      getEmbedModeFromSearch,
      isHomeEmbedMode,
      getPlayLayoutProfile,
      getMetricChipLayout,
      getMetricTextFontSize,
      shouldShowPortraitPrompt,
      parseSoundPreference,
      shouldRestoreSoundOnPageLoad,
      getSoundToggleLabel,
      shouldPrimeAudioOnGesture,
      getAudioUnlockStatus,
      shouldAttemptAudioUnlock,
      getLineClearBonus,
      getClearTier,
      getScoreTier,
      getScoreTierGoalText,
      validateLeaderboardNickname,
      validateLeaderboardSubmission,
      getLeaderboardSubmitErrorMessage,
      getOrCreateBrowserPlayerId,
      getLeaderboardGameOverLayout,
      getLeaderboardButtonLayout,
      getLeaderboardSubmitCta,
      getTodayKey,
      normalizeRepeatStats,
      completeRepeatStats,
    },
    bootPhaserGame,
  };
});
