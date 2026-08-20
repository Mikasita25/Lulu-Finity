import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';

function playerAutomation(volume: number) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  return `
(() => {
  if (window.__luluAutoPlayerInstalled) return true;
  window.__luluAutoPlayerInstalled = true;
  const VOLUME = ${safeVolume};
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
      video.volume = VOLUME;
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
  const playNextSong = useMobileControlStore((state) => state.playNextSong);

  const sourceUrl = currentSong ? youtubeSearchUrl(currentSong.query) : '';
  const automation = useMemo(() => playerAutomation(music.volume), [music.volume]);

  if (!music.enabled || !currentSong || !sourceUrl) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -500, top: 0, width: 360, height: 640, opacity: 0.01 }}
    >
      <WebView
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
        onLoadEnd={(event) => {
          event.currentTarget.injectJavaScript(automation);
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
