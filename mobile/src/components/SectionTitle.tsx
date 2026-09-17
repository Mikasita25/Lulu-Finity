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
    <View className="mb-3 mt-8 flex-row items-end justify-between gap-3 px-0.5">
      <View className="flex-1">
        <Text
          style={{ fontFamily: 'serif', fontStyle: 'italic' }}
          className="text-[20px] font-black text-white"
        >
          {title} ✦
        </Text>
        {subtitle ? (
          <Text className="mt-1 text-xs leading-5 text-white/65">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export const SectionHeader = SectionTitle;
