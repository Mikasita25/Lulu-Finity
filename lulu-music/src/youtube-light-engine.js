'use strict';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_SEARCH_HTML_BYTES = 12 * 1024 * 1024;

function validYoutubeId(value) {
  const id = String(value || '').trim();
  return YOUTUBE_ID.test(id) ? id : '';
}

function youtubeVideoId(value) {
  const raw = String(value || '').trim();
  const direct = validYoutubeId(raw);
  if (direct) return direct;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return validYoutubeId(url.pathname.split('/').filter(Boolean)[0]);
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return '';
    if (url.pathname === '/watch') return validYoutubeId(url.searchParams.get('v'));
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/i);
    return validYoutubeId(match?.[1]);
  } catch {
    return '';
  }
}

function youtubeEmbedUrl(videoId) {
  const id = validYoutubeId(videoId);
  if (!id) throw new Error('El enlace de YouTube no contiene un video válido.');
  const params = new URLSearchParams({
    autoplay:'1', controls:'1', enablejsapi:'1', playsinline:'1', rel:'0', iv_load_policy:'3'
  });
  return `https://www.youtube.com/embed/${id}?${params}`;
}

function isYoutubeEmbedUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'www.youtube.com' && Boolean(validYoutubeId(url.pathname.match(/^\/embed\/([^/?#]+)/)?.[1]));
  } catch {
    return false;
  }
}

function rendererText(value) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  if (typeof value.simpleText === 'string') return value.simpleText.trim();
  if (typeof value.content === 'string') return value.content.trim();
  if (Array.isArray(value.runs)) return value.runs.map((run) => String(run?.text || '')).join('').trim();
  return '';
}

function rendererCandidate(renderer) {
  if (!renderer || typeof renderer !== 'object') return null;
  const videoId = validYoutubeId(renderer.videoId || renderer.contentId);
  if (!videoId) return null;
  const metadata = renderer.metadata?.lockupMetadataViewModel || renderer.metadata || {};
  const title = rendererText(renderer.title) || rendererText(metadata.title) || rendererText(metadata.title?.content);
  const artist = rendererText(renderer.ownerText) || rendererText(renderer.longBylineText) ||
    rendererText(renderer.shortBylineText) || rendererText(metadata.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text);
  return { videoId, title, artist };
}

function jsonObjectAt(source, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return '';
}

function initialDataFromHtml(html) {
  const source = String(html || '');
  const markers = ['var ytInitialData =', 'window["ytInitialData"] =', 'ytInitialData ='];
  for (const marker of markers) {
    let offset = 0;
    while (offset < source.length) {
      const markerAt = source.indexOf(marker, offset);
      if (markerAt < 0) break;
      const objectAt = source.indexOf('{', markerAt + marker.length);
      if (objectAt < 0) break;
      const objectSource = jsonObjectAt(source, objectAt);
      try { return JSON.parse(objectSource); } catch {}
      offset = objectAt + 1;
    }
  }
  return null;
}

function youtubeSearchCandidates(html) {
  const results = [];
  const seen = new Set();
  const add = (candidate) => {
    if (!candidate?.videoId || seen.has(candidate.videoId)) return;
    seen.add(candidate.videoId);
    results.push({ videoId:candidate.videoId, title:candidate.title || '', artist:candidate.artist || '' });
  };
  const initialData = initialDataFromHtml(html);
  if (initialData) {
    const stack = [initialData];
    let visited = 0;
    while (stack.length && visited < 150_000) {
      const value = stack.pop();
      visited += 1;
      if (!value || typeof value !== 'object') continue;
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) stack.push(value[index]);
        continue;
      }
      for (const key of ['videoRenderer','compactVideoRenderer','gridVideoRenderer','videoWithContextRenderer']) add(rendererCandidate(value[key]));
      const lockup = value.lockupViewModel;
      if (lockup && (!lockup.contentType || /VIDEO/i.test(String(lockup.contentType)))) add(rendererCandidate(lockup));
      const entries = Object.values(value);
      for (let index = entries.length - 1; index >= 0; index -= 1) stack.push(entries[index]);
    }
  }
  if (!results.length) {
    const source = String(html || '');
    const patterns = [
      /"videoRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/g,
      /"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/g
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) add({ videoId:match[1], title:'', artist:'' });
      if (results.length) break;
    }
  }
  return results;
}

async function resolveYoutubeRequest(query, options = {}) {
  const clean = String(query || '').trim();
  if (!clean) throw new Error('Escribe una canción o un enlace de YouTube.');
  const directId = youtubeVideoId(clean);
  if (directId) return { videoId:directId, title:'', artist:'', direct:true };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('La búsqueda ligera de YouTube no está disponible.');
  const excluded = new Set((options.excludeVideoIds || []).map(validYoutubeId).filter(Boolean));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
    const response = await fetchImpl(url, {
      redirect:'follow', signal:controller.signal,
      headers:{
        'accept-language':'es-MX,es;q=0.9,en;q=0.7',
        'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36 LuluMusic/1'
      }
    });
    if (!response?.ok) throw new Error(`YouTube respondió ${response?.status || 'sin conexión'}.`);
    const declaredSize = Number(response.headers?.get?.('content-length')) || 0;
    if (declaredSize > MAX_SEARCH_HTML_BYTES) throw new Error('La respuesta de búsqueda de YouTube fue demasiado grande.');
    const html = await response.text();
    if (Buffer.byteLength(html, 'utf8') > MAX_SEARCH_HTML_BYTES) throw new Error('La respuesta de búsqueda de YouTube fue demasiado grande.');
    const match = youtubeSearchCandidates(html).find((candidate) => !excluded.has(candidate.videoId));
    if (!match) throw new Error('YouTube no encontró una canción reproducible.');
    return { ...match, direct:false };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('La búsqueda ligera de YouTube tardó demasiado.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  MAX_SEARCH_HTML_BYTES,
  validYoutubeId,
  youtubeVideoId,
  youtubeEmbedUrl,
  isYoutubeEmbedUrl,
  youtubeSearchCandidates,
  resolveYoutubeRequest
};
