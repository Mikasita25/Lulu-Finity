import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Crown, Medal, Trophy } from 'lucide-react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { useAppStore } from '@/store/useAppStore';
import { compactNumber } from '@/utils/format';
import type { LeaderboardEntry } from '@/types/live';

type Metric =
  | 'diamonds'
  | 'gifts'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'follows'
  | 'members'
  | 'subscribes'
  | 'score';

const metrics: { id: Metric; label: string }[] = [
  { id: 'diamonds', label: 'Monedas' },
  { id: 'gifts', label: 'Regalos' },
  { id: 'likes', label: 'Tap Tap' },
  { id: 'comments', label: 'Chat' },
  { id: 'shares', label: 'Shares' },
  { id: 'follows', label: 'Follows' },
  { id: 'members', label: 'Entradas' },
  { id: 'subscribes', label: 'Subs' },
  { id: 'score', label: 'Fans' },
];

function valueFor(entry: LeaderboardEntry, metric: Metric) {
  return entry[metric] as number;
}


function RgbName({ children, fontFamily, className = '' }: { children: string; fontFamily?: string; className?: string }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(3, { duration: 2700 }), -1, false);
  }, [phase]);
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(phase.value, [0, 1, 2, 3], ['#FF79CF', '#A96CFF', '#66E4FF', '#FF79CF']),
    fontFamily,
  }));
  return (
    <Animated.Text style={style} className={className} numberOfLines={1}>
      {children}
    </Animated.Text>
  );
}

function Avatar({ entry, size = 52 }: { entry: LeaderboardEntry; size?: number }) {
  if (entry.profilePictureUrl) {
    return (
      <Image
        source={{ uri: entry.profilePictureUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-white/10"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-lulu-500/20"
    >
      <Text className="font-black text-lulu-200">{entry.nickname.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function LeaderboardScreen() {
  const [metric, setMetric] = useState<Metric>('diamonds');
  const leaderboard = useAppStore((state) => state.leaderboard);
  const rankingRgb = useAppStore((state) => state.rankingRgb);
  const rankingTextColor = useAppStore((state) => state.rankingTextColor);
  const rankingFont = useAppStore((state) => state.rankingFont);

  const entries = useMemo(
    () =>
      Object.values(leaderboard)
        .filter((entry) => valueFor(entry, metric) > 0)
        .sort((a, b) => valueFor(b, metric) - valueFor(a, metric)),
    [leaderboard, metric],
  );
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);

  const fontFamily =
    rankingFont === 'mono' ? 'monospace' : rankingFont === 'rounded' ? 'sans-serif-medium' : undefined;

  return (
    <Screen>
      <AppHeader title="Top Fans" subtitle="Ranking en tiempo real de tu comunidad." />

      <View className="mb-5 flex-row flex-wrap gap-2">
        {metrics.map((item) => (
          <Text
            key={item.id}
            onPress={() => setMetric(item.id)}
            className={`overflow-hidden rounded-xl px-3 py-2.5 text-xs font-black ${
              metric === item.id ? 'bg-lulu-500 text-white' : 'bg-white/[0.06] text-white/40'
            }`}
          >
            {item.label}
          </Text>
        ))}
      </View>

      <GlassCard>
        <View className="p-5">
          <View className="items-center">
            <Trophy size={24} color="#FFE07D" />
            <Text className="mt-2 text-[10px] font-black uppercase tracking-[2.2px] text-white/30">
              PODIO DEL LIVE
            </Text>
          </View>

          <View className="mt-7 flex-row items-end justify-center gap-2">
            {[top[1], top[0], top[2]].map((entry, slot) => {
              if (!entry)
                return <View key={`empty-${slot}`} className={slot === 1 ? 'h-44 flex-1' : 'h-36 flex-1'} />;
              const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3;
              return (
                <Animated.View
                  key={entry.uniqueId}
                  entering={FadeInUp.delay(rank * 80).springify().damping(16)}
                  className={`flex-1 items-center rounded-3xl border border-white/10 bg-white/[0.045] px-2 pb-4 ${
                    rank === 1 ? 'pt-5' : 'pt-4'
                  }`}
                >
                  {rank === 1 ? <Crown size={21} color="#FFE07D" /> : <Medal size={18} color="#FFB8E5" />}
                  <View className="mt-2">
                    <Avatar entry={entry} size={rank === 1 ? 58 : 48} />
                  </View>
                  {rankingRgb ? (
                    <RgbName
                      fontFamily={fontFamily}
                      className="mt-2 max-w-full text-center text-xs font-black"
                    >
                      {entry.nickname}
                    </RgbName>
                  ) : (
                    <Text
                      style={{ color: rankingTextColor, fontFamily }}
                      className="mt-2 max-w-full text-center text-xs font-black"
                      numberOfLines={1}
                    >
                      {entry.nickname}
                    </Text>
                  )}
                  <Text className="mt-1 text-[11px] font-extrabold text-lulu-200">
                    {compactNumber(valueFor(entry, metric))}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </GlassCard>

      <View className="mt-4">
        {rest.map((entry, index) => (
          <GlassCard key={entry.uniqueId} className="mb-2">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Text className="w-8 text-sm font-black text-white/30">#{index + 4}</Text>
              <Avatar entry={entry} size={40} />
              <View className="flex-1">
                {rankingRgb ? (
                  <RgbName fontFamily={fontFamily} className="text-sm font-black">
                    {entry.nickname}
                  </RgbName>
                ) : (
                  <Text
                    style={{ color: rankingTextColor, fontFamily }}
                    className="text-sm font-black"
                    numberOfLines={1}
                  >
                    {entry.nickname}
                  </Text>
                )}
                <Text className="mt-1 text-[10px] text-white/30">@{entry.uniqueId}</Text>
              </View>
              <Text className="text-sm font-black text-lulu-200">
                {compactNumber(valueFor(entry, metric))}
              </Text>
            </View>
          </GlassCard>
        ))}
      </View>

      {!entries.length ? (
        <View className="items-center py-12">
          <Trophy size={34} color="#655965" />
          <Text className="mt-3 text-sm font-bold text-white/30">
            Aún no hay actividad para este ranking.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
