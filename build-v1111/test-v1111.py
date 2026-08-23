from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


class DocumentAudit(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.scripts = []
        self.dialogs = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.append(values["id"])
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        if values.get("role") == "dialog" and values.get("id"):
            self.dialogs[values["id"]] = values


package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
html = read("src/index.html")
css = read("src/styles.css")
renderer = read("src/renderer.js")
main = read("src/main.js")
preload = read("src/preload.js")
catalog = read("src/default-sound-catalog.js")
policy = read("src/chat-reading-policy.js")
readme = read("README.md")
changelog = read("CHANGELOG.md")
notice = read("NOTICE.md")

assert package["version"] == "1.1.1"
assert lock["version"] == "1.1.1"
assert lock["packages"][""]["version"] == "1.1.1"
assert {"from": "src/default-sounds", "to": "lulu-default-sounds"} in package["build"]["extraResources"]
assert 'id="versionLabel">v1.1.1' in html
assert 'id="updateVersionBadge">v1.1.1' in html
assert "## 1.1.1" in changelog
assert "## Biblioteca de sonidos" in readme
assert "## Conversaciones entre usuarios" in readme
assert "## Sonidos incluidos de Kenney" in notice
for url in (
    "https://kenney.nl/assets/interface-sounds",
    "https://kenney.nl/assets/casino-audio",
    "https://kenney.nl/support",
):
    assert url in notice

audit = DocumentAudit()
audit.feed(html)
assert len(audit.ids) == len(set(audit.ids)), "Hay IDs HTML duplicados"
required_ids = {
    "ignoreDirectedMentionsInput", "soundLibraryModal", "soundLibraryTitle",
    "soundLibrarySearchInput", "soundCategoryFilters", "defaultSoundGrid",
    "openSoundSourceBtn", "soundLibrarySelection", "pickOwnSoundBtn",
    "useDefaultSoundBtn",
}
assert required_ids <= set(audit.ids)
sound_dialog = audit.dialogs["soundLibraryModal"]
assert sound_dialog.get("aria-modal") == "true"
assert sound_dialog.get("aria-labelledby") == "soundLibraryTitle"
assert audit.scripts[-3:] == ["text-processor.js", "chat-reading-policy.js", "renderer.js"]
assert "media-src 'self' file: data: blob:" in html

sound_directory = ROOT / "src" / "default-sounds"
sounds = sorted(sound_directory.glob("*.ogg"))
assert len(sounds) == 24, len(sounds)
assert all(sound.read_bytes()[:4] == b"OggS" for sound in sounds)
assert (sound_directory / "LICENSE-KENNEY-INTERFACE.txt").is_file()
assert (sound_directory / "LICENSE-KENNEY-CASINO.txt").is_file()
assert "CC0" in (sound_directory / "LICENSE-KENNEY-INTERFACE.txt").read_text(encoding="utf-8", errors="ignore")
assert "CC0" in (sound_directory / "LICENSE-KENNEY-CASINO.txt").read_text(encoding="utf-8", errors="ignore")

catalog_block = re.search(r"const DEFAULT_SOUND_DEFINITIONS = Object\.freeze\(\[(.*?)\]\);", catalog, re.S)
assert catalog_block
sound_ids = re.findall(r"\bid:'([^']+)'", catalog_block.group(1))
sound_files = re.findall(r"\bfile:'([^']+\.ogg)'", catalog_block.group(1))
assert len(sound_ids) == len(set(sound_ids)) == 24
assert set(sound_files) == {sound.name for sound in sounds}
assert {"Alertas", "Digital", "Juegos"} == set(re.findall(r"\bcategory:'([^']+)'", catalog_block.group(1)))
for token in (
    "pathToFileURL(soundPath).href",
    "license: 'CC0'",
    "defaultSoundCatalog(packagedDefaultSoundsDirectory())",
    "path.join(process.resourcesPath, 'lulu-default-sounds')",
    "ipcMain.handle('sounds:list-default'",
    "ipcMain.handle('sounds:open-source'",
):
    assert token in catalog + main, token
for token in (
    "listDefaultSounds: () => ipcRenderer.invoke('sounds:list-default')",
    "openDefaultSoundSource: () => ipcRenderer.invoke('sounds:open-source')",
):
    assert token in preload, token
for token in (
    "async function loadDefaultSounds()",
    "function openSoundLibrary(options = {})",
    "function bindSoundLibrary()",
    "Agregar sonido propio",
    "soundId",
    "resolveDefaultSound",
    "bindAutomationSoundLibrary",
    "state.commandMediaDraft.type !== expectedMediaType",
):
    assert token in renderer + html, token

background_ids = {
    "plain", "stars", "aurora", "grid", "glass", "bubbles",
    "vinyl", "pixel", "waves", "confetti", "spotlight", "midnight",
}
renderer_backgrounds = re.search(r"const STREAM_WIDGET_BACKGROUND_CATALOG = Object\.freeze\(\[(.*?)\]\);", renderer, re.S)
main_backgrounds = re.search(r"const STREAM_WIDGET_BACKGROUND_IDS = new Set\(\[(.*?)\]\);", main, re.S)
assert renderer_backgrounds and set(re.findall(r"\bid:'([^']+)'", renderer_backgrounds.group(1))) == background_ids
assert main_backgrounds and set(re.findall(r"'([^']+)'", main_backgrounds.group(1))) == background_ids
assert len(re.findall(r"\.background-[a-z-]+ \.widget-background-swatch", css)) == 12
for widget, label in {
    "playlist": "Música", "wallet": "Monedas", "game": "Juegos y Ruleta",
    "alert": "Alertas", "goal": "Metas", "gift": "Regalos",
}.items():
    assert f"{widget}:'" in renderer
    assert f"{widget}: '" in main
    assert f"{widget}:'{label}'" in renderer
for token in (
    "function ensureStreamWidgetBackgroundStudios()",
    "function selectStreamWidgetBackground(type, background)",
    "streamWidgetBackgrounds: { ...DEFAULT_STREAM_WIDGET_BACKGROUNDS }",
    "background=${encodeURIComponent(normalizeStreamWidgetBackground(background))}",
    "activeBackground=${safeBackground}",
    "data.background!==activeBackground",
    "next.searchParams.set('background',data.background)",
    "background: normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds)[widgetType]",
):
    assert token in renderer + main, token

assert "ignoreDirectedMentions: true" in main
assert "window.LuluChatPolicy?.isDirectedReply(originalText)" in renderer
assert "conversación entre usuarios" in renderer
assert "DIRECTED_REPLY_PATTERN" in policy
assert (ROOT / "src" / "chat-reading-policy.test.js").is_file()
process_chat = re.search(r"async function processChat\(message, simulated = false\) \{(.*?)\n\}", renderer, re.S)
assert process_chat
flow = process_chat.group(1)
assert flow.index("findCommand") < flow.index("parseLiveGameCommand") < flow.index("parseSongCommand") < flow.index("filterComment")

for token in (
    ".directed-reply-setting",
    ".widget-background-gallery",
    ".widget-background-choice",
    ".sound-library-modal",
    ".default-sound-grid",
    ".default-sound-card",
    "@media(max-width:560px)",
):
    assert token in css, token

print(
    f"Lulu Finity 1.1.1 validada: {len(audit.ids)} IDs únicos, "
    "24 sonidos CC0, filtro @usuario y 12 fondos para cada una de 6 fuentes"
)
