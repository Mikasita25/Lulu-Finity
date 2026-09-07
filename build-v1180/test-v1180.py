from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
main = read("src/main.js")
renderer = read("src/renderer.js")
commands = read("src/command-matching-policy.js")
music = read("src/music-recovery-policy.js")
command_tests = read("src/command-matching-policy.test.js")
music_tests = read("src/music-recovery-policy.test.js")
html = read("src/index.html")
changelog = read("CHANGELOG.md")

assert package["version"] == "1.1.8"
assert lock["version"] == "1.1.8"
assert lock["packages"][""]["version"] == "1.1.8"
assert "v1.1.8" in html
assert "## 1.1.8" in changelog
assert "'1.1.8': Object.freeze([" in renderer

# YouTube must no longer observe style/class/aria-label churn across the whole page.
assert "mutationMaintenanceTimer" in main
assert "observer.observe(document.documentElement, { childList:true, subtree:true });" in main
assert "attributes:true, attributeFilter:['class','style','aria-label']" not in main
assert "clearTimeout(mutationMaintenanceTimer)" in main

# Music recovery must use fresh player telemetry and softer recovery after resume.
assert "lastPayloadAt:0" in main
assert "recovery.lastPayloadAt = now" in main
assert "now, 30000, 12000" in main
assert "scheduleMusicPlayerRecovery(provider, reason, false)" in main
assert "lastPayloadAt" in music
assert "stallAfterMs = 30000" in music
assert "silenceAfterMs = 12000" in music
assert "distingue silencio del reproductor" in music_tests

# Railway/TikTok upstream interruptions must transition to the reconnect path.
assert "this.emit(C.DISCONNECTED || 'disconnected', { reason, code:1006, upstream:true });" in main
assert "void safeDisconnect(connection);" in main
assert "transportHealthTimer" in main
assert "railway-transport-stale" in main
assert "this.socket.on('ping'" in main
assert "75000" in main

# Command recognition must tolerate common Unicode exclamation variants.
assert "LEADING_COMMAND_BANGS" in commands
assert "\\ufe0e\\ufe0f" in commands
for marker in ("❗", "❕", "‼", "﹗"):
    assert marker in commands
assert "signos de exclamación de TikTok" in command_tests

print("Lulu Finity 1.1.8 validada: reproducción ligera, reconexión upstream y comandos Unicode")
