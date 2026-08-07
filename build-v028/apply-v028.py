from pathlib import Path
import base64, gzip, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
parts = sorted(Path(__file__).parent.glob('part-*.txt'))
code = gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8').strip() for p in parts))).decode('utf-8')
exec(compile(code, 'apply-v028-embedded.py', 'exec'))

# Correcciones posteriores de 0.28.0:
# - retirar la categoría Control, que se ejecutaba antes de cargar settings;
# - conservar la organización por pestañas;
# - dejar indicadores de audio dentro de sus categorías;
# - mejorar el anti anuncios sin bloquear endpoints internos de YouTube que pueden retrasar el video.

html_path = ROOT / 'src/index.html'
renderer_path = ROOT / 'src/renderer.js'
main_path = ROOT / 'src/main.js'
changelog_path = ROOT / 'CHANGELOG.md'

html = html_path.read_text(encoding='utf-8')
html = html.replace(
    '<button class="nav-item active" data-page="dashboard"><span>⌂</span>Panel</button><button class="nav-item" data-page="control"><span>▥</span>Control</button>',
    '<button class="nav-item active" data-page="dashboard"><span>⌂</span>Panel</button>'
)
html = re.sub(
    r'</section><section class="page" id="page-control">.*?</section>\s*<section class="page" id="page-voice">',
    '</section>\n<section class="page" id="page-voice">',
    html,
    flags=re.S,
)
html = html.replace('<span class="version" id="versionLabel">v0.19.0</span>', '<span class="version" id="versionLabel">v0.28.0</span>')
html = html.replace('<span class="update-version" id="updateVersionBadge">v0.21.0</span>', '<span class="update-version" id="updateVersionBadge">v0.28.0</span>')

voice_marker = '</div>\n<div class="tts-section-pane active" data-tts-pane="voice">'
if 'id="voiceActivityBars"' not in html and voice_marker in html:
    html = html.replace(
        voice_marker,
        '</div>\n<div class="audio-activity-strip panel" id="voiceAudioActivity"><span>Audio TTS</span><div class="mini-equalizer" id="voiceActivityBars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong id="voiceActivityText">Silencio</strong></div>\n<div class="tts-section-pane active" data-tts-pane="voice">',
        1,
    )

for scope, strip in (
    ('songs', '<div class="audio-activity-strip panel" id="musicAudioActivity"><span>Audio de música</span><div class="mini-equalizer" id="musicActivityBars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong id="musicActivityText">Silencio</strong></div>'),
    ('commands', '<div class="audio-activity-strip panel" id="commandAudioActivity"><span>Audio de comandos</span><div class="mini-equalizer" id="commandActivityBars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong id="commandActivityText">Silencio</strong></div>'),
):
    bar_id = 'musicActivityBars' if scope == 'songs' else 'commandActivityBars'
    if f'id="{bar_id}"' in html:
        continue
    match = re.search(rf'(<div class="section-tabs category-section-tabs" data-category-tabs="{scope}".*?</div>)', html, flags=re.S)
    if not match:
        raise RuntimeError(f'No se encontraron las pestañas de {scope}.')
    html = html[:match.end()] + strip + html[match.end():]

html_path.write_text(html, encoding='utf-8', newline='\n')

renderer = renderer_path.read_text(encoding='utf-8')
renderer = re.sub(
    r"\n\s*qsa\('\[data-control-page\]'\)\.forEach\(\(button\) => button\.addEventListener\('click', \(\) => \{.*?\n\s*\}\)\);",
    '',
    renderer,
    flags=re.S,
)

start = renderer.find('function setControlActive(')
end = renderer.find('\nasync function connectFromUi()', start if start >= 0 else 0)
if start >= 0 and end > start:
    activity_code = '''function setEqualizer(id, active) {\n  $(id)?.classList.toggle('active', Boolean(active));\n}\n\nfunction renderAudioActivityIndicators() {\n  if (!state.settings) return;\n  const ttsPlaying = Boolean(state.speaking || (state.audioBusy && state.activeAudioJob?.kind === 'speech'));\n  const provider = state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';\n  const currentMusic = provider === 'spotify' ? state.currentSpotify : state.currentSong;\n  const player = provider === 'spotify' ? state.spotifyPlayer : state.player;\n  const musicPlaying = Boolean(currentMusic && !player.paused);\n  const soundPlaying = Boolean(state.audioBusy && state.activeAudioJob?.kind === 'sound');\n\n  setEqualizer('voiceActivityBars', ttsPlaying);\n  if ($('voiceActivityText')) $('voiceActivityText').textContent = ttsPlaying ? 'Reproduciendo' : 'Silencio';\n  setEqualizer('musicActivityBars', musicPlaying);\n  if ($('musicActivityText')) $('musicActivityText').textContent = musicPlaying ? 'Reproduciendo' : 'Silencio';\n  setEqualizer('commandActivityBars', soundPlaying);\n  if ($('commandActivityText')) $('commandActivityText').textContent = soundPlaying ? 'Reproduciendo' : 'Silencio';\n}\n\nfunction setupAudioActivityIndicators() {\n  setInterval(renderAudioActivityIndicators, 250);\n  renderAudioActivityIndicators();\n}\n'''
    renderer = renderer[:start] + activity_code + renderer[end:]

renderer = renderer.replace('  setupControlCenter();\n  const initial = await api.getState();', '  const initial = await api.getState();')
if '  state.settings = initial.settings;\n  setupAudioActivityIndicators();' not in renderer:
    renderer = renderer.replace('  state.settings = initial.settings;\n', '  state.settings = initial.settings;\n  setupAudioActivityIndicators();\n', 1)
renderer_path.write_text(renderer, encoding='utf-8', newline='\n')

styles_path = ROOT / 'src/styles.css'
styles = styles_path.read_text(encoding='utf-8')
if '.audio-activity-strip{' not in styles:
    styles += '\n.audio-activity-strip{display:flex;align-items:center;gap:14px;padding:9px 14px;margin:0 0 12px;min-height:44px}.audio-activity-strip>span{font-weight:700;font-size:12px}.audio-activity-strip .mini-equalizer{flex:1}.audio-activity-strip>strong{min-width:82px;text-align:right;color:var(--muted);font-size:11px}@media(max-width:900px){.audio-activity-strip{gap:8px}}\n'
styles_path.write_text(styles, encoding='utf-8', newline='\n')

main = main_path.read_text(encoding='utf-8')
for blocked_internal in (
    "      '*://*.youtube.com/api/stats/ads*',\n",
    "      '*://*.youtube.com/pagead/*',\n",
    "      '*://*.youtube.com/get_midroll_info*'\n",
):
    main = main.replace(blocked_internal, '')
main = main.replace("  const delay = kind === 'watch' ? 80 : 350;", "  const delay = kind === 'watch' ? 20 : 350;")
main = main.replace('Date.now() - adClearSince >= 450', 'Date.now() - adClearSince >= 220')
main_path.write_text(main, encoding='utf-8', newline='\n')

if changelog_path.exists():
    changelog = changelog_path.read_text(encoding='utf-8')
    changelog = changelog.replace('- Añade la categoría Control para ver rápidamente funciones activas, audio en curso y accesos directos.\n', '')
    changelog = changelog.replace('- Añade indicadores animados de audio para TTS, música y sonidos de comandos.\n', '- Mantiene indicadores compactos de audio dentro de Voz TTS, Música y Comandos, sin añadir una categoría extra.\n')
    if '- Corrige el arranque que podía quedarse mostrando v0.19.0 y dejar secciones sin cargar.\n' not in changelog:
        marker = '- Cambia el medidor individual a Tu uso diario y siempre consulta la cuenta de TikTok guardada en Lulu, sin permitir consultar otro usuario desde la interfaz.\n'
        changelog = changelog.replace(marker, marker + '- Corrige el arranque que podía quedarse mostrando v0.19.0 y dejar secciones sin cargar.\n', 1)
    changelog_path.write_text(changelog, encoding='utf-8', newline='\n')

# Validación específica del arreglo.
html = html_path.read_text(encoding='utf-8')
renderer = renderer_path.read_text(encoding='utf-8')
main = main_path.read_text(encoding='utf-8')
assert 'data-page="control"' not in html and 'id="page-control"' not in html
assert 'setupControlCenter' not in renderer and 'renderControlCenter' not in renderer
assert '<span class="version" id="versionLabel">v0.28.0</span>' in html
assert 'setupAudioActivityIndicators' in renderer
assert 'voiceActivityBars' in html and 'musicActivityBars' in html and 'commandActivityBars' in html
assert '*://*.youtube.com/get_midroll_info*' not in main
print('Parche 0.28.0 corregido sin Control aplicado correctamente.')
