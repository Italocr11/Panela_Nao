const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../js/core.js");

function draft(size = 10, count = 2, pairs = [["p0", "p1"], ["p2", "p3"], ["p4", "p5"]]) {
  return { jogadores: Array.from({ length: size }, (_, i) => ({ id: `p${i}`, nome: `Jogador ${i + 1}` })), panelas: pairs, quantidade_times: count, jogadores_por_time: Math.floor(size / count) };
}

test("sorteios formam times iguais e distribuem todos entre times e reservas respeitando panelas", () => {
  for (const [size, count] of [[10, 2], [11, 2], [13, 3], [60, 12], [60, 2], [7, 7]]) {
    const game = draft(size, count);
    for (let attempt = 0; attempt < 15; attempt++) {
      const result = core.drawDemo(game);
      const all = [...result.times.flatMap(t => [...t.jogadores, ...t.reservas]), ...result.reservas].map(p => p.id);
      assert.equal(all.length, size);
      assert.equal(new Set(all).size, size);
      const sizes = result.times.map(t => t.jogadores.length);
      assert.ok(sizes.every(size => size === game.jogadores_por_time));
      assert.equal(result.reservas.length + result.times.reduce((sum,t) => sum + t.reservas.length,0), size - count * game.jogadores_por_time);
      const benchSizes = result.times.map(t => t.reservas.length);
      if ((size - count * game.jogadores_por_time) % count === 0) assert.ok(benchSizes.every(n => n === (size - count * game.jogadores_por_time) / count));
      else assert.ok(benchSizes.every(n => n === 0));
      for (const [a, b] of game.panelas) assert.ok(!result.times.some(t => t.jogadores.some(p => p.id === a) && t.jogadores.some(p => p.id === b)));
    }
  }
});

test("restrições não são transitivas: A-B e B-C permitem A-C juntos", () => {
  const game = draft(4, 2, [["p0", "p1"], ["p1", "p2"], ["p1", "p3"]]);
  assert.throws(() => core.drawDemo(game), /Não é possível/);
  const possible = draft(4, 2, [["p0", "p1"], ["p1", "p2"]]);
  const result = core.drawDemo(possible);
  assert.ok(result.times.some(t => t.jogadores.some(p => p.id === "p0") && t.jogadores.some(p => p.id === "p2")));
});

test("um triângulo de panelas é impossível com dois times, mas funciona com três", () => {
  const pairs = [["p0", "p1"], ["p1", "p2"], ["p0", "p2"]];
  assert.throws(() => core.drawDemo(draft(6, 2, pairs)), /Não é possível/);
  assert.equal(core.drawDemo(draft(6, 3, pairs)).times.length, 3);
});

test("limite de busca é informado sem declarar falsamente impossibilidade", () => {
  assert.throws(() => core.drawDemo(draft(), { maxVisits: 0 }), /limite de tentativas/);
});

test("rejeita entradas inválidas e duplas invertidas repetidas", () => {
  for (const count of [0, 1, 2.5, 13, NaN]) assert.throws(() => core.validateDraft(draft(10, count)), /inteira/);
  assert.throws(() => core.validateDraft(draft(2, 3, [])), /pelo menos/);
  assert.throws(() => core.validateDraft(draft(101, 2, [])), /limite/);
  assert.throws(() => core.validateDraft(draft(4, 2, [["p0", "p0"]])), /diferentes/);
  assert.throws(() => core.validateDraft(draft(4, 2, [["p0", "missing"]])), /cadastrados/);
  assert.throws(() => core.validateDraft(draft(4, 2, [["p0", "p1"], ["p1", "p0"]])), /já está/);
  const duplicate = draft(); duplicate.jogadores[1].nome = "  JOGADOR  1  ";
  assert.throws(() => core.validateDraft(duplicate), /repetidos/);
  assert.equal(core.nameKey(" João "), core.nameKey("JOA\u0303O"));
});

test("resposta da API é conferida por quantidade, tamanhos, jogadores e panelas", () => {
  const game = draft(4, 2, [["p0", "p1"]]);
  const p = game.jogadores;
  const result = { times: [{ jogadores: [p[0], p[2]] }, { jogadores: [p[1], p[3]] }] };
  assert.equal(core.validateResult(result, game).times[0].nome, "Time 1");
  assert.throws(() => core.validateResult({ times: [] }, game), /quantidade/);
  assert.throws(() => core.validateResult({ times: [{ jogadores: [p[0]] }, { jogadores: [p[1], p[2], p[3]] }] }, game), /tamanhos/);
  assert.throws(() => core.validateResult({ times: [{ jogadores: [p[0], p[2]] }, { jogadores: [p[0], p[3]] }] }, game), /repetidos/);
  assert.throws(() => core.validateResult({ times: [{ jogadores: [p[0], p[2]] }, { jogadores: [{ id: "unknown" }, p[3]] }] }, game), /desconhecidos/);
  assert.throws(() => core.validateResult({ times: [{ jogadores: [p[0], p[1]] }, { jogadores: [p[2], p[3]] }] }, game), /panela/);
});

function apiContext(fetch, options = {}) {
  const window = { PANELA_CONFIG: { mode: "api", apiUrl: "http://localhost/api/sortear", timeoutMs: 100, ...options }, PanelaCore: core };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/api.js"), "utf8"), { window, fetch, AbortController, setTimeout, clearTimeout, TypeError });
  return window.PanelaAPI;
}

test("padrão de cinco jogadores, tamanho configurável e reservas além do resto da divisão", () => {
  const game = draft(17, 2, []);
  delete game.jogadores_por_time;
  const result = core.drawDemo(game);
  assert.deepEqual(result.times.map(t => t.jogadores.length), [5, 5]);
  assert.equal(result.reservas.length, 7);
  const custom = core.drawDemo({ ...game, jogadores_por_time: 3 });
  assert.deepEqual(custom.times.map(t => t.jogadores.length), [3, 3]);
  assert.equal(custom.reservas.length, 11);
  for (const size of [0, -1, 2.5, 51, null, "5"]) {
    assert.throws(() => core.drawDemo({ ...game, jogadores_por_time: size }), /inteira/);
  }
  assert.throws(() => core.drawDemo({ ...draft(9, 2, []), jogadores_por_time: 5 }), /necessários 10/);
});

test("busca alternativas de reserva quando só uma pessoa pode ficar fora", () => {
  const game = draft(5, 2, [["p0", "p1"], ["p0", "p2"], ["p0", "p3"], ["p0", "p4"]]);
  assert.deepEqual(core.drawDemo(game).reservas.map(p => p.id), ["p0"]);
});

test("reservas são sorteados e a entrada é preservada", () => {
  const game = draft(11, 2, []);
  const before = JSON.stringify(game);
  const reserveIds = [0, 0.999].map(random => {
    const context = { module: { exports: {} }, Math: Object.assign(Object.create(Math), { random: () => random }) };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8"), context);
    return context.module.exports.drawDemo(game).reservas[0].id;
  });
  assert.notEqual(reserveIds[0], reserveIds[1]);
  assert.equal(JSON.stringify(game), before);
});

test("valida reservas por time e impede repetição ou jogadores desconhecidos", () => {
  const game = { ...draft(6, 2, [["p0", "p1"]]), jogadores_por_time: 2 };
  const p = game.jogadores;
  const result = { times: [{ jogadores: [p[2], p[3]], reservas: [p[0]] }, { jogadores: [p[4], p[5]], reservas: [p[1]] }], reservas: [] };
  assert.equal(core.validateResult(result, game).times[0].reservas.length, 1);
  assert.throws(() => core.validateResult({ ...result, reservas: [p[0],p[1]] }, game), /reservas/);
  assert.throws(() => core.validateResult({ ...result, reservas: null }, game), /reservas/);
  const changeBench = bench => ({ ...result, times: [{ ...result.times[0], reservas: bench }, result.times[1]] });
  assert.throws(() => core.validateResult(changeBench([]), game), /reservas por time/);
  assert.throws(() => core.validateResult(changeBench([p[2]]), game), /repetidos/);
  assert.throws(() => core.validateResult(changeBench([{id:"unknown"}]), game), /desconhecidos/);
});

test("modo API envia o contrato esperado e valida a resposta", async () => {
  const game = draft();
  const result = core.drawDemo(game);
  const api = apiContext(async (url, request) => {
    assert.equal(url, "http://localhost/api/sortear");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(request.body), game);
    return { ok: true, json: async () => result };
  });
  assert.deepEqual(await api.draw(game), result);
});

test("reservas ficam dentro dos times só quando a divisão é exata", () => {
  for (const [total, count, teamSize, benches, shared] of [
    [14, 2, 5, [2, 2], 0], [18, 3, 5, [1, 1, 1], 0],
    [13, 2, 5, [0, 0], 3], [22, 3, 5, [0, 0, 0], 7], [10, 2, 5, [0, 0], 0],
  ]) {
    const game = { ...draft(total, count, []), jogadores_por_time: teamSize };
    const result = core.drawDemo(game);
    assert.deepEqual(result.times.map(t => t.reservas.length), benches);
    assert.equal(result.reservas.length, shared);
    assert.deepEqual(result.times.map(t => t.jogadores.length), Array(count).fill(teamSize));
    const ids = [...result.times.flatMap(t => [...t.jogadores, ...t.reservas]), ...result.reservas].map(p => p.id);
    assert.equal(new Set(ids).size, total);
    assert.deepEqual(core.validateResult(result, game), result);
  }
});

test("migra o resultado antigo uma única vez sem alterar titulares nem o cadastro", () => {
  const game = { ...draft(14, 2, []), jogadores_por_time: 5 };
  const p = game.jogadores;
  const legacy = { times: [{ jogadores: p.slice(0, 5) }, { jogadores: p.slice(5, 10) }], reservas: p.slice(10) };
  const before = JSON.stringify(legacy);
  const result = core.distributeReserves(legacy, game, values => [...values].reverse());
  assert.deepEqual(result.times[0].jogadores, legacy.times[0].jogadores);
  assert.deepEqual(result.times[0].reservas, [p[13], p[12]]);
  assert.deepEqual(result.times[1].reservas, [p[11], p[10]]);
  assert.deepEqual(core.validateResult(result, game).reservas, []);
  assert.equal(core.distributeReserves(result, game), result);
  assert.equal(JSON.stringify(legacy), before);
});

test("erros da API, rede e timeout são exibidos sem sorteio local silencioso", async () => {
  await assert.rejects(apiContext(async () => ({ ok: false, json: async () => ({ detail: "Duplas incompatíveis" }) })).draw(draft()), /Duplas incompatíveis/);
  await assert.rejects(apiContext(async () => { throw new TypeError("Failed to fetch"); }).draw(draft()), /conectar/);
  await assert.rejects(apiContext(async () => ({ ok: true, json: async () => { throw new SyntaxError(); } })).draw(draft()), /resposta inválida/);
  await assert.rejects(apiContext((_, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })))), { timeoutMs: 5 }).draw(draft()), /demorou/);
});
