from pathlib import Path
import json, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
rp = ROOT/'src/renderer.js'
hp = ROOT/'src/index.html'
pkgp = ROOT/'package.json'
cp = ROOT/'CHANGELOG.md'

r = rp.read_text(encoding='utf-8')
h = hp.read_text(encoding='utf-8')

voice_marker = "function currentSystemVoice(voiceURI = '') {"
fun_code = r'''const FUN_VOICE_PRESETS = Object.freeze([
  { id:'mouse', label:'🐭 Ratón', voice:'es-MX-DaliaNeural', rate:1.45, pitch:1.90, volume:0.92, description:'Muy aguda y rápida, estilo ratoncito de caricatura.' },
  { id:'minion', label:'🍌 Minion (broma)', voice:'es-MX-JorgeNeural', rate:1.30, pitch:1.65, volume:0.95, description:'Aguda, acelerada y absurda. Es un preset de tono, no un clon de voz.' },
  { id:'anime-kawaii', label:'🌸 Anime kawaii', voice:'es-MX-DaliaNeural', rate:1.12, pitch:1.50, volume:0.92, description:'Voz brillante y tierna para reacciones y mensajes cortos.' },
  { id:'anime-chibi', label:'✨ Anime chibi', voice:'es-MX-DaliaNeural', rate:1.28, pitch:1.72, volume:0.92, description:'Más pequeña, rápida y exagerada que Anime kawaii.' },
  { id:'anime-senpai', label:'🎓 Senpai', voice:'es-MX-JorgeNeural', rate:0.95, pitch:0.92, volume:0.94, description:'Voz anime masculina tranquila y juvenil.' },
  { id:'anime-villain', label:'🖤 Villano anime', voice:'es-MX-JorgeNeural', rate:0.78, pitch:0.58, volume:0.96, description:'Grave y lenta para frases dramáticas.' },
  { id:'virtual-idol', label:'🎤 Idol virtual', voice:'es-US-PalomaNeural', rate:1.08, pitch:1.34, volume:0.92, description:'Voz alegre, brillante y energética.' },
  { id:'baby', label:'🍼 Bebé', voice:'es-MX-DaliaNeural', rate:1.22, pitch:1.88, volume:0.90, description:'Muy aguda y juguetona.' },
  { id:'demon', label:'😈 Demonio', voice:'es-MX-JorgeNeural', rate:0.68, pitch:0.50, volume:0.98, description:'Muy grave y lenta para momentos de broma.' },
  { id:'robot', label:'🤖 Robot', voice:'es-US-AlonsoNeural', rate:0.86, pitch:0.72, volume:0.94, description:'Más seca, grave y mecánica.' },
  { id:'epic', label:'⚔️ Narrador épico', voice:'es-ES-AlvaroNeural', rate:0.82, pitch:0.76, volume:0.98, description:'Narrador lento y dramático estilo tráiler/anime.' },
  { id:'turbo', label:'⚡ Meme turbo', voice:'es-AR-ElenaNeural', rate:1.75, pitch:1.28, volume:0.92, description:'Habla rapidísimo para mensajes caóticos.' }
]);

function selectedFunVoicePreset() {
  const id = $('funVoicePresetSelect')?.value || FUN_VOICE_PRESETS[0].id;
  return FUN_VOICE_PRESETS.find((item) => item.id === id) || FUN_VOICE_PRESETS[0];
}

function syncFunVoicePresetHint() {
  const preset = selectedFunVoicePreset();
  if ($('funVoicePresetHint')) $('funVoicePresetHint').textContent = preset.description;
}

function funVoiceConfig(preset = selectedFunVoicePreset()) {
  return { mode:'online', onlineVoice:preset.voice, voiceURI:'', rate:preset.rate, pitch:preset.pitch, volume:preset.volume };
}

function applyFunVoicePreset() {
  const preset = selectedFunVoicePreset();
  state.settings.voiceMode = 'online';
  state.settings.onlineVoice = preset.voice;
  state.settings.rate = preset.rate;
  state.settings.pitch = preset.pitch;
  state.settings.ttsVolume = preset.volume;
  $('rateInput').value = preset.rate;
  $('pitchInput').value = preset.pitch;
  $('ttsVolumeInput').value = preset.volume;
  renderVoiceOptions();
  syncOutputs();
  scheduleSave();
  toast('Voz divertida aplicada', preset.label.replace(/^\\S+\\s*/, ''), 'success');
}

function testFunVoicePreset() {
  const preset = selectedFunVoicePreset();
  const text = $('voiceTestInput')?.value.trim() || 'Hola, esta es una prueba de voz divertida de Lulu Finity.';
  stopCurrentAudio();
  const queued = speakText(text, false, null, funVoiceConfig(preset), { lockKey:'test-fun-voice', label:preset.label });
  if (!queued.accepted) toast('Audio ocupado', 'Espera a que termine el audio anterior.', 'error');
}

function copyFunVoicePresetToUserBuilder() {
  const preset = selectedFunVoicePreset();
  const value = `online:${preset.voice}`;
  renderCustomVoiceOptions();
  if ($('customVoiceSelect') && [...$('customVoiceSelect').options].some((option) => option.value === value)) $('customVoiceSelect').value = value;
  if ($('customVoiceRateInput')) $('customVoiceRateInput').value = preset.rate;
  if ($('customVoicePitchInput')) $('customVoicePitchInput').value = preset.pitch;
  if ($('customVoiceVolumeInput')) $('customVoiceVolumeInput').value = preset.volume;
  syncCustomVoiceBuilderOutputs();
  qsa('[data-tts-tab]').find((button) => button.dataset.ttsTab === 'users')?.click();
  $('customVoiceUserInput')?.focus();
  toast('Preset preparado', 'Escribe el usuario y pulsa Guardar usuario.', 'success');
}

'''
if 'const FUN_VOICE_PRESETS' not in r:
    if voice_marker not in r: raise RuntimeError('No se encontró la zona de voces del renderer.')
    r = r.replace(voice_marker, fun_code + voice_marker, 1)

html_marker = '<div class="voice-test-row"><input id="voiceTestInput" value="Hola, esta es una prueba de Lulu Finity."/><button class="secondary" id="voiceTestBtn">Probar voz</button><button class="ghost" id="stopVoiceBtn">Detener</button></div>\n</article>'
fun_html = '''<div class="voice-test-row"><input id="voiceTestInput" value="Hola, esta es una prueba de Lulu Finity."/><button class="secondary" id="voiceTestBtn">Probar voz</button><button class="ghost" id="stopVoiceBtn">Detener</button></div>\n</article>\n<article class="panel settings-card wide fun-voices-card"><div class="panel-header"><div><h3>Voces divertidas</h3><p>Presets de broma creados combinando voces online con velocidad y tono. No son clones de actores.</p></div><span class="count-pill">12 presets</span></div><div class="voice-picker-grid expanded"><div class="field-group voice-main-field"><label>Preset</label><select id="funVoicePresetSelect"><option value="mouse">🐭 Ratón</option><option value="minion">🍌 Minion (broma)</option><option value="anime-kawaii">🌸 Anime kawaii</option><option value="anime-chibi">✨ Anime chibi</option><option value="anime-senpai">🎓 Senpai</option><option value="anime-villain">🖤 Villano anime</option><option value="virtual-idol">🎤 Idol virtual</option><option value="baby">🍼 Bebé</option><option value="demon">😈 Demonio</option><option value="robot">🤖 Robot</option><option value="epic">⚔️ Narrador épico</option><option value="turbo">⚡ Meme turbo</option></select><small id="funVoicePresetHint">Muy aguda y rápida, estilo ratoncito de caricatura.</small></div><button class="primary" id="applyFunVoicePresetBtn">Usar voz</button><button class="secondary" id="testFunVoicePresetBtn">Probar</button><button class="ghost" id="copyFunVoicePresetBtn">Usar para un usuario</button></div></article>'''
if 'id="funVoicePresetSelect"' not in h:
    if html_marker not in h: raise RuntimeError('No se encontró el bloque de prueba de voz.')
    h = h.replace(html_marker, fun_html, 1)

# Eventos de presets; todos opcionales para no convertir el panel en punto único de fallo de arranque.
event_marker = "  $('voiceTestBtn').addEventListener('click', () => { stopCurrentAudio(); speakText($('voiceTestInput').value.trim() || 'Prueba de voz.', false, null, null, { lockKey:'test-global-voice', label:'Prueba de voz general' }); });\n"
events = "  $('funVoicePresetSelect')?.addEventListener('change', syncFunVoicePresetHint);\n  $('applyFunVoicePresetBtn')?.addEventListener('click', applyFunVoicePreset);\n  $('testFunVoicePresetBtn')?.addEventListener('click', testFunVoicePreset);\n  $('copyFunVoicePresetBtn')?.addEventListener('click', copyFunVoicePresetToUserBuilder);\n"
if "$('applyFunVoicePresetBtn')?.addEventListener" not in r:
    if event_marker not in r: raise RuntimeError('No se encontró el evento de prueba de voz.')
    r = r.replace(event_marker, event_marker + events, 1)

populate_marker = "  syncCustomVoiceBuilderOutputs();\n"
if "syncFunVoicePresetHint();" not in r:
    if populate_marker not in r: raise RuntimeError('No se encontró populateSettings para inicializar presets.')
    r = r.replace(populate_marker, populate_marker + "  syncFunVoicePresetHint();\n", 1)

h = h.replace('v0.29.0', 'v0.30.0')

pkg = json.loads(pkgp.read_text(encoding='utf-8'))
pkg['version'] = '0.30.0'
pkgp.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
rp.write_text(r, encoding='utf-8', newline='\n')
hp.write_text(h, encoding='utf-8', newline='\n')

if cp.exists():
    c = cp.read_text(encoding='utf-8')
    if '## 0.30.0' not in c:
        entry = '''# Cambios\n\n## 0.30.0\n\n- Añade **Voces divertidas** en Voz TTS con 12 presets: Ratón, Minion (broma), Anime kawaii, Anime chibi, Senpai, Villano anime, Idol virtual, Bebé, Demonio, Robot, Narrador épico y Meme turbo.\n- Los presets combinan voces online existentes con ajustes de velocidad, tono y volumen; no descargan ni clonan voces de actores.\n- Cada preset puede probarse antes de aplicarlo y puede copiarse al configurador de **Voces por usuario**.\n- Mantiene las voces locales y online existentes, el anti anuncios avanzado de YouTube, el rollback a 0.27 y las correcciones de arranque.\n\n'''
        c = entry + c
    cp.write_text(c, encoding='utf-8', newline='\n')

# Validaciones estructurales para evitar otra regresión de arranque.
r = rp.read_text(encoding='utf-8'); h = hp.read_text(encoding='utf-8')
for token in ('const FUN_VOICE_PRESETS', 'function applyFunVoicePreset()', 'function testFunVoicePreset()', 'function copyFunVoicePresetToUserBuilder()', "$('applyFunVoicePresetBtn')?.addEventListener", "$('testFunVoicePresetBtn')?.addEventListener"):
    if token not in r: raise RuntimeError('Falta '+token)
for ident in ('funVoicePresetSelect','applyFunVoicePresetBtn','testFunVoicePresetBtn','copyFunVoicePresetBtn','funVoicePresetHint'):
    if f'id="{ident}"' not in h: raise RuntimeError('Falta ID '+ident)
if r.count("id:'mouse'") != 1 or r.count("id:'anime-kawaii'") != 1 or r.count("id:'minion'") != 1:
    raise RuntimeError('Presets duplicados o incompletos.')
if '<span class="version" id="versionLabel">v0.30.0</span>' not in h:
    raise RuntimeError('No se actualizó versión visible.')
print('Lulu Finity 0.30.0: voces divertidas añadidas.')
