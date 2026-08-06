#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')


def replace(path, old, new, count=1):
    p = root / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'No se encontró el bloque esperado en {path}: {old[:100]!r}')
    text = text.replace(old, new, count)
    p.write_text(text, encoding='utf-8', newline='\n')

# index.html: texto simplificado, medidor de uso, anti anuncios y temas.
replace('src/index.html',
'''          <article class="panel settings-card wide tiktok-free-card">
            <div class="panel-header"><div><h3>Servidor seguro de TikTok LIVE</h3><p class="hint">Lulu ya incluye la conexión oficial de Railway. Los usuarios no tienen que escribir una URL, token o API key.</p></div><span class="free-plan-pill">CONFIGURADO</span></div>
            <div class="free-key-row">
              <div class="field-group"><label>Estado</label><small>Conexión automática protegida y rotación de API keys administrada desde el servidor.</small></div>
            </div>
          </article>''',
'''          <article class="panel settings-card wide tiktok-free-card">
            <div class="panel-header"><div><h3>Servidor seguro de TikTok LIVE</h3><p class="hint">Lulu ya incluye una conexión estable para leer a TikTok.</p></div><span class="free-plan-pill">CONFIGURADO</span></div>
            <div class="relay-usage-card">
              <div class="relay-usage-heading"><strong id="relayUsageTitle">Uso diario de Lulu Finity</strong><span id="relayUsagePercent">0%</span></div>
              <p id="relayUsageText">Se ha usado 0% del uso diario de Lulu Finity.</p>
              <div class="relay-usage-track"><span id="relayUsageBar"></span></div>
              <div class="relay-usage-meta"><span id="relayUsageCount">0 de 7500 usos</span><span id="relayUsageConnections">Aproximadamente 0 conexiones</span></div>
              <small id="relayUsageStatus">Calculando el uso del servidor…</small>
            </div>
          </article>''')

replace('src/index.html',
'''            <div class="field-group"><label>Tema</label><select id="themeModeInput"><option value="pink">Rosa</option><option value="dark">Oscuro</option></select></div>''',
'''            <div class="field-group"><label>Tema</label><select id="themeModeInput"><option value="pink">Rosa original</option><option value="blush">Rosa claro</option><option value="purple">Morado</option><option value="red">Rojo</option><option value="blue">Azul</option><option value="dark">Oscuro</option></select></div>''')

replace('src/index.html',
'''          <article class="panel settings-card youtube-rules-card">
            <div class="setting-row top"><div><h3>Evitar canciones duplicadas</h3><p>Compara la canción actual y toda la cola.</p></div><label class="switch"><input id="preventDuplicateSongsInput" type="checkbox" /><span></span></label></div>
            <div class="field-group"><div class="label-value"><label>Duración máxima</label><output id="maxSongDurationOutput">10 min</output></div><input id="maxSongDurationInput" type="range" min="0" max="60" step="1" /><small>0 permite cualquier duración.</small></div>
          </article>''',
'''          <article class="panel settings-card youtube-rules-card">
            <div class="setting-row top"><div><h3>Bloqueo de anuncios</h3><p>Omite anuncios, promociones y botones publicitarios en el navegador integrado.</p></div><label class="switch"><input id="youtubeAdBlockEnabledInput" type="checkbox" /><span></span></label></div>
            <div class="setting-row"><div><h3>Evitar canciones duplicadas</h3><p>Compara la canción actual y toda la cola.</p></div><label class="switch"><input id="preventDuplicateSongsInput" type="checkbox" /><span></span></label></div>
            <div class="field-group"><div class="label-value"><label>Duración máxima</label><output id="maxSongDurationOutput">10 min</output></div><input id="maxSongDurationInput" type="range" min="0" max="60" step="1" /><small>0 permite cualquier duración.</small></div>
          </article>''')

# main.js: sesión de YouTube, bloqueador, uso del relay y mensaje neutral.
replace('src/main.js',
"const { app, BrowserWindow, ipcMain, shell, dialog, clipboard } = require('electron');",
"const { app, BrowserWindow, ipcMain, shell, dialog, clipboard, session } = require('electron');")
replace('src/main.js',
"let youtubeAutomationTimer = null;\n",
"let youtubeAutomationTimer = null;\nlet youtubeAdBlockInstalled = false;\nlet youtubeAdBlockEnabled = true;\n")
replace('src/main.js',
"const EMBEDDED_RELAY_CLIENT_TOKEN = '__LULU_RELAY_CLIENT_TOKEN__';\n",
"const EMBEDDED_RELAY_CLIENT_TOKEN = '__LULU_RELAY_CLIENT_TOKEN__';\nconst RELAY_USAGE_URL = 'https://lulu-finity-production.up.railway.app/usage';\nconst YOUTUBE_PARTITION = 'persist:lulu-youtube';\n")
replace('src/main.js',
"  youtubeVolume: 0.8,\n",
"  youtubeVolume: 0.8,\n  youtubeAdBlockEnabled: true,\n")

marker = "function createYoutubeResolverWindow() {\n"
adblock = r'''function installYoutubeAdBlocker() {
  if (youtubeAdBlockInstalled) return;
  youtubeAdBlockInstalled = true;
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
  const filters = {
    urls: [
      '*://*.doubleclick.net/*',
      '*://*.googlesyndication.com/*',
      '*://*.googleadservices.com/*',
      '*://*.google.com/pagead/*',
      '*://*.youtube.com/api/stats/ads*',
      '*://*.youtube.com/pagead/*',
      '*://*.youtube.com/get_midroll_info*'
    ]
  };
  youtubeSession.webRequest.onBeforeRequest(filters, (_details, callback) => {
    callback({ cancel: youtubeAdBlockEnabled });
  });
}

async function fetchRelayUsage() {
  const response = await fetch(RELAY_USAGE_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
  const usage = await response.json();
  if (!usage?.ok) throw new Error('El servidor no entregó el contador diario.');
  return usage;
}

function createYoutubeResolverWindow() {
'''
replace('src/main.js', marker, adblock)
replace('src/main.js',
"function createYoutubeResolverWindow() {\n  if (youtubeResolverWindow && !youtubeResolverWindow.isDestroyed()) return youtubeResolverWindow;\n",
"function createYoutubeResolverWindow() {\n  if (youtubeResolverWindow && !youtubeResolverWindow.isDestroyed()) return youtubeResolverWindow;\n  installYoutubeAdBlocker();\n")
replace('src/main.js',
"      autoplayPolicy: 'no-user-gesture-required'\n    }\n  });\n  youtubeResolverWindow.webContents.setAudioMuted(true);",
"      autoplayPolicy: 'no-user-gesture-required',\n      partition: YOUTUBE_PARTITION\n    }\n  });\n  youtubeResolverWindow.webContents.setAudioMuted(true);")
replace('src/main.js',
"function createYoutubeWindow() {\n  if (youtubeWindow && !youtubeWindow.isDestroyed()) return youtubeWindow;\n",
"function createYoutubeWindow() {\n  if (youtubeWindow && !youtubeWindow.isDestroyed()) return youtubeWindow;\n  installYoutubeAdBlocker();\n")
replace('src/main.js',
"      sandbox: true,\n      autoplayPolicy: 'no-user-gesture-required'\n    }\n  });\n\n  youtubeWindow.webContents.setAudioMuted(youtubeMuted);",
"      sandbox: true,\n      autoplayPolicy: 'no-user-gesture-required',\n      partition: YOUTUBE_PARTITION\n    }\n  });\n\n  youtubeWindow.webContents.setAudioMuted(youtubeMuted);")

replace('src/main.js',
'''      const disableYouTubeAutoplay = () => {
        const toggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
        if (toggle) toggle.click();
      };
''',
'''      const disableYouTubeAutoplay = () => {
        const toggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
        if (toggle) toggle.click();
      };
      const skipYouTubeAds = () => {
        const adContainers = [
          'ytd-display-ad-renderer', 'ytd-promoted-video-renderer', 'ytd-ad-slot-renderer',
          'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-sparkles-web-renderer',
          '#player-ads', '.ytp-ad-overlay-container'
        ];
        for (const selector of adContainers) document.querySelectorAll(selector).forEach((node) => node.remove());
        const skipSelectors = [
          '.ytp-ad-skip-button', '.ytp-skip-ad-button', '.ytp-ad-skip-button-modern',
          'button[class*="ytp-ad-skip"]', '#skip-button button', 'ytd-button-renderer#skip-button button'
        ];
        for (const selector of skipSelectors) {
          const button = document.querySelector(selector);
          if (button) { button.click(); break; }
        }
        if (video && playerIsShowingAd()) {
          video.playbackRate = 16;
          if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.max(video.currentTime, video.duration - 0.15);
        } else if (video && video.playbackRate > 2) {
          video.playbackRate = 1;
        }
      };
''')
replace('src/main.js',
'''      const timer = setInterval(() => {
        disableYouTubeAutoplay();
        attach();
''',
'''      const timer = setInterval(() => {
        disableYouTubeAutoplay();
        attach();
        skipYouTubeAds();
''')

replace('src/main.js',
"        message: 'Conectado mediante Railway. Las API keys permanecen protegidas en el servidor.'",
"        message: 'Conectado correctamente al LIVE.'")

replace('src/main.js',
'''ipcMain.handle('app:get-state', async () => {
  const p = getDataPaths();
  return {
    settings: { ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) },
''',
'''ipcMain.handle('app:get-state', async () => {
  const p = getDataPaths();
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) };
  youtubeAdBlockEnabled = settings.youtubeAdBlockEnabled !== false;
  return {
    settings,
''')
replace('src/main.js',
"  next.tiktokConnectionMode = 'railway-relay';\n",
"  next.tiktokConnectionMode = 'railway-relay';\n  youtubeAdBlockEnabled = next.youtubeAdBlockEnabled !== false;\n")
replace('src/main.js',
"ipcMain.handle('settings:save', async (_event, incoming) => {",
"ipcMain.handle('relay:usage', async () => fetchRelayUsage());\n\nipcMain.handle('settings:save', async (_event, incoming) => {")

replace('src/preload.js',
"  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),\n",
"  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),\n  getRelayUsage: () => ipcRenderer.invoke('relay:usage'),\n")

replace('src/renderer.js',
"  rankingSaveTimer: null\n};",
"  rankingSaveTimer: null,\n  relayUsage: null,\n  relayUsageTimer: null\n};")
replace('src/renderer.js',
'''function normalizeUser(value) {
''',
'''function renderRelayUsage(usage, error = '') {
  const used = Math.max(0, Number(usage?.used) || 0);
  const limit = Math.max(1, Number(usage?.limit) || 7500);
  const percent = Math.max(0, Number(usage?.percent) || (used / limit * 100));
  const displayPercent = Math.min(100, percent);
  const estimated = Math.floor(used / Math.max(0.1, Number(usage?.perConnection) || 2));
  if ($('relayUsagePercent')) $('relayUsagePercent').textContent = `${percent.toFixed(percent < 1 ? 1 : 0)}%`;
  if ($('relayUsageText')) $('relayUsageText').textContent = `Se ha usado ${percent.toFixed(percent < 1 ? 1 : 0)}% del uso diario de Lulu Finity.`;
  if ($('relayUsageBar')) $('relayUsageBar').style.width = `${displayPercent}%`;
  if ($('relayUsageCount')) $('relayUsageCount').textContent = `${Math.round(used).toLocaleString('es-MX')} de ${Math.round(limit).toLocaleString('es-MX')} usos`;
  if ($('relayUsageConnections')) $('relayUsageConnections').textContent = `Aproximadamente ${estimated.toLocaleString('es-MX')} conexiones`;
  if ($('relayUsageStatus')) {
    $('relayUsageStatus').textContent = error || `Cada conexión utiliza cerca de ${Number(usage?.perConnection) || 2} usos. El contador se reinicia diariamente.`;
    $('relayUsageStatus').classList.toggle('error-text', Boolean(error));
  }
  $('relayUsageBar')?.classList.toggle('warning', percent >= 75 && percent < 90);
  $('relayUsageBar')?.classList.toggle('danger', percent >= 90);
}

async function refreshRelayUsage() {
  try {
    state.relayUsage = await api.getRelayUsage();
    renderRelayUsage(state.relayUsage);
  } catch (error) {
    renderRelayUsage(state.relayUsage || { used: 0, limit: 7500, perConnection: 2 }, 'No se pudo actualizar el uso diario en este momento.');
  }
}

function normalizeUser(value) {
''')
replace('src/renderer.js',
'''function applyAppearance() {
  if (!state.settings) return;
  const theme = state.settings.themeMode === 'dark' ? 'dark' : 'pink';
  const glow = clamp(state.settings.glowIntensity ?? 70, 0, 100);
  const opacity = clamp(state.settings.panelOpacity ?? 78, 55, 100);
  const radius = clamp(state.settings.cornerRadius ?? 15, 6, 24);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--panel-opacity', String(opacity / 100));
  document.documentElement.style.setProperty('--corner-radius', `${radius}px`);
  document.documentElement.style.setProperty('--glow-pink', `rgba(255,117,172,${(0.36 * glow / 100).toFixed(3)})`);
  document.documentElement.style.setProperty('--glow-purple', `rgba(154,87,196,${(0.23 * glow / 100).toFixed(3)})`);
  applyDashboardVisibility();
}
''',
'''function applyAppearance() {
  if (!state.settings) return;
  const palettes = {
    pink: ['255,117,172', '154,87,196'],
    blush: ['255,174,214', '218,139,255'],
    purple: ['174,94,255', '105,79,224'],
    red: ['255,76,105', '187,39,72'],
    blue: ['70,157,255', '112,88,232'],
    dark: ['227,107,157', '143,124,232']
  };
  const theme = Object.hasOwn(palettes, state.settings.themeMode) ? state.settings.themeMode : 'pink';
  const glow = clamp(state.settings.glowIntensity ?? 70, 0, 100);
  const opacity = clamp(state.settings.panelOpacity ?? 78, 55, 100);
  const radius = clamp(state.settings.cornerRadius ?? 15, 6, 24);
  const [primary, secondary] = palettes[theme];
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--panel-opacity', String(opacity / 100));
  document.documentElement.style.setProperty('--corner-radius', `${radius}px`);
  document.documentElement.style.setProperty('--glow-pink', `rgba(${primary},${(0.36 * glow / 100).toFixed(3)})`);
  document.documentElement.style.setProperty('--glow-purple', `rgba(${secondary},${(0.23 * glow / 100).toFixed(3)})`);
  applyDashboardVisibility();
}
''')
replace('src/renderer.js',
"  $('themeModeInput').value = settings.themeMode === 'dark' ? 'dark' : 'pink';\n",
"  $('themeModeInput').value = ['pink','blush','purple','red','blue','dark'].includes(settings.themeMode) ? settings.themeMode : 'pink';\n")
replace('src/renderer.js',
"  $('preventDuplicateSongsInput').checked = settings.preventDuplicateSongs !== false;\n",
"  $('preventDuplicateSongsInput').checked = settings.preventDuplicateSongs !== false;\n  $('youtubeAdBlockEnabledInput').checked = settings.youtubeAdBlockEnabled !== false;\n")
replace('src/renderer.js',
"  bindSetting('preventDuplicateSongsInput', 'preventDuplicateSongs');\n",
"  bindSetting('preventDuplicateSongsInput', 'preventDuplicateSongs');\n  bindSetting('youtubeAdBlockEnabledInput', 'youtubeAdBlockEnabled');\n")
replace('src/renderer.js',
'''  populateSettings();
  loadSystemVoices();
''',
'''  populateSettings();
  await refreshRelayUsage();
  state.relayUsageTimer = setInterval(refreshRelayUsage, 60_000);
  loadSystemVoices();
''')

styles = root / 'src/styles.css'
css = styles.read_text(encoding='utf-8')
css += r'''

/* Lulu Finity 0.22: medidor diario y paletas adicionales */
.relay-usage-card{margin-top:16px;padding:15px;border:1px solid var(--line);border-radius:calc(var(--corner-radius) - 2px);background:rgba(255,255,255,.035)}
.relay-usage-heading,.relay-usage-meta{display:flex;align-items:center;justify-content:space-between;gap:12px}.relay-usage-heading strong{font-size:13px}.relay-usage-heading span{font-weight:800;color:var(--theme-a);font-size:16px}.relay-usage-card p{margin:8px 0;color:var(--muted);font-size:11px}.relay-usage-track{height:10px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.09);box-shadow:inset 0 1px 3px rgba(0,0,0,.28)}.relay-usage-track span{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--theme-a),var(--theme-b));transition:width .45s ease}.relay-usage-track span.warning{background:linear-gradient(90deg,#ffcf5c,#ff8c57)}.relay-usage-track span.danger{background:linear-gradient(90deg,#ff6b73,#ff315d)}.relay-usage-meta{margin-top:8px;color:var(--muted);font-size:10px}.relay-usage-card small{display:block;margin-top:8px;color:var(--muted);font-size:10px}.relay-usage-card small.error-text{color:#ff91a8}
html{--theme-a:#ff73ae;--theme-b:#a97cff;--theme-soft:rgba(255,115,174,.16)}
html[data-theme="blush"]{--bg:#251624;--bg2:#382035;--panel:rgba(112,67,104,.62);--panel2:rgba(76,45,72,.84);--line:rgba(255,205,232,.24);--text:#fffafd;--muted:#e4c8d8;--pink:#ffafd3;--pink2:#ffd0e5;--purple:#da91ff;--theme-a:#ffafd3;--theme-b:#da91ff;--theme-soft:rgba(255,175,211,.18)}
html[data-theme="purple"]{--bg:#171027;--bg2:#271943;--panel:rgba(66,40,105,.7);--panel2:rgba(43,29,73,.88);--line:rgba(211,177,255,.22);--text:#fcf8ff;--muted:#cbbce0;--pink:#b56aff;--pink2:#d0a1ff;--purple:#7658e8;--theme-a:#b56aff;--theme-b:#7658e8;--theme-soft:rgba(181,106,255,.18)}
html[data-theme="red"]{--bg:#241015;--bg2:#38161d;--panel:rgba(94,38,48,.72);--panel2:rgba(65,26,35,.88);--line:rgba(255,151,166,.22);--text:#fff8f9;--muted:#d7b5ba;--pink:#ff4c69;--pink2:#ff899c;--purple:#bb2748;--theme-a:#ff4c69;--theme-b:#bb2748;--theme-soft:rgba(255,76,105,.18)}
html[data-theme="blue"]{--bg:#0e1727;--bg2:#142744;--panel:rgba(35,72,115,.7);--panel2:rgba(24,49,82,.88);--line:rgba(151,203,255,.22);--text:#f7fbff;--muted:#b5c9df;--pink:#469dff;--pink2:#8bc4ff;--purple:#7058e8;--theme-a:#469dff;--theme-b:#7058e8;--theme-soft:rgba(70,157,255,.18)}
html[data-theme="dark"]{--theme-a:#e36b9d;--theme-b:#8f7ce8;--theme-soft:rgba(227,107,157,.14)}
html[data-theme="blush"] .app-shell{background:radial-gradient(circle at 67% -20%,var(--glow-pink),transparent 34%),radial-gradient(circle at 46% 35%,var(--glow-purple),transparent 37%),linear-gradient(135deg,#291827,#3a2036 55%,#251625)}
html[data-theme="purple"] .app-shell{background:radial-gradient(circle at 67% -20%,var(--glow-pink),transparent 34%),radial-gradient(circle at 46% 35%,var(--glow-purple),transparent 37%),linear-gradient(135deg,#171027,#2c1947 55%,#151022)}
html[data-theme="red"] .app-shell{background:radial-gradient(circle at 67% -20%,var(--glow-pink),transparent 34%),radial-gradient(circle at 46% 35%,var(--glow-purple),transparent 37%),linear-gradient(135deg,#241015,#3b151e 55%,#1c0d12)}
html[data-theme="blue"] .app-shell{background:radial-gradient(circle at 67% -20%,var(--glow-pink),transparent 34%),radial-gradient(circle at 46% 35%,var(--glow-purple),transparent 37%),linear-gradient(135deg,#0e1727,#152d4d 55%,#0c1422)}
html[data-theme="blush"] .sidebar,html[data-theme="purple"] .sidebar,html[data-theme="red"] .sidebar,html[data-theme="blue"] .sidebar{background:linear-gradient(180deg,var(--panel2),color-mix(in srgb,var(--bg) 92%,#000))}
html[data-theme="blush"] .panel,html[data-theme="purple"] .panel,html[data-theme="red"] .panel,html[data-theme="blue"] .panel,html[data-theme="blush"] .stat-card,html[data-theme="purple"] .stat-card,html[data-theme="red"] .stat-card,html[data-theme="blue"] .stat-card{background:linear-gradient(145deg,var(--panel),var(--panel2))}
html[data-theme="blush"] .sidebar-bottom,html[data-theme="purple"] .sidebar-bottom,html[data-theme="red"] .sidebar-bottom,html[data-theme="blue"] .sidebar-bottom{background:var(--panel2)}
html .primary,html .logo-mark{background:linear-gradient(145deg,var(--theme-a),var(--theme-b))}
html .nav-item.active{background:linear-gradient(100deg,color-mix(in srgb,var(--theme-a) 72%,transparent),color-mix(in srgb,var(--theme-b) 38%,transparent));border-color:color-mix(in srgb,var(--theme-a) 42%,transparent)}
html .count-pill,html .update-version,html .free-plan-pill{background:var(--theme-soft);color:var(--theme-a)}
html input[type="checkbox"],html input[type="radio"]{accent-color:var(--theme-a)}
'''
styles.write_text(css, encoding='utf-8', newline='\n')

print('Parche 0.22 aplicado correctamente.')
