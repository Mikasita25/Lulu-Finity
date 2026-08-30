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
        self.dialogs = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.append(values["id"])
        if values.get("role") == "dialog" and values.get("id"):
            self.dialogs[values["id"]] = values


package = json.loads(read("package.json"))
lock = json.loads(read("package-lock.json"))
html = read("src/index.html")
css = read("src/styles.css")
renderer = read("src/renderer.js")
main = read("src/main.js")
notice_policy = read("src/release-notice-policy.js")
relay = read("railway-relay/src/server.js")
store = read("railway-relay/src/overlay-store.js")
overlay_page = read("railway-relay/src/overlay-page.js")

assert package["version"] == "1.1.4"
assert lock["version"] == "1.1.4"
assert lock["packages"][""]["version"] == "1.1.4"
assert 'id="versionLabel">v1.1.4' in html
assert 'id="updateVersionBadge">v1.1.4' in html
assert "## 1.1.4" in read("CHANGELOG.md")

audit = DocumentAudit()
audit.feed(html)
assert len(audit.ids) == len(set(audit.ids)), "Hay IDs HTML duplicados"
assert {
    "installWelcomeModal", "installWelcomeTitle", "startInstallWelcomeBtn",
    "updateWelcomeModal", "updateWelcomeTitle", "startUpdate3Btn",
} <= set(audit.ids)
install_welcome = audit.dialogs["installWelcomeModal"]
update_welcome = audit.dialogs["updateWelcomeModal"]
assert install_welcome.get("aria-modal") == "true"
assert install_welcome.get("aria-labelledby") == "installWelcomeTitle"
assert install_welcome.get("aria-describedby") == "installWelcomeSummary"
assert update_welcome.get("aria-modal") == "true"
assert update_welcome.get("aria-labelledby") == "updateWelcomeTitle"
assert update_welcome.get("aria-describedby") == "updateWelcomeSummary"
assert len(re.findall(r'data-theme-choice="[^"]+"', html)) == 12
assert len(re.findall(r'data-preview-fallback="[^"]+"', html)) == 7
for token in (
    "PRIMER INICIO", "Lulu Finity está lista", "Todo quedó listo para empezar.",
    "UPDATE 3.0", "Lulu Finity se actualizó", "Lo más reciente del parche",
    'src="release-notice-policy.js"', "La URL HTTPS se conserva al reiniciar.",
    "frame-src http://127.0.0.1:*", "update3-title-pill", "MUESTRA PERMANENTE",
    "preview-fallback-ranking", "preview-fallback-playlist", "preview-fallback-wallet",
):
    assert token in html, token
for stale_copy in (
    "Esto es lo nuevo y lo que ya puedes usar.", "Todo lo que ya puedes usar",
    "enlace seguro temporal", "El HTTPS puede cambiar al reiniciar Lulu",
    "Diseña una respuesta del LIVE", "sin llenar la pantalla de campos",
    "OPTIMIZACIÓN SEGURA",
):
    assert stale_copy not in html, stale_copy
for token in (
    "--button-radius:16px", "button:active:not(:disabled)", "button:disabled",
    '[aria-busy="true"]', ".btn-sm", ".btn-md", ".btn-lg",
    ".theme-choice::after", "html[data-theme^=\"miku-\"]",
    ".release-notice-card", ".install-notice-card", ".release-note-list",
    ".overlay-preview-fallback", ".preview-ready iframe",
    ".update3-title-pill", ".primary::after", ".widget-style-editor",
    ".widget-style-color-grid", ".widget-style-range-grid",
    "Los overlays y sus muestras no ejecutan animaciones continuas",
):
    assert token in css, token
for token in (
    "function setupReleaseNotices(currentVersion)", "mode === 'install'",
    "state.settings.lastSeenVersion = version", "event.target === modal",
    "api.saveSettings(state.settings)", "RELEASE_NOTES[version]",
    "PERMANENT_PREVIEW_FRAMES", "lulu-permanent-preview-ready",
    "markPermanentPreviewLoading(frame)", "DEFAULT_STREAM_WIDGET_STYLES",
    "normalizedStreamWidgetStyles", "ensureStreamWidgetStyleEditors",
    "data-widget-style-field", "scheduleStreamWidgetStyleRefresh",
    "visible:requestedCurrent || queue.length > 0", "!current.isRecommendation",
):
    assert token in renderer, token
for token in (
    "function releaseNoticeMode", "function firstInstalledVersionFor",
    "firstInstalledVersion", "lastSeenVersion", "compareVersions(current, seen) <= 0",
):
    assert token in notice_policy, token
assert (ROOT / "src" / "release-notice-policy.test.js").is_file()

for token in (
    "STABLE_OVERLAY_BASE_URL = 'https://lulu-finity-production.up.railway.app'",
    "overlayRelaySecret", "activeHttpsSources", "stableOverlayPublicId",
    "syncStableOverlaySource", "flushStableOverlaySync(true)", "uploadStableOverlayAsset",
    "delete rendererSettings.overlayRelaySecret", "ensureOverlayHttpsTunnel(true)",
    "http://127.0.0.1", "AbortSignal.timeout(12000)", "firstInstalledVersion",
    "settingsExistedBeforeInitialization", "normalizeStreamWidgetStyles",
    "streamWidgetCustomCss", "style: styles[name]", "style:styles[normalized]",
    "lulu-permanent-preview-ready", "previews.fallbackCount===7",
    "previews.readyCount===7", "previews.frameSources>=1",
    "data.visible===false||(!data.current&&!items.length)", "visible:false, current:null",
):
    assert token in main, token
for token in (
    "backgroundThrottling: false", "persist:lulu-youtube", "persist:lulu-spotify",
    "powerSaveBlocker.start('prevent-app-suspension')", "render-process-gone",
    "recoverActiveMusicPlayers('resume')", "shouldRecoverPlayback", "expectedPlaying",
):
    assert token in main, token
assert (ROOT / "src" / "music-recovery-policy.js").is_file()
assert (ROOT / "src" / "music-recovery-policy.test.js").is_file()
assert (ROOT / "src" / "widget-editor.test.js").is_file()

for token in (
    "parts[0] === 'overlays'", "parts[1] === 'overlays'", "overlayStore.putSource", "overlayStore.putAsset",
    "content-security-policy", "stableHttps: true",
):
    assert token in relay, token
for token in (
    "const themeMap=", "hologram:", "sakura:", "vampire:",
    "const backgroundMap=", "confetti:", "midnight:",
    "style?.enabled===true", "style.primaryColor", "style.backgroundOpacity",
    "applyAppearance(data)", "--goal-height",
    "data.visible===false", "!data.current&&!items.length", "root.replaceChildren();return",
):
    assert token in overlay_page, token
for removed_animation in (
    "widget-enter", "disc-spin", "alert-float", "goal-flow", "gift-float", "game-win",
):
    assert removed_animation not in main, removed_animation
for removed_animation in ("animation:", "@keyframes", "transition:"):
    assert removed_animation not in overlay_page, removed_animation
for token in (
    "timingSafeEqual", "path.basename", "MAX_ASSET_BYTES", "assetLooksValid",
    "createHash('sha256')", "fsp.rename(temporary, file)",
):
    assert token in store, token

print(
    f"Lulu Finity 1.1.4 validada: {len(audit.ids)} IDs únicos, editor propio, "
    "HTTPS fiel y overlays sin animaciones"
)
