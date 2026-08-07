import { useEffect, type ReactNode } from 'react';
import { Switch, Text, View } from 'react-native';
import { Palette, Sparkles, Type } from 'lucide-react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { useAppStore } from '@/store/useAppStore';
import type { AccentTheme } from '@/types/live';

const themes: { id: AccentTheme; label: string; color: string }[] = [
  { id: 'lulu', label: 'Lulú Pink', color: '#FF5FC8' },
  { id: 'violet', label: 'Violet', color: '#A96CFF' },
  { id: 'rose', label: 'Rose', color: '#FF668C' },
  { id: 'cyan', label: 'Cyber', color: '#66E4FF' },
];

const rankingColors = ['#FFF7FC', '#FFB8E5', '#FFE07D', '#66E4FF', '#5CE1A4'];

function RgbPreview({ children }: { children: ReactNode }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(3, { duration: 2600 }), -1, false);
  }, [phase]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(phase.value, [0, 1, 2, 3], ['#FF5FC822', '#A96CFF22', '#66E4FF22', '#FF5FC822']),
  }));
  return <Animated.View style={style} className="mt-3 rounded-2xl p-4">{children}</Animated.View>;
}


export function AppearanceScreen() {
  const accentTheme = useAppStore((state) => state.accentTheme);
  const rankingRgb = useAppStore((state) => state.rankingRgb);
  const rankingTextColor = useAppStore((state) => state.rankingTextColor);
  const rankingFont = useAppStore((state) => state.rankingFont);
  const setAccentTheme = useAppStore((state) => state.setAccentTheme);
  const setRankingRgb = useAppStore((state) => state.setRankingRgb);
  const setRankingTextColor = useAppStore((state) => state.setRankingTextColor);
  const setRankingFont = useAppStore((state) => state.setRankingFont);

  return (
    <Screen>
      <AppHeader title="Apariencia" subtitle="Skins, acentos y estilo del ranking." />

      <SectionTitle title="Tema de Lulú" subtitle="El dark mode mantiene su propia paleta, no invierte colores." />
      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <Palette size={20} color="#FF9DDA" />
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Dark mode nativo</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">
                Activo con una paleta propia de Lulú Finity; no usa inversión automática de colores.
              </Text>
            </View>
            <Text className="rounded-full bg-emerald-400/20 px-3 py-2 text-[10px] font-black text-emerald-300">
              ACTIVO
            </Text>
          </View>
          <View className="mt-5 flex-row flex-wrap gap-3">
            {themes.map((theme) => (
              <Text
                key={theme.id}
                onPress={() => setAccentTheme(theme.id)}
                style={{ borderColor: accentTheme === theme.id ? theme.color : 'rgba(255,255,255,0.08)' }}
                className={`w-[47%] overflow-hidden rounded-2xl border p-4 text-center text-xs font-black ${
                  accentTheme === theme.id ? 'bg-white/10 text-white' : 'bg-white/[0.035] text-white/40'
                }`}
              >
                ● {theme.label}
              </Text>
            ))}
          </View>
        </View>
      </GlassCard>

      <SectionTitle
        title="Ranking"
        subtitle="Personalización equivalente al ranking de escritorio, adaptada a móvil."
      />
      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <Sparkles size={20} color="#FF9DDA" />
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Texto RGB animado</Text>
              <Text className="mt-1 text-xs text-white/40">Ciclo rosa → morado → cyan.</Text>
            </View>
            <Switch
              value={rankingRgb}
              onValueChange={setRankingRgb}
              trackColor={{ false: '#342C34', true: '#FF5FC8' }}
              thumbColor="#FFF7FC"
            />
          </View>

          <Text className="mb-3 mt-6 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
            Color fijo
          </Text>
          <View className="flex-row gap-3">
            {rankingColors.map((color) => (
              <Text
                key={color}
                onPress={() => {
                  setRankingTextColor(color);
                  setRankingRgb(false);
                }}
                style={{ backgroundColor: color }}
                className={`h-9 w-9 overflow-hidden rounded-full border-2 text-center ${
                  rankingTextColor === color && !rankingRgb ? 'border-white' : 'border-transparent'
                }`}
              >
                {' '}
              </Text>
            ))}
          </View>

          <Text className="mb-3 mt-6 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
            Fuente
          </Text>
          <View className="flex-row gap-2">
            {(
              [
                ['default', 'Premium'],
                ['rounded', 'Rounded'],
                ['mono', 'Mono'],
              ] as const
            ).map(([id, label]) => (
              <Text
                key={id}
                onPress={() => setRankingFont(id)}
                style={{
                  fontFamily: id === 'mono' ? 'monospace' : id === 'rounded' ? 'sans-serif-medium' : undefined,
                }}
                className={`flex-1 overflow-hidden rounded-xl py-3 text-center text-xs font-black ${
                  rankingFont === id ? 'bg-lulu-500 text-white' : 'bg-white/[0.06] text-white/40'
                }`}
              >
                {label}
              </Text>
            ))}
          </View>

          <View className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-5">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-white/30">PREVIEW</Text>
            {rankingRgb ? (
              <RgbPreview>
                <Text
                  style={{
                    fontFamily:
                      rankingFont === 'mono'
                        ? 'monospace'
                        : rankingFont === 'rounded'
                          ? 'sans-serif-medium'
                          : undefined,
                  }}
                  className="text-lg font-black text-lulu-200"
                >
                  #1 AlyaChan · 35.8K
                </Text>
              </RgbPreview>
            ) : (
              <Text
                style={{
                  color: rankingTextColor,
                  fontFamily:
                    rankingFont === 'mono'
                      ? 'monospace'
                      : rankingFont === 'rounded'
                        ? 'sans-serif-medium'
                        : undefined,
                }}
                className="mt-3 text-lg font-black"
              >
                #1 AlyaChan · 35.8K
              </Text>
            )}
          </View>
        </View>
      </GlassCard>
    </Screen>
  );
}
