import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { WebView } from 'react-native-webview';
import { useAppStore } from '@/store/useAppStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';
import { subscribeSoundEffectPlayback, subscribeTtsPlayback } from '@/services/audioCoordinator';

// A one-second silent MP3 keeps Expo Audio's MediaSessionService active while the
// audible YouTube media remains in WebView. The foreground media session prevents
// Android from treating Lulú as an ordinary background process during playback.
const BACKGROUND_KEEPER_URI =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/4zjAAAAAAAAAAAAASW5mbwAAAA8AAAAQAAAFWAA1NTU1NTVDQ0NDQ0NQUFBQUFBeXl5eXl5ra2tra2treXl5eXl5hoaGhoaGlJSUlJSUoaGhoaGhoa+vr6+vr7y8vLy8vMrKysrKytfX19fX19fl5eXl5eXy8vLy8vL///////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAKAAAAAAAAABVgIAJWUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4xjEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

function playerAutomation(volume: number, paused: boolean, adBlockEnabled: boolean, autoSkipAds: boolean) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  return `
(() => {
  window.__luluDesiredVolume = ${safeVolume};
  window.__luluPlaybackPaused = ${paused ? 'true' : 'false'};
  window.__luluAdBlockEnabled = ${adBlockEnabled ? 'true' : 'false'};
  window.__luluAutoSkipAds = ${autoSkipAds ? 'true' : 'false'};

  const applyPlaybackState = () => {
    document.querySelectorAll('video, audio').forEach((media) => {
      try {
        if (media.tagName === 'VIDEO') {
          media.muted = false;
          media.volume = window.__luluDesiredVolume;
        }
        if (window.__luluPlaybackPaused) {
          media.pause();
        } else if (media.tagName === 'VIDEO' && media.paused && !media.ended) {
          const promise = media.play();
          if (promise && typeof promise.catch === 'function') promise.catch(() => {});
        }
      } catch (_) {}
    });
  };

  if (window.__luluAutoPlayerInstalled) {
    applyPlaybackState();
    return true;
  }

  window.__luluAutoPlayerInstalled = true;
  let navigating = false;
  let lastEndedAt = 0;

  const send = (payload) => {
    try {
      window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
    } catch (_) {}
  };

  const removeAds = () => {
    if (!window.__luluAdBlockEnabled) return;
    const selectors = [
      '#player-ads', '.ytp-ad-module', '.ytp-ad-overlay-container', '.ytp-ad-player-overlay',
      'ytd-display-ad-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-ad-slot-renderer',
      'ytd-in-feed-ad-layout-renderer', 'ytm-promoted-sparkles-web-renderer',
      'ytm-companion-ad-renderer', 'ytm-ad-slot-renderer', 'ytm-mealbar-promo-renderer'
    ];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        try { node.remove(); } catch (_) {}
      });
    }
    if (!document.getElementById('lulu-adblock-style')) {
      const style = document.createElement('style');
      style.id = 'lulu-adblock-style';
      style.textContent = '#player-ads,.ytp-ad-module,.ytp-ad-overlay-container,[class*="promoted"],[class*="companion-ad"]{display:none!important;visibility:hidden!important}';
      document.documentElement.appendChild(style);
    }
  };

  const skipAds = () => {
    if (!window.__luluAdBlockEnabled || !window.__luluAutoSkipAds) return;
    const skipSelectors = [
      '.ytp-skip-ad-button', '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern',
      'button[class*="skip-ad"]', 'button[class*="skip-button"]'
    ];
    for (const selector of skipSelectors) {
      document.querySelectorAll(selector).forEach((button) => {
        try { button.click(); } catch (_) {}
      });
    }
    const adShowing = document.querySelector('.ad-showing, .ytp-ad-player-overlay, .ytp-ad-text');
    const video = document.querySelector('video');
    if (adShowing && video && Number.isFinite(video.duration) && video.duration > 0) {
      try { video.currentTime = Math.max(0, video.duration - 0.05); } catch (_) {}
    }
  };

  const openFirstResult = () => {
    if (navigating || !location.pathname.includes('/results')) return false;
    const candidates = Array.from(document.querySelectorAll('a[href*="/watch?v="]'));
    const first = candidates.find((node) => {
      const href = node.getAttribute('href') || '';
      return href.includes('/watch?v=') && !href.includes('&list=') && !href.includes('/shorts/');
    }) || candidates[0];
    if (!first) return false;
    navigating = true;
    send({ type: 'resolving', href: first.getAttribute('href') || '' });
    try { first.click(); } catch (_) {
      const href = first.getAttribute('href');
      if (href) location.href = href;
    }
    setTimeout(() => { navigating = false; }, 3500);
    return true;
  };

  const bindAndPlay = () => {
    if (!location.pathname.includes('/watch')) return false;
    const video = document.querySelector('video');
    if (!video) return false;

    try {
      video.muted = false;
      video.volume = window.__luluDesiredVolume;
      video.autoplay = true;
    } catch (_) {}

    if (video.dataset.luluAutoBound !== '1') {
      video.dataset.luluAutoBound = '1';
      video.addEventListener('playing', () => {
        send({ type: 'playing', title: document.title || '', url: location.href });
      });
      video.addEventListener('ended', () => {
        if (document.querySelector('.ad-showing, .ytp-ad-player-overlay, .ytp-ad-text')) return;
        const now = Date.now();
        if (now - lastEndedAt < 1500) return;
        lastEndedAt = now;
        send({ type: 'ended', title: document.title || '', url: location.href });
      });
      video.addEventListener('error', () => send({ type: 'video-error' }));
    }

    if (window.__luluPlaybackPaused) {
      try { video.pause(); } catch (_) {}
      return true;
    }

    if (video.paused && !video.ended) {
      try {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => send({ type: 'autoplay-retry' }));
        }
      } catch (_) {}
    }
    return true;
  };

  const tick = () => {
    removeAds();
    skipAds();
    if (!openFirstResult()) bindAndPlay();
  };

  const observer = new MutationObserver(tick);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(tick, 1000);
  tick();
  true;
})();
`;
}

export function MusicPlaybackHost() {
  const relayState = useAppStore((state) => state.relayState);
  const username = useAppStore((state) => state.username);
  const music = useMobileControlStore((state) => state.music);
  const soundMix = useAppStore((state) => state.soundMix);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const playbackPaused = useMobileControlStore((state) => state.playbackPaused);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const setPlaybackStatus = useMobileControlStore((state) => state.setPlaybackStatus);
  const webRef = useRef<WebView>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [ttsActive, setTtsActive] = useState(false);
  const [soundEffectActive, setSoundEffectActive] = useState(false);
  const keeper = useAudioPlayer(BACKGROUND_KEEPER_URI, { updateInterval: 1000 });
  const liveActive = relayState === 'connecting' || relayState === 'rotating' || relayState === 'connected';
  const musicActive = music.enabled && Boolean(currentSong);
  const keepSessionActive = liveActive || (musicActive && music.backgroundPlayback);

  const playbackVolume = ttsActive
    ? Math.min(music.volume, music.ttsDuckingVolume)
    : soundEffectActive && soundMix.duckMusic
      ? Math.min(music.volume, soundMix.duckMusicVolume)
      : music.volume;

  const sourceUrl = currentSong ? youtubeSearchUrl(currentSong.query) : '';
  const automation = useMemo(
    () => playerAutomation(playbackVolume, playbackPaused, music.adBlockEnabled, music.autoSkipAds),
    [music.adBlockEnabled, music.autoSkipAds, playbackPaused, playbackVolume],
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
            title: 'TTS Bot activo',
            artist: username ? `Escuchando @${username}` : 'Escuchando el LIVE',
            albumTitle: 'Lulú Finity',
          },
      { showSeekBackward: false, showSeekForward: false },
    );

    keeper.play();
  }, [currentSong?.id, keepSessionActive, keeper, playbackPaused, username]);

  useEffect(() => {
    if (!music.enabled || !currentSong) return;

    webRef.current?.injectJavaScript(automation);
    if (keepSessionActive) keeper.play();
  }, [automation, currentSong?.id, keepSessionActive, keeper, music.enabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (keepSessionActive) keeper.play();
      if (!music.enabled || !currentSong) return;
      if ((nextState === 'background' || nextState === 'inactive') && !music.backgroundPlayback) {
        webRef.current?.injectJavaScript(playerAutomation(playbackVolume, true, music.adBlockEnabled, music.autoSkipAds));
        return;
      }
      if (nextState === 'background' || nextState === 'inactive' || nextState === 'active') {
        webRef.current?.injectJavaScript(playerAutomation(playbackVolume, playbackPaused, music.adBlockEnabled, music.autoSkipAds));
      }
    });
    return () => subscription.remove();
  }, [currentSong?.id, keepSessionActive, keeper, music.adBlockEnabled, music.autoSkipAds, music.backgroundPlayback, music.enabled, playbackPaused, playbackVolume]);

  useEffect(
    () => () => {
      clearTimeout(loadTimer.current);
      keeper.clearLockScreenControls();
    },
    [keeper],
  );

  if (!music.enabled || !currentSong || !sourceUrl) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -500, top: 0, width: 360, height: 640, opacity: 0.01 }}
    >
      <WebView
        ref={webRef}
        key={currentSong.id}
        source={{ uri: sourceUrl }}
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
        onShouldStartLoadWithRequest={(request) => {
          if (!music.adBlockEnabled || !music.blockExternalLinks) return true;
          try {
            const host = new URL(request.url).hostname.toLowerCase();
            return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
          } catch {
            return request.url === 'about:blank';
          }
        }}
        onLoadStart={() => {
          clearTimeout(loadTimer.current);
          setPlaybackStatus('loading', 'Cargando la canción…');
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
              setPlaybackStatus('playing', 'Reproduciendo correctamente.');
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
        onContentProcessDidTerminate={() => {
          setPlaybackStatus('loading', 'Reactivando el reproductor…');
          webRef.current?.reload();
        }}
      />
    </View>
  );
}
