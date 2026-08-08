from pathlib import Path
import json
import re
import sys
import wave


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app")
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "1.0.1"

html = (ROOT / "src/index.html").read_text(encoding="utf-8")
renderer = (ROOT / "src/renderer.js").read_text(encoding="utf-8")
main = (ROOT / "src/main.js").read_text(encoding="utf-8")
preload = (ROOT / "src/preload.js").read_text(encoding="utf-8")

assert 'id="versionLabel">v1.0.1' in html
assert 'id="updateVersionBadge">v1.0.1' in html
assert 'value="ja"' not in html and 'value="ko"' not in html
assert "catálogo gratuito completo" in html

assert "voiceLocaleLabel" in renderer
assert "onlineVoiceSearchText" in renderer
assert "Gratis online ·" in renderer
assert "api.listOnlineVoices({ refresh: showToast })" in renderer
assert "if(page==='voice'&&!state.loadedPages.has(page)){void loadLocalVoices();void loadOnlineVoices(false);}" in renderer
assert "voiceMode==='online')void loadOnlineVoices(false)" not in renderer

assert "prepareOnlineVoices" in main
assert "online-voice-catalog-v1.json" in main
assert "readOnlineVoiceCatalogCache" in main
assert "listOnlineVoices(options = {})" in main
assert "listOnlineVoices(options)" in main
assert "tts:install-local-voice" in main
assert "listOnlineVoices: (options = {})" in preload
assert "installLocalVoice: (id)" in preload
assert "install-local-voice" in renderer
assert "Voz Oficial instalada" in renderer

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"
assert (ROOT / "src/online-voice-catalog.js").exists()
assert (ROOT / "src/online-voice-catalog.test.js").exists()
assert (ROOT / "src/clone-runtime-manager.js").exists()

voice_root = ROOT / "resources/voices/lulu-official"
manifest = json.loads((voice_root / "voice.json").read_text(encoding="utf-8"))
assert manifest["name"] == "Voz Oficial De Lulu Finity"
assert manifest["type"] == "openvoice-v2"
assert manifest["format"] == "lulu-local-v2"
assert manifest["engine"]["baseVoiceId"] == "lulu-es-mx"
assert manifest["engine"]["runtime"]["url"].startswith("https://github.com/Mikasita25/Lulu-Finity/releases/download/v1.0.1/")
assert re.fullmatch(r"[0-9a-f]{64}", manifest["engine"]["runtime"]["sha256"])
with wave.open(str(voice_root / "reference.wav"), "rb") as sample:
    assert sample.getnchannels() == 1
    assert sample.getsampwidth() == 2
    assert sample.getframerate() == 22050
    duration = sample.getnframes() / sample.getframerate()
    assert 6.5 <= duration <= 7.5

engine_script = Path(__file__).resolve().parent / "engine/lulu-clone-engine.py"
assert engine_script.exists()
print(f"Lulu Finity {package['version']}: catálogo TTS y {len(ids)} IDs validados")
