'use strict';

const MAX_COMMAND_LENGTH = 32;
const MAX_QUERY_LENGTH = 180;

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase().slice(0, 64);
}

function normalizeMusicCommand(value) {
  const compact = String(value || '').trim().replace(/\s+/g, '').slice(0, MAX_COMMAND_LENGTH);
  if (!compact) return '!cancion';
  return /^[!/.]/.test(compact) ? compact.toLowerCase() : `!${compact.toLowerCase()}`;
}

function parseMusicCommand(comment, configuredCommand = '!cancion') {
  const text = String(comment || '').trim();
  const command = normalizeMusicCommand(configuredCommand);
  if (!text || text.length > 600) return null;
  const lowered = text.toLowerCase();
  if (!lowered.startsWith(command)) return null;
  const boundary = text.charAt(command.length);
  if (boundary && !/\s/.test(boundary)) return null;
  const query = text.slice(command.length).trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
  if (!query) return null;
  return { command, query };
}

function requesterAllowed(user = {}, settings = {}) {
  const permission = String(settings.permission || 'all');
  const username = normalizeUsername(user.uniqueId || user.username);
  if (permission === 'followers') return Boolean(user.isFollower || user.isSubscriber);
  if (permission === 'subscribers') return Boolean(user.isSubscriber);
  if (permission === 'selected') {
    const selected = new Set((Array.isArray(settings.selectedUsers) ? settings.selectedUsers : [])
      .map(normalizeUsername).filter(Boolean));
    return Boolean(username && selected.has(username));
  }
  return true;
}

function blockedRequest(query, blockedTerms = []) {
  const normalized = String(query || '').toLocaleLowerCase('es-MX');
  return (Array.isArray(blockedTerms) ? blockedTerms : [])
    .map((term) => String(term || '').trim().toLocaleLowerCase('es-MX'))
    .filter(Boolean)
    .some((term) => normalized.includes(term));
}

const musicPolicyApi = { normalizeUsername, normalizeMusicCommand, parseMusicCommand, requesterAllowed, blockedRequest };
if (typeof module !== 'undefined' && module.exports) module.exports = musicPolicyApi;
if (typeof window !== 'undefined') window.LuluMusicPolicy = musicPolicyApi;
