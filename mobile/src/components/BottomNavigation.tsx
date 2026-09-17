import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, type ComponentType } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { AudioLines, House, Music2, Settings, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/theme/palette';

const icons = {
  Dashboard: House,
  TTS: AudioLines,
  Music: Music2,
  Interactions: Zap,
  More: Settings,
};

type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

function NavigationItem({
  focused,
  Icon,
  label,
  accessibilityLabel,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  Icon: IconComponent;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: focused ? 230 : 170,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  const iconScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.09],
  });
  const iconLift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, -1],
  });
  const indicatorScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [{ translateY: iconLift }, { scale: iconScale }],
        }}
      >
        <View className="h-10 w-12 items-center justify-center overflow-hidden rounded-2xl">
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              opacity: progress,
            }}
          >
            <LinearGradient
              colors={['rgba(214,133,255,0.27)', 'rgba(167,98,255,0.08)']}
              style={{ flex: 1 }}
            />
          </Animated.View>
          <Icon
            size={21}
            color={focused ? '#F2B7FF' : '#999AB9'}
            strokeWidth={focused ? 2.5 : 2.1}
          />
        </View>
        <Text
          style={{ color: focused ? '#F2B7FF' : '#999AB9' }}
          className="mt-0.5 text-[9px] font-extrabold"
        >
          {label}
        </Text>
        <Animated.View
          style={{
            marginTop: 4,
            width: 20,
            height: 4,
            borderRadius: 999,
            backgroundColor: palette.pink,
            opacity: progress,
            transform: [{ scaleX: indicatorScale }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

export function BottomNavigation({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: Math.max(8, insets.bottom),
      }}
    >
      <View
        style={{
          borderRadius: 27,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(222,207,255,0.16)',
          shadowColor: '#050714',
          shadowOpacity: 0.5,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }}
      >
        <BlurView
          intensity={38}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={{ backgroundColor: 'rgba(15,18,45,0.80)' }}
        >
          <View pointerEvents="none" className="mx-5 h-px bg-white/[0.12]" />
          <View className="h-[72px] flex-row items-center px-2">
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const Icon = icons[route.name as keyof typeof icons] ?? Settings;
              const descriptor = descriptors[route.key];
              const label = descriptor?.options.title ?? route.name;
              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name, route.params);
              };
              return (
                <NavigationItem
                  key={route.key}
                  focused={focused}
                  Icon={Icon}
                  label={String(label)}
                  accessibilityLabel={
                    descriptor?.options.tabBarAccessibilityLabel
                  }
                  onPress={onPress}
                  onLongPress={() =>
                    navigation.emit({ type: 'tabLongPress', target: route.key })
                  }
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}
