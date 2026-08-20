import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { BellRing, Radio, Trophy } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';

const luluLogo = require('../../assets/icon.png');

const slides = [
  {
    icon: Radio,
    title: 'Tu LIVE, contigo.',
    text: 'Conecta Lulú Finity a tu TikTok LIVE y mira comentarios, regalos, likes y seguidores en tiempo real.',
  },
  {
    icon: Trophy,
    title: 'Metas y ranking vivos.',
    text: 'Metas animadas, Top Fans y microinteracciones que reaccionan al momento en que tu comunidad participa.',
  },
  {
    icon: BellRing,
    title: 'Hecha para Android.',
    text: 'Alertas heads-up, haptics y una Vista en Vivo diseñada para usar con una sola mano.',
  },
];

export function OnboardingScreen({ navigation }: any) {
  const [index, setIndex] = useState(0);
  const finish = useAppStore((state) => state.finishOnboarding);
  const slide = slides[index]!;
  const Icon = slide.icon;

  const next = () => {
    if (index < slides.length - 1) setIndex((value) => value + 1);
    else {
      finish();
      navigation.replace('Main');
    }
  };

  return (
    <Screen scroll={false} contentClassName="justify-between">
      <View className="pt-10">
        <Animated.View
          entering={ZoomIn.springify().damping(16)}
          className="h-20 w-20 overflow-hidden rounded-[24px]"
        >
          <Image
            source={luluLogo}
            resizeMode="contain"
            style={{ width: 80, height: 80 }}
            accessibilityLabel="Logo de Lulú Finity"
          />
        </Animated.View>
        <Text className="mt-5 text-xs font-black uppercase tracking-[3px] text-lulu-200/60">
          LULÚ FINITY MOBILE
        </Text>
      </View>

      <Animated.View key={index} entering={FadeInRight.duration(280)}>
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.06]">
          <Icon size={36} color="#FF9DDA" />
        </View>
        <Text className="max-w-[320px] text-4xl font-black leading-[43px] tracking-tight text-white">
          {slide.title}
        </Text>
        <Text className="mt-4 max-w-[340px] text-[15px] leading-6 text-white/50">{slide.text}</Text>
      </Animated.View>

      <View className="pb-4">
        <View className="mb-7 flex-row gap-2">
          {slides.map((_, dot) => (
            <Pressable key={dot} onPress={() => setIndex(dot)}>
              <View className={`h-2 rounded-full ${dot === index ? 'w-9 bg-lulu-500' : 'w-2 bg-white/20'}`} />
            </Pressable>
          ))}
        </View>
        <Button label={index === slides.length - 1 ? 'Empezar' : 'Continuar'} onPress={next} />
      </View>
    </Screen>
  );
}
