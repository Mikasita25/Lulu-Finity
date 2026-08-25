import { View } from 'react-native';
import { AudioLines, DownloadCloud, History, ListFilter, Music2, Palette, Settings, UserRound, Volume2, Zap } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { MenuRow } from '@/components/MenuRow';
import { SectionTitle } from '@/components/SectionTitle';
import { useAppStore } from '@/store/useAppStore';
import { useUpdateStore } from '@/store/useUpdateStore';

const liveTools = [
  { route: 'TTS', title: 'Voz del chat', subtitle: 'Elige qué mensajes leer y con qué voz', icon: AudioLines },
  { route: 'Music', title: 'Música', subtitle: 'Controla canciones y solicitudes del chat', icon: Music2 },
  { route: 'Interactions', title: 'Respuestas automáticas', subtitle: 'Crea acciones para comandos, regalos y eventos', icon: Zap },
  { route: 'RecentActivity', title: 'Eventos visibles', subtitle: 'Decide qué aparece en el panel del LIVE', icon: ListFilter },
  { route: 'History', title: 'Historial', subtitle: 'Consulta lo que ocurrió durante la transmisión', icon: History },
  { route: 'Sounds', title: 'Sonidos de alerta', subtitle: 'Personaliza el audio de cada evento', icon: Volume2 },
];

const appItems = [
  { route: 'Appearance', title: 'Apariencia', subtitle: 'Cambia colores y estilo del ranking', icon: Palette },
  { route: 'Profile', title: 'Perfil', subtitle: 'Configura la cuenta de TikTok y el modo de uso', icon: UserRound },
  { route: 'Settings', title: 'Ajustes', subtitle: 'Vibración, avisos y estado de conexión', icon: Settings },
  { route: 'Updates', title: 'Actualizaciones', subtitle: 'Comprueba si hay una versión nueva', icon: DownloadCloud },
];

export function MoreScreen({ navigation }: any) {
  const mode = useAppStore((state) => state.mode);
  const update = useUpdateStore((state) => state.update);
  return (
    <Screen>
      <AppHeader title="Menú" subtitle={mode === 'streamer' ? 'Todas las herramientas, organizadas por función.' : 'Tus herramientas y preferencias.'} />
      <SectionTitle title="Herramientas del LIVE" subtitle="Voz, música, eventos y alertas." />
      <GlassCard>
        <View className="px-4">
          {liveTools.map((item, index) => <MenuRow key={item.route} {...item} last={index === liveTools.length - 1} onPress={() => navigation.navigate(item.route)} />)}
        </View>
      </GlassCard>

      <SectionTitle title="Tu app" subtitle="Cuenta, diseño y opciones generales." />
      <GlassCard>
        <View className="px-4">
          {appItems.map((item, index) => (
            <MenuRow key={item.route} {...item} last={index === appItems.length - 1} badge={item.route === 'Updates' && update?.available ? `v${update.latestVersion}` : undefined} onPress={() => navigation.navigate(item.route)} />
          ))}
        </View>
      </GlassCard>
    </Screen>
  );
}
