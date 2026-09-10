from pathlib import Path
import json
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()
main_path = root / 'src/main.js'
main = main_path.read_text(encoding='utf-8')

def replace(old, new):
    global main
    if main.count(old) != 1:
        raise RuntimeError(f'Expected one match: {old[:100]}')
    main = main.replace(old, new, 1)

# The previous deployment now returns HTTP 404; use the user's active relay.
for prefix, suffix in (('wss://', '/v1/tiktok/live'), ('https://', '/usage'), ('https://', '')):
    replace(f"'{prefix}lulu-finity-production.up.railway.app{suffix}'",
            f"'{prefix}lulu-finity-production-6b8f.up.railway.app{suffix}'")

replace('  if (liveReconnectAttempt >= LIVE_RECONNECT_DELAYS_MS.length) {\n    const username = liveReconnectUsername;\n    stopLiveReconnectSession();\n    send(\'live:status\', {\n      status: \'error\',\n      username,\n      message: \'Lulu no pudo recuperar el LIVE después de varios intentos. Pulsa Conectar para volver a intentarlo.\'\n    });\n    return false;\n  }',
        '  // Temporary outages keep retrying at the capped policy delay.\n  // Manual stop, ended streams and terminal errors still stop above.')

# An old asynchronous attempt must never clear a newly selected LIVE session.
replace('    } catch (error) {\n      const failedConnection = liveConnection;',
        '    } catch (error) {\n      if (connectionNonce !== liveConnectNonce) return;\n      const failedConnection = liveConnection;')
replace('    } finally {\n      liveReconnectInFlight = false;\n    }',
        '    } finally {\n      if (connectionNonce === liveConnectNonce) liveReconnectInFlight = false;\n    }')

# Railway rotates its own upstream. Give it a bounded grace period before
# tearing down the downstream socket and losing its key-rotation progress.
replace('    this.transportHealthTimer = null;\n  }',
        '    this.transportHealthTimer = null;\n    this.upstreamRecoveryTimer = null;\n  }')
replace('  async fetchRoomId() {', '''  clearUpstreamRecovery() {
    clearTimeout(this.upstreamRecoveryTimer);
    this.upstreamRecoveryTimer = null;
  }

  async fetchRoomId() {''')
replace("      if (data?.state === 'connected' && this.isConnected) {", "      if (data?.state === 'connected') this.clearUpstreamRecovery();\n      if (data?.state === 'connected' && this.isConnected) {")
replace("    if (type === 'tiktok.connect') {", "    if (type === 'tiktok.connect') {\n      this.clearUpstreamRecovery();")
replace("      this.emit(C.DISCONNECTED || 'disconnected', { reason, code:1006, upstream:true });\n      return true;", """      if (!this.upstreamRecoveryTimer) {
        send('live:status', { status:'connecting', username:this.uniqueId, reconnecting:true,
          message:'Railway está recuperando la conexión al LIVE…' });
        this.upstreamRecoveryTimer = setTimeout(() => {
          this.upstreamRecoveryTimer = null;
          this.emit(C.DISCONNECTED || 'disconnected', { reason, code:1006, upstream:true });
        }, 45000);
        this.upstreamRecoveryTimer.unref?.();
      }
      return false;""")
replace("      if (state === 'connected') this.emit(C.CONNECTED || 'connected', { roomId: this.roomId || 'relay' });", "      if (state === 'connected') { this.clearUpstreamRecovery(); this.emit(C.CONNECTED || 'connected', { roomId: this.roomId || 'relay' }); }")
replace("      this.socket.on('close', (code, reason) => {\n        clearTimeout(timeout);", "      this.socket.on('close', (code, reason) => {\n        this.clearUpstreamRecovery();\n        clearTimeout(timeout);")
replace('  async disconnect() {\n    const socket = this.socket;', '  async disconnect() {\n    this.clearUpstreamRecovery();\n    const socket = this.socket;')

# Cancel pending recovery only when the timeline advances: paused=false also
# occurs during buffering and used to cancel every watchdog attempt.
replace('  if (currentTime > recovery.lastTime + 0.2 || currentTime < recovery.lastTime - 2) {',
        '  const progressed = currentTime > recovery.lastTime + 0.2 || currentTime < recovery.lastTime - 2;\n  if (progressed) {')
replace('  if (payload.paused === false) {\n    if (recovery.recoveryTimer) {',
        '  if (payload.paused === false) {\n    if (progressed && recovery.recoveryTimer) {')
replace('  if (!recovery?.expectedPlaying || recovery.userPaused || isQuitting) return;\n  let win = musicWindow(provider);',
        '  if (!recovery?.expectedPlaying || recovery.userPaused || recovery.inFlight || isQuitting) return;\n  recovery.inFlight = true;\n  recovery.lastRecoveryAt = Date.now();\n  let retry = false;\n  let win = musicWindow(provider);')
replace("    if (provider === 'spotify') await controlSpotifyPlayer('play');\n    else await controlYoutubePlayer('play');\n    recovery.lastProgressAt = Date.now();", """    if (!recovery.expectedPlaying || recovery.userPaused || isQuitting || musicWindow(provider) !== win) return;
    if (provider === 'spotify') await controlSpotifyPlayer('play');
    else await controlYoutubePlayer('play');
    // Only player telemetry can establish progress, not a successful IPC call.""")
replace("    scheduleMusicPlayerRecovery(provider, reason, true);\n  }\n}\n\nfunction scheduleMusicPlayerRecovery", """    retry = true;
  } finally {
    recovery.inFlight = false;
    if (retry) scheduleMusicPlayerRecovery(provider, reason, true);
  }
}

function scheduleMusicPlayerRecovery""")
replace('  if (!recovery?.expectedPlaying || recovery.userPaused || recovery.recoveryTimer || isQuitting) return;',
        '  if (!recovery?.expectedPlaying || recovery.userPaused || recovery.inFlight || recovery.recoveryTimer || isQuitting) return;')
replace('  }, musicRecoveryDelay(recovery.recoveryAttempt));',
        '  }, Math.max(musicRecoveryDelay(recovery.recoveryAttempt),\n    recovery.lastRecoveryAt ? 30000 - (Date.now() - recovery.lastRecoveryAt) : 0));')

main_path.write_text(main, encoding='utf-8')
for name in ('package.json', 'package-lock.json'):
    path = root / name
    data = json.loads(path.read_text(encoding='utf-8'))
    data['version'] = '1.1.9'
    if name == 'package-lock.json':
        data['packages']['']['version'] = '1.1.9'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
html = root / 'src/index.html'
html.write_text(html.read_text(encoding='utf-8').replace('v1.1.8', 'v1.1.9'), encoding='utf-8')
for file in (Path(__file__).parent / 'files').glob('*'):
    shutil.copy2(file, root / 'src' / file.name)
print('Lulu Finity 1.1.9: recuperación de LIVE y música sin intentos superpuestos')
