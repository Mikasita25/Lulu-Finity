import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { useAppStore } from '@/store/useAppStore';

const PARTICLES = [
  { left: '6%', delay: 0, drift: -22, rotate: 170, color: '#FF5FC8' },
  { left: '13%', delay: 110, drift: 18, rotate: 260, color: '#A96CFF' },
  { left: '21%', delay: 55, drift: -10, rotate: 220, color: '#FFE07D' },
  { left: '29%', delay: 180, drift: 26, rotate: 310, color: '#FF9DDA' },
  { left: '37%', delay: 80, drift: -24, rotate: 195, color: '#6BE7FF' },
  { left: '45%', delay: 230, drift: 12, rotate: 290, color: '#FF5FC8' },
  { left: '53%', delay: 20, drift: 27, rotate: 240, color: '#A96CFF' },
  { left: '61%', delay: 140, drift: -18, rotate: 330, color: '#FFE07D' },
  { left: '69%', delay: 65, drift: 20, rotate: 210, color: '#FF9DDA' },
  { left: '77%', delay: 200, drift: -26, rotate: 285, color: '#6BE7FF' },
  { left: '85%', delay: 95, drift: 16, rotate: 250, color: '#FF5FC8' },
  { left: '92%', delay: 260, drift: -14, rotate: 320, color: '#A96CFF' },
] as const;

function ConfettiParticle({ particle, index, runKey }: { particle: (typeof PARTICLES)[number]; index: number; runKey: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(particle.delay, withTiming(1, { duration: 2200 }));
  }, [particle.delay, progress, runKey]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.08 ? p / 0.08 : p > 0.84 ? Math.max(0, (1 - p) / 0.16) : 1;
    return {
      opacity,
      transform: [
        { translateY: -40 + p * 800 },
        { translateX: p * particle.drift },
        { rotate: `${p * particle.rotate}deg` },
        { scale: 0.7 + p * 0.3 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 20,
          left: particle.left,
          width: index % 3 === 0 ? 10 : 7,
          height: index % 2 === 0 ? 14 : 8,
          borderRadius: 3,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

export function CelebrationOverlay() {
  const completion = useAppStore((state) => state.lastGoalCompletion);
  const goals = useAppStore((state) => state.goals);
  const [visible, setVisible] = useState(false);
  const lastSeen = useRef(0);

  useEffect(() => {
    if (!completion || completion.at <= lastSeen.current) return;
    lastSeen.current = completion.at;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2700);
    return () => clearTimeout(timer);
  }, [completion]);

  if (!visible || !completion) return null;
  const goal = goals.find((item) => item.id === completion.id);

  return (
    <View pointerEvents="none" className="absolute inset-0 z-50 overflow-hidden">
      <Animated.View
        entering={FadeInUp.springify().damping(14)}
        exiting={FadeOut.duration(180)}
        className="absolute left-6 right-6 top-24 items-center rounded-[28px] border border-lulu-200/30 bg-[#1A0D1BEF] px-5 py-5"
      >
        <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-lulu-500/20">
          <Sparkles size={24} color="#FF9DDA" />
        </View>
        <Text className="text-center text-[11px] font-black uppercase tracking-[2px] text-lulu-200">
          Meta completada
        </Text>
        <Text className="mt-1 text-center text-lg font-black text-white">
          {goal?.title ?? '¡Lo lograron!'}
        </Text>
      </Animated.View>

      {PARTICLES.map((particle, index) => (
        <ConfettiParticle key={`${completion.at}-${index}`} particle={particle} index={index} runKey={completion.at} />
      ))}
    </View>
  );
}
