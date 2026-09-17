import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { palette } from '@/theme/palette';

export type LuluDialogTone = 'info' | 'success' | 'warning' | 'danger';
export type LuluDialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};
type DialogState = {
  title: string;
  message: string;
  tone: LuluDialogTone;
  actions: LuluDialogAction[];
} | null;

let current: DialogState = null;
const listeners = new Set<(dialog: DialogState) => void>();

export function showLuluDialog(
  title: string,
  message: string,
  actions: LuluDialogAction[] = [{ text: 'Entendido' }],
  tone: LuluDialogTone = 'info',
) {
  current = { title, message, actions, tone };
  listeners.forEach((listener) => listener(current));
}

function dismiss() {
  current = null;
  listeners.forEach((listener) => listener(null));
}

const toneMeta = {
  info: { color: palette.pink, Icon: Info },
  success: { color: palette.success, Icon: CheckCircle2 },
  warning: { color: palette.warning, Icon: TriangleAlert },
  danger: { color: palette.danger, Icon: AlertCircle },
};

export function LuluDialogHost() {
  const [dialog, setDialog] = useState<DialogState>(current);
  useEffect(() => {
    listeners.add(setDialog);
    return () => {
      listeners.delete(setDialog);
    };
  }, []);
  if (!dialog) return null;
  const { color, Icon } = toneMeta[dialog.tone];
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <BlurView intensity={28} tint="dark" style={{ flex: 1 }}>
        <View className="flex-1 justify-center bg-[#080B1D]/65 px-5">
          <GlassCard variant={dialog.tone === 'danger' ? 'danger' : 'hero'}>
            <View className="p-5">
              <View className="flex-row items-start gap-3">
                <View
                  style={{
                    backgroundColor: `${color}1F`,
                    borderColor: `${color}45`,
                  }}
                  className="h-11 w-11 items-center justify-center rounded-2xl border"
                >
                  <Icon size={20} color={color} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-black text-white">
                    {dialog.title}
                  </Text>
                  <Text className="mt-2 text-sm leading-6 text-white/65">
                    {dialog.message}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Cerrar"
                  onPress={dismiss}
                  className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.055]"
                >
                  <X size={17} color={palette.muted} />
                </Pressable>
              </View>
              <View className="mt-5 gap-2">
                {dialog.actions.map((action) => (
                  <Button
                    key={action.text}
                    label={action.text}
                    variant={
                      action.style === 'destructive'
                        ? 'danger'
                        : action.style === 'cancel'
                          ? 'secondary'
                          : 'primary'
                    }
                    onPress={() => {
                      dismiss();
                      action.onPress?.();
                    }}
                  />
                ))}
              </View>
            </View>
          </GlassCard>
        </View>
      </BlurView>
    </Modal>
  );
}
