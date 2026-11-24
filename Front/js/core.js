(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.PanelaCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_PLAYERS = 100;
  const MAX_NAME_LENGTH = 49;
  const DEFAULT_TEAM_SIZE = 5;
  const cleanName = (name) => String(name).normalize("NFC").trim().replace(/\s+/gu, " ");
  const nameKey = (name) => cleanName(name).toLocaleLowerCase("pt-BR");
  const pairKey = (pair) => JSON.stringify([...pair].sort());

  function validateDraft(draft) {
    if (!draft || !Array.isArray(draft.jogadores) || !Array.isArray(draft.panelas)) {
      throw new Error("Os dados da partida são inválidos. Cadastre os jogadores novamente.");
    }
    const { jogadores, panelas, quantidade_times: count, jogadores_por_time: teamSize = DEFAULT_TEAM_SIZE } = draft;
    if (!Number.isInteger(count) || count < 2 || count > 12) {
      throw new Error("Escolha uma quantidade inteira entre 2 e 12 times.");
    }
    if (jogadores.length < count) throw new Error(`Adicione pelo menos ${count} jogadores para formar ${count} times.`);
    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 50) {
      throw new Error("Escolha uma quantidade inteira entre 1 e 50 jogadores por time.");
    }
    if (jogadores.length < count * teamSize) {
      throw new Error(`São necessários ${count * teamSize} jogadores para formar ${count} times de ${teamSize}. Adicione jogadores ou reduza a quantidade de times ou de jogadores por time.`);
    }
    if (jogadores.length > MAX_PLAYERS) throw new Error(`O limite é de ${MAX_PLAYERS} jogadores por partida.`);
    const ids = new Set();
    const names = new Set();
    for (const player of jogadores) {
      if (!player || typeof player.id !== "string" || !player.id.trim() || player.id.length > 100 || typeof player.nome !== "string" || !cleanName(player.nome) || cleanName(player.nome).length > MAX_NAME_LENGTH) {
        throw new Error(`Cada jogador precisa ter um nome de até ${MAX_NAME_LENGTH} caracteres e um identificador único de até 100 caracteres.`);
      }
      if (ids.has(player.id) || names.has(nameKey(player.nome))) throw new Error("Há jogadores repetidos na lista.");
      ids.add(player.id);
      names.add(nameKey(player.nome));
    }
    const pairs = new Set();
    for (const pair of panelas) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || !ids.has(pair[0]) || !ids.has(pair[1])) {
        throw new Error("Selecione dois jogadores diferentes e cadastrados para cada panela.");
      }
      if (pairs.has(pairKey(pair))) throw new Error("Essa dupla já está na lista de panelas.");
      pairs.add(pairKey(pair));
    }
    return draft;
  }

  function shuffle(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Só vincula reservas aos times quando todos puderem receber a mesma quantidade.
  // Também adapta sorteios antigos, que salvavam apenas uma lista de reservas.
  function distributeReserves(result, draft, randomize = shuffle) {
    if (!result || !Array.isArray(result.times) || !Array.isArray(result.reservas)
      || result.times.some(team => !team || team.reservas !== undefined)) return result;
    const total = draft.jogadores.length - draft.quantidade_times * (draft.jogadores_por_time ?? DEFAULT_TEAM_SIZE);
    if (result.reservas.length !== total || result.times.length !== draft.quantidade_times) return result;
    const perTeam = total % draft.quantidade_times === 0 ? total / draft.quantidade_times : 0;
    const reserves = perTeam ? randomize(result.reservas) : result.reservas;
    return {
      times: result.times.map((team, index) => ({ ...team, reservas: reserves.slice(index * perTeam, (index + 1) * perTeam) })),
      reservas: perTeam ? [] : reserves,
    };
  }

  // Demonstração opcional. No modo API, o sorteio roda em Back/sorteio.cjs.
  function drawDemo(draft, limits = {}) {
    validateDraft(draft);
    const players = draft.jogadores;
    const count = draft.quantidade_times;
    const enemies = new Map(players.map((player) => [player.id, new Set()]));
    for (const [a, b] of draft.panelas) {
      enemies.get(a).add(b);
      enemies.get(b).add(a);
    }
    let ordered;
    const reserveOrder = shuffle(players);
    const reservas = [];
    const teamSize = draft.jogadores_por_time ?? DEFAULT_TEAM_SIZE;
    const reserveCount = players.length - count * teamSize;
    const teams = Array.from({ length: count }, () => []);
    const capacities = teams.map(() => teamSize);
    const deadline = Date.now() + (limits.timeoutMs ?? 1200);
    let visits = 0;
    const maxVisits = limits.maxVisits ?? 180000;

    function visit() {
      if (++visits > maxVisits || Date.now() > deadline) {
        throw new Error("O sorteio atingiu o limite de tentativas. Tente novamente ou revise as panelas.");
      }
    }

    function place(index) {
      if (index === ordered.length) return true;
      visit();
      const player = ordered[index];
      const triedEmptySizes = new Set();
      for (const teamIndex of shuffle(teams.map((_, i) => i))) {
        const team = teams[teamIndex];
        if (team.length >= capacities[teamIndex] || team.some((member) => enemies.get(player.id).has(member.id))) continue;
        // Times vazios com a mesma capacidade são equivalentes para esta busca.
        if (!team.length) {
          if (triedEmptySizes.has(capacities[teamIndex])) continue;
          triedEmptySizes.add(capacities[teamIndex]);
        }
        team.push(player);
        if (place(index + 1)) return true;
        team.pop();
      }
      return false;
    }

    // Sorteia a reserva antes de priorizar restrições. Se necessário, tenta
    // outras combinações dentro do mesmo limite de busca.
    function chooseReserves(start) {
      visit();
      if (reservas.length === reserveCount) {
        const ids = new Set(reservas.map(player => player.id));
        ordered = shuffle(players.filter(player => !ids.has(player.id)))
          .sort((a, b) => enemies.get(b.id).size - enemies.get(a.id).size);
        return place(0);
      }
      const remaining = reserveCount - reservas.length;
      for (let i = start; i <= reserveOrder.length - remaining; i++) {
        reservas.push(reserveOrder[i]);
        if (chooseReserves(i + 1)) return true;
        reservas.pop();
      }
      return false;
    }

    if (!chooseReserves(0)) throw new Error("Não é possível formar esses times respeitando todas as panelas. Revise as duplas ou aumente a quantidade de times.");
    return validateResult(distributeReserves({ times: teams.map((team, i) => ({ nome: `Time ${i + 1}`, jogadores: shuffle(team) })), reservas: shuffle(reservas) }, draft), draft);
  }

  function validateResult(result, draft) {
    validateDraft(draft);
    if (!result || !Array.isArray(result.times) || result.times.length !== draft.quantidade_times) {
      throw new Error("O resultado recebido não contém a quantidade correta de times.");
    }
    const players = new Map(draft.jogadores.map((p) => [p.id, p]));
    const assigned = new Map();
    const small = draft.jogadores_por_time ?? DEFAULT_TEAM_SIZE;
    const reserveCount = players.size - draft.quantidade_times * small;
    const reservesPerTeam = reserveCount % draft.quantidade_times === 0 ? reserveCount / draft.quantidade_times : 0;
    const sharedReserveCount = reservesPerTeam ? 0 : reserveCount;
    const receivedReserves = result.reservas === undefined && reserveCount === 0 ? [] : result.reservas;
    if (!Array.isArray(receivedReserves) || receivedReserves.length !== sharedReserveCount) {
      throw new Error("O resultado recebido tem uma quantidade inválida de reservas.");
    }
    function register(player, group) {
      if (!player || !players.has(player.id) || assigned.has(player.id)) {
        throw new Error("O resultado recebido tem jogadores repetidos ou desconhecidos.");
      }
      assigned.set(player.id, group);
      // Os nomes cadastrados são a fonte de verdade para a interface.
      return { ...players.get(player.id) };
    }
    const times = result.times.map((team, index) => {
      if (!team || !Array.isArray(team.jogadores) || team.jogadores.length !== small) {
        throw new Error("O resultado recebido tem times com tamanhos inválidos.");
      }
      const roster = team.jogadores.map(player => register(player, index));
      const bench = team.reservas === undefined && reservesPerTeam === 0 ? [] : team.reservas;
      if (!Array.isArray(bench) || bench.length !== reservesPerTeam) {
        throw new Error("O resultado recebido tem uma quantidade inválida de reservas por time.");
      }
      return { nome: `Time ${index + 1}`, jogadores: roster, reservas: bench.map(player => register(player, -1)) };
    });
    const reservas = receivedReserves.map(player => register(player, -1));
    if (assigned.size !== players.size) throw new Error("Faltam jogadores no resultado recebido.");
    for (const [a, b] of draft.panelas) {
      if (assigned.get(a) >= 0 && assigned.get(a) === assigned.get(b)) throw new Error("O resultado recebido colocou uma panela no mesmo time. Revise o sorteio.");
    }
    return { times, reservas };
  }

  return { MAX_PLAYERS, MAX_NAME_LENGTH, DEFAULT_TEAM_SIZE, cleanName, nameKey, pairKey, validateDraft, drawDemo, distributeReserves, validateResult };
});
