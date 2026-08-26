from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def require(path, token):
    text = (ROOT / path).read_text(encoding="utf-8")
    if token not in text:
        raise SystemExit(f"Falta {token!r} en {path}")
    return text


package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "1.1.2", package["version"]

main = require("src/main.js", "tunnelRecoveryDelay")
for token in [
    "probeTunnelUrl",
    "scheduleOverlayTunnelRecovery",
    "verifyOverlayHttpsTunnel",
    "startOverlayTunnelHealthMonitor",
    "Reconectando HTTPS automáticamente",
    "HTTPS listo y protegido con recuperación automática",
    "overlayTunnelWanted = true"
]:
    assert token in main, token
assert "Pulsa copiar para reintentarlo" not in main

index = require("src/index.html", "preview-panel.js")
assert "preview-panel.css" in index
assert "frame-src 'self' http://127.0.0.1:*" in index
assert "Lulu Finity 1.1.2" in index
assert "v1.1.2" in index

preview = require("src/preview-panel.js", "Vista previa")
for token in ["Usuario 1", "Meta", "Chat simulado", "Pantalla del stream", "getStreamWidgetInfo", "getRankingInfo", "getOverlayInfo"]:
    assert token in preview, token

css = require("src/preview-panel.css", ".lf-preview-overlay-layout")
assert ".lf-preview-chat-phone" in css

health = require("src/overlay-tunnel-health.js", "RECOVERY_DELAYS_MS")
assert "30000" in health

print("Lulu Finity 1.1.2: HTTPS autorrecuperable y vista previa local validados")
