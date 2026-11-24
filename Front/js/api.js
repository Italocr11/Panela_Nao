(function () {
  "use strict";
  const config = window.PANELA_CONFIG;
  async function draw(draft) {
    window.PanelaCore.validateDraft(draft);
    if (config.mode === "demo") {
      // Entrega um quadro ao navegador para exibir o estado de carregamento.
      await new Promise((resolve) => setTimeout(resolve, 40));
      return window.PanelaCore.drawDemo(draft);
    }
    if (config.mode !== "api") throw new Error("Modo de sorteio inválido na configuração.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(draft),
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error("A API retornou uma resposta inválida. Tente novamente."); }
      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : typeof data?.mensagem === "string" ? data.mensagem : "Não foi possível separar os times. Confira os jogadores e as panelas.";
        throw new Error(detail);
      }
      return window.PanelaCore.validateResult(data, draft);
    } catch (error) {
      if (error.name === "AbortError") throw new Error("O servidor demorou para responder. Tente novamente.");
      if (error instanceof TypeError) throw new Error("Não foi possível conectar ao servidor. Confira se o backend está em execução.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.PanelaAPI = { draw };
})();
