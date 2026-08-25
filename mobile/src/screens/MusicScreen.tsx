import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { AlertCircle, ListMusic, Pause, Play, RefreshCw, ShieldCheck, SkipForward, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { MusicVolumeControl } from '@/components/MusicVolumeControl';
import { useMobileControlStore, type SongRequest } from '@/store/useMobileControlStore';

function SongRow({ song, index, onPlay, onRemove }: { song: SongRequest; index: number; onPlay: () => void; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-white/[0.055] py-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-lulu-500/10">
        <Text className="text-xs font-black text-lulu-200">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-black text-white">{song.query}</Text>
        <Text className="mt-1 text-xs text-white/35">pedido por @{song.requestedBy}</Text>
      </View>
      <Pressable onPress={onPlay} className="h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07]">
        <Play size={16} color="#FF9DDA" fill="#FF9DDA" />
      </Pressable>
      <Pressable onPress={onRemove} className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
        <Trash2 size={16} color="#FCA5A5" />
      </Pressable>
    </View>
  );
}

export function MusicScreen({ navigation }: any) {
  const [manualQuery, setManualQuery] = useState('');
  const music = useMobileControlStore((state) => state.music);
  const queue = useMobileControlStore((state) => state.songQueue);
  const current = useMobileControlStore((state) => state.currentSong);
  const paused = useMobileControlStore((state) => state.musicPaused);
  const playbackPaused = useMobileControlStore((state) => state.playbackPaused);
  const playbackStatus = useMobileControlStore((state) => state.playbackStatus);
  const playbackMessage = useMobileControlStore((state) => state.playbackMessage);
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const enqueueSong = useMobileControlStore((state) => state.enqueueSong);
  const playSong = useMobileControlStore((state) => state.playSong);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const skipCurrentSong = useMobileControlStore((state) => state.skipCurrentSong);
  const removeSong = useMobileControlStore((state) => state.removeSong);
  const clearSongQueue = useMobileControlStore((state) => state.clearSongQueue);
  const setPaused = useMobileControlStore((state) => state.setMusicPaused);
  const setPlaybackPaused = useMobileControlStore((state) => state.setPlaybackPaused);
  const retryCurrentSong = useMobileControlStore((state) => state.retryCurrentSong);

  const commands = useMemo(() => [music.command, ...music.aliases].join(' · '), [music.aliases, music.command]);

  const openSong = (song?: SongRequest) => {
    if (!song) return;
    navigation.navigate('YouTubeBrowser', { query: song.query });
  };

  const startSong = (song: SongRequest) => {
    playSong(song);
  };

  const startNext = () => {
    playNextSong();
  };

  const skip = () => {
    skipCurrentSong();
  };

  const addManual = () => {
    const wasIdle = !current;
    const result = enqueueSong(manualQuery, 'streamer', 'manual');
    if (!result.ok) {
      Alert.alert('No se pudo agregar', result.reason === 'queue_full' ? 'La cola está llena.' : 'Escribe una canción o artista.');
      return;
    }
    if (wasIdle) playSong(result.song);
    setManualQuery('');
  };

  return (
    <Screen>
      <AppHeader title="Música" subtitle="Reproduce canciones y recibe solicitudes del chat." />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/10">
              <ListMusic size={20} color="#FF9DDA" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Permitir solicitudes del chat</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">{commands}</Text>
            </View>
            <Switch
              value={music.enabled}
              onValueChange={(enabled) => updateMusic({ enabled })}
              trackColor={{ false: '#342C34', true: '#FF5FC8' }}
              thumbColor="#FFF7FC"
            />
          </View>
          {music.enabled ? (
            <Pressable
              onPress={() => setPaused(!paused)}
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${paused ? 'bg-amber-500/15' : 'bg-white/[0.06]'}`}
            >
              {paused ? <Play size={16} color="#FCD34D" fill="#FCD34D" /> : <Pause size={16} color="#FF9DDA" />}
              <Text className={`text-xs font-black ${paused ? 'text-amber-200' : 'text-white/60'}`}>
                {paused ? 'Reanudar solicitudes' : 'Pausar solicitudes'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </GlassCard>

      <View className="mt-4 flex-row items-center gap-3 rounded-3xl border border-emerald-400/15 bg-emerald-500/[0.07] p-4">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10">
          <ShieldCheck size={18} color="#86EFAC" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-black text-white">Sigue sonando en segundo plano</Text>
          <Text className="mt-1 text-xs leading-5 text-white/40">
            Puedes cambiar de app o bloquear la pantalla mientras hay una canción activa.
          </Text>
        </View>
      </View>

      <SectionTitle title="Volumen" />
      <GlassCard>
        <View className="p-5">
          <Text className="text-xs leading-5 text-white/40">
            El cambio se aplica al instante a la canción de YouTube que esté sonando y se recuerda para las siguientes.
          </Text>
          <MusicVolumeControl />
        </View>
      </GlassCard>

      <SectionTitle title="Comando para pedir canciones" />
      <GlassCard>
        <View className="p-5">
          <TextInput
            value={music.command}
            onChangeText={(command) => updateMusic({ command })}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="!cancion"
            placeholderTextColor="#6D626C"
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm font-bold text-white"
          />
          <Text className="mt-3 text-xs leading-5 text-white/35">
            También quedan activos !song y !sr. Ejemplo: {music.command} Die With A Smile
          </Text>
        </View>
      </GlassCard>

      <SectionTitle title="Agregar una canción" />
      <GlassCard>
        <View className="p-5">
          <TextInput
            value={manualQuery}
            onChangeText={setManualQuery}
            placeholder="Canción o artista"
            placeholderTextColor="#6D626C"
            returnKeyType="done"
            onSubmitEditing={addManual}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm font-bold text-white"
          />
          <View className="mt-3">
            <Button label={current ? 'Agregar a la cola' : 'Reproducir ahora'} onPress={addManual} icon={<ListMusic size={17} color="white" />} />
          </View>
        </View>
      </GlassCard>

      <SectionTitle title="Ahora suena" />
      <GlassCard>
        <View className="p-5">
          {current ? (
            <>
              <Text className="text-lg font-black text-white">{current.query}</Text>
              <Text className="mt-1 text-xs text-white/35">pedido por @{current.requestedBy}</Text>

              <View className={`mt-4 flex-row items-center gap-2 rounded-2xl border p-3 ${playbackStatus === 'error' ? 'border-red-400/20 bg-red-500/[0.08]' : 'border-white/[0.07] bg-white/[0.035]'}`}>
                {playbackStatus === 'error' ? <AlertCircle size={16} color="#FDA4AF" /> : <ShieldCheck size={16} color={playbackStatus === 'playing' ? '#86EFAC' : '#FCD34D'} />}
                <Text className="flex-1 text-xs leading-5 text-white/55">{playbackMessage}</Text>
              </View>

              <Pressable
                onPress={() => setPlaybackPaused(!playbackPaused)}
                className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3 ${playbackPaused ? 'bg-emerald-500/15' : 'bg-white/[0.07]'}`}
              >
                {playbackPaused ? <Play size={16} color="#86EFAC" fill="#86EFAC" /> : <Pause size={16} color="#FF9DDA" />}
                <Text className={`text-xs font-black ${playbackPaused ? 'text-emerald-200' : 'text-white'}`}>
                  {playbackPaused ? 'Reanudar música' : 'Pausar música'}
                </Text>
              </Pressable>

              <View className="mt-3 flex-row gap-2">
                <Pressable onPress={() => openSong(current)} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-lulu-500/15 px-3 py-3">
                  <ShieldCheck size={16} color="#FF9DDA" />
                  <Text className="text-xs font-black text-white">Ver reproductor</Text>
                </Pressable>
                <Pressable onPress={skip} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3">
                  <SkipForward size={16} color="#FF9DDA" />
                  <Text className="text-xs font-black text-white">Siguiente</Text>
                </Pressable>
              </View>
              {playbackStatus === 'error' ? (
                <View className="mt-3">
                  <Button label="Reintentar canción" compact onPress={retryCurrentSong} icon={<RefreshCw size={15} color="white" />} />
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text className="text-sm font-black text-white">Esperando una solicitud</Text>
              <Text className="mt-1 text-xs leading-5 text-white/35">El próximo comando válido empezará a reproducirse automáticamente.</Text>
              <View className="mt-4">
                <Button label="Reproducir siguiente" onPress={startNext} disabled={!queue.length} icon={<Play size={17} color="white" />} />
              </View>
            </>
          )}
        </View>
      </GlassCard>

      <SectionTitle title={`Cola · ${queue.length}/${music.maxQueue}`} />
      <GlassCard>
        <View className="px-5">
          {queue.map((song, index) => (
            <SongRow key={song.id} song={song} index={index} onPlay={() => startSong(song)} onRemove={() => removeSong(song.id)} />
          ))}
          {!queue.length ? <Text className="py-8 text-center text-xs font-semibold text-white/30">Esperando solicitudes…</Text> : null}
        </View>
      </GlassCard>

      {queue.length ? (
        <View className="mt-4">
          <Button label="Vaciar cola" variant="danger" onPress={clearSongQueue} icon={<Trash2 size={17} color="white" />} />
        </View>
      ) : null}

      <Text className="mt-4 text-center text-[10px] leading-5 text-white/25">
        Android puede mostrar una notificación multimedia mientras hay una canción activa. Esto ayuda a conservar la reproducción cuando Lulú está en segundo plano.
      </Text>
    </Screen>
  );
}
