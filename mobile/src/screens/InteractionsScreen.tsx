import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { FileAudio, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { pickAndPersistSound } from '@/services/soundLibrary';
import { previewRule } from '@/services/interactions';
import type {
  InteractionActionType,
  InteractionRule,
  InteractionTriggerType,
  MatchMode,
  SoundSetting,
} from '@/types/live';

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
  { id: 'sticker', label: 'Sticker', needsValue: true },
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
  if (rule.triggerType === 'sticker') return `Sticker: ${rule.triggerValue || 'cualquiera'}`;
  if (rule.triggerType === 'gift') return `Regalo: ${rule.triggerValue || 'cualquiera'}`;
  return triggerOptions.find((item) => item.id === rule.triggerType)?.label ?? rule.triggerType;
}

function actionLabel(rule: InteractionRule) {
  return actionOptions.find((item) => item.id === rule.actionType)?.label ?? rule.actionType;
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

  const patchDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

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
    if (draft.triggerType === 'command' && triggerValue && !triggerValue.startsWith('!')) {
      triggerValue = `!${triggerValue}`;
    }
    const generatedName =
      draft.name.trim() ||
      (draft.triggerType === 'command'
        ? triggerValue || 'Comando'
        : draft.triggerType === 'sticker'
          ? `Sticker ${triggerValue || 'cualquiera'}`
          : draft.triggerType === 'gift'
            ? `Regalo ${triggerValue || 'cualquiera'}`
            : triggerMeta.label);

    return {
      name: generatedName,
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
      Alert.alert('Falta el disparador', 'Escribe el comando, nombre/ID del sticker o nombre del regalo.');
      return false;
    }
    if (wantsSound && !draft.sound.uri) {
      Alert.alert('Falta el sonido', 'Elige un archivo de audio para esta regla.');
      return false;
    }
    if (wantsTts && !draft.ttsText.trim()) {
      Alert.alert('Falta el texto TTS', 'Escribe lo que debe decir Lulú cuando se active la regla.');
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

  const previewDraft = async () => {
    if (!validate()) return;
    const rule: InteractionRule = { ...normalizedDraft(), id: editingId ?? 'preview' };
    await previewRule(rule);
  };

  return (
    <Screen>
      <AppHeader
        title="Comandos y stickers"
        subtitle="Automatizaciones del LIVE: sonido, TTS o ambos."
      />

      <GlassCard className="mb-4">
        <View className="p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20">
              <Zap size={20} color="#FF9DDA" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Reglas del LIVE</Text>
              <Text className="mt-1 text-xs leading-5 text-white/45">
                Crea un comando como !hola, asigna sonidos distintos a stickers o reacciona a regalos, follows y más.
              </Text>
            </View>
          </View>
          <View className="mt-4 rounded-2xl bg-white/[0.045] p-4">
            <Text className="text-xs font-bold leading-5 text-white/45">
              Variables TTS: {'{name}'} · {'{user}'} · {'{comment}'} · {'{sticker}'} · {'{gift}'} · {'{count}'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {readonly ? (
        <Text className="mb-4 rounded-2xl bg-white/[0.05] p-4 text-xs leading-5 text-white/40">
          Modo Espectador: puedes ver y probar reglas, pero solo se editan en modo Streamer.
        </Text>
      ) : (
        <GlassCard className="mb-5">
          <View className="p-5">
            <Text className="text-base font-black text-white">
              {editingId ? 'Editar regla' : 'Nueva regla'}
            </Text>

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
              Nombre
            </Text>
            <TextInput
              value={draft.name}
              onChangeText={(value) => patchDraft('name', value)}
              placeholder="Ej. Sticker corazón"
              placeholderTextColor="#625965"
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm font-bold text-white"
            />

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
              Disparador
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {triggerOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => patchDraft('triggerType', option.id)}
                  className={`rounded-xl px-3.5 py-2.5 ${
                    draft.triggerType === option.id ? 'bg-lulu-500' : 'bg-white/[0.06]'
                  }`}
                >
                  <Text className={`text-xs font-black ${draft.triggerType === option.id ? 'text-white' : 'text-white/45'}`}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {triggerMeta.needsValue ? (
              <>
                <TextInput
                  value={draft.triggerValue}
                  onChangeText={(value) => patchDraft('triggerValue', value)}
                  autoCapitalize="none"
                  placeholder={
                    draft.triggerType === 'command'
                      ? '!hola'
                      : draft.triggerType === 'sticker'
                        ? 'Nombre o ID del sticker'
                        : 'Nombre del regalo'
                  }
                  placeholderTextColor="#625965"
                  className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm font-bold text-white"
                />
                {draft.triggerType === 'sticker' ? (
                  <Text className="mt-2 text-xs leading-5 text-white/35">
                    Puedes usar el nombre visible o el ID. Cuando alguien use un sticker, aparecerá en Historial para copiarlo exactamente.
                  </Text>
                ) : null}
                <View className="mt-3 flex-row gap-2">
                  {(['exact', 'contains'] as MatchMode[]).map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => patchDraft('matchMode', mode)}
                      className={`flex-1 rounded-xl py-2.5 ${draft.matchMode === mode ? 'bg-white/15' : 'bg-white/[0.045]'}`}
                    >
                      <Text className="text-center text-xs font-black text-white/60">
                        {mode === 'exact' ? 'Coincide exacto' : 'Contiene'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
              Acción
            </Text>
            <View className="flex-row gap-2">
              {actionOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => patchDraft('actionType', option.id)}
                  className={`flex-1 rounded-xl px-2 py-3 ${
                    draft.actionType === option.id ? 'bg-lulu-500' : 'bg-white/[0.06]'
                  }`}
                >
                  <Text className="text-center text-[11px] font-black text-white">{option.label}</Text>
                </Pressable>
              ))}
            </View>

            {wantsSound ? (
              <View className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <View className="flex-row items-center gap-2">
                  <FileAudio size={17} color="#FF9DDA" />
                  <Text className="flex-1 text-xs font-bold text-white/60" numberOfLines={1}>
                    {draft.sound.name || 'Sin sonido seleccionado'}
                  </Text>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <View className="flex-1">
                    <Button label="Elegir audio" compact variant="secondary" onPress={chooseSound} />
                  </View>
                  {draft.sound.uri ? (
                    <View className="flex-1">
                      <Button
                        label="Probar"
                        compact
                        onPress={previewDraft}
                        icon={<Play size={14} color="white" />}
                      />
                    </View>
                  ) : null}
                </View>
                <Text className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[1.2px] text-white/30">
                  Volumen
                </Text>
                <View className="flex-row gap-2">
                  {[0.25, 0.5, 0.75, 1].map((volume) => (
                    <Pressable
                      key={volume}
                      onPress={() => patchDraft('sound', { ...draft.sound, volume })}
                      className={`flex-1 rounded-xl py-2.5 ${
                        Math.abs(draft.sound.volume - volume) < 0.01 ? 'bg-lulu-500' : 'bg-white/[0.06]'
                      }`}
                    >
                      <Text className="text-center text-xs font-black text-white">
                        {Math.round(volume * 100)}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {wantsTts ? (
              <View className="mt-4">
                <Text className="mb-2 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
                  Texto TTS
                </Text>
                <TextInput
                  value={draft.ttsText}
                  onChangeText={(value) => patchDraft('ttsText', value)}
                  placeholder="Gracias {name} por usar {sticker}"
                  placeholderTextColor="#625965"
                  multiline
                  className="min-h-[88px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm font-bold text-white"
                />
              </View>
            ) : null}

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/30">
              Cooldown
            </Text>
            <View className="flex-row gap-2">
              {[0, 3, 5, 10, 30].map((seconds) => (
                <Pressable
                  key={seconds}
                  onPress={() => patchDraft('cooldownSeconds', seconds)}
                  className={`flex-1 rounded-xl py-2.5 ${
                    draft.cooldownSeconds === seconds ? 'bg-white/15' : 'bg-white/[0.045]'
                  }`}
                >
                  <Text className="text-center text-xs font-black text-white/60">
                    {seconds === 0 ? 'No' : `${seconds}s`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-5 flex-row gap-2">
              {editingId ? (
                <View className="flex-1">
                  <Button
                    label="Cancelar"
                    variant="secondary"
                    onPress={() => {
                      setEditingId(null);
                      setDraft(blankDraft());
                    }}
                  />
                </View>
              ) : null}
              <View className="flex-1">
                <Button
                  label={editingId ? 'Guardar cambios' : 'Crear regla'}
                  onPress={save}
                  icon={<Plus size={16} color="white" />}
                />
              </View>
            </View>
          </View>
        </GlassCard>
      )}

      <Text className="mb-3 text-[11px] font-black uppercase tracking-[1.6px] text-white/30">
        Reglas guardadas · {rules.length}
      </Text>

      {rules.length === 0 ? (
        <GlassCard>
          <View className="items-center px-5 py-10">
            <Zap size={28} color="#8C7A89" />
            <Text className="mt-3 text-sm font-black text-white/55">Todavía no hay reglas</Text>
            <Text className="mt-2 max-w-[280px] text-center text-xs leading-5 text-white/30">
              Crea una arriba. Ejemplo: sticker Corazón → sonido personalizado + “Gracias {'{name}'}”.
            </Text>
          </View>
        </GlassCard>
      ) : (
        rules.map((rule) => (
          <GlassCard key={rule.id} className="mb-3">
            <View className="p-5">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-lulu-500/15">
                  <Zap size={17} color="#FF9DDA" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-white">{rule.name}</Text>
                  <Text className="mt-1 text-xs font-bold text-white/40">
                    {triggerLabel(rule)} → {actionLabel(rule)}
                  </Text>
                </View>
                <Switch
                  disabled={readonly}
                  value={rule.enabled}
                  onValueChange={(enabled) => updateRule(rule.id, { enabled })}
                  trackColor={{ false: '#342C34', true: '#FF5FC8' }}
                  thumbColor="#FFF7FC"
                />
              </View>

              <View className="mt-4 flex-row flex-wrap gap-2">
                <View className="rounded-xl bg-white/[0.055] px-3 py-2">
                  <Text className="text-[11px] font-black text-white/45">
                    Cooldown {rule.cooldownSeconds || 0}s
                  </Text>
                </View>
                {rule.sound?.name ? (
                  <View className="max-w-[200px] rounded-xl bg-white/[0.055] px-3 py-2">
                    <Text className="text-[11px] font-black text-white/45" numberOfLines={1}>
                      🔊 {rule.sound.name}
                    </Text>
                  </View>
                ) : null}
              </View>

              {rule.ttsText ? (
                <Text className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/45">
                  TTS: {rule.ttsText}
                </Text>
              ) : null}

              <View className="mt-4 flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Probar"
                    compact
                    variant="secondary"
                    onPress={() => previewRule(rule)}
                    icon={<Play size={14} color="white" />}
                  />
                </View>
                {!readonly ? (
                  <>
                    <Pressable
                      onPress={() => edit(rule)}
                      className="h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07]"
                    >
                      <Pencil size={16} color="#E7DCE5" />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Eliminar regla', `¿Eliminar “${rule.name}”?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Eliminar', style: 'destructive', onPress: () => removeRule(rule.id) },
                        ])
                      }
                      className="h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10"
                    >
                      <Trash2 size={16} color="#FCA5A5" />
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          </GlassCard>
        ))
      )}
    </Screen>
  );
}
