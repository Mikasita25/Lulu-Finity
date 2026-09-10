'use strict';

// Modo público para launchers ya distribuidos: no exige un token estático.
// El relay conserva límites por IP, máximo de clientes, cuota individual y rotación de API keys.
// El endpoint TTS nuevo sí conserva el token de las compilaciones oficiales.
process.env.TTS_CLIENT_TOKENS =
  process.env.TTS_CLIENT_TOKENS || process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN || '';
process.env.CLIENT_TOKENS = '';
process.env.CLIENT_TOKEN = '';

// EulerStream usa schemaVersion como parámetro de nivel superior. Versiones anteriores
// de Lulu sólo enviaban features.schemaVersion desde server.js, lo que puede abrir el
// WebSocket sin dejar una sesión de LIVE utilizable. Conservamos cualquier upstream
// personalizado, pero normalizamos el endpoint oficial para pedir explícitamente v1.
try {
  const upstream = new URL(String(process.env.UPSTREAM_WS_URL || 'wss://ws.eulerstream.com').trim());
  if (upstream.protocol === 'wss:' && upstream.hostname.toLowerCase() === 'ws.eulerstream.com') {
    if (!upstream.searchParams.has('schemaVersion')) upstream.searchParams.set('schemaVersion', 'v1');
    process.env.UPSTREAM_WS_URL = upstream.toString();
  }
} catch {
  // server.js conservará su validación y manejo normal del upstream inválido.
}

console.warn('[startup] Relay público Lulu Finity con Microsoft TTS ejecutándose en Node.');
require('./server');
