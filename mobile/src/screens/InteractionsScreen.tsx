import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { FileAudio, Pencil, Play, Plus, Sparkles, Trash2, Zap } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { pickAndPersistSound } from '@/services/soundLibrary';
import { previewRule } from '@/services/interactions';
import type { InteractionActionType, InteractionRule, InteractionTriggerType, MatchMode, SoundSetting } from '@/types/live';

type Draft = {
  name: string;
  triggerType: InteractionTriggerType;
  triggerValue: string;
  matchMode: MatchMode;
  actionType: InteractionActionType;
  sound: SoundSetting;
  ttsText: string;
  cooldownSeconds: number;
};

const triggerOptions: { id: InteractionTriggerType; label: string; needsValue: boolean }[] = [
  { id: 'command', label: 'Comando', needsValue: true },
  { id: 'fanSticker', label: 'Fan Sticker', needsValue: true },
  { id: 'gift', label: 'Regalo', needsValue: true },
  { id: 'follow', label: 'Follow', needsValue: false },
  { id: 'share', label: 'Share', needsValue: false },
  { id: 'subscribe', label: 'Suscripción', needsValue: false },
  { id: 'member', label: 'Entrada', needsValue: false },
];

const actionOptions: { id: InteractionActionType; label: string }[] = [
  { id: 'sound', label: 'Sonido' },
  { id: 'tts', label: 'TTS' },
  { id: 'sound_tts', label: 'Sonido + TTS' },
];

function blankDraft(): Draft {
  return {
    name: '',
    triggerType: 'command',
    triggerValue: '!hola',
    matchMode: 'exact',
    actionType: 'sound',
    sound: { enabled: true, volume: 0.9 },
    ttsText: 'Gracias {name}',
    cooldownSeconds: 3,
  };
}

function triggerLabel(rule: InteractionRule) {
  if (rule.triggerType === 'command') return rule.triggerValue || '!comando';
  if (rule.triggerType === 'fanSticker') return `Fan Sticker: ${rule.triggerValue || 'cualquiera'}`;
  if (rule.triggerType === 'gift') return `Regalo: ${rule.triggerValue || 'cualquiera'}`;
  return triggerOptions.find((item) => item.id === rule.triggerType)?.label ?? rule.triggerType;
}

export function InteractionsScreen() {
  const mode = useAppStore((state) => state.mode);
  const rules = useAppStore((state) => state.interactionRules);
  const addRule = useAppStore((state) => state.addInteractionRule);
  const updateRule = useAppStore((state) => state.updateInteractionRule);
  const removeRule = useAppStore((state) => state.removeInteractionRule);
  const readonly = mode === 'spectator';
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const triggerMeta = useMemo(
    () => triggerOptions.find((item) => item.id === draft.triggerType) ?? triggerOptions[0]!,
    [draft.triggerType],
  );
  const wantsSound = draft.actionType === 'sound' || draft.actionType === 'sound_tts';
  const wantsTts = draft.actionType === 'tts' || draft.actionType === 'sound_tts';
  const patchDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const chooseSound = async () => {
    try {
      const picked = await pickAndPersistSound();
      if (picked) patchDraft('sound', { ...draft.sound, ...picked, enabled: true });
    } catch (error) {
      Alert.alert('No se pudo guardar el sonido', error instanceof Error ? error.message : String(error));
    }
  };

  const normalizedDraft = (): Omit<InteractionRule, 'id' | 'lastTriggeredAt'> => {
    let triggerValue = draft.triggerValue.trim();
    if (draft.triggerType === 'command' && triggerValue && !triggerValue.startsWith('!')) triggerValue = `!${triggerValue}`;
    const name = draft.name.trim() || (draft.triggerType === 'fanSticker' ? `Fan Sticker ${triggerValue}` : triggerValue || triggerMeta.label);
    return {
      name,
      enabled: true,
      triggerType: draft.triggerType,
      triggerValue: triggerMeta.needsValue ? triggerValue : '',
      matchMode: draft.matchMode,
      actionType: draft.actionType,
      sound: wantsSound ? { ...draft.sound, enabled: true } : undefined,
      ttsText: wantsTts ? draft.ttsText.trim() : undefined,
      cooldownSeconds: draft.cooldownSeconds,
    };
  };

  const validate = () => {
    if (triggerMeta.needsValue && !draft.triggerValue.trim()) {
      Alert.alert('Falta el disparador', draft.triggerType === 'fanSticker' ? 'Escribe el nombre o ID del Fan Sticker.' : 'Escribe el comando o nombre del regalo.');
      return false;
    }
    if (wantsSound && !draft.sound.uri) {
      Alert.alert('Falta el sonido', 'Elige un archivo de audio para esta automatización.');
      return false;
    }
    if (wantsTts && !draft.ttsText.trim()) {
      Alert.alert('Falta el texto TTS', 'Escribe lo que debe decir Lulú.');
      return false;
    }
    return true;
  };

  const save = () => {
    if (readonly || !validate()) return;
    const next = normalizedDraft();
    if (editingId) updateRule(editingId, next);
    else addRule(next);
    setEditingId(null);
    setDraft(blankDraft());
  };

  const edit = (rule: InteractionRule) => {
    setEditingId(rule.id);
    setDraft({
      name: rule.name,
      triggerType: rule.triggerType,
      triggerValue: rule.triggerValue,
      matchMode: rule.matchMode,
      actionType: rule.actionType,
      sound: rule.sound ?? { enabled: true, volume: 0.9 },
      ttsText: rule.ttsText ?? 'Gracias {name}',
      cooldownSeconds: rule.cooldownSeconds,
    });
  };

  return (
    <Screen>
      <AppHeader title="Automatizaciones" subtitle="Comandos, Fan Stickers y eventos del LIVE." />
      <GlassCard className="mb-4">
        <View className="p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20"><Zap size={20} color="#FF9DDA" /></View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Actions & Events móvil</Text>
              <Text className="mt-1 text-xs leading-5 text-white/45">Crea comandos como !hola o haz que un Fan Sticker específico reproduzca un audio, diga un TTS o haga ambas cosas.</Text>
            </View>
          </View>
          <View className="mt-4 rounded-2xl bg-white/[0.045] p-4">
            <Text className="text-xs font-bold leading-5 text-white/45">Variables TTS: {'{name}'} · {'{user}'} · {'{comment}'} · {'{fanSticker}'} · {'{gift}'} · {'{count}'}</Text>
          </View>
        </View>
      </GlassCard>

      {!readonly ? (
        <GlassCard className="mb-5">
          <View className="p-5">
            <Text className="text-base font-black text-white">{editingId ? 'Editar automatización' : 'Nueva automatización'}</Text>
            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Nombre</Text>
            <TextInput value={draft.name} onChangeText={(value) => patchDraft('name', value)} placeholder="Ej. Fan Sticker corazón" placeholderTextColor="#625965" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm font-bold text-white" />

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Disparador</Text>
            <View className="flex-row flex-wrap gap-2">
              {triggerOptions.map((option) => (
                <Pressable key={option.id} onPress={() => patchDraft('triggerType', option.id)} className={`rounded-xl px-3.5 py-2.5 ${draft.triggerType === option.id ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}>
                  <Text className={`text-xs font-black ${draft.triggerType === option.id ? 'text-white' : 'text-white/45'}`}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            {triggerMeta.needsValue ? (
              <>
                <TextInput
                  value={draft.triggerValue}
                  onChangeText={(value) => patchDraft('triggerValue', value)}
                  autoCapitalize="none"
                  placeholder={draft.triggerType === 'command' ? '!hola' : draft.triggerType === 'fanSticker' ? 'Nombre o ID del Fan Sticker' : 'Nombre del regalo'}
                  placeholderTextColor="#625965"
                  className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm font-bold text-white"
                />
                {draft.triggerType === 'fanSticker' ? (
                  <View className="mt-3 flex-row gap-2 rounded-2xl bg-lulu-500/10 p-3">
                    <Sparkles size={16} color="#FF9DDA" />
                    <Text className="flex-1 text-xs leading-5 text-white/45">Conecta el LIVE y abre Historial → Fan Stickers para ver el nombre e ID exactos que TikTok envía.</Text>
                  </View>
                ) : null}
                <View className="mt-3 flex-row gap-2">
                  {(['exact', 'contains'] as MatchMode[]).map((match) => (
                    <Pressable key={match} onPress={() => patchDraft('matchMode', match)} className={`flex-1 rounded-xl py-2.5 ${draft.matchMode === match ? 'bg-white/15' : 'bg-white/[0.045]'}`}>
                      <Text className="text-center text-xs font-black text-white/60">{match === 'exact' ? 'Coincide exacto' : 'Contiene'}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Acción</Text>
            <View className="flex-row gap-2">
              {actionOptions.map((option) => (
                <Pressable key={option.id} onPress={() => patchDraft('actionType', option.id)} className={`flex-1 rounded-xl px-2 py-3 ${draft.actionType === option.id ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}>
                  <Text className="text-center text-[11px] font-black text-white">{option.label}</Text>
                </Pressable>
              ))}
            </View>

            {wantsSound ? (
              <View className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <View className="flex-row items-center gap-2"><FileAudio size={17} color="#FF9DDA" /><Text className="flex-1 text-xs font-bold text-white/60" numberOfLines={1}>{draft.sound.name || 'Sin sonido seleccionado'}</Text></View>
                <View className="mt-3 flex-row gap-2">
                  <View className="flex-1"><Button label="Elegir audio" compact variant="secondary" onPress={chooseSound} /></View>
                  {draft.sound.uri ? <View className="flex-1"><Button label="Probar" compact onPress={() => previewRule({ ...normalizedDraft(), id: editingId ?? 'preview' })} icon={<Play size={14} color="white" />} /></View> : null}
                </View>
                <View className="mt-3 flex-row gap-2">
                  {[0.25, 0.5, 0.75, 1].map((volume) => (
                    <Pressable key={volume} onPress={() => patchDraft('sound', { ...draft.sound, volume })} className={`flex-1 rounded-xl py-2.5 ${Math.abs(draft.sound.volume - volume) < 0.01 ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}>
                      <Text className="text-center text-xs font-black text-white">{Math.round(volume * 100)}%</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {wantsTts ? <TextInput value={draft.ttsText} onChangeText={(value) => patchDraft('ttsText', value)} multiline placeholder="Gracias {name} por usar {fanSticker}" placeholderTextColor="#625965" className="mt-4 min-h-[88px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm font-bold text-white" /> : null}

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">Cooldown</Text>
            <View className="flex-row gap-2">
              {[0, 3, 5, 10, 30].map((seconds) => (
                <Pressable key={seconds} onPress={() => patchDraft('cooldownSeconds', seconds)} className={`flex-1 rounded-xl py-2.5 ${draft.cooldownSeconds === seconds ? 'bg-white/15' : 'bg-white/[0.045]'}`}>
                  <Text className="text-center text-xs font-black text-white/60">{seconds}s</Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-5 flex-row gap-2">
              <View className="flex-1"><Button label={editingId ? 'Guardar cambios' : 'Crear regla'} onPress={save} icon={<Plus size={16} color="white" />} /></View>
              {editingId ? <View className="flex-1"><Button label="Cancelar" variant="secondary" onPress={() => { setEditingId(null); setDraft(blankDraft()); }} /></View> : null}
            </View>
          </View>
        </GlassCard>
      ) : null}

      <Text className="mb-3 text-xs font-black uppercase tracking-[1.5px] text-white/30">Reglas activas · {rules.length}</Text>
      {rules.map((rule) => (
        <GlassCard key={rule.id} className="mb-3">
          <View className="p-4">
            <View className="flex-row items-center gap-3">
              <View className="flex-1"><Text className="text-sm font-black text-white">{rule.name}</Text><Text className="mt-1 text-xs text-lulu-200">{triggerLabel(rule)} · {rule.actionType === 'sound_tts' ? 'Sonido + TTS' : rule.actionType.toUpperCase()}</Text></View>
              <Switch disabled={readonly} value={rule.enabled} onValueChange={(enabled) => updateRule(rule.id, { enabled })} trackColor={{ false: '#342C34', true: '#FF5FC8' }} thumbColor="#FFF7FC" />
            </View>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1"><Button label="Probar" compact variant="secondary" onPress={() => previewRule(rule)} icon={<Play size={14} color="white" />} /></View>
              {!readonly ? <Pressable onPress={() => edit(rule)} className="h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]"><Pencil size={16} color="#FFB8E5" /></Pressable> : null}
              {!readonly ? <Pressable onPress={() => removeRule(rule.id)} className="h-11 w-11 items-center justify-center rounded-xl bg-red-500/10"><Trash2 size={16} color="#FDA4AF" /></Pressable> : null}
            </View>
          </View>
        </GlassCard>
      ))}
      {!rules.length ? <Text className="py-8 text-center text-sm font-bold text-white/25">Todavía no hay automatizaciones.</Text> : null}
    </Screen>
  );
}
