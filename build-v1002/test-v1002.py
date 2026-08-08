from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app")
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
html = (ROOT / "src/index.html").read_text(encoding="utf-8")
styles = (ROOT / "src/styles.css").read_text(encoding="utf-8")
main = (ROOT / "src/main.js").read_text(encoding="utf-8")
preload = (ROOT / "src/preload.js").read_text(encoding="utf-8")
renderer = (ROOT / "src/renderer.js").read_text(encoding="utf-8")
catalog = (ROOT / "src/tiktok-voice-catalog.js").read_text(encoding="utf-8")
client = (ROOT / "src/tiktok-tts-client.js").read_text(encoding="utf-8")
notice = (ROOT / "NOTICE.md").read_text(encoding="utf-8")

assert package["version"] == "1.0.2"
assert lock["version"] == "1.0.2"
assert lock["packages"][""]["version"] == "1.0.2"
assert package.get("dependencies", {}).get("edge-tts-universal") == "1.4.0"
assert "node_modules/edge-tts-universal" in lock.get("packages", {})
assert 'id="versionLabel">v1.0.2' in html
assert 'id="updateVersionBadge">v1.0.2' in html

required_layout_rules = (
    "grid-template-rows:40px minmax(0,1fr)",
    ".main-content{grid-column:2;grid-row:2;min-width:0;min-height:0;height:100%;overflow-y:auto",
    ".nav-list{min-height:0;overflow-y:auto;overflow-x:hidden",
    ".modal-card{max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow-y:auto",
    ".feature-search-results{max-height:min(340px,calc(100dvh - 140px))",
)
for rule in required_layout_rules:
    assert rule in styles, rule

for token in (
    "getTikTokTtsCookieHeader",
    "session.fromPartition(TIKTOK_CHAT_PARTITION)",
    "synthesizeTikTokVoice",
    "normalizeVoiceSettings",
    "removeRetiredVoiceEngine",
    "getEdgeTtsModule",
    "listOnlineVoices",
    "synthesizeOnlineVoice",
    "tts:list-tiktok-voices",
    "tts:synthesize-tiktok",
    "tts:list-online-voices",
    "tts:synthesize-online",
    "hardenTikTokSession",
    "setPermissionRequestHandler",
    "setPermissionCheckHandler",
    "will-download",
    "will-navigate",
    "page-title-updated",
    "tikTokOriginSummary",
    "getTikTokSessionSummary",
    "activeRuntimeModules",
    "releaseInactiveMusicProvider",
    "scheduleYoutubeResolverRelease",
    "setYoutubeVolume",
    "setSpotifyVolume",
):
    assert token in main, token
for token in ("TIKTOK_TTS_ENDPOINTS", "requestTikTokSpeech", "text_speaker", "sessionid="):
    assert token in client, token

for token in ("listTikTokVoices", "synthesizeTikTokVoice", "listOnlineVoices", "synthesizeOnlineVoice"):
    assert token in preload, token
for token in ("TikTok · ${category}", "tiktok:${voice.id}", "Microsoft online", "online:${voice.shortName}", "loadOnlineVoices", "Voz de TikTok no disponible", "Voz Microsoft no disponible", "privacyResetTikTokBtn"):
    assert token in renderer, token
for voice_id in ("es_mx_002", "en_us_002", "en_us_stitch", "en_us_stormtrooper", "en_us_c3po"):
    assert voice_id in catalog, voice_id

for retired in (
    ROOT / "resources/voices/lulu-official",
    ROOT / "src/clone-runtime-manager.js",
    ROOT / "src/clone-runtime-manager.test.js",
):
    assert not retired.exists(), retired
assert (ROOT / "resources/voices/lulu-es-mx/voice.json").exists()
assert (ROOT / "src/online-voice-catalog.js").exists()
assert (ROOT / "src/online-voice-catalog.test.js").exists()
assert (ROOT / "src/tiktok-voice-catalog.test.js").exists()
assert (ROOT / "src/tiktok-tts-client.test.js").exists()

combined = "\n".join((main, preload, renderer, html, notice, json.dumps(package)))
for retired_token in ("Voz Oficial De Lulu Finity", "OpenVoice"):
    assert retired_token not in combined, retired_token

for security_copy in (
    "DOMINIO OFICIAL",
    "Tu contraseña solo va a TikTok",
    "Sesión solo en esta PC",
    "Permisos bloqueados",
    "Desvincular y borrar sesión",
    "Railway no recibe tu sesión",
    "La única finalidad del servidor de Lulú es la API WebSocket del LIVE",
    "El inicio de sesión y la sesión de tu cuenta de TikTok no pasan por este servidor",
    "LO QUE SÍ USA EL WEBSOCKET",
    "LO QUE NUNCA SE ENVÍA AL SERVIDOR DE LULÚ",
    "A DÓNDE SE CONECTA CADA FUNCIÓN",
    "El relay reenvía los eventos a tu aplicación en tiempo real",
    "voces de Microsoft",
):
    assert security_copy in html, security_copy

assert styles.count("Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical") == 1

# Regresión de recursos: abrir Lulu y permanecer en Música no debe despertar
# funciones no utilizadas ni crear los dos reproductores web a la vez.
startup = re.search(r"app\.whenReady\(\)\.then\(async \(\) => \{(.*?)\n\}\);", main, re.S)
assert startup, "No se encontró el arranque de Electron"
for forbidden in ("getLocalVoiceManager(", "startOverlayServer(", "connectLive(", "createYoutubeWindow(", "createSpotifyWindow("):
    assert forbidden not in startup.group(1), f"Arranque ansioso: {forbidden}"

renderer_init = re.search(r"async function init\(\) \{(.*?)\n\}\n\ninit\(\)", renderer, re.S)
assert renderer_init, "No se encontró init del renderer"
for forbidden in ("loadLocalVoices(", "loadSystemVoices(", "publishAutomationWidgets(", "setYouTubeVolume(", "setSpotifyVolume("):
    assert forbidden not in renderer_init.group(1), f"Renderer ansioso: {forbidden}"

assert "economy: null" in main
assert "localTts:localVoiceManager?" in main
assert "if (!activeRuntimeModules.has('rankings') && rankingClientCount() === 0) return;" in main
assert "!state.loadedPages.has('automations')" in renderer
assert "if(!hasActiveAudioActivity())return" in renderer
assert "if (youtubeWindow && !youtubeWindow.isDestroyed()) void ensureYoutubeNetworkAdBlocker();" in main
youtube_adblock_setter = re.search(r"function setYoutubeNetworkAdBlockEnabled\(enabled\) \{(.*?)\n\}", main, re.S)
assert youtube_adblock_setter
assert "session.fromPartition(YOUTUBE_PARTITION);\n  if (!youtubeAdBlockEnabled)" not in youtube_adblock_setter.group(1)
assert "ipcMain.handle('youtube:set-volume', async (_event, volume) => setYoutubeVolume(volume));" in main
assert "ipcMain.handle('spotify:set-volume', async (_event, volume) => setSpotifyVolume(volume));" in main
assert "getAutomationEngine().evaluateAutomations" in main
assert "getLiveGameManagerClass()" in main and "getLocalVoiceManagerClass()" in main
assert "youtubeResolverIdleTimer=setTimeout" in main and ",15000)" in main
for eager_import in (
    "const { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');",
    "const { TIKTOK_VOICES, isTikTokVoiceId } = require('./tiktok-voice-catalog');",
    "const { requestTikTokSpeech } = require('./tiktok-tts-client');",
):
    assert eager_import not in main, eager_import
for lazy_getter in ("getOnlineVoiceCatalog()", "getTikTokVoiceCatalog()", "getTikTokTtsClient()"):
    assert lazy_getter in main, lazy_getter
for module_label in ("Rankings", "Automatizaciones", "Juegos", "Economía"):
    assert f"['{module_label}'" in renderer, module_label

changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
assert "## 1.0.2" in changelog
assert "más de 70 voces auténticas de TikTok" in changelog
assert "Conserva las voces online de Microsoft/Edge" in changelog
assert "carga bajo demanda" in changelog

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"

print(f"Lulu Finity {package['version']}: carga bajo demanda, Microsoft, TikTok seguro y scroll validados con {len(ids)} IDs")
