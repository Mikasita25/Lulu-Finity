import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { AudioLines, Gamepad2, Radio } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';

const luluLogo = require('../../assets/icon.png');

const slides = [
  {
    icon: Radio,
    title: 'Tu LIVE, más vivo ♡',
    text: 'Conecta tu cuenta de TikTok y deja que Lulú reciba comentarios, regalos y seguidores en tiempo real.',
  },
  {
    icon: AudioLines,
    title: 'Tu voz y tu música.',
    text: 'Configura el TTS Microsoft, controla el volumen y recibe solicitudes musicales desde un mismo lugar.',
  },
  {
    icon: Gamepad2,
    title: 'Juega; Lulú te acompaña.',
    text: 'Mantén el LIVE, la voz y la música activos en segundo plano mientras vuelves a tu juego.',
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
      <View className="pt-8">
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
        <Text className="mt-5 text-xs font-black uppercase tracking-[3px] text-lulu-200/70">
          LULÚ FINITY MOBILE
        </Text>
        <Text
          style={{ fontFamily: 'serif', fontStyle: 'italic' }}
          className="mt-1 text-sm font-bold text-white/45"
        >
          Sueña · streamea · juega ✦
        </Text>
      </View>

      <Animated.View key={index} entering={FadeInRight.duration(280)}>
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-[28px] border border-lulu-300/20 bg-lulu-500/10">
          <Icon size={36} color="#F2B7FF" />
        </View>
        <Text className="max-w-[320px] text-4xl font-black leading-[43px] tracking-tight text-white">
          {slide.title}
        </Text>
        <Text className="mt-4 max-w-[340px] text-[15px] leading-6 text-white/50">
          {slide.text}
        </Text>
      </Animated.View>

      <View className="pb-4">
        <View className="mb-7 flex-row gap-2">
          {slides.map((_, dot) => (
            <Pressable key={dot} onPress={() => setIndex(dot)}>
              <View
                className={`h-2 rounded-full ${dot === index ? 'w-9 bg-lulu-500' : 'w-2 bg-white/20'}`}
              />
            </Pressable>
          ))}
        </View>
        <Button
          label={index === slides.length - 1 ? 'Empezar' : 'Continuar'}
          onPress={next}
        />
      </View>
    </Screen>
  );
}
