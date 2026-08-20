import { Minus, Plus, Volume1, Volume2, VolumeX } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useMobileControlStore } from '@/store/useMobileControlStore';

const STEPS = Array.from({ length: 10 }, (_, index) => (index + 1) / 10);

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
    <View className={compact ? 'mt-3' : 'mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4'}>
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable
          accessibilityLabel={volume > 0 ? 'Silenciar música' : 'Subir música a 50 por ciento'}
          onPress={() => setVolume(volume > 0 ? 0 : 0.5)}
          className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]"
        >
          <Icon size={17} color="#FF9DDA" />
        </Pressable>
        <Text className="flex-1 text-xs font-black text-white">Volumen de música</Text>
        <Text className="text-xs font-black text-lulu-200">{percent}%</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel="Bajar volumen"
          onPress={() => setVolume(volume - 0.1)}
          className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]"
        >
          <Minus size={16} color="#FFF7FC" />
        </Pressable>

        <View className="flex-1 flex-row items-center gap-1">
          {STEPS.map((step) => (
            <Pressable
              key={step}
              accessibilityLabel={`Volumen ${Math.round(step * 100)} por ciento`}
              onPress={() => setVolume(step)}
              className={`h-8 flex-1 rounded-md ${volume + 0.001 >= step ? 'bg-lulu-500' : 'bg-white/10'}`}
            />
          ))}
        </View>

        <Pressable
          accessibilityLabel="Subir volumen"
          onPress={() => setVolume(volume + 0.1)}
          className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]"
        >
          <Plus size={16} color="#FFF7FC" />
        </Pressable>
      </View>
    </View>
  );
}
