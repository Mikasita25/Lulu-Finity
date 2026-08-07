import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import type { Goal, LiveStats } from '@/types/live';
import { getGoalProgress, useAppStore } from '@/store/useAppStore';
import { compactNumber } from '@/utils/format';
import { GlassCard } from './GlassCard';
import { accentByTheme } from '@/theme/palette';

function ProgressBar({ ratio }: { ratio: number }) {
  const accentTheme = useAppStore((state) => state.accentTheme);
  const progress = useSharedValue(Math.max(2, ratio * 100));
  useEffect(() => { progress.value = withTiming(Math.max(2, ratio * 100), { duration: 450 }); }, [progress, ratio]);
  const style = useAnimatedStyle(() => ({ width: `${progress.value}%` as `${number}%` }));
  return <Animated.View style={[style, { backgroundColor: accentByTheme[accentTheme] }]} className="h-full rounded-full" />;
}

export function GoalCard({ goal, stats, readonly = false }: { goal: Goal; stats: LiveStats; readonly?: boolean }) {
  const { current, ratio } = getGoalProgress(goal, stats);
  const resetGoal = useAppStore((state) => state.resetGoal);
  const removeGoal = useAppStore((state) => state.removeGoal);
  return (
    <GlassCard className="mb-3"><View className="p-4">
      <View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="text-base font-black text-white">{goal.title}</Text><Text className="mt-1 text-xs font-semibold uppercase tracking-[1.2px] text-lulu-200/60">{goal.kind}</Text></View>{goal.completedAt ? <View className="rounded-full bg-emerald-400/20 px-3 py-1.5"><Text className="text-[10px] font-black text-emerald-300">COMPLETADA</Text></View> : null}</View>
      <View className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.07]"><ProgressBar ratio={ratio} /></View>
      <View className="mt-2 flex-row items-center justify-between"><Text className="text-xs font-bold text-white/50">{compactNumber(current)}</Text><Text className="text-xs font-black text-white">{compactNumber(current)} / {compactNumber(goal.target)}</Text></View>
      {!readonly ? <View className="mt-4 flex-row gap-2"><Pressable onPress={() => resetGoal(goal.id)} className="flex-row items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2"><RotateCcw size={12} color="#D7CAD5" /><Text className="text-xs font-bold text-white/70">Reiniciar</Text></Pressable><Pressable onPress={() => removeGoal(goal.id)} className="flex-row items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2"><Trash2 size={12} color="#FDA4AF" /><Text className="text-xs font-bold text-red-300">Eliminar</Text></Pressable></View> : null}
    </View></GlassCard>
  );
}
