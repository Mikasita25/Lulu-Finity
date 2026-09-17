import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
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
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={
                    descriptor?.options.tabBarAccessibilityLabel
                  }
                  onPress={onPress}
                  onLongPress={() =>
                    navigation.emit({ type: 'tabLongPress', target: route.key })
                  }
                  className="flex-1 items-center justify-center"
                >
                  <View className="h-10 w-12 items-center justify-center overflow-hidden rounded-2xl">
                    {focused ? (
                      <LinearGradient
                        colors={[
                          'rgba(214,133,255,0.27)',
                          'rgba(167,98,255,0.08)',
                        ]}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                        }}
                      />
                    ) : null}
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
                    {String(label)}
                  </Text>
                  {focused ? (
                    <View
                      style={{
                        backgroundColor: palette.pink,
                        shadowColor: palette.pink,
                        shadowOpacity: 0.8,
                        shadowRadius: 5,
                      }}
                      className="mt-1 h-1 w-5 rounded-full"
                    />
                  ) : (
                    <View className="mt-1 h-1" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}
