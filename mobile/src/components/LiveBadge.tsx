import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { RelayState } from '@/types/live';

export function LiveBadge({ state }: { state: RelayState }) {
  const connected = state === 'connected';
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = connected ? withRepeat(withTiming(1, { duration: 650 }), -1, true) : withTiming(0);
  }, [connected, pulse]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: connected ? 0.45 + pulse.value * 0.55 : 0.55,
    transform: [{ scale: connected ? 0.85 + pulse.value * 0.23 : 1 }],
  }));
  const label =
    state === 'connected'
      ? 'LIVE'
      : state === 'connecting'
        ? 'CONECTANDO'
        : state === 'rotating'
          ? 'RECONECTANDO'
          : state === 'offline'
            ? 'OFFLINE'
            : state === 'error'
              ? 'ERROR'
              : 'SIN CONEXIÓN';

  return (
    <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
      <Animated.View
        style={dotStyle}
        className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-red-500' : 'bg-white/30'}`}
      />
      <Text className="text-[10px] font-black tracking-[1.5px] text-white/80">{label}</Text>
    </View>
  );
}
