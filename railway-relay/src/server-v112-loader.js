'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const filename = path.join(__dirname, 'server.js');
let source = fs.readFileSync(filename, 'utf8');

function replaceOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`No se pudo integrar ${label}: se esperaba 1 coincidencia y hubo ${count}.`);
  source = source.replace(oldText, newText);
}

replaceOnce(
  "const { MICROSOFT_VOICES, synthesizeMicrosoftSpeech } = require('./microsoft-tts');",
  "const { MICROSOFT_VOICES, synthesizeMicrosoftSpeech } = require('./microsoft-tts');\nconst { OverlayHub } = require('./overlay-hub-custom-assets');",
  'OverlayHub'
);

replaceOnce(
  "const MAX_CLIENTS = Math.max(1, Number(process.env.MAX_CLIENTS || 50));",
  "const OVERLAY_CLIENT_TOKENS = new Set(parseList(process.env.OVERLAY_CLIENT_TOKENS || process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN));\nconst MAX_CLIENTS = Math.max(1, Number(process.env.MAX_CLIENTS || 50));",
  'tokens de overlays'
);

replaceOnce(
  "const sessions = new Set();",
  "const sessions = new Set();\nconst overlayHub = new OverlayHub({ clientTokens: OVERLAY_CLIENT_TOKENS });",
  'instancia de overlays'
);

replaceOnce(
  "  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);\n  if (request.method === 'OPTIONS') {",
  "  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);\n  if (await overlayHub.handleHttpRequest(request, response, url)) return;\n  if (request.method === 'OPTIONS') {",
  'rutas HTTP de overlays'
);

replaceOnce(
  "      tts: { provider: 'microsoft-edge', activeRequests: activeTtsRequests, voices: MICROSOFT_VOICES.length },",
  "      tts: { provider: 'microsoft-edge', activeRequests: activeTtsRequests, voices: MICROSOFT_VOICES.length },\n      overlays: { stablePublicUrls: true, ...overlayHub.snapshot() },",
  'salud de overlays'
);

const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(source, filename);
module.exports = compiled.exports;
