from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
server = "https://lulu-finity-production.up.railway.app"

for filename in ("package.json", "package-lock.json"):
    path = root / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") != "1.2.4":
        raise RuntimeError(f"{filename}: se esperaba la version 1.2.4")
    data["version"] = "1.2.5"
    if filename == "package-lock.json":
        if data["packages"][""].get("version") != "1.2.4":
            raise RuntimeError("package-lock: version principal inesperada")
        data["packages"][""]["version"] = "1.2.5"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

main_path = root / "src/main.js"
main = main_path.read_text(encoding="utf-8")
old = """const EMBEDDED_RELAY_URL = 'wss://lulu-finity-production.up.railway.app/v1/tiktok/live';
const EMBEDDED_RELAY_CLIENT_TOKEN = '__LULU_RELAY_CLIENT_TOKEN__';
const RELAY_USAGE_URL = 'https://lulu-finity-production.up.railway.app/usage';
const STABLE_OVERLAY_BASE_URL = 'https://lulu-finity-production.up.railway.app';"""
new = """// Un mismo origen para TikTok LIVE, consumo, TTS y fuentes HTTPS.
const LULU_SERVER_ORIGIN = 'https://lulu-finity-production.up.railway.app';
const EMBEDDED_RELAY_URL = LULU_SERVER_ORIGIN.replace(/^http/, 'ws') + '/v1/tiktok/live';
const EMBEDDED_RELAY_CLIENT_TOKEN = '__LULU_RELAY_CLIENT_TOKEN__';
const RELAY_USAGE_URL = LULU_SERVER_ORIGIN + '/usage';
const STABLE_OVERLAY_BASE_URL = LULU_SERVER_ORIGIN;"""
if main.count(old) != 1:
    raise RuntimeError("No se encontró la configuración del relay esperada")
main_path.write_text(main.replace(old, new, 1), encoding="utf-8")

html_path = root / "src/index.html"
html = html_path.read_text(encoding="utf-8")
if "v1.2.4" in html:
    html_path.write_text(html.replace("v1.2.4", "v1.2.5"), encoding="utf-8")
print("Lulu Finity 1.2.5: servidor principal unificado y actualizador listo.")
