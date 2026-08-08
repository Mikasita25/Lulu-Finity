import { Alert, Text, View } from 'react-native';
import {
  Eye,
  Gift,
  Heart,
  MessageCircle,
  Radio,
  Share2,
  Sparkles,
  UserPlus,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { StatCard } from '@/components/StatCard';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { EventRow } from '@/components/EventRow';
import { GoalCard } from '@/components/GoalCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { compactNumber } from '@/utils/format';
import { connectLive, disconnectLive } from '@/services/liveRuntime';

export function DashboardScreen() {
  const stats = useAppStore((state) => state.stats);
  const events = useAppStore((state) => state.events);
  const goals = useAppStore((state) => state.goals);
  const relayState = useAppStore((state) => state.relayState);
  const relayMessage = useAppStore((state) => state.relayMessage);
  const username = useAppStore((state) => state.username);
  const mode = useAppStore((state) => state.mode);
  const activeGoal = goals.find((goal) => goal.enabled && !goal.completedAt) ?? goals[0];

  const reconnect = () => {
    try {
      connectLive();
    } catch (error) {
      Alert.alert('No se pudo conectar', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <AppHeader
        title={username ? `@${username}` : 'Dashboard'}
        subtitle={mode === 'streamer' ? 'Control del LIVE' : 'Vista de espectador'}
      />

      {relayState !== 'connected' ? (
        <GlassCard className="mb-4">
          <View className="p-4">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-lulu-500/20">
                <Radio size={19} color="#FF9DDA" />
              </View>
              <View className="flex-1">
                <Text className="font-black text-white">
                  {relayState === 'offline' ? 'El LIVE está offline' : 'Sin conexión estable'}
                </Text>
                <Text className="mt-1 text-xs leading-5 text-white/40">
                  {relayMessage || 'Conecta tu cuenta para comenzar a recibir eventos.'}
                </Text>
              </View>
            </View>
            {mode === 'streamer' ? (
              <View className="mt-4">
                <Button label="Reconectar" onPress={reconnect} compact />
              </View>
            ) : null}
          </View>
        </GlassCard>
      ) : null}

      <View className="flex-row flex-wrap justify-between gap-y-3">
        <StatCard label="Likes" value={compactNumber(stats.likes)} icon={<Heart size={19} color="#FF79CF" />} />
        <StatCard label="Viendo" value={compactNumber(stats.viewers)} icon={<Eye size={19} color="#FF79CF" />} />
        <StatCard label="Regalos" value={compactNumber(stats.gifts)} icon={<Gift size={19} color="#FF79CF" />} />
        <StatCard label="Diamantes" value={compactNumber(stats.diamonds)} icon={<Sparkles size={19} color="#FF79CF" />} />
        <StatCard label="Seguidores" value={compactNumber(stats.followers)} icon={<UserPlus size={19} color="#FF79CF" />} />
        <StatCard label="Compartidos" value={compactNumber(stats.shares)} icon={<Share2 size={19} color="#FF79CF" />} />
      </View>

      {activeGoal ? (
        <>
          <SectionTitle title="Meta principal" subtitle="Se actualiza con cada evento del LIVE." />
          <GoalCard goal={activeGoal} stats={stats} readonly={mode === 'spectator'} />
        </>
      ) : null}

      <SectionTitle
        title="Actividad reciente"
        subtitle={`${compactNumber(stats.comments)} comentarios registrados en esta sesión.`}
        right={<MessageCircle size={18} color="#FF9DDA" />}
      />
      <GlassCard>
        <View className="px-4">
          {events.length ? (
            events.slice(0, 8).map((event) => <EventRow key={event.id} event={event} />)
          ) : (
            <View className="items-center px-4 py-10">
              <Radio size={30} color="#6F6170" />
              <Text className="mt-3 text-sm font-bold text-white/40">Esperando eventos del LIVE…</Text>
            </View>
          )}
        </View>
      </GlassCard>

      {mode === 'streamer' && relayState === 'connected' ? (
        <View className="mt-5">
          <Button label="Desconectar LIVE" variant="secondary" onPress={disconnectLive} />
        </View>
      ) : null}
    </Screen>
  );
}
