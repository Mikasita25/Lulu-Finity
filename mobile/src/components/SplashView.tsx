import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const startupVideo = require('../../assets/startup-lulu.mp4');

export function SplashView({ onFinished }: { onFinished: () => void }) {
  const finished = useRef(false);
  const pulse = useSharedValue(0.45);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  }, [onFinished]);

  const player = useVideoPlayer(startupVideo, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEventListener(player, 'playToEnd', finish);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') finish();
  });

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [pulse]);

  const loaderStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scaleX: 0.55 + pulse.value * 0.45 }],
  }));

  return (
    <LinearGradient
      colors={['#050508', '#130A16', '#050508']}
      locations={[0, 0.5, 1]}
      style={styles.root}
    >
      <View style={styles.videoFrame}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
          surfaceType="textureView"
        />
      </View>

      <Text style={styles.loadingLabel}>Iniciando Lulu Finity</Text>

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
  videoFrame: {
    width: '88%',
    maxWidth: 440,
    aspectRatio: 16 / 9,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,121,207,0.22)',
    backgroundColor: '#020204',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#020204',
  },
  loadingLabel: {
    color: '#F5D6EA',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 28,
  },
  track: {
    width: 148,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginTop: 14,
  },
  loader: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FF5FC8',
  },
});
