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

console.log('Interfaz móvil: video, conexión y logo oficial verificados.');
