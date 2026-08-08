'use strict';

const BLOCKED_LANGUAGE_PREFIXES = new Set(['cmn', 'ja', 'ko', 'wuu', 'yue', 'zh']);

const FALLBACK_ONLINE_VOICES = [
  ['es-MX-DaliaNeural', 'Dalia', 'es-MX', 'Female'],
  ['es-MX-JorgeNeural', 'Jorge', 'es-MX', 'Male'],
  ['es-MX-CandelaNeural', 'Candela', 'es-MX', 'Female'],
  ['es-ES-ElviraNeural', 'Elvira', 'es-ES', 'Female'],
  ['es-ES-AlvaroNeural', 'Álvaro', 'es-ES', 'Male'],
  ['es-ES-XimenaNeural', 'Ximena', 'es-ES', 'Female'],
  ['es-US-PalomaNeural', 'Paloma', 'es-US', 'Female'],
  ['es-US-AlonsoNeural', 'Alonso', 'es-US', 'Male'],
  ['es-AR-ElenaNeural', 'Elena', 'es-AR', 'Female'],
  ['es-AR-TomasNeural', 'Tomás', 'es-AR', 'Male'],
  ['en-US-AvaMultilingualNeural', 'Ava Multilingual', 'en-US', 'Female'],
  ['en-US-AndrewMultilingualNeural', 'Andrew Multilingual', 'en-US', 'Male'],
  ['en-US-EmmaNeural', 'Emma', 'en-US', 'Female'],
  ['en-US-BrianNeural', 'Brian', 'en-US', 'Male'],
  ['en-US-JennyNeural', 'Jenny', 'en-US', 'Female'],
  ['en-US-GuyNeural', 'Guy', 'en-US', 'Male'],
  ['en-US-AriaNeural', 'Aria', 'en-US', 'Female'],
  ['en-US-ChristopherNeural', 'Christopher', 'en-US', 'Male'],
  ['en-US-MichelleNeural', 'Michelle', 'en-US', 'Female'],
  ['en-GB-SoniaNeural', 'Sonia', 'en-GB', 'Female'],
  ['en-GB-RyanNeural', 'Ryan', 'en-GB', 'Male'],
  ['en-GB-OliviaNeural', 'Olivia', 'en-GB', 'Female'],
  ['en-AU-NatashaNeural', 'Natasha', 'en-AU', 'Female'],
  ['en-AU-WilliamNeural', 'William', 'en-AU', 'Male'],
  ['en-CA-ClaraNeural', 'Clara', 'en-CA', 'Female'],
  ['en-CA-LiamNeural', 'Liam', 'en-CA', 'Male'],
  ['pt-BR-FranciscaNeural', 'Francisca', 'pt-BR', 'Female'],
  ['pt-BR-AntonioNeural', 'Antonio', 'pt-BR', 'Male'],
  ['fr-FR-DeniseNeural', 'Denise', 'fr-FR', 'Female'],
  ['fr-FR-HenriNeural', 'Henri', 'fr-FR', 'Male'],
  ['fr-CA-SylvieNeural', 'Sylvie', 'fr-CA', 'Female'],
  ['de-DE-KatjaNeural', 'Katja', 'de-DE', 'Female'],
  ['de-DE-ConradNeural', 'Conrad', 'de-DE', 'Male'],
  ['it-IT-IsabellaNeural', 'Isabella', 'it-IT', 'Female'],
  ['it-IT-DiegoNeural', 'Diego', 'it-IT', 'Male'],
  ['ru-RU-SvetlanaNeural', 'Svetlana', 'ru-RU', 'Female'],
  ['ru-RU-DmitryNeural', 'Dmitry', 'ru-RU', 'Male']
].map(([shortName, localName, locale, gender]) => ({
  shortName,
  name: localName,
  localName,
  locale,
  gender,
  fallback: true
}));

function normalizeOnlineVoice(voice) {
  return {
    shortName: String(voice?.ShortName || voice?.shortName || voice?.Name || voice?.name || '').trim(),
    name: String(voice?.FriendlyName || voice?.friendlyName || voice?.LocalName || voice?.localName || '').trim(),
    localName: String(voice?.LocalName || voice?.localName || voice?.FriendlyName || voice?.friendlyName || '').trim(),
    locale: String(voice?.Locale || voice?.locale || '').trim(),
    gender: String(voice?.Gender || voice?.gender || '').trim()
  };
}

function isAllowedVoiceLocale(locale) {
  const language = String(locale || '').trim().toLowerCase().split(/[-_]/)[0];
  return Boolean(language) && !BLOCKED_LANGUAGE_PREFIXES.has(language);
}

function voiceSortKey(voice) {
  const language = voice.locale.toLowerCase().split('-')[0];
  const priority = language === 'es' ? 0 : language === 'en' ? 1 : language === 'pt' ? 2 : 3;
  return [priority, voice.locale, voice.localName || voice.name || voice.shortName];
}

function compareVoices(a, b) {
  const left = voiceSortKey(a);
  const right = voiceSortKey(b);
  return left[0] - right[0]
    || left[1].localeCompare(right[1])
    || left[2].localeCompare(right[2]);
}

function prepareOnlineVoices(input) {
  const unique = new Map();
  for (const item of Array.isArray(input) ? input : []) {
    const voice = normalizeOnlineVoice(item);
    if (!voice.shortName || !voice.locale || !isAllowedVoiceLocale(voice.locale)) continue;
    if (!/^[A-Za-z0-9-]+Neural$/.test(voice.shortName)) continue;
    if (!unique.has(voice.shortName)) unique.set(voice.shortName, voice);
  }
  return [...unique.values()].sort(compareVoices);
}

module.exports = {
  BLOCKED_LANGUAGE_PREFIXES,
  FALLBACK_ONLINE_VOICES,
  isAllowedVoiceLocale,
  normalizeOnlineVoice,
  prepareOnlineVoices
};
