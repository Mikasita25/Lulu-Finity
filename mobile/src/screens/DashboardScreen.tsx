import { Text, useWindowDimensions, View } from 'react-native';
import {
  Gamepad2,
  Music2,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { LiveConnectionCard } from '@/components/LiveConnectionCard';
import { useAppStore } from '@/store/useAppStore';
import { useTtsStore } from '@/store/useTtsStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { stopTts } from '@/services/tts';
import { VoiceCard } from '@/components/VoiceCard';
import { MusicCard } from '@/components/MusicCard';
import { StatusBadge } from '@/components/StatusBadge';
import { palette } from '@/theme/palette';

function StatusRow({
  label,
  value,
  active,
  last = false,
}: {
  label: string;
  value: string;
  active: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 py-3.5 ${last ? '' : 'border-b border-white/[0.055]'}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
        {label === 'TikTok LIVE' ? (
          <Radio size={17} color={active ? palette.success : palette.muted} />
        ) : label.includes('Voz') ? (
          <Sparkles
            size={17}
            color={active ? palette.success : palette.muted}
          />
        ) : (
          <Music2 size={17} color={active ? palette.success : palette.muted} />
        )}
      </View>
      <Text className="flex-1 text-sm font-bold text-white/75">{label}</Text>
      <StatusBadge label={value} tone={active ? 'success' : 'neutral'} />
    </View>
  );
}

export function DashboardScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const username = useAppStore((state) => state.username);
  const relayState = useAppStore((state) => state.relayState);
  const ttsEnabled = useTtsStore((state) => state.enabled);
  const updateTts = useTtsStore((state) => state.updateTts);
  const music = useMobileControlStore((state) => state.music);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const songQueue = useMobileControlStore((state) => state.songQueue);
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const connected = relayState === 'connected';
  const sideBySide = width >= 390;

  const toggleTts = async (enabled: boolean) => {
    updateTts({ enabled });
    if (!enabled) await stopTts().catch(() => {});
  };

  return (
    <Screen>
      <AppHeader
        title="Centro de control"
        subtitle={
          connected
            ? `@${username} está conectado. Puedes volver a tu juego.`
            : 'Conecta tu LIVE y deja listas la voz y la música.'
        }
      />

      <LiveConnectionCard />

      <SectionTitle
        title="Lo esencial"
        subtitle="Activa solo lo que necesitas y deja que Lulú trabaje mientras juegas."
      />
      <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: 12 }}>
        <VoiceCard
          compact={sideBySide}
          active={ttsEnabled}
          onToggle={(enabled) => void toggleTts(enabled)}
          onOpen={() => navigation.navigate('TTS')}
          subtitle="Lee comentarios recientes con las voces Microsoft que ya conoces."
        />
        <MusicCard
          compact={sideBySide}
          active={music.enabled}
          current={currentSong?.query}
          queueCount={songQueue.length}
          onToggle={(enabled) => updateMusic({ enabled })}
          onOpen={() => navigation.navigate('Music')}
        />
      </View>

      <SectionTitle
        title="Antes de volver al juego"
        subtitle="Comprueba estos tres estados de un vistazo."
      />
      <GlassCard variant="soft">
        <View className="px-5">
          <StatusRow
            label="TikTok LIVE"
            value={connected ? 'CONECTADO' : 'DESCONECTADO'}
            active={connected}
          />
          <StatusRow
            label="Voz del chat"
            value={ttsEnabled ? 'ACTIVA' : 'APAGADA'}
            active={ttsEnabled}
          />
          <StatusRow
            label="Solicitudes de música"
            value={music.enabled ? 'ACTIVAS' : 'APAGADAS'}
            active={music.enabled}
            last
          />
        </View>
      </GlassCard>

      <GlassCard className="mt-4" variant="mint">
        <View className="flex-row items-start gap-3 p-4">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10">
            {connected ? (
              <ShieldCheck size={20} color="#86EFAC" />
            ) : (
              <Radio size={20} color="#86EFAC" />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Gamepad2 size={15} color="#86EFAC" />
              <Text className="text-sm font-black text-white">
                Diseñado para segundo plano
              </Text>
            </View>
            <Text className="mt-1 text-xs leading-5 text-white/60">
              Cuando el LIVE esté conectado, puedes cambiar de aplicación. La
              notificación de Lulú confirma que sigue activa.
            </Text>
          </View>
        </View>
      </GlassCard>
    </Screen>
  );
}
