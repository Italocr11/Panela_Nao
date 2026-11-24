(function () {
  "use strict";
  const state = window.PanelaStorage.load();
  const $ = (id) => document.getElementById(id);
  const colors = ["#c5f277", "#ff9877", "#89c9ec", "#e2b4f5", "#f4d179", "#91dfc4"];
  let busy = false;
  let clipboardText = "";
  function notice(message, error = false) {
    $("notice").textContent = message;
    $("notice").className = error ? "notice error" : "notice";
    $("notice").hidden = !message;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function shirt() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 40 42");
    svg.setAttribute("class", "team-shirt");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M13 4 3 10l4 10 5-3v21h16V17l5 3 4-10-10-6c-2 6-12 6-14 0Z");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    svg.append(path);
    return svg;
  }
  function benchArt() {
    const image = element("img", "bench-art");
    image.src = "assets/reserve-bench.png";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.width = 90;
    image.height = 32;
    return image;
  }
  function render() {
    const prepared = window.PanelaCore.distributeReserves(state.result, state.draft);
    const result = window.PanelaCore.validateResult(prepared, state.draft);
    if (prepared !== state.result) {
      state.result = result;
      window.PanelaStorage.save(state);
    }
    $("teams-grid").replaceChildren();
    const groups = [...result.times];
    if (result.reservas.length) groups.push({ nome: "Reservas", jogadores: result.reservas, reservas: [] });
    groups.forEach((team, index) => {
      const isSharedReserve = index === result.times.length;
      const card = element("section", "team-card");
      card.style.setProperty("--team-color", colors[index % colors.length]);
      const heading = element("div", "team-card-header");
      const identity = element("div", "team-identity");
      const title = element("h2", "", team.nome);
      title.id = `team-${index}`;
      card.setAttribute("aria-labelledby", title.id);
      identity.append(isSharedReserve ? benchArt() : shirt(), title);
      heading.append(identity, element("span", "count-badge", `${team.jogadores.length} ${isSharedReserve ? (team.jogadores.length === 1 ? "jogador" : "jogadores") : "titulares"}`));
      const roster = element("ol", "team-roster");
      team.jogadores.forEach((player, i) => {
        const row = element("li");
        row.append(element("span", "", String(i + 1).padStart(2, "0")), element("span", "", player.nome));
        roster.append(row);
      });
      const footer = element("div", "team-card-footer");
      footer.append(element("span", "", "PANELA NÃO / ESCALAÇÃO"), element("span", "", "↗"));
      card.append(heading, roster, footer);
      if (team.reservas.length) {
        const bench = element("section", "team-bench");
        const benchHeader = element("div", "bench-header");
        const benchIdentity = element("div", "bench-identity");
        const benchTitle = element("h3", "", "Reservas");
        benchTitle.id = `bench-${index}`;
        bench.setAttribute("aria-labelledby", benchTitle.id);
        benchIdentity.append(benchTitle, benchArt());
        benchHeader.append(benchIdentity, element("span", "bench-count", `${team.reservas.length} no banco`));
        const names = element("ol", "bench-roster");
        team.reservas.forEach(player => names.append(element("li", "", player.nome)));
        bench.append(benchHeader, names);
        card.insertBefore(bench, footer);
      }
      if (isSharedReserve) footer.firstChild.textContent = "RESERVAS SEM VÍNCULO COM UM TIME";
      $("teams-grid").append(card);
    });
    const count = state.draft.panelas.length;
    const reserveCount = result.reservas.length + result.times.reduce((total, team) => total + team.reservas.length, 0);
    $("result-stats").textContent = `${state.draft.jogadores.length - reserveCount} em campo · ${result.times.length} times · ${reserveCount} ${reserveCount === 1 ? "reserva" : "reservas"} · ${count} ${count === 1 ? "panela separada" : "panelas separadas"}`;
    $("mode-note").textContent = state.mode === "api" ? "Sorteio realizado pelo servidor da partida." : "MODO DEMONSTRAÇÃO · Sorteio feito neste navegador.";
    clipboardText = `⚽ PANELA NÃO\n\n${groups.map(team => `${team.nome.toLocaleUpperCase("pt-BR")}\n${team.jogadores.map((player, i) => `${i + 1}. ${player.nome}`).join("\n")}${team.reservas.length ? `\n\nRESERVAS\n${team.reservas.map((player, i) => `${i + 1}. ${player.nome}`).join("\n")}` : ""}`).join("\n\n")}\n\n${count} ${count === 1 ? "panela separada" : "panelas separadas"}. Bora pro jogo!`;
    $("results-content").hidden = false;
    $("no-results").hidden = true;
  }
  $("copy-teams").addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(clipboardText);
      notice("Times copiados! Agora é só mandar no grupo.");
    } catch {
      // Seleção manual também funciona quando o navegador bloqueia a área de transferência.
      let area = $("manual-copy");
      if (!area) {
        area = document.createElement("textarea");
        area.id = "manual-copy";
        area.readOnly = true;
        area.setAttribute("aria-label", "Times para copiar manualmente");
        area.style.cssText = "display:block;width:100%;min-height:200px;padding:16px;background:#10170e;color:#f3f3e9;border:1px solid #c5f277;border-radius:3px;margin-top:20px;font:13px Arial";
        $("results-content").append(area);
      }
      area.value = clipboardText;
      area.focus();
      area.select();
      notice("Use Ctrl+C (ou a opção Copiar do celular) para copiar os times selecionados abaixo.");
    }
  });
  $("redraw-teams").addEventListener("click", async () => {
    if (busy) return;
    const button = $("redraw-teams");
    const previousResult = state.result;
    const previousMode = state.mode;
    busy = true;
    button.disabled = true;
    button.textContent = "Sorteando…";
    button.setAttribute("aria-busy", "true");
    try {
      notice("Conferindo as panelas para um novo sorteio…");
      const result = await window.PanelaAPI.draw(state.draft);
      state.result = result;
      state.mode = window.PANELA_CONFIG.mode;
      if (!window.PanelaStorage.save(state)) throw new Error("Não foi possível salvar o novo sorteio. Confira o armazenamento do navegador.");
      render();
      $("manual-copy")?.remove();
      notice("Novo sorteio pronto. Todas as panelas continuam separadas.");
    } catch (error) {
      state.result = previousResult;
      state.mode = previousMode;
      notice(error.message, true);
    } finally {
      busy = false;
      button.disabled = false;
      const icon = element("span", "", "↻");
      icon.setAttribute("aria-hidden", "true");
      button.replaceChildren(document.createTextNode("Sortear de novo "), icon);
      button.removeAttribute("aria-busy");
    }
  });
  try {
    if (!state.result) { $("no-results").hidden = false; return; }
    render();
  } catch (error) {
    $("results-content").hidden = true;
    $("no-results").hidden = false;
    notice(error.message, true);
  }
  window.addEventListener("pageshow", event => { if (event.persisted) window.location.reload(); });
})();
