import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { FileAudio, Layers3, Music2, Play, Sparkles, Volume2, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { BUILTIN_SOUNDS, installBuiltinSound, pickAndPersistSound } from '@/services/soundLibrary';
import { playSound } from '@/services/audio';
import type { SoundMixProfile, SoundSlot } from '@/types/live';

const slots: { id: SoundSlot; label: string; hint: string }[] = [
  { id: 'gift', label: 'Regalo', hint: 'Se reproduce al recibir un gift.' },
  { id: 'follow', label: 'Nuevo follower', hint: 'Para nuevos seguidores.' },
  { id: 'like', label: 'Likes', hint: 'Opcional; desactivado por defecto para evitar spam.' },
  { id: 'share', label: 'Compartido', hint: 'Cuando alguien comparte el LIVE.' },
  { id: 'comment', label: 'Comentario', hint: 'Opcional para mensajes del chat.' },
  { id: 'fanSticker', label: 'Fan Sticker', hint: 'Para uno distinto por sticker usa Automatizaciones.' },
  { id: 'member', label: 'Entrada al LIVE', hint: 'Cuando entra un espectador.' },
  { id: 'subscribe', label: 'Suscripción', hint: 'Para nuevas suscripciones del LIVE.' },
  { id: 'goal', label: 'Meta completada', hint: 'Sonido de celebración.' },
  { id: 'rank', label: 'Cambio de ranking', hint: 'Suena al cambiar el Top 3.' },
];

const profiles: { id: SoundMixProfile; label: string; hint: string }[] = [
  { id: 'soft', label: 'Suave', hint: 'Alertas discretas' },
  { id: 'balanced', label: 'Equilibrado', hint: 'Recomendado' },
  { id: 'impact', label: 'Impacto', hint: 'Más presencia' },
];

export function SoundsScreen() {
  const mode = useAppStore((state) => state.mode);
  const sounds = useAppStore((state) => state.soundSettings);
  const soundMix = useAppStore((state) => state.soundMix);
  const setSound = useAppStore((state) => state.setSound);
  const setSoundMix = useAppStore((state) => state.setSoundMix);
  const applySoundProfile = useAppStore((state) => state.applySoundProfile);
  const readonly = mode === 'spectator';

  const selectFile = async (slot: SoundSlot) => {
    try {
      const picked = await pickAndPersistSound();
      if (picked) setSound(slot, { ...picked, enabled: true });
    } catch (error) {
      Alert.alert('No se pudo guardar el sonido', error instanceof Error ? error.message : String(error));
    }
  };

  const selectBuiltin = async (slot: SoundSlot, presetId: string) => {
    try {
      const preset = BUILTIN_SOUNDS.find((item) => item.id === presetId);
      if (!preset) return;
      const installed = await installBuiltinSound(preset);
      setSound(slot, { ...installed, enabled: true });
      await playSound({ ...sounds[slot], ...installed, enabled: true });
    } catch (error) {
      Alert.alert('No se pudo preparar el sonido', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <AppHeader title="Sonidos" subtitle="Biblioteca, mezcla y alertas personalizadas." />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20">
              <Layers3 size={20} color="#FF9DDA" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Mezcla general</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">Ajusta todas las alertas sin editar una por una.</Text>
            </View>
          </View>

          <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Perfil</Text>
          <View className="flex-row gap-2">
            {profiles.map((profile) => {
              const active = soundMix.profile === profile.id;
              return (
                <Pressable
                  key={profile.id}
                  disabled={readonly}
                  onPress={() => applySoundProfile(profile.id)}
                  className={`flex-1 rounded-2xl border px-2 py-3 ${active ? 'border-lulu-300/40 bg-lulu-500/20' : 'border-white/[0.07] bg-white/[0.04]'}`}
                >
                  <Text className={`text-center text-xs font-black ${active ? 'text-lulu-100' : 'text-white/55'}`}>{profile.label}</Text>
                  <Text className="mt-1 text-center text-[9px] text-white/25">{profile.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Volumen maestro</Text>
          <View className="flex-row gap-2">
            {[0.4, 0.6, 0.8, 1].map((volume) => (
              <Pressable
                key={volume}
                disabled={readonly}
                onPress={() => setSoundMix({ masterVolume: volume })}
                className={`flex-1 rounded-xl py-2.5 ${Math.abs(soundMix.masterVolume - volume) < 0.01 ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}
              >
                <Text className={`text-center text-xs font-black ${Math.abs(soundMix.masterVolume - volume) < 0.01 ? 'text-white' : 'text-white/40'}`}>
                  {Math.round(volume * 100)}%
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="mt-5 flex-row items-center gap-3 border-t border-white/[0.06] pt-4">
            <Music2 size={18} color="#FF9DDA" />
            <View className="flex-1">
              <Text className="text-xs font-black text-white">Bajar música durante alertas</Text>
              <Text className="mt-1 text-[10px] leading-4 text-white/35">La canción continúa; solo reduce su volumen temporalmente.</Text>
            </View>
            <Switch
              disabled={readonly}
              value={soundMix.duckMusic}
              onValueChange={(duckMusic) => setSoundMix({ duckMusic })}
              trackColor={{ false: '#342C34', true: '#FF5FC8' }}
              thumbColor="#FFF7FC"
            />
          </View>

          <View className="mt-4 flex-row items-center gap-3">
            <Sparkles size={18} color="#C4B5FD" />
            <View className="flex-1">
              <Text className="text-xs font-black text-white">Permitir sonidos simultáneos</Text>
              <Text className="mt-1 text-[10px] leading-4 text-white/35">Útil para LIVE rápidos; el perfil Impacto lo activa.</Text>
            </View>
            <Switch
              disabled={readonly}
              value={soundMix.allowOverlap}
              onValueChange={(allowOverlap) => setSoundMix({ allowOverlap })}
              trackColor={{ false: '#342C34', true: '#8B5CF6' }}
              thumbColor="#FFF7FC"
            />
          </View>
        </View>
      </GlassCard>

      {readonly ? (
        <Text className="mb-4 mt-4 rounded-2xl bg-white/[0.05] p-4 text-xs leading-5 text-white/40">
          Modo Espectador: puedes probar los sonidos, pero la configuración solo se edita en modo Streamer.
        </Text>
      ) : null}

      <Text className="mb-3 mt-6 text-xs font-black uppercase tracking-[1.5px] text-white/35">Sonido por evento</Text>
      {slots.map((slot) => {
        const setting = sounds[slot.id];
        return (
          <GlassCard key={slot.id} className="mb-3">
            <View className="p-5">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20">
                  <Volume2 size={19} color="#FF9DDA" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-white">{slot.label}</Text>
                  <Text className="mt-1 text-xs leading-5 text-white/40">{slot.hint}</Text>
                </View>
                <Switch
                  disabled={readonly}
                  value={setting.enabled}
                  onValueChange={(enabled) => setSound(slot.id, { enabled })}
                  trackColor={{ false: '#342C34', true: '#FF5FC8' }}
                  thumbColor="#FFF7FC"
                />
              </View>

              <View className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                <View className="flex-row items-center gap-2">
                  <FileAudio size={17} color="#FF9DDA" />
                  <Text className="flex-1 text-xs font-bold text-white/60" numberOfLines={1}>
                    {setting.name || 'Elige uno de la biblioteca o tu archivo'}
                  </Text>
                </View>
              </View>

              {!readonly ? (
                <>
                  <Text className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Biblioteca incluida</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {BUILTIN_SOUNDS.map((preset) => {
                      const active = setting.presetId === preset.id;
                      return (
                        <Pressable
                          key={preset.id}
                          onPress={() => selectBuiltin(slot.id, preset.id)}
                          className={`rounded-xl border px-3 py-2.5 ${active ? 'border-lulu-300/40 bg-lulu-500/20' : 'border-white/[0.07] bg-white/[0.045]'}`}
                        >
                          <Text className={`text-[10px] font-black ${active ? 'text-lulu-100' : 'text-white/50'}`}>{preset.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Volumen del evento</Text>
              <View className="flex-row gap-2">
                {[0.25, 0.5, 0.75, 1].map((volume) => (
                  <Pressable
                    key={volume}
                    disabled={readonly}
                    onPress={() => setSound(slot.id, { volume })}
                    className={`flex-1 rounded-xl py-2.5 ${Math.abs(setting.volume - volume) < 0.01 ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}
                  >
                    <Text className={`text-center text-xs font-black ${Math.abs(setting.volume - volume) < 0.01 ? 'text-white' : 'text-white/40'}`}>
                      {Math.round(volume * 100)}%
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="mt-4 flex-row gap-2">
                {!readonly ? (
                  <View className="flex-1">
                    <Button label="Mi archivo" compact variant="secondary" onPress={() => selectFile(slot.id)} />
                  </View>
                ) : null}
                <View className="flex-1">
                  <Button label="Probar" compact onPress={() => playSound(setting)} icon={<Play size={15} color="white" />} />
                </View>
              </View>

              {!readonly && setting.uri ? (
                <Pressable
                  onPress={() => setSound(slot.id, { uri: undefined, name: 'Sin sonido', presetId: undefined })}
                  className="mt-4 flex-row items-center justify-center gap-2 py-1"
                >
                  <X size={13} color="#FCA5A5" />
                  <Text className="text-xs font-bold text-red-300/70">Quitar sonido</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>
        );
      })}
    </Screen>
  );
}
