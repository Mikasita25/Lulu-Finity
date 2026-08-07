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
      contentContainerClassName="px-4 pb-32 pt-3"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      <View className={`w-full max-w-[960px] self-center ${contentClassName}`}>{children}</View>
    </ScrollView>
  ) : (
    <View className="flex-1 px-4 pb-24 pt-3">
      <View className={`w-full max-w-[960px] flex-1 self-center ${contentClassName}`}>{children}</View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#09070D', '#140A18', '#09070D']}
      locations={[0, 0.48, 1]}
      className="flex-1"
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        {content}
      </SafeAreaView>
    </LinearGradient>
  );
}
