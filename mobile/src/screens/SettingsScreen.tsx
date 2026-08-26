import type { ReactNode } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { BellRing, Cable, RotateCcw, Smartphone, Vibrate } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { useFloatingPanelStore } from '@/store/useFloatingPanelStore';
import { configureNotifications } from '@/services/notifications';
import { connectLive, disconnectLive } from '@/services/liveRuntime';
import {
  canDrawFloatingPanel,
  requestFloatingPanelPermission,
  startFloatingPanel,
  stopFloatingPanel,
} from '@/services/floatingPanel';

function SettingSwitch({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-white/[0.055] py-4">
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-lulu-500/10">{icon}</View>
      <View className="flex-1">
        <Text className="text-sm font-black text-white">{title}</Text>
        <Text className="mt-1 text-xs leading-5 text-white/40">{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#342C34', true: '#FF5FC8' }}
        thumbColor="#FFF7FC"
      />
    </View>
  );
}

export function SettingsScreen() {
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const headsUpNotifications = useAppStore((state) => state.headsUpNotifications);
  const relayState = useAppStore((state) => state.relayState);
  const relayMessage = useAppStore((state) => state.relayMessage);
  const username = useAppStore((state) => state.username);
  const mode = useAppStore((state) => state.mode);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const setHeadsUpNotifications = useAppStore((state) => state.setHeadsUpNotifications);
  const floatingPanelEnabled = useFloatingPanelStore((state) => state.enabled);
  const setFloatingPanelEnabled = useFloatingPanelStore((state) => state.setEnabled);

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      try {
        await configureNotifications();
      } catch {}
    }
    setHeadsUpNotifications(enabled);
  };

  const toggleFloatingPanel = (enabled: boolean) => {
    if (!enabled) {
      setFloatingPanelEnabled(false);
      try {
        stopFloatingPanel();
      } catch {}
      return;
    }

    try {
      if (canDrawFloatingPanel()) {
        setFloatingPanelEnabled(true);
        startFloatingPanel();
        return;
      }

      Alert.alert(
        'Permitir panel flotante',
        'Android abrirá el permiso “Mostrar sobre otras apps”. Actívalo para Lulú Finity y vuelve a la app; el panel aparecerá automáticamente.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Abrir ajustes',
            onPress: () => {
              setFloatingPanelEnabled(true);
              requestFloatingPanelPermission();
            },
          },
        ],
      );
    } catch (error) {
      setFloatingPanelEnabled(false);
      Alert.alert('No se pudo activar', error instanceof Error ? error.message : String(error));
    }
  };

  const reconnect = () => {
    try {
      connectLive();
    } catch (error) {
      Alert.alert('No se pudo reconectar', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <AppHeader title="Ajustes" subtitle="Configura cómo se siente y cómo te avisa Lulú." />

      <SectionTitle title="Avisos del teléfono" />
      <GlassCard>
        <View className="px-5">
          <SettingSwitch
            title="Vibración"
            subtitle="Vibra suavemente con regalos, seguidores y metas."
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            icon={<Vibrate size={18} color="#FF9DDA" />}
          />
          <SettingSwitch
            title="Avisos emergentes"
            subtitle="Muestra eventos importantes aunque estés usando otra app."
            value={headsUpNotifications}
            onValueChange={toggleNotifications}
            icon={<BellRing size={18} color="#FF9DDA" />}
          />
          <SettingSwitch
            title="Panel flotante del LIVE"
            subtitle="Comentarios, likes, follows, regalos y controles de música encima de otras apps."
            value={floatingPanelEnabled}
            onValueChange={toggleFloatingPanel}
            icon={<Smartphone size={18} color="#FF9DDA" />}
          />
        </View>
      </GlassCard>

      <SectionTitle title="Estado del LIVE" />
      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <Cable size={20} color="#FF9DDA" />
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Conexión con TikTok</Text>
              <Text className="mt-1 text-xs text-white/40">
                {username ? `@${username}` : 'Sin cuenta configurada'} · {relayState === 'connected' ? 'conectado' : 'sin conexión'}
              </Text>
            </View>
          </View>
          {relayMessage ? <Text className="mt-4 text-xs leading-5 text-white/40">{relayMessage}</Text> : null}
          {mode === 'streamer' ? (
            <View className="mt-5 gap-3">
              <Button label="Reconectar" onPress={reconnect} icon={<RotateCcw size={17} color="white" />} />
              <Button label="Desconectar" variant="secondary" onPress={disconnectLive} />
            </View>
          ) : null}
        </View>
      </GlassCard>

      <SectionTitle title="Funcionamiento en segundo plano" />
      <GlassCard>
        <View className="flex-row items-start gap-3 p-5">
          <Smartphone size={21} color="#FF9DDA" />
          <Text className="flex-1 text-xs leading-5 text-white/40">
            Con el panel flotante activado, Android mantiene un servicio visible mientras usas el juego o TikTok. El panel baja su opacidad cuando no hay actividad y vuelve a mostrarse completo cuando llega un evento o lo tocas.
          </Text>
        </View>
      </GlassCard>

      <Text className="mt-6 text-center text-[10px] leading-5 text-white/25">
        Lulú Finity 1.3.4 · Android
      </Text>
    </Screen>
  );
}
