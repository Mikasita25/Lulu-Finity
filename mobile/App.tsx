import './global.css';
import { useEffect, useState } from 'react';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar, View } from 'react-native';
import { AppNavigator } from '@/navigation/AppNavigator';
import { SplashView } from '@/components/SplashView';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useAppStore } from '@/store/useAppStore';
import { configureNotifications } from '@/services/notifications';

NativeSplash.setOptions({ duration: 420, fade: true });

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1150);
    configureNotifications().catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  if (!hydrated || !splashDone) return <SplashView />;

  return (
    <View className="flex-1 bg-[#09070D]">
      <StatusBar barStyle="light-content" backgroundColor="#09070D" />
      <AppNavigator />
      <CelebrationOverlay />
    </View>
  );
}
