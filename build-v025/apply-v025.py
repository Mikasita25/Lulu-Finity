from pathlib import Path
import json
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app")


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8", newline="\n")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"No se encontró {label}")
    return text.replace(old, new, 1)


# Versión y notas.
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "0.25.0"
package["description"] = "Lulu Finity: TikTok LIVE mediante relay seguro en Railway, TTS, música, comandos y overlays"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

changelog_path = ROOT / "CHANGELOG.md"
old_changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else ""
new_notes = """# Cambios\n\n## 0.25.0\n\n- Reemplaza las ilustraciones de Miku Classic, Miku Soft y Miku Dark por las imágenes elegidas para cada tema.\n- Añade la categoría Cuenta para enlazar y administrar la sesión local de TikTok.\n- Mueve la configuración de mensajes automáticos al área de Comandos.\n- Une YouTube y Spotify bajo una sola categoría visible llamada Música.\n- Renombra Rankings como Overlays sin cambiar el funcionamiento interno de los rankings y widgets.\n- Permite hacer los paneles mucho más transparentes para ver mejor el fondo de Miku.\n- Actualiza la imagen de Sobre Lulu con la nueva ilustración elegida.\n\n"""
changelog_path.write_text(new_notes + old_changelog, encoding="utf-8", newline="\n")

# ----- HTML: conservar la interfaz y reorganizar únicamente las secciones solicitadas.
html = read("src/index.html")
html = replace_once(
    html,
    '<button class="nav-item" data-page="songs"><span>▶</span>YouTube</button>',
    '<button class="nav-item" data-page="songs"><span>▶</span>Música</button>',
    "la categoría YouTube"
)
html = replace_once(
    html,
    '<button class="nav-item" data-page="commands"><span>›_</span>Comandos</button>',
    '<button class="nav-item" data-page="account"><span>◎</span>Cuenta</button>\n        <button class="nav-item" data-page="commands"><span>›_</span>Comandos</button>',
    "la categoría Comandos"
)
html = replace_once(
    html,
    '<button class="nav-item" data-page="rankings"><span>♛</span>Rankings</button>',
    '<button class="nav-item" data-page="rankings"><span>♛</span>Overlays</button>',
    "la categoría Rankings"
)
html = replace_once(
    html,
    '<div class="page-heading simple"><div><h1>YouTube</h1><p>Una sola sesión de reproducción, con cola y recomendaciones.</p></div></div>',
    '<div class="page-heading simple actions-heading"><div><h1>Música</h1><p>YouTube y Spotify en una sola categoría, usando el mismo comando y la misma configuración de permisos.</p></div><div class="heading-actions"><button class="ghost" data-go-page="spotify">Abrir Spotify</button></div></div>',
    "el encabezado de YouTube"
)
html = html.replace('placeholder="Nombre o enlace de YouTube"', 'placeholder="Nombre, enlace o búsqueda de música"')

# Cuenta: solo contiene el enlace y estado de la sesión de TikTok.
account_page = r'''
      <section class="page" id="page-account">
        <div class="page-heading simple"><div><h1>Cuenta</h1><p>Enlaza TikTok para habilitar las funciones de cuenta de Lulu Finity.</p></div></div>
        <div class="settings-grid">
          <article class="panel settings-card wide tiktok-account-card">
            <div class="panel-header"><div><h3>Cuenta de TikTok</h3><p class="hint">La sesión se guarda únicamente en esta computadora.</p></div><span class="chat-session-pill" id="tiktokChatStatusBadge">SIN SESIÓN</span></div>
            <div class="setting-row top"><div><h3>Enlazar cuenta</h3><p id="tiktokChatStatusText">Abre TikTok e inicia sesión para enlazar la cuenta con Lulu.</p></div></div>
            <div class="tiktok-chat-actions"><button class="secondary" id="openTikTokChatBtn">Abrir TikTok e iniciar sesión</button><button class="ghost" id="checkTikTokChatBtn">Comprobar sesión</button><button class="danger-outline" id="resetTikTokChatBtn">Cerrar / restablecer sesión</button></div>
          </article>
        </div>
      </section>

'''
html = replace_once(html, '      <section class="page" id="page-commands">', account_page + '      <section class="page" id="page-commands">', "la página Comandos")

# Eliminar el bloque anterior de mensajes automáticos de Ajustes.
auto_pattern = re.compile(r'\n\s*<article class="panel settings-card wide tiktok-auto-chat-card">.*?</article>', re.S)
html, removed = auto_pattern.subn('', html, count=1)
if removed != 1:
    raise RuntimeError("No se pudo mover el bloque de mensajes automáticos desde Ajustes")

# Reinsertarlo dentro de Comandos, sin mezclarlo con el enlace de cuenta.
commands_marker = '<article class="panel stream-overlay-card">'
auto_chat_commands = r'''<article class="panel settings-card wide tiktok-auto-chat-card">
          <div class="panel-header"><div><h3>Mensajes automáticos en el LIVE</h3><p class="hint">Personaliza qué debe decir Lulu y en qué momento debe enviarlo.</p></div></div>
          <div class="setting-row top"><div><h3>Activar mensajes automáticos</h3><p>La sesión de TikTok se administra desde la categoría Cuenta.</p></div><label class="switch"><input id="tiktokAutoChatEnabledInput" type="checkbox" /><span></span></label></div>
          <div class="field-group"><div class="label-value"><label>Espera mínima entre mensajes</label><output id="tiktokAutoChatCooldownOutput">8 s</output></div><input id="tiktokAutoChatCooldownInput" type="range" min="5" max="120" step="1" /></div>
          <div class="auto-chat-rules">
            <label class="auto-chat-rule"><span class="auto-chat-rule-title"><input id="tiktokAutoChatSongQueuedEnabledInput" type="checkbox" /> Cuando una canción entra a la cola</span><textarea id="tiktokAutoChatSongQueuedTextInput" rows="2" maxlength="180"></textarea></label>
            <label class="auto-chat-rule"><span class="auto-chat-rule-title"><input id="tiktokAutoChatSongStartedEnabledInput" type="checkbox" /> Cuando una canción empieza a sonar</span><textarea id="tiktokAutoChatSongStartedTextInput" rows="2" maxlength="180"></textarea></label>
            <label class="auto-chat-rule"><span class="auto-chat-rule-title"><input id="tiktokAutoChatSongEndedEnabledInput" type="checkbox" /> Cuando termina una canción</span><textarea id="tiktokAutoChatSongEndedTextInput" rows="2" maxlength="180"></textarea></label>
            <label class="auto-chat-rule"><span class="auto-chat-rule-title"><input id="tiktokAutoChatSongSkippedEnabledInput" type="checkbox" /> Cuando se salta una canción</span><textarea id="tiktokAutoChatSongSkippedTextInput" rows="2" maxlength="180"></textarea></label>
            <label class="auto-chat-rule"><span class="auto-chat-rule-title"><input id="tiktokAutoChatLiveConnectedEnabledInput" type="checkbox" /> Cuando Lulu se conecta al LIVE</span><textarea id="tiktokAutoChatLiveConnectedTextInput" rows="2" maxlength="180"></textarea></label>
          </div>
          <p class="hint">Variables: <strong>{cancion}</strong>, <strong>{usuario}</strong>, <strong>{posicion}</strong>, <strong>{cola}</strong>, <strong>{proveedor}</strong>, <strong>{comando}</strong> y <strong>{live}</strong>.</p>
          <div class="tiktok-chat-test"><input id="tiktokAutoChatTestInput" maxlength="180" placeholder="Mensaje de prueba" /><button class="primary" id="testTikTokChatBtn">Enviar prueba</button></div>
        </article>
        '''
html = replace_once(html, commands_marker, auto_chat_commands + commands_marker, "el primer panel de Comandos")

# Rankings pasa a llamarse visualmente Overlays, manteniendo IDs internos para no romper compatibilidad.
visible_replacements = {
    '<h1>Rankings del stream</h1>': '<h1>Overlays</h1>',
    'Crea tablas en vivo para OBS o TikTok LIVE Studio con estilos, fuentes, colores y texto RGB animado.': 'Configura rankings y widgets en vivo para OBS o TikTok LIVE Studio.',
    '<h2>Configurar ranking</h2>': '<h2>Configurar overlay</h2>',
    '<label>Pantalla de ranking</label>': '<label>Pantalla de overlay</label>',
    '<option value="1">Ranking 1</option><option value="2">Ranking 2</option><option value="3">Ranking 3</option><option value="4">Ranking 4</option>': '<option value="1">Overlay 1</option><option value="2">Overlay 2</option><option value="3">Overlay 3</option><option value="4">Overlay 4</option>',
    '<label>Tipo de ranking</label>': '<label>Contenido</label>',
    'title="Vista previa del ranking"': 'title="Vista previa del overlay"',
    'El ranking se actualiza automáticamente durante el LIVE.': 'El overlay se actualiza automáticamente durante el LIVE.',
    '<h2>Superposiciones adicionales</h2>': '<h2>Otros overlays</h2>'
}
for old, new in visible_replacements.items():
    if old in html:
        html = html.replace(old, new)

# Transparencia: conservar el control existente pero permitir paneles mucho más transparentes.
html = html.replace('id="panelOpacityInput" type="range" min="55" max="100"', 'id="panelOpacityInput" type="range" min="20" max="100"')
write("src/index.html", html)

# ----- Renderer: Spotify queda dentro de la categoría visible Música y Sobre Lulu usa la nueva imagen.
renderer = read("src/renderer.js")
spotify_nav_block = '''  if (nav && !nav.querySelector('[data-page="spotify"]')) {
    filtersButton?.insertAdjacentHTML('beforebegin', '<button class="nav-item" data-page="spotify"><span>●</span>Spotify</button>');
  }
'''
if spotify_nav_block not in renderer:
    raise RuntimeError("No se encontró la inserción de la categoría Spotify")
renderer = renderer.replace(spotify_nav_block, "  nav?.querySelector('[data-page=\"spotify\"]')?.remove();\n", 1)
renderer = renderer.replace(
    '<div class="page-heading simple"><div><h1>Spotify</h1><p>Usa la sesión web o abre la aplicación instalada cuando Spotify Web no responda.</p></div><div class="heading-actions"><button class="ghost" id="showSpotifyDesktopBtn">Abrir app de Spotify</button><button class="ghost" id="showSpotifyBtn">Ver Spotify Web</button></div></div>',
    '<div class="page-heading simple actions-heading"><div><h1>Música · Spotify</h1><p>Spotify forma parte de la misma categoría Música.</p></div><div class="heading-actions"><button class="ghost" data-go-page="songs">YouTube</button><button class="ghost" id="showSpotifyDesktopBtn">Abrir app de Spotify</button><button class="ghost" id="showSpotifyBtn">Ver Spotify Web</button></div></div>',
    1
)
renderer = renderer.replace('src="lulu-about.webp"', 'src="lulu-about-user.jpg"')
renderer = renderer.replace('const opacity = clamp(state.settings.panelOpacity ?? 78, 55, 100);', 'const opacity = clamp(state.settings.panelOpacity ?? 78, 20, 100);')
renderer = renderer.replace("$('panelOpacityInput').value = clamp(settings.panelOpacity ?? 78, 55, 100);", "$('panelOpacityInput').value = clamp(settings.panelOpacity ?? 78, 20, 100);")
old_go = "function goToPage(pageName) {\n  qsa('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === pageName));"
new_go = "function goToPage(pageName) {\n  const visibleNavPage = pageName === 'spotify' ? 'songs' : pageName;\n  qsa('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === visibleNavPage));"
renderer = replace_once(renderer, old_go, new_go, "la navegación principal")
write("src/renderer.js", renderer)

# ----- CSS: usar las imágenes proporcionadas y respetar la transparencia elegida.
css = read("src/styles.css")
css = css.replace('miku-classic.svg', 'miku-classic-user.jpg')
css = css.replace('miku-soft.svg', 'miku-soft-user.png')
css = css.replace('miku-dark.svg', 'miku-dark-user.png')
css += r'''

/* Lulu Finity 0.25.0: imágenes elegidas por el usuario sobre la interfaz existente. */
html[data-theme="miku-classic"]{--miku-art-opacity:.46}
html[data-theme="miku-soft"]{--miku-art-opacity:.43}
html[data-theme="miku-dark"]{--miku-art-opacity:.45}
html[data-theme^="miku-"] .app-shell::after{
  mix-blend-mode:multiply;
  filter:saturate(.96) contrast(1.02);
}
html[data-theme="miku-classic"] .panel{
  background:linear-gradient(145deg,rgba(8,39,43,var(--panel-opacity)),rgba(5,27,31,var(--panel-opacity)))!important;
}
html[data-theme="miku-soft"] .panel{
  background:linear-gradient(145deg,rgba(61,31,51,var(--panel-opacity)),rgba(43,24,48,var(--panel-opacity)))!important;
}
html[data-theme="miku-dark"] .panel{
  background:linear-gradient(145deg,rgba(26,20,54,var(--panel-opacity)),rgba(17,14,38,var(--panel-opacity)))!important;
}
html[data-theme^="miku-"] .settings-card,
html[data-theme^="miku-"] .stream-overlay-card,
html[data-theme^="miku-"] .command-help,
html[data-theme^="miku-"] .command-event-card{
  backdrop-filter:blur(16px) saturate(1.05);
}
'''
write("src/styles.css", css)

# Validaciones básicas del parche antes del empaquetado.
checks = {
    "src/index.html": [">Música</button>", ">Cuenta</button>", ">Overlays</button>", "id=\"page-account\"", "Mensajes automáticos en el LIVE", 'min="20" max="100"'],
    "src/renderer.js": ["visibleNavPage", "Música · Spotify", "lulu-about-user.jpg", "panelOpacity ?? 78, 20, 100"],
    "src/styles.css": ["miku-classic-user.jpg", "miku-soft-user.png", "miku-dark-user.png", "var(--panel-opacity)"]
}
for relative, tokens in checks.items():
    text = read(relative)
    for token in tokens:
        if token not in text:
            raise RuntimeError(f"Falta {token!r} en {relative}")

print("Lulu Finity 0.25.0 aplicada correctamente")
