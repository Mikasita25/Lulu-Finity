import type { PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  className?: string;
  style?: ViewStyle;
}>;

export function GlassCard({ children, className = '', style }: Props) {
  return (
    <View
      className={`overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#17121B] ${className}`}
      style={[{ shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, style]}
    >
      <View>{children}</View>
    </View>
  );
}
