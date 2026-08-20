import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ChevronLeft, RefreshCw, Search, ShieldCheck, SkipForward, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/Screen';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import { youtubeSearchUrl } from '@/services/music';

const YOUTUBE_AD_CLEANUP = `
(() => {
  if (window.__luluAdGuardInstalled) return true;
  window.__luluAdGuardInstalled = true;
  let blocked = 0;

  const selectors = [
    '#player-ads',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-player-overlay',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytm-promoted-sparkles-web-renderer',
    'ytm-companion-ad-renderer',
    'ytm-ad-slot-renderer',
    'ytm-mealbar-promo-renderer',
    'tp-yt-paper-dialog ytd-mealbar-promo-renderer'
  ];

  const report = (count) => {
    if (!count || !window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'blocked', count }));
  };

  const removePromos = () => {
    let removed = 0;
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        try {
          node.remove();
          removed += 1;
        } catch (_) {}
      });
    }
    return removed;
  };

  const clickSkip = () => {
    let skipped = 0;
    const skipSelectors = [
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      'button[class*="skip-ad"]',
      'button[class*="skip-button"]'
    ];
    for (const selector of skipSelectors) {
      document.querySelectorAll(selector).forEach((button) => {
        try {
          button.click();
          skipped += 1;
        } catch (_) {}
      });
    }
    return skipped;
  };

  const fastForwardVideoAd = () => {
    const adShowing = document.querySelector('.ad-showing, .ytp-ad-player-overlay, .ytp-ad-text');
    const video = document.querySelector('video');
    if (!adShowing || !video || !Number.isFinite(video.duration) || video.duration <= 0) return 0;
    try {
      video.currentTime = Math.max(0, video.duration - 0.05);
      return 1;
    } catch (_) {
      return 0;
    }
  };

  const sweep = () => {
    const count = removePromos() + clickSkip() + fastForwardVideoAd();
    if (count > 0) {
      blocked += count;
      report(count);
    }
  };

  const originalOpen = window.open;
  window.open = function(url, ...args) {
    const target = typeof url === 'string' ? url : '';
    if (/doubleclick|googleadservices|pagead|adservice/i.test(target)) {
      blocked += 1;
      report(1);
      return null;
    }
    return originalOpen ? originalOpen.call(window, url, ...args) : null;
  };

  const observer = new MutationObserver(sweep);
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  setInterval(sweep, 750);
  sweep();
  true;
})();
`;

function isAllowedYouTubeUrl(url: string) {
  if (!url || url === 'about:blank') return true;
  if (/^(intent|market|vnd\.youtube):/i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.endsWith('.googleusercontent.com') ||
      host.endsWith('.gstatic.com')
    );
  } catch {
    return false;
  }
}

export function YouTubeBrowserScreen({ navigation, route }: any) {
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const queue = useMobileControlStore((state) => state.songQueue);
  const skipCurrentSong = useMobileControlStore((state) => state.skipCurrentSong);
  const webRef = useRef<WebView>(null);
  const initialQuery = String(route?.params?.query || currentSong?.query || '').trim();
  const [query, setQuery] = useState(initialQuery);
  const [loadedQuery, setLoadedQuery] = useState(initialQuery);
  const [blocked, setBlocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pageTitle, setPageTitle] = useState('YouTube');

  const sourceUrl = useMemo(
    () => youtubeSearchUrl(loadedQuery || currentSong?.query || 'music'),
    [currentSong?.query, loadedQuery],
  );

  const search = () => {
    const clean = query.trim();
    if (!clean) return;
    setLoadedQuery(clean);
    setBlocked(0);
  };

  const nextSong = () => {
    const next = skipCurrentSong();
    if (!next) {
      Alert.alert('Cola terminada', 'No quedan más canciones en la cola.');
      return;
    }
    setQuery(next.query);
    setLoadedQuery(next.query);
    setBlocked(0);
  };

  return (
    <Screen scroll={false} contentClassName="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel="Cerrar navegador"
          onPress={() => navigation.goBack()}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.07]"
        >
          <X size={19} color="#FFF7FC" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-lulu-200/60">Lulú Browser</Text>
          <Text numberOfLines={1} className="mt-1 text-sm font-black text-white">{pageTitle || 'YouTube'}</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-2xl bg-emerald-500/10 px-3 py-2.5">
          <ShieldCheck size={15} color="#86EFAC" />
          <Text className="text-[10px] font-black text-emerald-200">{blocked}</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3">
        <Search size={17} color="#A99DA7" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCorrect={false}
          placeholder="Buscar canción en YouTube"
          placeholderTextColor="#746973"
          className="flex-1 py-3.5 text-sm font-bold text-white"
        />
        <Pressable onPress={search} className="rounded-xl bg-lulu-500 px-3 py-2.5">
          <Text className="text-[10px] font-black text-white">BUSCAR</Text>
        </Pressable>
      </View>

      <View className="relative flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-black">
        <WebView
          ref={webRef}
          key={sourceUrl}
          source={{ uri: sourceUrl }}
          style={{ flex: 1, backgroundColor: '#000000' }}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          mixedContentMode="never"
          androidLayerType="hardware"
          injectedJavaScriptBeforeContentLoaded={YOUTUBE_AD_CLEANUP}
          injectedJavaScript={YOUTUBE_AD_CLEANUP}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            webRef.current?.injectJavaScript(YOUTUBE_AD_CLEANUP);
          }}
          onNavigationStateChange={(state) => {
            setCanGoBack(state.canGoBack);
            if (state.title) setPageTitle(state.title);
          }}
          onShouldStartLoadWithRequest={(request) => isAllowedYouTubeUrl(request.url)}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data?.type === 'blocked') {
                setBlocked((value) => value + Math.max(0, Number(data.count) || 0));
              }
            } catch {}
          }}
          onError={(event) => {
            setLoading(false);
            const message = event.nativeEvent.description || 'No se pudo abrir YouTube.';
            Alert.alert('Error del navegador', message);
          }}
        />
        {loading ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center bg-black/35">
            <ActivityIndicator size="large" color="#FF5FC8" />
            <Text className="mt-3 text-xs font-black text-white/70">Cargando YouTube…</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row gap-2">
        <Pressable
          disabled={!canGoBack}
          onPress={() => webRef.current?.goBack()}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3 ${canGoBack ? 'bg-white/[0.07]' : 'bg-white/[0.025]'}`}
        >
          <ChevronLeft size={16} color={canGoBack ? '#FFF7FC' : '#5A5058'} />
          <Text className={`text-xs font-black ${canGoBack ? 'text-white' : 'text-white/20'}`}>Atrás</Text>
        </Pressable>
        <Pressable onPress={() => webRef.current?.reload()} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-3">
          <RefreshCw size={16} color="#FF9DDA" />
          <Text className="text-xs font-black text-white">Recargar</Text>
        </Pressable>
        <Pressable
          disabled={!queue.length}
          onPress={nextSong}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3 ${queue.length ? 'bg-lulu-500/20' : 'bg-white/[0.025]'}`}
        >
          <SkipForward size={16} color={queue.length ? '#FF9DDA' : '#5A5058'} />
          <Text className={`text-xs font-black ${queue.length ? 'text-lulu-100' : 'text-white/20'}`}>Siguiente</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between px-1">
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={13} color="#86EFAC" />
          <Text className="text-[10px] font-bold text-white/35">Bloqueo activo · anuncios, overlays y popups</Text>
        </View>
        <Text className="text-[10px] font-black text-white/25">{queue.length} EN COLA</Text>
      </View>
    </Screen>
  );
}
