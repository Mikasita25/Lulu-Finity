import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AudioLines,
  Cable,
  Cpu,
  DownloadCloud,
  Headphones,
  History,
  Layers3,
  ListFilter,
  Music2,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Volume2,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { MenuRow } from '@/components/MenuRow';
import { SectionTitle } from '@/components/SectionTitle';
import { useUpdateStore } from '@/store/useUpdateStore';
import { palette } from '@/theme/palette';

const liveOptions = [
  {
    route: 'RecentActivity',
    title: 'Eventos visibles',
    subtitle: 'Decide qué aparece en el panel del LIVE',
    icon: ListFilter,
  },
  {
    route: 'History',
    title: 'Historial',
    subtitle: 'Consulta lo que ocurrió durante la transmisión',
    icon: History,
  },
  {
    route: 'Sounds',
    title: 'Sonidos de alerta',
    subtitle: 'Personaliza el audio de cada evento',
    icon: Volume2,
  },
];

const categories: Array<{
  target: string;
  title: string;
  subtitle: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  parent?: boolean;
}> = [
  {
    target: 'Profile',
    title: 'Cuenta',
    subtitle: 'Perfil y modo',
    icon: UserRound,
    parent: true,
  },
  {
    target: 'Connect',
    title: 'LIVE',
    subtitle: 'Conexión TikTok',
    icon: Cable,
    parent: true,
  },
  {
    target: 'Sounds',
    title: 'Audio',
    subtitle: 'Alertas y mezcla',
    icon: Headphones,
    parent: true,
  },
  { target: 'TTS', title: 'TTS', subtitle: 'Voz del chat', icon: AudioLines },
  {
    target: 'Music',
    title: 'Música',
    subtitle: 'Cola y reproductor',
    icon: Music2,
  },
  {
    target: 'Settings',
    title: 'Segundo plano',
    subtitle: 'Avisos y servicio',
    icon: Layers3,
    parent: true,
  },
  {
    target: 'Appearance',
    title: 'Apariencia',
    subtitle: 'Tema y acento',
    icon: Palette,
    parent: true,
  },
  {
    target: 'Settings',
    title: 'Rendimiento',
    subtitle: 'Uso mientras juegas',
    icon: Cpu,
    parent: true,
  },
  {
    target: 'Updates',
    title: 'Avanzado',
    subtitle: 'Versión y update',
    icon: ShieldCheck,
    parent: true,
  },
];

export function MoreScreen({ navigation }: any) {
  const update = useUpdateStore((state) => state.update);
  const openCategory = (item: (typeof categories)[number]) => {
    if (item.parent) navigation.getParent()?.navigate(item.target);
    else navigation.navigate(item.target);
  };
  return (
    <Screen>
      <AppHeader
        title="Ajustes"
        subtitle="Todo organizado por categoría, sin una lista interminable."
      />
      <GlassCard variant="hero">
        <View className="flex-row items-center gap-3 p-5">
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-lulu-300/20 bg-lulu-500/15">
            <Sparkles size={21} color={palette.pinkSoft} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-black text-white">
              Tu Lulú, a tu manera
            </Text>
            <Text className="mt-1 text-xs leading-5 text-white/60">
              Cada categoría abre solo las opciones relacionadas.
            </Text>
          </View>
        </View>
      </GlassCard>

      <SectionTitle
        title="Categorías"
        subtitle="Toca una sección para entrar a sus controles."
      />
      <View className="flex-row flex-wrap gap-3">
        {categories.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={`${item.target}-${item.title}`}
              onPress={() => openCategory(item)}
              style={{ width: '47.8%' }}
              className="min-h-[126px] overflow-hidden rounded-[24px] border border-white/[0.10] bg-white/[0.045] p-4"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl border border-lulu-300/20 bg-lulu-500/10">
                <Icon size={19} color={palette.pinkSoft} />
              </View>
              <Text className="mt-3 text-sm font-black text-white">
                {item.title}
              </Text>
              <Text className="mt-1 text-[11px] leading-4 text-white/50">
                {item.subtitle}
              </Text>
              {item.target === 'Updates' && update?.available ? (
                <Text className="absolute right-3 top-3 rounded-full bg-lulu-500 px-2 py-1 text-[8px] font-black text-white">
                  v{update.latestVersion}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <SectionTitle
        title="Actividad y alertas"
        subtitle="Historial, filtros y sonidos; voz, música y automatizaciones siguen siempre visibles abajo."
      />
      <GlassCard>
        <View className="px-4">
          {liveOptions.map((item, index) => (
            <MenuRow
              key={item.route}
              {...item}
              last={index === liveOptions.length - 1}
              onPress={() => navigation.navigate(item.route)}
            />
          ))}
        </View>
      </GlassCard>

      <SectionTitle title="Aplicación" />
      <GlassCard>
        <View className="px-4">
          <MenuRow
            title="Actualizaciones"
            subtitle="Comprueba si hay una versión nueva"
            icon={DownloadCloud}
            badge={update?.available ? `v${update.latestVersion}` : undefined}
            onPress={() => navigation.getParent()?.navigate('Updates')}
          />
          <MenuRow
            title="Ajustes generales"
            subtitle="Vibración, avisos y estado de conexión"
            icon={Settings}
            last
            onPress={() => navigation.getParent()?.navigate('Settings')}
          />
        </View>
      </GlassCard>
    </Screen>
  );
}
