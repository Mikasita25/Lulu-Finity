from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app")
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "1.0.0"
assert package["dependencies"]["sherpa-onnx-node"] == "1.13.4"
assert package["dependencies"]["adm-zip"] == "0.5.16"

html = (ROOT / "src/index.html").read_text(encoding="utf-8")
renderer = (ROOT / "src/renderer.js").read_text(encoding="utf-8")
main = (ROOT / "src/main.js").read_text(encoding="utf-8")
preload = (ROOT / "src/preload.js").read_text(encoding="utf-8")

required_html = (
    "featureSearchInput", "Biblioteca local", "localVoiceImportBtn",
    "pronunciationDictionaryInput", "blockCjkTextInput",
    "performanceProfile", "releaseIdleResourcesBtn", "text-processor.js",
)
for token in required_html:
    assert token in html, token

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"

for token in ("synthesizeLocalVoice", "smartTextOptions", "activatePageModules", "setupFeatureSearch"):
    assert token in renderer, token
for token in ("LocalVoiceManager", "runtime:status", "tts:synthesize-local", "backgroundThrottling: true"):
    assert token in main, token
for token in ("listLocalVoices", "releaseIdleResources", "setActivePage"):
    assert token in preload, token

assert "adBlockWarmup" not in main
assert "overlay: await overlayInfo" not in main
assert renderer.count("void loadOnlineVoices(false)") == 1
assert "voiceMode==='online')void loadOnlineVoices(false)" in renderer
assert (ROOT / "resources/voices/lulu-es-mx/voice.json").exists()
print(f"Lulu Finity {package['version']}: {len(ids)} IDs únicos y carga diferida validada")
