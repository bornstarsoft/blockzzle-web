import { createId, getDayKey, json, publicEntry, unavailableJson, validateSubmission } from "./_shared.js";

const MAX_BROWSER_DAILY_SUBMISSIONS = 50;
const MAX_NICKNAME_DAILY_SUBMISSIONS = 10;
const MAX_BROWSER_MINUTE_SUBMISSIONS = 6;

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

async function countAccepted(db, sql, bindings) {
  const result = await db.prepare(sql).bind(...bindings).first();
  return Number(result && result.count ? result.count : 0);
}

async function enforceSubmissionLimits(db, entry, dayKey, now) {
  if (!entry.browser_player_id) {
    const nicknameCount = await countAccepted(db, `
      SELECT COUNT(*) AS count
      FROM blockzzle_scores
      WHERE rejected = 0
        AND day_key = ?
        AND LOWER(nickname) = LOWER(?)
    `, [dayKey, entry.nickname]);

    if (nicknameCount >= MAX_NICKNAME_DAILY_SUBMISSIONS) {
      return { ok: false };
    }
    return { ok: true };
  }

  const dailyCount = await countAccepted(db, `
    SELECT COUNT(*) AS count
    FROM blockzzle_scores
    WHERE rejected = 0
      AND day_key = ?
      AND browser_player_id = ?
  `, [dayKey, entry.browser_player_id]);

  if (dailyCount >= MAX_BROWSER_DAILY_SUBMISSIONS) {
    return { ok: false };
  }

  const since = new Date(now.getTime() - 60 * 1000).toISOString();
  const burstCount = await countAccepted(db, `
    SELECT COUNT(*) AS count
    FROM blockzzle_scores
    WHERE rejected = 0
      AND browser_player_id = ?
      AND created_at >= ?
  `, [entry.browser_player_id, since]);

  if (burstCount >= MAX_BROWSER_MINUTE_SUBMISSIONS) {
    return { ok: false };
  }

  return { ok: true };
}

async function getScopedRank(db, score, dayKey) {
  const scopedWhere = dayKey ? "AND s.day_key = ?" : "";
  const betterScopedWhere = dayKey ? "AND better.day_key = s.day_key" : "";
  const bindings = dayKey ? [dayKey, score] : [score];
  const result = await db
    .prepare(`
      SELECT COUNT(*) + 1 AS rank
      FROM blockzzle_scores s
      WHERE s.rejected = 0
        ${scopedWhere}
        AND s.score > ?
        AND NOT EXISTS (
          SELECT 1
          FROM blockzzle_scores better
          WHERE better.rejected = 0
            ${betterScopedWhere}
            AND LOWER(TRIM(better.nickname)) = LOWER(TRIM(s.nickname))
            AND (
              better.score > s.score
              OR (better.score = s.score AND better.lines > s.lines)
              OR (better.score = s.score AND better.lines = s.lines AND better.best_clear > s.best_clear)
              OR (
                better.score = s.score
                AND better.lines = s.lines
                AND better.best_clear = s.best_clear
                AND better.created_at < s.created_at
              )
              OR (
                better.score = s.score
                AND better.lines = s.lines
                AND better.best_clear = s.best_clear
                AND better.created_at = s.created_at
                AND better.id < s.id
              )
            )
        )
    `)
    .bind(...bindings)
    .first();

  return Number(result && result.rank ? result.rank : 1);
}

async function getRank(db, score, dayKey) {
  const todayRank = await getScopedRank(db, score, dayKey);
  const allTimeRank = await getScopedRank(db, score, "");
  return {
    today_rank: todayRank,
    alltime_rank: allTimeRank,
  };
}

async function getLegacyRank(db, score, dayKey) {
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
    const rateLimit = await enforceSubmissionLimits(env.DB, entry, dayKey, now);
    if (!rateLimit.ok) {
      return json({
        ok: false,
        error: "rate_limited",
        message: "Leaderboard submission was limited. Try again later.",
      }, 429);
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

    let ranks;
    try {
      ranks = await getRank(env.DB, entry.score, dayKey);
    } catch (error) {
      ranks = await getLegacyRank(env.DB, entry.score, dayKey);
    }
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
