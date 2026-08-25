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
      className={`flex-row items-center gap-3 py-4 ${last ? '' : 'border-b border-white/[0.055]'}`}
    >
      <View style={{ backgroundColor: `${accent}18` }} className="h-11 w-11 items-center justify-center rounded-2xl">
        <Icon size={20} color={accent} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[15px] font-black text-white">{title}</Text>
          {badge ? <Text style={{ backgroundColor: accent }} className="rounded-lg px-2 py-1 text-[9px] font-black text-white">{badge}</Text> : null}
        </View>
        <Text className="mt-1 text-xs leading-5 text-white/40">{subtitle}</Text>
      </View>
      <ChevronRight size={18} color="#817580" />
    </Pressable>
  );
}
