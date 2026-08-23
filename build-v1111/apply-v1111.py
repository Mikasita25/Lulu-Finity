from pathlib import Path
import hashlib
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent
PAYLOAD = HERE / "files"

# Estos hashes corresponden al ZIP oficial Lulu-Finity-Source-1.1.0.zip.
# La comprobación evita aplicar el parche sobre una fuente distinta o alterada.
SOURCE_HASHES = {
    "package.json": "b5471e8ec8ed0ca3fe076772f57a376e0d10f52bf5a764f03c983547197acefd",
    "package-lock.json": "6dccf2c49af5d8f8e68963c6be4730f8f630fb246dabb016706ade2c94924754",
    "README.md": "b0589ffb0c2b35d3a88e31a25d47134a9c1d418205dd9805557774a017517de6",
    "CHANGELOG.md": "e2a9c63b1b8eda0ade38e17d965546b72fc0aa902ba2eb3b80e5efe858c8bd57",
    "NOTICE.md": "88d974651cb57c968e154f28a66a71c22b9e3695c9812c1fb3be61d45f22a27e",
    "src/index.html": "4c0263434c010c3f64b4995686d1ba8eded8e39e0f035f92b474be85e5fd2822",
    "src/styles.css": "7c149987a15fc1cc2815134e7833055707fd1348c4a5355a25078c2a6dd6b025",
    "src/renderer.js": "459b4ab6c4e60fc1692fd70125028b58e501a1e60741ee9855f10fb22998f45b",
    "src/main.js": "868eaf407b4916fd035c0e824c96e1cc6abed6f5bd6043f18faff2f6c593aad8",
    "src/preload.js": "375a9765a4b6cfbdf481fb8b6e2e7a4a9f525ecd5e53a02f5bd30f082a5ae475",
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
if package.get("version") != "1.1.0":
    raise SystemExit(f"Lulu Finity 1.1.1 espera la fuente 1.1.0, no {package.get('version')}")

for relative, expected in SOURCE_HASHES.items():
    source = ROOT / relative
    if not source.is_file():
        raise SystemExit(f"Falta el archivo base {relative}")
    actual = sha256(source)
    if actual != expected:
        raise SystemExit(f"La fuente 1.1.0 no coincide en {relative}: {actual}")

for source in sorted(path for path in PAYLOAD.rglob("*") if path.is_file()):
    relative = source.relative_to(PAYLOAD)
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

updated = json.loads(package_path.read_text(encoding="utf-8"))
if updated.get("version") != "1.1.1":
    raise SystemExit("El parche no produjo package.json 1.1.1")

sounds = sorted((ROOT / "src" / "default-sounds").glob("*.ogg"))
if len(sounds) != 24:
    raise SystemExit(f"Se esperaban 24 sonidos incluidos y se encontraron {len(sounds)}")

print("Lulu Finity 1.1.1 reconstruida sobre la fuente oficial 1.1.0")
