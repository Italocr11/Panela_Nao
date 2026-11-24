// O servidor Node.js entrega as páginas e a API na mesma origem.
// Para testar apenas o navegador, mode: "demo" continua disponível.
window.PANELA_CONFIG = Object.freeze({
  mode: "api",
  apiUrl: "/api/sortear",
  timeoutMs: 15000,
});
