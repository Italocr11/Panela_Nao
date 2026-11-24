(function () {
  "use strict";
  const key = "panela-nao:partida:v1";
  let storage = null;
  for (const type of ["localStorage", "sessionStorage"]) {
    try {
      const candidate = window[type];
      candidate.setItem(`${key}:test`, "ok");
      candidate.removeItem(`${key}:test`);
      storage = candidate;
      break;
    } catch { /* Tenta a próxima opção se o navegador bloquear o armazenamento. */ }
  }
  const empty = () => ({ jogadores: [], panelas: [], quantidade_times: 2, jogadores_por_time: window.PanelaCore.DEFAULT_TEAM_SIZE });
  function load() {
    try {
      const state = JSON.parse(storage?.getItem(key) ?? "null");
      if (!state || !Array.isArray(state.draft?.jogadores) || !Array.isArray(state.draft?.panelas)) return { draft: empty(), result: null };
      // Permite rascunhos ainda incompletos, mas descarta estruturas corrompidas.
      const { jogadores, panelas, quantidade_times } = state.draft;
      if (!Number.isInteger(quantidade_times) || quantidade_times < 2 || quantidade_times > 12 || jogadores.length > window.PanelaCore.MAX_PLAYERS || jogadores.some(p => !p || typeof p.id !== "string" || typeof p.nome !== "string") || panelas.some(p => !Array.isArray(p) || p.length !== 2)) return { draft: empty(), result: null };
      if (state.draft.jogadores_por_time === undefined) {
        state.draft.jogadores_por_time = window.PanelaCore.DEFAULT_TEAM_SIZE;
        state.result = null;
      }
      return state;
    } catch { return { draft: empty(), result: null }; }
  }
  function save(state) {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(state));
      return true;
    } catch { return false; }
  }
  window.PanelaStorage = { load, save };
})();
