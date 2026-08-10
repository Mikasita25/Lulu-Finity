from pathlib import Path
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
FILES = Path(__file__).resolve().parent / "files"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def install_file(relative: str) -> None:
    source = FILES / relative
    destination = ROOT / relative
    if not source.is_file():
        raise SystemExit(f"Falta archivo del parche: {relative}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.2":
    raise SystemExit(f"Lulu Finity 1.0.3 espera la fuente 1.0.2, no {package.get('version')}")
package["version"] = "1.0.3"
package["description"] = "Lulu Finity 1.0: estudio para TikTok LIVE con cliente WebSocket de confianza cero"
package["dependencies"]["adm-zip"] = "0.6.0"
package["dependencies"]["ws"] = "8.21.3"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.3"
if isinstance(lock.get("packages", {}).get(""), dict):
    lock["packages"][""]["version"] = "1.0.3"
    lock["packages"][""]["dependencies"]["adm-zip"] = "0.6.0"
    lock["packages"][""]["dependencies"]["ws"] = "8.21.3"
lock["packages"]["node_modules/adm-zip"] = {
    "version": "0.6.0",
    "resolved": "https://registry.npmjs.org/adm-zip/-/adm-zip-0.6.0.tgz",
    "integrity": "sha512-XleryMhbuksdKtofnWZ9Sk+4CUTbms4Mb/EU32SZwToAyZ5RgVos/ki8n+yr0LWHOGKuakbXTuuYNHLQjhddgg==",
    "license": "MIT",
    "engines": {"node": ">=14.0"},
}
lock["packages"]["node_modules/ws"] = {
    "version": "8.21.3",
    "resolved": "https://registry.npmjs.org/ws/-/ws-8.21.3.tgz",
    "integrity": "sha512-201TZ/kPWxoPr/OKWjquZR1SWKXcvxdH+e1xrx89b3YbmzLMFCLfnaG1HFIgWzJOEWZ7MvpK++odZufgYR50Rw==",
    "license": "MIT",
    "engines": {"node": ">=10.0.0"},
    "peerDependencies": {"bufferutil": "^4.0.1", "utf-8-validate": ">=5.0.2"},
    "peerDependenciesMeta": {
        "bufferutil": {"optional": True},
        "utf-8-validate": {"optional": True},
    },
}
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for relative in (
    "src/relay-protocol.js",
    "src/relay-protocol.test.js",
    "src/local-voice-manager.test.js",
    "railway-relay/package-lock.json",
    "railway-relay/src/receive-only.test.js",
):
    install_file(relative)

main_path = ROOT / "src/main.js"
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    "let runtimeResourceSettings={...DEFAULT_SETTINGS,balancedKeepActive:{ live:false, account:false, voice:false, music:false, overlays:false, rankings:false, automations:false, commands:false, games:false, economy:false }};",
    "let runtimeResourceSettings = null;",
    "estado de recursos sin acceso adelantado a ajustes",
)
main = replace_once(
    main,
    "  next.balancedKeepActive = normalizeBalancedKeepActive(next.balancedKeepActive);\n  return next;\n}\n\nasync function removeRetiredVoiceEngine()",
    "  next.balancedKeepActive = normalizeBalancedKeepActive(next.balancedKeepActive);\n  return next;\n}\n\nruntimeResourceSettings = normalizeVoiceSettings(DEFAULT_SETTINGS);\n\nasync function removeRetiredVoiceEngine()",
    "inicialización ordenada de recursos",
)
main = replace_once(
    main,
    "app.whenReady().then(async () => {\n  await ensureDataFiles();\n  await removeRetiredVoiceEngine();\n  initializeUpdater();\n  createWindow();\n  app.on('activate', () => {\n    if (BrowserWindow.getAllWindows().length === 0) createWindow();\n  });\n});",
    "async function startApplication() {\n  await ensureDataFiles();\n  await removeRetiredVoiceEngine();\n  initializeUpdater();\n  createWindow();\n  app.on('activate', () => {\n    if (BrowserWindow.getAllWindows().length === 0) createWindow();\n  });\n}\n\napp.whenReady().then(startApplication).catch((error) => {\n  console.error('Lulu Finity no pudo completar el arranque:', error);\n  try { dialog.showErrorBox('Lulu Finity no pudo iniciar', error?.message || String(error)); } catch {}\n  app.exit(1);\n});",
    "arranque observable y con error controlado",
)
main = replace_once(
    main,
    "const WebSocket = require('ws');",
    "const WebSocket = require('ws');\nconst { MAX_RELAY_FRAME_BYTES, RelayProtocolError, parseRelayFrame, sanitizeRelayUsage } = require('./relay-protocol');",
    "módulo de protocolo del relay",
)
main = replace_once(
    main,
    "function cloudCloseMessage(code, reason = '') {\n  const cleanReason = String(reason || '').trim();",
    "function cloudCloseMessage(code, reason = '') {\n  const cleanReason = String(reason || '').replace(/[\\u0000-\\u001f\\u007f]/g, '').trim().slice(0, 160);",
    "motivo de cierre limitado",
)
main = replace_once(
    main,
    "    this.readyPromise = null;\n  }\n\n  async fetchRoomId()",
    "    this.readyPromise = null;\n    this.protocolViolationCount = 0;\n    this.incomingWindowStartedAt = 0;\n    this.incomingMessageCount = 0;\n  }\n\n  async fetchRoomId()",
    "estado del protocolo",
)
main = replace_once(
    main,
    "  async fetchRoomId() {\n    return this.roomId || 'relay';\n  }\n\n  emitCloudMessage(message) {\n    const type = String(message?.type || message?.event || message?.method || '').trim();\n    const data = normalizeCloudMessageData(type, message?.data ?? message?.payload ?? message);",
    "  async fetchRoomId() {\n    return this.roomId || 'relay';\n  }\n\n  rejectRelayProtocol(error) {\n    this.protocolViolationCount += 1;\n    appendConnectionLog('railway-relay-protocol-rejected', {\n      code: String(error?.code || 'invalid_message').slice(0, 80),\n      count: this.protocolViolationCount\n    });\n    const mustClose = error?.code === 'forbidden_remote_request'\n      || error?.code === 'rate_limit'\n      || this.protocolViolationCount >= 3;\n    if (mustClose && this.socket && this.socket.readyState === WebSocket.OPEN) {\n      try { this.socket.close(1008, 'Protocolo del relay rechazado'); } catch {}\n    }\n  }\n\n  countIncomingMessages(amount) {\n    const now = Date.now();\n    if (!this.incomingWindowStartedAt || now - this.incomingWindowStartedAt >= 1000) {\n      this.incomingWindowStartedAt = now;\n      this.incomingMessageCount = 0;\n    }\n    this.incomingMessageCount += Math.max(0, Number(amount) || 0);\n    if (this.incomingMessageCount > 500) {\n      throw new RelayProtocolError('rate_limit', 'El relay excedió el límite de eventos por segundo.');\n    }\n  }\n\n  emitCloudMessage(message) {\n    const type = String(message?.type || '').trim();\n    const data = normalizeCloudMessageData(type, message?.data);",
    "frontera estricta del protocolo",
)
main = replace_once(
    main,
    "      this.socket = new WebSocket(url.toString(), { handshakeTimeout: 16000, headers });",
    "      // Canal unidireccional: Lulu recibe eventos públicos y nunca responde con datos de la app.\n      this.socket = new WebSocket(url.toString(), {\n        handshakeTimeout: 16000,\n        headers,\n        maxPayload: MAX_RELAY_FRAME_BYTES,\n        perMessageDeflate: false,\n        followRedirects: false\n      });",
    "WebSocket endurecido",
)
main = replace_once(
    main,
    "      this.socket.on('message', (raw) => {\n        try {\n          const parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));\n          const messages = Array.isArray(parsed?.messages) ? parsed.messages : Array.isArray(parsed) ? parsed : [parsed];\n          let valid = false;\n          for (const message of messages) valid = this.emitCloudMessage(message) || valid;\n          if (valid) finishReady();\n        } catch (error) {\n          appendConnectionLog('railway-relay-invalid-message', { message: error?.message || String(error) });\n        }\n      });",
    "      this.socket.on('message', (raw, isBinary) => {\n        try {\n          if (isBinary) throw new RelayProtocolError('binary_frame', 'El relay envió un paquete binario no permitido.');\n          const messages = parseRelayFrame(raw);\n          this.countIncomingMessages(messages.length);\n          let valid = false;\n          for (const message of messages) valid = this.emitCloudMessage(message) || valid;\n          if (valid) finishReady();\n        } catch (error) {\n          this.rejectRelayProtocol(error);\n        }\n      });",
    "validación de mensajes WebSocket",
)
main = replace_once(
    main,
    "    const response = await fetch(url, {\n      headers: { 'Accept': 'application/json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },\n      cache: 'no-store',\n      signal: controller.signal\n    });\n    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);\n    const usage = await response.json();\n    if (!usage?.ok) throw new Error('El servidor no entregó el contador diario.');\n    return usage;",
    "    const response = await fetch(url, {\n      headers: { 'Accept': 'application/json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },\n      cache: 'no-store',\n      redirect: 'error',\n      signal: controller.signal\n    });\n    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);\n    const responseUrl = new URL(response.url);\n    if (responseUrl.origin !== url.origin || responseUrl.pathname !== url.pathname) {\n      throw new Error('El servidor intentó redirigir la consulta de uso.');\n    }\n    const declaredLength = Number(response.headers.get('content-length') || 0);\n    if (declaredLength > 32 * 1024) throw new Error('El contador enviado por el servidor es demasiado grande.');\n    const body = Buffer.from(await response.arrayBuffer());\n    if (!body.length || body.length > 32 * 1024) throw new Error('El contador enviado por el servidor no tiene un tamaño válido.');\n    let usage;\n    try { usage = JSON.parse(body.toString('utf8')); }\n    catch { throw new Error('El servidor no entregó JSON válido para el contador.'); }\n    return sanitizeRelayUsage(usage);",
    "contador del relay endurecido",
)
main = replace_once(
    main,
    "async function fetchRelayUsage(username = '') {",
    "async function readLimitedResponseBody(response, maximumBytes) {\n  const limit = Math.max(1, Number(maximumBytes) || 1);\n  const reader = response.body?.getReader?.();\n  if (!reader) throw new Error('El servidor no entregó una respuesta legible.');\n  const chunks = [];\n  let total = 0;\n  while (true) {\n    const { done, value } = await reader.read();\n    if (done) break;\n    const chunk = Buffer.from(value || []);\n    total += chunk.length;\n    if (total > limit) {\n      await reader.cancel('response-too-large').catch(() => {});\n      throw new Error('El contador enviado por el servidor es demasiado grande.');\n    }\n    chunks.push(chunk);\n  }\n  return Buffer.concat(chunks, total);\n}\n\nasync function fetchRelayUsage(username = '') {",
    "lector HTTP limitado",
)
main = replace_once(
    main,
    "    const body = Buffer.from(await response.arrayBuffer());\n    if (!body.length || body.length > 32 * 1024) throw new Error('El contador enviado por el servidor no tiene un tamaño válido.');",
    "    const body = await readLimitedResponseBody(response, 32 * 1024);\n    if (!body.length) throw new Error('El contador enviado por el servidor no tiene un tamaño válido.');",
    "lectura limitada del contador",
)
main = replace_once(
    main,
    "ipcMain.on('window:minimize', () => mainWindow?.minimize());",
    "ipcMain.on('app:renderer-ready', () => {\n  const runnerRoot = String(process.env.RUNNER_TEMP || '').trim();\n  const marker = String(process.env.LULU_STARTUP_SMOKE_MARKER || '').trim();\n  if (process.env.CI !== 'true' || !runnerRoot || !marker) return;\n  const allowedRoot = path.resolve(runnerRoot);\n  const markerPath = path.resolve(marker);\n  if (!markerPath.startsWith(`${allowedRoot}${path.sep}`)) return;\n  try { fs.writeFileSync(markerPath, 'ready', { encoding:'utf8', flag:'wx' }); }\n  catch (error) { console.error('No se pudo escribir la marca de arranque:', error); }\n});\n\nipcMain.on('window:minimize', () => mainWindow?.minimize());",
    "señal de renderer listo para prueba empaquetada",
)
main_path.write_text(main, encoding="utf-8")

preload_path = ROOT / "src/preload.js"
preload = preload_path.read_text(encoding="utf-8")
preload = replace_once(
    preload,
    "  minimize: () => ipcRenderer.send('window:minimize'),",
    "  reportRendererReady: () => ipcRenderer.send('app:renderer-ready'),\n  minimize: () => ipcRenderer.send('window:minimize'),",
    "puente de prueba de renderer listo",
)
preload_path.write_text(preload, encoding="utf-8")

renderer_path = ROOT / "src/renderer.js"
renderer = renderer_path.read_text(encoding="utf-8")
renderer = replace_once(
    renderer,
    "  void api.setActivePage('dashboard');\n}",
    "  void api.setActivePage('dashboard');\n  api.reportRendererReady();\n}",
    "confirmación de inicialización completa del renderer",
)
renderer_path.write_text(renderer, encoding="utf-8")

voice_manager_path = ROOT / "src/local-voice-manager.js"
voice_manager = voice_manager_path.read_text(encoding="utf-8")
voice_manager = replace_once(
    voice_manager,
    "    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));\n    const id = safeId(manifest.id || manifest.name);",
    "    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));\n    const manifestDirectory = path.posix.dirname(String(manifestEntry.entryName || '').replace(/\\\\/g, '/'));\n    const manifestPrefix = manifestDirectory === '.' ? '' : `${manifestDirectory.replace(/^\\/+|\\/+$/g, '')}/`;\n    const id = safeId(manifest.id || manifest.name);",
    "prefijo real del paquete de voz",
)
voice_manager = replace_once(
    voice_manager,
    "        const parts = normalized.split('/');\n        const relative = parts.length > 1 && /voice\\.json/i.test(manifestEntry.entryName) ? parts.slice(1).join('/') : normalized;",
    "        const relative = manifestPrefix && normalized.startsWith(manifestPrefix)\n          ? normalized.slice(manifestPrefix.length)\n          : normalized;",
    "rutas internas de voz sin aplanar",
)
voice_manager_path.write_text(voice_manager, encoding="utf-8")

html_path = ROOT / "src/index.html"
html = html_path.read_text(encoding="utf-8")
html = html.replace('id="versionLabel">v1.0.2', 'id="versionLabel">v1.0.3')
html = html.replace('id="updateVersionBadge">v1.0.2', 'id="updateVersionBadge">v1.0.3')
html = replace_once(
    html,
    "</div>\n<section class=\"privacy-direct-connections\"><span class=\"privacy-section-label\">A DÓNDE SE CONECTA CADA FUNCIÓN</span>",
    "</div>\n<section class=\"privacy-local-session\"><span class=\"privacy-section-label\">SI EL SERVIDOR FUERA ATACADO</span><h4>El relay no tiene permisos para leer datos de la aplicación</h4><p>Lulu Finity trata al servidor como una fuente no confiable. El canal de mensajes WebSocket es de recepción: la app no contiene una respuesta que permita al relay solicitar cookies, sesión, archivos, ajustes, credenciales ni información del dispositivo.</p><p>Solo se aceptan tipos exactos de eventos públicos del LIVE y únicamente sus campos necesarios. Solicitudes remotas, RPC, comandos, métodos, canales IPC, campos privados, paquetes binarios, redirecciones y cargas excesivas se rechazan. Si el servidor intenta pedir datos o repite mensajes inválidos, Lulu corta esa conexión.</p><p>Un relay comprometido todavía podría interrumpir el servicio o fabricar un evento público, haciendo que TTS, alertas u otras funciones configuradas reaccionen como si fuera real. No puede usar el protocolo para leer datos locales: el proceso principal filtra el mensaje antes de que llegue a la interfaz y la sesión de TikTok permanece en una partición aislada.</p></section>\n<section class=\"privacy-direct-connections\"><span class=\"privacy-section-label\">A DÓNDE SE CONECTA CADA FUNCIÓN</span>",
    "explicación de servidor comprometido",
)
html_path.write_text(html, encoding="utf-8")

relay_path = ROOT / "railway-relay/src/server.js"
relay = relay_path.read_text(encoding="utf-8")
relay = replace_once(
    relay,
    "const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });",
    "// El cliente oficial nunca envía mensajes de aplicación al relay.\nconst wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });",
    "WebSocket de servidor unidireccional",
)
relay = replace_once(
    relay,
    "  client.on('error', () => {});\n  session.start();",
    "  client.on('error', () => {});\n  client.on('message', () => {\n    try { client.close(1008, 'Canal de solo recepción'); } catch {}\n  });\n  session.start();",
    "rechazo de mensajes del cliente",
)
relay_path.write_text(relay, encoding="utf-8")

relay_package_path = ROOT / "railway-relay/package.json"
relay_package = json.loads(relay_package_path.read_text(encoding="utf-8"))
relay_package["dependencies"]["ws"] = "8.21.3"
relay_package_path.write_text(json.dumps(relay_package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8")
entry = """# Cambios

## 1.0.3

- Convierte el WebSocket del LIVE en un canal de confianza cero y solo recepción para la aplicación.
- El cliente nunca responde al relay con cookies, sesión de TikTok, archivos, ajustes, credenciales o datos del dispositivo.
- Acepta únicamente tipos exactos de eventos públicos y conserva solo los campos requeridos por comentarios, regalos, likes y actividad del LIVE.
- Rechaza solicitudes remotas, RPC, comandos, métodos, canales IPC, tipos desconocidos, paquetes binarios y cargas excesivas.
- Limita tamaño, frecuencia, texto, números, listas y URLs de cada evento antes de enviarlo a la interfaz.
- Endurece el contador de uso: sin redirecciones, máximo 32 KB y respuesta reducida a métricas numéricas permitidas.
- Añade pruebas de servidor malicioso, campos privados, URLs peligrosas, saturación y ausencia de respuestas WebSocket desde Lulu.
- Corrige el orden de inicialización que cerraba 1.0.2 antes de crear la ventana y añade una prueba real del ejecutable de Windows hasta que el renderer queda listo.

"""
if changelog.startswith("# Cambios\n"):
    changelog = entry + changelog[len("# Cambios\n\n"):]
else:
    changelog = entry + changelog
changelog_path.write_text(changelog, encoding="utf-8")

readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
readme += """

## Frontera de seguridad del relay

El WebSocket del LIVE es un canal de recepción con una lista cerrada de eventos públicos. El servidor no puede invocar IPC, pedir archivos, leer ajustes ni solicitar la sesión de TikTok. Lulu filtra y limita cada paquete en el proceso principal antes de entregarlo a la interfaz; una solicitud remota prohibida cierra la conexión. Un servidor comprometido aún podría fabricar un evento público, pero no leer datos locales mediante el protocolo.
"""
readme_path.write_text(readme, encoding="utf-8")
