'use strict';

function text(value) { return String(value ?? '').trim(); }
function norm(value) { return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, number(value, min))); }

const TRIGGER_TYPES = new Set(['gift','follow','like','share','subscribe','member','comment']);
const ACTION_TYPES = new Set(['tts','chat','sound','alert','webhook']);
const GOAL_TYPES = new Set(['likes','diamonds','gifts','follows','shares','subscribes','members','comments']);

function eventUser(event = {}) {
  return norm(event.uniqueId || event.user || event.nickname || '');
}

function eventValue(event = {}) {
  switch (event.type) {
    case 'gift': return Math.max(number(event.diamonds), number(event.repeatCount, 1));
    case 'like': return Math.max(number(event.count), number(event.total));
    default: return 1;
  }
}

function templateData(event = {}) {
  return {
    user: text(event.nickname || event.uniqueId || 'alguien'),
    username: text(event.uniqueId || event.user || ''),
    gift: text(event.giftName || 'regalo'),
    count: Math.max(1, number(event.repeatCount || event.count, 1)),
    diamonds: Math.max(0, number(event.diamonds)),
    comment: text(event.comment || event.text || ''),
    totalLikes: Math.max(0, number(event.total)),
    type: text(event.type),
  };
}

function renderTemplate(input, event = {}) {
  const data = templateData(event);
  return text(input).replace(/\{(user|username|gift|count|diamonds|comment|totalLikes|type)\}/g, (_m, key) => String(data[key] ?? ''));
}

function normalizeAction(action = {}) {
  const type = ACTION_TYPES.has(action.type) ? action.type : 'alert';
  return {
    id: text(action.id) || `action-${Math.random().toString(36).slice(2, 9)}`,
    type,
    value: text(action.value),
    soundUrl: text(action.soundUrl),
    soundName: text(action.soundName),
    volume: clamp(action.volume ?? 0.9, 0, 1),
    durationSeconds: clamp(action.durationSeconds ?? 6, 1, 60),
    method: ['GET','POST'].includes(text(action.method).toUpperCase()) ? text(action.method).toUpperCase() : 'POST',
    enabled: action.enabled !== false,
  };
}

function normalizeRule(rule = {}, index = 0) {
  const triggerType = TRIGGER_TYPES.has(rule.triggerType) ? rule.triggerType : 'gift';
  return {
    id: text(rule.id) || `rule-${index + 1}`,
    name: text(rule.name) || `Automatización ${index + 1}`,
    enabled: rule.enabled !== false,
    triggerType,
    filter: text(rule.filter),
    user: text(rule.user),
    minValue: Math.max(0, number(rule.minValue, 0)),
    minRepeat: Math.max(0, number(rule.minRepeat, 0)),
    cooldownSeconds: clamp(rule.cooldownSeconds ?? 3, 0, 3600),
    perUserCooldown: rule.perUserCooldown !== false,
    actions: Array.isArray(rule.actions) ? rule.actions.map(normalizeAction).filter((a) => a.enabled) : [],
  };
}

function ruleMatches(rule, event = {}) {
  if (!rule.enabled || event.type !== rule.triggerType) return false;
  if (rule.user && !eventUser(event).includes(norm(rule.user))) return false;
  if (rule.minValue > 0 && eventValue(event) < rule.minValue) return false;
  if (rule.minRepeat > 0 && number(event.repeatCount, 1) < rule.minRepeat) return false;

  if (rule.filter) {
    const wanted = norm(rule.filter);
    if (event.type === 'gift' && !norm(event.giftName).includes(wanted)) return false;
    if (event.type === 'comment' && !norm(event.comment || event.text).includes(wanted)) return false;
  }
  return true;
}

function evaluateAutomations(rules, event = {}, context = {}) {
  const now = number(context.now, Date.now());
  const cooldowns = { ...(context.cooldowns || {}) };
  const matched = [];
  const actions = [];
  for (const [index, source] of (Array.isArray(rules) ? rules : []).entries()) {
    const rule = normalizeRule(source, index);
    if (!ruleMatches(rule, event)) continue;
    const userKey = rule.perUserCooldown ? `:${eventUser(event) || 'anon'}` : '';
    const key = `${rule.id}${userKey}`;
    const previous = number(cooldowns[key], 0);
    if (rule.cooldownSeconds > 0 && now - previous < rule.cooldownSeconds * 1000) continue;
    cooldowns[key] = now;
    matched.push(rule.id);
    for (const action of rule.actions) {
      const prepared = { ...action, ruleId: rule.id, ruleName: rule.name };
      if (['tts','chat','alert'].includes(action.type)) prepared.value = renderTemplate(action.value, event);
      if (action.type === 'webhook') {
        prepared.body = {
          source: 'Lulu Finity',
          rule: { id: rule.id, name: rule.name },
          event: { ...event },
          rendered: templateData(event),
        };
      }
      actions.push(prepared);
    }
  }
  return { matched, actions, cooldowns };
}

function normalizeGoal(goal = {}, index = 0) {
  return {
    id: text(goal.id) || `goal-${index + 1}`,
    title: text(goal.title) || 'Meta del LIVE',
    type: GOAL_TYPES.has(goal.type) ? goal.type : 'likes',
    target: Math.max(1, number(goal.target, 100)),
    progress: Math.max(0, number(goal.progress, 0)),
    enabled: goal.enabled !== false,
  };
}

function goalDelta(type, event = {}) {
  if (type === 'likes' && event.type === 'like') return Math.max(0, number(event.count));
  if (type === 'diamonds' && event.type === 'gift') return Math.max(0, number(event.diamonds));
  if (type === 'gifts' && event.type === 'gift') return Math.max(1, number(event.repeatCount, 1));
  if (type === 'follows' && event.type === 'follow') return 1;
  if (type === 'shares' && event.type === 'share') return 1;
  if (type === 'subscribes' && event.type === 'subscribe') return 1;
  if (type === 'members' && event.type === 'member') return 1;
  if (type === 'comments' && event.type === 'comment') return 1;
  return 0;
}

function applyGoalEvent(goals, event = {}) {
  return (Array.isArray(goals) ? goals : []).map((source, index) => {
    const goal = normalizeGoal(source, index);
    if (!goal.enabled) return goal;
    const delta = goalDelta(goal.type, event);
    return { ...goal, progress: Math.max(0, goal.progress + delta), reached: goal.progress + delta >= goal.target };
  });
}

function resetGoal(goals, goalId) {
  return (Array.isArray(goals) ? goals : []).map((goal, index) => {
    const normalized = normalizeGoal(goal, index);
    return normalized.id === goalId ? { ...normalized, progress: 0, reached: false } : normalized;
  });
}

function updateGiftStats(previous = {}, event = {}) {
  const state = {
    totalGifts: Math.max(0, number(previous.totalGifts)),
    totalDiamonds: Math.max(0, number(previous.totalDiamonds)),
    topGift: previous.topGift || null,
    topStreak: previous.topStreak || null,
    lastGift: previous.lastGift || null,
  };
  if (event.type !== 'gift') return state;
  const repeat = Math.max(1, number(event.repeatCount, 1));
  const diamonds = Math.max(0, number(event.diamonds));
  const gift = {
    user: text(event.uniqueId),
    displayName: text(event.nickname || event.uniqueId || 'Usuario'),
    giftName: text(event.giftName || 'Regalo'),
    repeatCount: repeat,
    diamonds,
    profilePictureUrl: text(event.profilePictureUrl),
    timestamp: number(event.timestamp, Date.now()),
  };
  state.totalGifts += repeat;
  state.totalDiamonds += diamonds;
  state.lastGift = gift;
  if (!state.topGift || diamonds > number(state.topGift.diamonds)) state.topGift = gift;
  if (!state.topStreak || repeat > number(state.topStreak.repeatCount)) state.topStreak = gift;
  return state;
}

module.exports = {
  TRIGGER_TYPES, ACTION_TYPES, GOAL_TYPES,
  normalizeRule, normalizeAction, normalizeGoal,
  renderTemplate, ruleMatches, evaluateAutomations,
  applyGoalEvent, resetGoal, updateGiftStats,
};
