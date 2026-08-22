from pathlib import Path
import hashlib
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent
PAYLOAD = HERE / "files"

SOURCE_HASHES = {
    "package.json": "ff93252894b8fbf08c00f161200638ca3cf143357009b4d21d3d2ea8defcb42c",
    "package-lock.json": "2121a161be0da72d04252100d72a87bfc3e1c401ac021ee2bfc6ea47e696859c",
    "README.md": "83a77dde344ab2c5a603b82fb2764ee35971ac7f902f16a49acd0ee94b4a14ee",
    "CHANGELOG.md": "0ea9ad0a722501fd18c87b7e97dafa43d4f491530b55806a7b1a5247bf89610a",
    "src/index.html": "51cba4c8cf35905eee6e37c098d9e7c8cfcaa6c01f077c5e94417c090d712505",
    "src/styles.css": "c4d7999b7419d5a2d23d650c71c934972387575afd1fd6ac160d75294054166f",
    "src/renderer.js": "9fc1cf35029ce06a177902569ebb3be1590f0b621812f1aec283ec2c416bfc60",
    "src/main.js": "5a9140572280684683e8a78dc8aa506792b50cf02844953824bbdaa225da5b6d",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


package_path = ROOT / "package.json"
if not package_path.is_file():
    raise SystemExit(f"No se encontró package.json en {ROOT}")
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.5":
    raise SystemExit(f"Lulu Finity 1.1.0 espera la fuente 1.0.5, no {package.get('version')}")

for relative, expected in SOURCE_HASHES.items():
    source = ROOT / relative
    if not source.is_file():
        raise SystemExit(f"Falta el archivo base {relative}")
    actual = sha256(source)
    if actual != expected:
        raise SystemExit(f"La fuente 1.0.5 no coincide en {relative}: {actual}")

for source in sorted(path for path in PAYLOAD.rglob("*") if path.is_file()):
    relative = source.relative_to(PAYLOAD)
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

# electron-builder necesita que el origen de extraResources exista incluso
# antes de que CI coloque aquí el binario oficial verificado.
(ROOT / "resources" / "tools").mkdir(parents=True, exist_ok=True)

updated = json.loads(package_path.read_text(encoding="utf-8"))
if updated.get("version") != "1.1.0":
    raise SystemExit("El parche no produjo package.json 1.1.0")
if "Lulu Finity 1.1" not in updated.get("description", ""):
    raise SystemExit("La descripción final de 1.1.0 es inválida")

print("Lulu Finity 1.1.0 reconstruida sobre la fuente oficial 1.0.5")
