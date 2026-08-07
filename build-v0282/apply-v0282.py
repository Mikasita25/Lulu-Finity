from pathlib import Path
import json, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
renderer_path = ROOT / 'src/renderer.js'
html_path = ROOT / 'src/index.html'
package_path = ROOT / 'package.json'
changelog_path = ROOT / 'CHANGELOG.md'

renderer = renderer_path.read_text(encoding='utf-8')

activity_code = r'''function setEqualizer(id, active) {
  $(id)?.classList.toggle('active', Boolean(active));
}

function renderAudioActivityIndicators() {
  if (!state.settings) return;
  const ttsPlaying = Boolean(state.speaking || (state.audioBusy && state.activeAudioJob?.kind === 'speech'));
  const provider = state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';
  const currentMusic = provider === 'spotify' ? state.currentSpotify : state.currentSong;
  const player = provider === 'spotify' ? state.spotifyPlayer : state.player;
  const musicPlaying = Boolean(currentMusic && player && !player.paused);
  const soundPlaying = Boolean(state.audioBusy && state.activeAudioJob?.kind === 'sound');

  setEqualizer('voiceActivityBars', ttsPlaying);
  if ($('voiceActivityText')) $('voiceActivityText').textContent = ttsPlaying ? 'Reproduciendo' : 'Silencio';
  setEqualizer('musicActivityBars', musicPlaying);
  if ($('musicActivityText')) $('musicActivityText').textContent = musicPlaying ? 'Reproduciendo' : 'Silencio';
  setEqualizer('commandActivityBars', soundPlaying);
  if ($('commandActivityText')) $('commandActivityText').textContent = soundPlaying ? 'Reproduciendo' : 'Silencio';
}

function setupAudioActivityIndicators() {
  if (state.audioActivityTimer) clearInterval(state.audioActivityTimer);
  state.audioActivityTimer = setInterval(renderAudioActivityIndicators, 250);
  renderAudioActivityIndicators();
}

'''

if 'function setupAudioActivityIndicators()' not in renderer:
    marker = 'function selectCategoryTab(scope, key, scroll = true) {'
    if marker not in renderer:
        raise RuntimeError('No se encontró el punto seguro para restaurar los indicadores de audio.')
    renderer = renderer.replace(marker, activity_code + marker, 1)

renderer_path.write_text(renderer, encoding='utf-8', newline='\n')

html = html_path.read_text(encoding='utf-8')
html = html.replace('v0.28.1', 'v0.28.2')
html_path.write_text(html, encoding='utf-8', newline='\n')

package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '0.28.2'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')

if changelog_path.exists():
    changelog = changelog_path.read_text(encoding='utf-8')
    entry = '''# Cambios\n\n## 0.28.2\n\n- Corrige el error al iniciar que seguía presente en 0.28.1: `setupAudioActivityIndicators()` se ejecutaba durante el arranque pero su función no existía.\n- Restaura correctamente los indicadores de actividad de Voz TTS, Música y Comandos.\n- Mantiene la conexión al LIVE, el relay, el arreglo de Windows y los cambios de 0.28.1.\n- Refuerza la validación para exigir la definición real de las funciones críticas antes de publicar.\n\n'''
    if '## 0.28.2' not in changelog:
        changelog = entry + changelog
    changelog_path.write_text(changelog, encoding='utf-8', newline='\n')

# Validaciones del parche: no basta con encontrar el nombre; debe existir la definición.
renderer = renderer_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')
assert renderer.count('function setupAudioActivityIndicators()') == 1
assert renderer.count('function renderAudioActivityIndicators()') == 1
assert renderer.count('function setEqualizer(id, active)') == 1
assert renderer.index('function setupAudioActivityIndicators()') < renderer.index('async function init()')
assert renderer.index('function setupAudioActivityIndicators()') < renderer.index('  setupAudioActivityIndicators();')
for token in ('async function connectFromUi()', 'async function disconnectFromUi()', 'async function skipCurrentSong()', 'function setupEvents()'):
    assert token in renderer, token
assert '<span class="version" id="versionLabel">v0.28.2</span>' in html
print('Lulu Finity 0.28.2: arranque e indicadores restaurados.')
