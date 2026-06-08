const MAX_SCORE = 1000000;
const MAX_RETURNED_ENTRIES = 100;
const ALLOWED_TIERS = new Set(["Rookie", "Beginner", "Skilled", "Expert", "Master", "World Class"]);
const BLOCKED_NICKNAMES = new Set(["admin", "moderator", "support", "staff", "owner", "badword"]);
const MAX_CLIENT_VERSION_LENGTH = 20;
const MAX_BROWSER_PLAYER_ID_LENGTH = 80;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function unavailableJson() {
  return json({
    ok: false,
    error: "leaderboard_unavailable",
    message: "Leaderboard is coming soon.",
  }, 503);
}

export function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toInteger(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return null;
}

export function normalizeLeaderboardNicknameKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function compareLeaderboardRows(left, right) {
  const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
  if (scoreDelta) return scoreDelta;

  const linesDelta = Number(right.lines || 0) - Number(left.lines || 0);
  if (linesDelta) return linesDelta;

  const clearDelta = Number(right.best_clear || 0) - Number(left.best_clear || 0);
  if (clearDelta) return clearDelta;

  const leftCreatedAt = String(left.created_at || "");
  const rightCreatedAt = String(right.created_at || "");
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt < rightCreatedAt ? -1 : 1;

  const leftId = String(left.id || "");
  const rightId = String(right.id || "");
  if (leftId !== rightId) return leftId < rightId ? -1 : 1;

  return 0;
}

export function dedupeLeaderboardRowsByNickname(rows, limit = MAX_RETURNED_ENTRIES) {
  const bestByNickname = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = normalizeLeaderboardNicknameKey(row && row.nickname);
    if (!key) return;
    const current = bestByNickname.get(key);
    if (!current || compareLeaderboardRows(row, current) < 0) {
      bestByNickname.set(key, row);
    }
  });

  return Array.from(bestByNickname.values())
    .sort(compareLeaderboardRows)
    .slice(0, limit);
}

export function validateNickname(value) {
  const nickname = String(value || "").trim().replace(/\s+/g, " ");
  if (nickname.length < 2 || nickname.length > 16) {
    return { ok: false, error: "Nickname must be 2-16 characters." };
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(nickname)) {
    return { ok: false, error: "Nickname can use letters, numbers, spaces, underscore, and hyphen." };
  }
  if (BLOCKED_NICKNAMES.has(nickname.toLowerCase())) {
    return { ok: false, error: "Please choose another nickname." };
  }
  return { ok: true, nickname };
}

export function validateSubmission(input) {
  const body = input || {};
  const nicknameResult = validateNickname(body.nickname);
  if (!nicknameResult.ok) return nicknameResult;

  const score = toInteger(body.score);
  const lines = toInteger(body.lines);
  const bestClear = toInteger(body.best_clear);
  const durationSeconds = body.duration_seconds === undefined || body.duration_seconds === null || body.duration_seconds === ""
    ? null
    : toInteger(body.duration_seconds);
  const tier = String(body.tier || "").trim();
  const clientVersion = String(body.client_version || "").trim();
  const browserPlayerId = String(body.browser_player_id || "").trim();

  if (score === null || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: "Score is outside the MVP leaderboard range." };
  }
  if (lines === null || lines < 0 || lines > 10000) {
    return { ok: false, error: "Line count is outside the MVP leaderboard range." };
  }
  if (bestClear === null || bestClear < 0 || bestClear > 16) {
    return { ok: false, error: "Best clear is outside the MVP leaderboard range." };
  }
  if (!ALLOWED_TIERS.has(tier)) {
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
  if (clientVersion.length > MAX_CLIENT_VERSION_LENGTH) {
    return { ok: false, error: "Client version is outside the MVP leaderboard range." };
  }
  if (browserPlayerId.length > MAX_BROWSER_PLAYER_ID_LENGTH) {
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
      board_version: "classic-v1",
      client_version: clientVersion || "unknown",
      browser_player_id: browserPlayerId,
    },
  };
}

export function publicEntry(row, index) {
  return {
    rank: index + 1,
    nickname: row.nickname,
    score: row.score,
    lines: row.lines,
    best_clear: row.best_clear,
    tier: row.tier,
    created_at: row.created_at,
  };
}

export function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `score_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
