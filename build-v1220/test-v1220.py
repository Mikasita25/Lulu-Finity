from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
renderer = read("src/renderer.js")
styles = read("src/styles.css")
index = read("src/index.html")
changelog = read("CHANGELOG.md")
main = read("src/main.js")

require(package.get("version") == "1.2.2", "package.json no quedó en 1.2.2")
require(lock.get("version") == "1.2.2", "package-lock.json no quedó en 1.2.2")
require(lock.get("packages", {}).get("", {}).get("version") == "1.2.2", "lock raíz no quedó en 1.2.2")
require("v1.2.2" in index, "la interfaz no muestra 1.2.2")
require("## 1.2.2" in changelog, "falta changelog 1.2.2")
require("'1.2.2': Object.freeze([" in renderer, "faltan notas 1.2.2")

for token in (
    "const volume = Math.max(0, Math.min(1, Number(action?.volume ?? .9)))",
    "automation-action-volume-input",
    "automation-action-volume",
    "action.volume=Math.max(0,Math.min(1,Number(e.target.value??.9)))",
    "mediaVolume:Math.max(0,Math.min(1,Number(selected.volume??.9)))",
):
    require(token in renderer, f"falta control de volumen: {token}")

require(".automation-action-volume{" in styles, "faltan estilos del volumen por acción")
require("@media(max-width:720px){.automation-action-volume" in styles, "falta adaptación responsive del volumen")

# No debe perderse la estabilidad ni el updater reparado de 1.2.1.
for token in ("lastPayloadAt:0", "youtubeAdMuteFailsafeTimer", "45000, 20000", "checkUpdatesOnStartup: true", "autoUpdater.allowDowngrade = false"):
    require(token in main, f"regresión respecto a 1.2.1: {token}")

publish = package.get("build", {}).get("publish", [])
require(any(item.get("provider") == "github" and item.get("owner") == "Mikasita25" and item.get("repo") == "Lulu-Finity" for item in publish if isinstance(item, dict)), "electron-builder no apunta al release oficial")

print("Lulu Finity 1.2.2 validada: volumen por acción sin regresiones de 1.2.1")
