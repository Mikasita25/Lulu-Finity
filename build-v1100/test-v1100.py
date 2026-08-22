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
        self.theme_choices = []
        self.theme_options = []
        self.widget_theme_galleries = []
        self.permanent_previews = 0
        self.in_theme_select = False
        self.dialogs = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.append(values["id"])
        if tag == "select" and values.get("id") == "themeModeInput":
            self.in_theme_select = True
        elif tag == "option" and self.in_theme_select and values.get("value"):
            self.theme_options.append(values["value"])
        if "data-theme-choice" in values:
            self.theme_choices.append(values["data-theme-choice"])
        if "data-widget-theme-gallery" in values:
            self.widget_theme_galleries.append(values["data-widget-theme-gallery"])
        if "permanent-preview-badge" in values.get("class", "").split():
            self.permanent_previews += 1
        if values.get("id") in {"commandModal", "automationModal"}:
            self.dialogs[values["id"]] = values

    def handle_endtag(self, tag):
        if tag == "select" and self.in_theme_select:
            self.in_theme_select = False


package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
html = read("src/index.html")
css = read("src/styles.css")
renderer = read("src/renderer.js")
main = read("src/main.js")
readme = read("README.md")
changelog = read("CHANGELOG.md")

assert package["version"] == "1.1.0"
assert lock["version"] == "1.1.0"
assert lock["packages"][""]["version"] == "1.1.0"
assert package["build"]["extraResources"][-1] == {
    "from": "resources/tools",
    "to": "lulu-tools",
    "filter": ["cloudflared.exe"],
}
assert (ROOT / "resources" / "tools").is_dir()
assert 'id="versionLabel">v1.1.0' in html
assert 'id="updateVersionBadge">v1.1.0' in html
assert "## 1.1.0" in changelog
assert "## HTTPS para overlays y widgets" in readme
assert "## Optimización segura" in readme

audit = DocumentAudit()
audit.feed(html)
assert len(audit.ids) == len(set(audit.ids)), "Hay IDs HTML duplicados"
themes = {
    "pink", "blush", "purple", "red", "blue", "dark",
    "studio-lavender", "studio-pink", "studio-mint",
    "miku-classic", "miku-soft", "miku-dark",
}
assert set(audit.theme_options) == themes
assert set(audit.theme_choices) == themes
assert len(audit.theme_choices) == 12
assert set(audit.widget_theme_galleries) == {"playlist", "wallet", "game", "alert", "goal", "gift"}
assert audit.permanent_previews == 6
for dialog_id, title_id in (("commandModal", "commandModalTitle"), ("automationModal", "automationModalTitle")):
    dialog = audit.dialogs[dialog_id]
    assert dialog.get("role") == "dialog"
    assert dialog.get("aria-modal") == "true"
    assert dialog.get("aria-labelledby") == title_id

for token in (
    "--accent:var(--theme-a)",
    "--control-border:",
    'input[type="checkbox"]:checked',
    'input[type="radio"]:checked',
    ".switch input:checked+span",
    ".category-section-tabs",
    ".theme-choice-grid",
    ".creation-modal",
    ".automation-condition-grid",
    ".widget-theme-gallery",
    ".permanent-preview-badge",
    "@media(prefers-reduced-motion:reduce)",
):
    assert token in css, token
for theme in themes:
    assert f".theme-swatch.{theme}" in css, theme

for token in (
    "function updateAutomationComposer()",
    "function openAutomationModal()",
    "function saveAutomationFromComposer(event)",
    "function updateCommandCreationPreview()",
    "$('addAutomationRuleBtn')?.addEventListener('click',openAutomationModal)",
    "if (event.key !== 'Escape') return",
    "activeServices:activeServiceSnapshot()",
    "profile==='saving'?30000:profile==='balanced'?180000:0",
    "const STREAM_WIDGET_THEME_CATALOG = Object.freeze([",
    "function selectStreamWidgetTheme(type, theme)",
    "renderStreamWidgetThemeStudios()",
):
    assert token in renderer, token
background_function = re.search(r"function categoryRunsInBackground\(key\)\{(.*?)\n\}", renderer, re.S)
assert background_function
assert "hasRules || hasGoals" in background_function.group(1)
assert "activePage" not in background_function.group(1)

for token in (
    "backgroundThrottling: false",
    "powerSaveBlocker.start('prevent-app-suspension')",
    "function validateCloudflaredExecutable(executablePath)",
    "path.join(process.resourcesPath, 'lulu-tools', 'cloudflared.exe')",
    "releases/latest/download/${CLOUDFLARED_ASSET_NAME}",
    "La verificación de seguridad del componente HTTPS no coincidió",
    "overlayServer.listen(0, '127.0.0.1')",
    "activeServices&&typeof details.activeServices==='object'",
    "overlayPublicBaseUrl&&overlayTunnelProcess&&!overlayTunnelProcess.killed",
    "const keep=(key)=>nativeActive(key)||prepared(key)",
    "const STREAM_WIDGET_THEME_TOKENS = Object.freeze({",
    "function streamWidgetThemeCss(theme)",
    "streamWidgetThemes: { ...DEFAULT_STREAM_WIDGET_THEMES }",
    "if (!preview && current) return current",
    "if(!preview&&Number(data.expiresAt||0)>Date.now())",
    "theme=${encodeURIComponent(normalizeStreamWidgetTheme(theme))}",
    "next.searchParams.set('theme',data.theme)",
    "theme: normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes)[widgetType]",
    "setTimeout(poll,preview?1500:600)",
):
    assert token in main, token
page_activation = re.search(r"function activateRuntimeModuleForPage\(page\) \{(.*?)\n\}", main, re.S)
assert page_activation
assert "release" not in page_activation.group(1).lower()
assert "releasePageOnlyRuntime" not in main
assert "backgroundThrottling: true" not in main

widget_theme_ids = {
    "lulu", "aurora", "cyber", "arcade", "hologram", "sakura", "miku",
    "lavender", "sunset", "gold", "mint", "ocean", "vampire", "mono",
}
widget_catalog = re.search(r"const STREAM_WIDGET_THEME_CATALOG = Object\.freeze\(\[(.*?)\]\);", renderer, re.S)
main_widget_tokens = re.search(r"const STREAM_WIDGET_THEME_TOKENS = Object\.freeze\(\{(.*?)\n\}\);", main, re.S)
assert widget_catalog and set(re.findall(r"\bid:'([^']+)'", widget_catalog.group(1))) == widget_theme_ids
assert main_widget_tokens and set(re.findall(r"^\s{2}([a-z]+): \{", main_widget_tokens.group(1), re.M)) == widget_theme_ids
assert main.count("updatedAt:1") == 6

print(f"Lulu Finity 1.1.0 validada: {len(audit.ids)} IDs únicos, 12 temas de aplicación, 14 temas de fuentes y servicios activos protegidos")
