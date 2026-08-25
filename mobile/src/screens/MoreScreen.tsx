import { View } from 'react-native';
import { DownloadCloud, History, ListFilter, Palette, Settings, UserRound, Volume2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { MenuRow } from '@/components/MenuRow';
import { SectionTitle } from '@/components/SectionTitle';
import { useUpdateStore } from '@/store/useUpdateStore';

const liveOptions = [
  { route: 'RecentActivity', title: 'Eventos visibles', subtitle: 'Decide qué aparece en el panel del LIVE', icon: ListFilter },
  { route: 'History', title: 'Historial', subtitle: 'Consulta lo que ocurrió durante la transmisión', icon: History },
  { route: 'Sounds', title: 'Sonidos de alerta', subtitle: 'Personaliza el audio de cada evento', icon: Volume2 },
];

const appItems = [
  { route: 'Appearance', title: 'Apariencia', subtitle: 'Cambia el color principal de la app', icon: Palette },
  { route: 'Profile', title: 'Perfil', subtitle: 'Configura la cuenta de TikTok y el modo de uso', icon: UserRound },
  { route: 'Settings', title: 'Ajustes', subtitle: 'Vibración, avisos y estado de conexión', icon: Settings },
  { route: 'Updates', title: 'Actualizaciones', subtitle: 'Comprueba si hay una versión nueva', icon: DownloadCloud },
];

export function MoreScreen({ navigation }: any) {
  const update = useUpdateStore((state) => state.update);
  return (
    <Screen>
      <AppHeader title="Ajustes" subtitle="Opciones que normalmente solo necesitas configurar una vez." />
      <SectionTitle title="Actividad y alertas" subtitle="La voz, la música y las automatizaciones ahora están siempre visibles abajo." />
      <GlassCard>
        <View className="px-4">
          {liveOptions.map((item, index) => <MenuRow key={item.route} {...item} last={index === liveOptions.length - 1} onPress={() => navigation.navigate(item.route)} />)}
        </View>
      </GlassCard>

      <SectionTitle title="Aplicación" subtitle="Cuenta, diseño, permisos y actualizaciones." />
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
