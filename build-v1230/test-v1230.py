from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
require(package.get("version") == "1.2.3", "package.json no quedó en 1.2.3")
require(lock.get("version") == "1.2.3", "package-lock.json no quedó en 1.2.3")
require(lock.get("packages", {}).get("", {}).get("version") == "1.2.3", "lock raíz no quedó en 1.2.3")

main = read("src/main.js")
for token in (
    "TIKTOK_GIFT_CATALOG_URL = 'https://beetgames.com/tiktok-gifts.json'",
    "TIKTOK_GIFT_CATALOG_TTL_MS",
    "tiktok-gift-catalog-cache.json",
    "normalizeTikTokGiftCatalogGift",
    "getTikTokGiftCatalog",
    "ipcMain.handle('tiktok-gifts:catalog'",
    "lastPayloadAt:0",
    "youtubeAdMuteFailsafeTimer",
):
    require(token in main, f"falta integración principal: {token}")

preload = read("src/preload.js")
require("getTikTokGiftCatalog: (options = {}) => ipcRenderer.invoke('tiktok-gifts:catalog', options)" in preload, "falta puente seguro del catálogo")

renderer = read("src/renderer.js")
for token in (
    "detectedTikTokGifts: []",
    "tiktokGiftCatalog: []",
    "giftCatalogRegion: 'MX'",
    "function rememberTikTokGift(event)",
    "function renderTikTokGiftCatalog()",
    "function loadTikTokGiftCatalog(force = false)",
    "function bindTikTokGiftCatalog()",
    "rememberTikTokGift(event);",
    "use-tiktok-gift",
    "automation-action-volume-input",
    "mediaVolume:Math.max(0,Math.min(1,Number(selected.volume??.9)))",
    "'1.2.3': Object.freeze([",
):
    require(token in renderer, f"falta comportamiento del catálogo: {token}")

require("event.giftName" in renderer, "las reglas dejaron de comparar giftName")
require("event.giftId" in renderer, "las reglas dejaron de comparar giftId")

index = read("src/index.html")
for token in (
    "v1.2.3",
    'id="tiktokGiftCatalogStatus"',
    'id="giftCatalogSearchInput"',
    'id="giftCatalogRegionInput"',
    'id="tiktokGiftCatalogResults"',
    'id="detectedTikTokGifts"',
    '<option value="MX">México</option>',
    '<option value="ALL">Global</option>',
):
    require(token in index, f"falta interfaz: {token}")

styles = read("src/styles.css")
for token in (".tiktok-gift-catalog,.detected-gifts-wrap{", ".tiktok-gift-catalog-results{", ".detected-tiktok-gifts{"):
    require(token in styles, f"falta estilo: {token}")

changelog = read("CHANGELOG.md")
require("## 1.2.3" in changelog, "falta changelog 1.2.3")

print("Lulu Finity 1.2.3 validada: catálogo TikTok, detección LIVE y volumen 1.2.2 conservados")
