'use strict';

const xmlEscapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

async function synthesizeMicrosoft({ text, voice, rate, pitch }) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const engine = new MsEdgeTTS({ connectionTimeoutMs: 8_000, synthesisTimeoutMs: 12_000 });
  const plainText = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, character => xmlEscapes[character]);
  try {
    await engine.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = engine.toStream(plainText, { rate, pitch });
    const chunks = [];
    let bytes = 0;
    for await (const chunk of audioStream) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) throw new Error('El audio generado es demasiado grande.');
      chunks.push(Buffer.from(chunk));
    }
    if (!bytes) throw new Error('Microsoft no devolvió audio para la voz seleccionada.');
    return { mimeType: 'audio/mpeg', data: Buffer.concat(chunks, bytes).toString('base64'), bytes };
  } finally {
    engine.close();
  }
}

module.exports = { synthesizeMicrosoft };
