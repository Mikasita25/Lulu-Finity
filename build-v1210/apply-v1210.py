from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8-sig')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8', newline='\n')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    return text.replace(old, new, 1)


# Version metadata.
for path in ('package.json', 'package-lock.json'):
    data = json.loads(read(path))
    if str(data.get('version')) not in {'1.2.0', '1.2.1'}:
        raise RuntimeError(f'{path}: se requiere Lulu Finity 1.2.0')
    data['version'] = '1.2.1'
    if path.endswith('package-lock.json') and isinstance(data.get('packages', {}).get(''), dict):
        data['packages']['']['version'] = '1.2.1'
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')

main = read('src/main.js')

main = replace_once(
    main,
    "youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null },\n  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null }",
    "youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, lastPayloadAt:0, recoveryAttempt:0, recoveryTimer:null },\n  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, lastPayloadAt:0, recoveryAttempt:0, recoveryTimer:null }",
    'estado de recuperación musical',
)

main = replace_once(
    main,
    "  const currentTime = Math.max(0, Number(payload.currentTime || 0));\n  const now = Date.now();\n  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');",
    "  const currentTime = Math.max(0, Number(payload.currentTime || 0));\n  const now = Date.now();\n  recovery.lastPayloadAt = now;\n  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');",
    'telemetría reciente del reproductor',
)

main = replace_once(
    main,
    "      let observer = null;\n      let userPauseUntil = 0;",
    "      let observer = null;\n      let mutationMaintenanceTimer = null;\n      let userPauseUntil = 0;",
    'estado del observador de YouTube',
)

main = replace_once(
    main,
    "      observer = new MutationObserver(() => { attach(); skipYouTubeAds(); });\n      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','aria-label'] });",
    "      observer = new MutationObserver(() => {\n        if (mutationMaintenanceTimer) return;\n        mutationMaintenanceTimer = setTimeout(() => {\n          mutationMaintenanceTimer = null;\n          attach();\n          skipYouTubeAds();\n        }, 140);\n      });\n      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });",
    'observador intensivo de YouTube',
)

main = replace_once(
    main,
    "        clearInterval(timer);\n        if (observer) observer.disconnect();",
    "        clearInterval(timer);\n        clearTimeout(mutationMaintenanceTimer);\n        mutationMaintenanceTimer = null;\n        if (observer) observer.disconnect();",
    'limpieza del observador de YouTube',
)

main = replace_once(
    main,
    "function recoverActiveMusicPlayers(reason = 'resume') {\n  for (const provider of ['youtube', 'spotify']) {\n    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, true);\n  }\n}",
    "function recoverActiveMusicPlayers(reason = 'resume') {\n  for (const provider of ['youtube', 'spotify']) {\n    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, false);\n  }\n}",
    'reanudación tras suspensión',
)

main = replace_once(
    main,
    "      if (!win || shouldRecoverPlayback({ ...recovery, visible:win.isVisible(), destroyed:win.isDestroyed() }, now)) scheduleMusicPlayerRecovery(provider, 'sin progreso', recovery.recoveryAttempt >= 1);",
    "      if (!win || shouldRecoverPlayback({ ...recovery, visible:win?.isVisible?.() === true, destroyed:Boolean(win?.isDestroyed?.()) }, now, 30000, 12000)) {\n        scheduleMusicPlayerRecovery(provider, 'sin progreso', false);\n      }",
    'watchdog musical',
)

main = replace_once(
    main,
    "    if (type === 'tiktok.disconnect') {\n      appendConnectionLog('railway-upstream-disconnected', { reason: String(data?.reason || 'remote') });\n      return false;\n    }",
    "    if (type === 'tiktok.disconnect') {\n      const reason = String(data?.reason || 'TikTok interrumpió el flujo de eventos.');\n      appendConnectionLog('railway-upstream-disconnected', { reason });\n      this.emit(C.DISCONNECTED || 'disconnected', { reason, code:1006, upstream:true });\n      return true;\n    }",
    'desconexión interna de TikTok',
)

main = replace_once(
    main,
    "      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;\n      liveConnection = null;\n      if (scheduleLiveReconnect(connectionNonce, details)) return;",
    "      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;\n      liveConnection = null;\n      void safeDisconnect(connection);\n      if (scheduleLiveReconnect(connectionNonce, details)) return;",
    'cierre del relay antes de reconectar',
)

main = replace_once(
    main,
    "    this.incomingWindowStartedAt = 0;\n    this.incomingMessageCount = 0;",
    "    this.incomingWindowStartedAt = 0;\n    this.incomingMessageCount = 0;\n    this.lastTransportActivityAt = 0;\n    this.transportHealthTimer = null;",
    'estado de salud del transporte',
)

main = replace_once(
    main,
    "      this.socket.on('open', () => {\n        opened = true;\n        this.emit(this.events.ControlEvent?.WEBSOCKET_CONNECTED || 'websocketConnected');\n        setTimeout(finishReady, 1800);\n      });\n      this.socket.on('message', (raw, isBinary) => {",
    "      this.socket.on('open', () => {\n        opened = true;\n        this.lastTransportActivityAt = Date.now();\n        clearInterval(this.transportHealthTimer);\n        this.transportHealthTimer = setInterval(() => {\n          const socket = this.socket;\n          if (!socket || socket.readyState !== WebSocket.OPEN) return;\n          const silentMs = Date.now() - this.lastTransportActivityAt;\n          if (silentMs <= 75000) return;\n          appendConnectionLog('railway-transport-stale', { silentMs });\n          try { socket.terminate(); } catch {}\n        }, 15000);\n        this.transportHealthTimer.unref?.();\n        this.emit(this.events.ControlEvent?.WEBSOCKET_CONNECTED || 'websocketConnected');\n        setTimeout(finishReady, 1800);\n      });\n      this.socket.on('ping', () => { this.lastTransportActivityAt = Date.now(); });\n      this.socket.on('message', (raw, isBinary) => {\n        this.lastTransportActivityAt = Date.now();",
    'watchdog del transporte Railway',
)

main = replace_once(
    main,
    "      this.socket.on('close', (code, reason) => {\n        clearTimeout(timeout);",
    "      this.socket.on('close', (code, reason) => {\n        clearTimeout(timeout);\n        clearInterval(this.transportHealthTimer);\n        this.transportHealthTimer = null;",
    'limpieza del transporte al cerrar',
)

main = replace_once(
    main,
    "  async disconnect() {\n    const socket = this.socket;\n    this.socket = null;",
    "  async disconnect() {\n    const socket = this.socket;\n    clearInterval(this.transportHealthTimer);\n    this.transportHealthTimer = null;\n    this.socket = null;",
    'limpieza del transporte al desconectar',
)

write('src/main.js', main)

# Recovery policy: tolerate short buffering, but recover when telemetry disappears.
write('src/music-recovery-policy.js', """'use strict';

const MUSIC_RECOVERY_DELAYS_MS = Object.freeze([800, 1800, 4000, 9000, 18000]);

function musicRecoveryDelay(attempt) {
  const index = Math.min(MUSIC_RECOVERY_DELAYS_MS.length - 1, Math.max(0, Number(attempt) || 0));
  return MUSIC_RECOVERY_DELAYS_MS[index];
}

function shouldRecoverPlayback(state = {}, now = Date.now(), stallAfterMs = 30000, silenceAfterMs = 12000) {
  if (!state.expectedPlaying || state.userPaused || state.visible || state.adActive) return false;
  if (state.destroyed) return true;
  const lastProgressAt = Number(state.lastProgressAt || 0);
  const lastPayloadAt = Number(state.lastPayloadAt || 0);
  const stallLimit = Math.max(5000, Number(stallAfterMs || 30000));
  const silenceLimit = Math.max(5000, Number(silenceAfterMs || 12000));
  if (lastPayloadAt && Number(now) - lastPayloadAt > silenceLimit) return true;
  return !lastProgressAt || Number(now) - lastProgressAt > stallLimit;
}

function isManualPlayerPause(state = {}, payload = {}) {
  return payload.paused === true && payload.userPaused === true && state.visible === true;
}

function shouldResumeUnexpectedPause(state = {}, payload = {}) {
  return payload.paused === true
    && state.expectedPlaying === true
    && state.userPaused !== true
    && state.adActive !== true
    && !isManualPlayerPause(state, payload);
}

module.exports = {
  MUSIC_RECOVERY_DELAYS_MS,
  musicRecoveryDelay,
  shouldRecoverPlayback,
  isManualPlayerPause,
  shouldResumeUnexpectedPause
};
""")

music_test = read('src/music-recovery-policy.test.js')
old_assert = "assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000 }, 14001), true);"
if old_assert not in music_test:
    raise RuntimeError('prueba antigua del watchdog musical no encontrada')
music_test = music_test.replace(old_assert, "assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000, lastPayloadAt:18000 }, 19000), false);", 1)
if 'distingue silencio del reproductor de una pausa corta por buffer' not in music_test:
    music_test += """

test('distingue silencio del reproductor de una pausa corta por buffer', () => {
  const base = { expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000 };
  assert.equal(shouldRecoverPlayback({ ...base, lastPayloadAt:25000 }, 30000, 30000, 12000), false);
  assert.equal(shouldRecoverPlayback({ ...base, lastPayloadAt:10000 }, 23001, 30000, 12000), true);
  assert.equal(shouldRecoverPlayback({ ...base, lastPayloadAt:25000 }, 32001, 30000, 12000), true);
});
"""
write('src/music-recovery-policy.test.js', music_test)

# Command matcher: normalize TikTok/paste Unicode exclamation marks.
write('src/command-matching-policy.js', """'use strict';

const INVISIBLE_CHARACTERS = /[\\u00ad\\u034f\\u061c\\u180e\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\ufe0e\\ufe0f\\ufeff]/gu;
const LEADING_COMMAND_BANGS = /^[!¡！﹗❗❕‼]+/u;

function cleanCommandText(value) {
  let text = String(value ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(/\\s+/gu, ' ')
    .trim();
  if (LEADING_COMMAND_BANGS.test(text)) text = `!${text.replace(LEADING_COMMAND_BANGS, '')}`;
  return text.replace(/^!\\s+/u, '!');
}

function commandKey(value) {
  const text = cleanCommandText(value);
  const token = text.match(/^!([^\\s:;,?.]+)/u)?.[1] || '';
  if (!token) return '';
  return `!${token.normalize('NFD').replace(/\\p{M}/gu, '').toLowerCase()}`;
}

function parseCommandText(value) {
  const text = cleanCommandText(value);
  const match = text.match(/^!([^\\s:;,?.]+)(?:\\s*[:;,?.]\\s*|\\s+|$)([\\s\\S]*)$/u);
  if (!match) return null;
  const key = commandKey(`!${match[1]}`);
  return key ? { key, remainder:String(match[2] || '').trim(), text } : null;
}

function matchCommand(comment, trigger) {
  const parsed = parseCommandText(comment);
  const expected = commandKey(trigger);
  return parsed && expected && parsed.key === expected ? parsed : null;
}

module.exports = { cleanCommandText, commandKey, parseCommandText, matchCommand };
""")

command_test = read('src/command-matching-policy.test.js')
if 'acepta signos de exclamación de TikTok y selectores emoji' not in command_test:
    command_test += """

test('acepta signos de exclamación de TikTok y selectores emoji', () => {
  assert.equal(parseCommandText('❗️canción Bad Bunny')?.key, '!cancion');
  assert.equal(parseCommandText('‼saldo')?.key, '!saldo');
  assert.equal(parseCommandText('﹗ stop')?.key, '!stop');
  assert.equal(matchCommand('❕TRUE', '!true')?.remainder, '');
});
"""
write('src/command-matching-policy.test.js', command_test)

# Version shown by the desktop UI.
index = read('src/index.html').replace('v1.2.0', 'v1.2.1')
write('src/index.html', index)

renderer = read('src/renderer.js')
marker = 'const RELEASE_NOTES = Object.freeze({\n'
if marker in renderer and "'1.2.1': Object.freeze([" not in renderer:
    renderer = renderer.replace(marker, marker + "  '1.2.1': Object.freeze([\n    Object.freeze({ icon:'⚡', title:'Música más fluida', text:'Reduce el trabajo interno de YouTube y evita recuperaciones agresivas durante buffers cortos.' }),\n    Object.freeze({ icon:'↻', title:'LIVE más estable', text:'Recupera microcortes del servidor y sockets que quedaron abiertos pero sin eventos.' }),\n    Object.freeze({ icon:'!', title:'Comandos reforzados', text:'Tolera más variantes Unicode del signo de comando y reduce comandos perdidos tras microcortes.' })\n  ]),\n", 1)
write('src/renderer.js', renderer)

changelog = read('CHANGELOG.md')
if '## 1.2.1' not in changelog:
    changelog = "## 1.2.1\n\n- Corrige tirones del reproductor de YouTube reduciendo trabajo del observador interno.\n- Hace menos agresiva la recuperación musical durante buffers normales.\n- Recupera desconexiones internas del LIVE y sockets congelados.\n- Refuerza el reconocimiento de comandos Unicode en TikTok.\n\n" + changelog
write('CHANGELOG.md', changelog)

print('Lulu Finity Studio 1.2.1 preparada con el hotfix de estabilidad')
