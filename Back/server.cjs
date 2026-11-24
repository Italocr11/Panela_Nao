"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { ErroSorteio, separaTimes } = require("./sorteio.cjs");

const FRONT = path.resolve(__dirname, "../Front");
const MAX_BODY_BYTES = 512 * 1024;
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

function json(res, status, dados, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra });
  res.end(JSON.stringify(dados));
}

function recebeJSON(req) {
  if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ErroSorteio("Envie os dados no formato application/json.", "FORMATO_INVALIDO", 415);
  }
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let excedeu = false;
    const partes = [];
    req.on("data", parte => {
      if (excedeu) return;
      bytes += parte.length;
      if (bytes > MAX_BODY_BYTES) {
        excedeu = true;
        partes.length = 0;
        reject(new ErroSorteio("A requisição excede o limite de 512 KiB.", "REQUISICAO_GRANDE", 413));
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      if (excedeu) return;
      try { resolve(JSON.parse(Buffer.concat(partes).toString("utf8"))); }
      catch { reject(new ErroSorteio("O corpo da requisição não contém um JSON válido.", "JSON_INVALIDO", 400)); }
    });
    req.on("error", reject);
  });
}

function createServer({ sortear = separaTimes, origensPermitidas = [] } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        const origem = req.headers.origin;
        // Front e API usam a mesma origem por padrão. CORS é opcional para Live Server.
        const origemDoServidor = `http://${req.headers.host}`;
        if (origem && origem !== origemDoServidor && !origensPermitidas.includes(origem)) {
          req.resume();
          json(res, 403, { detail: "A origem do frontend não está autorizada.", codigo: "ORIGEM_INVALIDA" });
          return;
        }
        if (origem) {
          res.setHeader("Access-Control-Allow-Origin", origem);
          res.setHeader("Vary", "Origin");
        }
        if (url.pathname !== "/api/sortear") { req.resume(); json(res, 404, { detail: "Endpoint não encontrado." }); return; }
        if (req.method === "OPTIONS") {
          res.writeHead(204, { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" });
          res.end(); return;
        }
        if (req.method !== "POST") { req.resume(); json(res, 405, { detail: "Use POST para sortear os times." }, { Allow: "POST, OPTIONS" }); return; }
        const dados = await recebeJSON(req);
        const resultado = await sortear(dados);
        json(res, 200, resultado);
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") { req.resume(); json(res, 405, { detail: "Método não permitido." }, { Allow: "GET, HEAD" }); return; }
      const pathname = decodeURIComponent(url.pathname);
      const arquivo = path.resolve(FRONT, `.${pathname === "/" ? "/index.html" : pathname}`);
      const relativo = path.relative(FRONT, arquivo);
      const tipo = TIPOS[path.extname(arquivo)];
      if (relativo.startsWith("..") || path.isAbsolute(relativo) || !tipo) { json(res, 403, { detail: "Arquivo não permitido." }); return; }
      const conteudo = await fs.readFile(arquivo);
      res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : conteudo);
    } catch (erro) {
      if (res.destroyed || res.writableEnded) return;
      if (erro instanceof ErroSorteio) { req.resume(); json(res, erro.status, { detail: erro.message, codigo: erro.codigo }); return; }
      if (erro.code === "ENOENT" || erro.code === "EISDIR") { json(res, 404, { detail: "Arquivo não encontrado." }); return; }
      if (erro instanceof URIError) { json(res, 400, { detail: "Endereço inválido." }); return; }
      console.error("Erro no servidor:", erro.message);
      json(res, 500, { detail: "Ocorreu um erro interno ao processar a partida.", codigo: "ERRO_INTERNO" });
    }
  });
}

function startServer({ port = Number(process.env.PORT || 8000), host = "127.0.0.1" } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT deve estar entre 1 e 65535.");
  const origensPermitidas = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const server = createServer({ origensPermitidas });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on("error", erro => {
    console.error(erro.code === "EADDRINUSE" ? `A porta ${port} está ocupada. Feche o servidor anterior ou escolha outra PORT.` : erro.message);
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log(`Panela Não — frontend e API: http://${host}:${port}`));
  return server;
}

if (require.main === module) startServer();
module.exports = { createServer, startServer };
