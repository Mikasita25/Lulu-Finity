import type { ReactNode } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { BellRing, Cable, RotateCcw, Smartphone, Vibrate } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { configureNotifications } from '@/services/notifications';
import { connectLive, disconnectLive } from '@/services/liveRuntime';

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

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      try {
        await configureNotifications();
      } catch {}
    }
    setHeadsUpNotifications(enabled);
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
      <AppHeader title="Ajustes" subtitle="Preferencias generales de la app." />

      <SectionTitle title="Interacciones" />
      <GlassCard>
        <View className="px-5">
          <SettingSwitch
            title="Haptics"
            subtitle="Vibración sutil para regalos, follows y metas."
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            icon={<Vibrate size={18} color="#FF9DDA" />}
          />
          <SettingSwitch
            title="Heads-up notifications"
            subtitle="Alertas importantes cuando Lulú Finity no está al frente."
            value={headsUpNotifications}
            onValueChange={toggleNotifications}
            icon={<BellRing size={18} color="#FF9DDA" />}
          />
        </View>
      </GlassCard>

      <SectionTitle title="Conexión" />
      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <Cable size={20} color="#FF9DDA" />
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Relay Lulú Finity</Text>
              <Text className="mt-1 text-xs text-white/40">
                {username ? `@${username}` : 'Sin usuario'} · {relayState}
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

      <SectionTitle title="Android" />
      <GlassCard>
        <View className="flex-row items-start gap-3 p-5">
          <Smartphone size={21} color="#FF9DDA" />
          <Text className="flex-1 text-xs leading-5 text-white/40">
            Esta edición está optimizada exclusivamente para Android. Picture-in-Picture solo se usa cuando
            Android dispone de contenido compatible; para eventos de Lulú se priorizan notificaciones heads-up.
          </Text>
        </View>
      </GlassCard>

      <Text className="mt-6 text-center text-[10px] leading-5 text-white/25">
        Lulú Finity Mobile 1.1.2 · Expo SDK 57 · Android
      </Text>
    </Screen>
  );
}
