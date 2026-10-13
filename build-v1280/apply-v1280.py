from pathlib import Path
import json, sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()

def exact(name, before, after):
    path = root / name
    data = path.read_text(encoding='utf-8')
    if data.count(before) != 1:
        raise RuntimeError(f'{name}: se esperaba un solo punto de cambio: {before[:100]} (hay {data.count(before)})')
    path.write_text(data.replace(before, after, 1), encoding='utf-8')

for name in ['package.json', 'package-lock.json']:
    path = root / name
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('version') != '1.2.7':
        raise RuntimeError(f'{name}: se requiere la fuente original 1.2.7')
    data['version'] = '1.2.8'
    if name == 'package-lock.json':
        if data['packages'][''].get('version') != '1.2.7':
            raise RuntimeError('package-lock no corresponde a 1.2.7')
        data['packages']['']['version'] = '1.2.8'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

recovery = r'''function startSystemSpeechNow(text, voiceConfig, token, finish, item = null, speedMultiplier = 1) {
  if (!('speechSynthesis' in window) || token !== state.speechToken) { finish(false); return; }
  const tuning = speechTuning(voiceConfig, speedMultiplier);
  const engine = window.speechSynthesis;
  let active = true;
  let started = false;
  let retried = false;
  let attempt = 0;
  let nudgeTimer = null;
  let retryTimer = null;
  const clearTimers = () => {
    clearTimeout(nudgeTimer);
    clearTimeout(retryTimer);
    nudgeTimer = null;
    retryTimer = null;
  };
  const cleanup = () => {
    if (!active) return;
    active = false;
    clearTimers();
    if (state.systemSpeechRecoveryCancel === cleanup) state.systemSpeechRecoveryCancel = null;
  };
  state.systemSpeechRecoveryCancel?.();
  state.systemSpeechRecoveryCancel = cleanup;
  const speak = () => {
    if (!active || token !== state.speechToken) { cleanup(); return; }
    started = false;
    const currentAttempt = ++attempt;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = currentSystemVoice(voiceConfig?.mode === 'system' ? voiceConfig.voiceURI : '');
    if (voice) utterance.voice = voice;
    utterance.rate = tuning.rate;
    utterance.pitch = tuning.pitch;
    utterance.volume = tuning.volume;
    utterance.onstart = () => {
      if (!active || currentAttempt !== attempt || token !== state.speechToken) return;
      started = true;
      clearTimers();
      markSpeechStarted(item);
    };
    utterance.onend = () => {
      if (!active || currentAttempt !== attempt || token !== state.speechToken) return;
      cleanup();
      finish(true);
    };
    utterance.onerror = () => {
      if (!active || currentAttempt !== attempt || token !== state.speechToken) return;
      cleanup();
      finish(false);
    };
    try {
      if (engine.paused) engine.resume();
      engine.speak(utterance);
    } catch {
      cleanup();
      finish(false);
      return;
    }
    // Chromium puede dejar una voz en espera aunque ya exista texto para leer.
    // El temporizador se activa sin exigir otro evento del chat.
    nudgeTimer = setTimeout(() => {
      if (!active || started || currentAttempt !== attempt || token !== state.speechToken) return;
      try { engine.resume(); } catch {}
    }, 900);
    retryTimer = setTimeout(() => {
      if (!active || started || currentAttempt !== attempt || token !== state.speechToken) return;
      if (!retried) {
        retried = true;
        clearTimers();
        attempt += 1; // Invalidar los eventos tardíos del intento cancelado.
        try { engine.cancel(); } catch {}
        speak();
      } else {
        cleanup();
        finish(false);
      }
    }, 9000);
  };
  speak();
}
'''
path = root / 'src/renderer.js'
source = path.read_text(encoding='utf-8')
start = source.find('function startSystemSpeechNow(')
end = source.find('\nfunction runSpeechNow(', start)
if start < 0 or end < 0 or source.count('function startSystemSpeechNow(') != 1:
    raise RuntimeError('No se encontró el motor de voz Windows esperado.')
source = source[:start] + recovery.rstrip() + source[end:]
path.write_text(source, encoding='utf-8')

exact('src/renderer.js',
      'async function synthesizeSpeechData(text, voiceConfig, speedMultiplier = 1) {',
      '''function withSpeechTimeout(promise, ms = 25000) {
  let timeout;
  const limit = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('El motor de voz tardó demasiado en responder.')), ms);
  });
  return Promise.race([Promise.resolve(promise), limit]).finally(() => clearTimeout(timeout));
}

async function synthesizeSpeechData(text, voiceConfig, speedMultiplier = 1) {''')
exact('src/renderer.js',
      "const preparedState = speechItem?.preparedPromise ? await speechItem.preparedPromise : { ok:true, prepared:await synthesizeSpeechData(text, voiceConfig, speedMultiplier) };",
      "const preparedState = await withSpeechTimeout(speechItem?.preparedPromise || synthesizeSpeechData(text, voiceConfig, speedMultiplier));")
exact('src/renderer.js',
      '      state.onlineAudio = null;\n      state.speechPlaybackStarted = false;',
      '      state.systemSpeechRecoveryCancel?.();\n      state.onlineAudio = null;\n      state.speechPlaybackStarted = false;')
exact('src/renderer.js',
      '        await audio.play();\n        markSpeechStarted(speechItem);',
      '        await withSpeechTimeout(audio.play(), 12000);\n        markSpeechStarted(speechItem);')
exact('src/renderer.js',
      "        const title = voiceMode === 'local' ?",
      """        if (state.onlineAudio) {
          try { state.onlineAudio.pause(); state.onlineAudio.src = ''; } catch {}
          state.onlineAudio = null;
        }
        const title = voiceMode === 'local' ?""")
exact('src/renderer.js',
      'function stopCurrentAudio() {\n  state.speechToken += 1;',
      'function stopCurrentAudio() {\n  state.speechToken += 1;\n  state.systemSpeechRecoveryCancel?.();')
exact('src/renderer.js', '  speakNext();\n  return { added:true };',
      '  // Cada comentario inicia el TTS por sí solo, sin depender de uno posterior.\n  speakNext();\n  return { added:true };')

exact('src/index.html', 'v1.2.7', 'v1.2.8')

tests = Path(__file__).parent / 'files' / 'src'
for file in tests.iterdir():
    (root / 'src' / file.name).write_bytes(file.read_bytes())
print('Lulu Finity 1.2.8: recuperación autónoma de la voz y tiempos máximos de preparación')
