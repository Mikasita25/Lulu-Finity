import { useEffect, useMemo, useRef } from 'react';
import { AppState, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { WebView } from 'react-native-webview';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';

// A one-second silent MP3 keeps Expo Audio's MediaSessionService active while the
// audible YouTube media remains in WebView. The foreground media session prevents
// Android from treating Lulú as an ordinary background process during playback.
const BACKGROUND_KEEPER_URI =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/4zjAAAAAAAAAAAAASW5mbwAAAA8AAAAQAAAFWAA1NTU1NTVDQ0NDQ0NQUFBQUFBeXl5eXl5ra2tra2treXl5eXl5hoaGhoaGlJSUlJSUoaGhoaGhoa+vr6+vr7y8vLy8vMrKysrKytfX19fX19fl5eXl5eXy8vLy8vL///////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAKAAAAAAAAABVgIAJWUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4xjEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

function playerAutomation(volume: number, paused: boolean) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  return `
(() => {
  window.__luluDesiredVolume = ${safeVolume};
  window.__luluPlaybackPaused = ${paused ? 'true' : 'false'};

  const applyPlaybackState = () => {
    document.querySelectorAll('video, audio').forEach((media) => {
      try {
        if (media.tagName === 'VIDEO') {
          media.muted = false;
          media.volume = window.__luluDesiredVolume;
        }
        if (window.__luluPlaybackPaused) {
          media.pause();
        } else if (media.tagName === 'VIDEO') {
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
  };

  const skipAds = () => {
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

    try {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => send({ type: 'autoplay-retry' }));
      }
    } catch (_) {}
    return true;
  };

  const tick = () => {
    removeAds();
    skipAds();
    if (!openFirstResult()) bindAndPlay();
  };

  const observer = new MutationObserver(tick);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(tick, 500);
  tick();
  true;
})();
`;
}

export function MusicPlaybackHost() {
  const music = useMobileControlStore((state) => state.music);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const playbackPaused = useMobileControlStore((state) => state.playbackPaused);
  const playNextSong = useMobileControlStore((state) => state.playNextSong);
  const setPlaybackPaused = useMobileControlStore((state) => state.setPlaybackPaused);
  const webRef = useRef<WebView>(null);
  const keeperHasPlayed = useRef(false);
  const remotePauseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keeper = useAudioPlayer(BACKGROUND_KEEPER_URI, { updateInterval: 400 });
  const keeperStatus = useAudioPlayerStatus(keeper);

  const sourceUrl = currentSong ? youtubeSearchUrl(currentSong.query) : '';
  const automation = useMemo(
    () => playerAutomation(music.volume, playbackPaused),
    [music.volume, playbackPaused],
  );

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
    clearTimeout(remotePauseTimer.current);
    keeperHasPlayed.current = false;

    if (!music.enabled || !currentSong) {
      keeper.pause();
      keeper.clearLockScreenControls();
      return;
    }

    keeper.setActiveForLockScreen(
      true,
      {
        title: currentSong.query,
        artist: `Pedido por @${currentSong.requestedBy}`,
        albumTitle: 'Lulú Finity',
      },
      { showSeekBackward: false, showSeekForward: false },
    );

    if (!playbackPaused) keeper.play();
  }, [currentSong?.id, keeper, music.enabled]);

  useEffect(() => {
    if (!music.enabled || !currentSong) return;

    webRef.current?.injectJavaScript(automation);
    if (playbackPaused) {
      keeper.pause();
    } else {
      keeper.play();
    }
  }, [automation, currentSong?.id, keeper, music.enabled, playbackPaused]);

  useEffect(() => {
    clearTimeout(remotePauseTimer.current);
    if (!music.enabled || !currentSong || !keeperStatus.isLoaded) return;

    if (keeperStatus.playing) {
      keeperHasPlayed.current = true;
      if (playbackPaused) setPlaybackPaused(false);
      return;
    }

    if (!keeperHasPlayed.current || playbackPaused) return;
    remotePauseTimer.current = setTimeout(() => {
      if (
        !keeper.playing &&
        useMobileControlStore.getState().currentSong?.id === currentSong.id &&
        !useMobileControlStore.getState().playbackPaused
      ) {
        setPlaybackPaused(true);
      }
    }, 600);

    return () => clearTimeout(remotePauseTimer.current);
  }, [currentSong?.id, keeper, keeperStatus.isLoaded, keeperStatus.playing, music.enabled, playbackPaused, setPlaybackPaused]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!music.enabled || !currentSong || playbackPaused) return;
      if (nextState === 'background' || nextState === 'inactive' || nextState === 'active') {
        keeper.play();
        webRef.current?.injectJavaScript(playerAutomation(music.volume, false));
      }
    });
    return () => subscription.remove();
  }, [currentSong?.id, keeper, music.enabled, music.volume, playbackPaused]);

  useEffect(
    () => () => {
      clearTimeout(remotePauseTimer.current);
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
        injectedJavaScriptBeforeContentLoaded={automation}
        injectedJavaScript={automation}
        onLoadEnd={() => {
          webRef.current?.injectJavaScript(automation);
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message?.type === 'ended') playNextSong();
          } catch {}
        }}
        onError={() => {
          setTimeout(() => {
            if (useMobileControlStore.getState().currentSong?.id === currentSong.id) playNextSong();
          }, 2500);
        }}
      />
    </View>
  );
}
