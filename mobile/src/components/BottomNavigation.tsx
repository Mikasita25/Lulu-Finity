import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, type ComponentType } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { AudioLines, House, Music2, Settings, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BOTTOM_NAV_CONTENT_HEIGHT,
  bottomNavigationHeight,
} from '@/navigation/layout';

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
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 48,
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
        <View className="h-9 w-12 items-center justify-center overflow-hidden rounded-2xl">
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
          className="mt-1 text-[10px] font-extrabold"
          numberOfLines={1}
        >
          {label}
        </Text>
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
        left: 0,
        right: 0,
        bottom: 0,
        height: bottomNavigationHeight(insets.bottom),
      }}
    >
      <BlurView
        intensity={34}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={{
          flex: 1,
          paddingBottom: insets.bottom,
          overflow: 'hidden',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: 'rgba(222,207,255,0.16)',
          backgroundColor: 'rgba(12,15,38,0.94)',
        }}
      >
        <View
          style={{ height: BOTTOM_NAV_CONTENT_HEIGHT }}
          className="flex-row items-stretch px-1"
        >
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
  );
}
