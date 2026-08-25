import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { AudioLines, Bot, MessageCircle, RotateCcw, Square } from 'lucide-react-native';
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
    <View className="flex-row items-center gap-3 border-b border-white/[0.055] py-4">
      <View className="flex-1">
        <Text className="text-sm font-black text-white">{title}</Text>
        <Text className="mt-1 text-xs leading-5 text-white/40">{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#342C34', true: '#FF5FC8' }}
        thumbColor="#FFF7FC"
      />
    </View>
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
      style={active ? { borderColor: accent, backgroundColor: `${accent}20` } : undefined}
      className={`rounded-xl border px-3 py-2 ${active ? '' : 'border-white/10 bg-white/[0.04]'}`}
    >
      <Text
        style={active ? { color: accent } : undefined}
        className={active ? 'text-xs font-black' : 'text-xs font-bold text-white/55'}
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
  const [preview, setPreview] = useState('Hola, soy el TTS de Lulú Finity. Ya puedo leer los comentarios del LIVE.');
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
    const exact = voices.filter((voice) => voice.language.toLowerCase() === settings.language.toLowerCase());
    const related = voices.filter(
      (voice) =>
        voice.language.toLowerCase().startsWith(prefix) &&
        voice.language.toLowerCase() !== settings.language.toLowerCase(),
    );
    return [...exact, ...related].slice(0, 12);
  }, [voices, settings.language]);

  return (
    <Screen>
      <AppHeader title="Voz del chat" subtitle="Haz que Lulú lea los comentarios con voces de Microsoft." />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-lulu-500/10">
              <Bot size={22} color={accent} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-white">Leer comentarios en voz alta</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">
                Mantiene una cola corta para no leer mensajes viejos ni quedarse atrás.
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(enabled) => settings.updateTts({ enabled })}
              trackColor={{ false: '#342C34', true: accent }}
              thumbColor="#FFF7FC"
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
            onChange={(announceUsername) => settings.updateTts({ announceUsername })}
          />
          <ToggleRow
            title="Ignorar comandos"
            subtitle="No leer mensajes que empiezan con ! para evitar cantar comandos del bot."
            value={settings.skipCommands}
            onChange={(skipCommands) => settings.updateTts({ skipCommands })}
          />
        </View>
      </GlassCard>

      <SectionTitle title="Idioma" subtitle="Elige la región de las voces Microsoft que quieres escuchar." />
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

      <SectionTitle title="Elige una voz" subtitle="Usa el mismo motor Microsoft que la versión de PC." />
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
                style={active ? { borderColor: accent, backgroundColor: `${accent}18` } : undefined}
                className={`mb-2 rounded-2xl border p-4 ${active ? '' : 'border-white/10 bg-white/[0.035]'}`}
              >
                <Text
                  style={active ? { color: accent } : undefined}
                  className={active ? 'text-sm font-black' : 'text-sm font-black text-white'}
                >
                  {voice.name}
                </Text>
                <Text className="mt-1 text-xs text-white/35">
                  {voice.language} · {voice.quality}
                </Text>
              </Pressable>
            );
          })}
          {!voices.length ? <Text className="p-3 text-xs text-white/35">Cargando voces Microsoft…</Text> : null}
        </View>
      </GlassCard>

      <SectionTitle title="Cómo debe hablar" />
      <Text className="mb-2 text-[11px] font-black uppercase tracking-[1.4px] text-white/30">Velocidad</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {[0.8, 1, 1.15, 1.3].map((rate) => (
          <Choice
            key={rate}
            label={`${rate}x`}
            active={settings.rate === rate}
            accent={accent}
            onPress={() => settings.updateTts({ rate })}
          />
        ))}
      </View>
      <Text className="mb-2 text-[11px] font-black uppercase tracking-[1.4px] text-white/30">Tono</Text>
      <View className="flex-row flex-wrap gap-2">
        {[0.85, 1, 1.15, 1.3].map((pitch) => (
          <Choice
            key={pitch}
            label={`${pitch}x`}
            active={settings.pitch === pitch}
            accent={accent}
            onPress={() => settings.updateTts({ pitch })}
          />
        ))}
      </View>

      <SectionTitle title="Escuchar una prueba" />
      <GlassCard>
        <View className="p-5">
          <View className="mb-4 flex-row items-center gap-2">
            <MessageCircle size={17} color={accent} />
            <Text className="text-sm font-black text-white">Texto de prueba</Text>
          </View>
          <TextInput
            value={preview}
            onChangeText={setPreview}
            multiline
            maxLength={240}
            placeholder="Escribe algo para probar la voz"
            placeholderTextColor="#6D626C"
            className="min-h-[100px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-5 text-white"
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
                  Alert.alert(
                    'No se pudo reproducir la voz',
                    error instanceof Error ? error.message : 'Comprueba tu conexión a internet e inténtalo de nuevo.',
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
        Requiere internet · la voz se genera con el motor Microsoft de Lulú para PC, sin usar el motor del celular.
      </Text>
    </Screen>
  );
}
