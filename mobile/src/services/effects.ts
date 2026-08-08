import * as Haptics from 'expo-haptics';
import type { LiveEvent } from '@/types/live';
import { useAppStore } from '@/store/useAppStore';
import { playSound } from './audio';
import { notifyGoalCompleted, notifyImportantEvent } from './notifications';
let seenGoalCompletion = 0;
function currentTop3() { return Object.values(useAppStore.getState().leaderboard).sort((a,b) => b.score-a.score).slice(0,3).map((entry) => entry.uniqueId.toLowerCase()); }
export async function runEventEffects(event: LiveEvent, previousTop3: string[] = []) {
  const state = useAppStore.getState();
  if (state.hapticsEnabled) { if (event.type === 'gift') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); else if (event.type === 'follow' || event.type === 'subscribe') Haptics.selectionAsync().catch(() => {}); }
  const eventSound = state.soundSettings[event.type]; if (eventSound) playSound(eventSound).catch(() => {}); if (state.headsUpNotifications) notifyImportantEvent(event).catch(() => {});
  const nextTop3 = currentTop3(); if (previousTop3.length > 0 && nextTop3.join('|') !== previousTop3.join('|')) { const enteredTop3 = nextTop3.some((id) => !previousTop3.includes(id)); if (enteredTop3 || event.type === 'gift') { if (state.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); playSound(state.soundSettings.rank).catch(() => {}); } }
  const completion = useAppStore.getState().lastGoalCompletion; if (completion && completion.at > seenGoalCompletion) { seenGoalCompletion = completion.at; const goal = useAppStore.getState().goals.find((item) => item.id === completion.id); if (goal) { if (state.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); playSound(state.soundSettings.goal).catch(() => {}); if (state.headsUpNotifications) notifyGoalCompleted(goal.title).catch(() => {}); } }
}
