import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { FileAudio, Play, Volume2, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { pickAndPersistSound } from '@/services/soundLibrary';
import { playSound } from '@/services/audio';
import type { SoundSlot } from '@/types/live';

const slots: { id: SoundSlot; label: string; hint: string }[] = [
  { id: 'gift', label: 'Regalo', hint: 'Se reproduce al recibir un gift.' },
  { id: 'follow', label: 'Nuevo follower', hint: 'Para nuevos seguidores.' },
  { id: 'goal', label: 'Meta completada', hint: 'Sonido de celebración.' },
  { id: 'rank', label: 'Cambio de ranking', hint: 'Suena al cambiar el Top 3 del LIVE.' },
];

export function SoundsScreen() {
  const mode = useAppStore((state) => state.mode);
  const sounds = useAppStore((state) => state.soundSettings);
  const setSound = useAppStore((state) => state.setSound);
  const readonly = mode === 'spectator';

  const select = async (slot: SoundSlot) => {
    try {
      const picked = await pickAndPersistSound();
      if (picked) setSound(slot, { ...picked, enabled: true });
    } catch (error) {
      Alert.alert('No se pudo guardar el sonido', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <AppHeader title="Sonidos" subtitle="Alertas personalizadas con preview inmediato." />
      {readonly ? (
        <Text className="mb-4 rounded-2xl bg-white/[0.05] p-4 text-xs leading-5 text-white/40">
          Modo Espectador: puedes probar los sonidos, pero la configuración solo se edita en modo Streamer.
        </Text>
      ) : null}

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
                    {setting.name || 'Sin archivo personalizado'}
                  </Text>
                </View>
              </View>

              <Text className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
                Volumen
              </Text>
              <View className="flex-row gap-2">
                {[0.25, 0.5, 0.75, 1].map((volume) => (
                  <Text
                    key={volume}
                    onPress={() => !readonly && setSound(slot.id, { volume })}
                    className={`flex-1 overflow-hidden rounded-xl py-2.5 text-center text-xs font-black ${
                      Math.abs(setting.volume - volume) < 0.01
                        ? 'bg-lulu-500 text-white'
                        : 'bg-white/[0.06] text-white/40'
                    }`}
                  >
                    {Math.round(volume * 100)}%
                  </Text>
                ))}
              </View>

              <View className="mt-4 flex-row gap-2">
                {!readonly ? (
                  <View className="flex-1">
                    <Button label="Elegir archivo" compact variant="secondary" onPress={() => select(slot.id)} />
                  </View>
                ) : null}
                <View className="flex-1">
                  <Button
                    label="Preview"
                    compact
                    onPress={() => playSound(setting)}
                    icon={<Play size={15} color="white" />}
                  />
                </View>
              </View>
              {!readonly && setting.uri ? (
                <Pressable
                  onPress={() => setSound(slot.id, { uri: undefined, name: undefined })}
                  className="mt-4 flex-row items-center justify-center gap-2 py-1"
                >
                  <X size={13} color="#FCA5A5" />
                  <Text className="text-xs font-bold text-red-300/70">Quitar archivo</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>
        );
      })}
    </Screen>
  );
}
