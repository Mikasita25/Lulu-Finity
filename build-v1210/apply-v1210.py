from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperó 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def update_version(path: str) -> None:
    data = json.loads(read(path))
    if data.get("version") != "1.2.0":
        raise RuntimeError(f"{path}: se esperaba la base 1.2.0 y se encontró {data.get('version')}")
    data["version"] = "1.2.1"
    if path.endswith("package-lock.json"):
        packages = data.get("packages")
        if isinstance(packages, dict) and isinstance(packages.get(""), dict):
            packages[""]["version"] = "1.2.1"
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


for file_name in ("package.json", "package-lock.json"):
    update_version(file_name)

main = read("src/main.js")

main = replace_once(
    main,
    "let youtubeAdGuardMuted = false;\nlet youtubeAutomationNonce = 0;",
    "let youtubeAdGuardMuted = false;\nlet youtubeAdMuteFailsafeTimer = null;\nlet youtubeAutomationNonce = 0;",
    "seguro de mute de YouTube",
)

main = replace_once(
    main,
    "youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null },\n  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null }",
    "youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, lastPayloadAt:0, recoveryAttempt:0, recoveryTimer:null },\n  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, lastPayloadAt:0, recoveryAttempt:0, recoveryTimer:null }",
    "telemetría del reproductor",
)

main = replace_once(
    main,
    "  const currentTime = Math.max(0, Number(payload.currentTime || 0));\n  const now = Date.now();\n  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');",
    "  const currentTime = Math.max(0, Number(payload.currentTime || 0));\n  const now = Date.now();\n  recovery.lastPayloadAt = now;\n  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');",
    "actualización de telemetría musical",
)

main = replace_once(
    main,
    "      let observer = null;\n      let userPauseUntil = 0;",
    "      let observer = null;\n      let mutationMaintenanceTimer = null;\n      let userPauseUntil = 0;",
    "estado del observador de YouTube",
)

main = replace_once(
    main,
    "      observer = new MutationObserver(() => { attach(); skipYouTubeAds(); });\n      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','aria-label'] });",
    "      observer = new MutationObserver(() => {\n        if (mutationMaintenanceTimer) return;\n        mutationMaintenanceTimer = setTimeout(() => {\n          mutationMaintenanceTimer = null;\n          attach();\n          skipYouTubeAds();\n        }, 180);\n      });\n      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });",
    "observador intensivo de YouTube",
)

main = replace_once(
    main,
    "        clearInterval(timer);\n        if (observer) observer.disconnect();",
    "        clearInterval(timer);\n        clearTimeout(mutationMaintenanceTimer);\n        mutationMaintenanceTimer = null;\n        if (observer) observer.disconnect();",
    "limpieza del observador de YouTube",
)

main = replace_once(
    main,
    "  const shouldReload = forceReload || !win || win.isDestroyed() || recovery.recoveryAttempt >= 2;",
    "  const shouldReload = forceReload || !win || win.isDestroyed() || recovery.recoveryAttempt >= 3;",
    "umbral de recarga musical",
)

main = replace_once(
    main,
    "function recoverActiveMusicPlayers(reason = 'resume') {\n  for (const provider of ['youtube', 'spotify']) {\n    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, true);\n  }\n}",
    "function recoverActiveMusicPlayers(reason = 'resume') {\n  for (const provider of ['youtube', 'spotify']) {\n    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, false);\n  }\n}",
    "recuperación tras suspensión",
)

main = replace_once(
    main,
    "      if (!win || shouldRecoverPlayback({ ...recovery, visible:win.isVisible(), destroyed:win.isDestroyed() }, now)) scheduleMusicPlayerRecovery(provider, 'sin progreso', recovery.recoveryAttempt >= 1);",
    "      if (!win || shouldRecoverPlayback({ ...recovery, visible:win?.isVisible?.() === true, destroyed:Boolean(win?.isDestroyed?.()) }, now, 45000, 20000)) {\n        scheduleMusicPlayerRecovery(provider, 'sin progreso', false);\n      }",
    "watchdog musical",
)

main = replace_once(
    main,
    "function setYoutubeAdGuardMuted(active) {\n  youtubeAdGuardMuted = youtubeAdBlockEnabled && Boolean(active);\n  if (!youtubeWindow || youtubeWindow.isDestroyed()) return;\n  youtubeWindow.webContents.setAudioMuted(Boolean(youtubeMuted || youtubeAdGuardMuted));\n}",
    "function setYoutubeAdGuardMuted(active) {\n  clearTimeout(youtubeAdMuteFailsafeTimer);\n  youtubeAdMuteFailsafeTimer = null;\n  youtubeAdGuardMuted = youtubeAdBlockEnabled && Boolean(active);\n  if (!youtubeWindow || youtubeWindow.isDestroyed()) return;\n  youtubeWindow.webContents.setAudioMuted(Boolean(youtubeMuted || youtubeAdGuardMuted));\n  if (youtubeAdGuardMuted) {\n    youtubeAdMuteFailsafeTimer = setTimeout(() => {\n      youtubeAdMuteFailsafeTimer = null;\n      if (!youtubeWindow || youtubeWindow.isDestroyed() || musicRecoveryState.youtube.adActive) return;\n      youtubeAdGuardMuted = false;\n      youtubeWindow.webContents.setAudioMuted(Boolean(youtubeMuted));\n      console.warn('[music] Se liberó el mute preventivo de YouTube porque no llegó confirmación de anuncio.');\n    }, 6000);\n    youtubeAdMuteFailsafeTimer.unref?.();\n  }\n}",
    "failsafe del mute de anuncios",
)

main = replace_once(
    main,
    "  const delay = kind === 'watch' ? 20 : 350;\n  if (kind === 'watch' && youtubeAdBlockEnabled) setYoutubeAdGuardMuted(true);",
    "  const delay = kind === 'watch' ? 20 : 350;\n  if (kind === 'watch') {\n    musicRecoveryState.youtube.adActive = false;\n    if (youtubeAdBlockEnabled) setYoutubeAdGuardMuted(true);\n  } else {\n    musicRecoveryState.youtube.adActive = false;\n    setYoutubeAdGuardMuted(false);\n  }",
    "mute preventivo durante navegación",
)

main = replace_once(
    main,
    "  youtubeWindow.on('closed', () => {\n    const replacing = musicRecoveryState.youtube.replacing;",
    "  youtubeWindow.on('closed', () => {\n    clearTimeout(youtubeAdMuteFailsafeTimer);\n    youtubeAdMuteFailsafeTimer = null;\n    youtubeAdGuardMuted = false;\n    musicRecoveryState.youtube.adActive = false;\n    const replacing = musicRecoveryState.youtube.replacing;",
    "limpieza del mute al cerrar YouTube",
)

write("src/main.js", main)

renderer = read("src/renderer.js")
renderer = replace_once(
    renderer,
    "const RELEASE_NOTES = Object.freeze({\n  '1.2.0': Object.freeze([",
    "const RELEASE_NOTES = Object.freeze({\n  '1.2.1': Object.freeze([\n    Object.freeze({icon:'♫',title:'Música estable',text:'Evita recuperaciones falsas durante buffers y conserva la reproducción en segundo plano.'}),\n    Object.freeze({icon:'🔊',title:'Audio sin silencios pegados',text:'El mute preventivo de anuncios se libera automáticamente si el detector no confirma un anuncio.'}),\n    Object.freeze({icon:'↻',title:'Updates reparadas',text:'Esta versión vuelve a usar una numeración superior y publica los archivos requeridos por el actualizador.'}),\n    Object.freeze({icon:'●',title:'LIVE conservado',text:'Mantiene la conexión pública al servidor oficial de Lulu Finity y los cambios del Studio 1.2.0.'})\n  ]),\n  '1.2.0': Object.freeze([",
    "notas de 1.2.1",
)
write("src/renderer.js", renderer)

index = read("src/index.html").replace("v1.2.0", "v1.2.1")
write("src/index.html", index)

print("Lulu Finity 1.2.1 preparada")
