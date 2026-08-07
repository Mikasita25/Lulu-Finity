'use strict';

// Entrada de compatibilidad para Railway. A partir del hardening de seguridad,
// el relay debe fallar cerrado: nunca se desactiva la autenticación desde código.
const configuredTokens = String(process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN || '').trim();

if (!configuredTokens) {
  console.error('[startup] CLIENT_TOKENS/CLIENT_TOKEN es obligatorio. El relay no arrancará en modo público.');
  process.exit(1);
}

console.info('[startup] Relay protegido: autenticación de clientes habilitada.');
require('./server-v027-loader');
