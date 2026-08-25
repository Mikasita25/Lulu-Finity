import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { GlassCard } from './GlassCard';

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(320)} className="w-[48.5%]">
      <GlassCard>
        <View className="p-4">
          <View className="mb-3 h-9 w-9 items-center justify-center rounded-xl bg-lulu-500/15">
            {icon}
          </View>
          <Text
            className="text-[22px] font-black tracking-tight text-white"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
          <Text className="mt-1 text-xs font-semibold text-white/40">{label}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}
