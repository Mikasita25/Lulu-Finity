import { Image, Pressable, Text, View } from 'react-native';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LiveBadge } from './LiveBadge';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';

const luluLogo = require('../../assets/icon.png');

export function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const relayState = useAppStore((state) => state.relayState);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const accent = accentByTheme[accentTheme];
  const mainRoutes = ['Dashboard', 'TTS', 'Music', 'Interactions', 'More'];
  const secondary = !mainRoutes.includes(route.name) && navigation.canGoBack();
  return (
    <View className="mb-7 mt-2">
      <View className="mb-3 flex-row items-center justify-between">
        {secondary ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => navigation.goBack()}
            className="h-11 flex-row items-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.055] px-3"
          >
            <ArrowLeft size={18} color="#FFF7FC" />
            <Text className="text-xs font-black text-white">Atrás</Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-3">
            <View
              style={{
                shadowColor: accent,
                shadowOpacity: 0.45,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Image
                source={luluLogo}
                resizeMode="contain"
                style={{ width: 38, height: 38, borderRadius: 12 }}
                accessibilityLabel="Logo de Lulú Finity"
              />
            </View>
            <View>
              <Text className="text-[11px] font-black uppercase tracking-[2.7px] text-white/90">
                LULÚ FINITY
              </Text>
              <Text
                style={{ color: accent }}
                className="mt-0.5 text-[11px] font-semibold italic"
              >
                Tu mundo, más vivo ♡
              </Text>
            </View>
          </View>
        )}
        <LiveBadge state={relayState} />
      </View>
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              style={{ fontFamily: 'serif', fontStyle: 'italic' }}
              className="text-[31px] font-black tracking-tight text-white"
            >
              {title}
            </Text>
            <Sparkles size={16} color={accent} />
          </View>
          {subtitle ? (
            <Text className="mt-2 max-w-[560px] text-[13px] leading-5 text-white/62">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
