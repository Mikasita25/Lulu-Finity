import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';

export function SplashView() {
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [pulse]);

  const loaderStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scaleX: 0.55 + pulse.value * 0.45 }],
  }));

  return (
    <LinearGradient
      colors={['#09070D', '#1C0B20', '#09070D']}
      locations={[0, 0.5, 1]}
      style={styles.root}
    >
      <View style={styles.logoBox}>
        <Sparkles size={44} color="#FF79CF" strokeWidth={2.4} />
      </View>

      <Text style={styles.title}>Lulú Finity</Text>
      <Text style={styles.subtitle}>LIVE COMPANION PARA ANDROID</Text>
      <Text style={styles.loadingLabel}>Iniciando Lulú Finity…</Text>

      <View style={styles.track}>
        <Animated.View style={[styles.loader, loaderStyle]} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,121,207,0.30)',
    backgroundColor: 'rgba(255,95,200,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 24 },
  subtitle: {
    color: '#E6B7D5',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: 7,
  },
  loadingLabel: { color: '#B9A8B6', fontSize: 13, fontWeight: '700', marginTop: 34 },
  track: {
    width: 148,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginTop: 12,
  },
  loader: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FF5FC8',
  },
});
