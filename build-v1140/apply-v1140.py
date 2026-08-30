from pathlib import Path
import hashlib
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent
PAYLOAD = HERE / "files"

# SHA-256 de los archivos modificados dentro del ZIP oficial 1.1.1.
SOURCE_HASHES = {
    "package.json": "5d47dc448493eb2514c17c65b9354544ec9b88f77f54998ab1fedffb2013a5de",
    "package-lock.json": "beda51deef71b9180afaed5c000530afeb3cfb00a04c082949ba27e19ecfcc9f",
    "CHANGELOG.md": "a00b724e8f2cdba1379bc9dc59cd7d919ba013811824120fe6ac330dcf9de0fe",
    "src/main.js": "6c69a2ddd3f21ea09cf7e31e250e8adc69b6ed9ef78c0e7263dc1927cb769df5",
    "src/renderer.js": "c99b6c1222afd24fa628bf185e974cdca855bccccb10ddc39d72cbe2e36d74ec",
    "src/index.html": "a344526f83fe0f00a6a6673e8ba9976ea60f66386f0d789bbf6c2762b2cbf01d",
    "src/styles.css": "bab3d34ef7cd421698dcf420162d86bddb1894be6c7f4deb68a7e731bab52972",
    "railway-relay/package.json": "1fc8525298175aff00ca0780b50681d3cf5f08c77a884e242e6c3c08409aec71",
    "railway-relay/package-lock.json": "e99c07a09db42d0fec5e8c39fc88b3e87bde3dd31fc8bc5a8d1774eee98829c6",
    "railway-relay/.env.example": "3f8e9b2961e2b9f2b633eaa6ecd4324f125e1da69a7959d5dac931713e4f370d",
    "railway-relay/src/server.js": "b0e062e0efcd62085a37b94b7149233d31cfb9d96b0f554cb463ef31e2ff573e",
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
if package.get("version") != "1.1.1":
    raise SystemExit(f"Lulu Finity 1.1.4 espera la fuente 1.1.1, no {package.get('version')}")

for relative, expected in SOURCE_HASHES.items():
    source = ROOT / relative
    if not source.is_file():
        raise SystemExit(f"Falta el archivo base {relative}")
    actual = sha256(source)
    if actual != expected:
        raise SystemExit(f"La fuente 1.1.1 no coincide en {relative}: {actual}")

for source in sorted(path for path in PAYLOAD.rglob("*") if path.is_file()):
    relative = source.relative_to(PAYLOAD)
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

updated = json.loads(package_path.read_text(encoding="utf-8"))
if updated.get("version") != "1.1.4":
    raise SystemExit("El parche no produjo package.json 1.1.4")

print("Lulu Finity 1.1.4 reconstruida sobre la fuente oficial 1.1.1")
