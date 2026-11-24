# Frontend — Panela Não

HTML, CSS e JavaScript puros, sem instalação de pacotes ou compilação. O backend Node.js está integrado e o modo API já está ativo. A implementação e o feedback sobre a adaptação do C estão em [Back/README.md](../Back/README.md).

## Abrir

Na pasta raiz do projeto, execute:

```powershell
node Back/server.cjs
```

Acesse **http://127.0.0.1:8000**. O servidor entrega as telas e a API no mesmo endereço. O comando anterior `node Front/server.cjs` também inicia o app completo, na porta 5500. A conexão com a internet é opcional: as fontes do Google têm alternativas locais.

1. Adicione os nomes, um de cada vez, usando Enter ou **Adicionar**.
2. Selecione os dois integrantes de cada panela e clique em **Separar essa dupla**. Uma pessoa pode participar de várias duplas. A restrição vale apenas para o par informado: A–B e B–C não impedem A–C.
3. Escolha entre 2 e 12 times e a quantidade de jogadores por time (padrão 5, ajustável de 1 a 50). Clique em **Separar os times**. Se faltarem jogadores para completar os times, ajuste as quantidades ou cadastre mais jogadores.
4. Na página seguinte, confira os times e os reservas sorteados. A cópia inclui os reservas, e Sortear de novo refaz também a escolha de quem fica na reserva.

**Usar exemplo** preenche uma lista vazia com 10 jogadores e as duplas João–Matheus, Gabriel S.–Gabriel G. e Zé–Jorge.

O rascunho e o último sorteio ficam salvos neste navegador. Remover um jogador também remove suas panelas. Nomes repetidos são bloqueados; use sobrenomes ou apelidos para diferenciar pessoas. Limite de 100 jogadores e 49 unidades UTF-16 por nome.

Todos os jogadores aparecem uma vez, em um time ou na lista de reservas. Os times têm exatamente a quantidade escolhida; toda sobra fica na reserva por sorteio. Com 11 jogadores, 2 times e 5 por time, o resultado é dois times de 5 e 1 reserva. Com 17 jogadores nas mesmas configurações, são 7 reservas. As panelas continuam sendo conferidas entre os titulares; os reservas são distribuídos separadamente. O sorteio não considera habilidade ou posições. Se as restrições forem impossíveis, uma mensagem é exibida. Atingir o limite de busca produz uma mensagem diferente, pois não prova que não existe solução.


Os reservas são vinculados aleatoriamente aos times somente quando a divisão é exata. Exemplo: 14 jogadores, 2 times e 5 titulares por time resultam em 2 reservas para cada time. Cada cartão mostra o banco abaixo dos titulares, com uma ilustração ao lado de Reservas. Se a quantidade não puder ser dividida igualmente (por exemplo, 3 reservas para 2 times), todos continuam no bloco separado de Reservas. A cópia inclui os bancos de cada time ou a lista separada.

## Integração com o backend Node.js

Em `js/config.js`, o padrão é `mode: "api"` e `apiUrl: "/api/sortear"`. Não há fallback automático para demonstração se a requisição falhar. Para testar somente as telas, `mode: "demo"` continua disponível.

Endpoint implementado: `POST /api/sortear`.

JSON enviado (IDs são gerados pelo frontend e precisam ser preservados):

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

JSON esperado em uma resposta HTTP 200:

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

A API assume 5 jogadores por time se `jogadores_por_time` for omitido. Cada time inclui o array `reservas`; o array `reservas` da raiz contém apenas os reservas sem vínculo quando a divisão é desigual. Os jogadores dessas listas têm os mesmos campos `id` e `nome` dos titulares.

Os títulos são numerados pelo frontend e os nomes são recuperados do cadastro pelos IDs. A resposta precisa conter todos os jogadores exatamente uma vez entre times e reservas, times do tamanho escolhido, a quantidade correta de reservas e nenhuma dupla proibida no mesmo time. O frontend confere essas condições antes de exibir o resultado.

As falhas retornam um status HTTP de erro, por exemplo 422, e `{"detail": "Não é possível respeitar essas panelas com dois times.", "codigo": "PANELAS_INCOMPATIVEIS"}`. A propriedade `mensagem` também é aceita pelo frontend. O timeout do frontend é 15 segundos.

Frontend e API rodam na mesma porta por padrão. Para usar Live Server separado, veja a configuração de CORS em [Back/README.md](../Back/README.md). As validações de `js/core.js` são compartilhadas com o servidor; o sorteio real está em `Back/sorteio.cjs`.

## Verificação

```powershell
node --test Front/tests/core.test.cjs
```

Se o ambiente bloquear subprocessos, use `node --test --test-isolation=none Front/tests/core.test.cjs` com Node 24 ou superior.

Os testes cobrem restrições, distribuição equilibrada, cenários impossíveis, dados inválidos, respostas inconsistentes e os estados de sucesso, erro e timeout da API simulada.

## Arquivos principais

- `index.html`: cadastro e configuração da partida.
- `times.html`: resultado, cópia e novo sorteio.
- `styles.css`: identidade visual e adaptação a celular.
- `js/app.js` e `js/times.js`: interação de cada página.
- `js/core.js`: validação e sorteio demonstrativo.
- `js/storage.js`: persistência no navegador.
- `js/api.js`: integração HTTP com a API Node.js.
- `js/config.js`: seleção do modo e endereço da API.
- `server.cjs`: atalho para iniciar o servidor completo na porta 5500.
