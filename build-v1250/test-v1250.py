from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
package = json.loads((root / "package.json").read_text(encoding="utf-8"))
lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
assert package["version"] == "1.2.5"
assert lock["version"] == lock["packages"][""]["version"] == "1.2.5"
main = (root / "src/main.js").read_text(encoding="utf-8")
assert main.count("const LULU_SERVER_ORIGIN = 'https://lulu-finity-production.up.railway.app';") == 1
assert "const EMBEDDED_RELAY_URL = LULU_SERVER_ORIGIN.replace(/^http/, 'ws') + '/v1/tiktok/live';" in main
assert "const RELAY_USAGE_URL = LULU_SERVER_ORIGIN + '/usage';" in main
assert "const STABLE_OVERLAY_BASE_URL = LULU_SERVER_ORIGIN;" in main
assert main.count("const EMBEDDED_RELAY_CLIENT_TOKEN = ") == 1
assert "autoUpdater.checkForUpdates()" in main
assert "autoUpdater.quitAndInstall(false, true)" in main
assert "colorRoulette" in main and "showColorRoulette" in main
assert (root / "src/roulette.html.gz").exists()
assert (root / "railway-relay/src/roulette.html.gz").exists()
print("1.2.5: version, servidor, actualizaciones y ruleta verificados.")
