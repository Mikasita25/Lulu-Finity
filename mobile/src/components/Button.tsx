import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  compact?: boolean;
};

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  compact = false,
}: Props) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.12,
    transform: [{ scale: 1 - pressed.value * 0.025 }],
  }));
  const colors =
    variant === 'primary'
      ? 'bg-lulu-500'
      : variant === 'danger'
        ? 'bg-red-500/20 border border-red-400/30'
        : 'bg-white/10 border border-white/10';

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: 120 }); }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        void onPress();
      }}
      className={disabled ? 'opacity-40' : ''}
    >
      <Animated.View
        style={animatedStyle}
        className={`flex-row items-center justify-center gap-2 rounded-2xl ${compact ? 'px-4 py-3' : 'px-5 py-4'} ${colors}`}
      >
        {icon ? <View>{icon}</View> : null}
        <Text className="text-[15px] font-extrabold text-white">{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
