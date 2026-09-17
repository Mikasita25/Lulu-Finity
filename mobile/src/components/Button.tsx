import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme, luluGradients, palette } from '@/theme/palette';

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  compact?: boolean;
  loading?: boolean;
  selected?: boolean;
};

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  compact = false,
  loading = false,
  selected = false,
}: Props) {
  const pressed = useSharedValue(0);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const accent = accentByTheme[accentTheme];
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.12,
    transform: [{ scale: 1 - pressed.value * 0.025 }],
  }));
  const blocked = disabled || loading;
  const body = (
    <View
      className={`flex-row items-center justify-center gap-2 rounded-[18px] ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={{ minHeight: compact ? 44 : 54 }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#151936' : palette.text}
        />
      ) : icon ? (
        <View>{icon}</View>
      ) : null}
      <Text
        style={{ color: variant === 'primary' ? '#151936' : palette.text }}
        className="text-[15px] font-extrabold"
      >
        {label}
      </Text>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, selected }}
      disabled={blocked}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 150 });
      }}
      onPress={() => {
        if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
        void onPress();
      }}
      className={blocked ? 'opacity-40' : ''}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            borderRadius: 18,
            shadowColor: variant === 'primary' ? accent : '#000',
            shadowOpacity: variant === 'primary' ? 0.28 : 0.14,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 7 },
            elevation: variant === 'primary' ? 5 : 2,
          },
        ]}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={luluGradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 18, overflow: 'hidden' }}
          >
            {body}
          </LinearGradient>
        ) : (
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor:
                variant === 'danger'
                  ? 'rgba(255,143,168,0.30)'
                  : selected
                    ? `${accent}70`
                    : palette.glassBorder,
              backgroundColor:
                variant === 'danger'
                  ? 'rgba(255,93,132,0.13)'
                  : selected
                    ? `${accent}1F`
                    : 'rgba(255,255,255,0.065)',
              overflow: 'hidden',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                height: 1,
                marginHorizontal: 18,
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            />
            {body}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function PrimaryButton(props: Omit<Props, 'variant'>) {
  return <Button {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<Props, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}

export function GlassButton(props: Omit<Props, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}
