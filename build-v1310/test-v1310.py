from pathlib import Path
import gzip, json, re, sys
root = Path(sys.argv[1] if len(sys.argv)>1 else "app")
assert json.loads((root/"package.json").read_text(encoding="utf-8"))["version"] == "1.3.1"
assert json.loads((root/"package-lock.json").read_text(encoding="utf-8"))["packages"][""]["version"] == "1.3.1"
renderer=(root/"src/renderer.js").read_text(encoding="utf-8")
assert "withSpeechTimeout(promise, ms = 3500)" in renderer
assert "await withSpeechTimeout(audio.play(), 2500)" in renderer
voice=renderer.split("function startSystemSpeechNow(",1)[1].split("\nfunction runSpeechNow(",1)[0]
assert voice.count("}, 300);")==1 and voice.count("}, 2400);")==1
for file in ("src/main.js", "railway-relay/src/overlay-page.js"):
    code=(root/file).read_text(encoding="utf-8")
    assert re.search(r"function showColorRoulette\s*\(\s*data\s*\)\s*\{",code)
    assert "rouletteFrame && rouletteFrame.isConnected && roulettePayload" in code
    assert "scheduleRouletteMedia(data);return;" in code
for file in ("src/roulette.html.gz", "railway-relay/src/roulette.html.gz"):
    html=gzip.decompress((root/file).read_bytes()).decode()
    assert "Math.min(3,baseKeys.length)" in html
    assert "Promise.all([0,1,2].map(j=>loadLayer(" in html
    assert "lastFrame=frame" in html
assert (root/"src/index.html").read_text(encoding="utf-8").count("v1.3.1")>=1
print("Lulu Finity 1.3.1: cambios de rendimiento verificados")
