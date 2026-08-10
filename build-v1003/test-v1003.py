from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
main = (ROOT / "src/main.js").read_text(encoding="utf-8")
preload = (ROOT / "src/preload.js").read_text(encoding="utf-8")
voice_manager = (ROOT / "src/local-voice-manager.js").read_text(encoding="utf-8")
html = (ROOT / "src/index.html").read_text(encoding="utf-8")
protocol = (ROOT / "src/relay-protocol.js").read_text(encoding="utf-8")
relay = (ROOT / "railway-relay/src/server.js").read_text(encoding="utf-8")
changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")

assert package["version"] == "1.0.3"
assert package["dependencies"]["adm-zip"] == "0.6.0"
assert package["dependencies"]["ws"] == "8.21.3"
assert lock["version"] == "1.0.3"
assert lock["packages"][""]["version"] == "1.0.3"
assert 'id="versionLabel">v1.0.3' in html
assert 'id="updateVersionBadge">v1.0.3' in html
assert "## 1.0.3" in changelog

for path in (ROOT / "src/relay-protocol.js", ROOT / "src/relay-protocol.test.js"):
    assert path.is_file(), path

relay_lock = json.loads((ROOT / "railway-relay/package-lock.json").read_text(encoding="utf-8"))
assert relay_lock["lockfileVersion"] == 3
assert relay_lock["packages"]["node_modules/ws"]["version"] == "8.21.3"
assert (ROOT / "src/local-voice-manager.test.js").is_file()
assert "const manifestPrefix = manifestDirectory === '.' ? ''" in voice_manager
assert "parts.slice(1).join('/')" not in voice_manager

for token in (
    "MAX_RELAY_FRAME_BYTES = 512 * 1024",
    "MAX_RELAY_MESSAGES_PER_FRAME = 128",
    "FORBIDDEN_REMOTE_TYPE",
    "forbidden_remote_request",
    "RELAY_MESSAGE_TYPES.has(type)",
    "IGNORED_RELAY_MESSAGE_TYPES.has(type)",
    "WebcastCaptionMessage",
    "SyntheticJoinMessage",
    "source.type",
    "source.data",
    "safeHttpsUrl",
    "sanitizeRelayUsage",
):
    assert token in protocol, token

for forbidden_alias in (
    "source.event",
    "source.method",
    "source.payload",
    "message?.event",
    "message?.method",
    "message?.payload",
):
    assert forbidden_alias not in protocol, forbidden_alias

for sensitive in ("cookie:", "sessionid:", "password:", "email:", "path:", "settings:", "token:"):
    assert sensitive not in protocol, sensitive

for token in (
    "require('./relay-protocol')",
    "parseRelayFrame(raw)",
    "this.countIncomingMessages(messages.length)",
    "this.rejectRelayProtocol(error)",
    "maxPayload: MAX_RELAY_FRAME_BYTES",
    "perMessageDeflate: false",
    "followRedirects: false",
    "redirect: 'error'",
    "readLimitedResponseBody(response, 32 * 1024)",
    "response.body?.getReader?.()",
    "reader.cancel('response-too-large')",
    "let runtimeResourceSettings = null",
    "runtimeResourceSettings = normalizeVoiceSettings(DEFAULT_SETTINGS)",
    "app.whenReady().then(startApplication).catch",
    "dialog.showErrorBox('Lulu Finity no pudo iniciar'",
    "LULU_STARTUP_SMOKE_MARKER",
    "process.env.CI !== 'true'",
    "markerPath.startsWith(`${allowedRoot}${path.sep}`)",
    "flag:'wx'",
):
    assert token in main, token

assert main.index("const DEFAULT_SETTINGS = {") < main.index("runtimeResourceSettings = normalizeVoiceSettings(DEFAULT_SETTINGS)")
assert "runtimeResourceSettings={...DEFAULT_SETTINGS" not in main

relay_class = re.search(r"class RailwayRelayConnection.*?\n}\n\nfunction friendlyConnectionError", main, re.S)
assert relay_class, "No se encontró RailwayRelayConnection"
relay_class_text = relay_class.group(0)
assert ".send(" not in relay_class_text, "El cliente WebSocket no debe enviar mensajes de aplicación"
assert "message?.event" not in relay_class_text
assert "message?.method" not in relay_class_text
assert "message?.payload" not in relay_class_text
assert "JSON.parse(Buffer.isBuffer(raw)" not in relay_class_text

assert "ipcRenderer.invoke(payload" not in preload
assert "ipcRenderer.send(payload" not in preload
assert "contextBridge.exposeInMainWorld('voiceStudio'" in preload
assert "reportRendererReady: () => ipcRenderer.send('app:renderer-ready')" in preload
assert "api.reportRendererReady();" in (ROOT / "src/renderer.js").read_text(encoding="utf-8")

for copy in (
    "SI EL SERVIDOR FUERA ATACADO",
    "El relay no tiene permisos para leer datos de la aplicación",
    "El canal de mensajes WebSocket es de recepción",
    "solicitar cookies, sesión, archivos, ajustes, credenciales ni información del dispositivo",
    "Lulu corta esa conexión",
    "Un relay comprometido todavía podría interrumpir el servicio o fabricar un evento público",
):
    assert copy in html, copy

assert "maxPayload: 1024" in relay
assert "perMessageDeflate: false" in relay
assert "client.on('message'" in relay
assert "client.close(1008, 'Canal de solo recepción')" in relay

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"

print("Lulu Finity 1.0.3: frontera de confianza validada")
