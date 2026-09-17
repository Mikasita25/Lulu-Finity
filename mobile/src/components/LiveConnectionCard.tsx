import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AtSign, Radio, Unplug } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { useAppStore } from '@/store/useAppStore';
import { connectLive, disconnectLive } from '@/services/liveRuntime';
import type { RelayState } from '@/types/live';
import { LuluInput } from './LuluInput';
import { StatusBadge } from './StatusBadge';
import { showLuluDialog } from './LuluDialog';
import { palette } from '@/theme/palette';

const statusByState: Record<
  RelayState,
  { label: string; color: string; dot: string }
> = {
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
      showLuluDialog(
        'Falta el usuario',
        'Escribe el usuario de la cuenta que está haciendo LIVE.',
        undefined,
        'warning',
      );
      return;
    }

    setIdentity(clean);
    try {
      connectLive(clean);
    } catch (error) {
      showLuluDialog(
        'No se pudo conectar',
        error instanceof Error ? error.message : String(error),
        undefined,
        'danger',
      );
    }
  };

  return (
    <GlassCard className="mb-4" variant="hero">
      <View className="p-5">
        <View className="flex-row items-start gap-3">
          <View
            style={{
              shadowColor: palette.pink,
              shadowOpacity: 0.3,
              shadowRadius: 10,
            }}
            className="h-14 w-14 items-center justify-center rounded-[20px] border border-lulu-300/25 bg-lulu-500/15"
          >
            <Radio size={24} color={palette.pinkSoft} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-white/60">
              Conexión
            </Text>
            <Text className="mt-1 text-lg font-black text-white">
              Tu TikTok LIVE
            </Text>
            <View className="mt-3 self-start">
              <StatusBadge
                label={status.label}
                tone={
                  connected
                    ? 'success'
                    : busy
                      ? 'warning'
                      : relayState === 'error'
                        ? 'danger'
                        : 'neutral'
                }
              />
            </View>
          </View>
        </View>

        <Text className="mb-2 mt-5 text-xs font-black uppercase tracking-[1.5px] text-white/60">
          Cuenta que está transmitiendo
        </Text>
        <LuluInput
          value={username}
          onChangeText={setUsername}
          onSubmitEditing={connect}
          placeholder="nombredeusuario"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!connected && !busy}
          returnKeyType="go"
          icon={<AtSign size={18} color={palette.pinkSoft} />}
        />

        <Text className="mt-3 text-xs leading-5 text-white/60">
          {relayMessage ||
            'Escribe el usuario sin @. Lulú empezará a recibir comentarios, regalos y seguidores.'}
        </Text>

        <View className="mt-5">
          <Button
            label={
              connected
                ? 'Desconectar LIVE'
                : busy
                  ? `${status.label}…`
                  : 'Conectar al LIVE'
            }
            onPress={connected ? disconnectLive : connect}
            icon={
              connected ? (
                <Unplug size={18} color="white" />
              ) : (
                <Radio size={18} color="white" />
              )
            }
            variant={connected ? 'secondary' : 'primary'}
            disabled={busy}
          />
        </View>
      </View>
    </GlassCard>
  );
}
