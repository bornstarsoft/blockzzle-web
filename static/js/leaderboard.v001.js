(function () {
  const rowsEl = document.querySelector("[data-leaderboard-rows]");
  const statusEl = document.querySelector("[data-leaderboard-status]");
  const tabs = Array.from(document.querySelectorAll("[data-scope]"));
  if (!rowsEl || !statusEl || !tabs.length) return;

  function setStatus(text) {
    statusEl.textContent = text || "";
    statusEl.hidden = !text;
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatScore(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString() : "0";
  }

  function renderRows(entries) {
    rowsEl.innerHTML = "";
    if (!entries.length) return;
    rowsEl.innerHTML = entries.map((entry) => `
      <tr>
        <td>${escapeText(entry.rank)}</td>
        <td>${escapeText(entry.nickname)}</td>
        <td>${formatScore(entry.score)}</td>
        <td>${formatScore(entry.lines)}</td>
        <td>${formatScore(entry.best_clear)}</td>
        <td>${escapeText(entry.tier)}</td>
      </tr>
    `).join("");
  }

  async function loadLeaderboard(scope) {
    const resolvedScope = scope === "alltime" ? "alltime" : "today";
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.scope === resolvedScope));
    rowsEl.innerHTML = "";
    setStatus("Loading leaderboard...");
    try {
      const response = await fetch(`/api/leaderboard?scope=${encodeURIComponent(resolvedScope)}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setStatus(response.status === 404 || response.status === 503
          ? "Leaderboard is coming soon."
          : "Leaderboard is temporarily unavailable.");
        return;
      }
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      renderRows(entries);
      setStatus(entries.length ? "" : "No submitted scores yet.");
    } catch (error) {
      setStatus("Leaderboard is temporarily unavailable.");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => loadLeaderboard(tab.dataset.scope));
  });

  loadLeaderboard("today");
})();
