import type { LiveEvent } from '@/types/live';
import { useMobileControlStore } from '@/store/useMobileControlStore';

const lastRequestAt = new Map<string, number>();

function normalizedCommands() {
  const { music } = useMobileControlStore.getState();
  return [music.command, ...music.aliases]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => (value.startsWith('!') ? value : `!${value}`));
}

export function parseSongRequest(comment: string) {
  const clean = comment.trim();
  const lower = clean.toLowerCase();
  for (const command of normalizedCommands()) {
    if (lower === command) return { command, query: '' };
    if (lower.startsWith(`${command} `)) {
      return { command, query: clean.slice(command.length).trim() };
    }
  }
  return null;
}

export function handleMusicEvent(event: LiveEvent) {
  if (event.type !== 'comment' || !event.comment) return;
  const state = useMobileControlStore.getState();
  if (!state.music.enabled || state.musicPaused) return;

  const request = parseSongRequest(event.comment);
  if (!request?.query) return;

  const user = (event.uniqueId || event.nickname || 'viewer').trim().replace(/^@/, '').toLowerCase();
  const now = Date.now();
  const previous = lastRequestAt.get(user) ?? 0;
  if (now - previous < state.music.cooldownSeconds * 1000) return;

  const result = state.enqueueSong(request.query, user, 'chat');
  if (result.ok) lastRequestAt.set(user, now);
}

export function clearMusicCooldowns() {
  lastRequestAt.clear();
}

export function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
}
