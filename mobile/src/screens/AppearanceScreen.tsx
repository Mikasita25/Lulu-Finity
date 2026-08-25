import { Text, View } from 'react-native';
import { Palette } from 'lucide-react-native';
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

export function AppearanceScreen() {
  const accentTheme = useAppStore((state) => state.accentTheme);
  const setAccentTheme = useAppStore((state) => state.setAccentTheme);

  return (
    <Screen>
      <AppHeader title="Apariencia" subtitle="Elige un color sencillo para toda la aplicación." />

      <SectionTitle title="Color principal" subtitle="La interfaz oscura se conserva para que sea cómoda mientras juegas." />
      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <Palette size={20} color="#FF9DDA" />
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Tema oscuro</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">Activo siempre para reducir distracciones.</Text>
            </View>
            <Text className="rounded-full bg-emerald-400/20 px-3 py-2 text-[10px] font-black text-emerald-300">ACTIVO</Text>
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
    </Screen>
  );
}
