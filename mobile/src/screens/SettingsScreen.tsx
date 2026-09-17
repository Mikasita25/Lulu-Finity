import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import {
  BellRing,
  Cable,
  RotateCcw,
  Smartphone,
  Vibrate,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { configureNotifications } from '@/services/notifications';
import { connectLive, disconnectLive } from '@/services/liveRuntime';
import { SettingRow } from '@/components/SettingRow';
import { showLuluDialog } from '@/components/LuluDialog';

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
    <SettingRow
      title={title}
      subtitle={subtitle}
      value={value}
      onValueChange={onValueChange}
      icon={icon}
    />
  );
}

export function SettingsScreen() {
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const headsUpNotifications = useAppStore(
    (state) => state.headsUpNotifications,
  );
  const relayState = useAppStore((state) => state.relayState);
  const relayMessage = useAppStore((state) => state.relayMessage);
  const username = useAppStore((state) => state.username);
  const mode = useAppStore((state) => state.mode);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const setHeadsUpNotifications = useAppStore(
    (state) => state.setHeadsUpNotifications,
  );

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
      showLuluDialog(
        'No se pudo reconectar',
        error instanceof Error ? error.message : String(error),
        undefined,
        'danger',
      );
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Ajustes"
        subtitle="Configura cómo se siente y cómo te avisa Lulú."
      />

      <SectionTitle title="Avisos del teléfono" />
      <GlassCard>
        <View className="px-5">
          <SettingSwitch
            title="Vibración"
            subtitle="Vibra suavemente con regalos, seguidores y metas."
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            icon={<Vibrate size={18} color="#F2B7FF" />}
          />
          <SettingSwitch
            title="Avisos emergentes"
            subtitle="Muestra eventos importantes aunque estés usando otra app."
            value={headsUpNotifications}
            onValueChange={toggleNotifications}
            icon={<BellRing size={18} color="#F2B7FF" />}
          />
        </View>
      </GlassCard>

      <SectionTitle title="Estado del LIVE" />
      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <Cable size={20} color="#F2B7FF" />
            <View className="flex-1">
              <Text className="text-sm font-black text-white">
                Conexión con TikTok
              </Text>
              <Text className="mt-1 text-xs text-white/60">
                {username ? `@${username}` : 'Sin cuenta configurada'} ·{' '}
                {relayState === 'connected' ? 'conectado' : 'sin conexión'}
              </Text>
            </View>
          </View>
          {relayMessage ? (
            <Text className="mt-4 text-xs leading-5 text-white/60">
              {relayMessage}
            </Text>
          ) : null}
          {mode === 'streamer' ? (
            <View className="mt-5 gap-3">
              <Button
                label="Reconectar"
                onPress={reconnect}
                icon={<RotateCcw size={17} color="white" />}
              />
              <Button
                label="Desconectar"
                variant="secondary"
                onPress={disconnectLive}
              />
            </View>
          ) : null}
        </View>
      </GlassCard>

      <SectionTitle title="Funcionamiento en segundo plano" />
      <GlassCard>
        <View className="flex-row items-start gap-3 p-5">
          <Smartphone size={21} color="#F2B7FF" />
          <Text className="flex-1 text-xs leading-5 text-white/60">
            Lulú mantiene la voz y la música activas cuando cambias de
            aplicación. En algunos teléfonos debes permitir el uso de batería en
            segundo plano desde los ajustes de Android.
          </Text>
        </View>
      </GlassCard>

      <Text className="mt-6 text-center text-[10px] leading-5 text-white/25">
        Lulú Finity 1.5.2 · Android
      </Text>
    </Screen>
  );
}
