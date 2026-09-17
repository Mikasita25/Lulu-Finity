import { Volume1, Volume2, VolumeX } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { LuluSlider } from './LuluSlider';
import { palette } from '@/theme/palette';

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function MusicVolumeControl({ compact = false }: { compact?: boolean }) {
  const volume = useMobileControlStore((state) => state.music.volume);
  const updateMusic = useMobileControlStore((state) => state.updateMusic);
  const percent = Math.round(volume * 100);
  const Icon = volume <= 0 ? VolumeX : volume < 0.55 ? Volume1 : Volume2;

  const setVolume = (next: number) => updateMusic({ volume: clamp(next) });

  return (
    <View
      className={
        compact
          ? 'mt-3'
          : 'mt-4 rounded-[20px] border border-white/[0.08] bg-white/[0.04] p-4'
      }
    >
      <View className="mb-4 flex-row items-center gap-2">
        <Pressable
          accessibilityLabel={
            volume > 0 ? 'Silenciar música' : 'Subir música a 50 por ciento'
          }
          onPress={() => setVolume(volume > 0 ? 0 : 0.5)}
          className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]"
        >
          <Icon size={17} color={palette.pinkSoft} />
        </Pressable>
        <Text className="flex-1 text-xs font-black text-white">
          Volumen de música
        </Text>
        <Text className="text-xs font-black text-lulu-200">{percent}%</Text>
      </View>

      <LuluSlider
        value={volume}
        onValueChange={setVolume}
        step={0.05}
        decreaseLabel="Bajar volumen"
        increaseLabel="Subir volumen"
      />
    </View>
  );
}
