// Mantém o comando anterior funcionando, agora com a API de verdade na mesma porta.
require("../Back/server.cjs").startServer({ port: Number(process.env.PORT || 5500) });
