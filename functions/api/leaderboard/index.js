import { dedupeLeaderboardRowsByNickname, getDayKey, json, publicEntry, unavailableJson } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return unavailableJson();

  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope") || "today";
  const scope = requestedScope === "alltime" ? "alltime" : "today";
  const dayKey = getDayKey();

  try {
    const scopedWhere = scope === "today" ? "AND s.day_key = ?" : "";
    const betterScopedWhere = scope === "today" ? "AND better.day_key = s.day_key" : "";
    const dedupedSql = `
      SELECT s.id, s.nickname, s.score, s.lines, s.best_clear, s.tier, s.created_at
      FROM blockzzle_scores s
      WHERE s.rejected = 0
        ${scopedWhere}
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
      ORDER BY s.score DESC, s.lines DESC, s.best_clear DESC, s.created_at ASC
      LIMIT 100
    `;
    const statement = scope === "today"
      ? env.DB.prepare(dedupedSql).bind(dayKey)
      : env.DB.prepare(dedupedSql);
    let result;
    try {
      result = await statement.all();
    } catch (error) {
      const baseSql = `
        SELECT id, nickname, score, lines, best_clear, tier, created_at
        FROM blockzzle_scores
        WHERE rejected = 0
      `;
      const fallbackSql = scope === "today"
        ? `${baseSql} AND day_key = ? ORDER BY score DESC, lines DESC, best_clear DESC, created_at ASC LIMIT 500`
        : `${baseSql} ORDER BY score DESC, lines DESC, best_clear DESC, created_at ASC LIMIT 500`;
      result = scope === "today"
        ? await env.DB.prepare(fallbackSql).bind(dayKey).all()
        : await env.DB.prepare(fallbackSql).all();
    }
    const rows = Array.isArray(result.results) ? result.results : [];
    const entries = dedupeLeaderboardRowsByNickname(rows);

    return json({
      ok: true,
      scope,
      entries: entries.map(publicEntry),
    });
  } catch (error) {
    return json({
      ok: false,
      error: "leaderboard_query_failed",
      message: "Leaderboard is temporarily unavailable.",
    }, 503);
  }
}
