import type { LiveEvent } from '@/types/live';

export function compactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return Math.round(value).toLocaleString('es-MX');
}

export function eventText(event: LiveEvent) {
  if (event.type === 'gift')
    return `envió ${event.giftName ?? 'un regalo'}${(event.repeatCount ?? 1) > 1 ? ` ×${event.repeatCount}` : ''}`;
  if (event.type === 'comment') return event.comment || 'comentó';
  if (event.type === 'fanSticker') {
    const name = event.fanStickerName || 'Fan Sticker';
    return event.fanStickerId ? `envió ${name} · ID ${event.fanStickerId}` : `envió ${name}`;
  }
  if (event.type === 'like') return `envió ${compactNumber(event.count ?? 1)} likes`;
  if (event.type === 'follow') return 'comenzó a seguirte';
  if (event.type === 'share') return 'compartió el LIVE';
  if (event.type === 'member') return 'entró al LIVE';
  return 'se suscribió';
}

export function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
