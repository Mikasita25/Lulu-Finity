from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
renderer_path = ROOT / 'src/renderer.js'
html_path = ROOT / 'src/index.html'
package_path = ROOT / 'package.json'
changelog_path = ROOT / 'CHANGELOG.md'

renderer = renderer_path.read_text(encoding='utf-8')

# 0.28.0 accidentally merged most of setupEvents() into setupNavigation() and
# deleted the helper functions used by connection and music controls. Restore
# the original separation while keeping the 0.28 category tabs.
nav_tail = "  qsa('[data-category-tabs]').forEach((group) => group.querySelectorAll('[data-category-tab]').forEach((button) => button.addEventListener('click', () => selectCategoryTab(group.dataset.categoryTabs, button.dataset.categoryTab))));\n"
event_marker = "  $('songPrefixInput').addEventListener('input', () => {\n"

if 'async function connectFromUi()' not in renderer:
    nav_pos = renderer.find(nav_tail)
    event_pos = renderer.find(event_marker, nav_pos if nav_pos >= 0 else 0)
    if nav_pos < 0 or event_pos < 0 or event_pos <= nav_pos:
        raise RuntimeError('No se encontró la estructura dañada de renderer.js de 0.28.0.')

    insert_at = nav_pos + len(nav_tail)
    restored = r'''\n}\n\nasync function connectFromUi() {\n  const username = $('usernameInput').value.trim();\n  if (!username) {\n    toast('Falta el usuario', 'Escribe el usuario que está transmitiendo.', 'error');\n    $('usernameInput').focus();\n    return;\n  }\n  state.settings.username = username;\n  state.lastReadByUser.clear();\n  state.lastMessageByUser.clear();\n  scheduleSave();\n  setStatus({ status: 'connecting', username: normalizeUser(username) });\n  try {\n    const result = await api.connect(username);\n    setStatus(result);\n    toast('LIVE conectado', `@${result.username}`, 'success');\n    await refreshRelayUsage();\n  } catch (error) {\n    setStatus({ status: 'error', username: normalizeUser(username), message: error.message || String(error) });\n    toast('No se pudo conectar', error.message || String(error), 'error');\n  }\n}\n\nasync function disconnectFromUi() {\n  await api.disconnect();\n  setStatus({ status: 'disconnected' });\n}\n\nasync function addManualSong(inputId) {\n  const input = $(inputId);\n  const query = input.value.trim();\n  if (!query) {\n    toast('Falta la canción', `Escribe un nombre o enlace de ${activeMusicProvider() === 'spotify' ? 'Spotify' : 'YouTube'}.`, 'error');\n    input.focus();\n    return;\n  }\n  const added = await enqueueRequestedMusic(query, 'Solicitud manual');\n  if (added) {\n    input.value = '';\n    toast('Canción agregada', query, 'success');\n  }\n}\n\nasync function skipCurrentSong() {\n  if (!state.currentSong) return;\n  state.currentSong = null;\n  state.youtubeTransitioning = false;\n  state.player = { ...state.player, currentTime: 0, duration: 0, paused: true, title: '' };\n  if (state.songQueue.length) playNextSong();\n  else if (state.settings.continueRecommended !== false) await continueWithRecommendation();\n  else { renderPlayer(); renderSongs(); }\n}\n\nfunction syncRecommendedSetting(value) {\n  state.settings.continueRecommended = Boolean(value);\n  $('continueRecommendedInput').checked = state.settings.continueRecommended;\n  $('songsContinueRecommendedInput').checked = state.settings.continueRecommended;\n  scheduleSave();\n}\n\nfunction setupEvents() {\n  $('minimizeBtn').addEventListener('click', api.minimize);\n  $('maximizeBtn').addEventListener('click', api.maximize);\n  $('closeBtn').addEventListener('click', api.close);\n\n  $('connectBtn').addEventListener('click', connectFromUi);\n  $('bannerConnectBtn').addEventListener('click', connectFromUi);\n  $('usernameInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') connectFromUi(); });\n  $('disconnectBtn').addEventListener('click', disconnectFromUi);\n  $('sidebarDisconnectBtn').addEventListener('click', disconnectFromUi);\n\n  $('clearCommentsBtn').addEventListener('click', () => { state.comments = []; renderComments(); });\n  $('simulateBtn').addEventListener('click', () => {\n    const comment = $('testCommentInput').value.trim();\n    if (!comment) return;\n    processChat({\n      uniqueId: normalizeUser($('testNameInput').value) || 'usuario_prueba',\n      nickname: $('testNameInput').value.trim() || 'Usuario de prueba',\n      comment,\n      isFollower: true,\n      memberLevel: 5,\n      isSubscriber: true\n    }, true);\n    $('testCommentInput').value = '';\n  });\n  $('testCommentInput').addEventListener('keydown', (event) => {\n    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('simulateBtn').click(); }\n  });\n\n  bindSetting('ttsEnabledInput', 'ttsEnabled');\n  bindSetting('includeUsernameInput', 'includeUsername');\n  $('voiceSelect').addEventListener('change', () => {\n    const value = $('voiceSelect').value;\n    const separator = value.indexOf(':');\n    const mode = separator > 0 ? value.slice(0, separator) : 'system';\n    const id = separator > 0 ? value.slice(separator + 1) : value;\n    if (mode === 'online') { state.settings.voiceMode = 'online'; state.settings.onlineVoice = id; }\n    else { state.settings.voiceMode = 'system'; state.settings.voiceURI = id; }\n    scheduleSave();\n  });\n  $('voiceLanguageFilter').addEventListener('change', () => {\n    state.settings.voiceLanguageFilter = $('voiceLanguageFilter').value;\n    renderVoiceOptions();\n    scheduleSave();\n  });\n  $('voiceSearchInput')?.addEventListener('input', () => {\n    state.voiceSearch = $('voiceSearchInput').value;\n    renderVoiceOptions();\n  });\n  bindSetting('rateInput', 'rate', 'input', Number);\n  bindSetting('pitchInput', 'pitch', 'input', Number);\n  bindSetting('ttsVolumeInput', 'ttsVolume', 'input', Number);\n  bindSetting('queueLimitInput', 'queueLimit', 'input', Number);\n  bindSetting('youtubeMuteDuringTtsInput', 'youtubeMuteDuringTts');\n  bindSetting('checkUpdatesOnStartupInput', 'checkUpdatesOnStartup');\n  bindSetting('blockLinksInput', 'blockLinks');\n  bindSetting('readCommandsInput', 'readCommands');\n  bindSetting('maxCharactersInput', 'maxCharacters', 'input', Number);\n  bindSetting('cooldownInput', 'userCooldownSeconds', 'input', Number);\n  bindSetting('songQueueLimitInput', 'songQueueLimit', 'input', Number);\n  bindSetting('youtubeSearchSuffixInput', 'youtubeSearchSuffix', 'input', (value) => String(value).trim());\n  bindSetting('preventDuplicateSongsInput', 'preventDuplicateSongs');\n  bindSetting('youtubeAdBlockEnabledInput', 'youtubeAdBlockEnabled');\n  bindSetting('tiktokAutoChatEnabledInput', 'tiktokAutoChatEnabled');\n  bindSetting('tiktokAutoChatCooldownInput', 'tiktokAutoChatCooldownSeconds', 'input', Number);\n  for (const [suffix, enabledKey, textKey] of [\n    ['SongQueued','tiktokAutoChatSongQueuedEnabled','tiktokAutoChatSongQueuedText'],\n    ['SongStarted','tiktokAutoChatSongStartedEnabled','tiktokAutoChatSongStartedText'],\n    ['SongEnded','tiktokAutoChatSongEndedEnabled','tiktokAutoChatSongEndedText'],\n    ['SongSkipped','tiktokAutoChatSongSkippedEnabled','tiktokAutoChatSongSkippedText'],\n    ['LiveConnected','tiktokAutoChatLiveConnectedEnabled','tiktokAutoChatLiveConnectedText']\n  ]) {\n    bindSetting(`tiktokAutoChat${suffix}EnabledInput`, enabledKey);\n    bindSetting(`tiktokAutoChat${suffix}TextInput`, textKey, 'input', (value) => String(value).trimStart().slice(0, 180));\n  }\n  $('tiktokAutoChatTestInput')?.addEventListener('input', () => { state.settings.tiktokAutoChatTestText = $('tiktokAutoChatTestInput').value.slice(0, 180); scheduleSave(); });\n  $('openTikTokChatBtn')?.addEventListener('click', async () => {\n    const status = await api.openTikTokChat({ username:state.settings.username || $('usernameInput').value });\n    renderTikTokChatStatus(status);\n  });\n  $('checkTikTokChatBtn')?.addEventListener('click', async () => renderTikTokChatStatus(await api.getTikTokChatStatus()));\n  $('testTikTokChatBtn')?.addEventListener('click', async () => {\n    const message = String($('tiktokAutoChatTestInput')?.value || state.settings.tiktokAutoChatTestText || '').trim();\n    if (!message) { toast('Falta el mensaje', 'Escribe un texto de prueba.', 'error'); return; }\n    const result = await api.sendTikTokChat({ message, username:state.settings.username || $('usernameInput').value, cooldownSeconds:state.settings.tiktokAutoChatCooldownSeconds || 8 });\n    toast(result?.ok ? 'Mensaje enviado' : 'No se pudo enviar', result?.message || '', result?.ok ? 'success' : 'error');\n  });\n  $('resetTikTokChatBtn')?.addEventListener('click', async () => {\n    if (!window.confirm('¿Eliminar la sesión local de TikTok guardada en Lulu Finity?')) return;\n    renderTikTokChatStatus(await api.resetTikTokChatSession());\n  });\n  bindSetting('maxSongDurationInput', 'maxSongDurationMinutes', 'input', Number);\n  $('blockedSongsInput').addEventListener('input', () => { state.settings.blockedSongs = linesToArray($('blockedSongsInput').value); scheduleSave(); });\n  $('blockedChannelsInput').addEventListener('input', () => { state.settings.blockedChannels = linesToArray($('blockedChannelsInput').value); scheduleSave(); });\n  $('themeModeInput').addEventListener('change', () => { state.settings.themeMode = $('themeModeInput').value; applyAppearance(); scheduleSave(); });\n  for (const [id, key] of [['glowIntensityInput', 'glowIntensity'], ['panelOpacityInput', 'panelOpacity'], ['cornerRadiusInput', 'cornerRadius']]) {\n    $(id).addEventListener('input', () => { state.settings[key] = Number($(id).value); syncOutputs(); applyAppearance(); scheduleSave(); });\n  }\n  qsa('[data-dashboard-panel]').forEach((input) => input.addEventListener('change', () => {\n    const hidden = new Set(Array.isArray(state.settings.hiddenDashboardPanels) ? state.settings.hiddenDashboardPanels : []);\n    if (input.checked) hidden.add(input.dataset.dashboardPanel); else hidden.delete(input.dataset.dashboardPanel);\n    state.settings.hiddenDashboardPanels = [...hidden];\n    applyDashboardVisibility(); scheduleSave();\n  }));\n'''
    restored = restored.replace('\\n', '\n')
    renderer = renderer[:insert_at] + restored + renderer[event_pos:]

required = (
    'async function connectFromUi()',
    'async function disconnectFromUi()',
    'async function addManualSong(inputId)',
    'async function skipCurrentSong()',
    'function syncRecommendedSetting(value)',
    'function setupEvents()',
    "$('connectBtn').addEventListener('click', connectFromUi);",
    "$('songsSkipBtn').addEventListener('click', skipCurrentSong);",
)
for token in required:
    if token not in renderer:
        raise RuntimeError(f'Falta restaurar {token}')

nav_start = renderer.index('function setupNavigation()')
connect_start = renderer.index('async function connectFromUi()', nav_start)
events_start = renderer.index('function setupEvents()', connect_start)
song_prefix = renderer.index("$('songPrefixInput').addEventListener", events_start)
init_start = renderer.index('async function init()')
if not (nav_start < connect_start < events_start < song_prefix < init_start):
    raise RuntimeError('Las funciones restauradas quedaron en un orden inesperado.')

renderer_path.write_text(renderer, encoding='utf-8', newline='\n')

package = package_path.read_text(encoding='utf-8')
package = package.replace('"version": "0.28.0"', '"version": "0.28.1"', 1)
if '"version": "0.28.1"' not in package:
    raise RuntimeError('No se pudo actualizar package.json a 0.28.1.')
package_path.write_text(package, encoding='utf-8', newline='\n')

html = html_path.read_text(encoding='utf-8')
html = html.replace('<span class="version" id="versionLabel">v0.28.0</span>', '<span class="version" id="versionLabel">v0.28.1</span>')
html = html.replace('<span class="update-version" id="updateVersionBadge">v0.28.0</span>', '<span class="update-version" id="updateVersionBadge">v0.28.1</span>')
html_path.write_text(html, encoding='utf-8', newline='\n')

if changelog_path.exists():
    changelog = changelog_path.read_text(encoding='utf-8')
    section = '''# Cambios\n\n## 0.28.1\n\n- Restaura la conexión al LIVE y los controles de la interfaz que 0.28.0 dejó sin eventos por una transformación incorrecta de renderer.js.\n- Restaura los controles de música y la sincronización de reproducción recomendada sin volver a añadir Brave.\n- Mantiene el relay, el arreglo de Windows, las pestañas internas y el anti anuncios de 0.28.0.\n- Añade validaciones para impedir publicar otra versión si desaparecen las funciones críticas del renderer.\n\n'''
    if '## 0.28.1' not in changelog:
        changelog = section + changelog
    changelog_path.write_text(changelog, encoding='utf-8', newline='\n')

print('Lulu Finity 0.28.1: renderer restaurado correctamente.')
