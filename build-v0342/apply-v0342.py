from pathlib import Path
import json, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
main_path = ROOT / 'src/main.js'
preload_path = ROOT / 'src/preload.js'
renderer_path = ROOT / 'src/renderer.js'
html_path = ROOT / 'src/index.html'
package_path = ROOT / 'package.json'
changelog_path = ROOT / 'CHANGELOG.md'

package = json.loads(package_path.read_text(encoding='utf-8'))
if package.get('version') != '0.34.1':
    raise SystemExit(f"Lulu 0.34.2 espera la fuente 0.34.1, no {package.get('version')}")

main = main_path.read_text(encoding='utf-8')
main_import = "const { LiveGameManager } = require('./live-games');"
engine_import = "const automationEngine = require('./automation-engine');"
if main_import not in main:
    raise SystemExit('No se encontró la importación de LiveGameManager.')
if engine_import not in main:
    main = main.replace(main_import, main_import + "\n" + engine_import, 1)

handler_anchor = "ipcMain.handle('games:play', async (_event, details) => getLiveGameManager().play(details || {}));"
handlers = """ipcMain.handle('automations:evaluate', async (_event, details = {}) => automationEngine.evaluateAutomations(details.rules, details.event, details.context));
ipcMain.handle('goals:apply-event', async (_event, details = {}) => automationEngine.applyGoalEvent(details.goals, details.event));
ipcMain.handle('goals:reset', async (_event, details = {}) => automationEngine.resetGoal(details.goals, details.goalId));
ipcMain.handle('gifts:update-stats', async (_event, details = {}) => automationEngine.updateGiftStats(details.state, details.event));"""
if handler_anchor not in main:
    raise SystemExit('No se encontró el handler de Juegos del LIVE.')
if "ipcMain.handle('automations:evaluate'" not in main:
    main = main.replace(handler_anchor, handler_anchor + "\n" + handlers, 1)
main_path.write_text(main, encoding='utf-8', newline='\n')

preload = preload_path.read_text(encoding='utf-8')
local_require = "const automationEngine = require('./automation-engine');\n"
if local_require not in preload:
    raise SystemExit('No se encontró el require local que rompe el preload sandboxed.')
preload = preload.replace(local_require, '', 1)
old_bridge = """  evaluateAutomations: (rules,event,context) => automationEngine.evaluateAutomations(rules,event,context),
  applyGoalEvent: (goals,event) => automationEngine.applyGoalEvent(goals,event),
  resetGoal: (goals,goalId) => automationEngine.resetGoal(goals,goalId),
  updateGiftStats: (state,event) => automationEngine.updateGiftStats(state,event),"""
new_bridge = """  evaluateAutomations: (rules,event,context) => ipcRenderer.invoke('automations:evaluate', { rules, event, context }),
  applyGoalEvent: (goals,event) => ipcRenderer.invoke('goals:apply-event', { goals, event }),
  resetGoal: (goals,goalId) => ipcRenderer.invoke('goals:reset', { goals, goalId }),
  updateGiftStats: (state,event) => ipcRenderer.invoke('gifts:update-stats', { state, event }),"""
if old_bridge not in preload:
    raise SystemExit('No se encontró el puente síncrono de Automatizaciones.')
preload = preload.replace(old_bridge, new_bridge, 1)
preload_path.write_text(preload, encoding='utf-8', newline='\n')

renderer = renderer_path.read_text(encoding='utf-8')
old_handler = "async function handleAutomationEvent(event){if(!event?.type||!state.settings)return;state.settings.liveGoals=api.applyGoalEvent(normalizedLiveGoals(),event);if(event.type==='gift')state.giftStats=api.updateGiftStats(state.giftStats,event);const evaluated=api.evaluateAutomations(normalizedAutomationRules(),event,{now:Date.now(),cooldowns:state.automationCooldowns});state.automationCooldowns=evaluated.cooldowns||{};for(const action of evaluated.actions||[]){pushAutomationLog(`${action.ruleName||'Automatización'} · ${AUTOMATION_ACTION_LABELS[action.type]||action.type}`,'action');await executeAutomationAction(action,event);}renderAutomationStudio();publishAutomationWidgets(event);}"
new_handler = """async function handleAutomationEvent(event) {
  if (!event?.type || !state.settings) return;
  state.settings.liveGoals = await api.applyGoalEvent(normalizedLiveGoals(), event);
  if (event.type === 'gift') state.giftStats = await api.updateGiftStats(state.giftStats, event);
  const evaluated = await api.evaluateAutomations(normalizedAutomationRules(), event, { now: Date.now(), cooldowns: state.automationCooldowns });
  state.automationCooldowns = evaluated?.cooldowns || {};
  for (const action of evaluated?.actions || []) {
    pushAutomationLog(`${action.ruleName || 'Automatización'} · ${AUTOMATION_ACTION_LABELS[action.type] || action.type}`, 'action');
    await executeAutomationAction(action, event);
  }
  renderAutomationStudio();
  publishAutomationWidgets(event);
}"""
if old_handler not in renderer:
    raise SystemExit('No se encontró handleAutomationEvent de 0.34.1.')
renderer = renderer.replace(old_handler, new_handler, 1)

click_anchor = "goals?.addEventListener('click',(e)=>{"
if renderer.count(click_anchor) != 1:
    raise SystemExit('No se encontró exactamente un listener de clic para metas.')
renderer = renderer.replace(click_anchor, "goals?.addEventListener('click',async(e)=>{", 1)
old_reset = "state.settings.liveGoals=api.resetGoal(list,goal.id);"
if renderer.count(old_reset) != 1:
    raise SystemExit('No se encontró exactamente un reset de meta síncrono.')
renderer = renderer.replace(old_reset, "state.settings.liveGoals=await api.resetGoal(list,goal.id);", 1)
renderer_path.write_text(renderer, encoding='utf-8', newline='\n')

package['version'] = '0.34.2'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
if '<span class="version" id="versionLabel">v0.34.1</span>' not in html:
    raise SystemExit('No se encontró la versión visible 0.34.1.')
html = html.replace('<span class="version" id="versionLabel">v0.34.1</span>', '<span class="version" id="versionLabel">v0.34.2</span>', 1)
html_path.write_text(html, encoding='utf-8', newline='\n')

changelog = changelog_path.read_text(encoding='utf-8')
entry = '''# Cambios\n\n## 0.34.2\n\n- Corrige el **Error al iniciar** introducido con Automatizaciones: el preload de Electron estaba intentando cargar un módulo local mientras la ventana usa `sandbox: true`.\n- Mantiene el sandbox de seguridad y mueve la evaluación de automatizaciones, metas y estadísticas de regalos al proceso principal mediante IPC seguro.\n- Evita que falle `window.voiceStudio` durante el arranque y conserva Automatizaciones, Metas del LIVE y Top regalos.\n- Añade una regresión específica para impedir que un `require('./...')` vuelva a entrar en el preload sandboxed.\n- Conserva el arranque local-first de 0.34.1, Lulu Studio, juegos, rankings, economía, TTS, música y Railway.\n\n'''
if changelog.startswith('# Cambios\n\n'):
    changelog = entry + changelog[len('# Cambios\n\n'):]
else:
    changelog = entry + changelog
changelog_path.write_text(changelog, encoding='utf-8', newline='\n')

print('Lulu Finity 0.34.2: preload sandbox corregido con IPC')
