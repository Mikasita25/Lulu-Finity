import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generated = join(root, 'generated');
const archive = resolve(process.env.LULU_SOURCE_ARCHIVE || join(generated, '1.3.3.zip'));
const sourceUrl = 'https://github.com/Mikasita25/Lulu-Finity/releases/download/v1.3.3/Lulu-Finity-Source-1.3.3.zip';
const sourceHash = '845536a984914f0fe692ce1ec679709b17550d398ba006061104a30cb7666c41';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const source = join(generated, 'source');
const sidecar = join(generated, 'sidecar');
const frontend = join(generated, 'frontend');

function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' && command === npm });
  if (result.error) throw result.error;
  if (result.status) throw new Error(`${command} terminó con estado ${result.status}.`);
}

function replaceOnce(input, target, replacement) {
  if (input.split(target).length !== 2) throw new Error(`La fuente publicada cambió: ${target.slice(0, 100)}`);
  return input.replace(target, () => replacement);
}

await mkdir(generated, { recursive: true });
if (!process.env.LULU_SOURCE_ARCHIVE && !await access(archive).then(() => true, () => false)) {
  run('curl', ['--fail', '--location', '--retry', '3', sourceUrl, '-o', archive + '.partial']);
  const { rename } = await import('node:fs/promises');
  await rename(archive + '.partial', archive);
}
const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest('hex') !== sourceHash) throw new Error('El ZIP oficial de Lulu Finity 1.3.3 no coincide con su SHA-256.');

for (const dir of [source, sidecar, frontend]) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}
if (process.platform === 'win32') run('tar.exe', ['-xf', archive, '-C', source]);
else run('unzip', ['-q', archive, '-d', source]);

const src = join(source, 'src');
const text = async (name) => (await readFile(join(src, name), 'utf8')).replace(/\r\n/g, '\n');
const originalIllustration = /miku-(?:classic|dark|soft)-user\.(?:jpg|png)/g;
const resizeReferences = value => value.replace(originalIllustration, name => name.replace(/\.(?:jpg|png)$/, '.webp'));
const html = await text('index.html');
const pageScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
for (const name of [...pageScripts, 'styles.css', 'studio.css']) {
  await writeFile(join(frontend, name), resizeReferences(await text(name)));
}
for (const name of await readdir(src)) {
  if (/\.(webp|jpg|png|svg)$/.test(name) && resizeReferences(name) === name) await cp(join(src, name), join(frontend, name));
}
const visualAssets = join(root, 'scripts', 'visual-assets');
for (const name of await readdir(visualAssets)) await cp(join(visualAssets, name), join(frontend, name));
const sizedHtml = resizeReferences(html.replace(/(data-studio-theme="[^"]+">\s*<img src=")(miku-(?:classic|dark|soft)-user)\.(?:jpg|png)/g, '$1$2-thumb.webp'));
await writeFile(join(frontend, 'index.html'), sizedHtml
  .replace("img-src 'self' data: https:", "img-src 'self' data: https: http://asset.localhost")
  .replace("connect-src 'self';", "connect-src 'self' ipc: http://ipc.localhost;")
  .replace("media-src 'self' file: data: blob:", "media-src 'self' file: data: blob: http://asset.localhost")
  .replace('<script src="text-processor.js">', '<script src="desktop-bridge.js"></script>\n<script src="text-processor.js">')
  .replace(/v1\.3\.3/g, 'v1.4.0 beta 5 Rust')
  .replace('<link href="studio.css" rel="stylesheet"/>', '<link href="studio.css" rel="stylesheet"/><link href="rendering.css" rel="stylesheet"/>')
  .replace(/<title>[^<]*<\/title>/, '<title>Lulu Finity Rust Beta</title>'));

const preload = await text('preload.js');
const rendererBridge = await readFile(join(root, 'scripts', 'desktop-bridge.js'), 'utf8');
await writeFile(join(frontend, 'desktop-bridge.js'),
  rendererBridge + '\n' + replaceOnce(preload, "const { contextBridge, ipcRenderer } = require('electron');", ''));

await cp(join(root, 'scripts', 'rendering.css'), join(frontend, 'rendering.css'));

let renderer = resizeReferences(await text('renderer.js'));
renderer = replaceOnce(renderer, '    let stopAudioMonitor = null;', '    let stopAudioMonitor = null;\n    let stopNativeVoice = null;');
renderer = replaceOnce(renderer, '    state.activeAudioCancel = () => {\n      try { window.speechSynthesis.cancel(); }',
  '    state.activeAudioCancel = () => {\n      stopNativeVoice?.();\n      try { window.speechSynthesis.cancel(); }');
renderer = replaceOnce(renderer, '        const { result, voiceMode:preparedMode, tuning } = preparedState.prepared;',
  `        const { result, voiceMode:preparedMode, tuning } = preparedState.prepared;
        if (preparedMode === 'local') {
          const playbackId = Math.floor(performance.timeOrigin * 1000) + token;
          stopNativeVoice = () => { void ipcRenderer.invoke('tts:stop-pcm', { id:playbackId }).catch(() => {}); };
          try {
            markSpeechStarted(speechItem);
            const played = await ipcRenderer.invoke('tts:play-pcm', { id:playbackId, data:result.data, volume:tuning.volume });
            if (!finished) finish(played, played ? '' : 'audio detenido');
            return;
          } catch (error) {
            if (finished || token !== state.speechToken) { finish(false); return; }
            console.warn('Salida de voz local de Windows:', error);
          } finally {
            stopNativeVoice = null;
          }
        }`);
// Los perfiles conservan las URL file: y sólo se transforman al reproducir.
renderer = replaceOnce(renderer, 'new Audio(url)', 'new Audio(luluMediaUrl(url))');
renderer = replaceOnce(renderer, "const url = escapeHtml(String(media.url || ''));", "const url = escapeHtml(luluMediaUrl(String(media.url || '')));");
renderer = replaceOnce(renderer,
  'const total=Number(runtime.totalMemoryMb??runtime.memoryMb??0);',
  "const total=Number(runtime.totalMemoryMb??runtime.memoryMb??0);const ramLabel=runtime.memoryKind==='private'?'RAM privada en uso':'RAM residente (incluye memoria compartida)';");
renderer = replaceOnce(renderer, 'RAM total de Lulu', '${ramLabel}');
renderer = replaceOnce(renderer, 'Solo núcleo', 'Núcleo de Rust');
renderer = replaceOnce(renderer, 'Procesos protegidos', 'Procesos de Lulu');
renderer = replaceOnce(renderer,
  'La suma incluye todos los procesos que Windows agrupa como Lulu Finity.',
  'Medición de los procesos de esta instancia en Windows.');
renderer = replaceOnce(renderer,
  'Electron separa interfaz, reproductor, gráficos y servicios para mantener el aislamiento. No son ocho copias de Lulu. Spotify Web puede usar varios de estos procesos mientras reproduce.',
  'WebView2 ejecuta la interfaz, los reproductores y sus procesos de gráficos. La voz y las conexiones se atienden en el motor de Lulu.');
renderer = replaceOnce(renderer, 'if(frame&&(refreshFrame||!frame.src||!frame.src.includes(`/ranking?slot=${selected}`)))',
  'if(frame&&canRenderPreview(frame)&&(refreshFrame||!frame.src||!frame.src.includes(`/ranking?slot=${selected}`)))');
renderer = replaceOnce(renderer, 'if(frame&&(refreshFrame||!frame.src||!frame.src.includes(`/widget?type=${normalized}`)))',
  'if(frame&&canRenderPreview(frame)&&(refreshFrame||!frame.src||!frame.src.includes(`/widget?type=${normalized}`)))');
for (const functionName of ['renderComments', 'renderLiveEvents']) {
  renderer = replaceOnce(renderer, `function ${functionName}() {`, `function ${functionName}() {
  if (document.hidden) return;`);
}
renderer = replaceOnce(renderer, 'function topLevelPages() {', `function canRenderPreview(frame) {
  const owner = frame.closest('.page');
  return !document.hidden && (!owner || !owner.hidden);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    for (const page of Object.keys(PAGE_PREVIEW_FRAMES)) suspendPageView(page);
  } else {
    renderComments();
    renderLiveEvents();
    if (PAGE_PREVIEW_FRAMES[state.activePage]) activatePageModules(state.activePage);
  }
});

function topLevelPages() {`);
await writeFile(join(frontend, 'renderer.js'), renderer);

await mkdir(join(sidecar, 'src'));
for (const name of await readdir(src)) {
  if ((name.endsWith('.js') && !name.endsWith('.test.js') && !pageScripts.includes(name) && name !== 'preload.js')
    || name === 'roulette.html.gz') await cp(join(src, name), join(sidecar, 'src', name));
}
// Several modules are shared with the renderer.
for (const name of ['widget-design.js', 'settings-persistence.js', 'text-processor.js', 'release-notice-policy.js']) {
  await cp(join(src, name), join(sidecar, 'src', name));
}
await cp(join(source, 'NOTICE.md'), join(sidecar, 'NOTICE.md'));
await cp(join(source, 'resources', 'voices'), join(sidecar, 'lulu-voices'), { recursive: true });
await cp(join(source, 'resources', 'tools', 'cloudflared.exe'), join(sidecar, 'lulu-tools', 'cloudflared.exe'));
await cp(join(src, 'default-sounds'), join(sidecar, 'lulu-default-sounds'), { recursive: true });
for (const name of ['desktop-host.cjs', 'host-protocol.cjs', 'voice-child.cjs', 'local-tts-policy.cjs', 'voice-cpu.conf', 'music-idle-policy.cjs', 'beta-updates.cjs', 'microsoft-speech.cjs', 'microsoft-voice-catalog.json']) {
  await cp(join(root, 'scripts', name), join(sidecar, 'src', name));
}

let main = await text('main.js');
main = main.replaceAll("require('electron')", "require('./desktop-host.cjs')").replaceAll("Servicios de Electron", "Servicios del sistema");
// Railway delivers decoded events. The desktop client only needs their names.
main = replaceOnce(main, 'let connectorModule = null;', `const relayEvents = {
  WebcastEvent: {
    CHAT: 'chat', MEMBER: 'member', GIFT: 'gift', ROOM_USER: 'roomUser', LIKE: 'like',
    EMOTE: 'emote', FOLLOW: 'follow', SHARE: 'share', STREAM_END: 'streamEnd', SUB_NOTIFY: 'subNotify'
  },
  ControlEvent: {
    CONNECTED: 'connected', DISCONNECTED: 'disconnected', ERROR: 'error',
    WEBSOCKET_CONNECTED: 'websocketConnected'
  }
};`);
main = replaceOnce(main, "    if (!connectorModule) connectorModule = await import('tiktok-live-connector');\n", '');
main = replaceOnce(main, ' = connectorModule;', ' = relayEvents;');
main = replaceOnce(main, ', connectorModule);', ', relayEvents);');
const installedBuild = main.slice(main.indexOf('function isLikelyInstalledBuild()'), main.indexOf('function friendlyUpdateError('));
main = replaceOnce(main, installedBuild, "function isLikelyInstalledBuild() { return process.env.LULU_UPDATE_FEED === 'signed'; }\n\n");
main = replaceOnce(main, "const { autoUpdater } = require('electron-updater');", "const { autoUpdater } = require('./beta-updates.cjs');");
main = replaceOnce(main, "await shell.openExternal(UPDATE_RELEASES_URL);\n      sendUpdateStatus('external'", "await shell.openExternal(info?.releaseUrl || UPDATE_RELEASES_URL);\n      sendUpdateStatus('external'");
main = replaceOnce(main, "const { nativeImage } = require('./desktop-host.cjs');\n  let image = nativeImage.createFromPath(source);\n  if (image.isEmpty()) throw new Error('No se pudo abrir esta imagen.');\n  const size = image.getSize();\n  if (Math.max(size.width, size.height) > 1920) image = image.resize(size.width >= size.height ? {width:1920} : {height:1920});\n  const bytes = image.toPNG();", "const { convertImage } = require('./desktop-host.cjs');\n  const bytes = await convertImage(source);");
main = replaceOnce(main, "function setYoutubeNetworkAdBlockEnabled(enabled) {\n  youtubeAdBlockEnabled = Boolean(enabled);", "function setYoutubeNetworkAdBlockEnabled(enabled) {\n  youtubeAdBlockEnabled = Boolean(enabled);\n  session.fromPartition(YOUTUBE_PARTITION).setAdBlockEnabled(youtubeAdBlockEnabled);");
main = replaceOnce(main, "const module = await import('@ghostery/adblocker-electron');", "const module = await import('./network-filters.mjs');");
main = replaceOnce(main, 'Esta copia fue abierta desde una carpeta ZIP. Se abrirá la página oficial para descargar el instalador nuevo.', 'Se abrirá la página de esta versión en GitHub para descargar el instalador de Lulu Finity Rust.');
main = replaceOnce(main, "  if (tiktokChatWindow && !tiktokChatWindow.isDestroyed()) {\n    tiktokChatWindow.removeAllListeners('close');", "  await session.fromPartition(TIKTOK_CHAT_PARTITION).clearStorageData();\n  if (tiktokChatWindow && !tiktokChatWindow.isDestroyed()) {\n    tiktokChatWindow.removeAllListeners('close');");
main = replaceOnce(main, "  await chatSession.clearStorageData();\n  await chatSession.clearCache().catch(() => {});", "  await chatSession.clearCache().catch(() => {});");
const synthStart = main.indexOf('  const module = await getEdgeTtsModule();', main.indexOf('async function synthesizeOnlineVoice('));
const legacySynthesis = main.slice(synthStart, main.indexOf("\n}\n\nconst TIKTOK_TTS_COOKIE_NAMES", synthStart));
main = replaceOnce(main, legacySynthesis, `  return require('./microsoft-speech.cjs').synthesizeMicrosoft({
    text, voice, rate: percentFromRate(request?.rate), pitch: hertzFromPitch(request?.pitch)
  });`);
main = replaceOnce(main, "    const {FALLBACK_ONLINE_VOICES}=getOnlineVoiceCatalog();\n    return { voices: FALLBACK_ONLINE_VOICES, fallback: true, cached: false, message: friendlyUpdateError(error) };", `    const {prepareOnlineVoices}=getOnlineVoiceCatalog();
    return { voices: prepareOnlineVoices(require('./microsoft-voice-catalog.json')), fallback: true, cached: false, message: friendlyUpdateError(error) };`);
main = replaceOnce(main, "    if (savedVoices.length) {\n      onlineVoiceCatalogCache = savedVoices;", `    if (savedVoices.length) {
      const bundled = require('./microsoft-voice-catalog.json');
      const {prepareOnlineVoices}=getOnlineVoiceCatalog();
      onlineVoiceCatalogCache = prepareOnlineVoices([...savedVoices, ...bundled]);`);
main = replaceOnce(main, "return { voices: savedVoices, fallback: true, cached: true, message: friendlyUpdateError(error) };", "return { voices: onlineVoiceCatalogCache, fallback: true, cached: true, message: friendlyUpdateError(error) };");
const oldMemoryStats = main.slice(main.indexOf('function runtimeWindowPid('), main.indexOf("ipcMain.handle('runtime:status'"));
main = replaceOnce(main, oldMemoryStats, await readFile(join(root, 'scripts', 'runtime-memory.js'), 'utf8') + '\n');
main = replaceOnce(main, 'let youtubeResolverIdleTimer = null;', 'let youtubeResolverIdleTimer = null;\nlet youtubeSearchInProgress = false;');
main = replaceOnce(main, '},15000);\n  youtubeResolverIdleTimer.unref?.();', '},3000);\n  youtubeResolverIdleTimer.unref?.();');
const originalResolver = main.slice(main.indexOf('  const run = async () => {', main.indexOf('async function resolveYoutubeRequest(')),
  main.indexOf('\n}\n\nfunction clearYoutubeAutomation'));
main = replaceOnce(main, originalResolver, `  const run = async () => {
    clearTimeout(youtubeResolverIdleTimer);
    youtubeResolverIdleTimer = null;
    youtubeSearchInProgress = true;
    try {
      const win = createYoutubeResolverWindow();
      await withTimeout(win.loadURL(searchUrl), 18000, 'YouTube tardó demasiado en abrir la búsqueda.');
      const result = await findFirstOrganicYoutubeResult(win);
      return { ...result, url: withYoutubeAutoplay(result.url), query };
    } finally {
      youtubeSearchInProgress = false;
      scheduleYoutubeResolverRelease();
    }
  };
  const task = youtubeResolveChain.then(run, run);
  youtubeResolveChain = task.catch(() => {});
  return task;`);
main = replaceOnce(main, "    if(key==='music')return Boolean(details?.keepMusic);", "    if(key==='music')return nativeMusicInUse() || Boolean(details?.keepMusic);");
main = replaceOnce(main, "  clearTimeout(youtubeResolverIdleTimer);youtubeResolverIdleTimer=null;\n  destroyWindowSafely(youtubeResolverWindow);youtubeResolverWindow=null;",
  "  if (!youtubeSearchInProgress) {\n    clearTimeout(youtubeResolverIdleTimer); youtubeResolverIdleTimer = null;\n    destroyWindowSafely(youtubeResolverWindow); youtubeResolverWindow = null;\n  }");
main = replaceOnce(main, "  if(preserveMusic){releaseInactiveMusicProvider(settings.musicProvider);protectedCategories.push('music');}",
  "  if(preserveMusic){protectedCategories.push('music');}");
main = replaceOnce(main, "function markMusicExpected(provider, expected, userPaused = false) {", `function nativeMusicInUse() {
  const { retainMusicWindow } = require('./music-idle-policy.cjs');
  return ['youtube', 'spotify'].some(provider => retainMusicWindow(musicWindow(provider), musicRecoveryState[provider]));
}

function markMusicExpected(provider, expected, userPaused = false) {`);
await writeFile(join(sidecar, 'src', 'main.js'), main);
let voiceManager = await text('local-voice-manager.js');
voiceManager = replaceOnce(voiceManager, 'if (this.worker?.pid) return this.worker;', 'if (this.worker?.connected && this.worker.exitCode === null) return this.worker;');
voiceManager = replaceOnce(voiceManager, '      if (!pending) return;', '      if (!pending || pending.worker !== worker) return;');
voiceManager = replaceOnce(voiceManager,
  "    worker.on('exit', () => {\n      if (this.worker === worker) this.worker = null;\n      for (const pending of this.pending.values()) pending.reject(new Error('El proceso de Lulu Local se cerró.'));\n      this.pending.clear();\n    });",
  `    const handleFailure = (error) => {
      if (this.worker === worker) this.worker = null;
      for (const [id, pending] of this.pending) {
        if (pending.worker !== worker) continue;
        this.pending.delete(id);
        pending.reject(error);
      }
    };
    worker.on('exit', () => handleFailure(new Error('El proceso de Lulu Local se cerró.')));
    worker.on('error', handleFailure);`);
voiceManager = replaceOnce(voiceManager, '    this.idleTimer = setTimeout(() => { void this.release(); }, delay);',
  '    this.idleTimer = setTimeout(() => {\n      if (this.pending.size) this.armIdleRelease(minutes);\n      else void this.release();\n    }, delay);');
voiceManager = replaceOnce(voiceManager, '      this.pending.set(requestId, {', '      this.pending.set(requestId, {\n        worker,');
await writeFile(join(sidecar, 'src', 'local-voice-manager.js'), voiceManager);
let voiceWorker = await text('local-tts-worker.js');
voiceWorker = replaceOnce(voiceWorker, "const path = require('node:path');", "const path = require('node:path');\nconst { voiceSegments } = require('./local-tts-policy.cjs');");
voiceWorker = replaceOnce(voiceWorker, "provider: 'cpu'", "provider: 'cpu:' + path.join(__dirname, 'voice-cpu.conf')");
voiceWorker = replaceOnce(voiceWorker,
  "  const audio = activeTts.generate({ text: String(message.text || '').slice(0, 500), generationConfig });\n  const wave = pcm16Wave(audio.samples, audio.sampleRate);\n  return { mimeType: 'audio/wav', data: wave.toString('base64'), bytes: wave.length, sampleRate: audio.sampleRate };",
  `  const segments = voiceSegments(String(message.text || '').slice(0, 500));
  const clips = segments.map(text => activeTts.generate({ text, generationConfig }));
  const { sampleRate } = clips[0];
  const gap = Math.round(sampleRate * 0.035);
  const length = clips.reduce((total, clip) => total + clip.samples.length, 0) + gap * (clips.length - 1);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const clip of clips) {
    samples.set(clip.samples, offset);
    offset += clip.samples.length + gap;
  }
  const wave = pcm16Wave(samples, sampleRate);
  return { mimeType: 'audio/wav', data: wave.toString('base64'), bytes: wave.length, sampleRate };`);
await writeFile(join(sidecar, 'src', 'local-tts-worker.js'), voiceWorker);
const voiceCatalog = replaceOnce(await text('online-voice-catalog.js'),
  "const BLOCKED_LANGUAGE_PREFIXES = new Set(['cmn', 'ja', 'ko', 'wuu', 'yue', 'zh']);",
  "const BLOCKED_LANGUAGE_PREFIXES = new Set();");
await writeFile(join(sidecar, 'src', 'online-voice-catalog.js'), voiceCatalog);
await cp(join(root, 'scripts', 'network-filters.mjs'), join(sidecar, 'src', 'network-filters.mjs'));
const knownCalls = [
  ...[...preload.matchAll(/ipcRenderer\.(?:invoke|send)\('([^']+)'/g)].map(match => match[1]),
  'window:minimize', 'window:maximize', 'window:close'
];
await writeFile(join(sidecar, 'renderer-channels.json'), JSON.stringify([...new Set(knownCalls)]));

const baseline = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
const originalLock = JSON.parse(await readFile(join(source, 'package-lock.json'), 'utf8'));
delete baseline.dependencies['electron-updater'];
delete baseline.dependencies['@ghostery/adblocker-electron'];
delete baseline.dependencies['tiktok-live-connector'];
baseline.dependencies['@ghostery/adblocker'] = originalLock.packages['node_modules/@ghostery/adblocker'].version;
baseline.dependencies['node-win-x64'] = '22.23.5';
baseline.dependencies['msedge-tts'] = '2.1.1';
const manifest = { name: 'lulu-finity-backend', version: '1.4.0-beta.5', private: true, dependencies: baseline.dependencies };
await writeFile(join(sidecar, 'package.json'), JSON.stringify(manifest, null, 2));
const backendLock = join(root, 'scripts', 'backend-package-lock.json');
await cp(backendLock, join(sidecar, 'package-lock.json'));
run(npm, ['ci', '--omit=dev', '--os=win32', '--cpu=x64', ...(process.platform === 'win32' ? [] : ['--force']), '--ignore-scripts', '--no-audit', '--no-fund'], sidecar);
await cp(join(sidecar, 'node_modules', 'node-win-x64', 'bin', 'node.exe'), join(sidecar, 'node.exe'));
await rm(join(sidecar, 'node_modules', 'node-win-x64'), { recursive: true, force: true });
await rm(join(sidecar, 'node_modules', '.bin'), { recursive: true, force: true });
await rm(source, { recursive: true, force: true });
