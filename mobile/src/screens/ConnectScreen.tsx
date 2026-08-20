import { Text, View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { LiveConnectionCard } from '@/components/LiveConnectionCard';

export function ConnectScreen({ navigation }: any) {
  return (
    <Screen>
      <View className="mb-7 mt-8">
        <View className="h-14 w-14 items-center justify-center rounded-3xl bg-lulu-500/20">
          <Radio size={28} color="#FF79CF" />
        </View>
        <Text className="mt-5 text-3xl font-black tracking-tight text-white">Conecta tu LIVE</Text>
        <Text className="mt-2 max-w-[340px] text-sm leading-6 text-white/50">
          Igual que en PC: escribe el usuario, revisa el estado y conecta desde el mismo panel.
        </Text>
      </View>

      <LiveConnectionCard />

      <Text
        onPress={() => navigation.replace('Main')}
        className="mt-2 text-center text-xs font-bold text-white/40"
      >
        Ir al inicio
      </Text>
    </Screen>
  );
}
