import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fromMobile = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(fromMobile(path), 'utf8');

const video = readFileSync(fromMobile('assets/startup-lulu.mp4'));
assert.equal(video.length, 234_033, 'El video de inicio no debe sustituirse ni truncarse.');
assert.equal(
  createHash('sha256').update(video).digest('hex'),
  'b49dad313d93f90a665b9b260640cc225e8aaa7ac5666e9084065b1ac6106955',
  'El video de inicio debe ser exactamente el archivo entregado por Lulu.',
);

const splash = read('src/components/SplashView.tsx');
assert.match(splash, /startup-lulu\.mp4/);
assert.match(splash, /contentFit="contain"/);
assert.match(splash, /Iniciando Lulu Finity/);
assert.match(splash, /playToEnd/);
assert.match(splash, /backgroundColor: '#000000'/);
assert.doesNotMatch(splash, /LinearGradient/);
assert.doesNotMatch(splash, /videoFrame/);

const dashboard = read('src/screens/DashboardScreen.tsx');
assert.match(dashboard, /<LiveConnectionCard\s*\/>/);
assert.match(dashboard, /Accesos rápidos/);
assert.match(dashboard, /Voz del chat/);
assert.match(dashboard, /Resumen del LIVE/);

const connection = read('src/components/LiveConnectionCard.tsx');
assert.match(connection, /Conectar al LIVE/);
assert.match(connection, /Desconectado/);
assert.match(connection, /LIVE conectado/);

const header = read('src/components/AppHeader.tsx');
assert.match(header, /assets\/icon\.png/);
assert.match(header, /Logo de Lulú Finity/);
assert.match(header, /accessibilityLabel="Volver"/);
assert.match(header, />Atrás</);

const onboarding = read('src/screens/OnboardingScreen.tsx');
assert.match(onboarding, /assets\/icon\.png/);
assert.match(onboarding, /Logo de Lulú Finity/);

const appConfig = JSON.parse(read('app.json'));
assert.equal(appConfig.expo.icon, './assets/icon.png');
assert.equal(appConfig.expo.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');
assert.ok(
  appConfig.expo.plugins.some(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio' && plugin[1]?.enableBackgroundPlayback === true,
  ),
  'expo-audio debe declarar enableBackgroundPlayback para mantener la sesión multimedia en Android.',
);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.dependencies['react-native-webview'], '13.16.1');
assert.ok(packageJson.dependencies['expo-audio']);
assert.equal(packageJson.dependencies['expo-speech'], undefined, 'Android ya no debe usar el motor TTS local.');

const navigator = read('src/navigation/AppNavigator.tsx');
assert.match(navigator, /const initial = !onboardingDone \? 'Onboarding' : 'Main'/);
assert.match(navigator, /name="Music"/);
assert.match(navigator, /name="YouTubeBrowser"/);
assert.match(navigator, /name="RecentActivity"/);
assert.match(navigator, /title: 'Control'/);
assert.match(navigator, /title: 'Menú'/);

const menu = read('src/screens/MoreScreen.tsx');
assert.match(menu, /Herramientas del LIVE/);
assert.match(menu, /Tu app/);
assert.match(menu, /Respuestas automáticas/);

const liveView = read('src/screens/LiveViewScreen.tsx');
assert.match(liveView, /Control del LIVE/);
assert.match(liveView, /Actividad reciente/);
assert.match(liveView, /Ahora suena/);
assert.match(liveView, /filterRecentEvents/);
assert.match(liveView, /YouTubeBrowser/);
assert.match(liveView, /MusicVolumeControl/);
assert.match(liveView, /Pausar música/);
assert.match(liveView, /Reanudar música/);
assert.doesNotMatch(liveView, /Linking\.openURL/);

const recentActivity = read('src/screens/RecentActivityScreen.tsx');
assert.match(recentActivity, /Mostrar todo/);
assert.match(recentActivity, /Ocultar todo/);
assert.match(recentActivity, /Nuevos seguidores/);
assert.match(recentActivity, /Fan Stickers/);

const volumeControl = read('src/components/MusicVolumeControl.tsx');
assert.match(volumeControl, /Volumen de música/);
assert.match(volumeControl, /updateMusic\(\{ volume:/);
assert.match(volumeControl, /Silenciar música/);
assert.match(volumeControl, /Subir volumen/);
assert.match(volumeControl, /Bajar volumen/);

const music = read('src/screens/MusicScreen.tsx');
assert.match(music, /Permitir solicitudes del chat/);
assert.match(music, /!song/);
assert.match(music, /!sr/);
assert.match(music, /Pausar solicitudes/);
assert.match(music, /Sigue sonando en segundo plano/);
assert.match(music, /MusicVolumeControl/);
assert.match(music, /Pausar música/);
assert.match(music, /YouTubeBrowser/);
assert.match(music, /wasIdle/);
assert.match(music, /if \(wasIdle\) playSong\(result\.song\)/);
assert.doesNotMatch(music, /Linking\.openURL/);

const youtubeBrowser = read('src/screens/YouTubeBrowserScreen.tsx');
assert.match(youtubeBrowser, /Un solo reproductor/);
assert.match(youtubeBrowser, /Reintentar canción/);
assert.match(youtubeBrowser, /playbackStatus/);
assert.match(youtubeBrowser, /skipCurrentSong/);
assert.doesNotMatch(youtubeBrowser, /react-native-webview/);

const playbackHost = read('src/components/MusicPlaybackHost.tsx');
assert.match(playbackHost, /setAudioModeAsync/);
assert.match(playbackHost, /shouldPlayInBackground: true/);
assert.match(playbackHost, /setActiveForLockScreen/);
assert.match(playbackHost, /BACKGROUND_KEEPER_URI/);
assert.match(playbackHost, /AppState\.addEventListener/);
assert.match(playbackHost, /__luluDesiredVolume/);
assert.match(playbackHost, /__luluPlaybackPaused/);
assert.match(playbackHost, /mediaPlaybackRequiresUserAction=\{false\}/);
assert.match(playbackHost, /openFirstResult/);
assert.match(playbackHost, /video\.play\(\)/);
assert.match(playbackHost, /addEventListener\('ended'/);
assert.match(playbackHost, /playNextSong\(\)/);
assert.match(playbackHost, /ytp-skip-ad-button/);
assert.match(playbackHost, /currentSong\.id/);
assert.match(playbackHost, /TTS Bot activo/);
assert.match(playbackHost, /liveOnlyKeeper/);
assert.match(playbackHost, /interruptionMode: 'doNotMix'/);
assert.match(playbackHost, /video\.paused && !video\.ended/);
assert.match(playbackHost, /setInterval\(tick, 1000\)/);
assert.match(playbackHost, /subscribeTtsPlayback/);
assert.match(playbackHost, /setPlaybackStatus\('playing'/);
assert.doesNotMatch(playbackHost, /remotePauseTimer|setPlaybackPaused/);

const ttsRuntime = read('src/services/tts.ts');
assert.match(ttsRuntime, /MAX_PENDING_AGE_MS/);
assert.match(ttsRuntime, /queuedAt/);
assert.match(ttsRuntime, /MICROSOFT_VOICES/);
assert.match(ttsRuntime, /synthesizeMicrosoftSpeechDirect/);
assert.match(ttsRuntime, /setTtsPlaybackActive\(true\)/);
assert.match(ttsRuntime, /status\.isLoaded/);
assert.doesNotMatch(ttsRuntime, /\/v1\/tts\/microsoft|expo\/fetch/);
assert.doesNotMatch(ttsRuntime, /expo-speech|Speech\.speak/);

const directTts = read('src/services/microsoftEdgeDirect.ts');
assert.match(directTts, /speech\.platform\.bing\.com/);
assert.match(directTts, /new NativeWebSocket\(url, null, \{ headers: edgeWebSocketHeaders\(\) \}\)/);
assert.match(directTts, /audio-24khz-48kbitrate-mono-mp3/);
assert.match(directTts, /chrome-extension:\/\/jdiccldimpdaibmpdkjnbmckianbfold/);
assert.match(directTts, /'Sec-WebSocket-Version': '13'/);
assert.match(directTts, /Cookie: `muid=/);
assert.match(directTts, /attempt < 2/);

const ttsScreen = read('src/screens/TtsScreen.tsx');
assert.match(ttsScreen, /voces de Microsoft/);
assert.match(ttsScreen, /directamente desde Microsoft/);
assert.match(ttsScreen, /directamente con Microsoft/);
assert.match(ttsScreen, /No se pudo reproducir la voz/);
assert.doesNotMatch(ttsScreen, /Predeterminada del sistema|voces instaladas/);

const liveRuntime = read('src/services/liveRuntime.ts');
assert.match(liveRuntime, /LiveFreshnessGate/);
assert.match(liveRuntime, /freshness\.beginReconnect/);
assert.match(liveRuntime, /freshness\.accept/);

const liveSocket = read('src/services/realtime/LiveSocket.ts');
assert.match(liveSocket, /const reconnectDelays = \[/);
assert.match(liveSocket, /transportReconnect: this\.retryCount > 0/);
assert.match(liveSocket, /if \(this\.socket !== socket\) return/);
assert.doesNotMatch(liveSocket, /1000: \{ state:/);

const musicRuntime = read('src/services/music.ts');
assert.match(musicRuntime, /parseSongRequest/);
assert.match(musicRuntime, /state\.musicPaused/);
assert.match(musicRuntime, /enqueueSong/);
assert.match(musicRuntime, /const wasIdle = !state\.currentSong/);
assert.match(musicRuntime, /playSong\(result\.song\)/);
assert.match(musicRuntime, /https:\/\/m\.youtube\.com\/results/);

assert.match(liveRuntime, /handleMusicEvent\(message\.event\)/);
assert.match(liveRuntime, /clearMusicCooldowns/);

const mobileControls = read('src/store/useMobileControlStore.ts');
assert.match(mobileControls, /!cancion/);
assert.match(mobileControls, /!song/);
assert.match(mobileControls, /!sr/);
assert.match(mobileControls, /recentFilters/);
assert.match(mobileControls, /songQueue/);
assert.match(mobileControls, /playbackPaused/);
assert.match(mobileControls, /setPlaybackPaused/);
assert.match(mobileControls, /volume:/);

const updateService = read('src/services/updates.ts');
assert.match(updateService, /per_page=100/);
assert.match(updateService, /Cache-Control/);
assert.match(updateService, /lulu-finity-mobile-android/);

const updateStore = read('src/store/useUpdateStore.ts');
assert.match(updateStore, /lulu-finity-mobile-updates-v2/);
assert.match(updateStore, /FAILURE_RETRY_MS/);
assert.match(updateStore, /update: state\.update/);
assert.match(updateStore, /currentMobileVersion/);
assert.match(updateStore, /currentMobileBuild/);
assert.match(updateStore, /staleSnapshot/);
assert.doesNotMatch(updateStore, /error: message, lastCheckedAt: Date\.now\(\)/);

const app = read('App.tsx');
assert.match(app, /Alert\.alert/);
assert.match(app, /dismissedVersion/);
assert.match(app, /update\.downloadUrl \|\| update\.releaseUrl/);
assert.match(app, /AppState\.addEventListener/);
assert.match(app, /nextState === 'active'/);
assert.match(app, /MusicPlaybackHost/);

console.log('Interfaz móvil: música automática, volumen, segundo plano, navegador interno y actualizador verificados.');
