import type { PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { luluGradients, palette } from '@/theme/palette';

type Props = PropsWithChildren<{
  className?: string;
  style?: ViewStyle;
  variant?: 'default' | 'soft' | 'hero' | 'mint' | 'danger';
}>;

const gradients = {
  default: luluGradients.glass,
  soft: luluGradients.glassSoft,
  hero: ['rgba(88,72,150,0.72)', 'rgba(25,31,73,0.92)'] as const,
  mint: luluGradients.mint,
  danger: ['rgba(119,47,87,0.34)', 'rgba(42,26,57,0.78)'] as const,
};

export function GlassCard({
  children,
  className = '',
  style,
  variant = 'default',
}: Props) {
  return (
    <View
      className={`overflow-hidden rounded-[28px] border ${className}`}
      style={[
        {
          borderColor:
            variant === 'mint'
              ? 'rgba(105,230,194,0.24)'
              : variant === 'danger'
                ? 'rgba(255,143,168,0.22)'
                : palette.glassBorder,
          shadowColor: variant === 'hero' ? '#A762FF' : '#050714',
          shadowOpacity: variant === 'hero' ? 0.22 : 0.28,
          shadowRadius: variant === 'hero' ? 24 : 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: variant === 'hero' ? 7 : 4,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradients[variant]}
        locations={[0, 1]}
        style={{ flex: 1 }}
      >
        <View
          pointerEvents="none"
          style={{
            height: 1,
            marginHorizontal: 20,
            backgroundColor: palette.glassHighlight,
            opacity: 0.9,
          }}
        />
        {children}
      </LinearGradient>
    </View>
  );
}
