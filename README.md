# Panela Não

Sorteio de times de futebol com duplas que não podem jogar juntas, quantidade de times e jogadores por time configuráveis e reservas sorteados.

## Concluir a primeira publicação

1. Envie para a raiz deste repositório as pastas **Front** e **Back** do projeto local, incluindo os arquivos de testes e a pasta **Front/assets**.
2. Em **Settings > Pages > Build and deployment > Source**, selecione **GitHub Actions**.
3. Acesse **Actions > Publicar Panela Nao no GitHub Pages** e execute **Run workflow**, na branch `main`. Novos envios de arquivos em `Front` ou `Back` também iniciam a publicação.
4. Aguarde os trabalhos `build` e `deploy` terminarem com sucesso.

Endereço esperado após a primeira publicação: **https://italocr11.github.io/Panela_Nao/**. O endereço ainda não funciona enquanto faltarem os arquivos e a configuração de Pages.

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
