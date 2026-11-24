const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("../server.cjs");
const { ErroSorteio, confere } = require("../sorteio.cjs");
const { validateResult } = require("../../Front/js/core.js");

const dados = { jogadores: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, nome: `Jogador ${i}` })), panelas: [["p0", "p1"], ["p2", "p3"]], quantidade_times: 2 };

async function abrir(t, opcoes) {
  const server = createServer(opcoes);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("API HTTP real integrada ao frontend", async t => {
  const base = await abrir(t, { origensPermitidas: ["http://localhost:5500"] });
  const post = (body, headers = {}) => fetch(`${base}/api/sortear`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

  await t.test("entrega a página, scripts em modo API e resposta compatível com o frontend", async () => {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Jogadores/);
    const config = await (await fetch(`${base}/js/config.js`)).text();
    assert.match(config, /mode: "api"/);
    assert.match(config, /apiUrl: "\/api\/sortear"/);
    const response = await post(dados, { Origin: base });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(validateResult(result, dados), result);
    assert.equal(confere(result.times, dados.panelas), false);
  });

  await t.test("rejeita JSON malformado, dados vazios e formato errado", async () => {
    assert.equal((await post("{" )).status, 400);
    assert.equal((await post("null")).status, 400);
    assert.equal((await post({ ...dados, quantidade_times: 2.5 })).status, 400);
    const response = await post("teste", { "Content-Type": "text/plain" });
    assert.equal(response.status, 415);
    assert.equal((await response.json()).codigo, "FORMATO_INVALIDO");
  });

  await t.test("API retorna times do tamanho escolhido e reservas validados pelo frontend", async () => {
    const game = { ...dados, jogadores_por_time: 3 };
    const response = await post(game);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(validateResult(result, game), result);
    assert.deepEqual(result.times.map(t => t.jogadores.length), [3, 3]);
    assert.equal(result.reservas.length, 0);
    assert.deepEqual(result.times.map(t => t.reservas.length), [2, 2]);
    assert.equal((await post({ ...dados, jogadores_por_time: 6 })).status, 400);
  });

  await t.test("entrega a arte transparente do banco como PNG", async () => {
    const response = await fetch(`${base}/assets/reserve-bench.png`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  });

  await t.test("retorna erro explicativo quando as panelas são impossíveis", async () => {
    const response = await post({ ...dados, panelas: [["p0", "p1"], ["p1", "p2"], ["p0", "p2"]] });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).codigo, "PANELAS_INCOMPATIVEIS");
  });

  await t.test("limita o tamanho do JSON e continua atendendo depois", async () => {
    const response = await post(JSON.stringify({ preenchimento: "x".repeat(600000) }));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).codigo, "REQUISICAO_GRANDE");
    assert.equal((await post(dados)).status, 200);
  });

  await t.test("permite CORS configurado e bloqueia origem desconhecida", async () => {
    const preflight = await fetch(`${base}/api/sortear`, { method: "OPTIONS", headers: { Origin: "http://localhost:5500", "Access-Control-Request-Method": "POST" } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5500");
    assert.equal((await post(dados, { Origin: "https://origem-desconhecida.invalid" })).status, 403);
  });

  await t.test("rotas, métodos e arquivos internos não são confundidos com páginas públicas", async () => {
    assert.equal((await fetch(`${base}/api/sortear`)).status, 405);
    assert.equal((await fetch(`${base}/api/inexistente`)).status, 404);
    assert.equal((await fetch(`${base}/ausente.js`)).status, 404);
    assert.equal((await fetch(`${base}/tests/core.test.cjs`)).status, 403);
    assert.equal((await fetch(`${base}/%2e%2e%5cBack%5cserver.js`)).status, 403);
    const head = await fetch(`${base}/times.html`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  });
});

test("limite de busca chega ao cliente como erro recuperável 503", async t => {
  const base = await abrir(t, { sortear: () => { throw new ErroSorteio("Limite de busca atingido.", "LIMITE_BUSCA", 503); } });
  const response = await fetch(`${base}/api/sortear`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { detail: "Limite de busca atingido.", codigo: "LIMITE_BUSCA" });
});
