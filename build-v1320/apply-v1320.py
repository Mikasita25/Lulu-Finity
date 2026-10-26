from pathlib import Path
import json
import sys

root = Path(sys.argv[1]).resolve()
renderer = root / 'src/renderer.js'
code = renderer.read_text(encoding='utf-8')

def replace(old, new):
    global code
    if code.count(old) != 1:
        raise RuntimeError('Anclaje inesperado: ' + old[:100])
    code = code.replace(old, new, 1)

replace('function runSpeechNow(text, isQueue = false, queueId = null, voiceConfig = null, speechItem = null) {', '''// Libera la cola si Chromium deja de avanzar y no emite ended ni error.
function monitorSpeechAudio(audio, onStalled, onEnded) {
  let lastPosition = Number(audio.currentTime) || 0;
  let lastProgress = Date.now();
  let active = true;
  const timer = setInterval(() => {
    if (!active) return;
    const position = Number(audio.currentTime) || 0;
    if (audio.ended) { stop(); onEnded(); return; }
    if (position > lastPosition + 0.02) {
      lastPosition = position;
      lastProgress = Date.now();
    } else if (Date.now() - lastProgress >= 8000) {
      stop();
      onStalled();
    }
  }, 1000);
  function stop() { if (active) { active = false; clearInterval(timer); } }
  return stop;
}
function runSpeechNow(text, isQueue = false, queueId = null, voiceConfig = null, speechItem = null) {''')
replace('    let finished = false;\n    const finish = (success, reason = \'\') => {', '    let finished = false;\n    let stopAudioMonitor = null;\n    const finish = (success, reason = \'\') => {')
replace('      finished = true;\n      state.systemSpeechRecoveryCancel?.();', '      finished = true;\n      stopAudioMonitor?.();\n      stopAudioMonitor = null;\n      state.systemSpeechRecoveryCancel?.();')
replace('        audio.onplaying = () => markSpeechStarted(speechItem);', '''        const startAudioMonitor = () => {
          markSpeechStarted(speechItem);
          if (!stopAudioMonitor) stopAudioMonitor = monitorSpeechAudio(audio, () => {
            if (finished || token !== state.speechToken) return;
            audio.onabort = null;
            audio.onerror = null;
            try { audio.pause(); audio.src = ''; } catch {}
            finish(false, 'audio de voz detenido; se continuó con la cola');
          }, () => finish(true));
        };
        audio.onplaying = startAudioMonitor;''')
replace('        await withSpeechTimeout(audio.play(), 2500);\n        markSpeechStarted(speechItem);', '        await withSpeechTimeout(audio.play(), 2500);\n        if (!finished && token === state.speechToken) startAudioMonitor();')
replace("  state.speaking = true;\n  renderStats();\n  const queued = speakText(item.text, true, item.id, item.voice,", """  state.speaking = true;
  // Si otro sonido ocupa el reproductor, Microsoft puede generar la voz
  // en paralelo mientras el comentario espera su turno.
  if (state.audioBusy && !item.preparedPromise && (item.voice?.mode || state.settings.voiceMode) === 'online') {
    item.preparedPromise = synthesizeSpeechData(item.text, item.voice, item.speedMultiplier)
      .then(prepared => ({ ok:true, prepared }))
      .catch(error => ({ ok:false, error }));
  }
  renderStats();
  const queued = speakText(item.text, true, item.id, item.voice,""")
renderer.write_text(code, encoding='utf-8')

for name in ('package.json', 'package-lock.json'):
    path = root / name
    data = json.loads(path.read_text(encoding='utf-8'))
    if data['version'] != '1.3.1': raise RuntimeError('Se necesita la versión 1.3.1')
    data['version'] = '1.3.2'
    if name == 'package-lock.json': data['packages']['']['version'] = '1.3.2'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

html = root / 'src/index.html'
content = html.read_text(encoding='utf-8')
if content.count('v1.3.1') != 1: raise RuntimeError('Versión de interfaz inesperada')
html.write_text(content.replace('v1.3.1', 'v1.3.2'), encoding='utf-8')
print('Protección de la cola de voz instalada')
