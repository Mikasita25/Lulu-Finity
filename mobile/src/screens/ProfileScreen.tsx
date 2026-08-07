import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Radio, Save, ShieldCheck, UserRound } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { connectLive } from '@/services/liveRuntime';

export function ProfileScreen() {
  const savedUsername = useAppStore((state) => state.username);
  const savedName = useAppStore((state) => state.displayName);
  const mode = useAppStore((state) => state.mode);
  const setIdentity = useAppStore((state) => state.setIdentity);
  const setMode = useAppStore((state) => state.setMode);
  const [username, setUsername] = useState(savedUsername);
  const [displayName, setDisplayName] = useState(savedName);

  const save = () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return Alert.alert('Falta el usuario', 'Escribe tu usuario de TikTok.');
    setIdentity(clean, displayName);
  };

  const reconnect = () => {
    save();
    try {
      connectLive(username);
    } catch (error) {
      Alert.alert('No se pudo conectar', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <AppHeader title="Perfil" subtitle="Cuenta y modo de uso de Lulú Finity." />

      <GlassCard>
        <View className="p-5">
          <Text className="mb-2 text-xs font-black uppercase tracking-[1.4px] text-white/40">TikTok</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="@usuario"
            placeholderTextColor="#766A74"
            className="h-14 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white"
          />

          <Text className="mb-2 mt-5 text-xs font-black uppercase tracking-[1.4px] text-white/40">
            Nombre visible
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Lulú"
            placeholderTextColor="#766A74"
            className="h-14 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white"
          />

          <Text className="mb-3 mt-6 text-xs font-black uppercase tracking-[1.4px] text-white/40">Modo</Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setMode('streamer')}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
                mode === 'streamer' ? 'bg-lulu-500' : 'bg-white/[0.06]'
              }`}
            >
              <ShieldCheck size={15} color={mode === 'streamer' ? 'white' : '#91858F'} />
              <Text className={`text-xs font-black ${mode === 'streamer' ? 'text-white' : 'text-white/40'}`}>
                Streamer
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('spectator')}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
                mode === 'spectator' ? 'bg-lulu-500' : 'bg-white/[0.06]'
              }`}
            >
              <UserRound size={15} color={mode === 'spectator' ? 'white' : '#91858F'} />
              <Text className={`text-xs font-black ${mode === 'spectator' ? 'text-white' : 'text-white/40'}`}>
                Espectador
              </Text>
            </Pressable>
          </View>

          <View className="mt-6 gap-3">
            <Button label="Guardar" onPress={save} icon={<Save size={17} color="white" />} />
            {mode === 'streamer' ? (
              <Button
                label="Guardar y reconectar LIVE"
                variant="secondary"
                onPress={reconnect}
                icon={<Radio size={17} color="white" />}
              />
            ) : null}
          </View>
        </View>
      </GlassCard>
    </Screen>
  );
}
