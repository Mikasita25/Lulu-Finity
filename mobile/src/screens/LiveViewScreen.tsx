import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { AudioLines, Filter, Gift, ListMusic, Music2, Pause, Play, Share2, SkipForward, Sparkles, Trophy } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { EventRow } from '@/components/EventRow';
import { useAppStore, getGoalProgress } from '@/store/useAppStore';
import { useTtsStore } from '@/store/useTtsStore';
import { filterRecentEvents, useMobileControlStore } from '@/store/useMobileControlStore';
import { stopTts } from '@/services/tts';
import { compactNumber } from '@/utils/format';

type LiveViewMode = 'full' | 'events' | 'goal' | 'ranking' | 'music';

function LivePulse() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.55 }));
  return (
    <Animated.View style={style} className="rounded-full bg-red-500/20 px-3 py-2">
      <Text className="text-[10px] font-black text-red-300">● LIVE</Text>
    </Animated.View>
  );
}

function GoalProgressBar({ ratio }: { ratio: number }) {
  const value = useSharedValue(Math.max(2, ratio * 100));
  useEffect(() => {
    value.value = withTiming(Math.max(2, ratio * 100), { duration: 450 });
  }, [ratio, value]);
  const style = useAnimatedStyle(() => ({ width: `${value.value}%` as `${number}%` }));
  return <Animated.View style={style} className="h-full rounded-full bg-lulu-500" />;
}

function QuickControl({
  title,
  subtitle,
  active,
  onPress,
  icon,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl border px-3 py-3 ${active ? 'border-lulu-400/30 bg-lulu-500/15' : 'border-white/[0.07] bg-white/[0.04]'}`}
    >
      <View className="mb-2 flex-row items-center justify-between">
        {icon}
        <Text className={`text-[9px] font-black ${active ? 'text-lulu-200' : 'text-white/30'}`}>{active ? 'ON' : 'OFF'}</Text>
      </View>
      <Text className="text-xs font-black text-white">{title}</Text>
      <Text numberOfLines={1} className="mt-1 text-[10px] text-white/35">{subtitle}</Text>
    </Pressable>
  );
}

export function LiveViewScreen({ navigation }: any) {
  const [viewMode, setViewMode] = useState<LiveViewMode>('full');
  const exportRef = useRef<View>(null);
  const stats = useAppStore((state) => state.stats);
  const events = useAppStore((state) => state.events);
  const goals = useAppStore((state) => state.goals);
  const leaderboard = useAppStore((state) => state.leaderboard);
  const filters = useMobileControlStore((state) => state.recentFilters);
  const recentMaxItems = useMobileControlStore((state) => state.recentMaxItems);
  const music = useMobileControlStore((state) => state.music);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const songQueue = useMobileControlStore((state) => state.songQueue);
  const musicPaused = useMobileControlStore((state) => state.musicPaused);
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const setMusicPaused = useMobileControlStore((state) => state.setMusicPaused);
  const skipCurrentSong = useMobileControlStore((state) => state.skipCurrentSong);
  const ttsEnabled = useTtsStore((state) => state.enabled);
  const updateTts = useTtsStore((state) => state.updateTts);
  const goal = goals.find((item) => item.enabled && !item.completedAt) ?? goals[0];
  const top = Object.values(leaderboard).sort((a, b) => b.score - a.score).slice(0, 3);
  const progress = goal ? getGoalProgress(goal, stats) : null;
  const visibleEvents = filterRecentEvents(events, filters, recentMaxItems);

  const toggleTts = async () => {
    const next = !ttsEnabled;
    updateTts({ enabled: next });
    if (!next) await stopTts().catch(() => {});
  };

  const share = async () => {
    if (!exportRef.current) return;
    try {
      const uri = await captureRef(exportRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        return Alert.alert('Compartir no disponible', 'Android no encontró una app compatible.');
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir Vista en Vivo de Lulú Finity',
      });
    } catch (error) {
      Alert.alert('No se pudo exportar', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <AppHeader title="Control del LIVE" subtitle="TTS, música, actividad, metas y ranking desde una sola pantalla." />

      <View className="mb-4 flex-row gap-2">
        <QuickControl
          title="TTS"
          subtitle={ttsEnabled ? 'Leyendo chat' : 'Silenciado'}
          active={ttsEnabled}
          onPress={() => void toggleTts()}
          icon={<AudioLines size={17} color="#FF9DDA" />}
        />
        <QuickControl
          title="Música"
          subtitle={`${songQueue.length} en cola`}
          active={music.enabled}
          onPress={() => updateMusic({ enabled: !music.enabled })}
          icon={<Music2 size={17} color="#FF9DDA" />}
        />
        <Pressable onPress={() => navigation.navigate('RecentActivity')} className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-3">
          <Filter size={17} color="#FF9DDA" />
          <Text className="mt-2 text-xs font-black text-white">Actividad</Text>
          <Text className="mt-1 text-[10px] text-white/35">Configurar filtros</Text>
        </Pressable>
      </View>

      <View className="mb-4 flex-row gap-2">
        {(
          [
            ['full', 'Todo'],
            ['events', 'Eventos'],
            ['music', 'Música'],
            ['goal', 'Meta'],
            ['ranking', 'Ranking'],
          ] as const
        ).map(([id, label]) => (
          <Text
            key={id}
            onPress={() => setViewMode(id)}
            className={`flex-1 overflow-hidden rounded-xl px-2 py-3 text-center text-[11px] font-black ${
              viewMode === id ? 'bg-lulu-500 text-white' : 'bg-white/[0.06] text-white/40'
            }`}
          >
            {label}
          </Text>
        ))}
      </View>

      <View ref={exportRef} collapsable={false} className="overflow-hidden rounded-[32px] bg-[#0D0812] p-3">
        <GlassCard>
          <View className="min-h-[540px] p-5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[2.5px] text-lulu-200/60">LULÚ FINITY LIVE</Text>
                <Text className="mt-1 text-xl font-black text-white">Ahora mismo</Text>
              </View>
              <LivePulse />
            </View>

            {(viewMode === 'full' || viewMode === 'music') ? (
              <View className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <View className="flex-row items-center gap-2">
                  <ListMusic size={17} color="#FF9DDA" />
                  <Text className="flex-1 text-sm font-black text-white">Ahora suena</Text>
                  <Text className="text-[10px] font-black text-white/35">{songQueue.length} EN COLA</Text>
                </View>
                {currentSong ? (
                  <>
                    <Text numberOfLines={1} className="mt-4 text-base font-black text-white">{currentSong.query}</Text>
                    <Text className="mt-1 text-xs text-white/35">@{currentSong.requestedBy}</Text>
                    <View className="mt-4 flex-row gap-2">
                      <Pressable onPress={() => setMusicPaused(!musicPaused)} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3">
                        {musicPaused ? <Play size={15} color="#FF9DDA" fill="#FF9DDA" /> : <Pause size={15} color="#FF9DDA" />}
                        <Text className="text-xs font-black text-white">{musicPaused ? 'Reanudar' : 'Pausar'}</Text>
                      </Pressable>
                      <Pressable onPress={() => skipCurrentSong()} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3">
                        <SkipForward size={15} color="#FF9DDA" />
                        <Text className="text-xs font-black text-white">Saltar</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text className="py-6 text-center text-xs font-semibold text-white/30">Sin canción activa.</Text>
                )}
                <Pressable onPress={() => navigation.navigate('Music')} className="mt-3 rounded-2xl bg-lulu-500/15 px-3 py-3">
                  <Text className="text-center text-xs font-black text-lulu-200">Abrir cola y solicitudes</Text>
                </Pressable>
              </View>
            ) : null}

            {(viewMode === 'full' || viewMode === 'goal') && goal && progress ? (
              <View className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <View className="flex-row items-center gap-2">
                  <Sparkles size={17} color="#FF9DDA" />
                  <Text className="flex-1 text-sm font-black text-white">{goal.title}</Text>
                  <Text className="text-xs font-black text-lulu-200">{Math.round(progress.ratio * 100)}%</Text>
                </View>
                <View className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <GoalProgressBar ratio={progress.ratio} />
                </View>
                <Text className="mt-2 text-right text-xs font-bold text-white/40">{compactNumber(progress.current)} / {compactNumber(goal.target)}</Text>
              </View>
            ) : null}

            {(viewMode === 'full' || viewMode === 'events') ? (
              <View className="mt-6">
                <View className="mb-2 flex-row items-center gap-2">
                  <Gift size={17} color="#FF9DDA" />
                  <Text className="flex-1 text-sm font-black text-white">Actividad reciente</Text>
                  <Pressable onPress={() => navigation.navigate('RecentActivity')}><Filter size={16} color="#FF9DDA" /></Pressable>
                </View>
                {visibleEvents.slice(0, viewMode === 'events' ? 8 : 4).map((event) => <EventRow key={event.id} event={event} />)}
                {!visibleEvents.length ? <Text className="py-8 text-center text-xs font-semibold text-white/30">Esperando actividad visible…</Text> : null}
              </View>
            ) : null}

            {(viewMode === 'full' || viewMode === 'ranking') ? (
              <View className="mt-6">
                <View className="mb-3 flex-row items-center gap-2">
                  <Trophy size={17} color="#FFE07D" />
                  <Text className="text-sm font-black text-white">Top Fans</Text>
                </View>
                {top.map((entry, index) => (
                  <View key={entry.uniqueId} className="mb-2 flex-row items-center rounded-2xl bg-white/[0.045] px-3 py-3">
                    <Text className="w-8 text-sm font-black text-white/40">#{index + 1}</Text>
                    <Text className="flex-1 text-sm font-extrabold text-white" numberOfLines={1}>{entry.nickname}</Text>
                    <Text className="text-xs font-black text-lulu-200">{compactNumber(entry.diamonds)} 💎</Text>
                  </View>
                ))}
                {!top.length ? <Text className="py-5 text-center text-xs font-semibold text-white/30">El ranking aparecerá con la actividad del LIVE.</Text> : null}
              </View>
            ) : null}
          </View>
        </GlassCard>
      </View>

      <View className="mt-4">
        <Button label="Exportar / Compartir" onPress={share} icon={<Share2 size={17} color="white" />} />
      </View>
    </Screen>
  );
}
