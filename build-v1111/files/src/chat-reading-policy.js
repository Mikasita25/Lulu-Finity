'use strict';

(function exposeChatReadingPolicy(root) {
  const DIRECTED_REPLY_PATTERN = /^\s*@[a-z0-9._-]{1,80}(?=\s|[:;,!?¿¡]|$)/i;

  function isDirectedReply(value) {
    return DIRECTED_REPLY_PATTERN.test(String(value || ''));
  }

  const api = Object.freeze({ isDirectedReply });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuluChatPolicy = api;
})(typeof window !== 'undefined' ? window : null);
