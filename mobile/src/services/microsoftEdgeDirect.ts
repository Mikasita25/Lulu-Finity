const EDGE_TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_CHROMIUM_VERSION = '143.0.3650.75';
const EDGE_GEC_VERSION = `1-${EDGE_CHROMIUM_VERSION}`;
const WINDOWS_EPOCH_SECONDS = 11_644_473_600;

type DirectSpeechOptions = {
  text: string;
  voice: string;
  rate: number;
  pitch: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
] as const;

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function utf8Bytes(value: string) {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >>> 12), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

export function sha256Hex(value: string) {
  const input = utf8Bytes(value);
  const bitLength = input.length * 8;
  const totalLength = Math.ceil((input.length + 1 + 8) / 64) * 64;
  const padded = new Uint8Array(totalLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const value15 = words[index - 15] ?? 0;
      const value2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(value15, 7) ^ rotateRight(value15, 18) ^ (value15 >>> 3);
      const sigma1 = rotateRight(value2, 17) ^ rotateRight(value2, 19) ^ (value2 >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((word) => word.toString(16).padStart(8, '0')).join('');
}

export function generateSecMsGec(nowMs = Date.now()) {
  let ticks = nowMs / 1000 + WINDOWS_EPOCH_SECONDS;
  ticks -= ticks % 300;
  ticks *= 10_000_000;
  return sha256Hex(`${ticks.toFixed(0)}${EDGE_TRUSTED_CLIENT_TOKEN}`).toUpperCase();
}

function randomHex32() {
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += Math.floor(Math.random() * 16).toString(16);
  }
  return value;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function signed(value: number, suffix: string) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}${suffix}`;
}

export function toMicrosoftVoiceName(voice: string) {
  const match = /^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(voice);
  if (!match) throw new Error('La voz Microsoft seleccionada no es válida.');
  return `Microsoft Server Speech Text to Speech Voice (${match[1]}-${match[2]}, ${match[3]})`;
}

function edgeTimestamp() {
  return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

function speechConfigMessage() {
  return `X-Timestamp:${edgeTimestamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(
    {
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: 'false',
              wordBoundaryEnabled: 'false',
            },
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          },
        },
      },
    },
  )}\r\n`;
}

function ssmlMessage(text: string, voice: string, rate: number, pitch: number) {
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-MX'><voice name='${toMicrosoftVoiceName(
    voice,
  )}'><prosody pitch='${signed((pitch - 1) * 50, 'Hz')}' rate='${signed(
    (rate - 1) * 100,
    '%',
  )}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
  return `X-RequestId:${randomHex32()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${edgeTimestamp()}Z\r\nPath:ssml\r\n\r\n${ssml}`;
}

function messagePath(message: string) {
  return (
    message
      .match(/(?:^|\r\n)Path:([^\r\n]+)/i)?.[1]
      ?.trim()
      .toLowerCase() ?? ''
  );
}

export function parseEdgeAudioFrame(frame: Uint8Array) {
  if (frame.length < 3) return null;
  const headerLength = ((frame[0] ?? 0) << 8) | (frame[1] ?? 0);
  const audioOffset = headerLength + 2;
  if (audioOffset >= frame.length) return null;
  return frame.slice(audioOffset);
}

function concatChunks(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function blobToArrayBuffer(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Android no pudo leer el audio de Microsoft.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

async function binaryMessageBytes(data: unknown) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof Blob) return new Uint8Array(await blobToArrayBuffer(data));
  throw new Error('Microsoft devolvió un formato de audio no compatible.');
}

function abortError() {
  const error = new Error('La lectura TTS fue detenida.');
  error.name = 'AbortError';
  return error;
}

export function synthesizeMicrosoftSpeechDirect({
  text,
  voice,
  rate,
  pitch,
  timeoutMs = 15_000,
  signal,
}: DirectSpeechOptions) {
  if (signal?.aborted) return Promise.reject(abortError());

  const connectionId = randomHex32();
  const url = `${EDGE_WSS_URL}?TrustedClientToken=${EDGE_TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=${EDGE_GEC_VERSION}&ConnectionId=${connectionId}`;

  return new Promise<Uint8Array>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    const chunks: Uint8Array[] = [];
    let settled = false;
    let turnEnded = false;
    let pendingBinary = 0;

    const timeout = setTimeout(() => {
      fail(new Error('Microsoft tardó demasiado en generar la voz.'));
    }, timeoutMs);

    const onAbort = () => fail(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
    }

    function closeSocket() {
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {}
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      closeSocket();
      reject(error);
    }

    function finishIfReady() {
      if (settled || !turnEnded || pendingBinary > 0) return;
      const audio = concatChunks(chunks);
      if (!audio.length) {
        fail(new Error('Microsoft no devolvió audio. Comprueba tu conexión a internet.'));
        return;
      }
      settled = true;
      cleanup();
      closeSocket();
      resolve(audio);
    }

    socket.onopen = () => {
      try {
        socket.send(speechConfigMessage());
        socket.send(ssmlMessage(text, voice, rate, pitch));
      } catch (error) {
        fail(error instanceof Error ? error : new Error('No se pudo solicitar la voz Microsoft.'));
      }
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        if (messagePath(event.data) === 'turn.end') {
          turnEnded = true;
          finishIfReady();
        }
        return;
      }

      pendingBinary += 1;
      void binaryMessageBytes(event.data)
        .then((frame) => {
          const audio = parseEdgeAudioFrame(frame);
          if (audio?.length) chunks.push(audio);
        })
        .catch((error) => {
          fail(error instanceof Error ? error : new Error('No se pudo procesar el audio Microsoft.'));
        })
        .finally(() => {
          pendingBinary -= 1;
          finishIfReady();
        });
    };

    socket.onerror = () => {
      fail(new Error('No se pudo conectar directamente con Microsoft TTS.'));
    };

    socket.onclose = () => {
      turnEnded = true;
      finishIfReady();
    };
  });
}
