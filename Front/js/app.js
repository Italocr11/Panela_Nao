(function () {
  "use strict";
  const core = window.PanelaCore;
  const state = window.PanelaStorage.load();
  const draft = state.draft;
  const $ = (id) => document.getElementById(id);
  const playerInput = $("player-name");
  const teamInput = $("team-count");
  const teamSizeInput = $("players-per-team");
  let busy = false;
  let idSequence = 0;
  const id = () => window.crypto?.randomUUID?.() ?? `p-${Date.now()}-${++idSequence}-${Math.random().toString(36).slice(2)}`;

  function notice(message, error = false) {
    $("notice").textContent = message;
    $("notice").className = error ? "notice error" : "notice";
    $("notice").hidden = !message;
    if (error) $("notice").scrollIntoView({ block: "nearest", behavior: "auto" });
  }
  function save() {
    state.result = null;
    state.mode = null;
    if (!window.PanelaStorage.save(state)) notice("O navegador não conseguiu salvar sua partida. Habilite o armazenamento para abrir a página dos times.", true);
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function removeButton(label, action) {
    const button = element("button", "remove-button", "×");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);
    return button;
  }
  function renderSummary() {
    const count = Number(teamInput.value);
    const valid = Number.isInteger(count) && count >= 2 && count <= 12;
    $("decrease-teams").disabled = valid && count <= 2;
    $("increase-teams").disabled = valid && count >= 12;
    if (!valid) { $("team-summary").textContent = "Escolha entre 2 e 12 times."; return; }
    const teamSize = Number(teamSizeInput.value);
    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 50) {
      $("team-summary").textContent = "Escolha entre 1 e 50 jogadores por time.";
      return;
    }
    const required = count * teamSize;
    const size = draft.jogadores.length;
    if (size < required) {
      const missing = required - size;
      $("team-summary").textContent = `${missing === 1 ? "Falta 1 jogador" : `Faltam ${missing} jogadores`} para formar ${count} times de ${teamSize}. Adicione jogadores ou ajuste as quantidades.`;
      return;
    }
    const reserves = size - required;
    $("team-summary").textContent = `${count} times com ${teamSize} ${teamSize === 1 ? "jogador" : "jogadores"} em cada. ${reserves ? reserves % count === 0 ? `${reserves / count} ${reserves / count === 1 ? "reserva sorteado" : "reservas sorteados"} por time.` : `${reserves} ${reserves === 1 ? "reserva em banco separado" : "reservas em banco separado"}.` : "Sem reservas."}`;
  }
  function render() {
    $("player-list").replaceChildren();
    draft.jogadores.forEach((player, index) => {
      const row = element("li", "player-row");
      const initials = player.nome.split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0] ?? "").join("").toLocaleUpperCase("pt-BR");
      row.append(element("span", "player-number", String(index + 1).padStart(2, "0")), element("span", "player-avatar", initials), element("span", "player-name", player.nome), removeButton(`Remover ${player.nome}`, () => {
        if (busy) return;
        const removedPairs = draft.panelas.filter(pair => pair.includes(player.id)).length;
        draft.jogadores = draft.jogadores.filter(p => p.id !== player.id);
        draft.panelas = draft.panelas.filter(pair => !pair.includes(player.id));
        notice(`${player.nome} foi removido.${removedPairs ? " As panelas desse jogador também foram removidas." : ""}`);
        save(); render(); playerInput.focus();
      }));
      $("player-list").append(row);
    });
    $("player-count").textContent = `${draft.jogadores.length} na lista`;
    $("players-empty").hidden = draft.jogadores.length > 0;
    for (const select of [$("player-one"), $("player-two")]) {
      const selected = select.value;
      select.replaceChildren(new Option("Selecione alguém", ""));
      draft.jogadores.forEach(player => select.add(new Option(player.nome, player.id)));
      select.value = draft.jogadores.some(p => p.id === selected) ? selected : "";
      select.disabled = draft.jogadores.length < 2;
    }
    $("add-restriction").disabled = draft.jogadores.length < 2;
    $("restriction-list").replaceChildren();
    const byId = new Map(draft.jogadores.map(player => [player.id, player.nome]));
    // Remove pares órfãos caso um rascunho antigo tenha sido alterado fora da página.
    draft.panelas = draft.panelas.filter(pair => byId.has(pair[0]) && byId.has(pair[1]));
    draft.panelas.forEach(pair => {
      const row = element("li", "restriction-row");
      const names = element("div", "pair-names");
      names.append(element("span", "", byId.get(pair[0])), element("span", "versus", "×"), element("span", "", byId.get(pair[1])));
      row.append(names, removeButton(`Remover panela entre ${byId.get(pair[0])} e ${byId.get(pair[1])}`, () => {
        if (busy) return;
        draft.panelas = draft.panelas.filter(p => core.pairKey(p) !== core.pairKey(pair));
        notice("Dupla removida. Esses jogadores podem jogar juntos.");
        save(); render(); $("player-one").focus();
      }));
      $("restriction-list").append(row);
    });
    $("restriction-count").textContent = `${draft.panelas.length} ${draft.panelas.length === 1 ? "dupla" : "duplas"}`;
    $("restrictions-empty").hidden = draft.panelas.length > 0;
    $("load-example").hidden = draft.jogadores.length > 0;
    renderSummary();
  }

  $("player-form").addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    const nome = core.cleanName(playerInput.value);
    if (!nome) { notice("Digite o nome do jogador.", true); playerInput.focus(); return; }
    if (draft.jogadores.length >= core.MAX_PLAYERS) { notice(`O limite é de ${core.MAX_PLAYERS} jogadores.`, true); return; }
    if (draft.jogadores.some(p => core.nameKey(p.nome) === core.nameKey(nome))) { notice("Esse jogador já está na lista. Para nomes iguais, use um sobrenome ou apelido.", true); playerInput.focus(); return; }
    draft.jogadores.push({ id: id(), nome });
    playerInput.value = "";
    notice(`${nome} entrou na escalação.`);
    save(); render(); playerInput.focus();
    $("player-list").lastElementChild?.scrollIntoView({ block: "nearest" });
  });
  $("restriction-form").addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    const pair = [$("player-one").value, $("player-two").value];
    if (!pair[0] || !pair[1]) { notice("Selecione os dois jogadores da dupla.", true); return; }
    if (pair[0] === pair[1]) { notice("Escolha dois jogadores diferentes.", true); return; }
    if (draft.panelas.some(p => core.pairKey(p) === core.pairKey(pair))) { notice("Essa dupla já está na lista de panelas.", true); return; }
    draft.panelas.push(pair);
    $("player-one").value = "";
    $("player-two").value = "";
    notice("Panela marcada. Essa dupla não jogará no mesmo time.");
    save(); render(); $("player-one").focus();
  });
  $("load-example").addEventListener("click", () => {
    if (busy || draft.jogadores.length) return;
    draft.jogadores = ["João", "Matheus", "Gabriel S.", "Gabriel G.", "Zé", "Jorge", "Lucas", "Pedro", "Rafael", "Bruno"].map(nome => ({ id: id(), nome }));
    draft.panelas = [[0, 1], [2, 3], [4, 5]].map(pair => pair.map(i => draft.jogadores[i].id));
    draft.quantidade_times = 2;
    draft.jogadores_por_time = core.DEFAULT_TEAM_SIZE;
    teamInput.value = "2";
    teamSizeInput.value = String(core.DEFAULT_TEAM_SIZE);
    notice("Exemplo carregado: 10 jogadores e 3 panelas. Pode editar à vontade.");
    save(); render();
  });
  function updateTeams() {
    if (busy) return;
    const count = Number(teamInput.value);
    if (Number.isInteger(count) && count >= 2 && count <= 12) { draft.quantidade_times = count; save(); }
    renderSummary();
  }
  teamInput.addEventListener("input", updateTeams);
  teamSizeInput.addEventListener("input", () => {
    if (busy) return;
    const size = Number(teamSizeInput.value);
    if (Number.isInteger(size) && size >= 1 && size <= 50) { draft.jogadores_por_time = size; save(); }
    renderSummary();
  });
  for (const [button, change] of [["decrease-teams", -1], ["increase-teams", 1]]) {
    $(button).addEventListener("click", () => {
      const current = Number(teamInput.value);
      teamInput.value = String(Math.min(12, Math.max(2, (Number.isInteger(current) ? current : 2) + change)));
      updateTeams();
    });
  }
  $("draw-teams").addEventListener("click", async () => {
    if (busy) return;
    const button = $("draw-teams");
    let disabledStates = [];
    try {
      const count = Number(teamInput.value);
      const size = Number(teamSizeInput.value);
      core.validateDraft({ ...draft, quantidade_times: count, jogadores_por_time: size });
      draft.quantidade_times = count;
      draft.jogadores_por_time = size;
      busy = true;
      disabledStates = [...document.querySelectorAll("main button, main input, main select")].map(control => [control, control.disabled]);
      disabledStates.forEach(([control]) => { control.disabled = true; });
      button.textContent = "Separando os times…";
      button.setAttribute("aria-busy", "true");
      notice("Sorteando os jogadores e conferindo as panelas…");
      const result = await window.PanelaAPI.draw(draft);
      if (!window.PanelaStorage.save({ draft, result, mode: window.PANELA_CONFIG.mode })) throw new Error("Não foi possível salvar o resultado. Habilite o armazenamento do navegador para continuar.");
      window.location.assign("times.html");
    } catch (error) { notice(error.message, true); }
    finally {
      busy = false;
      disabledStates.forEach(([control, wasDisabled]) => { control.disabled = wasDisabled; });
      const icon = element("span", "", "↗");
      icon.setAttribute("aria-hidden", "true");
      button.replaceChildren(document.createTextNode("Separar os times "), icon);
      button.removeAttribute("aria-busy");
    }
  });
  teamInput.value = String(draft.quantidade_times);
  teamSizeInput.value = String(draft.jogadores_por_time ?? core.DEFAULT_TEAM_SIZE);
  if (window.PANELA_CONFIG.mode === "api") $("mode-note").textContent = "Sorteio conectado ao servidor da partida.";
  render();
  // Atualiza ao voltar pelo histórico, inclusive quando o navegador restaura a página do cache.
  window.addEventListener("pageshow", event => { if (event.persisted) window.location.reload(); });
})();
