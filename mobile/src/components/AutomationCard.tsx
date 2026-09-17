import { Pressable, Text, View } from 'react-native';
import {
  ArrowDown,
  Gift,
  MessageCircle,
  Music2,
  Play,
  Radio,
  Sparkles,
  UserPlus,
  Volume2,
} from 'lucide-react-native';
import type { InteractionRule } from '@/types/live';
import { GlassCard } from './GlassCard';
import { LuluSwitch } from './LuluSwitch';
import { palette } from '@/theme/palette';

function TriggerIcon({ type }: { type: InteractionRule['triggerType'] }) {
  const props = { size: 17, color: palette.pinkSoft };
  if (type === 'gift' || type === 'fanSticker') return <Gift {...props} />;
  if (type === 'follow' || type === 'member') return <UserPlus {...props} />;
  if (type === 'command') return <MessageCircle {...props} />;
  return <Radio {...props} />;
}

function actionLabel(rule: InteractionRule) {
  if (rule.actionType === 'sound_tts') return 'Sonido + TTS';
  return rule.actionType === 'sound' ? 'Reproducir sonido' : 'Leer con TTS';
}

export function AutomationCard({
  rule,
  triggerLabel,
  readonly,
  onToggle,
  onPreview,
  onEdit,
  onRemove,
}: {
  rule: InteractionRule;
  triggerLabel: string;
  readonly: boolean;
  onToggle: (value: boolean) => void;
  onPreview: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <GlassCard className="mb-3" variant={rule.enabled ? 'default' : 'soft'}>
      <View className="p-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-sm font-black text-white">{rule.name}</Text>
            <Text className="mt-1 text-[10px] font-bold uppercase tracking-[1px] text-white/35">
              AUTOMATIZACIÓN
            </Text>
          </View>
          <LuluSwitch
            disabled={readonly}
            value={rule.enabled}
            onValueChange={onToggle}
          />
        </View>
        <View className="mt-4 flex-row items-stretch gap-2">
          <View className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3">
            <View className="flex-row items-center gap-2">
              <TriggerIcon type={rule.triggerType} />
              <Text className="text-[9px] font-black uppercase tracking-[1px] text-white/40">
                Evento
              </Text>
            </View>
            <Text
              numberOfLines={2}
              className="mt-2 text-xs font-extrabold leading-4 text-white/80"
            >
              {triggerLabel}
            </Text>
          </View>
          <View className="items-center justify-center">
            <ArrowDown size={17} color={palette.pinkSoft} />
          </View>
          <View className="flex-1 rounded-2xl border border-lulu-300/15 bg-lulu-500/[0.08] p-3">
            <View className="flex-row items-center gap-2">
              {rule.actionType === 'tts' ? (
                <Sparkles size={16} color={palette.pinkSoft} />
              ) : rule.actionType === 'sound' ? (
                <Volume2 size={16} color={palette.pinkSoft} />
              ) : (
                <Music2 size={16} color={palette.pinkSoft} />
              )}
              <Text className="text-[9px] font-black uppercase tracking-[1px] text-white/40">
                Acción
              </Text>
            </View>
            <Text
              numberOfLines={2}
              className="mt-2 text-xs font-extrabold leading-4 text-white/80"
            >
              {actionLabel(rule)}
            </Text>
          </View>
        </View>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={onPreview}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] py-3"
          >
            <Play size={14} color={palette.pinkSoft} />
            <Text className="text-xs font-black text-white">Probar</Text>
          </Pressable>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              className="rounded-2xl bg-white/[0.055] px-4 items-center justify-center"
            >
              <Text className="text-xs font-black text-lulu-200">Editar</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable
              onPress={onRemove}
              className="rounded-2xl bg-red-500/10 px-3 items-center justify-center"
            >
              <Text className="text-xs font-black text-red-300">Borrar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}
