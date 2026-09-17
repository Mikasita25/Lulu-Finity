import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentClassName?: string;
  scrollProps?: ScrollViewProps;
}>;

export function Screen({
  children,
  scroll = true,
  contentClassName = '',
  scrollProps,
}: Props) {
  const content = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-[18px] pb-40 pt-3"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      <View className={`w-full max-w-[960px] self-center ${contentClassName}`}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View className="flex-1 px-[18px] pb-32 pt-3">
      <View
        className={`w-full max-w-[960px] flex-1 self-center ${contentClassName}`}
      >
        {children}
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0D1026', '#17183B', '#0A0D21']}
      locations={[0, 0.46, 1]}
      style={{ flex: 1 }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -90,
          right: -90,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(167,98,255,0.16)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 260,
          left: -130,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(214,133,255,0.09)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 100,
          right: -150,
          width: 340,
          height: 340,
          borderRadius: 170,
          backgroundColor: 'rgba(116,221,228,0.055)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 72,
          right: 36,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(242,183,255,0.65)',
          shadowColor: '#F2B7FF',
          shadowOpacity: 0.8,
          shadowRadius: 5,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 188,
          left: 20,
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(247,243,255,0.55)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 410,
          right: 22,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(247,243,255,0.42)',
        }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {content}
      </SafeAreaView>
    </LinearGradient>
  );
}
