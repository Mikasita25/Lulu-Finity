(function attachCommandMatching(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuluCommandMatching = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const INVISIBLE_CHARACTERS = /[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu;

  function cleanCommandText(value) {
    let text = String(value ?? '')
      .normalize('NFKC')
      .replace(INVISIBLE_CHARACTERS, '')
      .replace(/\s+/gu, ' ')
      .trim();
    if (text.startsWith('¡')) text = `!${text.slice(1)}`;
    return text.replace(/^!\s+/u, '!');
  }

  function commandKey(value) {
    const text = cleanCommandText(value);
    const token = text.match(/^!([^\s:;,?.]+)/u)?.[1] || '';
    if (!token) return '';
    return `!${token.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}`;
  }

  function parseCommandText(value) {
    const text = cleanCommandText(value);
    const match = text.match(/^!([^\s:;,?.]+)(?:\s*[:;,?.]\s*|\s+|$)([\s\S]*)$/u);
    if (!match) return null;
    const key = commandKey(`!${match[1]}`);
    return key ? { key, remainder: String(match[2] || '').trim(), text } : null;
  }

  function matchCommand(value, trigger) {
    const parsed = parseCommandText(value);
    const triggerKey = commandKey(trigger);
    return parsed && triggerKey && parsed.key === triggerKey
      ? { ...parsed, trigger: triggerKey }
      : null;
  }

  return { cleanCommandText, commandKey, parseCommandText, matchCommand };
});
