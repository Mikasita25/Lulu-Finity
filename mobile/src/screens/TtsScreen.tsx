import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { AudioLines, Bot, MessageCircle, RotateCcw, Square } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Button } from '@/components/Button';
import { useTtsStore } from '@/store/useTtsStore';
import { getTtsVoices, previewTts, stopTts } from '@/services/tts';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';

type Voice = Awaited<ReturnType<typeof getTtsVoices>>[number];

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
      <Text style={active ? { color: accent } : undefined} className={active ? 'text-xs font-black' : 'text-xs font-bold text-white/55'}>
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
    const prefix = settings.language.split('-')[0].toLowerCase();
    const preferred = voices.filter((voice) => voice.language.toLowerCase().startsWith(prefix));
    return (preferred.length ? preferred : voices).slice(0, 10);
  }, [voices, settings.language]);

  return (
    <Screen>
      <AppHeader title="TTS Bot" subtitle="La voz de tus comentarios de TikTok LIVE, directamente en Android." />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-lulu-500/10">
              <Bot size={22} color={accent} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-white">Bot de comentarios</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">
                Los comentarios se agregan a una cola corta para mantener la voz cerca del chat en tiempo real.
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

      <SectionTitle title="Qué debe leer" />
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

      <SectionTitle title="Idioma" subtitle="Android usará una voz instalada compatible con el idioma elegido." />
      <View className="flex-row flex-wrap gap-2">
        {[
          ['es-MX', 'Español MX'],
          ['es-ES', 'Español ES'],
          ['en-US', 'English US'],
        ].map(([value, label]) => (
          <Choice
            key={value}
            label={label}
            active={settings.language === value}
            accent={accent}
            onPress={() => settings.updateTts({ language: value, voice: '' })}
          />
        ))}
      </View>

      <SectionTitle title="Voz" subtitle="Las opciones dependen de las voces instaladas en tu teléfono." />
      <GlassCard>
        <View className="p-4">
          <Pressable
            onPress={() => settings.updateTts({ voice: '' })}
            style={!settings.voice ? { borderColor: accent, backgroundColor: `${accent}18` } : undefined}
            className={`mb-2 rounded-2xl border p-4 ${settings.voice ? 'border-white/10 bg-white/[0.035]' : ''}`}
          >
            <Text style={!settings.voice ? { color: accent } : undefined} className={settings.voice ? 'text-sm font-black text-white' : 'text-sm font-black'}>
              Predeterminada del sistema
            </Text>
            <Text className="mt-1 text-xs text-white/35">Android elige automáticamente la mejor voz.</Text>
          </Pressable>
          {matchingVoices.map((voice) => {
            const active = settings.voice === voice.identifier;
            return (
              <Pressable
                key={voice.identifier}
                onPress={() => settings.updateTts({ voice: voice.identifier, language: voice.language })}
                style={active ? { borderColor: accent, backgroundColor: `${accent}18` } : undefined}
                className={`mb-2 rounded-2xl border p-4 ${active ? '' : 'border-white/10 bg-white/[0.035]'}`}
              >
                <Text style={active ? { color: accent } : undefined} className={active ? 'text-sm font-black' : 'text-sm font-black text-white'}>
                  {voice.name}
                </Text>
                <Text className="mt-1 text-xs text-white/35">{voice.language} · {voice.quality}</Text>
              </Pressable>
            );
          })}
          {!voices.length ? <Text className="p-3 text-xs text-white/35">Cargando voces instaladas…</Text> : null}
        </View>
      </GlassCard>

      <SectionTitle title="Ritmo" />
      <Text className="mb-2 text-[11px] font-black uppercase tracking-[1.4px] text-white/30">Velocidad</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {[0.8, 1, 1.15, 1.3].map((rate) => (
          <Choice key={rate} label={`${rate}x`} active={settings.rate === rate} accent={accent} onPress={() => settings.updateTts({ rate })} />
        ))}
      </View>
      <Text className="mb-2 text-[11px] font-black uppercase tracking-[1.4px] text-white/30">Tono</Text>
      <View className="flex-row flex-wrap gap-2">
        {[0.85, 1, 1.15, 1.3].map((pitch) => (
          <Choice key={pitch} label={`${pitch}x`} active={settings.pitch === pitch} accent={accent} onPress={() => settings.updateTts({ pitch })} />
        ))}
      </View>

      <SectionTitle title="Prueba" />
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
            maxLength={400}
            placeholder="Escribe algo para probar la voz"
            placeholderTextColor="#6D626C"
            className="min-h-[100px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-5 text-white"
          />
          <View className="mt-4 gap-3">
            <Button label="Probar TTS" onPress={() => previewTts(preview)} icon={<AudioLines size={17} color="white" />} />
            <Button label="Detener voz" variant="secondary" onPress={stopTts} icon={<Square size={15} color="white" />} />
            <Button label="Restablecer TTS" variant="secondary" onPress={settings.resetTts} icon={<RotateCcw size={16} color="white" />} />
          </View>
        </View>
      </GlassCard>

      <Text className="mt-5 text-center text-[10px] leading-5 text-white/25">
        TTS local de Android · los comentarios no se envían a un servicio de voz externo.
      </Text>
    </Screen>
  );
}
