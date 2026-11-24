# Frontend — Panela Não

Interface em HTML, CSS e JavaScript para cadastrar jogadores, configurar a partida e apresentar os times sorteados.

## Telas

### Cadastro

A página `index.html` permite adicionar e remover jogadores, cadastrar duplas que não podem jogar juntas e definir a quantidade de times e de titulares por time.

São aceitos até 100 jogadores e nomes de até 49 unidades UTF-16. Nomes normalizados não podem se repetir, inclusive com diferenças de caixa e espaços extras. Remover um jogador também remove suas restrições.

Uma pessoa pode participar de várias duplas. As restrições não são transitivas: separar A de B e B de D não impede A de jogar com D.

### Resultado

A página `times.html` mostra os titulares de cada time, os bancos vinculados e a lista separada de reservas, quando aplicável.

As ações disponíveis são:

- **Copiar times:** copia os titulares e os reservas. Se a cópia automática não estiver disponível, oferece um campo para copiar o texto manualmente.
- **Sortear de novo:** refaz o sorteio dos titulares e dos reservas.
- **Editar partida:** retorna ao cadastro para alterar jogadores e configurações.

## Reservas

A quantidade de reservas é calculada por:

`reservas = jogadores - quantidade_times × jogadores_por_time`

Os reservas são sorteados e vinculados aos times somente quando todos podem receber a mesma quantidade.

| Jogadores | Times | Titulares por time | Resultado |
| --- | --- | --- | --- |
| 10 | 2 | 5 | Dois times completos, sem reservas. |
| 14 | 2 | 5 | Dois times completos, com 2 reservas para cada time. |
| 13 | 2 | 5 | Dois times completos e 3 reservas em uma lista separada. |

As restrições de duplas são verificadas entre os titulares. A distribuição dos bancos não aplica restrições adicionais aos reservas.

## Modos de execução

O arquivo `js/config.js` define o modo do sorteio.

| Configuração | Comportamento |
| --- | --- |
| `mode: "api"` | Envia a partida para `apiUrl` e valida o resultado devolvido pelo backend. |
| `mode: "demo"` | Executa as validações e o sorteio no próprio navegador. |

O código-fonte utiliza o modo API, com endereço relativo `/api/sortear` e tempo de espera de 15 segundos. Erros de conexão ou respostas inválidas são apresentados na interface; o modo não é alterado automaticamente.

Na publicação do GitHub Pages, `scripts/build-pages.cjs` configura os arquivos gerados para executar o sorteio no navegador, sem depender da API.

O contrato das requisições e respostas está no [README do backend](../Back/README.md#api-de-sorteio).

## Armazenamento

O cadastro e o último resultado são salvos no `localStorage`. Quando esse recurso não está disponível, o sistema tenta utilizar o `sessionStorage`. Se ambos forem bloqueados, a interface informa a falha de armazenamento.

Cada perfil de navegador mantém seus próprios dados. A partida não é transferida automaticamente para outro dispositivo ou perfil. Limpar os dados do site pode apagar o cadastro e o resultado salvos.

## Execução local

Na raiz do projeto:

```powershell
node Back/server.cjs
```

Acesse **http://127.0.0.1:8000**.

Para iniciar o mesmo servidor pela porta 5500:

```powershell
node Front/server.cjs
```

Quando as páginas e a API usam origens diferentes, configure o endereço em `js/config.js` e as origens permitidas no [backend](../Back/README.md).

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Cadastro e configuração da partida. |
| `times.html` | Exibição e compartilhamento do resultado. |
| `styles.css` | Estilos e layout responsivo. |
| `js/app.js` | Interação da tela de cadastro. |
| `js/times.js` | Renderização dos times e dos bancos, cópia e novo sorteio. |
| `js/core.js` | Validações, sorteio no navegador e distribuição dos reservas. |
| `js/api.js` | Seleção do modo e comunicação HTTP. |
| `js/storage.js` | Leitura e gravação da partida no navegador. |
| `js/config.js` | Modo de execução, endereço da API e tempo de espera. |
| `assets/` | Ícones e ilustração do banco de reservas. |
| `server.cjs` | Inicialização do servidor pela porta 5500. |

## Testes

Na raiz do projeto, com Node.js 24 ou superior:

```powershell
node --test --test-isolation=none Front/tests/core.test.cjs
```

Os testes verificam entradas e resultados, restrições de duplas, tamanhos dos times, reservas e comunicação com a API simulada.
