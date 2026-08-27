'use strict';

(function initWidgetCustomizationPolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LuluWidgetCustomizationPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function widgetCustomizationPolicyFactory() {
  const TYPES = Object.freeze(['playlist','wallet','alert','goal','gift']);
  const TYPE_SET = new Set(TYPES);
  const LAYOUTS = new Set(['compact','glass','queue']);
  const WALLET_SHAPES = new Set(['pill','card']);

  const BASE = Object.freeze({
    enabled: false,
    primaryColor: '#ff67ad',
    secondaryColor: '#5fe8ff',
    backgroundColor: '#171221',
    textColor: '#ffffff',
    mutedColor: '#cfc7d9',
    backgroundOpacity: 88,
    borderOpacity: 14,
    borderRadius: 22,
    blur: 16,
    shadow: 42,
    scale: 100
  });

  const DEFAULTS = Object.freeze({
    playlist: Object.freeze({
      ...BASE,
      enabled: true,
      primaryColor: '#f7ffff',
      secondaryColor: '#d7ffff',
      backgroundColor: '#5b989c',
      textColor: '#ffffff',
      mutedColor: '#d8ebec',
      backgroundOpacity: 90,
      borderOpacity: 8,
      borderRadius: 28,
      blur: 18,
      shadow: 34,
      layout: 'compact',
      showArtwork: true,
      showQueue: false,
      showProvider: false,
      progressHeight: 5
    }),
    wallet: Object.freeze({
      ...BASE,
      primaryColor: '#ffd56a',
      secondaryColor: '#ff9fcb',
      backgroundColor: '#191523',
      walletShape: 'pill'
    }),
    alert: Object.freeze({
      ...BASE,
      primaryColor: '#ff67ad',
      secondaryColor: '#8f7cff',
      backgroundColor: '#171221'
    }),
    goal: Object.freeze({
      ...BASE,
      primaryColor: '#ff70b5',
      secondaryColor: '#65dcff',
      backgroundColor: '#171221',
      goalBarHeight: 14
    }),
    gift: Object.freeze({
      ...BASE,
      primaryColor: '#ff9fc9',
      secondaryColor: '#c79bff',
      backgroundColor: '#171221'
    })
  });

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function color(value, fallback) {
    const raw = String(value || '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(raw) ? raw : fallback;
  }

  function bool(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function sanitizeWidget(type, input) {
    const normalizedType = String(type || '').trim().toLowerCase();
    if (!TYPE_SET.has(normalizedType)) return null;
    const fallback = DEFAULTS[normalizedType];
    const source = input && typeof input === 'object' ? input : {};
    const out = {
      enabled: bool(source.enabled, fallback.enabled),
      primaryColor: color(source.primaryColor, fallback.primaryColor),
      secondaryColor: color(source.secondaryColor, fallback.secondaryColor),
      backgroundColor: color(source.backgroundColor, fallback.backgroundColor),
      textColor: color(source.textColor, fallback.textColor),
      mutedColor: color(source.mutedColor, fallback.mutedColor),
      backgroundOpacity: Math.round(clamp(source.backgroundOpacity, 0, 100, fallback.backgroundOpacity)),
      borderOpacity: Math.round(clamp(source.borderOpacity, 0, 100, fallback.borderOpacity)),
      borderRadius: Math.round(clamp(source.borderRadius, 0, 48, fallback.borderRadius)),
      blur: Math.round(clamp(source.blur, 0, 32, fallback.blur)),
      shadow: Math.round(clamp(source.shadow, 0, 100, fallback.shadow)),
      scale: Math.round(clamp(source.scale, 60, 150, fallback.scale))
    };

    if (normalizedType === 'playlist') {
      out.layout = LAYOUTS.has(String(source.layout || '')) ? String(source.layout) : fallback.layout;
      out.showArtwork = bool(source.showArtwork, fallback.showArtwork);
      out.showQueue = bool(source.showQueue, fallback.showQueue);
      out.showProvider = bool(source.showProvider, fallback.showProvider);
      out.progressHeight = Math.round(clamp(source.progressHeight, 2, 12, fallback.progressHeight));
    }
    if (normalizedType === 'wallet') {
      out.walletShape = WALLET_SHAPES.has(String(source.walletShape || '')) ? String(source.walletShape) : fallback.walletShape;
    }
    if (normalizedType === 'goal') {
      out.goalBarHeight = Math.round(clamp(source.goalBarHeight, 4, 30, fallback.goalBarHeight));
    }
    return out;
  }

  function defaults() {
    return Object.fromEntries(TYPES.map((type) => [type, sanitizeWidget(type, DEFAULTS[type])]));
  }

  function sanitizeAll(input) {
    const source = input && typeof input === 'object' ? input : {};
    return Object.fromEntries(TYPES.map((type) => [type, sanitizeWidget(type, source[type])]));
  }

  return Object.freeze({ TYPES, defaults, sanitizeAll, sanitizeWidget, color });
});
