import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { WebView } from 'react-native-webview';
import { useAppStore } from '@/store/useAppStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';
import { resolveAudiusTrack, type AudiusTrack } from '@/services/audius';
import { duckMusicVolume, subscribeTtsActivity } from '@/services/audioCoordinator';

// El keeper solo mantiene el foreground MediaSession cuando no hay una pista
// nativa de Audius reproduciéndose (por ejemplo LIVE + TTS o fallback YouTube).
const BACKGROUND_KEEPER_URI =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/4zjAAAAAAAAAAAAASW5mbwAAAA8AAAAQAAAFWAA1NTU1NTVDQ0NDQ0NQUFBQUFBeXl5eXl5ra2tra2treXl5eXl5hoaGhoaGlJSUlJSUoaGhoaGhoa+vr6+vr7y8vLy8vMrKysrKytfX19fX19fl5eXl5eXy8vLy8vL///////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAKAAAAAAAAABVgIAJWUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4xjEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

type MusicProvider = 'idle' | 'resolving' | 'audius' | 'youtube';

function youtubeAutomation(volume: number, paused: boolean) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  return `
(() => {
  window.__luluDesiredVolume = ${safeVolume};
  window.__luluPlaybackPaused = ${paused ? 'true' : 'false'};

  const send = (payload) => {
    try { window.ReactNativeWebView?.postMessage(JSON.stringify(payload)); } catch (_) {}
  };

  const apply = () => {
    if (location.pathname.includes('/results')) {
      const links = Array.from(document.querySelectorAll('a[href*="/watch?v="]'));
      const first = links.find((node) => {
        const href = node.getAttribute('href') || '';
        return href.includes('/watch?v=') && !href.includes('/shorts/');
      });
      if (first && !window.__luluOpeningResult) {
        window.__luluOpeningResult = true;
        try { first.click(); } catch (_) {
          const href = first.getAttribute('href');
          if (href) location.href = href;
        }
        setTimeout(() => { window.__luluOpeningResult = false; }, 3500);
      }
      return;
    }

    const video = document.querySelector('video');
    if (!video) return;
    try {
      video.muted = false;
      video.volume = window.__luluDesiredVolume;
      video.autoplay = true;
    } catch (_) {}

    if (video.dataset.luluBound !== '1') {
      video.dataset.luluBound = '1';
      video.addEventListener('playing', () => send({ type: 'playing' }));
      video.addEventListener('ended', () => send({ type: 'ended' }));
      video.addEventListener('error', () => send({ type: 'video-error' }));
    }

    if (window.__luluPlaybackPaused) {
      try { video.pause(); } catch (_) {}
    } else if (video.paused && !video.ended) {
      try {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      } catch (_) {}
    }
  };

  if (!window.__luluAutoPlayerInstalled) {
    window.__luluAutoPlayerInstalled = true;
    const observer = new MutationObserver(apply);
    if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(apply, 1000);
  }
  apply();
  true;
})();
`;
}

export function MusicPlaybackHostV2() {
  const relayState = useAppStore((state) => state.relayState);
  const username = useAppStore((state) => state.username);
  const music = useMobileControlStore((state) => state.music);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const playbackPaused = useMobileControlStore((state) => state.playbackPaused);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const setPlaybackStatus = useMobileControlStore((state) => state.setPlaybackStatus);

  const [ttsActive, setTtsActive] = useState(false);
  const [provider, setProvider] = useState<MusicProvider>('idle');
  const [audiusTrack, setAudiusTrack] = useState<AudiusTrack | null>(null);
  const resolutionId = useRef(0);
  const fallbackRequested = useRef(false);
  const finishedSongId = useRef('');
  const webRef = useRef<WebView>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const nativePlayer = useAudioPlayer(null, {
    updateInterval: 500,
    preferredForwardBufferDuration: 8,
  });
  const keeper = useAudioPlayer(BACKGROUND_KEEPER_URI, { updateInterval: 1000 });

  const liveActive = relayState === 'connecting' || relayState === 'rotating' || relayState === 'connected';
  const musicActive = music.enabled && Boolean(currentSong);
  const effectiveVolume = duckMusicVolume(music.volume, ttsActive);
  const keeperNeeded =
    (liveActive && (provider !== 'audius' || playbackPaused)) ||
    (musicActive && provider === 'youtube' && !playbackPaused);
  const youtubeUrl = provider === 'youtube' && currentSong ? youtubeSearchUrl(currentSong.query) : '';
  const automation = useMemo(
    () => youtubeAutomation(effectiveVolume, playbackPaused),
    [effectiveVolume, playbackPaused],
  );

  useEffect(() => subscribeTtsActivity(setTtsActive), []);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((error) => console.warn('[LuluFinity] background audio mode failed', error));
  }, []);

  useEffect(() => {
    keeper.loop = true;
    keeper.volume = 0;
  }, [keeper]);

  useEffect(() => {
    const song = currentSong;
    const requestId = ++resolutionId.current;
    fallbackRequested.current = false;
    finishedSongId.current = '';
    clearTimeout(loadTimer.current);

    try {
      nativePlayer.pause();
      nativePlayer.clearLockScreenControls();
      nativePlayer.replace(null);
    } catch {}
    setAudiusTrack(null);

    if (!music.enabled || !song) {
      setProvider('idle');
      return;
    }

    setProvider('resolving');
    setPlaybackStatus('loading', 'Buscando una fuente estable para segundo plano…');
    const controller = new AbortController();

    void resolveAudiusTrack(song.query, controller.signal)
      .then((track) => {
        if (controller.signal.aborted || requestId !== resolutionId.current) return;
        if (!track) {
          setProvider('youtube');
          setPlaybackStatus('loading', 'No está en Audius; usando YouTube mientras Lulú esté abierta.');
          return;
        }

        setAudiusTrack(track);
        setProvider('audius');
        try {
          nativePlayer.replace(track.streamUrl);
          nativePlayer.loop = false;
          nativePlayer.volume = duckMusicVolume(useMobileControlStore.getState().music.volume, ttsActive);
        } catch (error) {
          console.warn('[LuluFinity] no se pudo preparar Audius', error);
          setAudiusTrack(null);
          setProvider('youtube');
          setPlaybackStatus('loading', 'Audius no pudo abrir la pista; usando YouTube.');
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== resolutionId.current) return;
        console.warn('[LuluFinity] búsqueda Audius falló', error);
        setProvider('youtube');
        setPlaybackStatus('loading', 'Audius no respondió; usando YouTube mientras Lulú esté abierta.');
      });

    return () => controller.abort();
  }, [currentSong?.id, music.enabled, nativePlayer, setPlaybackStatus, ttsActive]);

  useEffect(() => {
    if (provider !== 'audius' || !audiusTrack || !currentSong) return;

    nativePlayer.volume = effectiveVolume;
    nativePlayer.setActiveForLockScreen(
      true,
      {
        title: audiusTrack.title || currentSong.query,
        artist: audiusTrack.artist || `Pedido por @${currentSong.requestedBy}`,
        albumTitle: 'Lulú Finity',
        ...(audiusTrack.artworkUrl ? { artworkUrl: audiusTrack.artworkUrl } : {}),
      },
      { showSeekBackward: false, showSeekForward: false },
    );

    try {
      if (playbackPaused) nativePlayer.pause();
      else nativePlayer.play();
    } catch (error) {
      console.warn('[LuluFinity] reproducción nativa no inició', error);
    }
  }, [audiusTrack, currentSong?.id, effectiveVolume, nativePlayer, playbackPaused, provider]);

  useEffect(() => {
    const subscription = nativePlayer.addListener('playbackStatusUpdate', (status) => {
      if (provider !== 'audius' || !currentSong) return;

      if (status.error && !fallbackRequested.current) {
        fallbackRequested.current = true;
        console.warn('[LuluFinity] Audius playback error', status.error);
        try {
          nativePlayer.pause();
          nativePlayer.clearLockScreenControls();
        } catch {}
        setAudiusTrack(null);
        setProvider('youtube');
        setPlaybackStatus('loading', 'La pista de Audius falló; cambiando a YouTube.');
        return;
      }

      if (status.playing) {
        setPlaybackStatus('playing', 'Reproduciendo en segundo plano.');
      }

      if (status.didJustFinish && finishedSongId.current !== currentSong.id) {
        finishedSongId.current = currentSong.id;
        try { nativePlayer.clearLockScreenControls(); } catch {}
        setPlaybackStatus('loading', 'Cargando la siguiente canción…');
        playNextSong();
      }
    });

    return () => subscription.remove();
  }, [currentSong?.id, nativePlayer, playNextSong, provider, setPlaybackStatus]);

  useEffect(() => {
    if (!keeperNeeded) {
      keeper.pause();
      keeper.clearLockScreenControls();
      return;
    }

    keeper.setActiveForLockScreen(
      true,
      currentSong && provider === 'youtube'
        ? {
            title: currentSong.query,
            artist: `Pedido por @${currentSong.requestedBy}`,
            albumTitle: 'Lulú Finity',
          }
        : {
            title: 'TTS Bot activo',
            artist: username ? `Escuchando @${username}` : 'Escuchando el LIVE',
            albumTitle: 'Lulú Finity',
          },
      { showSeekBackward: false, showSeekForward: false },
    );
    keeper.play();
  }, [currentSong?.id, keeper, keeperNeeded, provider, username]);

  useEffect(() => {
    if (provider !== 'youtube' || !currentSong) return;
    webRef.current?.injectJavaScript(automation);
  }, [automation, currentSong?.id, provider]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (keeperNeeded) {
        try { keeper.play(); } catch {}
      }
      if (nextState === 'active' && provider === 'youtube' && currentSong && !playbackPaused) {
        webRef.current?.injectJavaScript(youtubeAutomation(duckMusicVolume(music.volume, ttsActive), false));
      }
    });
    return () => subscription.remove();
  }, [currentSong?.id, keeper, keeperNeeded, music.volume, playbackPaused, provider, ttsActive]);

  useEffect(
    () => () => {
      resolutionId.current += 1;
      clearTimeout(loadTimer.current);
      try {
        nativePlayer.pause();
        nativePlayer.clearLockScreenControls();
        keeper.pause();
        keeper.clearLockScreenControls();
      } catch {}
    },
    [keeper, nativePlayer],
  );

  if (!music.enabled || !currentSong || provider !== 'youtube' || !youtubeUrl) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -500, top: 0, width: 360, height: 640, opacity: 0.01 }}
    >
      <WebView
        ref={webRef}
        key={`${currentSong.id}-youtube`}
        source={{ uri: youtubeUrl }}
        style={{ width: 360, height: 640 }}
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
        userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
        injectedJavaScriptBeforeContentLoaded={automation}
        injectedJavaScript={automation}
        onLoadStart={() => {
          clearTimeout(loadTimer.current);
          setPlaybackStatus('loading', 'Cargando en YouTube…');
        }}
        onLoadEnd={() => {
          webRef.current?.injectJavaScript(automation);
          clearTimeout(loadTimer.current);
          loadTimer.current = setTimeout(() => {
            const state = useMobileControlStore.getState();
            if (state.currentSong?.id === currentSong.id && state.playbackStatus === 'loading') {
              setPlaybackStatus('error', 'YouTube no inició la canción. Toca Reintentar.');
            }
          }, 15_000);
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message?.type === 'playing') {
              clearTimeout(loadTimer.current);
              setPlaybackStatus('playing', 'Reproduciendo con YouTube en primer plano.');
            }
            if (message?.type === 'ended') {
              setPlaybackStatus('loading', 'Cargando la siguiente canción…');
              playNextSong();
            }
            if (message?.type === 'video-error') {
              setPlaybackStatus('error', 'YouTube no pudo reproducir este video.');
            }
          } catch {}
        }}
        onError={() => {
          clearTimeout(loadTimer.current);
          setPlaybackStatus('error', 'No se pudo conectar con YouTube. Toca Reintentar.');
        }}
      />
    </View>
  );
}
