import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';

export function MenuRow({
  title,
  subtitle,
  icon: Icon,
  onPress,
  badge,
  last = false,
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  badge?: string;
  last?: boolean;
}) {
  const accent = accentByTheme[useAppStore((state) => state.accentTheme)];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      className={`flex-row items-center gap-4 py-4 ${last ? '' : 'border-b border-white/[0.07]'}`}
    >
      <View
        style={{ backgroundColor: `${accent}18`, borderColor: `${accent}32` }}
        className="h-12 w-12 items-center justify-center rounded-2xl border"
      >
        <Icon size={20} color={accent} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[16px] font-black text-white">{title}</Text>
          {badge ? (
            <Text
              style={{ backgroundColor: accent }}
              className="rounded-lg px-2 py-1 text-[9px] font-black text-white"
            >
              {badge}
            </Text>
          ) : null}
        </View>
        <Text className="mt-1 text-xs leading-5 text-white/60">{subtitle}</Text>
      </View>
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.045]">
        <ChevronRight size={17} color="#A9A6C5" />
      </View>
    </Pressable>
  );
}
