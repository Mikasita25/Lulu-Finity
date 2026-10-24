from pathlib import Path
import gzip
import json
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()

def replace_exact(name, previous, current, count=1):
    file = root / name
    text = file.read_text(encoding="utf-8")
    matches = text.count(previous)
    if matches != count:
        raise RuntimeError(f"{name}: se esperaban {count} anclajes; hay {matches}: {previous[:90]}")
    file.write_text(text.replace(previous, current), encoding="utf-8")

for name in ("package.json", "package-lock.json"):
    file = root / name
    doc = json.loads(file.read_text(encoding="utf-8"))
    if doc["version"] != "1.3.0":
        raise RuntimeError(f"{name}: la base debe ser 1.3.0")
    doc["version"] = "1.3.1"
    if name == "package-lock.json":
        if doc["packages"][""]["version"] != "1.3.0":
            raise RuntimeError("package-lock de version diferente")
        doc["packages"][""]["version"] = "1.3.1"
    file.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Los proveedores de voz online no deben detener el chat durante ocho segundos.
# Cuando un proveedor se atasca, el fallback existente a la voz del sistema actua antes.
replace_exact("src/renderer.js",
              "function withSpeechTimeout(promise, ms = 8000) {",
              "function withSpeechTimeout(promise, ms = 3500) {")
replace_exact("src/renderer.js",
              "await withSpeechTimeout(audio.play(), 5000);",
              "await withSpeechTimeout(audio.play(), 2500);")

# Recuperacion autonoma del sintetizador de Windows, sin esperar un nuevo comentario.
renderer = root / "src/renderer.js"
code = renderer.read_text(encoding="utf-8")
start = code.find("function startSystemSpeechNow(")
end = code.find("\nfunction runSpeechNow(", start)
if start < 0 or end <= start or code.count("function startSystemSpeechNow(") != 1:
    raise RuntimeError("No se encontro la rutina de voz Windows")
section = code[start:end]
for old, new in (("}, 900);", "}, 300);"), ("}, 4000);", "}, 2400);")):
    if section.count(old) != 1:
        raise RuntimeError(f"Temporizador no localizado o ambiguo: {old}")
    section = section.replace(old, new)
renderer.write_text(code[:start] + section + code[end:], encoding="utf-8")

# La rueda conserva exactamente los mismos frames, texturas y velocidad.
# Carga tres capas a la vez en lugar de esperar la decodificacion serial de 20+ capas.
old_ready = ("const ready=(async()=>{for(const key of Object.keys(ASSETS).filter("
             "key=>!key.startsWith('winner_'))){await loadLayer(key);"
             "await new Promise(resolve=>setTimeout(resolve,0));}})();")
new_ready = (
    "const ready=(async()=>{"
    "const baseKeys=Object.keys(ASSETS).filter(key=>!key.startsWith('winner_'));"
    "let nextKey=0;"
    "const worker=async()=>{while(nextKey<baseKeys.length){"
    "const key=baseKeys[nextKey++];"
    "await loadLayer(key);"
    "await new Promise(resolve=>setTimeout(resolve,0));"
    "}};"
    "await Promise.all(Array.from({length:Math.min(3,baseKeys.length)},()=>worker()));"
    "})();"
)
old_winner = "for(let j=0;j<3;j++)await loadLayer('winner_'+color+'_'+j);"
new_winner = "await Promise.all([0,1,2].map(j=>loadLayer('winner_'+color+'_'+j)));"
for name in ("src/roulette.html.gz", "railway-relay/src/roulette.html.gz"):
    file = root / name
    html = gzip.decompress(file.read_bytes()).decode("utf-8")
    for old, new in ((old_ready, new_ready), (old_winner, new_winner)):
        if html.count(old) != 1:
            raise RuntimeError(f"{name}: motor de ruleta inesperado: {old[:70]}")
        html = html.replace(old, new, 1)
    file.write_bytes(gzip.compress(html.encode("utf-8"), mtime=0))

# No reiniciar un iframe que ya esta girando por una actualizacion redundante
# de Railway, websocket o polling. Mantiene el mismo ID, giro y reloj.
guard = (
    "\n  if (rouletteFrame && rouletteFrame.isConnected && roulettePayload && data && "
    "data.visible !== false && Number(data.expiresAt)>Date.now() && "
    "String(roulettePayload.id||'')!=='' && "
    "String(roulettePayload.id||'')===String(data.id||'') && "
    "Number(roulettePayload.animationStartedAt)===Number(data.animationStartedAt) && "
    "Number(roulettePayload.rouletteIndex)===Number(data.rouletteIndex)) {"
    "scheduleRouletteMedia(data);return;}"
)
for name in ("src/main.js", "railway-relay/src/overlay-page.js"):
    file = root / name
    code = file.read_text(encoding="utf-8")
    code, count = re.subn(r"(function showColorRoulette\s*\(\s*data\s*\)\s*\{)",
                          lambda m: m.group(1) + guard, code, count=1)
    if count != 1:
        raise RuntimeError(f"{name}: showColorRoulette no encontrado")
    file.write_text(code, encoding="utf-8")

# Las pruebas de la version anterior deben conservar su significado,
# pero reflejar los nuevos limites de inicio y fallback.
file = root / "src/speech-start-recovery.test.js"
suite = file.read_text(encoding="utf-8")
changes = (("h.fire(900);", "h.fire(300);", 1),
           ("h.fire(4000);", "h.fire(2400);", 2),
           ("withSpeechTimeout\\(audio\\.play\\(\\), 5000\\)",
            "withSpeechTimeout\\(audio\\.play\\(\\), 2500\\)", 1))
for old, new, expected in changes:
    if suite.count(old) != expected:
        raise RuntimeError(f"Prueba de recuperacion inesperada: {old} = {suite.count(old)}")
    suite = suite.replace(old, new)
file.write_text(suite, encoding="utf-8")

replace_exact("src/index.html", "v1.3.0", "v1.3.1")
print("1.3.1: voz con fallback mas agil; ruleta concurrente y sin reinicios duplicados")
