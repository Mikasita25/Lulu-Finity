from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
MAIN = ROOT / "src" / "main.js"


def read():
    return MAIN.read_text(encoding="utf-8")


def write(text):
    MAIN.write_text(text, encoding="utf-8", newline="\n")


def replace_once(old, new, label):
    text = read()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"No se pudo aplicar {label}: se esperaba 1 coincidencia y hubo {count}")
    write(text.replace(old, new, 1))


replace_once(
    "const { tunnelRecoveryDelay, probeTunnelUrl } = require('./overlay-tunnel-health');",
    "const { tunnelRecoveryDelay, probeTunnelUrl } = require('./overlay-tunnel-health');\nconst { StableOverlayRelay } = require('./stable-overlay-relay');",
    "cliente del relay estable"
)

replace_once(
    "const RELAY_USAGE_URL = 'https://lulu-finity-production.up.railway.app/usage';",
    "const RELAY_USAGE_URL = 'https://lulu-finity-production.up.railway.app/usage';\nconst RELAY_OVERLAY_BASE_URL = 'https://lulu-finity-production.up.railway.app';",
    "base HTTPS estable"
)

replace_once(
    "let overlayTunnelStatus = { status: 'idle', message: 'Enlace HTTPS pendiente.', url: '' };\nlet appSuspensionBlockerId = null;",
    "let overlayTunnelStatus = { status: 'idle', message: 'Enlace HTTPS pendiente.', url: '' };\nlet stableOverlayRelay = null;\nconst stableOverlaySources = new Map();\nconst stableOverlaySyncTimers = new Map();\nlet stableOverlayHeartbeatTimer = null;\nlet appSuspensionBlockerId = null;",
    "estado del relay de overlays"
)

stable_functions = r'''
function stableOverlaySourceKey(kind, id) {
  const normalizedKind = String(kind || '');
  if (normalizedKind === 'widget') return `widget:${normalizeStreamWidgetType(id)}`;
  if (normalizedKind === 'ranking') return `ranking:${normalizeRankingSlot(id)}`;
  return `overlay:${normalizeOverlayScreen(id)}`;
}

function stableOverlaySourceCount(kind = '') {
  if (!kind) return stableOverlaySources.size;
  const prefix = `${String(kind)}:`;
  return [...stableOverlaySources.keys()].filter((key) => key.startsWith(prefix)).length;
}

function stableOverlaySourceActive(kind, id) {
  return stableOverlaySources.has(stableOverlaySourceKey(kind, id));
}

function getStableOverlayRelay() {
  if (!stableOverlayRelay) stableOverlayRelay = new StableOverlayRelay({
    baseUrl: RELAY_OVERLAY_BASE_URL,
    clientToken: EMBEDDED_RELAY_CLIENT_TOKEN,
    fetchImpl: fetch,
    fs,
    appVersion: app.getVersion()
  });
  return stableOverlayRelay;
}

async function stableOverlayPayload(kind, id, includeHtml = false, explicitMediaPath = '') {
  const token = await overlayIdentity();
  const key = stableOverlaySourceKey(kind, id);
  if (kind === 'widget') {
    const type = normalizeStreamWidgetType(id);
    const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
    const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
    const theme = themes[type];
    const background = backgrounds[type];
    return {
      token, source:key,
      html: includeHtml ? streamWidgetHtml(type, token, false, theme, background) : undefined,
      state: { ...(await streamWidgetSnapshot(type, false)), theme, background },
      mediaPath:''
    };
  }
  if (kind === 'ranking') {
    const slot = normalizeRankingSlot(id);
    return { token, source:key, html:includeHtml ? rankingHtml(slot, token, false) : undefined, state:await rankingSnapshot(slot, false), mediaPath:'' };
  }
  const screen = normalizeOverlayScreen(id);
  const state = overlayStateSnapshot(screen);
  let mediaPath = String(explicitMediaPath || '');
  if (!mediaPath && state?.type === 'show') {
    const match = String(state.url || '').match(/\/overlay-media\/([^?]+)/);
    if (match) {
      try {
        const candidate = path.join(getDataPaths().media, path.basename(decodeURIComponent(match[1])));
        if (fs.existsSync(candidate)) mediaPath = candidate;
      } catch {}
    }
  }
  return { token, source:key, html:includeHtml ? overlayHtml(screen, token) : undefined, state, mediaPath };
}

async function publishStableOverlaySource(kind, id, { includeHtml = false, mediaPath = '' } = {}) {
  const payload = await stableOverlayPayload(kind, id, includeHtml, mediaPath);
  await getStableOverlayRelay().publish(payload);
  const key = stableOverlaySourceKey(kind, id);
  stableOverlaySources.set(key, { kind:String(kind), id, lastSuccessAt:Date.now() });
  startStableOverlayHeartbeat();
  setOverlayTunnelStatus('ready', 'HTTPS estable de Lulu listo. El dominio no cambia aunque cloudflared se cierre.', RELAY_OVERLAY_BASE_URL);
  refreshAppSuspensionBlocker();
  return { ok:true, status:'ready', message:overlayTunnelStatus.message, url:RELAY_OVERLAY_BASE_URL, stable:true };
}

function scheduleStableOverlaySync(kind, id, mediaPath = '') {
  const key = stableOverlaySourceKey(kind, id);
  if (!stableOverlaySources.has(key) || isQuitting) return;
  const previous = stableOverlaySyncTimers.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(async () => {
    stableOverlaySyncTimers.delete(key);
    if (!stableOverlaySources.has(key) || isQuitting) return;
    try {
      await publishStableOverlaySource(kind, id, { includeHtml:false, mediaPath });
    } catch (error) {
      console.warn('[overlay-relay] No se pudo sincronizar', key, error?.message || error);
      setOverlayTunnelStatus('recovering', 'El servidor estable se está reconectando. La URL pública se mantiene igual.', RELAY_OVERLAY_BASE_URL);
    }
  }, 80);
  timer.unref?.();
  stableOverlaySyncTimers.set(key, timer);
}

function startStableOverlayHeartbeat() {
  if (stableOverlayHeartbeatTimer || isQuitting) return;
  stableOverlayHeartbeatTimer = setInterval(async () => {
    if (isQuitting || !stableOverlaySources.size) return;
    for (const source of [...stableOverlaySources.values()]) {
      try { await publishStableOverlaySource(source.kind, source.id, { includeHtml:true }); }
      catch (error) {
        console.warn('[overlay-relay] Heartbeat falló:', error?.message || error);
        setOverlayTunnelStatus('recovering', 'El servidor estable se está reconectando. La URL pública se mantiene igual.', RELAY_OVERLAY_BASE_URL);
      }
    }
  }, 25000);
  stableOverlayHeartbeatTimer.unref?.();
}

async function publicOverlayTransport(kind, id, force = false) {
  if (force) {
    try { return await publishStableOverlaySource(kind, id, { includeHtml:true }); }
    catch (stableError) {
      console.warn('[overlay-relay] Se usará Quick Tunnel como respaldo:', stableError?.message || stableError);
      const fallback = await ensureOverlayHttpsTunnel(true);
      if (!fallback.ok) fallback.message = `Servidor estable: ${stableError?.message || stableError}. ${fallback.message || ''}`.trim();
      return fallback;
    }
  }
  if (stableOverlaySourceActive(kind, id)) {
    return { ok:true, status:'ready', message:'HTTPS estable de Lulu activo.', url:RELAY_OVERLAY_BASE_URL, stable:true };
  }
  return currentOverlayTunnelInfo();
}

'''

replace_once(
    "function normalizeTunnelBaseUrl(value) {",
    stable_functions + "function normalizeTunnelBaseUrl(value) {",
    "funciones del relay estable"
)

replace_once(
    "  if (moduleName === 'rankings') return rankingClientCount() > 0 || Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);\n  if (moduleName === 'overlays') return overlayClientCount() + streamWidgetClientCount() > 0 || Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);",
    "  if (moduleName === 'rankings') return rankingClientCount() > 0 || stableOverlaySourceCount('ranking') > 0 || Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);\n  if (moduleName === 'overlays') return overlayClientCount() + streamWidgetClientCount() > 0 || stableOverlaySourceCount('widget') + stableOverlaySourceCount('overlay') > 0 || Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);",
    "retención de módulos con HTTPS estable"
)

replace_once(
    "  return Boolean(liveConnection || liveReconnectEnabled || liveReconnectTimer || liveReconnectInFlight || (overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed));",
    "  return Boolean(liveConnection || liveReconnectEnabled || liveReconnectTimer || liveReconnectInFlight || stableOverlaySources.size > 0 || (overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed));",
    "bloqueo de suspensión para fuentes públicas"
)

replace_once(
    "  streamWidgetStates.set(normalized, state);\n  send('widget:update', { widget: normalized, snapshot: state });\n  return state;",
    "  streamWidgetStates.set(normalized, state);\n  send('widget:update', { widget: normalized, snapshot: state });\n  scheduleStableOverlaySync('widget', normalized);\n  return state;",
    "sincronización de widgets"
)

old_widget_info = '''async function streamWidgetInfo(type = 'playlist', forceTunnel = false) {
  activateRuntimeModule('overlays');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalized = normalizeStreamWidgetType(type);
  const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
  const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
  const theme = themes[normalized];
  const background = backgrounds[normalized];
  const localUrl = streamWidgetUrl(normalized, token, localOverlayBaseUrl(), theme, background);
  const tunnel = forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo();
  const url = tunnel.ok && tunnel.url ? streamWidgetUrl(normalized, token, tunnel.url, theme, background) : '';
  return {
    ok: Boolean(url), widget: normalized, theme, background, url, localUrl, previewUrl: `${localUrl}&preview=1`,
    connected: streamWidgetClientCount(normalized), totalConnected: streamWidgetClientCount(),
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    snapshot: await streamWidgetSnapshot(normalized, false), port: overlayPort
  };
}'''
new_widget_info = '''async function streamWidgetInfo(type = 'playlist', forceTunnel = false) {
  activateRuntimeModule('overlays');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalized = normalizeStreamWidgetType(type);
  const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
  const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
  const theme = themes[normalized];
  const background = backgrounds[normalized];
  const localUrl = streamWidgetUrl(normalized, token, localOverlayBaseUrl(), theme, background);
  const tunnel = await publicOverlayTransport('widget', normalized, forceTunnel);
  const url = tunnel.ok && tunnel.url ? streamWidgetUrl(normalized, token, tunnel.url, theme, background) : '';
  const stableConnected = stableOverlaySourceActive('widget', normalized) ? 1 : 0;
  return {
    ok: Boolean(url), widget: normalized, theme, background, url, localUrl, previewUrl: `${localUrl}&preview=1`,
    connected: streamWidgetClientCount(normalized) + stableConnected, totalConnected: streamWidgetClientCount() + stableOverlaySourceCount('widget'),
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    snapshot: await streamWidgetSnapshot(normalized, false), port: overlayPort
  };
}'''
replace_once(old_widget_info, new_widget_info, "URLs estables de widgets")

replace_once(
    "  send('ranking:update', { snapshots, totalConnected: rankingClientCount() });\n}",
    "  send('ranking:update', { snapshots, totalConnected: rankingClientCount() + stableOverlaySourceCount('ranking') });\n  for (let slot = 1; slot <= 4; slot += 1) if (stableOverlaySourceActive('ranking', slot)) scheduleStableOverlaySync('ranking', slot);\n}",
    "sincronización de rankings"
)

old_ranking_info = '''async function rankingInfo(slot = 1, forceTunnel = false) {
  activateRuntimeModule('rankings');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalizedSlot = normalizeRankingSlot(slot);
  const localUrl = rankingUrl(normalizedSlot, token, localOverlayBaseUrl());
  const tunnel = forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo();
  const url = tunnel.ok && tunnel.url ? rankingUrl(normalizedSlot, token, tunnel.url) : '';
  return {
    ok: Boolean(url),
    slot: normalizedSlot,
    url,
    localUrl,
    previewUrl: `${localUrl}&preview=1`,
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    connected: rankingClientCount(normalizedSlot),
    totalConnected: rankingClientCount(),
    snapshot: await rankingSnapshot(normalizedSlot, false),
    port: overlayPort
  };
}'''
new_ranking_info = '''async function rankingInfo(slot = 1, forceTunnel = false) {
  activateRuntimeModule('rankings');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalizedSlot = normalizeRankingSlot(slot);
  const localUrl = rankingUrl(normalizedSlot, token, localOverlayBaseUrl());
  const tunnel = await publicOverlayTransport('ranking', normalizedSlot, forceTunnel);
  const url = tunnel.ok && tunnel.url ? rankingUrl(normalizedSlot, token, tunnel.url) : '';
  const stableConnected = stableOverlaySourceActive('ranking', normalizedSlot) ? 1 : 0;
  return {
    ok: Boolean(url),
    slot: normalizedSlot,
    url,
    localUrl,
    previewUrl: `${localUrl}&preview=1`,
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    connected: rankingClientCount(normalizedSlot) + stableConnected,
    totalConnected: rankingClientCount() + stableOverlaySourceCount('ranking'),
    snapshot: await rankingSnapshot(normalizedSlot, false),
    port: overlayPort
  };
}'''
replace_once(old_ranking_info, new_ranking_info, "URLs estables de rankings")

old_overlay_info = '''async function overlayInfo(screen = 1, forceTunnel = false) {
  activateRuntimeModule('overlays');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalized = normalizeOverlayScreen(screen);
  const localUrl = overlayUrl(normalized, token, localOverlayBaseUrl());
  const tunnel = forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo();
  const url = tunnel.ok && tunnel.url ? overlayUrl(normalized, token, tunnel.url) : '';
  return {
    ok: Boolean(url),
    screen: normalized,
    url,
    localUrl,
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    connected: overlayClientCount(normalized),
    totalConnected: overlayClientCount(),
    port: overlayPort
  };
}'''
new_overlay_info = '''async function overlayInfo(screen = 1, forceTunnel = false) {
  activateRuntimeModule('overlays');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalized = normalizeOverlayScreen(screen);
  const localUrl = overlayUrl(normalized, token, localOverlayBaseUrl());
  const tunnel = await publicOverlayTransport('overlay', normalized, forceTunnel);
  const url = tunnel.ok && tunnel.url ? overlayUrl(normalized, token, tunnel.url) : '';
  const stableConnected = stableOverlaySourceActive('overlay', normalized) ? 1 : 0;
  return {
    ok: Boolean(url),
    screen: normalized,
    url,
    localUrl,
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    connected: overlayClientCount(normalized) + stableConnected,
    totalConnected: overlayClientCount() + stableOverlaySourceCount('overlay'),
    port: overlayPort
  };
}'''
replace_once(old_overlay_info, new_overlay_info, "URLs estables de superposiciones")

replace_once(
    "  const clients = overlayClientCount(screen);\n  if (!clients) return { ok: false, message: `La Superposición ${screen} no está conectada al stream. Agrega su enlace HTTPS o local como fuente.` };",
    "  const clients = overlayClientCount(screen);\n  const stableConnected = stableOverlaySourceActive('overlay', screen);\n  if (!clients && !stableConnected) return { ok: false, message: `La Superposición ${screen} no está conectada al stream. Agrega su enlace HTTPS o local como fuente.` };",
    "detección de overlay remoto"
)

replace_once(
    "  const delivered = broadcastOverlay(screen, payload);\n  return { ok: clients > 0, delivered: Math.max(delivered, clients), screen, message: '' };",
    "  const delivered = broadcastOverlay(screen, payload);\n  if (stableConnected) scheduleStableOverlaySync('overlay', screen, mediaPath);\n  return { ok: clients > 0 || stableConnected, delivered: Math.max(delivered, clients, stableConnected ? 1 : 0), screen, message: '' };",
    "publicación de medios remotos"
)

replace_once(
    "ipcMain.handle('overlay:clear', async (_event, details) => { const screen = normalizeOverlayScreen(details?.screen); const payload = setOverlayState(screen, { type:'clear', id:randomUUID() }); const delivered = broadcastOverlay(screen, payload); return { ok: overlayClientCount(screen) > 0, delivered, screen }; });",
    "ipcMain.handle('overlay:clear', async (_event, details) => { const screen = normalizeOverlayScreen(details?.screen); const payload = setOverlayState(screen, { type:'clear', id:randomUUID() }); const delivered = broadcastOverlay(screen, payload); const stableConnected=stableOverlaySourceActive('overlay',screen); if(stableConnected)scheduleStableOverlaySync('overlay',screen); return { ok: overlayClientCount(screen) > 0 || stableConnected, delivered:Math.max(delivered,stableConnected?1:0), screen }; });",
    "limpieza de overlay remoto"
)

replace_once(
    "    if(key==='overlays'||key==='rankings')return Boolean(overlayClientCount()+rankingClientCount()+streamWidgetClientCount()>0||(overlayPublicBaseUrl&&overlayTunnelProcess&&!overlayTunnelProcess.killed));",
    "    if(key==='overlays'||key==='rankings')return Boolean(overlayClientCount()+rankingClientCount()+streamWidgetClientCount()>0||stableOverlaySources.size>0||(overlayPublicBaseUrl&&overlayTunnelProcess&&!overlayTunnelProcess.killed));",
    "protección de recursos para relay estable"
)

print("Lulu Finity 1.1.2: overlays públicos migrados al relay HTTPS estable")
