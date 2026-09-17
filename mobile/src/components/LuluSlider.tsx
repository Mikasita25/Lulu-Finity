import { useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Minus, Plus } from 'lucide-react-native';
import { luluGradients, palette } from '@/theme/palette';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function LuluSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 0.05,
  label,
  formatValue = (next) => `${Math.round(next * 100)}%`,
  disabled = false,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  label?: string;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
}) {
  const [width, setWidth] = useState(1);
  const latest = useRef({
    width,
    value,
    onValueChange,
    disabled,
    minimumValue,
    maximumValue,
    step,
  });
  latest.current = {
    width,
    value,
    onValueChange,
    disabled,
    minimumValue,
    maximumValue,
    step,
  };
  const snap = (raw: number) =>
    clamp(Math.round(raw / step) * step, minimumValue, maximumValue);
  const fromX = (x: number) => {
    const state = latest.current;
    const raw =
      state.minimumValue +
      clamp(x / state.width, 0, 1) * (state.maximumValue - state.minimumValue);
    return clamp(
      Math.round(raw / state.step) * state.step,
      state.minimumValue,
      state.maximumValue,
    );
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: (event) =>
        latest.current.onValueChange(fromX(event.nativeEvent.locationX)),
      onPanResponderMove: (event) =>
        latest.current.onValueChange(fromX(event.nativeEvent.locationX)),
    }),
  ).current;
  const ratio = clamp(
    (value - minimumValue) / (maximumValue - minimumValue || 1),
    0,
    1,
  );
  const change = (direction: number) =>
    onValueChange(snap(value + direction * step));
  return (
    <View className={disabled ? 'opacity-45' : ''}>
      {label ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-extrabold text-white/75">{label}</Text>
          <Text className="text-xs font-black text-lulu-200">
            {formatValue(value)}
          </Text>
        </View>
      ) : null}
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityLabel={decreaseLabel || `Bajar ${label || 'valor'}`}
          disabled={disabled}
          onPress={() => change(-1)}
          className="h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.055]"
        >
          <Minus size={15} color={palette.text} />
        </Pressable>
        <View
          onLayout={(event) =>
            setWidth(Math.max(1, event.nativeEvent.layout.width))
          }
          {...responder.panHandlers}
          className="h-9 flex-1 justify-center"
        >
          <View className="h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-[#0C1027]">
            <LinearGradient
              colors={luluGradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: `${ratio * 100}%`,
                height: '100%',
                borderRadius: 999,
              }}
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, ratio * (width - 18)),
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: palette.text,
              borderWidth: 3,
              borderColor: palette.pink,
              shadowColor: palette.pink,
              shadowOpacity: 0.45,
              shadowRadius: 6,
              elevation: 4,
            }}
          />
        </View>
        <Pressable
          accessibilityLabel={increaseLabel || `Subir ${label || 'valor'}`}
          disabled={disabled}
          onPress={() => change(1)}
          className="h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.055]"
        >
          <Plus size={15} color={palette.text} />
        </Pressable>
      </View>
    </View>
  );
}
