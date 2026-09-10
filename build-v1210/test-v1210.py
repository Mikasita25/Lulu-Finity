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
require(package.get("version") == "1.2.1", "package.json no quedó en 1.2.1")
require(lock.get("version") == "1.2.1", "package-lock.json no quedó en 1.2.1")
require(lock.get("packages", {}).get("", {}).get("version") == "1.2.1", "lock raíz no quedó en 1.2.1")

main = read("src/main.js")
for token in (
    "lastPayloadAt:0",
    "recovery.lastPayloadAt = now;",
    "mutationMaintenanceTimer",
    "shouldRecoverPlayback({ ...recovery, visible:win?.isVisible?.() === true, destroyed:Boolean(win?.isDestroyed?.()) }, now, 45000, 20000)",
    "recovery.recoveryAttempt >= 3",
    "youtubeAdMuteFailsafeTimer",
    "no llegó confirmación de anuncio",
):
    require(token in main, f"falta corrección musical: {token}")

require("attributes:true, attributeFilter:['class','style','aria-label']" not in main, "sigue activo el observador intensivo de YouTube")
recover_block = main[main.index("function recoverActiveMusicPlayers"):main.index("function startMusicRecoveryWatchdog")]
require("scheduleMusicPlayerRecovery(provider, reason, true)" not in recover_block, "reanudar tras suspensión todavía fuerza recarga")
require("recovery.recoveryAttempt >= 1);" not in main, "el watchdog todavía escala demasiado pronto a recarga")

renderer = read("src/renderer.js")
require("'1.2.1': Object.freeze([" in renderer, "faltan notas de versión 1.2.1")
index = read("src/index.html")
require("v1.2.1" in index, "la interfaz no muestra 1.2.1")
require("v1.2.0" not in index, "quedó una etiqueta visible 1.2.0 en index.html")

publish = package.get("build", {}).get("publish", [])
require(any(item.get("provider") == "github" and item.get("owner") == "Mikasita25" and item.get("repo") == "Lulu-Finity" for item in publish if isinstance(item, dict)), "electron-builder no apunta al release oficial")
require("checkUpdatesOnStartup: true" in main, "la búsqueda automática de updates no está habilitada por defecto")
require("autoUpdater.checkForUpdates()" in main, "el cliente ya no consulta electron-updater")
require("autoUpdater.allowDowngrade = false" in main, "la política de versiones cambió inesperadamente")

print("Lulu Finity 1.2.1 validada: música y updater listos")
