import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentClassName?: string;
  scrollProps?: ScrollViewProps;
}>;

export function Screen({ children, scroll = true, contentClassName = '', scrollProps }: Props) {
  const content = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-[18px] pb-32 pt-3"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      <View className={`w-full max-w-[960px] self-center ${contentClassName}`}>{children}</View>
    </ScrollView>
  ) : (
    <View className="flex-1 px-[18px] pb-24 pt-3">
      <View className={`w-full max-w-[960px] flex-1 self-center ${contentClassName}`}>{children}</View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0B0810', '#120B16', '#0B0810']}
      locations={[0, 0.42, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {content}
      </SafeAreaView>
    </LinearGradient>
  );
}
