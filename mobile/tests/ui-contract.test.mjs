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

const connection = read('src/components/LiveConnectionCard.tsx');
assert.match(connection, /Conectar al LIVE/);
assert.match(connection, /Desconectado/);
assert.match(connection, /LIVE conectado/);

const header = read('src/components/AppHeader.tsx');
assert.match(header, /assets\/icon\.png/);
assert.match(header, /Logo de Lulú Finity/);

const onboarding = read('src/screens/OnboardingScreen.tsx');
assert.match(onboarding, /assets\/icon\.png/);
assert.match(onboarding, /Logo de Lulú Finity/);

const appConfig = JSON.parse(read('app.json'));
assert.equal(appConfig.expo.icon, './assets/icon.png');
assert.equal(appConfig.expo.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');

const navigator = read('src/navigation/AppNavigator.tsx');
assert.match(navigator, /const initial = !onboardingDone \? 'Onboarding' : 'Main'/);
assert.match(navigator, /name="Music"/);
assert.match(navigator, /name="RecentActivity"/);

const liveView = read('src/screens/LiveViewScreen.tsx');
assert.match(liveView, /Control del LIVE/);
assert.match(liveView, /Actividad reciente/);
assert.match(liveView, /Ahora suena/);
assert.match(liveView, /filterRecentEvents/);

const recentActivity = read('src/screens/RecentActivityScreen.tsx');
assert.match(recentActivity, /Mostrar todo/);
assert.match(recentActivity, /Ocultar todo/);
assert.match(recentActivity, /Nuevos seguidores/);
assert.match(recentActivity, /Fan Stickers/);

const music = read('src/screens/MusicScreen.tsx');
assert.match(music, /Solicitudes del chat/);
assert.match(music, /!song/);
assert.match(music, /!sr/);
assert.match(music, /Pausar solicitudes/);
assert.match(music, /Abrir en YouTube|Lulú administra la cola/);

const musicRuntime = read('src/services/music.ts');
assert.match(musicRuntime, /parseSongRequest/);
assert.match(musicRuntime, /state\.musicPaused/);
assert.match(musicRuntime, /enqueueSong/);

const liveRuntime = read('src/services/liveRuntime.ts');
assert.match(liveRuntime, /handleMusicEvent\(message\.event\)/);
assert.match(liveRuntime, /clearMusicCooldowns/);

const mobileControls = read('src/store/useMobileControlStore.ts');
assert.match(mobileControls, /!cancion/);
assert.match(mobileControls, /!song/);
assert.match(mobileControls, /!sr/);
assert.match(mobileControls, /recentFilters/);
assert.match(mobileControls, /songQueue/);

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

console.log('Interfaz móvil: inicio, conexión, logo, control LIVE, actividad, música y actualizador verificados.');
