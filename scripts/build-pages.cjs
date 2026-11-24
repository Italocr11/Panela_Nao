"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "Front");
  const output = path.join(root, "_site");
  if (fs.existsSync(output)) throw new Error("A pasta _site já existe. Gere a publicação em uma pasta de trabalho limpa.");
  fs.mkdirSync(output);
  for (const name of ["index.html", "times.html", "styles.css"]) {
    fs.copyFileSync(path.join(source, name), path.join(output, name));
  }
  fs.mkdirSync(path.join(output, "js"));
  for (const name of ["core.js", "storage.js", "api.js", "app.js", "times.js"]) {
    fs.copyFileSync(path.join(source, "js", name), path.join(output, "js", name));
  }
  function copyAssets(from, to) {
    fs.mkdirSync(to);
    for (const item of fs.readdirSync(from, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new Error("Link simbólico não permitido: " + item.name);
      if (item.name.startsWith(".")) continue;
      if (item.isDirectory()) copyAssets(path.join(from, item.name), path.join(to, item.name));
      else if (/\.(svg|png|jpe?g|webp|gif|ico|woff2?)$/i.test(item.name)) {
        fs.copyFileSync(path.join(from, item.name), path.join(to, item.name));
      }
    }
  }
  copyAssets(path.join(source, "assets"), path.join(output, "assets"));
  fs.writeFileSync(path.join(output, ".nojekyll"), "");
  fs.writeFileSync(path.join(output, "js", "config.js"),
    'window.PANELA_CONFIG = Object.freeze({ mode: "demo", apiUrl: "", timeoutMs: 15000 });\n');
  for (const name of ["index.html", "js/app.js", "js/times.js"]) {
    const file = path.join(output, name);
    const text = fs.readFileSync(file, "utf8")
      .replace(/MODO DEMONSTRAÇÃO[^<"\r\n]*Sorteio feito neste navegador\./g, "Sorteio realizado neste navegador.");
    fs.writeFileSync(file, text);
  }
  for (const name of ["index.html", "times.html"]) {
    const html = fs.readFileSync(path.join(output, name), "utf8");
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = match[1];
      if (/^(?:https?:|data:|#)/i.test(url)) continue;
      if (url.startsWith("/") || !fs.existsSync(path.join(output, url.split(/[?#]/)[0]))) {
        throw new Error("Caminho inválido para GitHub Pages em " + name + ": " + url);
      }
    }
  }
  const core = require(path.join(output, "js", "core.js"));
  const browser = { window: { PanelaCore: core }, setTimeout, clearTimeout,
    fetch: () => { throw new Error("A publicação não pode depender de uma API."); } };
  vm.createContext(browser);
  for (const name of ["config.js", "api.js"]) {
    vm.runInContext(fs.readFileSync(path.join(output, "js", name), "utf8"), browser);
  }
  for (const total of [10, 13, 14]) {
    const draft = { jogadores: Array.from({ length: total }, (_, i) => ({ id: "p" + i, nome: "Jogador " + (i + 1) })),
      panelas: [["p0", "p1"]], quantidade_times: 2, jogadores_por_time: 5 };
    const result = await browser.window.PanelaAPI.draw(draft);
    core.validateResult(result, draft);
  }
  console.log("GitHub Pages preparado: caminhos relativos e sorteio no navegador conferidos.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
