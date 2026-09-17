import { Text, View } from 'react-native';
import { AudioLines, ChevronRight } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { GlassCard } from './GlassCard';
import { LuluSwitch } from './LuluSwitch';
import { StatusBadge } from './StatusBadge';
import { palette } from '@/theme/palette';

const bars = [10, 20, 14, 27, 18, 24, 12];

export function VoiceCard({
  active,
  subtitle,
  onToggle,
  onOpen,
  compact = false,
}: {
  active: boolean;
  subtitle: string;
  onToggle: (value: boolean) => void;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <GlassCard
      variant={active ? 'hero' : 'default'}
      style={compact ? { flex: 1 } : undefined}
    >
      <View className="p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-lulu-300/25 bg-lulu-500/15">
            <View className="flex-row items-center gap-[2px]">
              {bars.map((height, index) => (
                <View
                  key={index}
                  style={{
                    width: 2.5,
                    height,
                    borderRadius: 2,
                    backgroundColor:
                      index % 2 ? palette.pinkSoft : palette.pink,
                  }}
                />
              ))}
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-black text-white">
              Voz del chat
            </Text>
            <View className="mt-2 self-start">
              <StatusBadge
                label={active ? 'Activada' : 'Apagada'}
                tone={active ? 'success' : 'neutral'}
              />
            </View>
          </View>
          <LuluSwitch
            value={active}
            onValueChange={onToggle}
            accessibilityLabel="Voz del chat"
          />
        </View>
        <Text
          numberOfLines={compact ? 3 : undefined}
          className="mt-4 text-xs leading-5 text-white/60"
        >
          {subtitle}
        </Text>
        <Pressable
          onPress={onOpen}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-[16px] border border-white/[0.10] bg-white/[0.055] px-3 py-3"
        >
          <AudioLines size={15} color={palette.pinkSoft} />
          <Text className="text-xs font-black text-white/85">Configurar</Text>
          <ChevronRight size={14} color={palette.muted} />
        </Pressable>
      </View>
    </GlassCard>
  );
}
