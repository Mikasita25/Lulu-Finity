'use strict';

(function exposeRewardWheelPolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LuluRewardWheelPolicy = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const COLORS = ['#ff6fae','#8f7cff','#5fd8ff','#ffd166','#7ee2a8','#ff8b6a','#c795ff','#66d9c7'];
  const DEFAULT_SEGMENTS = Object.freeze([
    { label:'+50', color:COLORS[0], weight:24, rewardType:'currency_add', amount:50 },
    { label:'+100', color:COLORS[1], weight:22, rewardType:'currency_add', amount:100 },
    { label:'+250', color:COLORS[2], weight:17, rewardType:'currency_add', amount:250 },
    { label:'+500', color:COLORS[3], weight:10, rewardType:'currency_add', amount:500 },
    { label:'Sin premio', color:COLORS[4], weight:15, rewardType:'none', amount:0 },
    { label:'+1,000', color:COLORS[5], weight:6, rewardType:'currency_add', amount:1000 },
    { label:'Premio especial', color:COLORS[6], weight:4, rewardType:'message', amount:0 },
    { label:'JACKPOT +5,000', color:COLORS[7], weight:2, rewardType:'currency_add', amount:5000 }
  ]);
  const REWARD_TYPES = new Set(['currency_add','currency_remove','none','message']);

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeCommand(value) {
    const raw = String(value || '').trim().replace(/\s+/g, '').slice(0, 40);
    if (!raw) return '!girar';
    return raw.startsWith('!') ? raw.toLowerCase() : `!${raw.toLowerCase()}`;
  }

  function sanitizeColor(value, fallback) {
    const raw = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
  }

  function sanitizeSegment(input = {}, index = 0) {
    const rewardType = REWARD_TYPES.has(String(input.rewardType || '')) ? String(input.rewardType) : 'none';
    const amount = Math.round(clampNumber(input.amount, 0, 1_000_000_000, 0));
    return {
      id: String(input.id || `segment-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || `segment-${index + 1}`,
      label: String(input.label || `Premio ${index + 1}`).replace(/\s+/g, ' ').trim().slice(0, 60) || `Premio ${index + 1}`,
      color: sanitizeColor(input.color, COLORS[index % COLORS.length]),
      weight: Math.round(clampNumber(input.weight, 1, 10000, 1)),
      rewardType,
      amount: rewardType === 'currency_add' || rewardType === 'currency_remove' ? amount : 0,
      message: String(input.message || '').replace(/\s+/g, ' ').trim().slice(0, 180)
    };
  }

  function sanitizeConfig(input = {}) {
    const source = Array.isArray(input.segments) ? input.segments : DEFAULT_SEGMENTS;
    const segments = source.slice(0, 40).map(sanitizeSegment);
    while (segments.length < 2) segments.push(sanitizeSegment(DEFAULT_SEGMENTS[segments.length], segments.length));
    return {
      enabled: input.enabled !== false,
      command: normalizeCommand(input.command),
      cost: Math.round(clampNumber(input.cost, 0, 1_000_000_000, 0)),
      cooldownSeconds: Math.round(clampNumber(input.cooldownSeconds, 0, 86400, 30)),
      allowCustomStake: Boolean(input.allowCustomStake),
      maximumStake: Math.round(clampNumber(input.maximumStake, 0, 1_000_000_000, 0)),
      segments
    };
  }

  function totalWeight(config) {
    return sanitizeConfig(config).segments.reduce((sum, segment) => sum + segment.weight, 0);
  }

  function segmentProbabilities(config) {
    const clean = sanitizeConfig(config);
    const total = clean.segments.reduce((sum, segment) => sum + segment.weight, 0) || 1;
    return clean.segments.map((segment) => ({ ...segment, probability: segment.weight / total }));
  }

  function pickSegment(config, randomUnit = Math.random()) {
    const clean = sanitizeConfig(config);
    const total = clean.segments.reduce((sum, segment) => sum + segment.weight, 0);
    const unit = Math.max(0, Math.min(0.999999999999, Number(randomUnit) || 0));
    let cursor = unit * total;
    for (let index = 0; index < clean.segments.length; index += 1) {
      cursor -= clean.segments[index].weight;
      if (cursor < 0) return { index, segment: clean.segments[index] };
    }
    const index = clean.segments.length - 1;
    return { index, segment: clean.segments[index] };
  }

  function resizeSegments(config, countInput) {
    const clean = sanitizeConfig(config);
    const count = Math.round(clampNumber(countInput, 2, 40, clean.segments.length));
    const segments = clean.segments.slice(0, count);
    while (segments.length < count) {
      const index = segments.length;
      const template = DEFAULT_SEGMENTS[index % DEFAULT_SEGMENTS.length];
      segments.push(sanitizeSegment({ ...template, id:`segment-${index + 1}`, label:`Premio ${index + 1}` }, index));
    }
    return { ...clean, segments };
  }

  return { DEFAULT_SEGMENTS, normalizeCommand, sanitizeSegment, sanitizeConfig, totalWeight, segmentProbabilities, pickSegment, resizeSegments };
});
