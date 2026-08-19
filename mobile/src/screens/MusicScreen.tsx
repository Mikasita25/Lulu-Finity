import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ExternalLink, ListMusic, Pause, Play, SkipForward, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { useMobileControlStore, type SongRequest } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';

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

export function MusicScreen() {
  const [manualQuery, setManualQuery] = useState('');
  const music = useMobileControlStore((state) => state.music);
  const queue = useMobileControlStore((state) => state.songQueue);
  const current = useMobileControlStore((state) => state.currentSong);
  const paused = useMobileControlStore((state) => state.musicPaused);
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const enqueueSong = useMobileControlStore((state) => state.enqueueSong);
  const playSong = useMobileControlStore((state) => state.playSong);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const skipCurrentSong = useMobileControlStore((state) => state.skipCurrentSong);
  const removeSong = useMobileControlStore((state) => state.removeSong);
  const clearSongQueue = useMobileControlStore((state) => state.clearSongQueue);
  const setPaused = useMobileControlStore((state) => state.setMusicPaused);

  const commands = useMemo(() => [music.command, ...music.aliases].join(' · '), [music.aliases, music.command]);

  const openSong = async (song?: SongRequest) => {
    if (!song) return;
    try {
      await Linking.openURL(youtubeSearchUrl(song.query));
    } catch (error) {
      Alert.alert('No se pudo abrir YouTube', error instanceof Error ? error.message : String(error));
    }
  };

  const startSong = async (song: SongRequest) => {
    playSong(song);
    await openSong(song);
  };

  const startNext = async () => {
    const song = playNextSong();
    if (song) await openSong(song);
  };

  const skip = async () => {
    const song = skipCurrentSong();
    if (song) await openSong(song);
  };

  const addManual = () => {
    const result = enqueueSong(manualQuery, 'streamer', 'manual');
    if (!result.ok) {
      Alert.alert('No se pudo agregar', result.reason === 'queue_full' ? 'La cola está llena.' : 'Escribe una canción o artista.');
      return;
    }
    setManualQuery('');
  };

  return (
    <Screen>
      <AppHeader title="Música" subtitle="Solicitudes de canciones y cola del LIVE desde el celular." />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/10">
              <ListMusic size={20} color="#FF9DDA" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Solicitudes del chat</Text>
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

      <SectionTitle title="Comando principal" />
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

      <SectionTitle title="Agregar manualmente" />
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
            <Button label="Agregar a la cola" onPress={addManual} icon={<ListMusic size={17} color="white" />} />
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
              <View className="mt-5 flex-row gap-2">
                <Pressable onPress={() => openSong(current)} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3">
                  <ExternalLink size={16} color="#FF9DDA" />
                  <Text className="text-xs font-black text-white">Abrir</Text>
                </Pressable>
                <Pressable onPress={skip} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3">
                  <SkipForward size={16} color="#FF9DDA" />
                  <Text className="text-xs font-black text-white">Siguiente</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text className="text-sm font-black text-white">No hay canción activa</Text>
              <Text className="mt-1 text-xs leading-5 text-white/35">La siguiente solicitud puede iniciarse desde aquí.</Text>
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
        Lulú administra la cola dentro de la app y abre la canción elegida en YouTube. “Pausar solicitudes” detiene temporalmente nuevas peticiones del chat sin borrar la cola.
      </Text>
    </Screen>
  );
}
