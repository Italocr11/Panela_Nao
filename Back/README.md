# Backend Node.js — Panela Não

Usa apenas módulos nativos do Node.js: não é necessário instalar dependências.

## Executar

Na raiz do projeto:

```powershell
node Back/server.cjs
```

Abra **http://127.0.0.1:8000**. Esse único processo entrega o frontend e atende `POST /api/sortear`. O modo API já está ativado em `Front/js/config.js`.

O comando anterior `node Front/server.cjs` também funciona: ele inicia o mesmo backend, usando a porta 5500. Use um dos comandos; não precisa iniciar os dois.

Os arquivos `main.c` e `Main.py` foram mantidos como referência e não são executados pelo aplicativo.

## Correspondência com o código C

| Código C | Implementação JavaScript | Motivo da mudança |
| --- | --- | --- |
| `recebe_nomes` com `scanf`/`fgets` | `recebeNomes`, em `sorteio.cjs`, recebe e valida o JSON da tela | O usuário já digita os nomes no navegador. |
| `strcmp` entre nomes | Validação de IDs e nomes normalizados, compartilhada com o frontend | Bloqueia duplicatas como `João`, `JOÃO` e nomes com espaços extras. |
| `Panela` com dois nomes | Array com dois IDs, como `["p1", "p2"]` | Identifica os jogadores sem depender da grafia dos nomes. |
| `embaralha` | Mesmo Fisher–Yates, usando `crypto.randomInt` | Mantém a troca aleatória, sem precisar inicializar `srand`. Não altera a lista original. |
| `confere`, citada mas ausente no trecho | `confere(times, panelas)` | Verifica se algum par proibido terminou no mesmo time. Retorna `true` quando há panela. |
| Até 10.000 sorteios completos descartados | Busca com retrocesso, em `separaTimes` | Evita depender apenas de sorte para encontrar divisões com muitas restrições. |
| `printf` do resultado | Resposta JSON para `times.html` | Permite que a tela apresente, copie e refaça o sorteio. |
| `main` | Servidor HTTP em `server.cjs` | Recebe as requisições da tela e chama o sorteio com todos os argumentos. |

O C enviado também chama `separa_times(nomes, quantidade, jogadores_por_time)` com três argumentos, embora sua assinatura exija cinco, incluindo as panelas. Isso foi resolvido: a API recebe os jogadores, as panelas, a quantidade de times e os jogadores por time no mesmo objeto.

## Regras adotadas

- Até **100 jogadores**, como `MAX_JOGADORES` no C.
- Nomes de até **49 unidades UTF-16**, coerente com o limite de `maxlength` do HTML. O C tinha espaço para 49 bytes mais o terminador; strings JS não usam esse buffer fixo e aceitam nomes com acentos.
- Entre **2 e 12 times**, seguindo o seletor do frontend. Deve haver pelo menos um jogador por time.
- Cada time tem exatamente `jogadores_por_time` jogadores, com padrão 5 e opções inteiras de 1 a 50. É necessário cadastrar pelo menos `quantidade_times * jogadores_por_time` jogadores.
- Cada jogador aparece exatamente uma vez, em um time ou na lista de reservas. Toda sobra vai para a reserva por sorteio. As restrições de panelas continuam valendo para os titulares; o vínculo do banco é apenas a distribuição dos reservas.
- Uma pessoa pode participar de várias panelas. A–B e B–C não impedem A–C de jogar juntos.
- Pares invertidos repetidos, jogadores desconhecidos e duplas da pessoa consigo mesma são rejeitados.
- O sorteio não considera habilidade, posição ou histórico de partidas.

**Reserva:** o formulário permite escolher a quantidade de times e de jogadores por time (padrão 5). Com 11 jogadores, 2 times e 5 por time, o resultado é 5 contra 5 e 1 reserva. Com 17 jogadores nas mesmas configurações, são 7 reservas. O sorteio é refeito também para os reservas ao clicar em Sortear de novo.


Os reservas são vinculados aleatoriamente aos times somente quando a divisão é exata. Exemplo: 14 jogadores, 2 times e 5 titulares por time resultam em 2 reservas para cada time. Cada cartão mostra o banco abaixo dos titulares, com uma ilustração ao lado de Reservas. Se a quantidade não puder ser dividida igualmente (por exemplo, 3 reservas para 2 times), todos continuam no bloco separado de Reservas. A cópia inclui os bancos de cada time ou a lista separada.

## Como a busca funciona

1. Valida o cadastro e monta, para cada jogador, o conjunto de pessoas com quem não pode jogar.
2. Usa o tamanho escolhido para todos os times e calcula a sobra como reservas. Embaralha os candidatos à reserva antes de priorizar as restrições.
3. Escolhe uma combinação de reservas pela ordem embaralhada. Entre os demais, embaralha e prioriza quem possui mais restrições. Os empates permanecem aleatórios.
4. Tenta colocar o próximo jogador em um time sorteado com vaga e sem incompatibilidades.
5. Se não houver continuação possível, desfaz a última escolha e tenta outro caminho. Se necessário, tenta outras combinações de reservas. Isso é o **backtracking**. Todas as tentativas compartilham os mesmos limites de tempo e passos.
6. Ao terminar, embaralha a ordem de exibição dentro dos times e confere novamente o resultado.

Há dois encerramentos diferentes: se todos os caminhos relevantes forem esgotados, a divisão é impossível sob essas regras; se o limite de 250.000 passos ou de 1,5 segundo for atingido, a busca foi interrompida e uma nova tentativa pode funcionar. A busca síncrona fica limitada para não prender indefinidamente o processo. A aleatoriedade não garante distribuição uniforme entre todas as composições válidas possíveis.

## Contrato da API

`POST /api/sortear`, com `Content-Type: application/json`:

```json
{
  "jogadores": [
    { "id": "p1", "nome": "João" },
    { "id": "p2", "nome": "Matheus" },
    { "id": "p3", "nome": "Lucas" },
    { "id": "p4", "nome": "Pedro" }
  ],
  "panelas": [["p1", "p2"]],
  "quantidade_times": 2,
  "jogadores_por_time": 2
}
```

Exemplo de resposta HTTP 200:

```json
{
  "times": [
    {
      "nome": "Time 1",
      "jogadores": [
        {
          "id": "p1",
          "nome": "João"
        },
        {
          "id": "p3",
          "nome": "Lucas"
        }
      ],
      "reservas": []
    },
    {
      "nome": "Time 2",
      "jogadores": [
        {
          "id": "p2",
          "nome": "Matheus"
        },
        {
          "id": "p4",
          "nome": "Pedro"
        }
      ],
      "reservas": []
    }
  ],
  "reservas": []
}
```

Cada time inclui `reservas`. O campo `reservas` na raiz contém apenas a lista separada quando a sobra é indivisível; nas divisões exatas, fica vazio. As duas listas usam objetos `{ "id": "...", "nome": "..." }`. O campo de entrada `jogadores_por_time` é opcional na API e assume 5 quando omitido.

Erros usam `{"detail": "Mensagem para o usuário.", "codigo": "CODIGO_DO_ERRO"}`:

| HTTP | Código | Significado |
| --- | --- | --- |
| 400 | `DADOS_INVALIDOS` ou `JSON_INVALIDO` | Cadastro inconsistente ou JSON malformado. |
| 413 | `REQUISICAO_GRANDE` | Corpo maior que 512 KiB. |
| 415 | `FORMATO_INVALIDO` | Conteúdo não enviado como JSON. |
| 422 | `PANELAS_INCOMPATIVEIS` | Não existe divisão com os tamanhos e restrições informados, mesmo tentando outras reservas. |
| 503 | `LIMITE_BUSCA` | A busca atingiu seu limite; não é uma prova de impossibilidade. |

## Testar

Com Node.js 24 ou superior, na raiz:

```powershell
node --test --test-isolation=none Front/tests/core.test.cjs Back/tests/sorteio.test.cjs Back/tests/server.test.cjs
```

Inclui testes do domínio, limites de jogadores/nomes, input preservado, panelas complexas, divisão impossível e limite de busca. Os testes HTTP iniciam um servidor real em uma porta livre e verificam respostas, contrato do frontend, CORS e requisições inválidas.

## Porta e Live Server

Para outra porta, no PowerShell:

```powershell
$env:PORT = "8001"
node Back/server.cjs
```

O endereço da API é relativo (`/api/sortear`), portanto acompanha a porta sem alterar o frontend.

Se optar pelo Live Server separado, configure `apiUrl` em `Front/js/config.js` como `http://127.0.0.1:8000/api/sortear`, e autorize a origem exata usada pelo Live Server:

```powershell
$env:CORS_ORIGINS = "http://127.0.0.1:5500,http://localhost:5500"
node Back/server.cjs
```

No fluxo recomendado, com páginas e API no mesmo servidor, essa configuração é desnecessária. O servidor não usa banco de dados: a partida continua salva no navegador, e o JSON é processado somente para realizar o sorteio.
