'use strict';

(function exposeLuluText(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LuluText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u200D\uFE0F]/gu;
  const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  const CYRILLIC = /\p{Script=Cyrillic}/u;
  const GREEK = /\p{Script=Greek}/u;
  const LATIN = /\p{Script=Latin}/u;
  const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0]/g;
  const URL = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|gg|tv|io|me|co)(?:\/\S*)?/gi;
  const ALLOWED = /[^\p{Script=Latin}\p{Mark}\p{Number}\p{Punctuation}\p{Separator}]/gu;

  function compact(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function stripEmoji(value) {
    return String(value || '').replace(EMOJI, ' ');
  }

  function normalizeCompatibility(value) {
    return String(value || '').normalize('NFKC');
  }

  function hasBlockedCjk(value) {
    return CJK.test(String(value || ''));
  }

  function hasSuspiciousScriptMix(value) {
    const text = String(value || '');
    return LATIN.test(text) && (CYRILLIC.test(text) || GREEK.test(text));
  }

  function collapseNoise(value) {
    return String(value || '')
      .replace(/([!?.,])\1{2,}/g, '$1$1')
      .replace(/([\p{Letter}\p{Number}])\1{4,}/gu, '$1$1$1');
  }

  function applyDictionary(value, dictionary = []) {
    let text = String(value || '');
    const entries = Array.isArray(dictionary) ? dictionary : [];
    for (const entry of entries) {
      const from = String(entry?.from || entry?.word || '').trim();
      if (!from) continue;
      const to = String(entry?.to ?? entry?.replacement ?? '').trim();
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`(^|[^\\p{Letter}\\p{Number}])(${escaped})(?=$|[^\\p{Letter}\\p{Number}])`, 'giu'), (_match, prefix) => `${prefix}${to}`);
    }
    return text;
  }

  function prepare(value, options = {}) {
    const original = String(value || '');
    let text = normalizeCompatibility(original).replace(INVISIBLE, ' ');
    const cjkDetected = hasBlockedCjk(text);
    const suspiciousMix = hasSuspiciousScriptMix(text);

    if (options.blockCjk !== false && cjkDetected) {
      return { allowed: false, reason: 'alfabeto CJK bloqueado', text: '', original, cjkDetected, suspiciousMix };
    }
    if (options.blockMixedScripts !== false && suspiciousMix) {
      return { allowed: false, reason: 'mezcla de alfabetos', text: '', original, cjkDetected, suspiciousMix };
    }

    text = stripEmoji(text);
    text = text.replace(/[_|~^*=+<>`]+/g, ' ');
    text = text.replace(URL, options.blockLinks === false ? ' enlace ' : ' ');
    text = text.normalize('NFD').replace(/\p{Mark}{3,}/gu, '').normalize('NFC');
    if (options.latinOnly !== false) text = text.replace(ALLOWED, ' ');
    text = applyDictionary(text, options.dictionary);
    text = collapseNoise(compact(text));

    const maxCharacters = Math.max(1, Number(options.maxCharacters) || 180);
    if (text.length > maxCharacters) text = compact(text.slice(0, maxCharacters));
    if (!text || !/[\p{Letter}\p{Number}]/u.test(text)) {
      return { allowed: false, reason: 'sin texto legible', text: '', original, cjkDetected, suspiciousMix };
    }
    return { allowed: true, reason: '', text, original, cjkDetected, suspiciousMix };
  }

  function prepareUsername(value, options = {}) {
    const result = prepare(String(value || '').replace(/^@/, ''), {
      ...options,
      blockLinks: true,
      maxCharacters: Math.min(48, Math.max(1, Number(options.maxCharacters) || 32))
    });
    if (!result.allowed) return { ...result, text: '' };
    return { ...result, text: compact(result.text.replace(/\bdice\b[\s:]*$/i, '')) };
  }

  function speechForMessage(message, options = {}) {
    const comment = prepare(message?.comment, options);
    if (!comment.allowed) return comment;
    if (options.includeUsername === false) return comment;
    const username = prepareUsername(message?.nickname || message?.uniqueId || '', options);
    return {
      ...comment,
      username: username.text,
      text: username.text ? `${username.text} dice: ${comment.text}` : comment.text
    };
  }

  return {
    applyDictionary,
    collapseNoise,
    hasBlockedCjk,
    hasSuspiciousScriptMix,
    normalizeCompatibility,
    prepare,
    prepareUsername,
    speechForMessage,
    stripEmoji
  };
});
