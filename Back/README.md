# Backend — Panela Não

Servidor HTTP em Node.js que disponibiliza as páginas do frontend e uma API para sortear os times. Utiliza módulos nativos e não exige instalação de dependências.

Cada partida é recebida e processada em JSON. O servidor não utiliza banco de dados nem mantém histórico. O cadastro e o resultado são armazenados pelo frontend no navegador.

## Execução

Na raiz do projeto, com Node.js instalado:

```powershell
node Back/server.cjs
```

Acesse **http://127.0.0.1:8000**. As páginas e a API são atendidas pelo mesmo processo. Para encerrá-lo, pressione **Ctrl+C** no terminal em que foi iniciado.

A API é utilizada quando `Front/js/config.js` está com `mode: "api"`. O site publicado no GitHub Pages executa o sorteio no navegador.

## Componentes

| Arquivo | Responsabilidade |
| --- | --- |
| `server.cjs` | Rotas HTTP, leitura do JSON, entrega das páginas, origens permitidas e respostas de erro. |
| `sorteio.cjs` | Normalização dos dados, embaralhamento, busca de uma divisão válida e conferência das restrições. |
| `tests/server.test.cjs` | Testes das rotas e do contrato HTTP. |
| `tests/sorteio.test.cjs` | Testes das regras e do algoritmo. |

As validações de entrada e resultado e a distribuição dos reservas são compartilhadas com `Front/js/core.js`.

## Regras

- Até 100 jogadores por partida.
- Nomes de até 49 unidades UTF-16 e identificadores de até 100 caracteres.
- Identificadores e nomes normalizados não podem se repetir.
- Entre 2 e 12 times, com 1 a 50 titulares por time; o padrão é de 5 titulares.
- O total de jogadores deve preencher todas as vagas de titulares.
- Cada jogador aparece uma única vez no resultado, como titular ou reserva.
- As duplas proibidas não podem estar entre os titulares do mesmo time.
- Uma pessoa pode participar de várias duplas; as restrições não são transitivas.
- Duplas com jogadores desconhecidos, uma pessoa consigo mesma ou pares repetidos são rejeitadas.

Os excedentes são sorteados como reservas. Quando a quantidade pode ser dividida igualmente pelo número de times, cada time recebe o mesmo número de reservas. Caso contrário, todos permanecem na lista separada. As restrições de duplas não são aplicadas aos bancos.

## Algoritmo

1. Valida o cadastro, normaliza os nomes e monta as incompatibilidades.
2. Embaralha os candidatos à reserva e seleciona uma combinação.
3. Embaralha os titulares e prioriza quem possui mais restrições.
4. Distribui os jogadores entre times com vaga e sem incompatibilidades.
5. Quando uma escolha impede a continuação, desfaz a atribuição e tenta outro caminho.
6. Se necessário, tenta outra combinação de reservas.
7. Embaralha a ordem de apresentação, distribui os bancos quando possível e confere o resultado.

O embaralhamento utiliza Fisher–Yates com `crypto.randomInt`. A busca com retrocesso compartilha um limite de 250.000 passos ou aproximadamente 1,5 segundo por sorteio.

Esgotar os caminhos válidos indica uma divisão impossível para as restrições informadas. Atingir o limite indica uma interrupção, sem comprovar impossibilidade. O sorteio não considera habilidade, posição ou histórico, e não garante distribuição uniforme entre todas as composições válidas.

## API de sorteio

### Requisição

`POST /api/sortear`, com `Content-Type: application/json`.

```json
{
  "jogadores": [
    { "id": "p1", "nome": "Jogador 1" },
    { "id": "p2", "nome": "Jogador 2" },
    { "id": "p3", "nome": "Jogador 3" },
    { "id": "p4", "nome": "Jogador 4" }
  ],
  "panelas": [["p1", "p2"]],
  "quantidade_times": 2,
  "jogadores_por_time": 2
}
```

| Campo | Descrição |
| --- | --- |
| `jogadores` | Identificador e nome de cada jogador. |
| `panelas` | Pares de identificadores que devem ficar separados entre os titulares. |
| `quantidade_times` | Número de times. |
| `jogadores_por_time` | Titulares por time. Opcional; assume 5 quando omitido. |

### Resposta

Exemplo de resposta HTTP 200:

```json
{
  "times": [
    {
      "nome": "Time 1",
      "jogadores": [
        { "id": "p1", "nome": "Jogador 1" },
        { "id": "p3", "nome": "Jogador 3" }
      ],
      "reservas": []
    },
    {
      "nome": "Time 2",
      "jogadores": [
        { "id": "p2", "nome": "Jogador 2" },
        { "id": "p4", "nome": "Jogador 4" }
      ],
      "reservas": []
    }
  ],
  "reservas": []
}
```

`times[].jogadores` contém os titulares. `times[].reservas` contém o banco vinculado ao time quando a divisão é exata. O campo `reservas` na raiz contém a lista separada quando a divisão é desigual. Campos sem jogadores são devolvidos como arrays vazios.

### Erros

As respostas incluem uma mensagem em `detail` e, quando definido, um identificador em `codigo`.

| HTTP | Código | Situação |
| --- | --- | --- |
| 400 | `DADOS_INVALIDOS` | Cadastro ou configurações inválidas. |
| 400 | `JSON_INVALIDO` | Corpo não é um JSON válido. |
| 403 | `ORIGEM_INVALIDA` | Origem não autorizada. |
| 413 | `REQUISICAO_GRANDE` | Corpo maior que 512 KiB. |
| 415 | `FORMATO_INVALIDO` | Conteúdo não enviado como JSON. |
| 422 | `PANELAS_INCOMPATIVEIS` | Nenhuma divisão válida após esgotar a busca. |
| 503 | `LIMITE_BUSCA` | Busca interrompida por limite de passos ou tempo. |
| 500 | `ERRO_INTERNO` | Falha inesperada no processamento. |

Rotas desconhecidas retornam 404. O endpoint de sorteio aceita `POST` e responde a `OPTIONS`; outros métodos recebem 405.

## Configuração

### Porta

A variável `PORT` define a porta. O padrão é 8000, no endereço local `127.0.0.1`.

```powershell
$env:PORT = "8001"
node Back/server.cjs
```

Quando frontend e API usam a mesma origem, o endereço relativo `/api/sortear` acompanha a porta configurada.

### Origens permitidas

Para servir o frontend por outro servidor local, configure `apiUrl` em `Front/js/config.js` com o endereço completo da API e informe as origens permitidas em `CORS_ORIGINS`, separadas por vírgula:

```powershell
$env:CORS_ORIGINS = "http://127.0.0.1:5500,http://localhost:5500"
node Back/server.cjs
```

### Limites HTTP

O corpo é limitado a 512 KiB por requisição. O servidor configura 10 segundos para receber os cabeçalhos e 15 segundos para receber a requisição. Esses limites são distintos do prazo de execução do sorteio.

## Testes

Na raiz do projeto, com Node.js 24 ou superior:

```powershell
node --test --test-isolation=none Front/tests/core.test.cjs Back/tests/sorteio.test.cjs Back/tests/server.test.cjs
```

A suíte verifica regras, preservação das entradas, restrições, reservas, limites de busca, validações e respostas HTTP.
