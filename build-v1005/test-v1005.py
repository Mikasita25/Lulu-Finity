from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
main = (ROOT / "src/main.js").read_text(encoding="utf-8")
renderer = (ROOT / "src/renderer.js").read_text(encoding="utf-8")
html = (ROOT / "src/index.html").read_text(encoding="utf-8")
relay = (ROOT / "railway-relay/src/server.js").read_text(encoding="utf-8")
policy = (ROOT / "src/live-reconnect-policy.js").read_text(encoding="utf-8")
policy_test = (ROOT / "src/live-reconnect-policy.test.js").read_text(encoding="utf-8")
changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")

assert package["version"] == "1.0.5"
assert lock["version"] == "1.0.5"
assert lock["packages"][""]["version"] == "1.0.5"
assert 'id="versionLabel">v1.0.5' in html
assert 'id="updateVersionBadge">v1.0.5' in html
assert "## 1.0.5" in changelog
assert (ROOT / "src/live-reconnect-policy.test.js").is_file()
assert (ROOT / "railway-relay/src/persistence.test.js").is_file()

for token in (
    "LIVE_RECONNECT_DELAYS_MS",
    "let liveReconnectTimer = null",
    "let liveReconnectStableTimer = null",
    "function stopLiveReconnectSession",
    "function beginLiveReconnectSession",
    "function markLiveConnectionEstablished",
    "function scheduleLiveReconnect",
    "automatic-reconnect-scheduled",
    "automatic-reconnect-succeeded",
    "automatic-reconnect-failed",
    "scheduleLiveReconnect(connectionNonce, details)",
    "markLiveConnectionEstablished(result.connection, connectionNonce)",
    "closeError.code = Number(code) || 0",
    "backgroundThrottling: false",
    "live:Boolean(liveConnection || liveReconnectEnabled)",
    "stopLiveReconnectSession();\n  liveConnectNonce += 1;",
):
    assert token in main, token

assert main.count("stopLiveReconnectSession();") >= 5
assert "backgroundThrottling: true" not in main
assert "live:Boolean(liveConnection), localTts:" not in main
assert "!payload?.reconnected" in renderer
assert "features.closeInactiveWebSocketAfter" not in relay
assert "client.on('pong'" in relay
assert "client.ping()" in relay

for token in (
    "1006, 1011, 1012, 1013, 4006, 4500, 4555, 4556, 4557",
    "1000, 1008, 4005, 4400, 4401, 4403, 4404, 4429",
):
    assert token in policy_test, token
for token in ("manuallyStopped || streamEnded || shuttingDown", "120_000"):
    assert token in policy, token

for forbidden in (
    "setInterval(connectLive",
    "while (liveReconnectEnabled)",
    "LIVE_RECONNECT_DELAYS_MS.length + 1",
):
    assert forbidden not in main, forbidden

assert re.search(r"connection\.on\(WebcastEvent\.STREAM_END,.*?stopLiveReconnectSession\(\);.*?safeDisconnect\(connection\)", main, re.S)
assert re.search(r"async function disconnectLive.*?stopLiveReconnectSession\(\);.*?liveConnectNonce \+= 1", main, re.S)

print("Lulu Finity 1.0.5: persistencia LIVE, segundo plano y reconexión limitada validados")
