from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app")
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
html = (ROOT / "src/index.html").read_text(encoding="utf-8")
styles = (ROOT / "src/styles.css").read_text(encoding="utf-8")

assert package["version"] == "1.0.2"
assert lock["version"] == "1.0.2"
assert lock["packages"][""]["version"] == "1.0.2"
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

assert styles.count("Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical") == 1
assert "## 1.0.2" in (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"

# Regresiones de 1.0.1: el hotfix de interfaz no debe retirar las voces.
assert (ROOT / "resources/voices/lulu-official/voice.json").exists()
assert (ROOT / "resources/voices/lulu-es-mx/voice.json").exists()
assert (ROOT / "src/online-voice-catalog.js").exists()
assert (ROOT / "src/clone-runtime-manager.js").exists()

print(f"Lulu Finity {package['version']}: scroll adaptable y {len(ids)} IDs validados")
