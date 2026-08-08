from pathlib import Path
import json, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
main_path = ROOT / 'src/main.js'
renderer_path = ROOT / 'src/renderer.js'
html_path = ROOT / 'src/index.html'
package_path = ROOT / 'package.json'
changelog_path = ROOT / 'CHANGELOG.md'

package = json.loads(package_path.read_text(encoding='utf-8'))
if package.get('version') != '0.34.0':
    raise SystemExit(f"Lulu 0.34.1 espera la fuente 0.34.0, no {package.get('version')}")

main = main_path.read_text(encoding='utf-8')

anchor = 'async function ensureOverlayHttpsTunnel(force = false) {'
helper = '''function currentOverlayTunnelInfo() {\n  const active = Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);\n  return {\n    ok: active,\n    ...overlayTunnelStatus,\n    url: active ? overlayPublicBaseUrl : ''\n  };\n}\n\n'''
if anchor not in main or 'function currentOverlayTunnelInfo()' in main:
    raise SystemExit('No se encontró el punto para separar el túnel HTTPS del arranque.')
main = main.replace(anchor, helper + anchor, 1)

blocking_tunnel = 'const tunnel = await ensureOverlayHttpsTunnel(forceTunnel);'
if main.count(blocking_tunnel) != 3:
    raise SystemExit(f'Se esperaban 3 arranques automáticos de Cloudflare y hay {main.count(blocking_tunnel)}.')
main = main.replace(
    blocking_tunnel,
    'const tunnel = forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo();'
)

old_usage = '''  const response = await fetch(url, {\n    headers: { 'Accept': 'application/json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },\n    cache: 'no-store'\n  });\n  if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);\n  const usage = await response.json();\n  if (!usage?.ok) throw new Error('El servidor no entregó el contador diario.');\n  return usage;\n'''
new_usage = '''  const controller = new AbortController();\n  const timeout = setTimeout(() => controller.abort(), 4500);\n  try {\n    const response = await fetch(url, {\n      headers: { 'Accept': 'application/json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },\n      cache: 'no-store',\n      signal: controller.signal\n    });\n    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);\n    const usage = await response.json();\n    if (!usage?.ok) throw new Error('El servidor no entregó el contador diario.');\n    return usage;\n  } catch (error) {\n    if (error?.name === 'AbortError') throw new Error('El servidor de uso tardó demasiado en responder.');\n    throw error;\n  } finally {\n    clearTimeout(timeout);\n  }\n'''
if old_usage not in main:
    raise SystemExit('No se encontró fetchRelayUsage para añadir tiempo límite.')
main = main.replace(old_usage, new_usage, 1)

old_ready = '''  createWindow();\n  void ensureYoutubeNetworkAdBlocker();\n  app.on('activate', () => {\n'''
new_ready = '''  createWindow();\n  const adBlockWarmup = setTimeout(() => { void ensureYoutubeNetworkAdBlocker(); }, 1800);\n  adBlockWarmup.unref?.();\n  app.on('activate', () => {\n'''
if old_ready not in main:
    raise SystemExit('No se encontró el arranque del anti anuncios de YouTube.')
main = main.replace(old_ready, new_ready, 1)
main_path.write_text(main, encoding='utf-8', newline='\n')

renderer = renderer_path.read_text(encoding='utf-8')
if renderer.count('await refreshRelayUsage();') != 2:
    raise SystemExit('Cambió la cantidad esperada de esperas del contador de Railway.')
renderer = renderer.replace('await refreshRelayUsage();', 'void refreshRelayUsage();')
if renderer.count('await loadOnlineVoices(false);') != 1:
    raise SystemExit('No se encontró la carga online de voces al iniciar.')
renderer = renderer.replace('await loadOnlineVoices(false);', 'void loadOnlineVoices(false);', 1)
renderer_path.write_text(renderer, encoding='utf-8', newline='\n')

package['version'] = '0.34.1'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
if '<span class="version" id="versionLabel">v0.34.0</span>' not in html:
    raise SystemExit('No se encontró la versión visible 0.34.0.')
html = html.replace(
    '<span class="version" id="versionLabel">v0.34.0</span>',
    '<span class="version" id="versionLabel">v0.34.1</span>',
    1,
)
html_path.write_text(html, encoding='utf-8', newline='\n')

changelog = changelog_path.read_text(encoding='utf-8')
entry = '''# Cambios\n\n## 0.34.1\n\n- Corrige el arranque que podía quedarse esperando servicios de Internet y hacer que Lulu pareciera desconectada.\n- Inicio, ajustes y funciones locales cargan primero sin depender de GitHub, Cloudflare, Railway ni YouTube.\n- Los enlaces HTTPS de overlays se crean únicamente al pedir **Copiar HTTPS**; las vistas y enlaces locales ya no levantan Cloudflare durante el inicio.\n- El contador de uso de Railway se actualiza en segundo plano y tiene tiempo límite, por lo que una caída del servidor no bloquea la interfaz.\n- El anti anuncios avanzado de YouTube se prepara después de mostrar la aplicación y continúa aislado en la sesión de YouTube.\n- Mantiene Lulu Studio, las tres Miku, Automatizaciones, Juegos del LIVE, rankings, economía, TTS y música.\n\n'''
if changelog.startswith('# Cambios\n\n'):
    changelog = entry + changelog[len('# Cambios\n\n'):]
else:
    changelog = entry + changelog
changelog_path.write_text(changelog, encoding='utf-8', newline='\n')

print('Lulu Finity 0.34.1: arranque local-first aplicado')
