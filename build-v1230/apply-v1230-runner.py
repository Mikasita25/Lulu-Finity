from pathlib import Path
import sys

script_path = Path(__file__).with_name('apply-v1230.py')
source = script_path.read_text(encoding='utf-8')

old_init = '''renderer = replace_once(
    renderer,
    "  ensureV010Ui();\\n  setupNavigation();\\n  const initial = await api.getState();",
    "  ensureV010Ui();\\n  setupNavigation();\\n  bindTikTokGiftCatalog();\\n  const initial = await api.getState();",
    "enlace del catálogo en init",
)'''
new_init = '''setup_navigation_anchor = "  setupNavigation();"
if setup_navigation_anchor not in renderer:
    raise RuntimeError("enlace del catálogo en init: no se encontró setupNavigation")
renderer = renderer.replace(setup_navigation_anchor, setup_navigation_anchor + "\\n  bindTikTokGiftCatalog();", 1)'''

old_load = '''renderer = replace_once(
    renderer,
    "  try { await loadDefaultSounds(); }",
    "  try { await loadDefaultSounds(); }\\n  try { await loadTikTokGiftCatalog(); } catch {}",
    "carga del catálogo en init",
)'''
new_load = '''load_catalog_inserted = False
for load_anchor in ("  try { await loadDefaultSounds(); }", "  await loadDefaultSounds();"):
    if load_anchor in renderer:
        renderer = renderer.replace(load_anchor, load_anchor + "\\n  try { await loadTikTokGiftCatalog(); } catch {}", 1)
        load_catalog_inserted = True
        break
if not load_catalog_inserted:
    raise RuntimeError("carga del catálogo en init: no se encontró loadDefaultSounds")'''

for old, new, label in ((old_init, new_init, 'init'), (old_load, new_load, 'carga')):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'runner {label}: se esperaba 1 bloque y se encontraron {count}')
    source = source.replace(old, new, 1)

namespace = {
    '__name__': '__main__',
    '__file__': str(script_path),
    '__package__': None,
}
exec(compile(source, str(script_path), 'exec'), namespace)
