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
    await main.call('window-minimize');
    await delay(1000);

    const before = await player.webContents.executeJavaScript('window.luluProbeAudio.currentTime');
    const cleanup = await main.webContents.executeJavaScript('window.voiceStudio.releaseIdleResources({force:true,keepMusic:false})');
    if (!cleanup.keptMusic || !cleanup.protectedCategories.includes('live') || player.isDestroyed()) {
      throw new Error('El ahorro intervino en el LIVE o el reproductor activo.');
    }
    peer.send(JSON.stringify({
      type: 'WebcastChatMessage',
      data: { msgId: 'ahorro-prueba', user: { userId: '91', uniqueId: 'lulu_test' }, comment: 'prueba de continuidad' }
    }));
    const verify = await main.webContents.executeJavaScript(`(async () => {
      for (let i = 0; i < 20 && !state.comments.some(item => item.comment === 'prueba de continuidad'); i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return { minimized: document.hidden, received: state.comments.some(item => item.comment === 'prueba de continuidad') };
    })()`);
    if (!verify.received) throw new Error('El LIVE no entregó el comentario al renderer.');
    if (!verify.minimized) throw new Error('WebView2 siguió tratando la ventana minimizada como visible.');

    let lastPlaybackTime = before;
    async function requirePlayback(seconds) {
      await delay(seconds * 1000);
      const media = await player.webContents.executeJavaScript('({ running: window.luluProbeAudio.state === "running", time: window.luluProbeAudio.currentTime })');
      if (!media.running || media.time - lastPlaybackTime < seconds - 1) throw new Error('El audio dejó de avanzar al minimizar.');
      lastPlaybackTime = media.time;
      reportProgress(media.time);
    }
    async function sampleMemory() {
      const stats = await main.webContents.executeJavaScript('window.voiceStudio.getRuntimeStatus()');
      if (!stats.modules.live || !stats.modules.youtube) throw new Error('El panel no comprobó ambos servicios activos.');
      return { privateMiB: stats.privateMemoryMb, residentMiB: stats.residentMemoryMb, localVoiceProcess: stats.modules.localTts.running };
    }

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
    return { ok: true, chat: verify.received, chatAfterRelease, hidden: verify.minimized, audioSeconds: lastPlaybackTime - before,
      initial, settled, afterRelease };
  } finally {
    expectMusic(false);
    if (!player.isDestroyed()) player.destroy();
    await endLive();
    for (const client of server.clients) client.terminate();
    await new Promise(resolve => server.close(resolve));
  }
};
