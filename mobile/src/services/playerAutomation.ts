export function playerAutomation(volume: number, paused: boolean, adBlockEnabled: boolean, autoSkipAds: boolean, autoSelect = true, background = true) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  return `
(() => {
  if (!/(^|\\.)youtube\\.com$/.test(location.hostname)) return true;
  window.__luluAutoSelect = ${autoSelect ? 'true' : 'false'};
  window.__luluBackground = ${background ? 'true' : 'false'};
  window.__luluDesiredVolume = ${safeVolume};
  window.__luluPlaybackPaused = ${paused ? 'true' : 'false'};
  window.__luluAdBlockEnabled = ${adBlockEnabled ? 'true' : 'false'};
  window.__luluAutoSkipAds = ${autoSkipAds ? 'true' : 'false'};

  if (!window.__luluVisibilityInstalled) {
    window.__luluVisibilityInstalled = true;
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__luluBackground ? false : hidden?.get?.call(document) });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__luluBackground ? 'visible' : visibility?.get?.call(document) });
    } catch (_) {}
  }
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
    if (!window.__luluAdBlockEnabled) { document.getElementById('lulu-adblock-style')?.remove(); return; }
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
    if (!window.__luluAutoSelect || navigating || !location.pathname.includes('/results')) return false;
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
      video.addEventListener('pause', () => {
        if (video.ended || video.seeking || video.readyState < 3) return;
        if (window.__luluUserGesture && Date.now() - window.__luluUserGesture < 1200) {
          window.__luluPlaybackPaused = true;
          send({ type: 'user-pause' });
        }
      });
      video.addEventListener('play', () => {
        if (window.__luluUserGesture && Date.now() - window.__luluUserGesture < 1200) {
          window.__luluPlaybackPaused = false;
          send({ type: 'user-play' });
        }
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

  document.addEventListener('pointerdown', () => { window.__luluUserGesture = Date.now(); }, true);
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; tick(); }, 250);
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(tick, 1000);
  tick();
  true;
})();
`;
}

