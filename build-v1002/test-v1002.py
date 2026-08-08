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
    "voces de Microsoft",
):
    assert security_copy in html, security_copy

assert styles.count("Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical") == 1
changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
assert "## 1.0.2" in changelog
assert "más de 70 voces auténticas de TikTok" in changelog
assert "Conserva las voces online de Microsoft/Edge" in changelog

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"

print(f"Lulu Finity {package['version']}: Microsoft, TikTok seguro, motor retirado y scroll validados con {len(ids)} IDs")
