from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
html = (ROOT / "src/index.html").read_text(encoding="utf-8")
renderer = (ROOT / "src/renderer.js").read_text(encoding="utf-8")
main = (ROOT / "src/main.js").read_text(encoding="utf-8")
changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
tiktok_catalog = (ROOT / "src/tiktok-voice-catalog.js").read_text(encoding="utf-8")
tiktok_catalog_test = (ROOT / "src/tiktok-voice-catalog.test.js").read_text(encoding="utf-8")


class PageStructureParser(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.section_stack = []
        self.page_stack = []
        self.pages = []
        self.errors = []

    @staticmethod
    def attributes(attrs):
        return {str(key): str(value or "") for key, value in attrs}

    def handle_starttag(self, tag, attrs):
        values = self.attributes(attrs)
        classes = set(values.get("class", "").split())
        is_page = tag == "section" and "page" in classes
        if is_page:
            page_id = values.get("id", "")
            parent = self.stack[-1] if self.stack else None
            if self.page_stack:
                self.errors.append(f"{page_id} quedó dentro de {self.page_stack[-1]}")
            if not parent or parent[0] != "main" or "main-content" not in parent[1]:
                self.errors.append(f"{page_id} no es hija directa de main-content")
            self.pages.append(page_id)
            self.page_stack.append(page_id)
        if tag == "section":
            self.section_stack.append(is_page)
        if tag not in self.VOID:
            self.stack.append((tag, classes))

    def handle_endtag(self, tag):
        if tag == "section":
            if not self.section_stack:
                self.errors.append("Hay un cierre </section> adicional")
            else:
                was_page = self.section_stack.pop()
                if was_page and self.page_stack:
                    self.page_stack.pop()
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break


assert package["version"] == "1.0.4"
assert lock["version"] == "1.0.4"
assert lock["packages"][""]["version"] == "1.0.4"
assert 'id="versionLabel">v1.0.4' in html
assert 'id="updateVersionBadge">v1.0.4' in html
assert "## 1.0.4" in changelog

parser = PageStructureParser()
parser.feed(html)
parser.close()
assert not parser.errors, parser.errors
assert not parser.page_stack, f"Categorías sin cerrar: {parser.page_stack}"
expected_pages = {
    "page-dashboard", "page-voice", "page-songs", "page-account", "page-commands",
    "page-rankings", "page-automations", "page-games", "page-economy", "page-settings",
}
assert set(parser.pages) == expected_pages, parser.pages
assert html.count("<section") == html.count("</section>"), "Cantidad desigual de secciones"

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f"IDs duplicados: {duplicates}"

for token in (
    "const PAGE_PREVIEW_FRAMES = Object.freeze",
    "return qsa('.main-content > .page')",
    "page.hidden = !visible",
    "page.inert = !visible",
    "page.setAttribute('aria-hidden'",
    "document.body.dataset.activePage = pageName",
    "suspendPageView(previousPage)",
    "options.activateModules !== false",
    "options.notifyMain !== false",
    "applyPageVisibility(state.activePage)",
    "goToPage('dashboard', { activateModules:false, scroll:false })",
    "categoryRunsInBackground('automations')",
    "state.activePage==='rankings'",
    "pageByWidget={playlist:'rankings'",
    "const tiktokSpanishCount = state.tiktokVoices.filter",
    "voces TikTok · ${tiktokSpanishCount} en español",
):
    assert token in renderer, token

assert "qsa('.page').forEach((page) => page.classList.toggle('active'" not in renderer
assert "state.loadedPages.has('automations')" not in renderer

for token in (
    "const RUNTIME_MODULE_BY_PAGE = Object.freeze",
    "let visibleRuntimeModule = null",
    "function releasePageOnlyRuntime(previousModule)",
    "runtimeModuleRetained(previousModule)",
    "runtimeModuleInUse(previousModule)",
    "active:activeRuntimeModuleNames(), visible:visibleRuntimeModule",
    "LULU_NAVIGATION_SMOKE_MARKER",
    "document.querySelectorAll('.main-content > .page')",
    "goToPage(name,{activateModules:false,notifyMain:false,scroll:false})",
    "visibleCount===1",
):
    assert token in main, token

assert main.count("skipTaskbar: true") >= 4
assert "appendSwitch('single-process')" not in main
assert "sandbox: false" not in main
assert "nodeIntegration: true" not in main
assert "activateRuntimeModule(moduleByPage" not in main

for preserved in (
    "if (moduleName === 'live') return Boolean(liveConnection)",
    "if (moduleName === 'music') return Boolean((youtubeWindow",
    "if (moduleName === 'account') return Boolean(tiktokChatWindow",
    "if (moduleName === 'rankings') return rankingClientCount() > 0",
    "if (moduleName === 'games') return Boolean(liveGameManager?.blackjackHands?.size)",
    "overlayClientCount() + rankingClientCount() + streamWidgetClientCount() === 0",
):
    assert preserved in main, preserved

spanish_tiktok_voices = {
    "es_mx_female_supermom": ("Super Mamá", "es-MX"),
    "es_mx_002": ("Álex", "es-MX"),
    "es_female_f6": ("Alejandra", "es-ES"),
    "es_male_m3": ("Julio", "es-ES"),
    "es_female_fp1": ("Mariana", "es-ES"),
    "es_002": ("Voz masculina de España", "es-ES"),
}
for voice_id, (name, locale) in spanish_tiktok_voices.items():
    assert f"['{voice_id}', '{name}', '{locale}', 'Español']" in tiktok_catalog, voice_id
assert tiktok_catalog.count("'Español']") == 6
assert "assert.deepEqual(" in tiktok_catalog_test
assert "spanishVoices.filter((voice) => voice.locale === 'es-MX').length, 2" in tiktok_catalog_test
assert "spanishVoices.filter((voice) => voice.locale === 'es-ES').length, 4" in tiktok_catalog_test

print(f"Lulu Finity 1.0.4: {len(parser.pages)} categorías y {len(spanish_tiktok_voices)} voces TikTok en español validadas")
