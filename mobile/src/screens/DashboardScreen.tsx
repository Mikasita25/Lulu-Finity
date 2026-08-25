import type { ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { AudioLines, ChevronRight, Gamepad2, ListMusic, Radio, ShieldCheck } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { LiveConnectionCard } from '@/components/LiveConnectionCard';
import { useAppStore } from '@/store/useAppStore';
import { useTtsStore } from '@/store/useTtsStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { stopTts } from '@/services/tts';
import { accentByTheme } from '@/theme/palette';

function MainControl({
  title,
  subtitle,
  status,
  active,
  onToggle,
  onOpen,
  icon,
  accent,
}: {
  title: string;
  subtitle: string;
  status: string;
  active: boolean;
  onToggle: (value: boolean) => void;
  onOpen: () => void;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <GlassCard className="mb-3">
      <View className="p-5">
        <View className="flex-row items-center gap-3">
          <View style={{ backgroundColor: `${accent}18` }} className="h-12 w-12 items-center justify-center rounded-2xl">
            {icon}
          </View>
          <View className="flex-1">
            <Text className="text-base font-black text-white">{title}</Text>
            <Text className={`mt-1 text-xs font-bold ${active ? 'text-emerald-300' : 'text-white/35'}`}>{status}</Text>
          </View>
          <Switch
            accessibilityLabel={`${active ? 'Desactivar' : 'Activar'} ${title}`}
            value={active}
            onValueChange={onToggle}
            trackColor={{ false: '#342C34', true: accent }}
            thumbColor="#FFF7FC"
          />
        </View>
        <Text className="mt-4 text-xs leading-5 text-white/40">{subtitle}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3"
        >
          <Text className="text-xs font-black text-white">Configurar</Text>
          <ChevronRight size={15} color="#FFF7FC" />
        </Pressable>
      </View>
    </GlassCard>
  );
}

function StatusRow({ label, value, active, last = false }: { label: string; value: string; active: boolean; last?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 py-3.5 ${last ? '' : 'border-b border-white/[0.055]'}`}>
      <View className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/20'}`} />
      <Text className="flex-1 text-sm font-bold text-white/65">{label}</Text>
      <Text className={`text-xs font-black ${active ? 'text-emerald-300' : 'text-white/30'}`}>{value}</Text>
    </View>
  );
}

export function DashboardScreen({ navigation }: any) {
  const username = useAppStore((state) => state.username);
  const relayState = useAppStore((state) => state.relayState);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const ttsEnabled = useTtsStore((state) => state.enabled);
  const updateTts = useTtsStore((state) => state.updateTts);
  const music = useMobileControlStore((state) => state.music);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const songQueue = useMobileControlStore((state) => state.songQueue);
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const accent = accentByTheme[accentTheme];
  const connected = relayState === 'connected';

  const toggleTts = async (enabled: boolean) => {
    updateTts({ enabled });
    if (!enabled) await stopTts().catch(() => {});
  };

  return (
    <Screen>
      <AppHeader
        title="Centro de control"
        subtitle={connected ? `@${username} está conectado. Puedes volver a tu juego.` : 'Conecta tu LIVE y deja listas la voz y la música.'}
      />

      <LiveConnectionCard />

      <SectionTitle title="Lo esencial" subtitle="Activa lo que necesitas y deja Lulú trabajando en segundo plano." />
      <MainControl
        title="Voz del chat"
        subtitle="Lee únicamente comentarios recientes usando las voces de Microsoft."
        status={ttsEnabled ? 'Activada' : 'Desactivada'}
        active={ttsEnabled}
        onToggle={(enabled) => void toggleTts(enabled)}
        onOpen={() => navigation.navigate('TTS')}
        icon={<AudioLines size={22} color={accent} />}
        accent={accent}
      />
      <MainControl
        title="Música"
        subtitle={currentSong ? `Sonando: ${currentSong.query}` : 'Reproduce música y acepta solicitudes del chat.'}
        status={music.enabled ? `${songQueue.length} en cola` : 'Desactivada'}
        active={music.enabled}
        onToggle={(enabled) => updateMusic({ enabled })}
        onOpen={() => navigation.navigate('Music')}
        icon={<ListMusic size={22} color={accent} />}
        accent={accent}
      />

      <SectionTitle title="Antes de volver al juego" subtitle="Comprueba estos tres estados de un vistazo." />
      <GlassCard>
        <View className="px-5">
          <StatusRow label="TikTok LIVE" value={connected ? 'CONECTADO' : 'DESCONECTADO'} active={connected} />
          <StatusRow label="Voz del chat" value={ttsEnabled ? 'ACTIVA' : 'APAGADA'} active={ttsEnabled} />
          <StatusRow label="Solicitudes de música" value={music.enabled ? 'ACTIVAS' : 'APAGADAS'} active={music.enabled} last />
        </View>
      </GlassCard>

      <View className="mt-4 flex-row items-start gap-3 rounded-3xl border border-emerald-400/15 bg-emerald-500/[0.07] p-4">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10">
          {connected ? <ShieldCheck size={20} color="#86EFAC" /> : <Radio size={20} color="#86EFAC" />}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Gamepad2 size={15} color="#86EFAC" />
            <Text className="text-sm font-black text-white">Diseñado para segundo plano</Text>
          </View>
          <Text className="mt-1 text-xs leading-5 text-white/40">
            Cuando el LIVE esté conectado, puedes cambiar de aplicación. La notificación de Lulú confirma que sigue activa.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
