from pathlib import Path
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.4":
    raise SystemExit(f"Lulu Finity 1.0.5 espera la fuente 1.0.4, no {package.get('version')}")
package["version"] = "1.0.5"
package["description"] = "Lulu Finity 1.0: LIVE y bot de voz persistentes con reconexión automática"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.5"
if isinstance(lock.get("packages", {}).get(""), dict):
    lock["packages"][""]["version"] = "1.0.5"
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for relative in (
    "src/live-reconnect-policy.js",
    "src/live-reconnect-policy.test.js",
    "railway-relay/src/persistence.test.js",
):
    source = HERE / "files" / relative
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

html_path = ROOT / "src/index.html"
html = html_path.read_text(encoding="utf-8")
html = replace_once(html, 'id="versionLabel">v1.0.4', 'id="versionLabel">v1.0.5', "versión de la barra")
html = replace_once(html, 'id="updateVersionBadge">v1.0.4', 'id="updateVersionBadge">v1.0.5', "versión de actualización")
html_path.write_text(html, encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8")
changelog = replace_once(
    changelog,
    "# Cambios\n\n## 1.0.4",
    """# Cambios

## 1.0.5

- Mantiene el LIVE y el bot de voz activos aunque el usuario cambie de categoría, minimice Lulu o use los perfiles Ahorro y Equilibrado.
- Recupera automáticamente cortes temporales de red, reinicios de Railway, cierres por inactividad y límites de duración del proveedor.
- Usa retroceso progresivo y un máximo de ocho intentos para evitar bucles de conexión y consumo innecesario de la cuota diaria.
- No reconecta cuando el usuario pulsa Desconectar, TikTok confirma que terminó el LIVE, se agota el límite diario o el relay rechaza el protocolo por seguridad.
- Elimina del relay el cierre explícito tras 300 segundos sin eventos, para que un LIVE tranquilo no desconecte al bot.
- Añade pruebas de política de reconexión, ciclo de vida en segundo plano y persistencia del relay.

## 1.0.4""",
    "notas 1.0.5",
)
changelog_path.write_text(changelog, encoding="utf-8")

main_path = ROOT / "src/main.js"
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    "const { MAX_RELAY_FRAME_BYTES, RelayProtocolError, parseRelayFrame, sanitizeRelayUsage } = require('./relay-protocol');",
    "const { MAX_RELAY_FRAME_BYTES, RelayProtocolError, parseRelayFrame, sanitizeRelayUsage } = require('./relay-protocol');\nconst { LIVE_RECONNECT_DELAYS_MS, shouldReconnectLive, liveReconnectDelay } = require('./live-reconnect-policy');",
    "política de reconexión",
)
main = replace_once(
    main,
    """let spotifyAutomationNonce = 0;
let spotifyAutomationTimer = null;
let liveConnectNonce = 0;""",
    """let spotifyAutomationNonce = 0;
let spotifyAutomationTimer = null;
let liveConnectNonce = 0;
let liveReconnectTimer = null;
let liveReconnectStableTimer = null;
let liveReconnectAttempt = 0;
let liveReconnectUsername = '';
let liveReconnectEnabled = false;
let liveReconnectHasConnected = false;
let liveReconnectInFlight = false;""",
    "estado persistente del LIVE",
)
main = replace_once(
    main,
    "if (moduleName === 'live') return Boolean(liveConnection);",
    "if (moduleName === 'live') return Boolean(liveConnection || liveReconnectEnabled || liveReconnectTimer || liveReconnectInFlight);",
    "protección del LIVE activo",
)

retry_anchor = """function shouldRetryConnection(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  return error?.code === 'TVS_TIMEOUT'
    || /econnreset|etimedout|eai_again|socket|websocket|handshake|502|503|504/.test(raw);
}
"""
reconnect_runtime = r"""
function clearLiveReconnectTimers() {
  if (liveReconnectTimer) clearTimeout(liveReconnectTimer);
  if (liveReconnectStableTimer) clearTimeout(liveReconnectStableTimer);
  liveReconnectTimer = null;
  liveReconnectStableTimer = null;
}

function stopLiveReconnectSession({ forgetUsername = true } = {}) {
  clearLiveReconnectTimers();
  liveReconnectEnabled = false;
  liveReconnectHasConnected = false;
  liveReconnectInFlight = false;
  liveReconnectAttempt = 0;
  if (forgetUsername) liveReconnectUsername = '';
}

function beginLiveReconnectSession(username) {
  stopLiveReconnectSession();
  liveReconnectUsername = cleanUsername(username);
  liveReconnectEnabled = Boolean(liveReconnectUsername);
}

function markLiveConnectionEstablished(connection, connectionNonce) {
  liveReconnectHasConnected = true;
  if (liveReconnectStableTimer) clearTimeout(liveReconnectStableTimer);
  liveReconnectStableTimer = setTimeout(() => {
    liveReconnectStableTimer = null;
    if (liveReconnectEnabled && connectionNonce === liveConnectNonce && liveConnection === connection && connection?.isConnected) {
      liveReconnectAttempt = 0;
    }
  }, 30_000);
  liveReconnectStableTimer.unref?.();
}

function scheduleLiveReconnect(connectionNonce, details = {}) {
  if (!liveReconnectEnabled || !liveReconnectHasConnected || isQuitting || connectionNonce !== liveConnectNonce) return false;
  if (!shouldReconnectLive({ code: details?.code, reason: details?.reason, shuttingDown: isQuitting })) {
    stopLiveReconnectSession();
    return false;
  }
  if (liveReconnectTimer || liveReconnectInFlight || liveConnection) return true;
  if (liveReconnectAttempt >= LIVE_RECONNECT_DELAYS_MS.length) {
    const username = liveReconnectUsername;
    stopLiveReconnectSession();
    send('live:status', {
      status: 'error',
      username,
      message: 'Lulu no pudo recuperar el LIVE después de varios intentos. Pulsa Conectar para volver a intentarlo.'
    });
    return false;
  }

  liveReconnectAttempt += 1;
  const attemptNumber = liveReconnectAttempt;
  const delay = liveReconnectDelay(attemptNumber);
  const username = liveReconnectUsername;
  send('live:status', {
    status: 'connecting',
    username,
    reconnecting: true,
    attempt: attemptNumber,
    message: `La conexión se interrumpió. Lulu la recuperará automáticamente en ${Math.max(1, Math.ceil(delay / 1000))} s…`
  });
  appendConnectionLog('automatic-reconnect-scheduled', {
    username,
    attemptNumber,
    delay,
    code: Number(details?.code || 0),
    reason: String(details?.reason || '')
  });

  liveReconnectTimer = setTimeout(async () => {
    liveReconnectTimer = null;
    if (!liveReconnectEnabled || isQuitting || connectionNonce !== liveConnectNonce || liveConnection) return;
    liveReconnectInFlight = true;
    try {
      const result = await createAndConnectLive(username, connectionNonce, attemptNumber + 1);
      if (!liveReconnectEnabled || connectionNonce !== liveConnectNonce || liveConnection !== result.connection) {
        await safeDisconnect(result.connection);
        return;
      }
      markLiveConnectionEstablished(result.connection, connectionNonce);
      appendConnectionLog('automatic-reconnect-succeeded', { username, attemptNumber, roomId: result.roomId });
      send('live:status', {
        status: 'connected',
        username,
        roomId: result.roomId,
        reconnected: true,
        message: 'Lulu recuperó la conexión al LIVE automáticamente.'
      });
    } catch (error) {
      const failedConnection = liveConnection;
      if (liveConnection === failedConnection) liveConnection = null;
      await safeDisconnect(failedConnection);
      appendConnectionLog('automatic-reconnect-failed', { username, attemptNumber, error });
      liveReconnectInFlight = false;
      if (liveReconnectEnabled && connectionNonce === liveConnectNonce) {
        scheduleLiveReconnect(connectionNonce, { code: error?.code || 1006, reason: error?.message || String(error) });
      }
      return;
    } finally {
      liveReconnectInFlight = false;
    }
  }, delay);
  liveReconnectTimer.unref?.();
  return true;
}
"""
main = replace_once(main, retry_anchor, retry_anchor + reconnect_runtime, "controlador de reconexión")
main = replace_once(
    main,
    """        const message = cloudCloseMessage(code, Buffer.isBuffer(reason) ? reason.toString('utf8') : reason);
        this.socket = null;""",
    """        const message = cloudCloseMessage(code, Buffer.isBuffer(reason) ? reason.toString('utf8') : reason);
        const closeError = new Error(message);
        closeError.code = Number(code) || 0;
        this.socket = null;""",
    "código del cierre remoto",
)
main = replace_once(main, "if (!settled) fail(new Error(message));", "if (!settled) fail(closeError);", "propagación del código remoto")
main = replace_once(
    main,
    """  connection.on(WebcastEvent.STREAM_END, () => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    send('live:status', { status: 'ended', message: 'El LIVE terminó.' });
  });""",
    """  connection.on(WebcastEvent.STREAM_END, () => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    stopLiveReconnectSession();
    liveConnection = null;
    void safeDisconnect(connection);
    send('live:status', { status: 'ended', message: 'El LIVE terminó.' });
  });""",
    "fin definitivo del LIVE",
)
main = replace_once(
    main,
    """      liveConnection = null;
      send('live:status', {
        status: 'disconnected',""",
    """      liveConnection = null;
      if (scheduleLiveReconnect(connectionNonce, details)) return;
      send('live:status', {
        status: 'disconnected',""",
    "recuperación tras desconexión",
)
main = replace_once(
    main,
    """async function disconnectLive(reason = 'manual') {
  liveConnectNonce += 1;""",
    """async function disconnectLive(reason = 'manual') {
  stopLiveReconnectSession();
  liveConnectNonce += 1;""",
    "cancelación manual de reconexión",
)
main = replace_once(
    main,
    """  const old = liveConnection;
  liveConnection = null;
  liveConnectNonce += 1;
  const connectionNonce = liveConnectNonce;
  await safeDisconnect(old);""",
    """  const old = liveConnection;
  stopLiveReconnectSession();
  liveConnection = null;
  liveConnectNonce += 1;
  const connectionNonce = liveConnectNonce;
  beginLiveReconnectSession(username);
  await safeDisconnect(old);""",
    "sesión de reconexión",
)
main = replace_once(
    main,
    """  } catch (error) {
    const message = `No se pudo cargar el conector de TikTok: ${error?.message || error}`;
    send('live:status', { status: 'error', username, message });""",
    """  } catch (error) {
    const message = `No se pudo cargar el conector de TikTok: ${error?.message || error}`;
    stopLiveReconnectSession();
    send('live:status', { status: 'error', username, message });""",
    "fallo al cargar el conector",
)
main = replace_once(
    main,
    """      appendConnectionLog('connected', { username, roomId: result.roomId, attemptNumber });
      send('live:status', payload);""",
    """      appendConnectionLog('connected', { username, roomId: result.roomId, attemptNumber });
      markLiveConnectionEstablished(result.connection, connectionNonce);
      send('live:status', payload);""",
    "conexión establecida",
)
main = replace_once(
    main,
    "if (connectionNonce === liveConnectNonce) liveConnection = null;",
    """if (connectionNonce === liveConnectNonce) {
    liveConnection = null;
    stopLiveReconnectSession();
  }""",
    "fallo definitivo al conectar",
)
main = replace_once(
    main,
    """function clearRuntimeAutomation() {
  liveConnectNonce += 1;""",
    """function clearRuntimeAutomation() {
  stopLiveReconnectSession();
  liveConnectNonce += 1;""",
    "cierre de automatización",
)
main = replace_once(main, "backgroundThrottling: true", "backgroundThrottling: false", "ejecución TTS en segundo plano")
main = replace_once(
    main,
    "live:Boolean(liveConnection), localTts:",
    "live:Boolean(liveConnection || liveReconnectEnabled), liveReconnect:{enabled:liveReconnectEnabled,attempt:liveReconnectAttempt,pending:Boolean(liveReconnectTimer || liveReconnectInFlight)}, localTts:",
    "estado visible de reconexión",
)
main_path.write_text(main, encoding="utf-8")

renderer_path = ROOT / "src/renderer.js"
renderer = renderer_path.read_text(encoding="utf-8")
renderer = replace_once(
    renderer,
    "if (!wasConnected && state.connected) void sendTikTokAutoChatEvent('liveConnected'",
    "if (!wasConnected && state.connected && !payload?.reconnected) void sendTikTokAutoChatEvent('liveConnected'",
    "evitar anuncio duplicado al reconectar",
)
renderer_path.write_text(renderer, encoding="utf-8")

relay_path = ROOT / "railway-relay/src/server.js"
relay = relay_path.read_text(encoding="utf-8")
relay = replace_once(
    relay,
    "      'features.syntheticPresence': 'true',\n      'features.closeInactiveWebSocketAfter': '300'",
    "      'features.syntheticPresence': 'true'",
    "LIVE sin cierre por silencio",
)
relay_path.write_text(relay, encoding="utf-8")

print("Lulu Finity 1.0.5 reconstruida con LIVE persistente y reconexión automática")
