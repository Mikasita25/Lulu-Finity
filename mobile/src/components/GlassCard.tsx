import type { PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  className?: string;
  style?: ViewStyle;
}>;

export function GlassCard({ children, className = '', style }: Props) {
  return (
    <View
      className={`overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#191F32] ${className}`}
      style={[{ shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 2 }, style]}
    >
      <View>{children}</View>
    </View>
  );
}
