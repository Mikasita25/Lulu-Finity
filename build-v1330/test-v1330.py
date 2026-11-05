#!/usr/bin/env python3
"""Regression checks for the Windows desktop relay migration."""
from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
main = (root / "src" / "main.js").read_text(encoding="utf-8")
expected = "https://lulu-finity-relay-production.up.railway.app"
old = "https://lulu-finity-production.up.railway.app"

assert re.search(
    r"(?m)^const LULU_SERVER_ORIGIN\s*=\s*['\"]" +
    re.escape(expected) + r"['\"];",
    main
), "LULU_SERVER_ORIGIN does not point to the new Railway relay"
assert "const LULU_SERVER_ORIGIN = '" + old + "';" not in main, "Old relay still selected"
assert "const EMBEDDED_RELAY_URL = LULU_SERVER_ORIGIN.replace(/^http/, 'ws') + '/v1/tiktok/live';" in main
assert "const RELAY_USAGE_URL = LULU_SERVER_ORIGIN + '/usage';" in main
assert "const STABLE_OVERLAY_BASE_URL = LULU_SERVER_ORIGIN;" in main
# Never write the Railway API keys or CLIENT_TOKENS into the repository.
for name in ("EULER_API_KEYS", "CLIENT_TOKENS"):
    assert not re.search(r"(?m)^const " + name + r"\s*=\s*\[", main), "Hardcoded credential array"

for path in ("package.json", "package-lock.json"):
    data = json.loads((root / path).read_text(encoding="utf-8"))
    assert data["version"] == "1.3.3", path + " version mismatch"
    if path == "package-lock.json":
        assert data["packages"][""]["version"] == "1.3.3"

html = (root / "src" / "index.html").read_text(encoding="utf-8")
assert "v1.3.3" in html
print("PASS: LIVE, TTS, and overlays derive from the new relay origin; version 1.3.3.")
