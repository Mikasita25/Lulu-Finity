from pathlib import Path
import json
import re
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
replacements = {
    "EMBEDDED_RELAY_URL": "const EMBEDDED_RELAY_URL = LULU_SERVER_ORIGIN.replace(/^http/, 'ws') + '/v1/tiktok/live';",
    "RELAY_USAGE_URL": "const RELAY_USAGE_URL = LULU_SERVER_ORIGIN + '/usage';",
    "STABLE_OVERLAY_BASE_URL": "const STABLE_OVERLAY_BASE_URL = LULU_SERVER_ORIGIN;"
}
if "const LULU_SERVER_ORIGIN =" in main:
    raise RuntimeError("La constante del servidor ya existe; revisar la versión base")
for constant, replacement in replacements.items():
    pattern = re.compile(r"(?m)^const " + re.escape(constant) + r" = .*?;$")
    main, found = pattern.subn(lambda match: replacement, main)
    if found != 1:
        raise RuntimeError(f"No se encontró una única declaración de {constant}: {found}")
anchor = "// Un mismo origen para TikTok LIVE, consumo, TTS y fuentes HTTPS.\n" + "const LULU_SERVER_ORIGIN = '" + server + "';\n"
main = main.replace("const EMBEDDED_RELAY_URL =", anchor + "const EMBEDDED_RELAY_URL =", 1)
main_path.write_text(main, encoding="utf-8")

html_path = root / "src/index.html"
html = html_path.read_text(encoding="utf-8")
if "v1.2.4" in html:
    html_path.write_text(html.replace("v1.2.4", "v1.2.5"), encoding="utf-8")
print("Lulu Finity 1.2.5: servidor principal unificado y actualizador listo.")
