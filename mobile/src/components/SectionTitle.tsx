import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="mb-3 mt-6 flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text className="text-lg font-black text-white">{title}</Text>
        {subtitle ? <Text className="mt-1 text-xs leading-5 text-white/50">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
