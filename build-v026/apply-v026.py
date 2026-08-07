from pathlib import Path
import json, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')

def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'No se encontró {label}')
    return text.replace(old, new, 1)

# Version
package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '0.26.0'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')

# Changelog
changelog_path = ROOT / 'CHANGELOG.md'
old = changelog_path.read_text(encoding='utf-8') if changelog_path.exists() else ''
notes = '''# Cambios\n\n## 0.26.0\n\n- Elimina la categoría independiente Permisos.\n- Mueve el proveedor de música, quién puede pedir canciones y la lista de usuarios permitidos dentro de Música.\n- Mueve quién puede ser leído y la lista de usuarios permitidos para TTS dentro de Voz TTS.\n- Conserva los mismos valores, IDs y lógica de permisos para no perder configuraciones existentes.\n\n'''
changelog_path.write_text(notes + old, encoding='utf-8', newline='\n')

html = read('src/index.html')

# Quitar solo el acceso de navegación a Permisos.
html = replace_once(
    html,
    '        <button class="nav-item" data-page="permissions"><span>♢</span>Permisos</button>\n',
    '',
    'la categoría Permisos en la navegación'
)

# Quitar la página independiente completa.
permissions_pattern = re.compile(r'\n\s*<section class="page" id="page-permissions">.*?\n\s*</section>\n', re.S)
html, count = permissions_pattern.subn('\n', html, count=1)
if count != 1:
    raise RuntimeError('No se pudo eliminar la página independiente de Permisos')

music_permissions = r'''
        <div class="permissions-layout expanded-permissions integrated-permissions music-permissions-section">
          <article class="panel permission-card provider-card"><h2>Proveedor de música</h2>
            <label class="permission-option"><input type="radio" name="musicProvider" value="youtube" /><span><strong>YouTube</strong><small>El comando general busca y reproduce videos en YouTube.</small></span></label>
            <label class="permission-option"><input type="radio" name="musicProvider" value="spotify" /><span><strong>Spotify</strong><small>El mismo comando general usa la sesión de Spotify.</small></span></label>
            <p class="hint">No se crea un comando separado para Spotify. <strong id="activeMusicCommandHint">!cancion</strong> siempre usa la plataforma seleccionada.</p>
          </article>
          <article class="panel permission-card"><h2>Quién puede pedir música</h2>
            <label class="permission-option"><input type="radio" name="musicPermissionMode" value="selected" /><span><strong>Usuarios elegidos por mí</strong><small>Solo las cuentas de la lista de música.</small></span></label>
            <label class="permission-option"><input type="radio" name="musicPermissionMode" value="members" /><span><strong>Miembros desde cierto nivel</strong><small>Usa el nivel que TikTok envía en el comentario.</small></span></label>
            <div class="member-level-row"><label>Nivel mínimo</label><input id="minimumMemberLevelInput" type="number" min="1" max="50" value="1" /></div>
            <label class="permission-option"><input type="radio" name="musicPermissionMode" value="followers" /><span><strong>Solo seguidores</strong><small>Incluye miembros identificados por TikTok.</small></span></label>
            <label class="permission-option"><input type="radio" name="musicPermissionMode" value="all" /><span><strong>Todos</strong><small>Cualquier comentario puede pedir música.</small></span></label>
          </article>
          <article class="panel allowed-users-card"><div class="panel-header"><div><h2>Usuarios permitidos para música</h2></div><span class="count-pill" id="allowedUsersCount">0</span></div><div class="allowed-add-row"><div class="username-field"><span>@</span><input id="allowedUserInput" placeholder="usuario" /></div><button class="secondary" id="addAllowedUserBtn">Añadir</button></div><div class="allowed-users-list" id="allowedUsersList"></div></article>
          <article class="panel permission-info"><h3>Cómo se comprueba</h3><p>Lulu usa las insignias y datos que TikTok entrega con cada comentario. Cuando TikTok no envía esa información, la cuenta no se considera seguidora o miembro. La lista manual de música siempre funciona.</p></article>
        </div>
'''

tts_permissions = r'''
        <div class="permissions-layout expanded-permissions integrated-permissions tts-permissions-section">
          <article class="panel permission-card"><h2>Quién puede ser leído por TTS</h2>
            <label class="permission-option"><input type="radio" name="ttsPermissionMode" value="selected" /><span><strong>Usuarios elegidos por mí</strong><small>Solo las cuentas de la lista de lectura.</small></span></label>
            <label class="permission-option"><input type="radio" name="ttsPermissionMode" value="members" /><span><strong>Miembros desde cierto nivel</strong><small>Permite leer únicamente miembros con el nivel indicado.</small></span></label>
            <div class="member-level-row"><label>Nivel mínimo</label><input id="minimumTtsMemberLevelInput" type="number" min="1" max="50" value="1" /></div>
            <label class="permission-option"><input type="radio" name="ttsPermissionMode" value="followers" /><span><strong>Solo seguidores</strong><small>Incluye miembros identificados por TikTok.</small></span></label>
            <label class="permission-option"><input type="radio" name="ttsPermissionMode" value="all" /><span><strong>Todos</strong><small>Cualquier comentario aceptado puede ser leído.</small></span></label>
          </article>
          <article class="panel allowed-users-card"><div class="panel-header"><div><h2>Usuarios permitidos para TTS</h2></div><span class="count-pill" id="allowedTtsUsersCount">0</span></div><div class="allowed-add-row"><div class="username-field"><span>@</span><input id="allowedTtsUserInput" placeholder="usuario" /></div><button class="secondary" id="addAllowedTtsUserBtn">Añadir</button></div><div class="allowed-users-list" id="allowedTtsUsersList"></div></article>
          <article class="panel permission-info"><h3>Cómo se comprueba</h3><p>Lulu usa las insignias y datos que TikTok entrega con cada comentario. Cuando TikTok no envía esa información, la cuenta no se considera seguidora o miembro. La lista manual de TTS siempre funciona.</p></article>
        </div>
'''

# Insertar TTS justo al final de Voz TTS, antes de Música.
voice_to_songs = '      </section>\n\n      <section class="page" id="page-songs">'
html = replace_once(html, voice_to_songs, tts_permissions + '      </section>\n\n      <section class="page" id="page-songs">', 'el final de Voz TTS')

# Insertar permisos musicales justo al final de Música, antes de Filtros.
songs_to_filters = '      </section>\n\n      <section class="page" id="page-filters">'
html = replace_once(html, songs_to_filters, music_permissions + '      </section>\n\n      <section class="page" id="page-filters">', 'el final de Música')

write('src/index.html', html)

# Estilo: separar visualmente las secciones integradas sin crear una interfaz nueva.
css = read('src/styles.css')
css += '''\n\n/* Lulu Finity 0.26.0: permisos integrados en las categorías relacionadas. */\n.integrated-permissions{margin-top:14px}\n.integrated-permissions .permission-info{margin-bottom:0}\n'''
write('src/styles.css', css)

# Validación del parche.
final_html = read('src/index.html')
required = [
    'id="page-voice"', 'Quién puede ser leído por TTS', 'name="ttsPermissionMode"',
    'id="allowedTtsUsersList"', 'id="page-songs"', 'Quién puede pedir música',
    'name="musicPermissionMode"', 'name="musicProvider"', 'id="allowedUsersList"'
]
for token in required:
    if token not in final_html:
        raise RuntimeError(f'Falta {token}')
if 'data-page="permissions"' in final_html or 'id="page-permissions"' in final_html:
    raise RuntimeError('La categoría Permisos sigue visible o existe como página independiente')
if final_html.count('name="musicPermissionMode"') != 4:
    raise RuntimeError('Los permisos de música no se movieron correctamente')
if final_html.count('name="ttsPermissionMode"') != 4:
    raise RuntimeError('Los permisos de TTS no se movieron correctamente')

print('Parche 0.26.0 aplicado correctamente.')
