import { Image, Pressable, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LiveBadge } from './LiveBadge';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';

const luluLogo = require('../../assets/icon.png');

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const relayState = useAppStore((state) => state.relayState);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const accent = accentByTheme[accentTheme];
  const mainRoutes = ['Dashboard', 'TTS', 'Music', 'Interactions', 'More'];
  const secondary = !mainRoutes.includes(route.name) && navigation.canGoBack();
  return (
    <View className="mb-5 mt-1">
      <View className="mb-3 flex-row items-center justify-between">
        {secondary ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => navigation.goBack()}
            className="h-11 flex-row items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3"
          >
            <ArrowLeft size={18} color="#FFF7FC" />
            <Text className="text-xs font-black text-white">Atrás</Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-2">
            <Image source={luluLogo} resizeMode="contain" style={{ width: 30, height: 30, borderRadius: 9 }} accessibilityLabel="Logo de Lulú Finity" />
            <Text style={{ color: accent }} className="text-[11px] font-black uppercase tracking-[1.8px] opacity-80">Lulú Finity</Text>
          </View>
        )}
        <LiveBadge state={relayState} />
      </View>
      <View className="flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text className="text-[28px] font-black tracking-tight text-white">{title}</Text>
        {subtitle ? <Text className="mt-1.5 text-[13px] leading-5 text-white/45">{subtitle}</Text> : null}
      </View>
      </View>
    </View>
  );
}
