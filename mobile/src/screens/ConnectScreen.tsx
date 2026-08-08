import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Radio, ShieldCheck, UserRound } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import { connectLive } from '@/services/liveRuntime';

export function ConnectScreen({ navigation }: any) {
  const savedUsername = useAppStore((state) => state.username);
  const savedMode = useAppStore((state) => state.mode);
  const setIdentity = useAppStore((state) => state.setIdentity);
  const setMode = useAppStore((state) => state.setMode);
  const relayState = useAppStore((state) => state.relayState);
  const relayMessage = useAppStore((state) => state.relayMessage);
  const [username, setUsername] = useState(savedUsername);
  const [mode, setLocalMode] = useState(savedMode);

  const connect = () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return Alert.alert('Falta el usuario', 'Escribe el @ de la cuenta que está haciendo LIVE.');
    setIdentity(clean);
    setMode(mode);
    try {
      connectLive(clean);
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('No se pudo conectar', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen>
      <View className="mb-8 mt-8">
        <View className="h-14 w-14 items-center justify-center rounded-3xl bg-lulu-500/20">
          <Radio size={28} color="#FF79CF" />
        </View>
        <Text className="mt-5 text-3xl font-black tracking-tight text-white">Conecta tu LIVE</Text>
        <Text className="mt-2 max-w-[340px] text-sm leading-6 text-white/50">
          Lulú Finity usa el mismo relay seguro de la versión PC. No necesitas pegar API keys.
        </Text>
      </View>

      <GlassCard>
        <View className="p-5">
          <Text className="mb-2 text-xs font-black uppercase tracking-[1.5px] text-white/40">
            Usuario de TikTok
          </Text>
          <View className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4">
            <Text className="text-lg font-black text-lulu-200">@</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="nombredeusuario"
              placeholderTextColor="#766A74"
              autoCapitalize="none"
              autoCorrect={false}
              className="h-14 flex-1 text-[16px] font-bold text-white"
            />
          </View>

          <Text className="mb-3 mt-6 text-xs font-black uppercase tracking-[1.5px] text-white/40">
            Modo
          </Text>
          <View className="flex-row gap-3">
            {[
              { id: 'streamer' as const, label: 'Streamer', icon: ShieldCheck },
              { id: 'spectator' as const, label: 'Espectador', icon: UserRound },
            ].map((item) => {
              const selected = mode === item.id;
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setLocalMode(item.id)}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-4 ${
                    selected
                      ? 'border-lulu-400/50 bg-lulu-500/20'
                      : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <Icon size={16} color={selected ? '#FFB8E5' : '#91858F'} />
                  <Text className={`text-sm font-black ${selected ? 'text-lulu-200' : 'text-white/50'}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {relayMessage ? (
            <Text className="mt-4 text-xs leading-5 text-white/40">
              {relayState.toUpperCase()} · {relayMessage}
            </Text>
          ) : null}

          <View className="mt-6">
            <Button label="Conectar al LIVE" onPress={connect} icon={<Radio size={18} color="white" />} />
          </View>

          {savedUsername ? (
            <Text
              onPress={() => navigation.replace('Main')}
              className="mt-5 text-center text-xs font-bold text-white/40"
            >
              Entrar sin reconectar
            </Text>
          ) : null}
        </View>
      </GlassCard>
    </Screen>
  );
}
