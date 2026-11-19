'use strict';

const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { WebSocketServer } = require('ws');

module.exports = async function checkBackground({ main, createPlayer, beginLive, endLive, expectMusic, reportProgress }) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const player = createPlayer();
  try {
    await beginLive(`ws://127.0.0.1:${server.address().port}/v1/tiktok/live`);
    const [peer] = server.clients;
    if (!peer) throw new Error('La conexión LIVE de prueba no abrió su WebSocket.');
    const playerIsHidden = await player.webContents.executeJavaScript('document.hidden');
    if (!playerIsHidden) throw new Error('El reproductor oculto seguía dibujando su ventana.');
    await player.webContents.executeJavaScript(`(async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.03;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      await context.resume();
      window.luluProbeAudio = context;
    })()`);
    expectMusic(true);
    await main.webContents.executeJavaScript(`(() => {
      window.luluProbeVoice = { synthesized:0, started:0, completed:0, errors:[] };
      const invoke = ipcRenderer.invoke;
      ipcRenderer.invoke = (channel, ...args) => {
        const result = invoke(channel, ...args);
        if (channel === 'tts:synthesize-local') {
          result.then(clip => {
            if (clip?.bytes > 44 && clip.mimeType === 'audio/wav') window.luluProbeVoice.synthesized++;
          }, error => window.luluProbeVoice.errors.push(String(error)));
        }
        if (channel === 'tts:play-pcm') {
          window.luluProbeVoice.started++;
          result.then(played => {
            if (played) window.luluProbeVoice.completed++;
          }, error => window.luluProbeVoice.errors.push(String(error)));
        }
        return result;
      };
    })()`);
    let lastPlaybackTime = await player.webContents.executeJavaScript('window.luluProbeAudio.currentTime');
    async function requirePlayback(seconds) {
      await delay(seconds * 1000);
      const media = await player.webContents.executeJavaScript('({ running: window.luluProbeAudio.state === "running", time: window.luluProbeAudio.currentTime })');
      if (!media.running || media.time - lastPlaybackTime < seconds - 0.25) throw new Error('El audio dejó de avanzar.');
      lastPlaybackTime = media.time;
      reportProgress(media.time);
    }
    async function sampleMemory() {
      const stats = await main.webContents.executeJavaScript('window.voiceStudio.getRuntimeStatus()');
      if (!stats.modules.live || !stats.modules.youtube) throw new Error('El panel no comprobó ambos servicios activos.');
      return { privateMiB: stats.privateMemoryMb, residentMiB: stats.residentMemoryMb, localVoiceProcess: stats.modules.localTts.running };
    }
    function sendChat(msgId, comment) {
      peer.send(JSON.stringify({ type: 'WebcastChatMessage', data: { msgId, user: { userId: msgId, uniqueId: msgId }, comment } }));
    }
    async function sampleWhileReading(id, comment) {
      const previous = await main.webContents.executeJavaScript('window.luluProbeVoice.synthesized');
      sendChat(id, comment);
      const samples = [];
      let commentState;
      for (let attempt = 0; attempt < 40; attempt++) {
        await requirePlayback(0.5);
        const memory = await sampleMemory();
        commentState = await main.webContents.executeJavaScript(`(() => {
          const item = state.comments.find(item => item.id === ${JSON.stringify(id)});
          return { result:item?.result, reason:item?.reason, speaking:state.speaking, mode:state.settings.voiceMode, native:window.luluProbeVoice };
        })()`);
        samples.push({ ...memory, pcmReady:commentState.native.synthesized > previous });
        if (['read', 'skipped', 'blocked'].includes(commentState.result)) break;
      }
      const peakResidentMiB = Math.max(...samples.map(sample => sample.residentMiB));
      if (commentState.result !== 'read' || commentState.native.synthesized <= previous) {
        throw new Error(`La lectura de ${id} quedó incompleta. ${JSON.stringify({ commentState, peakResidentMiB, last: samples.at(-1) })}`);
      }
      const playback = samples.filter(sample => sample.pcmReady);
      const peakAfterSynthesisMiB = Math.max(...playback.map(sample => sample.residentMiB));
      if (!playback.some(sample => !sample.localVoiceProcess)) throw new Error('El motor de voz quedó cargado durante toda la lectura.');
      return { peakResidentMiB, peakAfterSynthesisMiB, samples };
    }

    for (let check = 0; check < 3; check++) await requirePlayback(3);
    const foregroundIdleLive = await sampleMemory();
    const foreground = await sampleWhileReading('ahorro-visible', 'Seguimos en directo y podemos escuchar los comentarios del chat mientras la música sigue sonando en el reproductor de Lulu.');
    await main.call('window-minimize');
    for (let check = 0; check < 3; check++) await requirePlayback(3);
    const backgroundIdleLive = await sampleMemory();

    const before = await player.webContents.executeJavaScript('window.luluProbeAudio.currentTime');
    const cleanup = await main.webContents.executeJavaScript('window.voiceStudio.releaseIdleResources({force:true,keepMusic:false})');
    if (!cleanup.keptMusic || !cleanup.protectedCategories.includes('live') || player.isDestroyed()) {
      throw new Error('El ahorro intervino en el LIVE o el reproductor activo.');
    }
    const background = await sampleWhileReading('ahorro-prueba', 'La voz local puede leer el comentario completo y dejar que la música siga sonando en segundo plano con Lulu minimizada.');
    const verify = await main.webContents.executeJavaScript(`(async () => {
      return { minimized: document.hidden, received: state.comments.some(item => item.id === 'ahorro-prueba') };
    })()`);
    if (!verify.received) throw new Error('El LIVE no entregó el comentario al renderer.');
    if (!verify.minimized) throw new Error('WebView2 siguió tratando la ventana minimizada como visible.');

    await requirePlayback(3);
    const initial = await sampleMemory();
    for (let check = 0; check < 4; check++) await requirePlayback(4);
    const settled = await sampleMemory();
    const release = await main.webContents.executeJavaScript('window.voiceStudio.releaseIdleResources({force:true,keepMusic:false})');
    if (!release.keptMusic || !release.protectedCategories.includes('live')) throw new Error('El ahorro interfirió con los servicios activos.');
    for (let check = 0; check < 3; check++) await requirePlayback(4);
    const afterRelease = await sampleMemory();
    peer.send(JSON.stringify({
      type: 'WebcastChatMessage',
      data: { msgId: 'ahorro-prueba-final', user: { userId: '91', uniqueId: 'lulu_test' }, comment: 'el directo sigue activo' }
    }));
    const chatAfterRelease = await main.webContents.executeJavaScript(`(async () => {
      for (let i = 0; i < 20; i++) {
        if (state.comments.some(item => item.comment === 'el directo sigue activo')) return true;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return false;
    })()`);
    if (!chatAfterRelease) throw new Error('El LIVE dejó de entregar comentarios tras liberar memoria.');
    const nativeVoice = await main.webContents.executeJavaScript('window.luluProbeVoice');
    return { ok: true, chat: verify.received, chatAfterRelease, hidden: verify.minimized, audioSeconds: lastPlaybackTime - before,
      nativeVoice, foregroundIdleLive, foreground, backgroundIdleLive, background, initial, settled, afterRelease,
      targetResidentMiB: 300 };
  } finally {
    expectMusic(false);
    if (!player.isDestroyed()) player.destroy();
    await endLive();
    for (const client of server.clients) client.terminate();
    await new Promise(resolve => server.close(resolve));
  }
};
