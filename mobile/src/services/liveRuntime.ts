import { useAppStore } from '@/store/useAppStore';
import { LiveSocket } from './realtime/LiveSocket';
import { runEventEffects } from './effects';
import { handleTtsEvent, stopTts } from './tts';
import { clearInteractionCooldowns, runInteractionRules } from './interactions';
import { clearMusicCooldowns, handleMusicEvent } from './music';
import { LiveFreshnessGate } from './realtime/liveFreshness';

function top3Snapshot() {
  return Object.values(useAppStore.getState().leaderboard)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.uniqueId.toLowerCase());
}

const freshness = new LiveFreshnessGate();

const socket = new LiveSocket((message) => {
  const store = useAppStore.getState();

  if (message.kind === 'relay') {
    const reconnecting =
      message.transportReconnect === true ||
      message.state === 'rotating' ||
      (message.attempt ?? 1) > 1;
    if (reconnecting && (message.state === 'connecting' || message.state === 'rotating')) {
      freshness.beginReconnect();
      stopTts().catch(() => {});
    } else if (message.state === 'connected') {
      freshness.markConnected(Date.now(), reconnecting);
    } else if (message.state === 'idle' || message.state === 'offline' || message.state === 'error') {
      stopTts().catch(() => {});
    }
    store.setRelay(message.state, message.message);
    return;
  }

  if (message.kind === 'stats') {
    if (Number.isFinite(message.viewers)) store.setViewerCount(message.viewers ?? 0);
    if (Number.isFinite(message.likes)) store.setTotalLikes(message.likes ?? 0);
    return;
  }

  if (!freshness.accept(message.event)) return;

  const previousTop3 = top3Snapshot();
  store.ingestEvent(message.event);

  // Las automatizaciones se evalúan con el evento ya normalizado. De esta forma
  // comandos, regalos y stickers comparten el mismo motor y no dependen del JSON
  // crudo que entregue TikTok/Euler en una versión concreta.
  runInteractionRules(message.event).catch(() => {});
  handleMusicEvent(message.event);
  handleTtsEvent(message.event);
  runEventEffects(message.event, previousTop3).catch(() => {});
});

export function connectLive(username?: string) {
  const state = useAppStore.getState();
  const target = (username || state.username).trim().replace(/^@/, '');
  if (!target) throw new Error('Escribe un usuario de TikTok.');
  stopTts().catch(() => {});
  freshness.startSession();
  clearInteractionCooldowns();
  clearMusicCooldowns();
  state.resetSession();
  socket.connect(target);
}

export function disconnectLive() {
  stopTts().catch(() => {});
  clearInteractionCooldowns();
  clearMusicCooldowns();
  freshness.stop();
  socket.disconnect();
}
