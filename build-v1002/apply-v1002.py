from pathlib import Path
import json
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.1":
    raise SystemExit(f"Lulu Finity 1.0.2 espera la fuente 1.0.1, no {package.get('version')}")
package["version"] = "1.0.2"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.2"
if isinstance(lock.get("packages", {}).get(""), dict):
    lock["packages"][""]["version"] = "1.0.2"
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

html_path = ROOT / "src/index.html"
html = html_path.read_text(encoding="utf-8")
html = replace_once(html, 'id="versionLabel">v1.0.1', 'id="versionLabel">v1.0.2', "versión de la barra")
html = replace_once(html, 'id="updateVersionBadge">v1.0.1', 'id="updateVersionBadge">v1.0.2', "versión de actualizaciones")
html_path.write_text(html, encoding="utf-8")

styles_path = ROOT / "src/styles.css"
styles = styles_path.read_text(encoding="utf-8")
marker = "/* Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical */"
if marker in styles:
    raise SystemExit("El arreglo de desplazamiento ya estaba aplicado")
styles += """

/* Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical */
html,body{min-width:0;min-height:0}
.app-shell{height:100vh;height:100dvh;min-width:0;min-height:0;grid-template-rows:40px minmax(0,1fr);overflow:hidden}
.sidebar{min-width:0;min-height:0}
.nav-list{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}
.main-content{grid-column:2;grid-row:2;min-width:0;min-height:0;height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;scrollbar-gutter:stable}
.modal-backdrop{overflow-y:auto;padding:20px;overscroll-behavior:contain}
.modal-card{max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow-y:auto;margin:auto;overscroll-behavior:contain}
.feature-search-results{max-height:min(340px,calc(100dvh - 140px))}
@media(max-height:720px){.main-content{padding-top:16px;padding-bottom:24px}.sidebar{padding-top:12px;padding-bottom:10px}.logo-wrap{padding-bottom:9px}.feature-search{margin-bottom:8px}.nav-list{gap:8px}.sidebar-bottom{margin-top:5px}}
"""
styles_path.write_text(styles, encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else "# Cambios\n\n"
entry = """# Cambios

## 1.0.2

- Permite desplazarse verticalmente por todas las funciones cuando la ventana no está maximizada.
- Mantiene la barra superior y la navegación visibles mientras el contenido central se desplaza.
- Hace desplazables la navegación lateral, los resultados de búsqueda y los diálogos en pantallas de poca altura.
- Conserva la organización, las voces, la configuración y la estética visual de Lulu Finity 1.0.1.

"""
if "## 1.0.2" not in changelog:
    if changelog.startswith("# Cambios\n\n"):
        changelog = entry + changelog[len("# Cambios\n\n"):]
    else:
        changelog = entry + changelog
changelog_path.write_text(changelog, encoding="utf-8")

print("Lulu Finity 1.0.2: desplazamiento adaptable instalado")
