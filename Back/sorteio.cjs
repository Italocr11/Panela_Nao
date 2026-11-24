"use strict";

const { randomInt } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { cleanName, validateDraft, validateResult, distributeReserves, DEFAULT_TEAM_SIZE } = require("../Front/js/core.js");

class ErroSorteio extends Error {
  constructor(mensagem, codigo, status) {
    super(mensagem);
    this.name = "ErroSorteio";
    this.codigo = codigo;
    this.status = status;
  }
}

// Equivalente ao recebe_nomes: agora os dados vêm do JSON, não do terminal.
function recebeNomes(dados) {
  try { validateDraft(dados); }
  catch (erro) { throw new ErroSorteio(erro.message, "DADOS_INVALIDOS", 400); }
  return {
    jogadores: dados.jogadores.map(({ id, nome }) => ({ id, nome: cleanName(nome) })),
    panelas: dados.panelas.map(par => [...par]),
    quantidade_times: dados.quantidade_times,
    jogadores_por_time: dados.jogadores_por_time ?? DEFAULT_TEAM_SIZE,
  };
}

// Mesmo Fisher–Yates do C. Trabalha em uma cópia para preservar o cadastro.
function embaralha(valores) {
  const copia = [...valores];
  for (let i = copia.length - 1; i > 0; i--) {
    const sorteado = randomInt(i + 1);
    [copia[i], copia[sorteado]] = [copia[sorteado], copia[i]];
  }
  return copia;
}

// true significa que existe uma panela no mesmo time, como no C original.
function confere(times, panelas) {
  const timeDoJogador = new Map();
  times.forEach((time, indice) => {
    time.jogadores.forEach(jogador => timeDoJogador.set(jogador.id, indice));
  });
  return panelas.some(([a, b]) => timeDoJogador.has(a) && timeDoJogador.has(b) && timeDoJogador.get(a) === timeDoJogador.get(b));
}

function separaTimes(dados, limites = {}) {
  const partida = recebeNomes(dados);
  const { jogadores, panelas, quantidade_times: quantidadeTimes } = partida;
  const capacidades = Array.from({ length: quantidadeTimes }, () => partida.jogadores_por_time);
  const quantidadeReservas = jogadores.length - quantidadeTimes * partida.jogadores_por_time;
  const ordemReserva = embaralha(jogadores);
  const reservas = [];
  const times = capacidades.map((_, i) => ({ nome: `Time ${i + 1}`, jogadores: [] }));
  const incompatibilidades = new Map(jogadores.map(j => [j.id, new Set()]));
  for (const [a, b] of panelas) {
    incompatibilidades.get(a).add(b);
    incompatibilidades.get(b).add(a);
  }

  // Embaralha os empates e trata primeiro quem possui mais restrições.
  let ordem;
  const maximoPassos = limites.maximoPassos ?? 250000;
  const prazo = performance.now() + (limites.tempoMaximoMs ?? 1500);
  let passos = 0;

  function visitar() {
    if (++passos > maximoPassos || performance.now() > prazo) {
      throw new ErroSorteio("O sorteio atingiu o limite de busca. Tente novamente ou revise as panelas.", "LIMITE_BUSCA", 503);
    }
  }

  function distribuir(posicao) {
    if (posicao === ordem.length) return true;
    visitar();
    const jogador = ordem[posicao];
    const vaziosVisitados = new Set();
    for (const indice of embaralha(times.map((_, i) => i))) {
      const time = times[indice];
      if (time.jogadores.length >= capacidades[indice]) continue;
      if (time.jogadores.some(outro => incompatibilidades.get(jogador.id).has(outro.id))) continue;
      // Evita repetir a mesma tentativa em times vazios de tamanho equivalente.
      if (time.jogadores.length === 0) {
        if (vaziosVisitados.has(capacidades[indice])) continue;
        vaziosVisitados.add(capacidades[indice]);
      }
      time.jogadores.push(jogador);
      if (distribuir(posicao + 1)) return true;
      time.jogadores.pop(); // Desfaz a escolha e tenta outro time (backtracking).
    }
    return false;
  }

  // A reserva é sorteada antes da ordenação por restrições. Outras combinações
  // são exploradas se a primeira impedir uma divisão válida.
  function escolherReservas(inicio) {
    visitar();
    if (reservas.length === quantidadeReservas) {
      const ids = new Set(reservas.map(jogador => jogador.id));
      ordem = embaralha(jogadores.filter(jogador => !ids.has(jogador.id)))
        .sort((a, b) => incompatibilidades.get(b.id).size - incompatibilidades.get(a.id).size);
      return distribuir(0);
    }
    const faltam = quantidadeReservas - reservas.length;
    for (let i = inicio; i <= ordemReserva.length - faltam; i++) {
      reservas.push(ordemReserva[i]);
      if (escolherReservas(i + 1)) return true;
      reservas.pop();
    }
    return false;
  }

  if (!escolherReservas(0)) {
    throw new ErroSorteio("Não é possível formar esses times respeitando todas as panelas. Revise as duplas ou aumente a quantidade de times.", "PANELAS_INCOMPATIVEIS", 422);
  }
  for (const time of times) time.jogadores = embaralha(time.jogadores);
  if (confere(times, panelas)) throw new Error("Falha interna na conferência das panelas.");
  return validateResult(distributeReserves({ times, reservas: embaralha(reservas) }, partida, embaralha), partida);
}

module.exports = { ErroSorteio, recebeNomes, embaralha, confere, separaTimes };
