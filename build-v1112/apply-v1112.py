from pathlib import Path
import json
import shutil
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent
PAYLOAD = HERE / "files"


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, text):
    path.write_text(text, encoding="utf-8", newline="\n")


def replace_once(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"No se pudo aplicar {label}: se esperó 1 coincidencia y hubo {count}")
    write(path, text.replace(old, new, 1))


package_path = ROOT / "package.json"
if not package_path.is_file():
    raise SystemExit(f"No se encontró package.json en {ROOT}")
package = json.loads(read(package_path))
if package.get("version") != "1.1.1":
    raise SystemExit(f"Lulu Finity 1.1.2 espera la fuente oficial 1.1.1, no {package.get('version')}")

# Copia únicamente archivos nuevos. Los archivos grandes de 1.1.1 se parchean abajo
# para mantener el update pequeño y auditable.
for source in sorted(path for path in PAYLOAD.rglob("*") if path.is_file()):
    relative = source.relative_to(PAYLOAD)
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

package["version"] = "1.1.2"
package["description"] = "Lulu Finity 1.1.2: HTTPS autorrecuperable y vista previa local integrada"
write(package_path, json.dumps(package, ensure_ascii=False, indent=2) + "\n")

lock_path = ROOT / "package-lock.json"
lock = json.loads(read(lock_path))
lock["version"] = "1.1.2"
if isinstance(lock.get("packages"), dict) and isinstance(lock["packages"].get(""), dict):
    lock["packages"][""]["version"] = "1.1.2"
write(lock_path, json.dumps(lock, ensure_ascii=False, indent=2) + "\n")

index_path = ROOT / "src" / "index.html"
replace_once(
    index_path,
    "connect-src 'self'; media-src 'self' file: data: blob:;",
    "connect-src 'self'; frame-src 'self' http://127.0.0.1:*; media-src 'self' file: data: blob:;",
    "CSP local para la vista previa"
)
replace_once(
    index_path,
    '<link href="styles.css" rel="stylesheet"/>',
    '<link href="styles.css" rel="stylesheet"/><link href="preview-panel.css" rel="stylesheet"/>',
    "estilos de vista previa"
)
replace_once(
    index_path,
    '<script src="text-processor.js"></script><script src="chat-reading-policy.js"></script><script src="renderer.js"></script>',
    '<script src="text-processor.js"></script><script src="chat-reading-policy.js"></script><script src="renderer.js"></script><script src="preview-panel.js"></script>',
    "script de vista previa"
)
index_text = read(index_path).replace("Lulu Finity 1.1.1", "Lulu Finity 1.1.2").replace("v1.1.1", "v1.1.2")
write(index_path, index_text)

# La vista previa no debe iniciar el servidor local ni activar overlays durante el
# arranque. Solo carga la fuente cuando el usuario abre Pantalla / Overlay.
preview_path = ROOT / "src" / "preview-panel.js"
replace_once(
    preview_path,
    "    setTimeout(() => loadSource(currentSource, frame, status, sourceButtons), 50);\n    return pane;",
    "    pane.__luluLoadSource = () => loadSource(currentSource, frame, status, sourceButtons);\n    return pane;",
    "carga bajo demanda de la vista previa"
)
replace_once(
    preview_path,
    "    overlayTab.addEventListener('click', () => selectTab('overlay'));",
    "    overlayTab.addEventListener('click', () => { selectTab('overlay'); overlayPane.__luluLoadSource?.(); });",
    "activación bajo demanda del servidor local"
)

main_path = ROOT / "src" / "main.js"
replace_once(
    main_path,
    "const { defaultSoundCatalog } = require('./default-sound-catalog');",
    "const { defaultSoundCatalog } = require('./default-sound-catalog');\nconst { tunnelRecoveryDelay, probeTunnelUrl } = require('./overlay-tunnel-health');",
    "módulo de salud HTTPS"
)
replace_once(
    main_path,
    "let overlayTunnelLastAttempt = 0;\nlet overlayTunnelStopRequested = false;\nlet overlayTunnelStatus = { status: 'idle', message: 'Enlace HTTPS pendiente.', url: '' };",
    "let overlayTunnelLastAttempt = 0;\nlet overlayTunnelStopRequested = false;\nlet overlayTunnelWanted = false;\nlet overlayTunnelRecoveryTimer = null;\nlet overlayTunnelHealthTimer = null;\nlet overlayTunnelRecoveryAttempt = 0;\nlet overlayTunnelHealthFailures = 0;\nlet overlayTunnelStatus = { status: 'idle', message: 'Enlace HTTPS pendiente.', url: '' };",
    "estado del watchdog HTTPS"
)

watchdog = r'''
function clearOverlayTunnelRecoveryTimer() {
  if (overlayTunnelRecoveryTimer) clearTimeout(overlayTunnelRecoveryTimer);
  overlayTunnelRecoveryTimer = null;
}

function clearOverlayTunnelHealthTimer() {
  if (overlayTunnelHealthTimer) clearInterval(overlayTunnelHealthTimer);
  overlayTunnelHealthTimer = null;
  overlayTunnelHealthFailures = 0;
}

function scheduleOverlayTunnelRecovery(reason = '') {
  if (!overlayTunnelWanted || overlayTunnelStopRequested || isQuitting) return;
  if (overlayTunnelRecoveryTimer) return;
  clearOverlayTunnelHealthTimer();
  const delay = tunnelRecoveryDelay(overlayTunnelRecoveryAttempt);
  overlayTunnelRecoveryAttempt += 1;
  const detail = String(reason || '').trim();
  setOverlayTunnelStatus('recovering', `${detail ? `${detail} ` : ''}Reconectando HTTPS automáticamente…`, '');
  overlayTunnelRecoveryTimer = setTimeout(() => {
    overlayTunnelRecoveryTimer = null;
    if (!overlayTunnelWanted || overlayTunnelStopRequested || isQuitting) return;
    ensureOverlayHttpsTunnel(true).catch((error) => {
      scheduleOverlayTunnelRecovery(error?.message || 'No se pudo recuperar el enlace.');
    });
  }, delay);
  overlayTunnelRecoveryTimer.unref?.();
}

async function verifyOverlayHttpsTunnel() {
  if (!overlayTunnelWanted || overlayTunnelStopRequested || isQuitting) return;
  const child = overlayTunnelProcess;
  const publicUrl = overlayPublicBaseUrl;
  if (!child || child.killed || !publicUrl) {
    scheduleOverlayTunnelRecovery('El proceso HTTPS dejó de responder.');
    return;
  }
  const health = await probeTunnelUrl(fetch, publicUrl, 7000);
  if (health.ok) {
    overlayTunnelHealthFailures = 0;
    return;
  }
  overlayTunnelHealthFailures += 1;
  if (overlayTunnelHealthFailures < 2) return;
  overlayTunnelHealthFailures = 0;
  overlayPublicBaseUrl = '';
  overlayTunnelProcess = null;
  try { if (!child.killed) child.kill(); } catch {}
  scheduleOverlayTunnelRecovery('Cloudflare dejó de responder.');
}

function startOverlayTunnelHealthMonitor() {
  clearOverlayTunnelHealthTimer();
  if (!overlayTunnelWanted || overlayTunnelStopRequested || !overlayPublicBaseUrl) return;
  overlayTunnelHealthTimer = setInterval(() => {
    verifyOverlayHttpsTunnel().catch(() => scheduleOverlayTunnelRecovery('Falló la comprobación HTTPS.'));
  }, 12000);
  overlayTunnelHealthTimer.unref?.();
}

'''
replace_once(main_path, "async function stopOverlayHttpsTunnel() {", watchdog + "async function stopOverlayHttpsTunnel() {", "watchdog HTTPS")

replace_once(
    main_path,
    "async function stopOverlayHttpsTunnel() {\n  overlayTunnelStopRequested = true;\n  overlayPublicBaseUrl = '';",
    "async function stopOverlayHttpsTunnel() {\n  overlayTunnelStopRequested = true;\n  overlayTunnelWanted = false;\n  clearOverlayTunnelRecoveryTimer();\n  clearOverlayTunnelHealthTimer();\n  overlayPublicBaseUrl = '';",
    "apagado limpio del watchdog"
)
replace_once(
    main_path,
    "async function ensureOverlayHttpsTunnel(force = false) {\n  if (overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed) {\n    return { ok: true, ...overlayTunnelStatus, url: overlayPublicBaseUrl };\n  }",
    "async function ensureOverlayHttpsTunnel(force = false) {\n  overlayTunnelWanted = true;\n  overlayTunnelStopRequested = false;\n  if (overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed) {\n    startOverlayTunnelHealthMonitor();\n    return { ok: true, ...overlayTunnelStatus, url: overlayPublicBaseUrl };\n  }",
    "activación persistente del túnel"
)
replace_once(
    main_path,
    "          overlayPublicBaseUrl = publicUrl;\n          setOverlayTunnelStatus('ready', 'HTTPS listo. Mantén Lulu Finity abierta durante el LIVE.', publicUrl);\n          finish({ ok: true, ...overlayTunnelStatus, url: publicUrl });",
    "          overlayPublicBaseUrl = publicUrl;\n          overlayTunnelRecoveryAttempt = 0;\n          overlayTunnelHealthFailures = 0;\n          clearOverlayTunnelRecoveryTimer();\n          setOverlayTunnelStatus('ready', 'HTTPS listo y protegido con recuperación automática. Mantén Lulu Finity abierta durante el LIVE.', publicUrl);\n          startOverlayTunnelHealthMonitor();\n          finish({ ok: true, ...overlayTunnelStatus, url: publicUrl });",
    "estado HTTPS listo"
)
replace_once(
    main_path,
    "          setOverlayTunnelStatus('error', error?.message || 'No se pudo iniciar el enlace HTTPS.', '');\n          finish({ ok: false, ...overlayTunnelStatus, url: '' });",
    "          setOverlayTunnelStatus('error', error?.message || 'No se pudo iniciar el enlace HTTPS.', '');\n          finish({ ok: false, ...overlayTunnelStatus, url: '' });\n          scheduleOverlayTunnelRecovery('El proceso HTTPS falló.');",
    "recuperación al fallar cloudflared"
)
replace_once(
    main_path,
    "          if (!overlayTunnelStopRequested) setOverlayTunnelStatus('error', `El enlace HTTPS se cerró${Number.isInteger(code) ? ` (código ${code})` : ''}. Pulsa copiar para reintentarlo.`, '');\n          finish({ ok: false, ...overlayTunnelStatus, url: '' });",
    "          if (!overlayTunnelStopRequested) {\n            setOverlayTunnelStatus('recovering', `El enlace HTTPS se cerró${Number.isInteger(code) ? ` (código ${code})` : ''}. Lulu lo recuperará automáticamente.`, '');\n            scheduleOverlayTunnelRecovery('El túnel se cerró.');\n          }\n          finish({ ok: false, ...overlayTunnelStatus, url: '' });",
    "recuperación al cerrar el túnel"
)
replace_once(
    main_path,
    "          setOverlayTunnelStatus('error', 'El enlace HTTPS tardó demasiado. Revisa Internet o el firewall y vuelve a copiar.', '');\n          finish({ ok: false, ...overlayTunnelStatus, url: '' });",
    "          setOverlayTunnelStatus('recovering', 'El enlace HTTPS tardó demasiado. Lulu volverá a intentarlo automáticamente.', '');\n          finish({ ok: false, ...overlayTunnelStatus, url: '' });\n          scheduleOverlayTunnelRecovery('La conexión tardó demasiado.');",
    "recuperación por timeout"
)
replace_once(
    main_path,
    "      setOverlayTunnelStatus('error', error?.message || String(error), '');\n      return { ok: false, ...overlayTunnelStatus, url: '' };",
    "      setOverlayTunnelStatus('error', error?.message || String(error), '');\n      scheduleOverlayTunnelRecovery('No se pudo crear el enlace HTTPS.');\n      return { ok: false, ...overlayTunnelStatus, url: '' };",
    "recuperación por excepción"
)

changelog_path = ROOT / "CHANGELOG.md"
if changelog_path.is_file():
    changelog = read(changelog_path)
    if "## 1.1.2" not in changelog:
        lines = changelog.splitlines()
        insert_at = 1 if lines and lines[0].startswith("#") else 0
        entry = [
            "",
            "## 1.1.2",
            "",
            "- Añade recuperación automática del HTTPS: comprueba el túnel activo y lo recrea con backoff cuando cloudflared o la ruta pública dejan de responder.",
            "- Elimina el flujo manual de ‘pulsa copiar para reintentar’ y mantiene el enlace en modo de autorrecuperación mientras la fuente HTTPS está solicitada.",
            "- Añade una sección Vista previa dentro de Lulu Finity con Chat simulado y Pantalla/Overlay, sin TikTok Studio ni OBS.",
            "- Las vistas de Usuario 1, Meta, Regalos, Alertas, Música, Juegos y Rankings usan el servidor local y datos de muestra.",
            "- La vista Pantalla/Overlay se mantiene completamente bajo demanda para no activar el servidor local durante el arranque.",
            ""
        ]
        lines[insert_at:insert_at] = entry
        write(changelog_path, "\n".join(lines).rstrip() + "\n")

print("Lulu Finity 1.1.2 reconstruida sobre la fuente oficial 1.1.1")
