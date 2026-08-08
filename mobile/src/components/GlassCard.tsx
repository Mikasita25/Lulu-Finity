import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

type Props = PropsWithChildren<{
  className?: string;
  style?: ViewStyle;
}>;

export function GlassCard({ children, className = '', style }: Props) {
  return (
    <View
      className={`overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] ${className}`}
      style={style}
    >
      <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
      <View>{children}</View>
    </View>
  );
}
