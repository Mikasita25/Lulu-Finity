import { Pressable, Text, View } from 'react-native';
import {
  AudioLines,
  Eye,
  Gift,
  Heart,
  ListMusic,
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
import { LiveConnectionCard } from '@/components/LiveConnectionCard';
import { useAppStore } from '@/store/useAppStore';
import { compactNumber } from '@/utils/format';
import { useTtsStore } from '@/store/useTtsStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { accentByTheme } from '@/theme/palette';

export function DashboardScreen({ navigation }: any) {
  const stats = useAppStore((state) => state.stats);
  const events = useAppStore((state) => state.events);
  const goals = useAppStore((state) => state.goals);
  const username = useAppStore((state) => state.username);
  const mode = useAppStore((state) => state.mode);
  const relayState = useAppStore((state) => state.relayState);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const ttsEnabled = useTtsStore((state) => state.enabled);
  const musicEnabled = useMobileControlStore((state) => state.music.enabled);
  const accent = accentByTheme[accentTheme];
  const activeGoal = goals.find((goal) => goal.enabled && !goal.completedAt) ?? goals[0];

  return (
    <Screen>
      <AppHeader
        title={username ? `@${username}` : 'Inicio'}
        subtitle={relayState === 'connected' ? 'Tu transmisión está conectada y recibiendo eventos.' : 'Conecta tu transmisión para comenzar.'}
      />

      <LiveConnectionCard />

      <SectionTitle title="Accesos rápidos" subtitle="Lo que más usas durante el LIVE." />
      <View className="mb-1 flex-row gap-3">
        <Pressable onPress={() => navigation.navigate('TTS')} className="flex-1 rounded-[20px] border border-white/[0.08] bg-[#17121B] p-4">
          <View style={{ backgroundColor: `${accent}18` }} className="h-10 w-10 items-center justify-center rounded-xl"><AudioLines size={19} color={accent} /></View>
          <Text className="mt-3 text-sm font-black text-white">Voz del chat</Text>
          <Text className="mt-1 text-xs text-white/40">{ttsEnabled ? 'Activada' : 'Desactivada'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Music')} className="flex-1 rounded-[20px] border border-white/[0.08] bg-[#17121B] p-4">
          <View style={{ backgroundColor: `${accent}18` }} className="h-10 w-10 items-center justify-center rounded-xl"><ListMusic size={19} color={accent} /></View>
          <Text className="mt-3 text-sm font-black text-white">Música</Text>
          <Text className="mt-1 text-xs text-white/40">{musicEnabled ? 'Solicitudes activas' : 'Desactivada'}</Text>
        </Pressable>
      </View>

      <SectionTitle title="Resumen del LIVE" subtitle="Las cifras se actualizan en tiempo real." />
      <View className="flex-row flex-wrap justify-between gap-y-3">
        <StatCard label="Me gusta" value={compactNumber(stats.likes)} icon={<Heart size={19} color={accent} />} />
        <StatCard label="Espectadores" value={compactNumber(stats.viewers)} icon={<Eye size={19} color={accent} />} />
        <StatCard label="Regalos" value={compactNumber(stats.gifts)} icon={<Gift size={19} color={accent} />} />
        <StatCard label="Diamantes" value={compactNumber(stats.diamonds)} icon={<Sparkles size={19} color={accent} />} />
        <StatCard label="Nuevos seguidores" value={compactNumber(stats.followers)} icon={<UserPlus size={19} color={accent} />} />
        <StatCard label="Veces compartido" value={compactNumber(stats.shares)} icon={<Share2 size={19} color={accent} />} />
      </View>

      {activeGoal ? (
        <>
          <SectionTitle title="Meta principal" subtitle="Se actualiza con cada evento del LIVE." />
          <GoalCard goal={activeGoal} stats={stats} readonly={mode === 'spectator'} />
        </>
      ) : null}

      <SectionTitle
        title="Actividad reciente"
        subtitle={`${compactNumber(stats.comments)} comentarios recibidos en esta sesión.`}
        right={<MessageCircle size={18} color={accent} />}
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
    </Screen>
  );
}
