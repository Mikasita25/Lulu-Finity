'use strict';

const AUDIUS_API_BASE = 'https://api.audius.co/v1';
const AUDIUS_APP_NAME = 'LuluMusic';
const MAX_AUDIUS_JSON_BYTES = 6 * 1024 * 1024;
const AUDIUS_ID = /^[A-Za-z0-9_-]{2,32}$/;
const IGNORED_QUERY_WORDS = new Set([
  'a','al','and','audio','cancion','canción','con','de','del','el','en','feat','ft','la','las','letra','lyrics',
  'los','music','musica','música','official','oficial','the','un','una','video','vídeo','y'
]);

class AudiusLookupError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AudiusLookupError';
    this.code = code;
  }
}

function normalizedText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function meaningfulTokens(value) {
  return [...new Set(normalizedText(value).split(/\s+/).filter((word) => word.length > 1 && !IGNORED_QUERY_WORDS.has(word)))];
}

function isAudiusUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    return url.protocol === 'https:' && (host === 'audius.co' || host.endsWith('.audius.co')) && url.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

function validTrackId(value) {
  const id = String(value || '').trim();
  return AUDIUS_ID.test(id) ? id : '';
}

function audiusStreamUrl(trackId) {
  const id = validTrackId(trackId);
  if (!id) throw new AudiusLookupError('invalid-track', 'Audius devolvió una pista sin identificador válido.');
  const url = new URL(`${AUDIUS_API_BASE}/tracks/${encodeURIComponent(id)}/stream`);
  url.searchParams.set('app_name', AUDIUS_APP_NAME);
  return url.toString();
}

function isAudiusStreamUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return false;
    if (url.hostname === 'api.audius.co' && /^\/v1\/tracks\/[A-Za-z0-9_-]{2,32}\/stream$/.test(url.pathname)) return true;
    return /^\/tracks\/cidstream\/[A-Za-z0-9_-]{20,120}$/.test(url.pathname) && url.searchParams.has('signature');
  } catch {
    return false;
  }
}

function trackArtist(track) {
  return String(track?.user?.name || track?.user?.handle || track?.artist || '').trim();
}

function trackCandidate(track) {
  const id = validTrackId(track?.id || track?.track_id);
  if (!id || track?.is_available === false || track?.is_streamable === false || track?.access?.stream === false || track?.is_stream_gated) return null;
  const title = String(track?.title || '').trim();
  if (!title) return null;
  const artist = trackArtist(track);
  const permalink = String(track?.permalink || '').trim();
  const sourceUrl = permalink
    ? new URL(permalink.replace(/^\/+/, ''), 'https://audius.co/').toString()
    : 'https://audius.co/';
  return {
    trackId:id,
    title,
    artist,
    duration:Math.max(0, Number(track?.duration) || 0),
    streamUrl:isAudiusStreamUrl(track?.stream?.url) ? String(track.stream.url) : audiusStreamUrl(id),
    sourceUrl,
    verified:Boolean(track?.user?.is_verified || track?.user?.verified_with_tiktok || track?.user?.verified_with_twitter || track?.user?.verified_with_instagram),
    playCount:Math.max(0, Number(track?.play_count) || 0)
  };
}

function scoreCandidate(query, candidate) {
  const queryTokens = meaningfulTokens(query);
  const titleTokens = meaningfulTokens(candidate?.title);
  const artistTokens = meaningfulTokens(candidate?.artist);
  const all = new Set([...titleTokens, ...artistTokens]);
  const title = new Set(titleTokens);
  const artist = new Set(artistTokens);
  const queryMatches = queryTokens.filter((token) => all.has(token)).length;
  const titleMatches = queryTokens.filter((token) => title.has(token)).length;
  const artistMatches = queryTokens.filter((token) => artist.has(token)).length;
  const coverage = queryTokens.length ? queryMatches / queryTokens.length : 0;
  const titleCoverage = titleTokens.length ? titleMatches / Math.min(titleTokens.length, Math.max(1, queryTokens.length)) : 0;
  const exactTitle = Boolean(normalizedText(query) && normalizedText(query) === normalizedText(candidate?.title));
  const score = coverage * 70 + Math.min(1, titleCoverage) * 15 + Math.min(artistMatches, 2) * 8 +
    (exactTitle ? 8 : 0) + (candidate?.verified ? 10 : 0) + Math.min(4, Math.log10((candidate?.playCount || 0) + 1));
  const confident = queryTokens.length > 0 && coverage >= 0.75 && titleMatches > 0 && (
    artistMatches > 0 || (candidate?.verified && exactTitle)
  );
  return { score, confident, coverage, titleMatches, artistMatches, exactTitle };
}

async function responseJson(response) {
  if (!response?.ok) throw new AudiusLookupError('network', `Audius respondió ${response?.status || 'sin conexión'}.`);
  const declared = Number(response.headers?.get?.('content-length')) || 0;
  if (declared > MAX_AUDIUS_JSON_BYTES) throw new AudiusLookupError('oversize', 'La respuesta de Audius fue demasiado grande.');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_AUDIUS_JSON_BYTES) throw new AudiusLookupError('oversize', 'La respuesta de Audius fue demasiado grande.');
  try { return JSON.parse(text); }
  catch { throw new AudiusLookupError('invalid-response', 'Audius devolvió una respuesta no válida.'); }
}

async function fetchAudius(pathname, params, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new AudiusLookupError('unavailable', 'La búsqueda ligera de Audius no está disponible.');
  const url = new URL(`${AUDIUS_API_BASE}${pathname}`);
  Object.entries({ ...params, app_name:AUDIUS_APP_NAME }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(url.toString(), {
      redirect:'follow',
      signal:controller.signal,
      headers:{ accept:'application/json', 'accept-language':'es-MX,es;q=0.9,en;q=0.7', 'user-agent':'LuluMusic/1 AudiusDirectAudio' }
    });
    return await responseJson(response);
  } catch (error) {
    if (error?.name === 'AbortError') throw new AudiusLookupError('timeout', 'La búsqueda de Audius tardó demasiado.');
    if (error instanceof AudiusLookupError) throw error;
    throw new AudiusLookupError('network', `No se pudo consultar Audius: ${error?.message || error}`);
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAudiusRequest(query, options = {}) {
  const clean = String(query || '').trim();
  if (!clean) throw new AudiusLookupError('empty', 'Escribe una canción o un enlace de Audius.');
  const direct = isAudiusUrl(clean);
  const payload = direct
    ? await fetchAudius('/resolve', { url:clean }, options)
    : await fetchAudius('/tracks/search', { query:clean, limit:10, sort_method:'relevant' }, options);
  const rawTracks = direct ? [payload?.data] : Array.isArray(payload?.data) ? payload.data : [];
  const ranked = rawTracks
    .map(trackCandidate)
    .filter(Boolean)
    .map((candidate) => ({ ...candidate, ...scoreCandidate(clean, candidate) }))
    .sort((left, right) => right.score - left.score);
  const result = ranked[0];
  if (!result) throw new AudiusLookupError('not-found', 'Audius no encontró una pista reproducible.');
  if (options.requireConfident && !direct && !result.confident) {
    throw new AudiusLookupError('low-confidence', 'Audius no encontró una coincidencia suficientemente exacta.');
  }
  return { ...result, direct };
}

module.exports = {
  AUDIUS_API_BASE,
  AUDIUS_APP_NAME,
  MAX_AUDIUS_JSON_BYTES,
  AudiusLookupError,
  normalizedText,
  meaningfulTokens,
  isAudiusUrl,
  audiusStreamUrl,
  isAudiusStreamUrl,
  trackCandidate,
  scoreCandidate,
  resolveAudiusRequest
};
