import { useBrowserStore } from '@/store/useBrowserStore';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Disc3,
  ListMusic,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Trash2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { MusicVolumeControl } from '@/components/MusicVolumeControl';
import {
  useMobileControlStore,
  type SongRequest,
} from '@/store/useMobileControlStore';
import { LuluSwitch } from '@/components/LuluSwitch';
import { LuluInput } from '@/components/LuluInput';
import { SettingRow } from '@/components/SettingRow';
import { StatusBadge } from '@/components/StatusBadge';
import { showLuluDialog } from '@/components/LuluDialog';
import { palette } from '@/theme/palette';

function SongRow({
  song,
  index,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  song: SongRequest;
  index: number;
  onPlay: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-white/[0.055] py-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-lulu-500/10">
        <Text className="text-xs font-black text-lulu-200">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-black text-white">
          {song.query}
        </Text>
        <Text className="mt-1 text-xs text-white/60">
          pedido por @{song.requestedBy}
        </Text>
      </View>
      <Pressable
        onPress={onMoveUp}
        disabled={index === 0}
        accessibilityLabel="Subir canción"
        className="h-10 w-9 items-center justify-center rounded-xl bg-white/[0.05] disabled:opacity-25"
      >
        <ChevronUp size={15} color="#D8CBFF" />
      </Pressable>
      <Pressable
        onPress={onMoveDown}
        accessibilityLabel="Bajar canción"
        className="h-10 w-9 items-center justify-center rounded-xl bg-white/[0.05]"
      >
        <ChevronDown size={15} color="#D8CBFF" />
      </Pressable>
      <Pressable
        onPress={onPlay}
        className="h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07]"
      >
        <Play size={16} color="#F2B7FF" fill="#F2B7FF" />
      </Pressable>
      <Pressable
        onPress={onRemove}
        className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/10"
      >
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
  const playbackMessage = useMobileControlStore(
    (state) => state.playbackMessage,
  );
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const enqueueSong = useMobileControlStore((state) => state.enqueueSong);
  const playSong = useMobileControlStore((state) => state.playSong);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const skipCurrentSong = useMobileControlStore(
    (state) => state.skipCurrentSong,
  );
  const removeSong = useMobileControlStore((state) => state.removeSong);
  const moveSong = useMobileControlStore((state) => state.moveSong);
  const clearSongQueue = useMobileControlStore((state) => state.clearSongQueue);
  const setPaused = useMobileControlStore((state) => state.setMusicPaused);
  const setPlaybackPaused = useMobileControlStore(
    (state) => state.setPlaybackPaused,
  );
  const retryCurrentSong = useMobileControlStore(
    (state) => state.retryCurrentSong,
  );

  const commands = useMemo(
    () => [music.command, ...music.aliases].join(' · '),
    [music.aliases, music.command],
  );

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
      showLuluDialog(
        'No se pudo agregar',
        result.reason === 'queue_full'
          ? 'La cola está llena.'
          : result.reason === 'duplicate'
            ? 'Esa canción ya está sonando o ya se encuentra en la cola.'
          : 'Escribe una canción o artista.',
        undefined,
        'warning',
      );
      return;
    }
    if (wasIdle) playSong(result.song);
    setManualQuery('');
  };

  return (
    <Screen>
      <AppHeader
        title="Música"
        subtitle="Reproduce canciones y recibe solicitudes del chat."
      />

      <GlassCard className="mb-4" variant="hero">
        <View className="p-5">
          <View className="flex-row items-center gap-4">
            <LinearGradient
              colors={['#D685FF', '#6F4FD8', '#242553']}
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#D685FF',
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 6,
              }}
            >
              <Disc3 size={34} color="#F7F3FF" />
            </LinearGradient>
            <View className="flex-1">
              <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-white/45">
                Ahora suena
              </Text>
              <Text
                numberOfLines={2}
                className="mt-1 text-lg font-black leading-6 text-white"
              >
                {current?.query || 'Esperando una canción'}
              </Text>
              <Text className="mt-1 text-xs text-white/50">
                {current
                  ? `pedido por @${current.requestedBy}`
                  : 'Las solicitudes aparecerán aquí'}
              </Text>
            </View>
            <StatusBadge
              label={
                playbackStatus === 'playing'
                  ? 'Sonando'
                  : playbackStatus === 'error'
                    ? 'Revisar'
                    : 'En espera'
              }
              tone={
                playbackStatus === 'playing'
                  ? 'success'
                  : playbackStatus === 'error'
                    ? 'danger'
                    : 'neutral'
              }
            />
          </View>
          <View className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <LinearGradient
              colors={['#F2B7FF', '#A762FF']}
              style={{
                width: current ? '42%' : '0%',
                height: '100%',
                borderRadius: 999,
              }}
            />
          </View>
          <View className="mt-4 flex-row items-center justify-center gap-3">
            <Pressable
              disabled={!current}
              onPress={() => setPlaybackPaused(!playbackPaused)}
              className="h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06]"
            >
              {playbackPaused ? (
                <Play size={19} color={palette.text} fill={palette.text} />
              ) : (
                <Pause size={19} color={palette.text} />
              )}
            </Pressable>
            <Pressable
              disabled={!current}
              onPress={skip}
              className="h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06]"
            >
              <SkipForward size={19} color={palette.pinkSoft} />
            </Pressable>
          </View>
          {playbackMessage ? (
            <Text className="mt-3 text-center text-[11px] leading-4 text-white/42">
              {playbackMessage}
            </Text>
          ) : null}
        </View>
      </GlassCard>

      <View className="mb-4">
        <Button
          label="Explorar YouTube"
          onPress={useBrowserStore.getState().show}
        />
      </View>

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/10">
              <ListMusic size={20} color="#F2B7FF" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">
                Permitir solicitudes del chat
              </Text>
              <Text className="mt-1 text-xs leading-5 text-white/60">
                {commands}
              </Text>
            </View>
            <LuluSwitch
              value={music.enabled}
              onValueChange={(enabled) => updateMusic({ enabled })}
              accessibilityLabel="Permitir solicitudes del chat"
            />
          </View>
          {music.enabled ? (
            <Pressable
              onPress={() => setPaused(!paused)}
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${paused ? 'bg-amber-500/15' : 'bg-white/[0.06]'}`}
            >
              {paused ? (
                <Play size={16} color="#FCD34D" fill="#FCD34D" />
              ) : (
                <Pause size={16} color="#F2B7FF" />
              )}
              <Text
                className={`text-xs font-black ${paused ? 'text-amber-200' : 'text-white/60'}`}
              >
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
          <Text className="text-sm font-black text-white">
            Reproducción tipo navegador en segundo plano
          </Text>
          <Text className="mt-1 text-xs leading-5 text-white/60">
            {music.backgroundPlayback
              ? 'Activa: conserva la sesión multimedia al cambiar de app o bloquear la pantalla.'
              : 'Desactivada: la canción se pausa cuando Lulú deja de estar visible.'}
          </Text>
        </View>
      </View>

      <SectionTitle title="Segundo plano y protección" />
      <GlassCard>
        <View className="p-5">
          <SettingRow
            title="Mantener música en segundo plano"
            subtitle="Usa el servicio multimedia de Android y muestra controles en la notificación."
            value={music.backgroundPlayback}
            onValueChange={(backgroundPlayback) =>
              updateMusic({ backgroundPlayback })
            }
          />
          <SettingRow
            title="Bloquear anuncios del reproductor"
            subtitle="Oculta promociones, overlays y destinos publicitarios dentro de Lulu‑finity."
            value={music.adBlockEnabled}
            onValueChange={(adBlockEnabled) => updateMusic({ adBlockEnabled })}
            last={!music.adBlockEnabled}
          />

          {music.adBlockEnabled ? (
            <>
              <SettingRow
                title="Saltar anuncios de video automáticamente"
                subtitle="Pulsa el botón de omitir y evita que el anuncio termine completo."
                value={music.autoSkipAds}
                onValueChange={(autoSkipAds) => updateMusic({ autoSkipAds })}
              />
              <SettingRow
                title="Bloquear enlaces externos"
                subtitle="No permite que un anuncio saque el reproductor fuera de YouTube."
                value={music.blockExternalLinks}
                onValueChange={(blockExternalLinks) =>
                  updateMusic({ blockExternalLinks })
                }
                last
              />
            </>
          ) : null}
        </View>
      </GlassCard>

      <SectionTitle title="Mezcla con la voz" />
      <GlassCard>
        <View className="p-5">
          <Text className="text-xs leading-5 text-white/60">
            La música ya no se detiene cuando habla el TTS. Elige cuánto baja
            mientras se lee el comentario.
          </Text>
          <View className="mt-4 flex-row gap-2">
            {[0.12, 0.22, 0.38, 0.55].map((volume) => (
              <Pressable
                key={volume}
                onPress={() => updateMusic({ ttsDuckingVolume: volume })}
                className={`flex-1 rounded-xl py-2.5 ${Math.abs(music.ttsDuckingVolume - volume) < 0.01 ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}
              >
                <Text
                  className={`text-center text-xs font-black ${Math.abs(music.ttsDuckingVolume - volume) < 0.01 ? 'text-white' : 'text-white/60'}`}
                >
                  {Math.round(volume * 100)}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </GlassCard>

      <SectionTitle title="Volumen" />
      <GlassCard>
        <View className="p-5">
          <Text className="text-xs leading-5 text-white/60">
            El cambio se aplica al instante a la canción de YouTube que esté
            sonando y se recuerda para las siguientes.
          </Text>
          <MusicVolumeControl />
        </View>
      </GlassCard>

      <SectionTitle title="Comando para pedir canciones" />
      <GlassCard>
        <View className="p-5">
          <LuluInput
            value={music.command}
            onChangeText={(command) => updateMusic({ command })}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="!cancion"
          />
          <Text className="mt-3 text-xs leading-5 text-white/60">
            También quedan activos !song y !sr. Ejemplo: {music.command} Die
            With A Smile. Cada persona puede retirar su última solicitud con
            !quitar o !remove.
          </Text>
        </View>
      </GlassCard>

      <SectionTitle title="Agregar una canción" />
      <GlassCard>
        <View className="p-5">
          <LuluInput
            value={manualQuery}
            onChangeText={setManualQuery}
            placeholder="Canción o artista"
            returnKeyType="done"
            onSubmitEditing={addManual}
          />
          <View className="mt-3">
            <Button
              label={current ? 'Agregar a la cola' : 'Reproducir ahora'}
              onPress={addManual}
              icon={<ListMusic size={17} color="white" />}
            />
          </View>
        </View>
      </GlassCard>

      <SectionTitle title="Ahora suena" />
      <GlassCard>
        <View className="p-5">
          {current ? (
            <>
              <Text className="text-lg font-black text-white">
                {current.query}
              </Text>
              <Text className="mt-1 text-xs text-white/60">
                pedido por @{current.requestedBy}
              </Text>

              <View
                className={`mt-4 flex-row items-center gap-2 rounded-2xl border p-3 ${playbackStatus === 'error' ? 'border-red-400/20 bg-red-500/[0.08]' : 'border-white/[0.07] bg-white/[0.035]'}`}
              >
                {playbackStatus === 'error' ? (
                  <AlertCircle size={16} color="#FDA4AF" />
                ) : (
                  <ShieldCheck
                    size={16}
                    color={playbackStatus === 'playing' ? '#86EFAC' : '#FCD34D'}
                  />
                )}
                <Text className="flex-1 text-xs leading-5 text-white/55">
                  {playbackMessage}
                </Text>
              </View>

              <Pressable
                onPress={() => setPlaybackPaused(!playbackPaused)}
                className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3 ${playbackPaused ? 'bg-emerald-500/15' : 'bg-white/[0.07]'}`}
              >
                {playbackPaused ? (
                  <Play size={16} color="#86EFAC" fill="#86EFAC" />
                ) : (
                  <Pause size={16} color="#F2B7FF" />
                )}
                <Text
                  className={`text-xs font-black ${playbackPaused ? 'text-emerald-200' : 'text-white'}`}
                >
                  {playbackPaused ? 'Reanudar música' : 'Pausar música'}
                </Text>
              </Pressable>

              <View className="mt-3 flex-row gap-2">
                <Pressable
                  onPress={() => openSong(current)}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-lulu-500/15 px-3 py-3"
                >
                  <ShieldCheck size={16} color="#F2B7FF" />
                  <Text className="text-xs font-black text-white">
                    Ver reproductor
                  </Text>
                </Pressable>
                <Pressable
                  onPress={skip}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3"
                >
                  <SkipForward size={16} color="#F2B7FF" />
                  <Text className="text-xs font-black text-white">
                    Siguiente
                  </Text>
                </Pressable>
              </View>
              {playbackStatus === 'error' ? (
                <View className="mt-3">
                  <Button
                    label="Reintentar canción"
                    compact
                    onPress={retryCurrentSong}
                    icon={<RefreshCw size={15} color="white" />}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text className="text-sm font-black text-white">
                Esperando una solicitud
              </Text>
              <Text className="mt-1 text-xs leading-5 text-white/60">
                El próximo comando válido empezará a reproducirse
                automáticamente.
              </Text>
              <View className="mt-4">
                <Button
                  label="Reproducir siguiente"
                  onPress={startNext}
                  disabled={!queue.length}
                  icon={<Play size={17} color="white" />}
                />
              </View>
            </>
          )}
        </View>
      </GlassCard>

      <SectionTitle title={`Cola · ${queue.length}/${music.maxQueue}`} />
      <GlassCard>
        <View className="px-5">
          {queue.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              onPlay={() => startSong(song)}
              onRemove={() => removeSong(song.id)}
              onMoveUp={() => moveSong(song.id, -1)}
              onMoveDown={() => moveSong(song.id, 1)}
            />
          ))}
          {!queue.length ? (
            <Text className="py-8 text-center text-xs font-semibold text-white/55">
              Esperando solicitudes…
            </Text>
          ) : null}
        </View>
      </GlassCard>

      {queue.length ? (
        <View className="mt-4">
          <Button
            label="Vaciar cola"
            variant="danger"
            onPress={clearSongQueue}
            icon={<Trash2 size={17} color="white" />}
          />
        </View>
      ) : null}

      <Text className="mt-4 text-center text-[10px] leading-5 text-white/25">
        El bloqueo solo actúa dentro del reproductor integrado de Lulu‑finity;
        no modifica otras apps ni instala certificados o VPN.
      </Text>
    </Screen>
  );
}
