from pathlib import Path
import sys


root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
source = (Path(__file__).resolve().parents[1] / "build-v1002" / "test-v1002.py").read_text(encoding="utf-8")
replacements = {
    'assert package["version"] == "1.0.2"': 'assert package["version"] == "1.0.4"',
    'assert lock["version"] == "1.0.2"': 'assert lock["version"] == "1.0.4"',
    'assert lock["packages"][""]["version"] == "1.0.2"': 'assert lock["packages"][""]["version"] == "1.0.4"',
    "assert 'id=\"versionLabel\">v1.0.2' in html": "assert 'id=\"versionLabel\">v1.0.4' in html",
    "assert 'id=\"updateVersionBadge\">v1.0.2' in html": "assert 'id=\"updateVersionBadge\">v1.0.4' in html",
    'assert "if (!activeRuntimeModules.has(\'rankings\') && rankingClientCount() === 0) return;" in main': 'assert "if (!runtimeModuleActive(\'rankings\') && rankingClientCount() === 0) return;" in main',
    'assert "!state.loadedPages.has(\'automations\')" in renderer': 'assert "categoryRunsInBackground(\'automations\')" in renderer',
    'startup = re.search(r"app\\.whenReady\\(\\)\\.then\\(async \\(\\) => \\{(.*?)\\n\\}\\);", main, re.S)\nassert startup, "No se encontró el arranque de Electron"': 'startup = re.search(r"async function startApplication\\(\\) \\{(.*?)\\n\\}", main, re.S)\nassert startup, "No se encontró el arranque controlado de Electron"',
}
for old, new in replacements.items():
    if source.count(old) != 1:
        raise SystemExit(f"No se pudo adaptar la regresión: {old}")
    source = source.replace(old, new, 1)

sys.argv = [str(Path(__file__).resolve()), str(root)]
exec(compile(source, str(Path(__file__).resolve()), "exec"), {"__name__": "__main__", "__file__": str(Path(__file__).resolve())})
