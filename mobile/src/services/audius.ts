const AUDIUS_API_BASE = 'https://api.audius.co/v1';
const AUDIUS_APP_NAME = 'LuluFinityMobile';
const IGNORED_QUERY_WORDS = new Set([
  'a', 'al', 'and', 'audio', 'cancion', 'canción', 'con', 'de', 'del', 'el', 'en', 'feat', 'ft',
  'la', 'las', 'letra', 'lyrics', 'los', 'music', 'musica', 'música', 'official', 'oficial', 'the',
  'un', 'una', 'video', 'vídeo', 'y',
]);

export type AudiusTrack = {
  trackId: string;
  title: string;
  artist: string;
  streamUrl: string;
  artworkUrl?: string;
};

type AudiusTrackPayload = {
  id?: unknown;
  track_id?: unknown;
  title?: unknown;
  duration?: unknown;
  is_available?: unknown;
  is_streamable?: unknown;
  is_stream_gated?: unknown;
  access?: { stream?: unknown } | null;
  artwork?: Record<string, unknown> | null;
  user?: {
    name?: unknown;
    handle?: unknown;
    is_verified?: unknown;
  } | null;
  play_count?: unknown;
};

function normalizedText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function meaningfulTokens(value: unknown) {
  return [...new Set(
    normalizedText(value)
      .split(/\s+/)
      .filter((word) => word.length > 1 && !IGNORED_QUERY_WORDS.has(word)),
  )];
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function artworkUrl(track: AudiusTrackPayload) {
  const artwork = track.artwork;
  if (!artwork) return undefined;
  const candidates = ['1000x1000', '480x480', '150x150'];
  for (const size of candidates) {
    const value = stringValue(artwork[size]);
    if (value.startsWith('https://')) return value;
  }
  return undefined;
}

function candidate(track: AudiusTrackPayload) {
  const id = stringValue(track.id ?? track.track_id);
  const title = stringValue(track.title);
  if (!id || !title) return null;
  if (track.is_available === false || track.is_streamable === false || track.is_stream_gated === true) return null;
  if (track.access?.stream === false) return null;

  const artist = stringValue(track.user?.name) || stringValue(track.user?.handle);
  const streamUrl = `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(id)}/stream?app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`;
  return {
    trackId: id,
    title,
    artist,
    streamUrl,
    artworkUrl: artworkUrl(track),
    verified: track.user?.is_verified === true,
    playCount: Math.max(0, Number(track.play_count) || 0),
  };
}

function scoreCandidate(query: string, value: NonNullable<ReturnType<typeof candidate>>) {
  const queryTokens = meaningfulTokens(query);
  const titleTokens = new Set(meaningfulTokens(value.title));
  const artistTokens = new Set(meaningfulTokens(value.artist));
  const allTokens = new Set([...titleTokens, ...artistTokens]);
  const matches = queryTokens.filter((token) => allTokens.has(token)).length;
  const titleMatches = queryTokens.filter((token) => titleTokens.has(token)).length;
  const artistMatches = queryTokens.filter((token) => artistTokens.has(token)).length;
  const coverage = queryTokens.length ? matches / queryTokens.length : 0;
  const exactTitle = normalizedText(query) === normalizedText(value.title);
  const score = coverage * 100 + titleMatches * 10 + artistMatches * 8 + (exactTitle ? 20 : 0) +
    (value.verified ? 6 : 0) + Math.min(5, Math.log10(value.playCount + 1));
  return { score, coverage, titleMatches, artistMatches, exactTitle };
}

export async function resolveAudiusTrack(query: string, signal?: AbortSignal): Promise<AudiusTrack | null> {
  const clean = query.trim().replace(/\s+/g, ' ');
  if (!clean) return null;

  const url = new URL(`${AUDIUS_API_BASE}/tracks/search`);
  url.searchParams.set('query', clean);
  url.searchParams.set('limit', '10');
  url.searchParams.set('sort_method', 'relevant');
  url.searchParams.set('app_name', AUDIUS_APP_NAME);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) return null;

  const payload = await response.json() as { data?: AudiusTrackPayload[] };
  const tracks = Array.isArray(payload.data) ? payload.data : [];
  const ranked = tracks
    .map(candidate)
    .filter((item): item is NonNullable<ReturnType<typeof candidate>> => Boolean(item))
    .map((item) => ({ ...item, ...scoreCandidate(clean, item) }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best) return null;
  const confident = best.exactTitle || best.coverage >= 0.6 || (best.coverage >= 0.5 && best.titleMatches > 0 && best.artistMatches > 0);
  if (!confident) return null;

  return {
    trackId: best.trackId,
    title: best.title,
    artist: best.artist,
    streamUrl: best.streamUrl,
    artworkUrl: best.artworkUrl,
  };
}
