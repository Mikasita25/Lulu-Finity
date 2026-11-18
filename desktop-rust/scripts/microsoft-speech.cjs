'use strict';

async function synthesizeMicrosoft({ Communicate, text, voice, rate, pitch }) {
  const engine = new Communicate(text, { voice, rate, pitch, volume: '+0%', connectionTimeout: 7000 });
  const createWebSocket = engine.createWebSocket.bind(engine);
  let socket;
  let expired = false;
  let deadline;
  engine.createWebSocket = async url => {
    socket = await createWebSocket(url);
    if (expired) {
      socket.on('error', () => {});
      socket.terminate();
      throw new Error('La conexión de voz ya había expirado.');
    }
    return socket;
  };

  const readAudio = async () => {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of engine.stream()) {
      if (chunk.type !== 'audio' || !chunk.data?.length) continue;
      bytes += chunk.data.length;
      if (bytes > 8 * 1024 * 1024) throw new Error('El audio generado es demasiado grande.');
      chunks.push(Buffer.from(chunk.data));
    }
    if (!bytes) throw new Error('Microsoft no devolvió audio para la voz seleccionada.');
    return { mimeType: 'audio/mpeg', data: Buffer.concat(chunks, bytes).toString('base64'), bytes };
  };

  try {
    return await Promise.race([
      readAudio(),
      new Promise((_, reject) => {
        deadline = setTimeout(() => {
          expired = true;
          reject(new Error('Microsoft tardó demasiado en generar la voz seleccionada.'));
        }, 12_000);
      })
    ]);
  } finally {
    clearTimeout(deadline);
    if (socket && socket.readyState < 2) {
      socket.on('error', () => {});
      socket.terminate();
    }
  }
}

module.exports = { synthesizeMicrosoft };
