import './global.css';
import React, { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from '@/navigation/AppNavigator';
import { SplashView } from '@/components/SplashView';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useAppStore } from '@/store/useAppStore';
import { useUpdateStore } from '@/store/useUpdateStore';
import { configureNotifications } from '@/services/notifications';

type BoundaryState = { error?: Error };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[LuluFinity] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorEyebrow}>LULÚ FINITY</Text>
        <Text style={styles.errorTitle}>La interfaz encontró un error</Text>
        <Text style={styles.errorBody}>Ya no ocultamos los errores detrás de una pantalla negra. Toma una captura de este mensaje si vuelve a ocurrir.</Text>
        <View style={styles.errorBox}><Text selectable style={styles.errorMessage}>{this.state.error.message || String(this.state.error)}</Text></View>
        <Pressable style={styles.retryButton} onPress={() => this.setState({ error: undefined })}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>
      </View>
    );
  }
}

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated);
  const setHydrated = useAppStore((state) => state.setHydrated);
  const [splashDone, setSplashDone] = useState(false);
  const promptedUpdate = useRef<string | undefined>(undefined);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    // El video dura 9.6 s. Este límite solo evita bloquear el arranque si el
    // reproductor nativo no puede abrirlo en un dispositivo concreto.
    const splashFallback = setTimeout(finishSplash, 14_000);
    const hydrationFallback = setTimeout(() => {
      if (!useAppStore.getState().hydrated) setHydrated(true);
    }, 3000);
    configureNotifications().catch((error) => console.warn('[LuluFinity] notification setup skipped', error));
    return () => {
      clearTimeout(splashFallback);
      clearTimeout(hydrationFallback);
    };
  }, [finishSplash, setHydrated]);

  useEffect(() => {
    if (!hydrated || !splashDone) return;
    const updateStore = useUpdateStore.getState();
    if (!updateStore.autoCheckEnabled) return;

    // No bloquea el arranque. Si la revisión ya se hizo recientemente, el store
    // devuelve la actualización guardada en vez de olvidarla hasta el día siguiente.
    updateStore.check(false).then((update) => {
      if (!update?.available) return;
      const latestState = useUpdateStore.getState();
      if (latestState.dismissedVersion === update.latestVersion) return;
      if (promptedUpdate.current === update.latestVersion) return;
      promptedUpdate.current = update.latestVersion;

      const url = update.downloadUrl || update.releaseUrl;
      Alert.alert(
        `Lulú Finity Mobile ${update.latestVersion}`,
        'Hay una actualización disponible. Puedes descargar el APK nuevo ahora; Android te pedirá confirmar la instalación.',
        [
          {
            text: 'Ahora no',
            style: 'cancel',
            onPress: () => useUpdateStore.getState().dismissVersion(update.latestVersion),
          },
          ...(url
            ? [{
                text: 'Descargar',
                onPress: () => {
                  Linking.openURL(url).catch((error) => console.warn('[LuluFinity] update link failed', error));
                },
              }]
            : []),
        ],
      );
    }).catch(() => {});
  }, [hydrated, splashDone]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#09070D" />
      <AppErrorBoundary>
        {!hydrated || !splashDone ? <SplashView onFinished={finishSplash} /> : <View style={styles.appRoot}><AppNavigator /><CelebrationOverlay /></View>}
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: '#09070D' },
  errorRoot: { flex: 1, backgroundColor: '#09070D', paddingHorizontal: 24, justifyContent: 'center' },
  errorEyebrow: { color: '#FF79CF', fontSize: 12, fontWeight: '900', letterSpacing: 2.5, marginBottom: 12 },
  errorTitle: { color: '#FFFFFF', fontSize: 26, lineHeight: 32, fontWeight: '900' },
  errorBody: { color: '#C9BBC7', fontSize: 15, lineHeight: 22, marginTop: 12 },
  errorBox: { marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: '#5F3E57', backgroundColor: '#171018', padding: 14 },
  errorMessage: { color: '#FFD5ED', fontSize: 13, lineHeight: 19 },
  retryButton: { marginTop: 20, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF5FC8' },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
