import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Music2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { LuluSwitch } from './LuluSwitch';
import { StatusBadge } from './StatusBadge';
import { palette } from '@/theme/palette';

export function MusicCard({
  active,
  current,
  queueCount,
  onToggle,
  onOpen,
  compact = false,
}: {
  active: boolean;
  current?: string;
  queueCount: number;
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
          <LinearGradient
            colors={['rgba(214,133,255,0.45)', 'rgba(111,79,216,0.36)']}
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(242,183,255,0.24)',
            }}
          >
            <Music2 size={23} color={palette.pinkSoft} />
          </LinearGradient>
          <View className="flex-1">
            <Text className="text-[15px] font-black text-white">Música</Text>
            <View className="mt-2 self-start">
              <StatusBadge
                label={active ? `${queueCount} en cola` : 'Apagada'}
                tone={active ? 'success' : 'neutral'}
              />
            </View>
          </View>
          <LuluSwitch
            value={active}
            onValueChange={onToggle}
            accessibilityLabel="Música"
          />
        </View>
        <Text
          numberOfLines={compact ? 3 : undefined}
          className="mt-4 text-xs leading-5 text-white/60"
        >
          {current
            ? `Sonando: ${current}`
            : 'Acepta solicitudes de tu comunidad y mantiene la música en segundo plano.'}
        </Text>
        <Pressable
          onPress={onOpen}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-[16px] border border-white/[0.10] bg-white/[0.055] px-3 py-3"
        >
          <Music2 size={15} color={palette.pinkSoft} />
          <Text className="text-xs font-black text-white/85">Configurar</Text>
          <ChevronRight size={14} color={palette.muted} />
        </Pressable>
      </View>
    </GlassCard>
  );
}
