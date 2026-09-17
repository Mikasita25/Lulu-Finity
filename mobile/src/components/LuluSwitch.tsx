import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '@/theme/palette';
import { useAppStore } from '@/store/useAppStore';

export function LuluSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const progress = useSharedValue(value ? 1 : 0);
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 220 });
  }, [progress, value]);
  const trackStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(205,187,255,0.14)', 'rgba(214,133,255,0.52)'],
    ),
    shadowOpacity: progress.value * 0.28,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 21 }],
    opacity: disabled ? 0.55 : 1,
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}
    >
      <Animated.View
        style={[
          {
            width: 52,
            height: 31,
            padding: 3,
            borderRadius: 18,
            borderWidth: 1,
            overflow: 'hidden',
            backgroundColor: 'rgba(32,36,71,0.9)',
            shadowColor: palette.pink,
          },
          trackStyle,
        ]}
      >
        {value ? (
          <LinearGradient
            colors={['#A762FF', '#D685FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', inset: 0 }}
          />
        ) : null}
        <Animated.View
          style={[
            {
              width: 23,
              height: 23,
              borderRadius: 12,
              backgroundColor: palette.text,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
