import { getDayKey, json, publicEntry, unavailableJson } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return unavailableJson();

  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope") || "today";
  const scope = requestedScope === "alltime" ? "alltime" : "today";
  const dayKey = getDayKey();

  try {
    const scopedWhere = scope === "today" ? "AND day_key = ?" : "";
    const dedupedSql = `
      WITH best_scores AS (
        SELECT
          nickname,
          score,
          lines,
          best_clear,
          tier,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(NULLIF(browser_player_id, ''), 'nickname:' || LOWER(nickname))
            ORDER BY score DESC, created_at ASC
          ) AS player_row
        FROM blockzzle_scores
        WHERE rejected = 0
          ${scopedWhere}
      )
      SELECT nickname, score, lines, best_clear, tier, created_at
      FROM best_scores
      WHERE player_row = 1
      ORDER BY score DESC, created_at ASC
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
        SELECT nickname, score, lines, best_clear, tier, created_at
        FROM blockzzle_scores
        WHERE rejected = 0
      `;
      const fallbackSql = scope === "today"
        ? `${baseSql} AND day_key = ? ORDER BY score DESC, created_at ASC LIMIT 100`
        : `${baseSql} ORDER BY score DESC, created_at ASC LIMIT 100`;
      result = scope === "today"
        ? await env.DB.prepare(fallbackSql).bind(dayKey).all()
        : await env.DB.prepare(fallbackSql).all();
    }
    const rows = Array.isArray(result.results) ? result.results : [];

    return json({
      ok: true,
      scope,
      entries: rows.map(publicEntry),
    });
  } catch (error) {
    return json({
      ok: false,
      error: "leaderboard_query_failed",
      message: "Leaderboard is temporarily unavailable.",
    }, 503);
  }
}
