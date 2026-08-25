import { Pressable, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, LoaderCircle, Pause, Play, RefreshCw, SkipForward } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { MusicVolumeControl } from '@/components/MusicVolumeControl';
import { useMobileControlStore } from '@/store/useMobileControlStore';

const statusMeta = {
  idle: { label: 'Sin canción', color: '#A99DA7', Icon: Play },
  loading: { label: 'Preparando', color: '#FCD34D', Icon: LoaderCircle },
  playing: { label: 'Reproduciendo', color: '#86EFAC', Icon: CheckCircle2 },
  paused: { label: 'En pausa', color: '#FFB8E5', Icon: Pause },
  error: { label: 'Necesita atención', color: '#FDA4AF', Icon: AlertCircle },
} as const;

export function YouTubeBrowserScreen({ route }: any) {
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const queue = useMobileControlStore((state) => state.songQueue);
  const paused = useMobileControlStore((state) => state.playbackPaused);
  const status = useMobileControlStore((state) => state.playbackStatus);
  const message = useMobileControlStore((state) => state.playbackMessage);
  const setPaused = useMobileControlStore((state) => state.setPlaybackPaused);
  const retry = useMobileControlStore((state) => state.retryCurrentSong);
  const skip = useMobileControlStore((state) => state.skipCurrentSong);
  const meta = statusMeta[status];
  const StatusIcon = meta.Icon;
  const requestedQuery = String(route?.params?.query || '').trim();

  return (
    <Screen>
      <AppHeader title="Reproductor" subtitle="La música se controla aquí sin abrir otra ventana de YouTube." />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]">
              <StatusIcon size={22} color={meta.color} />
            </View>
            <View className="flex-1">
              <Text style={{ color: meta.color }} className="text-xs font-black uppercase tracking-[1.2px]">{meta.label}</Text>
              <Text numberOfLines={2} className="mt-1 text-lg font-black text-white">
                {currentSong?.query || requestedQuery || 'Nada en reproducción'}
              </Text>
              {currentSong ? <Text className="mt-1 text-xs text-white/35">Pedido por @{currentSong.requestedBy}</Text> : null}
            </View>
          </View>

          <View className={`mt-5 rounded-2xl border p-4 ${status === 'error' ? 'border-red-400/20 bg-red-500/[0.08]' : 'border-white/[0.07] bg-white/[0.035]'}`}>
            <Text className="text-xs leading-5 text-white/55">{message}</Text>
          </View>

          <View className="mt-4 flex-row gap-2">
            <Pressable
              disabled={!currentSong}
              onPress={() => setPaused(!paused)}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3.5 ${currentSong ? 'bg-lulu-500/20' : 'bg-white/[0.03]'}`}
            >
              {paused ? <Play size={17} color="#FF9DDA" fill="#FF9DDA" /> : <Pause size={17} color="#FF9DDA" />}
              <Text className="text-xs font-black text-white">{paused ? 'Continuar' : 'Pausar'}</Text>
            </Pressable>
            <Pressable
              disabled={!queue.length}
              onPress={skip}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3.5 ${queue.length ? 'bg-white/[0.07]' : 'bg-white/[0.03]'}`}
            >
              <SkipForward size={17} color="#FF9DDA" />
              <Text className="text-xs font-black text-white">Siguiente</Text>
            </Pressable>
          </View>

          {status === 'error' && currentSong ? (
            <View className="mt-3">
              <Button label="Reintentar canción" onPress={retry} icon={<RefreshCw size={17} color="white" />} />
            </View>
          ) : null}
        </View>
      </GlassCard>

      <View className="mt-4 rounded-[20px] border border-emerald-400/15 bg-emerald-500/[0.07] p-4">
        <Text className="text-sm font-black text-white">Un solo reproductor</Text>
        <Text className="mt-1 text-xs leading-5 text-white/45">
          Lulú ya no abre una segunda página de YouTube. Así evita que dos videos compitan por el audio y se cancelen entre sí.
        </Text>
      </View>

      <MusicVolumeControl />
      <Text className="mt-5 text-center text-xs font-bold text-white/30">{queue.length} canciones esperando</Text>
    </Screen>
  );
}
