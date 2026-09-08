import { playerAutomation } from '@/services/playerAutomation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, ChevronDown, Search, RefreshCw, Pause, Play } from 'lucide-react-native';
import { useBrowserStore } from '@/store/useBrowserStore';
import { browserSearchUrl, isYouTubeUrl } from '@/services/browserUrl';
import { useAppStore } from '@/store/useAppStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';
import { subscribeSoundEffectPlayback, subscribeTtsPlayback } from '@/services/audioCoordinator';

// A one-second silent MP3 keeps Expo Audio's MediaSessionService active while the
// audible YouTube media remains in WebView. The foreground media session prevents
// Android from treating Lulú as an ordinary background process during playback.
const BACKGROUND_KEEPER_URI =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/4zjAAAAAAAAAAAAASW5mbwAAAA8AAAAQAAAFWAA1NTU1NTVDQ0NDQ0NQUFBQUFBeXl5eXl5ra2tra2treXl5eXl5hoaGhoaGlJSUlJSUoaGhoaGhoa+vr6+vr7y8vLy8vMrKysrKytfX19fX19fl5eXl5eXy8vLy8vL///////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAKAAAAAAAAABVgIAJWUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4xjEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

export function MusicPlaybackHost() {
  const browser = useBrowserStore();
  const [sourceUrl, setSourceUrl] = useState('https://m.youtube.com');
  const [address, setAddress] = useState('');
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [browserError, setBrowserError] = useState('');
  const [autoSelect, setAutoSelect] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const relayState = useAppStore((state) => state.relayState);
  const username = useAppStore((state) => state.username);
  const music = useMobileControlStore((state) => state.music);
  const soundMix = useAppStore((state) => state.soundMix);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const playbackPaused = useMobileControlStore((state) => state.playbackPaused);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const setPlaybackStatus = useMobileControlStore((state) => state.setPlaybackStatus);
  const webRef = useRef<WebView>(null);
  const lastQuery = useRef<string | undefined>(undefined);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [ttsActive, setTtsActive] = useState(false);
  const [soundEffectActive, setSoundEffectActive] = useState(false);
  const keeper = useAudioPlayer(BACKGROUND_KEEPER_URI, { updateInterval: 1000 });
  const liveActive = relayState === 'connecting' || relayState === 'rotating' || relayState === 'connected';
  const musicActive = music.enabled && (Boolean(currentSong) || browser.playing);
  const keepSessionActive = liveActive || (musicActive && music.backgroundPlayback && !playbackPaused);

  const playbackVolume = ttsActive
    ? Math.min(music.volume, music.ttsDuckingVolume)
    : soundEffectActive && soundMix.duckMusic
      ? Math.min(music.volume, soundMix.duckMusicVolume)
      : music.volume;

  useEffect(() => {
    if (!currentSong) return;
    setAutoSelect(true);
    const nextUrl = youtubeSearchUrl(currentSong.query);
    if (lastQuery.current === nextUrl) webRef.current?.reload();
    lastQuery.current = nextUrl;
    setSourceUrl(nextUrl);
  }, [currentSong?.id]);

  useEffect(() => { webRef.current?.reload(); }, [desktop]);

  const navigate = () => {
    if (!address.trim()) return;
    setAutoSelect(false);
    useMobileControlStore.setState({ currentSong: undefined, playbackPaused: false });
    setSourceUrl(browserSearchUrl(address));
    Keyboard.dismiss();
  };

  useEffect(() => {
    if (!browser.open) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canBack) webRef.current?.goBack(); else browser.hide();
      return true;
    });
    return () => back.remove();
  }, [browser.open, canBack]);
  const automation = useMemo(
    () => playerAutomation(playbackVolume, playbackPaused, music.adBlockEnabled, music.autoSkipAds, autoSelect, music.backgroundPlayback),
    [music.adBlockEnabled, music.autoSkipAds, playbackPaused, playbackVolume, autoSelect, music.backgroundPlayback],
  );

  useEffect(() => subscribeTtsPlayback(setTtsActive), []);
  useEffect(() => subscribeSoundEffectPlayback(setSoundEffectActive), []);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    }).catch((error) => console.warn('[LuluFinity] background audio mode failed', error));
  }, []);

  useEffect(() => {
    keeper.loop = true;
    keeper.volume = 0;
  }, [keeper]);

  useEffect(() => {
    if (!keepSessionActive) {
      keeper.pause();
      keeper.clearLockScreenControls();
      return;
    }

    keeper.setActiveForLockScreen(
      true,
      currentSong
        ? {
            title: currentSong.query,
            artist: `Pedido por @${currentSong.requestedBy}`,
            albumTitle: 'Lulú Finity',
          }
        : {
            title: browser.playing ? browser.title : 'TTS Bot activo',
            artist: username ? `Escuchando @${username}` : 'Escuchando el LIVE',
            albumTitle: 'Lulú Finity',
          },
      { showSeekBackward: false, showSeekForward: false },
    );

    keeper.play();
  }, [currentSong?.id, keepSessionActive, keeper, playbackPaused, username, browser.title, browser.playing]);

  useEffect(() => {
    if (!music.enabled || (!currentSong && !browser.initialized)) return;

    webRef.current?.injectJavaScript(automation);
    if (keepSessionActive) keeper.play();
  }, [automation, currentSong?.id, keepSessionActive, keeper, music.enabled, browser.initialized]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (keepSessionActive) keeper.play();
      if (!music.enabled || (!currentSong && !browser.initialized)) return;
      if ((nextState === 'background' || nextState === 'inactive') && !music.backgroundPlayback) {
        webRef.current?.injectJavaScript(playerAutomation(playbackVolume, true, music.adBlockEnabled, music.autoSkipAds, autoSelect, music.backgroundPlayback));
        return;
      }
      if (nextState === 'background' || nextState === 'inactive' || nextState === 'active') {
        webRef.current?.injectJavaScript(playerAutomation(playbackVolume, playbackPaused, music.adBlockEnabled, music.autoSkipAds, autoSelect, music.backgroundPlayback));
      }
    });
    return () => subscription.remove();
  }, [currentSong?.id, keepSessionActive, keeper, music.adBlockEnabled, music.autoSkipAds, music.backgroundPlayback, music.enabled, playbackPaused, playbackVolume, autoSelect, browser.initialized]);

  useEffect(
    () => () => {
      clearTimeout(loadTimer.current);
      keeper.clearLockScreenControls();
    },
    [keeper],
  );

  if (!music.enabled || (!currentSong && !browser.initialized)) return null;

  return (
    <View
      pointerEvents={browser.open ? 'auto' : 'none'}
      accessibilityElementsHidden={!browser.open}
      importantForAccessibility={browser.open ? 'auto' : 'no-hide-descendants'}
      style={browser.open
        ? { position: 'absolute', inset: 0, zIndex: 100, backgroundColor: '#101321' }
        : { position: 'absolute', left: -500, top: 0, width: 360, height: 640, opacity: 0.01 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={{ display: browser.open ? 'flex' : 'none', padding: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: '#F8F5FF', fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{browser.title}</Text>
          <Pressable accessibilityLabel="Minimizar navegador" onPress={browser.hide} style={{ padding: 10 }}><ChevronDown color="#C5B5FF" size={24} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: '#22283B', borderRadius: 18, alignItems: 'center', paddingHorizontal: 12 }}>
          <TextInput value={address} onChangeText={setAddress} onSubmitEditing={navigate} placeholder="Buscar o pegar enlace de YouTube" placeholderTextColor="#ADB4CE" autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{ flex: 1, minHeight: 48, color: '#FFFFFF' }} accessibilityLabel="Buscar en YouTube" />
          <Pressable onPress={navigate} accessibilityLabel="Buscar" style={{ padding: 10 }}><Search color="#C5B5FF" size={20} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable disabled={!canBack} onPress={() => webRef.current?.goBack()} accessibilityLabel="Página anterior" style={{ padding: 12, opacity: canBack ? 1 : 0.3 }}><ArrowLeft color="white" size={20} /></Pressable>
          <Pressable disabled={!canForward} onPress={() => webRef.current?.goForward()} accessibilityLabel="Página siguiente" style={{ padding: 12, opacity: canForward ? 1 : 0.3 }}><ArrowRight color="white" size={20} /></Pressable>
          <Pressable onPress={() => webRef.current?.reload()} accessibilityLabel="Recargar" style={{ padding: 12 }}><RefreshCw color="white" size={20} /></Pressable>
          <Pressable onPress={() => useMobileControlStore.getState().setPlaybackPaused(!playbackPaused)} accessibilityLabel={playbackPaused ? 'Continuar' : 'Pausar'} style={{ padding: 12 }}>{playbackPaused ? <Play color="#C5B5FF" size={20} /> : <Pause color="#C5B5FF" size={20} />}</Pressable>
          <Pressable accessibilityLabel="Cambiar modo de escritorio" onPress={() => { setDesktop(!desktop); }} style={{ padding: 10 }}><Text style={{ color: '#C5B5FF', fontSize: 11 }}>{desktop ? 'Escritorio' : 'Móvil'}</Text></Pressable>
          <Text style={{ color: '#ADB4CE', fontSize: 11 }}>{pageLoading ? 'Cargando…' : music.backgroundPlayback ? 'Segundo plano activo' : 'Solo en pantalla'}</Text>
        </View>
        {browserError ? <Text accessibilityRole="alert" style={{ color: '#FFABBA' }}>{browserError}</Text> : null}
      </View>
      <WebView
        ref={webRef}
        source={{ uri: sourceUrl }}
        style={{ flex: 1, backgroundColor: '#101321' }}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        mixedContentMode="never"
        androidLayerType="hardware"
        userAgent={desktop ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' : undefined}
        injectedJavaScriptBeforeContentLoaded={automation}
        injectedJavaScript={automation}
        onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || isYouTubeUrl(request.url)}
        onNavigationStateChange={(nav) => {
          setCanBack(nav.canGoBack);
          setCanForward(nav.canGoForward);
          setPageLoading(nav.loading);
        }}
        onLoadStart={() => {
          clearTimeout(loadTimer.current);
          setPageLoading(true);
          setBrowserError('');
          browser.setPlaying(false);
          setPlaybackStatus('loading', 'Cargando la canción…');
          loadTimer.current = setTimeout(() => {
            setPageLoading(false);
            setBrowserError('YouTube tarda en responder. Puedes recargar la página.');
            setPlaybackStatus('error', 'La página tardó demasiado en cargar.');
          }, 25_000);
        }}
        onLoadEnd={() => {
          setPageLoading(false);
          webRef.current?.injectJavaScript(automation);
          clearTimeout(loadTimer.current);
          loadTimer.current = setTimeout(() => {
            const state = useMobileControlStore.getState();
            if (currentSong && state.currentSong?.id === currentSong.id && state.playbackStatus === 'loading' && autoSelect) {
              setPlaybackStatus('error', 'YouTube no inició la canción. Toca Reintentar.');
            }
          }, 15_000);
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message?.type === 'user-pause' || message?.type === 'user-play') {
              useMobileControlStore.getState().setPlaybackPaused(message.type === 'user-pause');
              browser.setPlaying(message.type === 'user-play');
            }
            if (message?.type === 'playing') {
              browser.setPlaying(true, String(message.title || 'YouTube'));
              clearTimeout(loadTimer.current);
              setPlaybackStatus('playing', 'Reproduciendo correctamente.');
            }
            if (message?.type === 'ended') {
              setPlaybackStatus('loading', 'Cargando la siguiente canción…');
              browser.setPlaying(false);
              if (autoSelect && !playNextSong()) useMobileControlStore.getState().setPlaybackPaused(true);
            }
            if (message?.type === 'video-error') {
              setPlaybackStatus('error', 'YouTube no pudo reproducir este video.');
            }
          } catch {}
        }}
        onError={() => {
          clearTimeout(loadTimer.current);
          setPageLoading(false);
          setBrowserError('No se pudo cargar YouTube. Revisa la conexión y toca recargar.');
          browser.setPlaying(false);
          setPlaybackStatus('error', 'No se pudo conectar con YouTube. Toca Reintentar.');
        }}
        onRenderProcessGone={() => { browser.setPlaying(false); setBrowserError('El navegador se cerró. Toca recargar para recuperarlo.'); setPlaybackStatus('error', 'El navegador necesita recargarse.'); }}
        onContentProcessDidTerminate={() => {
          setPlaybackStatus('loading', 'Reactivando el reproductor…');
          webRef.current?.reload();
        }}
      />
      </SafeAreaView>
    </View>
  );
}
