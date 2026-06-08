import { createId, getDayKey, json, publicEntry, unavailableJson, validateSubmission } from "./_shared.js";

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

async function enforceBasicRateLimit(db, browserPlayerId, now) {
  if (!browserPlayerId) return { ok: true };
  const since = new Date(now.getTime() - 60 * 1000).toISOString();
  const result = await db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM blockzzle_scores
      WHERE browser_player_id = ?
        AND created_at >= ?
    `)
    .bind(browserPlayerId, since)
    .first();
  const count = Number(result && result.count ? result.count : 0);
  if (count >= 6) {
    return { ok: false, error: "Too many submissions. Please wait a moment." };
  }
  return { ok: true };
}

async function getRank(db, score, dayKey) {
  const todayResult = await db
    .prepare(`
      SELECT COUNT(*) + 1 AS rank
      FROM blockzzle_scores
      WHERE rejected = 0
        AND day_key = ?
        AND score > ?
    `)
    .bind(dayKey, score)
    .first();
  const allTimeResult = await db
    .prepare(`
      SELECT COUNT(*) + 1 AS rank
      FROM blockzzle_scores
      WHERE rejected = 0
        AND score > ?
    `)
    .bind(score)
    .first();
  return {
    today_rank: Number(todayResult && todayResult.rank ? todayResult.rank : 1),
    alltime_rank: Number(allTimeResult && allTimeResult.rank ? allTimeResult.rank : 1),
  };
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return unavailableJson();

  const body = await readJson(request);
  if (!body) {
    return json({ ok: false, error: "invalid_json", message: "Invalid submission." }, 400);
  }

  const validation = validateSubmission(body);
  if (!validation.ok) {
    return json({ ok: false, error: "invalid_submission", message: validation.error }, 400);
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const dayKey = getDayKey(now);
  const entry = validation.entry;

  try {
    const rateLimit = await enforceBasicRateLimit(env.DB, entry.browser_player_id, now);
    if (!rateLimit.ok) {
      return json({ ok: false, error: "rate_limited", message: rateLimit.error }, 429);
    }

    const id = createId();
    await env.DB
      .prepare(`
        INSERT INTO blockzzle_scores (
          id,
          nickname,
          score,
          lines,
          best_clear,
          tier,
          duration_seconds,
          board_version,
          client_version,
          browser_player_id,
          day_key,
          created_at,
          rejected
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `)
      .bind(
        id,
        entry.nickname,
        entry.score,
        entry.lines,
        entry.best_clear,
        entry.tier,
        entry.duration_seconds,
        entry.board_version,
        entry.client_version,
        entry.browser_player_id,
        dayKey,
        createdAt
      )
      .run();

    const ranks = await getRank(env.DB, entry.score, dayKey);
    const publicRow = publicEntry({
      nickname: entry.nickname,
      score: entry.score,
      lines: entry.lines,
      best_clear: entry.best_clear,
      tier: entry.tier,
      created_at: createdAt,
    }, ranks.today_rank - 1);

    return json({
      ok: true,
      entry: publicRow,
      today_rank: ranks.today_rank,
      alltime_rank: ranks.alltime_rank,
    });
  } catch (error) {
    return json({
      ok: false,
      error: "leaderboard_submit_failed",
      message: "Leaderboard is temporarily unavailable.",
    }, 503);
  }
}
