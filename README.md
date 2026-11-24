# Panela Não

Sorteio de times de futebol com duplas que não podem jogar juntas, quantidade de times e jogadores por time configuráveis e reservas sorteados.

## Site publicado

Acesse **[Panela Não](https://italocr11.github.io/Panela_Nao/)** pelo computador ou pelo celular.

A primeira publicação foi concluída pelo GitHub Pages. A verificação executou 36 testes com sucesso e conferiu a geração da versão para navegador.

## Atualizar o site

1. Envie suas alterações em `Front` ou `Back` para a branch `main`. Esses envios iniciam a publicação automaticamente.
2. Para publicar manualmente, inclusive depois de alterar o script de preparo ou o workflow, acesse **Actions > Publicar Panela Nao no GitHub Pages > Run workflow**, na branch `main`.
3. Aguarde os trabalhos `build` e `deploy` terminarem com sucesso. As execuções estão em [GitHub Actions](https://github.com/Italocr11/Panela_Nao/actions).

A origem de publicação em **Settings > Pages** deve permanecer como **GitHub Actions**.

## Como a versão online funciona

O sorteio é executado no navegador, sem depender do servidor local ou de manter o computador ligado. É possível acessar pelo celular. Cada navegador mantém seu próprio cadastro e resultado; use **Copiar times** para compartilhar no WhatsApp.

O preparo da publicação mantém cinco titulares por time como padrão, permite configurar as quantidades e utiliza as regras do projeto. Reservas são vinculados aos times se a divisão for exata; caso contrário, continuam em um bloco separado.

## Verificação e publicação

O workflow executa os testes existentes antes de publicar. O script `scripts/build-pages.cjs` gera `_site` apenas com as páginas, o CSS, os scripts do navegador e os recursos visuais. O backend e os testes não fazem parte dos arquivos públicos do site.

Para conferir o preparo localmente com Node.js 24, em uma pasta de trabalho limpa:

```powershell
node --test --test-isolation=none Front/tests/core.test.cjs Back/tests/sorteio.test.cjs Back/tests/server.test.cjs
node scripts/build-pages.cjs
```

O script também confere caminhos relativos e exercita o sorteio no navegador sem permitir chamadas à API.
