import { Pressable, Text, View } from 'react-native';
import { AudioLines, ChevronRight, DownloadCloud, History, ListFilter, Music2, Palette, Settings, UserRound, Volume2, Zap } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { useAppStore } from '@/store/useAppStore';
import { useUpdateStore } from '@/store/useUpdateStore';

const items = [
  { route: 'TTS', title: 'TTS Bot', subtitle: 'Leer comentarios del LIVE con voz', icon: AudioLines },
  { route: 'Music', title: 'Música', subtitle: 'Solicitudes !cancion, cola y controles', icon: Music2 },
  { route: 'RecentActivity', title: 'Actividad reciente', subtitle: 'Elegir qué eventos aparecen durante el LIVE', icon: ListFilter },
  { route: 'Interactions', title: 'Automatizaciones', subtitle: 'Comandos, Fan Stickers, sonidos y TTS', icon: Zap },
  { route: 'History', title: 'Historial', subtitle: 'Eventos y filtros', icon: History },
  { route: 'Sounds', title: 'Sonidos', subtitle: 'Alertas y preview', icon: Volume2 },
  { route: 'Appearance', title: 'Apariencia', subtitle: 'Temas, colores y ranking RGB', icon: Palette },
  { route: 'Updates', title: 'Actualizaciones', subtitle: 'Buscar y descargar nuevas versiones', icon: DownloadCloud },
  { route: 'Profile', title: 'Perfil', subtitle: 'TikTok y modo de uso', icon: UserRound },
  { route: 'Settings', title: 'Ajustes', subtitle: 'Haptics, notificaciones y conexión', icon: Settings },
];

export function MoreScreen({ navigation }: any) {
  const mode = useAppStore((state) => state.mode);
  const update = useUpdateStore((state) => state.update);
  return (
    <Screen>
      <AppHeader title="Más" subtitle={mode === 'streamer' ? 'Configuración de Streamer' : 'Preferencias de espectador'} />
      <GlassCard>
        <View className="px-4">
          {items.map((item, index) => {
            const Icon = item.icon;
            const hasUpdate = item.route === 'Updates' && update?.available;
            return (
              <Pressable key={item.route} onPress={() => navigation.navigate(item.route)} className={`flex-row items-center gap-3 py-4 ${index < items.length - 1 ? 'border-b border-white/[0.055]' : ''}`}>
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/10"><Icon size={19} color="#FF9DDA" /></View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-black text-white">{item.title}</Text>
                    {hasUpdate ? <Text className="overflow-hidden rounded-lg bg-lulu-500 px-2 py-1 text-[9px] font-black text-white">NUEVA v{update.latestVersion}</Text> : null}
                  </View>
                  <Text className="mt-1 text-xs font-medium text-white/30">{item.subtitle}</Text>
                </View>
                <ChevronRight size={17} color="#7A6E78" />
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </Screen>
  );
}
