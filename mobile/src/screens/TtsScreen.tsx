import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AudioLines,
  Bot,
  MessageCircle,
  RotateCcw,
  Square,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { useTtsStore } from '@/store/useTtsStore';
import { getTtsVoices, previewTts, stopTts } from '@/services/tts';
import { defaultMicrosoftVoice } from '@/services/microsoftVoices';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';
import { LuluSwitch } from '@/components/LuluSwitch';
import { LuluInput } from '@/components/LuluInput';
import { LuluSlider } from '@/components/LuluSlider';
import { SettingRow } from '@/components/SettingRow';
import { StatusBadge } from '@/components/StatusBadge';
import { showLuluDialog } from '@/components/LuluDialog';

type Voice = Awaited<ReturnType<typeof getTtsVoices>>[number];

const LANGUAGE_CHOICES = [
  ['es-MX', 'Español MX'],
  ['es-ES', 'Español ES'],
  ['en-US', 'English US'],
] as const;

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SettingRow
      title={title}
      subtitle={subtitle}
      value={value}
      onValueChange={onChange}
    />
  );
}

function Choice({
  label,
  active,
  onPress,
  accent,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={
        active
          ? { borderColor: accent, backgroundColor: `${accent}20` }
          : undefined
      }
      className={`rounded-xl border px-3 py-2 ${active ? '' : 'border-white/10 bg-white/[0.04]'}`}
    >
      <Text
        style={active ? { color: accent } : undefined}
        className={
          active ? 'text-xs font-black' : 'text-xs font-bold text-white/55'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TtsScreen() {
  const settings = useTtsStore();
  const accentTheme = useAppStore((state) => state.accentTheme);
  const accent = accentByTheme[accentTheme];
  const [voices, setVoices] = useState<Voice[]>([]);
  const [preview, setPreview] = useState(
    'Hola, soy el TTS de Lulú Finity. Ya puedo leer los comentarios del LIVE.',
  );
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let active = true;
    getTtsVoices()
      .then((items) => {
        if (active) setVoices(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const matchingVoices = useMemo(() => {
    const prefix = (settings.language.split('-')[0] ?? 'es').toLowerCase();
    const exact = voices.filter(
      (voice) =>
        voice.language.toLowerCase() === settings.language.toLowerCase(),
    );
    const related = voices.filter(
      (voice) =>
        voice.language.toLowerCase().startsWith(prefix) &&
        voice.language.toLowerCase() !== settings.language.toLowerCase(),
    );
    return [...exact, ...related].slice(0, 12);
  }, [voices, settings.language]);

  return (
    <Screen>
      <AppHeader
        title="Voz del chat"
        subtitle="Haz que Lulú lea los comentarios con voces de Microsoft."
      />

      <GlassCard variant="hero">
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View
              style={{ borderColor: `${accent}45` }}
              className="h-14 w-14 items-center justify-center rounded-[20px] border bg-lulu-500/10"
            >
              <Bot size={24} color={accent} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-white">Tu voz ✦</Text>
              <Text className="mt-1 text-xs leading-5 text-white/60">
                Mantiene una cola corta para no leer mensajes viejos ni quedarse
                atrás.
              </Text>
            </View>
            <LuluSwitch
              value={settings.enabled}
              onValueChange={(enabled) => settings.updateTts({ enabled })}
              accessibilityLabel="Leer comentarios en voz alta"
            />
          </View>
          <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
            <View className="flex-row items-end gap-[3px]">
              {[10, 20, 14, 27, 18, 23, 12, 18, 9].map((height, index) => (
                <View
                  key={index}
                  style={{
                    width: 3,
                    height,
                    borderRadius: 2,
                    backgroundColor: index % 2 ? '#D685FF' : '#F2B7FF',
                    opacity: settings.enabled ? 0.9 : 0.25,
                  }}
                />
              ))}
            </View>
            <StatusBadge
              label={settings.enabled ? 'TTS activo' : 'TTS apagado'}
              tone={settings.enabled ? 'success' : 'neutral'}
            />
          </View>
        </View>
      </GlassCard>

      <SectionTitle title="Qué quieres escuchar" />
      <GlassCard>
        <View className="px-5">
          <ToggleRow
            title="Decir el nombre"
            subtitle="Ejemplo: “LuluFan dice: hola”."
            value={settings.announceUsername}
            onChange={(announceUsername) =>
              settings.updateTts({ announceUsername })
            }
          />
          <ToggleRow
            title="Ignorar comandos"
            subtitle="No leer mensajes que empiezan con ! para evitar cantar comandos del bot."
            value={settings.skipCommands}
            onChange={(skipCommands) => settings.updateTts({ skipCommands })}
          />
        </View>
      </GlassCard>

      <SectionTitle
        title="Idioma"
        subtitle="Elige la región de las voces Microsoft que quieres escuchar."
      />
      <View className="flex-row flex-wrap gap-2">
        {LANGUAGE_CHOICES.map(([value, label]) => (
          <Choice
            key={value}
            label={label}
            active={settings.language === value}
            accent={accent}
            onPress={() =>
              settings.updateTts({
                language: value,
                voice: defaultMicrosoftVoice(value),
              })
            }
          />
        ))}
      </View>

      <SectionTitle
        title="Elige una voz"
        subtitle="Usa el mismo motor Microsoft que la versión de PC."
      />
      <GlassCard>
        <View className="p-4">
          {matchingVoices.map((voice) => {
            const active = settings.voice === voice.identifier;
            return (
              <Pressable
                key={voice.identifier}
                onPress={() =>
                  settings.updateTts({
                    voice: voice.identifier,
                    language: voice.language,
                  })
                }
                style={
                  active
                    ? { borderColor: accent, backgroundColor: `${accent}18` }
                    : undefined
                }
                className={`mb-2 rounded-2xl border p-4 ${active ? '' : 'border-white/10 bg-white/[0.035]'}`}
              >
                <Text
                  style={active ? { color: accent } : undefined}
                  className={
                    active
                      ? 'text-sm font-black'
                      : 'text-sm font-black text-white'
                  }
                >
                  {voice.name}
                </Text>
                <Text className="mt-1 text-xs text-white/60">
                  {voice.language} · {voice.quality}
                </Text>
              </Pressable>
            );
          })}
          {!voices.length ? (
            <Text className="p-3 text-xs text-white/60">
              Cargando voces Microsoft…
            </Text>
          ) : null}
        </View>
      </GlassCard>

      <SectionTitle
        title="Cómo debe hablar"
        subtitle="Ajusta la voz sin cambiar el motor Microsoft."
      />
      <GlassCard variant="soft">
        <View className="gap-6 p-5">
          <LuluSlider
            label="Velocidad"
            value={settings.rate}
            minimumValue={0.8}
            maximumValue={1.3}
            step={0.05}
            formatValue={(value) => `${value.toFixed(2)}x`}
            onValueChange={(rate) => settings.updateTts({ rate })}
          />
          <LuluSlider
            label="Tono"
            value={settings.pitch}
            minimumValue={0.85}
            maximumValue={1.3}
            step={0.05}
            formatValue={(value) => `${value.toFixed(2)}x`}
            onValueChange={(pitch) => settings.updateTts({ pitch })}
          />
          <LuluSlider
            label="Volumen"
            value={settings.volume}
            step={0.05}
            onValueChange={(volume) => settings.updateTts({ volume })}
          />
        </View>
      </GlassCard>

      <SectionTitle title="Escuchar una prueba" />
      <GlassCard>
        <View className="p-5">
          <View className="mb-4 flex-row items-center gap-2">
            <MessageCircle size={17} color={accent} />
            <Text className="text-sm font-black text-white">
              Texto de prueba
            </Text>
          </View>
          <LuluInput
            value={preview}
            onChangeText={setPreview}
            multiline
            maxLength={240}
            placeholder="Escribe algo para probar la voz"
          />
          <View className="mt-4 gap-3">
            <Button
              label={previewing ? 'Preparando voz…' : 'Escuchar prueba'}
              disabled={previewing}
              onPress={async () => {
                setPreviewing(true);
                try {
                  await previewTts(preview);
                } catch (error) {
                  showLuluDialog(
                    'No se pudo reproducir la voz',
                    error instanceof Error
                      ? error.message
                      : 'Comprueba tu conexión a internet e inténtalo de nuevo.',
                    undefined,
                    'danger',
                  );
                } finally {
                  setPreviewing(false);
                }
              }}
              icon={<AudioLines size={17} color="white" />}
            />
            <Button
              label="Detener voz"
              variant="secondary"
              onPress={stopTts}
              icon={<Square size={15} color="white" />}
            />
            <Button
              label="Restablecer TTS"
              variant="secondary"
              onPress={settings.resetTts}
              icon={<RotateCcw size={16} color="white" />}
            />
          </View>
        </View>
      </GlassCard>

      <Text className="mt-5 text-center text-[10px] leading-5 text-white/25">
        Requiere internet · la voz se genera con el motor Microsoft de Lulú para
        PC, sin usar el motor del celular.
      </Text>
    </Screen>
  );
}
