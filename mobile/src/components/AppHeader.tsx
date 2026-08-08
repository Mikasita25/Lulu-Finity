import { Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { LiveBadge } from './LiveBadge';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const relayState = useAppStore((state) => state.relayState);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const accent = accentByTheme[accentTheme];
  return (
    <View className="mb-4 mt-1 flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Sparkles size={18} color={accent} />
          <Text style={{ color: accent }} className="text-[11px] font-black uppercase tracking-[2px] opacity-70">Lulú Finity</Text>
        </View>
        <Text className="mt-1 text-2xl font-black tracking-tight text-white">{title}</Text>
        {subtitle ? <Text className="mt-1 text-xs text-white/40">{subtitle}</Text> : null}
      </View>
      <LiveBadge state={relayState} />
    </View>
  );
}
