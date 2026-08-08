from pathlib import Path
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent
FILES = HERE / "files"

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "0.34.2":
    raise SystemExit(f"Lulu Finity 1.0.0 espera la fuente 0.34.2, no {package.get('version')}")

for source in sorted(FILES.rglob("*")):
    if not source.is_file():
        continue
    relative = source.relative_to(FILES)
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else "# Cambios\n\n"
entry = """# Cambios

## 1.0.0

- Reorganiza toda la interfaz por tareas: LIVE, voz y audio, pantalla, interacciones, comunidad y sistema, sin crear categorías internas en el Panel.
- Añade búsqueda global de funciones para llegar directamente a TTS, diccionario, overlays, rendimiento y demás herramientas.
- Estrena Lulu Local: TTS sin Internet con voz mexicana incluida, proceso aislado y biblioteca para importar paquetes `.lfvoice`.
- Añade limpieza inteligente Unicode, normalización de letras decorativas, nombres sin emojis, bloqueo opcional CJK y detección de alfabetos mezclados.
- Añade diccionario de pronunciación y conserva voces por usuario, voz del sistema y voces online como respaldo.
- Reduce consumo al iniciar: overlays, widgets, catálogo online, navegador de resolución y motor local se cargan sólo al usarse.
- Añade perfiles de rendimiento, estado de módulos y liberación manual de recursos inactivos.
- Conserva Railway, YouTube con anti anuncios, Spotify, comandos, juegos, economía, automatizaciones, metas y temas de Lulu Studio.

"""
if changelog.startswith("# Cambios\n\n"):
    changelog = entry + changelog[len("# Cambios\n\n"):]
elif "## 1.0.0" not in changelog:
    changelog = entry + changelog
changelog_path.write_text(changelog, encoding="utf-8", newline="\n")

readme_path = ROOT / "README.md"
if readme_path.exists():
    readme = readme_path.read_text(encoding="utf-8")
    readme = readme.replace("0.34.2", "1.0.0")
    if "Lulu Local" not in readme:
        readme += "\n\n## Lulu Finity 1.0\n\nLulu Local permite leer el chat sin Internet e importar voces `.lfvoice`. La interfaz está organizada por tareas e incluye búsqueda global, limpieza Unicode y perfiles de rendimiento.\n"
    readme_path.write_text(readme, encoding="utf-8", newline="\n")

print("Lulu Finity 1.0.0: interfaz organizada y Lulu Local instalados")
