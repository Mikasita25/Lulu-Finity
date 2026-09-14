from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
renderer = read("src/renderer.js")
styles = read("src/styles.css")
html = read("src/index.html")
changelog = read("CHANGELOG.md")

assert package["version"] == "1.1.9"
assert lock["version"] == "1.1.9"
assert lock["packages"][""]["version"] == "1.1.9"
assert "v1.1.9" in html
assert "## 1.1.9" in changelog
assert "'1.1.9': Object.freeze([" in renderer

assert "const volume = Math.max(0, Math.min(1, Number(action?.volume ?? .9)))" in renderer
assert "automation-action-volume-input" in renderer
assert "automation-action-volume" in renderer
assert "action.volume=Math.max(0,Math.min(1,Number(e.target.value??.9)))" in renderer
assert "mediaVolume:Math.max(0,Math.min(1,Number(selected.volume??.9)))" in renderer
assert ".automation-action-volume{" in styles
assert "@media(max-width:720px){.automation-action-volume" in styles

print("Lulu Finity 1.1.9 validada: volumen por acción visible, persistente e independiente")
