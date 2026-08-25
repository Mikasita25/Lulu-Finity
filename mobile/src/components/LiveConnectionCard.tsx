import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Radio, Unplug } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { useAppStore } from '@/store/useAppStore';
import { connectLive, disconnectLive } from '@/services/liveRuntime';
import type { RelayState } from '@/types/live';

const statusByState: Record<RelayState, { label: string; color: string; dot: string }> = {
  idle: { label: 'Desconectado', color: '#C9BBC7', dot: '#786B76' },
  connecting: { label: 'Conectando', color: '#FFD38E', dot: '#F7B955' },
  rotating: { label: 'Reconectando', color: '#FFD38E', dot: '#F7B955' },
  connected: { label: 'LIVE conectado', color: '#9EF0BE', dot: '#3DDB7F' },
  offline: { label: 'Desconectado', color: '#C9BBC7', dot: '#786B76' },
  error: { label: 'Desconectado', color: '#FFB1C5', dot: '#FF5C84' },
};

export function LiveConnectionCard() {
  const savedUsername = useAppStore((state) => state.username);
  const setIdentity = useAppStore((state) => state.setIdentity);
  const relayState = useAppStore((state) => state.relayState);
  const relayMessage = useAppStore((state) => state.relayMessage);
  const [username, setUsername] = useState(savedUsername);

  useEffect(() => setUsername(savedUsername), [savedUsername]);

  const connected = relayState === 'connected';
  const busy = relayState === 'connecting' || relayState === 'rotating';
  const status = statusByState[relayState];

  const connect = () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) {
      Alert.alert('Falta el usuario', 'Escribe el usuario de la cuenta que está haciendo LIVE.');
      return;
    }

    setIdentity(clean);
    try {
      connectLive(clean);
    } catch (error) {
      Alert.alert('No se pudo conectar', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <GlassCard className="mb-4">
      <View className="p-5">
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20">
            <Radio size={21} color="#FF9DDA" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-white/40">Conexión</Text>
            <Text className="mt-1 text-lg font-black text-white">Tu TikTok LIVE</Text>
            <View className="mt-3 self-start flex-row items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2">
              <View style={{ backgroundColor: status.dot }} className="h-2.5 w-2.5 rounded-full" />
              <Text style={{ color: status.color }} className="text-[10px] font-black uppercase tracking-[1px]">
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        <Text className="mb-2 mt-5 text-xs font-black uppercase tracking-[1.5px] text-white/40">
          Cuenta que está transmitiendo
        </Text>
        <View className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4">
          <Text className="text-lg font-black text-lulu-200">@</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            onSubmitEditing={connect}
            placeholder="nombredeusuario"
            placeholderTextColor="#766A74"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!connected && !busy}
            returnKeyType="go"
            className="h-14 flex-1 text-[16px] font-bold text-white"
          />
        </View>

        <Text className="mt-3 text-xs leading-5 text-white/40">
          {relayMessage || 'Escribe el usuario sin @. Lulú empezará a recibir comentarios, regalos y seguidores.'}
        </Text>

        <View className="mt-5">
          <Button
            label={connected ? 'Desconectar LIVE' : busy ? `${status.label}…` : 'Conectar al LIVE'}
            onPress={connected ? disconnectLive : connect}
            icon={connected ? <Unplug size={18} color="white" /> : <Radio size={18} color="white" />}
            variant={connected ? 'secondary' : 'primary'}
            disabled={busy}
          />
        </View>
      </View>
    </GlassCard>
  );
}
