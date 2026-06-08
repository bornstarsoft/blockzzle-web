import { getDayKey, json, publicEntry, unavailableJson } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return unavailableJson();

  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope") || "today";
  const scope = requestedScope === "alltime" ? "alltime" : "today";
  const dayKey = getDayKey();

  try {
    const baseSql = `
      SELECT nickname, score, lines, best_clear, tier, created_at
      FROM blockzzle_scores
      WHERE rejected = 0
    `;
    const scopedSql = scope === "today"
      ? `${baseSql} AND day_key = ? ORDER BY score DESC, created_at ASC LIMIT 100`
      : `${baseSql} ORDER BY score DESC, created_at ASC LIMIT 100`;
    const statement = scope === "today"
      ? env.DB.prepare(scopedSql).bind(dayKey)
      : env.DB.prepare(scopedSql);
    const result = await statement.all();
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
