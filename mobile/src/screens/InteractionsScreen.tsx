import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ArrowDown,
  FileAudio,
  Play,
  Plus,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react-native';
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
import { LuluInput } from '@/components/LuluInput';
import { LuluSlider } from '@/components/LuluSlider';
import { AutomationCard } from '@/components/AutomationCard';
import { showLuluDialog } from '@/components/LuluDialog';
import { palette } from '@/theme/palette';

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

const triggerOptions: {
  id: InteractionTriggerType;
  label: string;
  needsValue: boolean;
}[] = [
  { id: 'command', label: 'Comando', needsValue: true },
  { id: 'fanSticker', label: 'Sticker de fan', needsValue: true },
  { id: 'gift', label: 'Regalo', needsValue: true },
  { id: 'follow', label: 'Nuevo seguidor', needsValue: false },
  { id: 'share', label: 'Compartir', needsValue: false },
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
  if (rule.triggerType === 'fanSticker')
    return `Fan Sticker: ${rule.triggerValue || 'cualquiera'}`;
  if (rule.triggerType === 'gift')
    return `Regalo: ${rule.triggerValue || 'cualquiera'}`;
  return (
    triggerOptions.find((item) => item.id === rule.triggerType)?.label ??
    rule.triggerType
  );
}

export function InteractionsScreen() {
  const mode = useAppStore((state) => state.mode);
  const rules = useAppStore((state) => state.interactionRules);
  const detectedGifts = useAppStore((state) => state.detectedGifts);
  const addRule = useAppStore((state) => state.addInteractionRule);
  const updateRule = useAppStore((state) => state.updateInteractionRule);
  const removeRule = useAppStore((state) => state.removeInteractionRule);
  const readonly = mode === 'spectator';
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [giftSearch, setGiftSearch] = useState('');

  const visibleGifts = useMemo(() => {
    const query = giftSearch.trim().toLocaleLowerCase('es-MX');
    return detectedGifts
      .filter(
        (gift) =>
          !query ||
          gift.name.toLocaleLowerCase('es-MX').includes(query) ||
          String(gift.id || '').toLocaleLowerCase('es-MX').includes(query),
      )
      .slice(0, 30);
  }, [detectedGifts, giftSearch]);

  const triggerMeta = useMemo(
    () =>
      triggerOptions.find((item) => item.id === draft.triggerType) ??
      triggerOptions[0]!,
    [draft.triggerType],
  );
  const wantsSound =
    draft.actionType === 'sound' || draft.actionType === 'sound_tts';
  const wantsTts =
    draft.actionType === 'tts' || draft.actionType === 'sound_tts';
  const patchDraft = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const chooseSound = async () => {
    try {
      const picked = await pickAndPersistSound();
      if (picked)
        patchDraft('sound', { ...draft.sound, ...picked, enabled: true });
    } catch (error) {
      showLuluDialog(
        'No se pudo guardar el sonido',
        error instanceof Error ? error.message : String(error),
        undefined,
        'danger',
      );
    }
  };

  const normalizedDraft = (): Omit<
    InteractionRule,
    'id' | 'lastTriggeredAt'
  > => {
    let triggerValue = draft.triggerValue.trim();
    if (
      draft.triggerType === 'command' &&
      triggerValue &&
      !triggerValue.startsWith('!')
    )
      triggerValue = `!${triggerValue}`;
    const name =
      draft.name.trim() ||
      (draft.triggerType === 'fanSticker'
        ? `Fan Sticker ${triggerValue}`
        : triggerValue || triggerMeta.label);
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
      showLuluDialog(
        'Falta el disparador',
        draft.triggerType === 'fanSticker'
          ? 'Escribe el nombre o ID del Fan Sticker.'
          : 'Escribe el comando o nombre del regalo.',
        undefined,
        'warning',
      );
      return false;
    }
    if (wantsSound && !draft.sound.uri) {
      showLuluDialog(
        'Falta el sonido',
        'Elige un archivo de audio para esta automatización.',
        undefined,
        'warning',
      );
      return false;
    }
    if (wantsTts && !draft.ttsText.trim()) {
      showLuluDialog(
        'Falta el texto TTS',
        'Escribe lo que debe decir Lulú.',
        undefined,
        'warning',
      );
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

  const createFromGift = (name: string) => {
    setEditingId(null);
    setDraft({
      ...blankDraft(),
      name: `Regalo ${name}`,
      triggerType: 'gift',
      triggerValue: name,
      actionType: 'tts',
      ttsText: 'Gracias {name} por enviar {gift}',
    });
  };

  return (
    <Screen>
      <AppHeader
        title="Automatiza"
        subtitle="Conecta cada evento del LIVE con una acción clara de Lulú."
      />
      <GlassCard className="mb-4" variant="hero">
        <View className="p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20">
              <Zap size={20} color="#F2B7FF" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">
                Crea una reacción
              </Text>
              <Text className="mt-1 text-xs leading-5 text-white/65">
                Por ejemplo: al recibir un regalo, reproduce un sonido y di
                “Gracias”.
              </Text>
            </View>
          </View>
          <View className="mt-4 flex-row items-stretch gap-2">
            <View className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
              <Text className="text-[9px] font-black uppercase tracking-[1px] text-white/40">
                Evento
              </Text>
              <Text className="mt-2 text-xs font-black text-white">Regalo</Text>
            </View>
            <View className="items-center justify-center">
              <ArrowDown size={18} color={palette.pinkSoft} />
            </View>
            <View className="flex-1 rounded-2xl border border-lulu-300/15 bg-lulu-500/[0.08] p-3">
              <Text className="text-[9px] font-black uppercase tracking-[1px] text-white/40">
                Acción
              </Text>
              <Text className="mt-2 text-xs font-black text-white">
                Sonido + TTS
              </Text>
            </View>
          </View>
          <View className="mt-3 rounded-2xl bg-white/[0.035] p-4">
            <Text className="text-xs font-bold leading-5 text-white/65">
              Variables TTS: {'{name}'} · {'{user}'} · {'{comment}'} ·{' '}
              {'{fanSticker}'} · {'{gift}'} · {'{count}'}
            </Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mb-5">
        <View className="p-5">
          <Text className="text-base font-black text-white">
            Regalos detectados en el LIVE
          </Text>
          <Text className="mt-1 text-xs leading-5 text-white/55">
            Son datos recibidos realmente por Lulú. No se inventan precios ni
            disponibilidad regional.
          </Text>
          <View className="mt-4">
            <LuluInput
              value={giftSearch}
              onChangeText={setGiftSearch}
              placeholder="Buscar por nombre o ID"
              icon={<Search size={17} color={palette.pinkSoft} />}
            />
          </View>
          <View className="mt-3 gap-2">
            {visibleGifts.map((gift) => (
              <View
                key={gift.key}
                className="flex-row items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3"
              >
                <View className="flex-1">
                  <Text className="text-sm font-black text-white">{gift.name}</Text>
                  <Text className="mt-1 text-[11px] text-white/50">
                    {gift.id ? `ID ${gift.id} · ` : ''}detectado {gift.timesSeen}×
                    {gift.diamondsEach !== undefined
                      ? ` · ${gift.diamondsEach} diamantes por unidad`
                      : ''}
                  </Text>
                </View>
                {!readonly ? (
                  <Button
                    label="Crear regla"
                    compact
                    variant="secondary"
                    onPress={() => createFromGift(gift.name)}
                  />
                ) : null}
              </View>
            ))}
            {!visibleGifts.length ? (
              <Text className="py-4 text-center text-xs text-white/40">
                Conecta un LIVE para registrar los regalos que lleguen.
              </Text>
            ) : null}
          </View>
        </View>
      </GlassCard>

      {!readonly ? (
        <GlassCard className="mb-5">
          <View className="p-5">
            <Text className="text-base font-black text-white">
              {editingId ? 'Editar automatización' : 'Nueva automatización'}
            </Text>
            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/55">
              Nombre
            </Text>
            <LuluInput
              value={draft.name}
              onChangeText={(value) => patchDraft('name', value)}
              placeholder="Ej. Fan Sticker corazón"
            />

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/55">
              Disparador
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {triggerOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => patchDraft('triggerType', option.id)}
                  className={`rounded-xl px-3.5 py-2.5 ${draft.triggerType === option.id ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}
                >
                  <Text
                    className={`text-xs font-black ${draft.triggerType === option.id ? 'text-white' : 'text-white/65'}`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {triggerMeta.needsValue ? (
              <>
                <View className="mt-3">
                  <LuluInput
                    value={draft.triggerValue}
                    onChangeText={(value) => patchDraft('triggerValue', value)}
                    autoCapitalize="none"
                    placeholder={
                      draft.triggerType === 'command'
                        ? '!hola'
                        : draft.triggerType === 'fanSticker'
                          ? 'Nombre o ID del Fan Sticker'
                          : 'Nombre del regalo'
                    }
                  />
                </View>
                {draft.triggerType === 'fanSticker' ? (
                  <View className="mt-3 flex-row gap-2 rounded-2xl bg-lulu-500/10 p-3">
                    <Sparkles size={16} color="#F2B7FF" />
                    <Text className="flex-1 text-xs leading-5 text-white/65">
                      Conecta el LIVE y abre Historial → Fan Stickers para ver
                      el nombre e ID exactos que TikTok envía.
                    </Text>
                  </View>
                ) : null}
                <View className="mt-3 flex-row gap-2">
                  {(['exact', 'contains'] as MatchMode[]).map((match) => (
                    <Pressable
                      key={match}
                      onPress={() => patchDraft('matchMode', match)}
                      className={`flex-1 rounded-xl py-2.5 ${draft.matchMode === match ? 'bg-white/15' : 'bg-white/[0.045]'}`}
                    >
                      <Text className="text-center text-xs font-black text-white/60">
                        {match === 'exact' ? 'Coincide exacto' : 'Contiene'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/55">
              Acción
            </Text>
            <View className="flex-row gap-2">
              {actionOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => patchDraft('actionType', option.id)}
                  className={`flex-1 rounded-xl px-2 py-3 ${draft.actionType === option.id ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}
                >
                  <Text className="text-center text-[11px] font-black text-white">
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {wantsSound ? (
              <View className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <View className="flex-row items-center gap-2">
                  <FileAudio size={17} color="#F2B7FF" />
                  <Text
                    className="flex-1 text-xs font-bold text-white/60"
                    numberOfLines={1}
                  >
                    {draft.sound.name || 'Sin sonido seleccionado'}
                  </Text>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <View className="flex-1">
                    <Button
                      label="Elegir audio"
                      compact
                      variant="secondary"
                      onPress={chooseSound}
                    />
                  </View>
                  {draft.sound.uri ? (
                    <View className="flex-1">
                      <Button
                        label="Probar"
                        compact
                        onPress={() =>
                          previewRule({
                            ...normalizedDraft(),
                            id: editingId ?? 'preview',
                          })
                        }
                        icon={<Play size={14} color="white" />}
                      />
                    </View>
                  ) : null}
                </View>
                <View className="mt-4">
                  <LuluSlider
                    label="Volumen de esta acción"
                    value={draft.sound.volume}
                    onValueChange={(volume) =>
                      patchDraft('sound', { ...draft.sound, volume })
                    }
                    step={0.05}
                  />
                </View>
              </View>
            ) : null}

            {wantsTts ? (
              <View className="mt-4">
                <LuluInput
                  value={draft.ttsText}
                  onChangeText={(value) => patchDraft('ttsText', value)}
                  multiline
                  placeholder="Gracias {name} por usar {fanSticker}"
                />
              </View>
            ) : null}

            <Text className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[1.4px] text-white/55">
              Cooldown
            </Text>
            <View className="flex-row gap-2">
              {[0, 3, 5, 10, 30].map((seconds) => (
                <Pressable
                  key={seconds}
                  onPress={() => patchDraft('cooldownSeconds', seconds)}
                  className={`flex-1 rounded-xl py-2.5 ${draft.cooldownSeconds === seconds ? 'bg-white/15' : 'bg-white/[0.045]'}`}
                >
                  <Text className="text-center text-xs font-black text-white/60">
                    {seconds}s
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-5 flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={editingId ? 'Guardar cambios' : 'Crear regla'}
                  onPress={save}
                  icon={<Plus size={16} color="white" />}
                />
              </View>
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
            </View>
          </View>
        </GlassCard>
      ) : null}

      <Text className="mb-3 text-xs font-black uppercase tracking-[1.5px] text-white/55">
        Reglas activas · {rules.length}
      </Text>
      {rules.map((rule) => (
        <AutomationCard
          key={rule.id}
          rule={rule}
          triggerLabel={triggerLabel(rule)}
          readonly={readonly}
          onToggle={(enabled) => updateRule(rule.id, { enabled })}
          onPreview={() => previewRule(rule)}
          onEdit={!readonly ? () => edit(rule) : undefined}
          onRemove={!readonly ? () => removeRule(rule.id) : undefined}
        />
      ))}
      {!rules.length ? (
        <Text className="py-8 text-center text-sm font-bold text-white/25">
          Todavía no hay automatizaciones.
        </Text>
      ) : null}
    </Screen>
  );
}
