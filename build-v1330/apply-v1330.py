#!/usr/bin/env python3
"""Lulu Finity 1.3.3: route Windows LIVE, TTS and overlays to the new Railway relay."""
from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
old_origin = "https://lulu-finity-production.up.railway.app"
new_origin = "https://lulu-finity-relay-production.up.railway.app"

main_path = root / "src" / "main.js"
main = main_path.read_text(encoding="utf-8")

# The application already derives LIVE websocket, usage, TTS, and stable
# overlay URLs from the single LULU_SERVER_ORIGIN constant.
pattern = re.compile(
    r"(?m)^(const LULU_SERVER_ORIGIN\s*=\s*['\"])" +
    re.escape(old_origin) + r"(['\"];[ \t]*)$"
)
main, changes = pattern.subn(lambda m: m.group(1) + new_origin + m.group(2), main)
if changes != 1:
    raise RuntimeError("Expected exactly one old LULU_SERVER_ORIGIN; check source version")
for name in ("EMBEDDED_RELAY_URL", "RELAY_USAGE_URL", "STABLE_OVERLAY_BASE_URL"):
    if not re.search(r"(?m)^const " + name + r"\s*=\s*.*LULU_SERVER_ORIGIN", main):
        raise RuntimeError(name + " must continue to derive from LULU_SERVER_ORIGIN")
main_path.write_text(main, encoding="utf-8")

for name in ("package.json", "package-lock.json"):
    path = root / name
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") != "1.3.2":
        raise RuntimeError(name + ": expected Lulu Finity 1.3.2")
    data["version"] = "1.3.3"
    if name == "package-lock.json":
        if data["packages"][""].get("version") != "1.3.2":
            raise RuntimeError("package-lock root version must be 1.3.2")
        data["packages"][""]["version"] = "1.3.3"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

html_path = root / "src" / "index.html"
html = html_path.read_text(encoding="utf-8")
if html.count("v1.3.2") != 1:
    raise RuntimeError("Expected one v1.3.2 UI version label")
html_path.write_text(html.replace("v1.3.2", "v1.3.3", 1), encoding="utf-8")
print("Lulu Finity 1.3.3 now uses the new Railway relay for LIVE, TTS, and overlays.")
