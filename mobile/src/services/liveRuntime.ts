import { useAppStore } from '@/store/useAppStore';
import { LiveSocket } from './realtime/LiveSocket';
import { runEventEffects } from './effects';

function top3Snapshot() {
  return Object.values(useAppStore.getState().leaderboard)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.uniqueId.toLowerCase());
}

const socket = new LiveSocket((message) => {
  const store = useAppStore.getState();

  if (message.kind === 'relay') {
    store.setRelay(message.state, message.message);
    return;
  }

  if (message.kind === 'stats') {
    if (Number.isFinite(message.viewers)) store.setViewerCount(message.viewers ?? 0);
    if (Number.isFinite(message.likes)) store.setTotalLikes(message.likes ?? 0);
    return;
  }

  const previousTop3 = top3Snapshot();
  store.ingestEvent(message.event);
  runEventEffects(message.event, previousTop3).catch(() => {});
});

export function connectLive(username?: string) {
  const state = useAppStore.getState();
  const target = (username || state.username).trim().replace(/^@/, '');
  if (!target) throw new Error('Escribe un usuario de TikTok.');
  state.resetSession();
  socket.connect(target);
}

export function disconnectLive() {
  socket.disconnect();
}
