function decodeUtf8(bytes: Uint8Array) {
  const Decoder = (globalThis as any).TextDecoder as
    | (new (label?: string) => { decode: (input: Uint8Array) => string })
    | undefined;
  if (Decoder) return new Decoder('utf-8').decode(bytes);

  let result = '';
  for (let index = 0; index < bytes.length; index += 1) {
    const first = bytes[index] ?? 0;
    if (first < 0x80) {
      result += String.fromCharCode(first);
      continue;
    }
    if ((first & 0xe0) === 0xc0 && index + 1 < bytes.length) {
      const second = bytes[++index] ?? 0;
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      continue;
    }
    if ((first & 0xf0) === 0xe0 && index + 2 < bytes.length) {
      const second = bytes[++index] ?? 0;
      const third = bytes[++index] ?? 0;
      result += String.fromCharCode(
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f),
      );
      continue;
    }
    if ((first & 0xf8) === 0xf0 && index + 3 < bytes.length) {
      const second = bytes[++index] ?? 0;
      const third = bytes[++index] ?? 0;
      const fourth = bytes[++index] ?? 0;
      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
      result += String.fromCodePoint(codePoint);
      continue;
    }
    result += '\uFFFD';
  }
  return result;
}

export async function socketPayloadToText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return decodeUtf8(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) {
    return decodeUtf8(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  const blobLike = data as
    | { text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> }
    | null
    | undefined;
  if (typeof blobLike?.text === 'function') return blobLike.text();
  if (typeof blobLike?.arrayBuffer === 'function') {
    return decodeUtf8(new Uint8Array(await blobLike.arrayBuffer()));
  }
  return String(data ?? '');
}
