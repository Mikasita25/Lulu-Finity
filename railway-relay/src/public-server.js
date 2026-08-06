'use strict';

// Modo público para launchers ya distribuidos: no exige un token estático.
// El relay conserva límites por IP, máximo de clientes y rotación de API keys.
process.env.CLIENT_TOKENS = '';
process.env.CLIENT_TOKEN = '';

console.warn('[startup] Relay en modo público para clientes Lulu Finity; autenticación por token desactivada.');
require('./server');
