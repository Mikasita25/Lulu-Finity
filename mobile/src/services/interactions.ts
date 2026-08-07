import type { InteractionRule, LiveEvent } from '@/types/live';
import { useAppStore } from '@/store/useAppStore';
import { playSound } from './audio';
import { speakTtsText } from './tts';

const cooldowns = new Map<string, number>();

function normalize(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('es-MX');
}

function matchesValue(actual: string, expected: string, mode: InteractionRule['matchMode']) {
  const a = normalize(actual);
  const e = normalize(expected);
  if (!e) return true;
  return mode === 'contains' ? a.includes(e) : a === e;
}

function commandFrom(comment: string) {
  return comment.trim().split(/\s+/)[0] ?? '';
}

function matchesRule(rule: InteractionRule, event: LiveEvent) {
  if (!rule.enabled) return false;

  if (rule.triggerType === 'command') {
    if (event.type !== 'comment') return false;
    const trigger = rule.triggerValue.startsWith('!') ? rule.triggerValue : `!${rule.triggerValue}`;
    const comment = event.comment ?? '';
    return rule.matchMode === 'contains'
      ? normalize(comment).includes(normalize(trigger))
      : normalize(commandFrom(comment)) === normalize(trigger);
  }

  if (rule.triggerType === 'fanSticker') {
    if (event.type !== 'fanSticker') return false;
    return (
      matchesValue(event.fanStickerName ?? '', rule.triggerValue, rule.matchMode) ||
      matchesValue(event.fanStickerId ?? '', rule.triggerValue, rule.matchMode)
    );
  }

  if (rule.triggerType === 'gift') {
    return event.type === 'gift' && matchesValue(event.giftName ?? '', rule.triggerValue, rule.matchMode);
  }

  return event.type === rule.triggerType;
}

function renderTemplate(template: string, event: LiveEvent) {
  const fanSticker = event.fanStickerName || event.fanStickerId || 'Fan Sticker';
  const values: Record<string, string> = {
    user: event.uniqueId ? `@${event.uniqueId}` : '',
    name: event.nickname || event.uniqueId || 'Usuario',
    comment: event.comment ?? '',
    fansticker: fanSticker,
    // Alias conservado para las reglas creadas en la build anterior.
    sticker: fanSticker,
    gift: event.giftName ?? 'regalo',
    count: String(event.repeatCount ?? event.count ?? 1),
  };

  return template.replace(/\{(user|name|comment|fanSticker|sticker|gift|count)\}/gi, (_, key: string) => {
    return values[key.toLowerCase()] ?? '';
  });
}

export async function executeInteractionRule(rule: InteractionRule, event: LiveEvent) {
  const tasks: Promise<unknown>[] = [];
  if ((rule.actionType === 'sound' || rule.actionType === 'sound_tts') && rule.sound?.uri) {
    tasks.push(playSound({ ...rule.sound, enabled: true }));
  }
  if ((rule.actionType === 'tts' || rule.actionType === 'sound_tts') && rule.ttsText?.trim()) {
    speakTtsText(renderTemplate(rule.ttsText, event));
  }
  await Promise.allSettled(tasks);
}

export async function runInteractionRules(event: LiveEvent) {
  const rules = useAppStore.getState().interactionRules;
  const now = Date.now();

  for (const rule of rules) {
    if (!matchesRule(rule, event)) continue;
    const last = cooldowns.get(rule.id) ?? 0;
    const cooldownMs = Math.max(0, rule.cooldownSeconds) * 1000;
    if (cooldownMs > 0 && now - last < cooldownMs) continue;

    cooldowns.set(rule.id, now);
    await executeInteractionRule(rule, event);
  }
}

export function clearInteractionCooldowns() {
  cooldowns.clear();
}

export function previewRule(rule: InteractionRule) {
  const event: LiveEvent = {
    id: `preview-${Date.now()}`,
    type:
      rule.triggerType === 'command'
        ? 'comment'
        : rule.triggerType === 'fanSticker'
          ? 'fanSticker'
          : rule.triggerType,
    timestamp: Date.now(),
    uniqueId: 'lulu_fan',
    nickname: 'Lulu Fan',
    comment: rule.triggerType === 'command' ? `${rule.triggerValue || '!hola'} prueba` : undefined,
    fanStickerName: rule.triggerType === 'fanSticker' ? rule.triggerValue || 'Fan Sticker corazón' : undefined,
    fanStickerId: rule.triggerType === 'fanSticker' ? 'fan-sticker-preview' : undefined,
    giftName: rule.triggerType === 'gift' ? rule.triggerValue || 'Rosa' : undefined,
    repeatCount: 1,
  };
  return executeInteractionRule(rule, event);
}
