from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperó 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def update_version(path: str) -> None:
    data = json.loads(read(path))
    data["version"] = "1.1.8"
    if path.endswith("package-lock.json"):
        packages = data.get("packages")
        if isinstance(packages, dict) and isinstance(packages.get(""), dict):
            packages[""]["version"] = "1.1.8"
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


for file_name in ("package.json", "package-lock.json"):
    update_version(file_name)

# --- Main process: music recovery + LIVE recovery ---
main = read("src/main.js")

main = replace_once(
    main,
    "youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null },\n  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null }",
    "youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, lastPayloadAt:0, recoveryAttempt:0, recoveryTimer:null },\n  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, lastPayloadAt:0, recoveryAttempt:0, recoveryTimer:null }",
    "estado de recuperación musical",
)

main = replace_once(
    main,
    "  const currentTime = Math.max(0, Number(payload.currentTime || 0));\n  const now = Date.now();\n  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');",
    "  const currentTime = Math.max(0, Number(payload.currentTime || 0));\n  const now = Date.now();\n  recovery.lastPayloadAt = now;\n  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');",
    "telemetría musical",
)

main = replace_once(
    main,
    "      let observer = null;\n      let userPauseUntil = 0;",
    "      let observer = null;\n      let mutationMaintenanceTimer = null;\n      let userPauseUntil = 0;",
    "estado del observador de YouTube",
)

main = replace_once(
    main,
    "      observer = new MutationObserver(() => { attach(); skipYouTubeAds(); });\n      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','aria-label'] });",
    "      observer = new MutationObserver(() => {\n        if (mutationMaintenanceTimer) return;\n        mutationMaintenanceTimer = setTimeout(() => {\n          mutationMaintenanceTimer = null;\n          attach();\n          skipYouTubeAds();\n        }, 140);\n      });\n      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });",
    "observador intensivo de YouTube",
)

main = replace_once(
    main,
    "        clearInterval(timer);\n        if (observer) observer.disconnect();",
    "        clearInterval(timer);\n        clearTimeout(mutationMaintenanceTimer);\n        mutationMaintenanceTimer = null;\n        if (observer) observer.disconnect();",
    "limpieza del observador de YouTube",
)

main = replace_once(
    main,
    "function recoverActiveMusicPlayers(reason = 'resume') {\n  for (const provider of ['youtube', 'spotify']) {\n    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, true);\n  }\n}",
    "function recoverActiveMusicPlayers(reason = 'resume') {\n  for (const provider of ['youtube', 'spotify']) {\n    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, false);\n  }\n}",
    "recuperación al volver de suspensión",
)

main = replace_once(
    main,
    "      if (!win || shouldRecoverPlayback({ ...recovery, visible:win.isVisible(), destroyed:win.isDestroyed() }, now)) scheduleMusicPlayerRecovery(provider, 'sin progreso', recovery.recoveryAttempt >= 1);",
    "      if (!win || shouldRecoverPlayback({ ...recovery, visible:win?.isVisible?.() === true, destroyed:Boolean(win?.isDestroyed?.()) }, now, 30000, 12000)) {\n        scheduleMusicPlayerRecovery(provider, 'sin progreso', false);\n      }",
    "watchdog musical",
)

main = replace_once(
    main,
    "    if (type === 'tiktok.disconnect') {\n      appendConnectionLog('railway-upstream-disconnected', { reason: String(data?.reason || 'remote') });\n      return false;\n    }",
    "    if (type === 'tiktok.disconnect') {\n      const reason = String(data?.reason || 'TikTok interrumpió el flujo de eventos.');\n      appendConnectionLog('railway-upstream-disconnected', { reason });\n      this.emit(C.DISCONNECTED || 'disconnected', { reason, code:1006, upstream:true });\n      return true;\n    }",
    "desconexión del upstream TikTok",
)

main = replace_once(
    main,
    "      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;\n      liveConnection = null;\n      if (scheduleLiveReconnect(connectionNonce, details)) return;",
    "      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;\n      liveConnection = null;\n      void safeDisconnect(connection);\n      if (scheduleLiveReconnect(connectionNonce, details)) return;",
    "cierre del relay antes de reconectar",
)

main = replace_once(
    main,
    "    this.incomingWindowStartedAt = 0;\n    this.incomingMessageCount = 0;",
    "    this.incomingWindowStartedAt = 0;\n    this.incomingMessageCount = 0;\n    this.lastTransportActivityAt = 0;\n    this.transportHealthTimer = null;",
    "estado de salud del transporte",
)

main = replace_once(
    main,
    "      this.socket.on('open', () => {\n        opened = true;\n        this.emit(this.events.ControlEvent?.WEBSOCKET_CONNECTED || 'websocketConnected');\n        setTimeout(finishReady, 1800);\n      });\n      this.socket.on('message', (raw, isBinary) => {",
    "      this.socket.on('open', () => {\n        opened = true;\n        this.lastTransportActivityAt = Date.now();\n        clearInterval(this.transportHealthTimer);\n        this.transportHealthTimer = setInterval(() => {\n          const socket = this.socket;\n          if (!socket || socket.readyState !== WebSocket.OPEN) return;\n          if (Date.now() - this.lastTransportActivityAt <= 75000) return;\n          appendConnectionLog('railway-transport-stale', { silentMs:Date.now() - this.lastTransportActivityAt });\n          try { socket.terminate(); } catch {}\n        }, 15000);\n        this.transportHealthTimer.unref?.();\n        this.emit(this.events.ControlEvent?.WEBSOCKET_CONNECTED || 'websocketConnected');\n        setTimeout(finishReady, 1800);\n      });\n      this.socket.on('ping', () => { this.lastTransportActivityAt = Date.now(); });\n      this.socket.on('message', (raw, isBinary) => {\n        this.lastTransportActivityAt = Date.now();",
    "watchdog de transporte Railway",
)

main = replace_once(
    main,
    "      this.socket.on('close', (code, reason) => {\n        clearTimeout(timeout);",
    "      this.socket.on('close', (code, reason) => {\n        clearTimeout(timeout);\n        clearInterval(this.transportHealthTimer);\n        this.transportHealthTimer = null;",
    "limpieza de salud Railway al cerrar",
)

main = replace_once(
    main,
    "  async disconnect() {\n    const socket = this.socket;\n    this.socket = null;",
    "  async disconnect() {\n    const socket = this.socket;\n    clearInterval(this.transportHealthTimer);\n    this.transportHealthTimer = null;\n    this.socket = null;",
    "limpieza de salud Railway al desconectar",
)

write("src/main.js", main)

# --- Music recovery policy: distinguish missing telemetry from buffering ---
music_policy = """'use strict';

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
  const baseline = lastPayloadAt || lastProgressAt;
  if (baseline && Number(now) - baseline > silenceLimit && (!lastPayloadAt || lastPayloadAt <= lastProgressAt)) return true;
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
"""
write("src/music-recovery-policy.js", music_policy)

music_test = read("src/music-recovery-policy.test.js")
music_test = music_test.replace(
    "assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000 }, 14001), true);",
    "assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000, lastPayloadAt:31000 }, 32001), true);",
)
if "distingue silencio del reproductor" not in music_test:
    music_test += """

test('distingue silencio del reproductor de una pausa corta por buffer', () => {
  const base = { expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000 };
  assert.equal(shouldRecoverPlayback({ ...base, lastPayloadAt:25000 }, 30000, 30000, 12000), false);
  assert.equal(shouldRecoverPlayback({ ...base, lastPayloadAt:10000 }, 23001, 30000, 12000), true);
  assert.equal(shouldRecoverPlayback({ ...base, lastPayloadAt:25000 }, 32001, 30000, 12000), true);
});
"""
write("src/music-recovery-policy.test.js", music_test)

# --- Command matcher: tolerate punctuation variants frequently emitted/pasted in LIVE chat ---
command_policy = """'use strict';

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
"""
write("src/command-matching-policy.js", command_policy)

command_test = read("src/command-matching-policy.test.js")
if "signos de exclamación de TikTok" not in command_test:
    command_test += """

test('acepta signos de exclamación de TikTok y selectores emoji', () => {
  assert.equal(parseCommandText('❗️canción Bad Bunny')?.key, '!cancion');
  assert.equal(parseCommandText('‼saldo')?.key, '!saldo');
  assert.equal(parseCommandText('﹗ stop')?.key, '!stop');
  assert.equal(matchCommand('❕TRUE', '!true')?.remainder, '');
});
"""
write("src/command-matching-policy.test.js", command_test)

# --- UI/release metadata ---
index = read("src/index.html").replace("v1.1.7", "v1.1.8")
write("src/index.html", index)

renderer = read("src/renderer.js")
renderer = replace_once(
    renderer,
    "const RELEASE_NOTES = Object.freeze({\n  '1.1.7': Object.freeze([",
    "const RELEASE_NOTES = Object.freeze({\n  '1.1.8': Object.freeze([\n    Object.freeze({ icon:'⚡', title:'Música más fluida', text:'Reduce trabajo excesivo sobre YouTube y evita recuperaciones agresivas durante buffers cortos.' }),\n    Object.freeze({ icon:'↻', title:'LIVE más estable', text:'Reconecta cuando TikTok corta el flujo interno y detecta sockets que quedaron congelados.' }),\n    Object.freeze({ icon:'!', title:'Comandos reforzados', text:'Tolera más variantes Unicode del signo de comando y reduce comandos perdidos tras microcortes.' })\n  ]),\n  '1.1.7': Object.freeze([",
    "notas 1.1.8",
)
write("src/renderer.js", renderer)

changelog = read("CHANGELOG.md")
if "## 1.1.8" not in changelog:
    changelog = "## 1.1.8\n\n- Reduce el trabajo del monitor de YouTube para evitar tirones de reproducción.\n- El watchdog musical distingue mejor un buffer corto de un bloqueo real.\n- El LIVE reconecta cuando Railway informa que TikTok cortó el upstream.\n- Añade un watchdog de transporte para recuperar sockets congelados.\n- Amplía el reconocimiento de comandos con signos Unicode frecuentes en TikTok.\n\n" + changelog
write("CHANGELOG.md", changelog)

print("Lulu Finity 1.1.8 aplicada: música, LIVE y comandos reforzados")
