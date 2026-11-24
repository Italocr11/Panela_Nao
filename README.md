# Panela Não

Aplicação para sortear times de futebol, separar duplas que não podem jogar juntas e distribuir os jogadores excedentes como reservas.

**[Acessar o site](https://italocr11.github.io/Panela_Nao/)**

## Funcionamento

1. Cadastre os jogadores.
2. Informe as duplas que devem ficar separadas entre os titulares.
3. Escolha a quantidade de times e de titulares por time.
4. Realize o sorteio.
5. Confira e copie o resultado ou faça um novo sorteio.

São aceitos até 100 jogadores, entre 2 e 12 times e de 1 a 50 titulares por time. O padrão é de 5 titulares. É necessário ter jogadores suficientes para preencher todas as vagas.

Os reservas são escolhidos aleatoriamente. Quando é possível dividi-los igualmente, cada time recebe seu próprio banco. Caso contrário, eles ficam em uma lista separada. O sorteio não considera habilidade ou posição.

<br><br>
<p align="center">
  <img src="Front/assets/paneleiros.png" width="800" alt="Os Paneleiros">
</p>
<h1 align="center">Panela Não</h1>
<br><br>









## Estrutura

| Parte | Responsabilidade | Documentação |
| --- | --- | --- |
| `Front/` | Cadastro, configuração da partida, resultado e armazenamento no navegador. | [Frontend](Front/README.md) |
| `Back/` | Servidor HTTP, validação das requisições e sorteio pela API. | [Backend](Back/README.md) |
| `scripts/build-pages.cjs` | Geração dos arquivos estáticos para publicação. | Publicação abaixo |
| `.github/workflows/deploy-panela-pages.yml` | Testes e publicação no GitHub Pages. | [Execuções](https://github.com/Italocr11/Panela_Nao/actions) |

## Execução local

Na raiz do projeto, com Node.js instalado:

```powershell
node Back/server.cjs
```

Acesse **http://127.0.0.1:8000**. Para encerrar o servidor, pressione **Ctrl+C** no terminal em que foi iniciado.

## Versão online e publicação

O site no GitHub Pages executa o sorteio no próprio navegador e funciona pelo computador ou celular. Cada navegador mantém seu próprio cadastro e resultado, sem sincronização entre dispositivos.

Envios para `main` ou `master` que alterem arquivos de `Front/` ou `Back/` iniciam o workflow. Também é possível executá-lo manualmente pela aba **Actions**. A origem em **Settings > Pages** deve ser **GitHub Actions**.

O preparo gera `_site/` com as páginas, os estilos, os scripts do navegador e os recursos visuais. O backend e os testes não são incluídos no site estático.

## Testes

Na raiz do projeto, com Node.js 24 ou superior:

```powershell
node --test --test-isolation=none Front/tests/core.test.cjs Back/tests/sorteio.test.cjs Back/tests/server.test.cjs
```
