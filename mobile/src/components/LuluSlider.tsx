import { useEffect, useRef, useState } from 'react';
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
  const [previewValue, setPreviewValue] = useState(value);
  const dragging = useRef(false);
  const pendingValue = useRef(value);
  const latest = useRef({
    width,
    onValueChange,
    disabled,
    minimumValue,
    maximumValue,
    step,
  });
  latest.current = {
    width,
    onValueChange,
    disabled,
    minimumValue,
    maximumValue,
    step,
  };
  useEffect(() => {
    pendingValue.current = value;
    if (!dragging.current) setPreviewValue(value);
  }, [value]);

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
  const previewFromX = (x: number) => {
    const next = fromX(x);
    pendingValue.current = next;
    setPreviewValue((current) => (current === next ? current : next));
  };
  const finishSliding = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = pendingValue.current;
    setPreviewValue(next);
    latest.current.onValueChange(next);
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: (event) => {
        dragging.current = true;
        previewFromX(event.nativeEvent.locationX);
      },
      onPanResponderMove: (event) => previewFromX(event.nativeEvent.locationX),
      onPanResponderRelease: finishSliding,
      onPanResponderTerminate: finishSliding,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;
  const ratio = clamp(
    (previewValue - minimumValue) / (maximumValue - minimumValue || 1),
    0,
    1,
  );
  const change = (direction: number) => {
    const next = snap(previewValue + direction * step);
    pendingValue.current = next;
    setPreviewValue(next);
    onValueChange(next);
  };
  return (
    <View className={disabled ? 'opacity-45' : ''}>
      {label ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-extrabold text-white/75">{label}</Text>
          <Text className="text-xs font-black text-lulu-200">
            {formatValue(previewValue)}
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
          accessibilityRole="adjustable"
          accessibilityLabel={label || 'Control deslizante'}
          accessibilityValue={{
            min: minimumValue,
            max: maximumValue,
            now: previewValue,
            text: formatValue(previewValue),
          }}
          onLayout={(event) =>
            setWidth(Math.max(1, event.nativeEvent.layout.width))
          }
          {...responder.panHandlers}
          className="h-11 flex-1 justify-center"
        >
          <View className="h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-[#0C1027]">
            <View
              style={{
                width: Math.max(0, ratio * width),
                height: '100%',
                borderRadius: 999,
                backgroundColor: palette.violet,
              }}
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, ratio * (width - 24)),
              width: 24,
              height: 24,
              borderRadius: 12,
              padding: 4,
              backgroundColor: 'rgba(214,133,255,0.22)',
            }}
          >
            <LinearGradient
              colors={luluGradients.primary}
              style={{
                flex: 1,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: palette.text,
              }}
            />
          </View>
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
