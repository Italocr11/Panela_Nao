const test = require("node:test");
const assert = require("node:assert/strict");
const { ErroSorteio, recebeNomes, embaralha, confere, separaTimes } = require("../sorteio.cjs");

function partida(total = 10, times = 2, panelas = [["p0", "p1"], ["p2", "p3"], ["p4", "p5"]]) {
  return { jogadores: Array.from({ length: total }, (_, i) => ({ id: `p${i}`, nome: `Jogador ${i + 1}` })), panelas, quantidade_times: times, jogadores_por_time: Math.floor(total / times) };
}

test("embaralha preserva os elementos e não altera o array original", () => {
  const original = [1, 2, 3, 4, 5];
  const resultado = embaralha(original);
  assert.notEqual(resultado, original);
  assert.deepEqual([...resultado].sort(), original);
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
});

test("recebeNomes normaliza espaços e rejeita repetidos inclusive com outra caixa", () => {
  const dados = partida();
  dados.jogadores[0].nome = "  João   Silva  ";
  assert.equal(recebeNomes(dados).jogadores[0].nome, "João Silva");
  dados.jogadores[1].nome = "JOÃO SILVA";
  assert.throws(() => recebeNomes(dados), erro => erro instanceof ErroSorteio && erro.status === 400 && erro.codigo === "DADOS_INVALIDOS");
  assert.equal(dados.jogadores[0].nome, "  João   Silva  ");
});

test("aceita os limites do C (100 jogadores e nomes de 49 caracteres)", () => {
  const dados = partida(100, 12);
  dados.jogadores[0].nome = "a".repeat(49);
  const resultado = separaTimes(dados);
  assert.equal(resultado.times.flatMap(t => t.jogadores).length, 96);
  assert.equal(resultado.reservas.length, 4);
  dados.jogadores[0].nome += "a";
  assert.throws(() => separaTimes(dados), /49 caracteres/);
  assert.throws(() => separaTimes(partida(101)), /limite/);
});

test("times equilibrados, cadastro intacto e nenhuma panela junta em múltiplos sorteios", () => {
  for (const [total, quantidade] of [[10, 2], [11, 2], [13, 3], [100, 12], [7, 7]]) {
    const dados = partida(total, quantidade);
    const antes = JSON.stringify(dados);
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const { times, reservas } = separaTimes(dados);
      assert.equal(reservas.length, total - quantidade * dados.jogadores_por_time);
      assert.equal(times.length, quantidade);
      const ids = [...times.flatMap(t => t.jogadores), ...reservas].map(j => j.id);
      assert.equal(ids.length, total);
      assert.equal(new Set(ids).size, total);
      const tamanhos = times.map(t => t.jogadores.length);
      assert.ok(tamanhos.every(tamanho => tamanho === dados.jogadores_por_time));
      assert.equal(confere(times, dados.panelas), false);
    }
    assert.equal(JSON.stringify(dados), antes);
  }
});

test("confere detecta panelas e as restrições não se tornam transitivas", () => {
  const dados = partida(4, 2, [["p0", "p1"], ["p1", "p2"]]);
  const { times } = separaTimes(dados);
  assert.equal(confere(times, dados.panelas), false);
  assert.ok(times.some(t => t.jogadores.some(j => j.id === "p0") && t.jogadores.some(j => j.id === "p2")));
  assert.equal(confere([{ jogadores: dados.jogadores }], dados.panelas), true);
});

test("busca resolve uma divisão com muitas panelas e apenas duas composições possíveis", () => {
  const panelas = [];
  for (let a = 0; a < 8; a++) for (let b = 8; b < 16; b++) panelas.push([`p${a}`, `p${b}`]);
  const { times } = separaTimes(partida(16, 2, panelas));
  assert.equal(times[0].jogadores.length, 8);
  assert.equal(confere(times, panelas), false);
  assert.ok(times.every(t => t.jogadores.every(j => Number(j.id.slice(1)) < 8) || t.jogadores.every(j => Number(j.id.slice(1)) >= 8)));
});

test("distingue impossibilidade comprovada de limite de busca", () => {
  const triangulo = [["p0", "p1"], ["p1", "p2"], ["p0", "p2"]];
  assert.throws(() => separaTimes(partida(6, 2, triangulo)), erro => erro.status === 422 && erro.codigo === "PANELAS_INCOMPATIVEIS");
  assert.equal(separaTimes(partida(6, 3, triangulo)).times.length, 3);
  assert.throws(() => separaTimes(partida(), { maximoPassos: 0 }), erro => erro.status === 503 && erro.codigo === "LIMITE_BUSCA");
});

test("rejeita IDs repetidos e pares inválidos, incluindo duplicatas invertidas", () => {
  for (const panelas of [[["p0", "p0"]], [["p0", "x"]], [["p0", "p1"], ["p1", "p0"]]]) {
    assert.throws(() => separaTimes(partida(4, 2, panelas)), erro => erro.status === 400);
  }
  const repetido = partida(); repetido.jogadores[1].id = "p0";
  assert.throws(() => separaTimes(repetido), /repetidos/);
  assert.throws(() => separaTimes(null), erro => erro.status === 400);
});

test("IDs com dois pontos não confundem duplas diferentes", () => {
  const dados = { jogadores: ["a", "b:c", "a:b", "c"].map((id, i) => ({ id, nome: `Pessoa ${i}` })), panelas: [["a", "b:c"], ["a:b", "c"]], quantidade_times: 2, jogadores_por_time: 2 };
  assert.equal(confere(separaTimes(dados).times, dados.panelas), false);
});

test("padrão de cinco jogadores e reservas sorteados para todas as vagas excedentes", () => {
  const dados = partida(17, 2, []);
  delete dados.jogadores_por_time;
  const resultado = separaTimes(dados);
  assert.deepEqual(resultado.times.map(t => t.jogadores.length), [5, 5]);
  assert.equal(resultado.reservas.length, 7);
  assert.equal(new Set([...resultado.times.flatMap(t => [...t.jogadores, ...t.reservas]), ...resultado.reservas].map(p => p.id)).size, 17);
  assert.equal(separaTimes({ ...dados, jogadores_por_time: 4 }).reservas.length, 9);
  assert.throws(() => separaTimes({ ...partida(9), jogadores_por_time: 5 }), erro => erro.status === 400);
  for (const size of [null, 0, 2.5, 51, "5"]) assert.throws(() => separaTimes({ ...dados, jogadores_por_time: size }), erro => erro.status === 400);
});

test("reserva viabiliza panelas sem colocar o mesmo jogador em dois grupos", () => {
  const dados = partida(5, 2, [["p0", "p1"], ["p0", "p2"], ["p0", "p3"], ["p0", "p4"]]);
  const resultado = separaTimes(dados);
  assert.deepEqual(resultado.reservas.map(p => p.id), ["p0"]);
  assert.equal(confere(resultado.times, dados.panelas), false);
});

test("distribui reservas em bancos iguais e mantém o bloco comum quando a sobra é desigual", () => {
  for (const [total, times, expected, common] of [[14, 2, [2, 2], 0], [18, 3, [1, 1, 1], 0], [13, 2, [0, 0], 3]]) {
    const dados = { ...partida(total, times), jogadores_por_time: 5 };
    const result = separaTimes(dados);
    assert.deepEqual(result.times.map(t => t.reservas.length), expected);
    assert.equal(result.reservas.length, common);
    const all = [...result.times.flatMap(t => [...t.jogadores, ...t.reservas]), ...result.reservas];
    assert.equal(all.length, total);
    assert.equal(new Set(all.map(p => p.id)).size, total);
    assert.equal(confere(result.times, dados.panelas), false);
  }
});
