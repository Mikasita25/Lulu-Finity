import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';

export function SplashView() {
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse]);
  const loaderStyle = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scaleX: pulse.value }] }));

  return (
    <LinearGradient colors={['#09070D', '#1C0B20', '#09070D']} className="flex-1 items-center justify-center">
      <Animated.View
        entering={ZoomIn.springify().damping(14)}
        className="h-24 w-24 items-center justify-center rounded-[34px] border border-lulu-400/25 bg-lulu-500/20"
      >
        <Sparkles size={44} color="#FF79CF" strokeWidth={2.4} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(180).duration(420)} className="mt-6 items-center">
        <Text className="text-2xl font-black tracking-tight text-white">Lulú Finity</Text>
        <Text className="mt-2 text-[10px] font-black uppercase tracking-[3px] text-lulu-200/50">
          LIVE COMPANION
        </Text>
      </Animated.View>
      <View className="absolute bottom-12">
        <Animated.View style={loaderStyle} className="h-1 w-16 rounded-full bg-lulu-500" />
      </View>
    </LinearGradient>
  );
}
