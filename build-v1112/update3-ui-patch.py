from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, text):
    path.write_text(text, encoding="utf-8", newline="\n")


def replace_once(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"No se pudo aplicar {label}: se esperaba 1 coincidencia y hubo {count}")
    write(path, text.replace(old, new, 1))


src = ROOT / "src"
preview = src / "preview-panel.js"
update_js = src / "update3-ui.js"
update_css = src / "update3-ui.css"
for required in (preview, update_js, update_css):
    if not required.is_file():
        raise SystemExit(f"No se encontró {required}")

loader = r'''
  function loadUpdate3Assets() {
    if (!document.querySelector('link[data-lulu-update3]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'update3-ui.css';
      style.dataset.luluUpdate3 = 'style';
      document.head.appendChild(style);
    }
    if (document.querySelector('script[data-lulu-update3]')) return;
    const script = document.createElement('script');
    script.src = 'update3-ui.js';
    script.dataset.luluUpdate3 = '1';
    document.body.appendChild(script);
  }

'''
replace_once(
    preview,
    "  function activatePage() {",
    loader + "  function activatePage() {",
    "loader de Update 3.0"
)
replace_once(
    preview,
    "    loadRewardWheelAssets();\n    loadCustomizerAssets();",
    "    loadRewardWheelAssets();\n    loadCustomizerAssets();\n    loadUpdate3Assets();",
    "arranque no bloqueante de Update 3.0"
)

changelog_path = ROOT / "CHANGELOG.md"
if changelog_path.is_file():
    changelog = read(changelog_path)
    marker = "## 1.1.2\n"
    bullets = (
        "\n- Añade el sistema visual de botones cute sincronizado con los 12 temas de la aplicación, incluyendo estados hover, active, disabled, loading, éxito y peligro.\n"
        "- Las tarjetas de Apariencia muestran una miniatura del botón correspondiente al tema al pasar el cursor.\n"
        "- Muestra una sola vez por build instalado el mensaje público ‘Update 3.0 — Lulu Finity’, guardando `lastSeenVersion` en la configuración local existente.\n"
    )
    if "mensaje público ‘Update 3.0 — Lulu Finity’" not in changelog:
        if marker not in changelog:
            raise SystemExit("No se encontró la sección 1.1.2 del changelog")
        changelog = changelog.replace(marker, marker + bullets, 1)
        write(changelog_path, changelog)

preview_text = read(preview)
js_text = read(update_js)
css_text = read(update_css)
checks = {
    "loadUpdate3Assets": preview_text,
    "update3-ui.css": preview_text,
    "update3-ui.js": preview_text,
    "Update ${PUBLIC_UPDATE_LABEL} — Lulu Finity": js_text,
    "lastSeenVersion": js_text,
    "api.saveSettings": js_text,
    "Todo lo que ya incluye Lulu Finity": js_text,
    "scale(.97)": css_text,
    "aria-busy": css_text,
    "data-theme-choice=\"miku-dark\"": css_text,
}
for needle, haystack in checks.items():
    if needle not in haystack:
        raise SystemExit(f"Falta {needle!r} en la integración Update 3.0")

print("Update 3.0 visual integrada sin cambiar el build interno")
