'use strict';

const api = window.voiceStudio;

const state = {
  settings: null,
  connected: false,
  comments: [],
  liveEvents: [],
  eventCounters: { gift: 0, diamonds: 0, follow: 0, likes: 0, share: 0, member: 0, subscribe: 0 },
  commentCount: 0,
  viewerCount: 0,
  speechQueue: [],
  speaking: false,
  speechPlaybackStarted: false,
  speechPreparation: null,
  speechPrepareGeneration: 0,
  speechLatencyCurrentMs: 0,
  speechLatencySamples: [],
  songQueue: [],
  currentSong: null,
  spotifyQueue: [],
  currentSpotify: null,
  spotifyOpen: false,
  spotifyVisible: false,
  spotifyMuted: false,
  spotifyTransitioning: false,
  spotifyPlayer: { title: '', artist: '', url: '', currentTime: 0, duration: 0, paused: true },
  youtubeOpen: false,
  youtubeMuted: false,
  lastReadByUser: new Map(),
  lastMessageByUser: new Map(),
  voices: [],
  localVoices: [],
  onlineVoices: [],
  onlineVoicesFallback: false,
  tiktokVoices: [],
  onlineAudio: null,
  speechToken: 0,
  voiceLoading: false,
  updateStatus: null,
  saveTimer: null,
  youtubeTransitioning: false,
  youtubeVisible: false,
  player: { title: '', url: '', currentTime: 0, duration: 0, paused: true, volume: 0.8 },
  recommendationActive: false,
  lastSongRejectReason: '',
  commandMediaDraft: null,
  eventMediaDraft: null,
  activeSounds: new Set(),
  audioQueue: [],
  audioBusy: false,
  audioLocks: new Set(),
  activeAudioJob: null,
  activeAudioCancel: null,
  imageOverlayTimer: null,
  voiceSearch: '',
  resolvingSongs: 0,
  handlingExternalYoutubeSkip: false,
  economy: { balances: [], ledger: [] },
  detectedFanStickers: [],
  overlay: { screen: 1, url: '', connected: 0, totalConnected: 0 },
  ranking: { slot: 1, url: '', previewUrl: '', connected: 0, totalConnected: 0, snapshot: null },
  streamWidgets: { playlist: {}, wallet: {}, game: {}, alert: {}, goal: {}, gift: {} },
  streamWidgetSyncTimer: null,
  streamWidgetThemeSaving: false,
  streamWidgetBackgroundSaving: false,
  streamWidgetStyleRefreshTimers: {},
  defaultSounds: [],
  soundLibraryFilter: 'Todos',
  soundLibrarySelectedId: '',
  soundLibraryApply: null,
  rankingSaveTimer: null,
  relayUsage: null,
  relayUsageTimer: null,
  tiktokChatStatus: null,
  tiktokChatFailureAt: 0,
  liveGameResults: [],
  liveGameStats: { plays:0, wins:0, losses:0, pushes:0 },
  automationCooldowns: {},
  automationLog: [],
  giftStats: { totalGifts:0,totalDiamonds:0,topGift:null,topStreak:null,lastGift:null },
  activePage:'dashboard', loadedPages:new Set(['dashboard']), runtimeTimer:null, audioActivityTimer:null, idleResourceTimer:null, systemVoicesBound:false, economyLoaded:false
};

const $ = (id) => document.getElementById(id);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const PERMANENT_PREVIEW_FRAMES = Object.freeze({
  ranking:'rankingPreviewFrame', playlist:'playlistWidgetPreviewFrame', wallet:'walletWidgetPreviewFrame',
  game:'gameWidgetPreviewFrame', alert:'alertWidgetPreviewFrame', goal:'goalWidgetPreviewFrame', gift:'giftWidgetPreviewFrame'
});

function markPermanentPreviewLoading(frame) {
  frame?.closest('.stream-widget-preview, .ranking-preview-shell')?.classList.remove('preview-ready');
}

window.addEventListener('message', (event) => {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(String(event.origin || ''))) return;
  if (event.data?.type !== 'lulu-permanent-preview-ready') return;
  const frame = $(PERMANENT_PREVIEW_FRAMES[event.data.preview]);
  if (!frame || event.source !== frame.contentWindow) return;
  frame.closest('.stream-widget-preview, .ranking-preview-shell')?.classList.add('preview-ready');
});

const RELEASE_NOTES = Object.freeze({
  '1.1.5': Object.freeze([
    Object.freeze({ icon:'🔒', title:'HTTPS reparado', text:'Cada tema, fondo y color se confirma directamente en la fuente correspondiente.' }),
    Object.freeze({ icon:'◈', title:'Muestras actualizadas', text:'Los seis widgets muestran el cambio correcto después de guardar.' }),
    Object.freeze({ icon:'×', title:'Ventana siempre operable', text:'Cerrar, minimizar y maximizar funcionan aunque falle otro apartado.' }),
    Object.freeze({ icon:'♫', title:'Música bajo demanda', text:'El overlay queda transparente hasta que exista una solicitud.' })
  ]),
  '1.1.2': Object.freeze([
    Object.freeze({ icon:'🔒', title:'HTTPS fijo', text:'Cada fuente conserva su URL y se vuelve a sincronizar al abrir Lulu.' }),
    Object.freeze({ icon:'♫', title:'Música estable', text:'YouTube y Spotify se recuperan si dejan de avanzar en segundo plano.' }),
    Object.freeze({ icon:'✦', title:'Interfaz más clara', text:'Botones y estados respetan el tema elegido y usan textos más cortos.' }),
    Object.freeze({ icon:'◈', title:'Vista previa de temas', text:'Cada tarjeta muestra su botón antes de aplicar el tema.' })
  ])
});

const STREAM_WIDGET_THEME_CATALOG = Object.freeze([
  { id:'lulu', name:'Lulu Rosa', mood:'Firma de Lulu', a:'#ff67ad', b:'#5fe8ff' },
  { id:'aurora', name:'Aurora', mood:'Verde y violeta', a:'#71ffd6', b:'#9782ff' },
  { id:'cyber', name:'Cyber', mood:'Neón futurista', a:'#00f6ff', b:'#ff2bd6' },
  { id:'arcade', name:'Arcade', mood:'Pixel y energía', a:'#75ff4d', b:'#ff3dd1' },
  { id:'hologram', name:'Holograma', mood:'Cristal luminoso', a:'#80fff4', b:'#ff80eb' },
  { id:'sakura', name:'Sakura', mood:'Pétalos suaves', a:'#ff9fc9', b:'#c79bff' },
  { id:'miku', name:'Miku', mood:'Turquesa pop', a:'#39f1d2', b:'#ff68a9' },
  { id:'lavender', name:'Lavanda', mood:'Pastel profundo', a:'#c7a0ff', b:'#ff91cf' },
  { id:'sunset', name:'Atardecer', mood:'Coral intenso', a:'#ff7657', b:'#ff3f9f' },
  { id:'gold', name:'Dorado', mood:'Premium cálido', a:'#ffd56a', b:'#d99832' },
  { id:'mint', name:'Menta', mood:'Fresco y limpio', a:'#7dffc5', b:'#42d8ba' },
  { id:'ocean', name:'Océano', mood:'Azul eléctrico', a:'#48c8ff', b:'#4267ff' },
  { id:'vampire', name:'Vampiro', mood:'Rojo nocturno', a:'#ff365f', b:'#9e38ff' },
  { id:'mono', name:'Monocromo', mood:'Blanco editorial', a:'#ffffff', b:'#9da7b8' }
]);
const STREAM_WIDGET_THEME_IDS = new Set(STREAM_WIDGET_THEME_CATALOG.map((theme) => theme.id));
const DEFAULT_STREAM_WIDGET_THEMES = Object.freeze({ playlist:'aurora', wallet:'gold', game:'arcade', alert:'lulu', goal:'hologram', gift:'sakura' });
const STREAM_WIDGET_BACKGROUND_CATALOG = Object.freeze([
  { id:'plain', name:'Esencia', mood:'Limpio y suave' },
  { id:'stars', name:'Estrellas', mood:'Destellos nocturnos' },
  { id:'aurora', name:'Aurora viva', mood:'Luces envolventes' },
  { id:'grid', name:'Cuadrícula', mood:'Tecnología ordenada' },
  { id:'glass', name:'Cristal', mood:'Transparencia premium' },
  { id:'bubbles', name:'Burbujas', mood:'Círculos flotantes' },
  { id:'vinyl', name:'Vinilo', mood:'Ritmo musical' },
  { id:'pixel', name:'Pixel party', mood:'Arcade brillante' },
  { id:'waves', name:'Ondas', mood:'Movimiento continuo' },
  { id:'confetti', name:'Confeti', mood:'Celebración del LIVE' },
  { id:'spotlight', name:'Reflectores', mood:'Escenario luminoso' },
  { id:'midnight', name:'Medianoche', mood:'Profundo y elegante' }
]);
const STREAM_WIDGET_BACKGROUND_IDS = new Set(STREAM_WIDGET_BACKGROUND_CATALOG.map((background) => background.id));
const DEFAULT_STREAM_WIDGET_BACKGROUNDS = Object.freeze({ playlist:'vinyl', wallet:'spotlight', game:'pixel', alert:'bubbles', goal:'aurora', gift:'confetti' });
const STREAM_WIDGET_BACKGROUND_LABELS = Object.freeze({ playlist:'Música', wallet:'Monedas', game:'Juegos y Ruleta', alert:'Alertas', goal:'Metas', gift:'Regalos' });
const DEFAULT_STREAM_WIDGET_STYLES = Object.freeze({
  playlist: Object.freeze({ enabled:false, primaryColor:'#71ffd6', secondaryColor:'#9782ff', textColor:'#fff9fd', backgroundColor:'#14101f', backgroundOpacity:94, borderRadius:22, goalBarHeight:14 }),
  wallet: Object.freeze({ enabled:false, primaryColor:'#ffd56a', secondaryColor:'#d99832', textColor:'#fff9fd', backgroundColor:'#21180e', backgroundOpacity:94, borderRadius:28, goalBarHeight:14 }),
  game: Object.freeze({ enabled:false, primaryColor:'#75ff4d', secondaryColor:'#ff3dd1', textColor:'#fff9fd', backgroundColor:'#100c26', backgroundOpacity:96, borderRadius:24, goalBarHeight:14 }),
  alert: Object.freeze({ enabled:false, primaryColor:'#ff67ad', secondaryColor:'#5fe8ff', textColor:'#fff9fd', backgroundColor:'#1d1028', backgroundOpacity:94, borderRadius:22, goalBarHeight:14 }),
  goal: Object.freeze({ enabled:false, primaryColor:'#80fff4', secondaryColor:'#ff80eb', textColor:'#fff9fd', backgroundColor:'#10243e', backgroundOpacity:92, borderRadius:22, goalBarHeight:14 }),
  gift: Object.freeze({ enabled:false, primaryColor:'#ff9fc9', secondaryColor:'#c79bff', textColor:'#fff9fd', backgroundColor:'#2b1730', backgroundOpacity:94, borderRadius:22, goalBarHeight:14 })
});

function normalizedStreamWidgetThemes(value = state.settings?.streamWidgetThemes) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_STREAM_WIDGET_THEMES).map(([type, fallback]) => [
    type,
    STREAM_WIDGET_THEME_IDS.has(String(source[type] || '')) ? String(source[type]) : fallback
  ]));
}

function renderStreamWidgetThemeStudios() {
  if (!state.settings) return;
  state.settings.streamWidgetThemes = normalizedStreamWidgetThemes();
  qsa('[data-widget-theme-gallery]').forEach((gallery) => {
    const type = gallery.dataset.widgetThemeGallery;
    const selected = state.settings.streamWidgetThemes[type] || DEFAULT_STREAM_WIDGET_THEMES[type] || 'lulu';
    gallery.innerHTML = STREAM_WIDGET_THEME_CATALOG.map((theme) => `<button type="button" class="widget-theme-choice ${theme.id === selected ? 'active' : ''}" data-widget-theme-choice="${theme.id}" data-widget-theme-for="${type}" aria-pressed="${theme.id === selected ? 'true' : 'false'}" ${state.streamWidgetThemeSaving ? 'disabled' : ''} style="--widget-swatch-a:${theme.a};--widget-swatch-b:${theme.b}"><span class="widget-theme-swatch"><i></i></span><strong>${escapeHtml(theme.name)}</strong><small>${escapeHtml(theme.mood)}</small></button>`).join('');
    const selectedTheme = STREAM_WIDGET_THEME_CATALOG.find((theme) => theme.id === selected);
    const label = document.querySelector(`[data-widget-theme-label="${type}"]`);
    if (label) label.textContent = selectedTheme?.name || 'Lulu Rosa';
  });
}

async function selectStreamWidgetTheme(type, theme) {
  if (state.streamWidgetThemeSaving || !Object.prototype.hasOwnProperty.call(DEFAULT_STREAM_WIDGET_THEMES, type) || !STREAM_WIDGET_THEME_IDS.has(theme)) return;
  const previous = normalizedStreamWidgetThemes();
  const previousStyles = normalizedStreamWidgetStyles();
  if (previous[type] === theme) return;
  state.streamWidgetThemeSaving = true;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  state.settings.streamWidgetThemes = { ...previous, [type]:theme };
  state.settings.streamWidgetStyles = { ...normalizedStreamWidgetStyles(), [type]:{ ...normalizedStreamWidgetStyles()[type], enabled:false } };
  renderStreamWidgetThemeStudios();
  renderStreamWidgetStyleEditors();
  try {
    state.settings = await api.saveSettings(state.settings);
    state.settings.streamWidgetThemes = normalizedStreamWidgetThemes(state.settings.streamWidgetThemes);
    renderStreamWidgetThemeStudios();
    await refreshStreamWidgetInfo(type, true);
    const synced = await api.applyStreamWidgetDesign(type);
    await refreshStreamWidgetInfo(type, false);
    const selectedTheme = STREAM_WIDGET_THEME_CATALOG.find((item) => item.id === theme);
    toast('Tema aplicado', `${selectedTheme?.name || theme} · ${synced?.designSynced ? 'vista previa y HTTPS actualizados.' : 'vista previa lista; HTTPS se reintentará.'}`, synced?.designSynced ? 'success' : 'info');
  } catch (error) {
    state.settings.streamWidgetThemes = previous;
    state.settings.streamWidgetStyles = previousStyles;
    renderStreamWidgetThemeStudios();
    renderStreamWidgetStyleEditors();
    toast('No se guardó el tema', error.message || String(error), 'error');
  } finally {
    state.streamWidgetThemeSaving = false;
    renderStreamWidgetThemeStudios();
  }
}

function bindStreamWidgetThemeStudios() {
  qsa('[data-widget-theme-gallery]').forEach((gallery) => gallery.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-widget-theme-choice]');
    if (!choice || !gallery.contains(choice)) return;
    void selectStreamWidgetTheme(choice.dataset.widgetThemeFor, choice.dataset.widgetThemeChoice);
  }));
}

function normalizedStreamWidgetBackgrounds(value = state.settings?.streamWidgetBackgrounds) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_STREAM_WIDGET_BACKGROUNDS).map(([type, fallback]) => [
    type,
    STREAM_WIDGET_BACKGROUND_IDS.has(String(source[type] || '')) ? String(source[type]) : fallback
  ]));
}

function ensureStreamWidgetBackgroundStudios() {
  qsa('[data-widget-theme-gallery]').forEach((themeGallery) => {
    const type = themeGallery.dataset.widgetThemeGallery;
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_STREAM_WIDGET_BACKGROUNDS, type)) return;
    const themeStudio = themeGallery.closest('.widget-theme-studio');
    if (!themeStudio || themeStudio.nextElementSibling?.matches(`[data-widget-background-studio="${type}"]`)) return;
    themeStudio.insertAdjacentHTML('afterend', `<div class="widget-background-studio" data-widget-background-studio="${type}"><div class="widget-theme-studio-head"><span><strong>Fondo de ${escapeHtml(STREAM_WIDGET_BACKGROUND_LABELS[type])}</strong><small>12 fondos incluidos; se guardan dentro del enlace HTTPS y local.</small></span><b data-widget-background-label="${type}">—</b></div><div class="widget-background-gallery" data-widget-background-gallery="${type}" aria-label="Fondos para ${escapeHtml(STREAM_WIDGET_BACKGROUND_LABELS[type])}"></div></div>`);
  });
}

function renderStreamWidgetBackgroundStudios() {
  if (!state.settings) return;
  ensureStreamWidgetBackgroundStudios();
  state.settings.streamWidgetBackgrounds = normalizedStreamWidgetBackgrounds();
  qsa('[data-widget-background-gallery]').forEach((gallery) => {
    const type = gallery.dataset.widgetBackgroundGallery;
    const selected = state.settings.streamWidgetBackgrounds[type] || DEFAULT_STREAM_WIDGET_BACKGROUNDS[type] || 'plain';
    gallery.innerHTML = STREAM_WIDGET_BACKGROUND_CATALOG.map((background) => `<button type="button" class="widget-background-choice background-${background.id} ${background.id === selected ? 'active' : ''}" data-widget-background-choice="${background.id}" data-widget-background-for="${type}" aria-pressed="${background.id === selected ? 'true' : 'false'}" ${state.streamWidgetBackgroundSaving ? 'disabled' : ''}><span class="widget-background-swatch"><i></i></span><strong>${escapeHtml(background.name)}</strong><small>${escapeHtml(background.mood)}</small></button>`).join('');
    const selectedBackground = STREAM_WIDGET_BACKGROUND_CATALOG.find((background) => background.id === selected);
    const label = document.querySelector(`[data-widget-background-label="${type}"]`);
    if (label) label.textContent = selectedBackground?.name || 'Esencia';
  });
}

async function selectStreamWidgetBackground(type, background) {
  if (state.streamWidgetBackgroundSaving || !Object.prototype.hasOwnProperty.call(DEFAULT_STREAM_WIDGET_BACKGROUNDS, type) || !STREAM_WIDGET_BACKGROUND_IDS.has(background)) return;
  const previous = normalizedStreamWidgetBackgrounds();
  const previousStyles = normalizedStreamWidgetStyles();
  if (previous[type] === background) return;
  state.streamWidgetBackgroundSaving = true;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  state.settings.streamWidgetBackgrounds = { ...previous, [type]:background };
  state.settings.streamWidgetStyles = { ...normalizedStreamWidgetStyles(), [type]:{ ...normalizedStreamWidgetStyles()[type], enabled:false } };
  renderStreamWidgetBackgroundStudios();
  renderStreamWidgetStyleEditors();
  try {
    state.settings = await api.saveSettings(state.settings);
    state.settings.streamWidgetBackgrounds = normalizedStreamWidgetBackgrounds(state.settings.streamWidgetBackgrounds);
    renderStreamWidgetBackgroundStudios();
    await refreshStreamWidgetInfo(type, true);
    const synced = await api.applyStreamWidgetDesign(type);
    await refreshStreamWidgetInfo(type, false);
    const selectedBackground = STREAM_WIDGET_BACKGROUND_CATALOG.find((item) => item.id === background);
    toast('Fondo aplicado', `${selectedBackground?.name || background} · ${synced?.designSynced ? 'vista previa y HTTPS actualizados.' : 'vista previa lista; HTTPS se reintentará.'}`, synced?.designSynced ? 'success' : 'info');
  } catch (error) {
    state.settings.streamWidgetBackgrounds = previous;
    state.settings.streamWidgetStyles = previousStyles;
    renderStreamWidgetBackgroundStudios();
    renderStreamWidgetStyleEditors();
    toast('No se guardó el fondo', error.message || String(error), 'error');
  } finally {
    state.streamWidgetBackgroundSaving = false;
    renderStreamWidgetBackgroundStudios();
  }
}

function bindStreamWidgetBackgroundStudios() {
  ensureStreamWidgetBackgroundStudios();
  qsa('[data-widget-background-gallery]').forEach((gallery) => gallery.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-widget-background-choice]');
    if (!choice || !gallery.contains(choice)) return;
    void selectStreamWidgetBackground(choice.dataset.widgetBackgroundFor, choice.dataset.widgetBackgroundChoice);
  }));
}

function safeWidgetColor(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function boundedWidgetNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeStreamWidgetStyle(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: source.enabled === true,
    primaryColor: safeWidgetColor(source.primaryColor, fallback.primaryColor),
    secondaryColor: safeWidgetColor(source.secondaryColor, fallback.secondaryColor),
    textColor: safeWidgetColor(source.textColor, fallback.textColor),
    backgroundColor: safeWidgetColor(source.backgroundColor, fallback.backgroundColor),
    backgroundOpacity: boundedWidgetNumber(source.backgroundOpacity, 0, 100, fallback.backgroundOpacity),
    borderRadius: boundedWidgetNumber(source.borderRadius, 0, 48, fallback.borderRadius),
    goalBarHeight: boundedWidgetNumber(source.goalBarHeight, 4, 40, fallback.goalBarHeight)
  };
}

function normalizedStreamWidgetStyles(value = state.settings?.streamWidgetStyles) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_STREAM_WIDGET_STYLES).map(([type, fallback]) => [
    type,
    normalizeStreamWidgetStyle(source[type], fallback)
  ]));
}

function ensureStreamWidgetStyleEditors() {
  qsa('[data-widget-theme-gallery]').forEach((themeGallery) => {
    const type = themeGallery.dataset.widgetThemeGallery;
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_STREAM_WIDGET_STYLES, type)) return;
    const card = themeGallery.closest('.stream-widget-card');
    if (!card || card.querySelector(`[data-widget-style-editor="${type}"]`)) return;
    const anchor = card.querySelector(`[data-widget-background-studio="${type}"]`) || themeGallery.closest('.widget-theme-studio');
    const goalControl = type === 'goal' ? `<label><span>Grosor de barra <output data-widget-style-output="goalBarHeight">14 px</output></span><input type="range" min="4" max="40" step="1" data-widget-style-field="goalBarHeight"></label>` : '';
    anchor.insertAdjacentHTML('afterend', `<section class="widget-style-editor" data-widget-style-editor="${type}"><header><span><strong>Editor propio</strong><small>Se guarda en la vista previa, el enlace HTTPS y OBS. Sin animaciones.</small></span><b data-widget-style-state>Usa el tema</b></header><div class="widget-style-color-grid"><label><span>Color principal</span><input type="color" data-widget-style-field="primaryColor"></label><label><span>Color secundario</span><input type="color" data-widget-style-field="secondaryColor"></label><label><span>Texto</span><input type="color" data-widget-style-field="textColor"></label><label><span>Fondo</span><input type="color" data-widget-style-field="backgroundColor"></label></div><div class="widget-style-range-grid"><label><span>Opacidad <output data-widget-style-output="backgroundOpacity">94%</output></span><input type="range" min="0" max="100" step="1" data-widget-style-field="backgroundOpacity"></label><label><span>Bordes <output data-widget-style-output="borderRadius">22 px</output></span><input type="range" min="0" max="48" step="1" data-widget-style-field="borderRadius"></label>${goalControl}</div><footer><small data-widget-style-status>Elige un color para activar tu diseño.</small><button type="button" class="ghost tiny" data-widget-style-reset>Restablecer</button></footer></section>`);
  });
}

function renderStreamWidgetStyleEditors() {
  if (!state.settings) return;
  ensureStreamWidgetStyleEditors();
  state.settings.streamWidgetStyles = normalizedStreamWidgetStyles();
  qsa('[data-widget-style-editor]').forEach((editor) => {
    const type = editor.dataset.widgetStyleEditor;
    const style = state.settings.streamWidgetStyles[type];
    if (!style) return;
    [...editor.querySelectorAll('[data-widget-style-field]')].forEach((input) => { input.value = String(style[input.dataset.widgetStyleField]); });
    const opacity = editor.querySelector('[data-widget-style-output="backgroundOpacity"]');
    const radius = editor.querySelector('[data-widget-style-output="borderRadius"]');
    const bar = editor.querySelector('[data-widget-style-output="goalBarHeight"]');
    if (opacity) opacity.textContent = `${Math.round(style.backgroundOpacity)}%`;
    if (radius) radius.textContent = `${Math.round(style.borderRadius)} px`;
    if (bar) bar.textContent = `${Math.round(style.goalBarHeight)} px`;
    editor.classList.toggle('custom-active', style.enabled);
    const stateLabel = editor.querySelector('[data-widget-style-state]');
    if (stateLabel) stateLabel.textContent = style.enabled ? 'Diseño propio' : 'Usa el tema';
  });
}

function scheduleStreamWidgetStyleRefresh(type) {
  clearTimeout(state.streamWidgetStyleRefreshTimers[type]);
  const editor = document.querySelector(`[data-widget-style-editor="${type}"]`);
  const status = editor?.querySelector('[data-widget-style-status]');
  if (status) status.textContent = 'Guardando y actualizando HTTPS…';
  state.streamWidgetStyleRefreshTimers[type] = setTimeout(async () => {
    try {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
      state.settings = await api.saveSettings(state.settings);
      renderStreamWidgetStyleEditors();
      await refreshStreamWidgetInfo(type, true);
      const synced = await api.applyStreamWidgetDesign(type);
      const info = await refreshStreamWidgetInfo(type, false);
      if (status) status.textContent = synced?.designSynced && info?.url ? 'Guardado · HTTPS actualizado.' : 'Guardado · HTTPS se reintentará automáticamente.';
    } catch (error) {
      if (status) status.textContent = error?.message || 'No se pudo guardar el diseño.';
    }
  }, 700);
}

function updateStreamWidgetStyle(editor, input) {
  const type = editor.dataset.widgetStyleEditor;
  const field = input.dataset.widgetStyleField;
  if (!DEFAULT_STREAM_WIDGET_STYLES[type] || !field) return;
  const styles = normalizedStreamWidgetStyles();
  const numeric = input.type === 'range';
  styles[type] = { ...styles[type], enabled:true, [field]:numeric ? Number(input.value) : input.value };
  state.settings.streamWidgetStyles = styles;
  renderStreamWidgetStyleEditors();
  scheduleStreamWidgetStyleRefresh(type);
}

function resetStreamWidgetStyle(type) {
  if (!DEFAULT_STREAM_WIDGET_STYLES[type]) return;
  state.settings.streamWidgetStyles = { ...normalizedStreamWidgetStyles(), [type]:{ ...DEFAULT_STREAM_WIDGET_STYLES[type] } };
  renderStreamWidgetStyleEditors();
  scheduleStreamWidgetStyleRefresh(type);
}

function bindStreamWidgetStyleEditors() {
  ensureStreamWidgetStyleEditors();
  qsa('[data-widget-style-editor]').forEach((editor) => {
    editor.addEventListener('input', (event) => {
      const input = event.target.closest('[data-widget-style-field]');
      if (input) updateStreamWidgetStyle(editor, input);
    });
    editor.addEventListener('click', (event) => {
      if (event.target.closest('[data-widget-style-reset]')) resetStreamWidgetStyle(editor.dataset.widgetStyleEditor);
    });
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(title, message = '', type = 'info') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}`;
  $('toastStack').appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

function renderRelayUsage(usage, error = '') {
  const used = Math.max(0, Number(usage?.used) || 0);
  const limit = Math.max(1, Number(usage?.limit) || 7500);
  const percent = Math.max(0, Number(usage?.percent) || (used / limit * 100));
  const displayPercent = Math.min(100, percent);
  const estimated = Math.floor(used / Math.max(0.1, Number(usage?.perConnection) || 2));
  if ($('relayUsagePercent')) $('relayUsagePercent').textContent = `${percent.toFixed(percent < 1 ? 1 : 0)}%`;
  if ($('relayUsageBar')) $('relayUsageBar').style.width = `${displayPercent}%`;
  if ($('relayUsageCount')) $('relayUsageCount').textContent = `${Math.round(used).toLocaleString('es-MX')} de ${Math.round(limit).toLocaleString('es-MX')} usos`;
  if ($('relayUsageConnections')) $('relayUsageConnections').textContent = `${estimated.toLocaleString('es-MX')} conexiones aproximadas`;
  $('relayUsageBar')?.classList.toggle('warning', percent >= 75 && percent < 90);
  $('relayUsageBar')?.classList.toggle('danger', percent >= 90);

  const individual = usage?.user || null;
  const individualLimit = Math.max(1, Number(individual?.limit) || 600);
  const individualUsed = Math.max(0, Number(individual?.used) || 0);
  const individualRemaining = Math.max(0, Number(individual?.remaining ?? (individualLimit - individualUsed)) || 0);
  const individualPercent = individual ? Math.max(0, Number(individual?.percent) || (individualUsed / individualLimit * 100)) : 0;
  if ($('relayUserUsagePercent')) $('relayUserUsagePercent').textContent = `${individualPercent.toFixed(individualPercent < 1 ? 1 : 0)}%`;
  if ($('relayUserUsageBar')) $('relayUserUsageBar').style.width = `${Math.min(100, individualPercent)}%`;
  if ($('relayUserUsageCount')) $('relayUserUsageCount').textContent = `${individualUsed.toLocaleString('es-MX')} de ${individualLimit.toLocaleString('es-MX')} conexiones`;
  if ($('relayUserUsageText')) $('relayUserUsageText').textContent = individual ? `Te quedan ${individualRemaining.toLocaleString('es-MX')} conexiones.` : 'Enlaza tu cuenta de TikTok para ver tu límite.';
  $('relayUserUsageBar')?.classList.toggle('warning', individualPercent >= 75 && individualPercent < 90);
  $('relayUserUsageBar')?.classList.toggle('danger', individualPercent >= 90);

  if ($('relayUsageStatus')) {
    $('relayUsageStatus').textContent = error || 'Los contadores se reinician cada día.';
    $('relayUsageStatus').classList.toggle('error-text', Boolean(error));
  }
}

async function refreshRelayUsage() {
  try {
    state.relayUsage = await api.getRelayUsage();
    renderRelayUsage(state.relayUsage);
  } catch (error) {
    renderRelayUsage(state.relayUsage || { used:0, limit:7500, perConnection:2 }, 'No se pudo actualizar el uso diario en este momento.');
  }
}


const TIKTOK_AUTO_CHAT_EVENTS = {
  songQueued: ['tiktokAutoChatSongQueuedEnabled', 'tiktokAutoChatSongQueuedText'],
  songStarted: ['tiktokAutoChatSongStartedEnabled', 'tiktokAutoChatSongStartedText'],
  songEnded: ['tiktokAutoChatSongEndedEnabled', 'tiktokAutoChatSongEndedText'],
  songSkipped: ['tiktokAutoChatSongSkippedEnabled', 'tiktokAutoChatSongSkippedText'],
  liveConnected: ['tiktokAutoChatLiveConnectedEnabled', 'tiktokAutoChatLiveConnectedText']
};

function renderTikTokChatStatus(status = state.tiktokChatStatus || {}) {
  state.tiktokChatStatus = status;
  const badge = $('tiktokChatStatusBadge');
  const text = $('tiktokChatStatusText');
  const origin = $('tiktokSecurityOrigin');
  const sessionText = $('tiktokSecuritySession');
  if (badge) {
    badge.textContent = status.ready ? 'LISTO' : status.loggedIn || status.sessionStored ? 'SESIÓN LOCAL' : status.requiresLogin ? 'INICIA SESIÓN' : status.open ? 'ABIERTO' : 'SIN SESIÓN';
    badge.classList.toggle('ready', Boolean(status.ready || status.loggedIn || status.sessionStored));
    badge.classList.toggle('warning', Boolean(!status.ready && status.open && !status.loggedIn));
  }
  if (text) text.textContent = status.message || (status.ready ? 'TikTok está listo para enviar mensajes.' : 'Abre el sitio oficial de TikTok e inicia sesión.');
  if (origin) {
    origin.textContent = status.displayOrigin || 'https://www.tiktok.com';
    origin.classList.toggle('untrusted', status.open && status.officialDomain === false);
  }
  if (sessionText) sessionText.textContent = status.sessionStored || status.loggedIn
    ? 'Hay una sesión guardada únicamente en el perfil local de esta computadora.'
    : 'No hay una sesión guardada. Tú decides cuándo vincularla.';
}

function autoChatSongTitle(song = {}) {
  return String(song.title || song.selectedTitle || song.query || 'la canción').trim();
}

function formatTikTokAutoChat(template, context = {}) {
  const song = context.song || {};
  const values = {
    '{cancion}': autoChatSongTitle(song),
    '{usuario}': String(song.requestedBy || context.usuario || 'Solicitud manual').trim(),
    '{posicion}': String(Math.max(1, Number(context.position || 1))),
    '{cola}': String(Math.max(0, Number(context.queueLength ?? (activeMusicProvider() === 'spotify' ? state.spotifyQueue.length : state.songQueue.length)))),
    '{proveedor}': context.provider || (activeMusicProvider() === 'spotify' ? 'Spotify' : 'YouTube'),
    '{comando}': state.settings?.songPrefix || '!cancion',
    '{live}': normalizeUser(state.settings?.username || '')
  };
  let result = String(template || '');
  for (const [token, value] of Object.entries(values)) result = result.replaceAll(token, value);
  return result.replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function sendTikTokAutoChatEvent(type, context = {}) {
  if (!state.settings?.tiktokAutoChatEnabled) return { ok:false, reason:'disabled' };
  const config = TIKTOK_AUTO_CHAT_EVENTS[type];
  if (!config) return { ok:false, reason:'unknown-event' };
  const [enabledKey, textKey] = config;
  if (!state.settings[enabledKey]) return { ok:false, reason:'event-disabled' };
  const message = formatTikTokAutoChat(state.settings[textKey], context);
  if (!message) return { ok:false, reason:'empty' };
  try {
    const result = await api.sendTikTokChat({
      message,
      username: state.settings.username,
      cooldownSeconds: state.settings.tiktokAutoChatCooldownSeconds || 8
    });
    if (!result?.ok && !['duplicate','disabled'].includes(result?.reason)) {
      const now = Date.now();
      if (now - state.tiktokChatFailureAt > 30000) {
        state.tiktokChatFailureAt = now;
        toast('Chat automático sin enviar', result?.message || 'Abre TikTok e inicia sesión con la cuenta creadora.', 'error');
      }
    }
    return result;
  } catch (error) {
    const now = Date.now();
    if (now - state.tiktokChatFailureAt > 30000) {
      state.tiktokChatFailureAt = now;
      toast('Chat automático no disponible', error.message || String(error), 'error');
    }
    return { ok:false, reason:'error', message:error.message || String(error) };
  }
}

function normalizeUser(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function linesToArray(value) {
  return String(value || '').split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
}



function ensureV010Ui() {
  const nav = document.querySelector('.nav-list');
  const settingsButton = nav?.querySelector('[data-page="settings"]');
  nav?.querySelector('[data-page="events"]')?.remove();
  document.getElementById('page-events')?.remove();
  nav?.querySelector('[data-page="spotify"]')?.remove();
  if (nav && !nav.querySelector('[data-page="about"]')) {
    settingsButton?.insertAdjacentHTML('beforebegin', '<button class="nav-item" data-page="about"><span>♡</span>Sobre Lulu</button>');
  }
  const main = document.querySelector('.main-content');
  if (!main) return;
  if (!document.getElementById('page-spotify')) {
    main.insertAdjacentHTML('beforeend', `
      <section class="page" id="page-spotify">
        <div class="page-heading simple actions-heading"><div><h1>Spotify</h1></div><div class="heading-actions"><button class="ghost" data-go-page="songs">YouTube</button><button class="ghost" id="showSpotifyDesktopBtn">Abrir app de Spotify</button><button class="ghost" id="showSpotifyBtn">Ver Spotify Web</button></div></div>
        <div class="spotify-layout">
          <article class="panel spotify-player-card">
            <div class="spotify-now"><div class="spotify-cover">●</div><div><small>REPRODUCIENDO</small><strong id="spotifyCurrentTitle">Sin música</strong><span id="spotifyCurrentArtist">—</span></div></div>
            <div class="progress-wrap"><span id="spotifyCurrentTime">0:00</span><input id="spotifyProgress" type="range" min="0" max="100" value="0" disabled><span id="spotifyDuration">0:00</span></div>
            <div class="player-controls main-controls"><button id="spotifyPreviousBtn">|◀</button><button class="play-main" id="spotifyPlayPauseBtn">▶</button><button id="spotifyNextBtn">▶|</button><button id="spotifyExternalBtn">↗</button></div>
            <div class="volume-row"><span>🔊</span><input id="spotifyVolumeInput" type="range" min="0" max="1" step="0.05"><output id="spotifyVolumeOutput">80%</output></div>
            <label class="recommend-row"><span><strong>Continuar con recomendadas</strong><small>Disponible mientras Spotify Web pueda controlar la reproducción.</small></span><span class="switch"><input id="spotifyRecommendedInput" type="checkbox"><span></span></span></label>
          </article>
          <article class="panel spotify-queue-card"><div class="panel-header"><h2>Cola de Spotify</h2><button class="ghost tiny" id="clearSpotifyQueueBtn">Limpiar</button></div><div class="song-request-inline"><input id="spotifyQueryInput" placeholder="Canción, artista o enlace de Spotify"><button class="secondary" id="addSpotifyBtn">Agregar</button></div><div id="spotifyQueueList" class="spotify-queue-list"></div></article>
        </div>
      </section>`);
  }
  if (!document.getElementById('page-about')) {
    main.insertAdjacentHTML('beforeend', `
      <section class="page" id="page-about">
        <div class="page-heading simple"><div><h1>Sobre Lulu</h1><p>La persona detrás de Lulu Finity.</p></div></div>
        <div class="section-tabs category-section-tabs" data-category-tabs="about" role="tablist"><button class="section-tab active" type="button" data-category-tab="info">Información</button><button class="section-tab" type="button" data-category-tab="contact">Contacto</button></div>
        <div class="category-section-pane active" data-category-pane-group="about" data-category-pane="info"><article class="panel about-lulu-card"><img src="lulu-about-user.jpg" alt="Lulu" class="about-lulu-image"><div class="about-lulu-copy"><span class="about-kicker">DESARROLLADORA</span><h2>Lulu, también conocida como Alya</h2><p>Lulu, o más conocida como Alya, es una pequeña desarrolladora que se dedica al desarrollo de add-ons para Minecraft Bedrock y tiene los principios para crear aplicaciones.</p></div></article></div>
        <div class="category-section-pane" data-category-pane-group="about" data-category-pane="contact"><article class="panel about-lulu-card"><div class="about-lulu-copy"><span class="about-kicker">CONTACTO</span><h2>Proyectos y contacto</h2><p>Si gustas contactarme para algún proyecto, mi usuario de Discord es <strong>Luluvcupidx</strong>.</p><button class="secondary" id="copyDiscordBtn">Copiar usuario de Discord</button></div></article></div>
      </section>`);
  }
}

function safeMediaUrl(item) {
  const url = String(item?.mediaUrl || item?.url || '').trim();
  return /^(file|data|blob):/i.test(url) ? url : '';
}

function defaultSoundById(id) {
  return state.defaultSounds.find((sound) => sound.id === String(id || '')) || null;
}

function resolveDefaultSound(item = {}) {
  const sound = defaultSoundById(item.soundId || (item.category && item.id));
  if (!sound) return { ...item };
  return {
    ...item,
    soundId: sound.id,
    mediaUrl: sound.url,
    mediaPath: sound.path,
    mediaName: sound.name,
    soundUrl: sound.url,
    soundPath: sound.path,
    soundName: sound.name,
    url: sound.url,
    path: sound.path,
    name: sound.name,
    type: 'audio'
  };
}

async function loadDefaultSounds() {
  try {
    const sounds = await api.listDefaultSounds();
    state.defaultSounds = (Array.isArray(sounds) ? sounds : []).filter((sound) => sound?.id && /^(file|data|blob):/i.test(String(sound.url || '')));
  } catch (error) {
    state.defaultSounds = [];
    console.warn('No se pudo cargar la biblioteca incluida de sonidos:', error);
  }
}

function soundLibrarySelection() {
  return defaultSoundById(state.soundLibrarySelectedId);
}

function renderSoundLibrary() {
  const categories = ['Todos', ...new Set(state.defaultSounds.map((sound) => sound.category).filter(Boolean))];
  if (!categories.includes(state.soundLibraryFilter)) state.soundLibraryFilter = 'Todos';
  if ($('soundCategoryFilters')) $('soundCategoryFilters').innerHTML = categories.map((category) => `<button type="button" class="sound-category-chip ${category === state.soundLibraryFilter ? 'active' : ''}" data-sound-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
  const query = normalizeText($('soundLibrarySearchInput')?.value || '');
  const visible = state.defaultSounds.filter((sound) => (state.soundLibraryFilter === 'Todos' || sound.category === state.soundLibraryFilter) && (!query || normalizeText(`${sound.name} ${sound.category}`).includes(query)));
  if ($('defaultSoundGrid')) $('defaultSoundGrid').innerHTML = visible.length
    ? visible.map((sound) => `<button type="button" class="default-sound-card ${sound.id === state.soundLibrarySelectedId ? 'active' : ''}" data-default-sound-id="${escapeHtml(sound.id)}" aria-pressed="${sound.id === state.soundLibrarySelectedId ? 'true' : 'false'}"><span class="default-sound-icon">${escapeHtml(sound.icon || '♪')}</span><span><strong>${escapeHtml(sound.name)}</strong><small>${escapeHtml(sound.category)} · CC0</small></span><i aria-hidden="true">▶</i></button>`).join('')
    : '<div class="sound-library-empty"><strong>Sin coincidencias</strong><span>Prueba otra palabra o categoría.</span></div>';
  const selected = soundLibrarySelection();
  if ($('soundLibrarySelection')) $('soundLibrarySelection').innerHTML = selected
    ? `<span>${escapeHtml(selected.icon || '♪')}</span><div><small>SONIDO SELECCIONADO</small><strong>${escapeHtml(selected.name)}</strong><em>${escapeHtml(selected.source || 'Kenney')} · CC0</em></div>`
    : '<span>♪</span><div><small>SONIDO SELECCIONADO</small><strong>Elige uno para escucharlo</strong><em>24 efectos disponibles sin conexión</em></div>';
  if ($('useDefaultSoundBtn')) $('useDefaultSoundBtn').disabled = !selected;
}

function closeSoundLibrary() {
  $('soundLibraryModal')?.classList.add('hidden');
  state.soundLibraryApply = null;
}

function openSoundLibrary(options = {}) {
  state.soundLibraryApply = typeof options.apply === 'function' ? options.apply : null;
  state.soundLibrarySelectedId = defaultSoundById(options.selectedId)?.id || state.defaultSounds[0]?.id || '';
  state.soundLibraryFilter = 'Todos';
  if ($('soundLibraryTitle')) $('soundLibraryTitle').textContent = options.title || 'Biblioteca de sonidos';
  if ($('soundLibrarySearchInput')) $('soundLibrarySearchInput').value = '';
  renderSoundLibrary();
  $('soundLibraryModal')?.classList.remove('hidden');
  setTimeout(() => $('soundLibrarySearchInput')?.focus(), 60);
}

function previewDefaultSound(sound) {
  if (!sound) return;
  const queued = queueMediaSound({ mediaUrl:sound.url, mediaVolume:0.85 }, { lockKey:'default-sound-preview', label:`Vista previa · ${sound.name}` });
  if (!queued.accepted) toast('Vista previa ocupada', 'Espera a que termine el sonido actual.', 'error');
}

function applySoundLibrarySelection() {
  const selected = soundLibrarySelection();
  if (!selected || !state.soundLibraryApply) return;
  const apply = state.soundLibraryApply;
  closeSoundLibrary();
  apply(resolveDefaultSound(selected));
}

function bindSoundLibrary() {
  $('closeSoundLibraryBtn')?.addEventListener('click', closeSoundLibrary);
  $('cancelSoundLibraryBtn')?.addEventListener('click', closeSoundLibrary);
  $('soundLibraryModal')?.addEventListener('click', (event) => { if (event.target === $('soundLibraryModal')) closeSoundLibrary(); });
  $('soundLibrarySearchInput')?.addEventListener('input', renderSoundLibrary);
  $('soundCategoryFilters')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-sound-category]');
    if (!chip) return;
    state.soundLibraryFilter = chip.dataset.soundCategory;
    renderSoundLibrary();
  });
  $('defaultSoundGrid')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-default-sound-id]');
    if (!card) return;
    state.soundLibrarySelectedId = card.dataset.defaultSoundId;
    renderSoundLibrary();
    previewDefaultSound(soundLibrarySelection());
  });
  $('useDefaultSoundBtn')?.addEventListener('click', applySoundLibrarySelection);
  $('openSoundSourceBtn')?.addEventListener('click', () => api.openDefaultSoundSource().catch((error) => toast('No se abrió la fuente', error.message || String(error), 'error')));
  $('pickOwnSoundBtn')?.addEventListener('click', async () => {
    const selected = await api.pickMedia('audio');
    if (!selected || !state.soundLibraryApply) return;
    const apply = state.soundLibraryApply;
    closeSoundLibrary();
    apply({ ...selected, soundId:'' });
  });
}

function releaseAudioLock(lockKey = '') {
  if (lockKey) state.audioLocks.delete(lockKey);
}

function reserveAudioLock(lockKey = '') {
  if (!lockKey) return true;
  if (state.audioLocks.has(lockKey)) return false;
  state.audioLocks.add(lockKey);
  return true;
}

function enqueueExclusiveAudio(task, options = {}) {
  const lockKey = String(options.lockKey || '');
  const lockReserved = options.lockReserved === true;
  if (lockKey && !lockReserved && !reserveAudioLock(lockKey)) {
    return { accepted: false, reason: 'audio en curso', promise: Promise.resolve(false) };
  }
  if (state.audioQueue.length >= 100) {
    releaseAudioLock(lockKey);
    return { accepted: false, reason: 'cola de audio llena', promise: Promise.resolve(false) };
  }
  let resolveJob;
  const promise = new Promise((resolve) => { resolveJob = resolve; });
  state.audioQueue.push({
    id: `audio-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: String(options.kind || 'sound'),
    label: String(options.label || 'Audio'),
    lockKey,
    task,
    resolve: resolveJob
  });
  processExclusiveAudioQueue();
  return { accepted: true, reason: '', promise };
}

async function processExclusiveAudioQueue() {
  if (state.audioBusy) return;
  const job = state.audioQueue.shift();
  if (!job) return;
  state.audioBusy = true;
  state.activeAudioJob = job;
  let result = false;
  try { result = await job.task(); }
  catch (error) { console.error(`No se pudo reproducir ${job.label}:`, error); }
  finally {
    state.activeAudioCancel = null;
    state.activeAudioJob = null;
    state.audioBusy = false;
    releaseAudioLock(job.lockKey);
    job.resolve(Boolean(result));
    queueMicrotask(processExclusiveAudioQueue);
  }
}

function cancelQueuedAudioJobs(predicate = () => true) {
  const pending = [];
  for (const job of state.audioQueue) {
    if (predicate(job)) { releaseAudioLock(job.lockKey); job.resolve(false); }
    else pending.push(job);
  }
  state.audioQueue = pending;
}

function playMediaSoundNow(item) {
  const url = safeMediaUrl(item);
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    let audio;
    let finished = false;
    let watchdog = null;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (audio) {
        state.activeSounds.delete(audio);
        audio.onended = null; audio.onerror = null; audio.onabort = null; audio.onloadedmetadata = null;
      }
      resolve(Boolean(ok));
    };
    try {
      audio = new Audio(url);
      audio.volume = clamp(item?.mediaVolume ?? item?.volume ?? 0.9, 0, 1);
      state.activeSounds.add(audio);
      state.activeAudioCancel = () => { try { audio.pause(); audio.currentTime = 0; } catch {} finish(false); };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.onabort = () => finish(false);
      audio.onloadedmetadata = () => {
        const seconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration + 5 : 600;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => finish(false), Math.min(seconds, 1200) * 1000);
      };
      watchdog = setTimeout(() => finish(false), 600000);
      audio.play().catch(() => finish(false));
    } catch { finish(false); }
  });
}

function queueMediaSound(item, options = {}) {
  if (!safeMediaUrl(item)) return { accepted: false, reason: 'sonido no disponible', promise: Promise.resolve(false) };
  return enqueueExclusiveAudio(() => playMediaSoundNow(item), { ...options, kind: 'sound' });
}

function playMediaSound(item, options = {}) {
  return queueMediaSound(item, options).accepted;
}

async function showCommandImage(item) {
  if (!item?.mediaPath) return false;
  try {
    const result = await api.showOverlay({ mediaPath: item.mediaPath, duration: item.mediaDuration ?? item.duration ?? 6, screen: item.overlayScreen ?? 1 });
    if (!result?.ok) {
      toast('Superposición no conectada', result?.message || 'Agrega el enlace como fuente de navegador.', 'error');
      return false;
    }
    return true;
  } catch (error) {
    toast('Error de superposición', error?.message || String(error), 'error');
    return false;
  }
}

function normalizedEventMediaRules() {
  return (Array.isArray(state.settings?.eventMediaRules) ? state.settings.eventMediaRules : [])
    .map((rule) => {
      const resolved = resolveDefaultSound(rule);
      return {
        id: String(rule?.id || `event-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        type: ['fanSticker','gift','follow','subscribe','share','member','like'].includes(rule?.type) ? rule.type : 'fanSticker',
        match: String(rule?.match || '').trim(),
        soundId: String(resolved?.soundId || ''),
        mediaUrl: String(resolved?.mediaUrl || ''),
        mediaPath: String(resolved?.mediaPath || ''),
        mediaName: String(resolved?.mediaName || 'Sonido'),
        mediaVolume: clamp(rule?.mediaVolume ?? 0.9, 0, 1),
        enabled: rule?.enabled !== false
      };
    })
    .filter((rule) => safeMediaUrl(rule));
}

function eventRuleMatches(rule, event) {
  if (!rule.enabled || rule.type !== event.type) return false;
  if (!rule.match) return true;
  const haystack = normalizeText([event.stickerName, event.stickerId, event.giftName, event.nickname, event.uniqueId].filter(Boolean).join(' '));
  return haystack.includes(normalizeText(rule.match));
}

function runEventMediaRules(event) {
  normalizedEventMediaRules().filter((rule) => eventRuleMatches(rule, event)).forEach((rule) => {
    queueMediaSound(rule, { lockKey: `event:${rule.id}`, label: rule.mediaName || 'Sonido de evento' });
  });
}

function testEventMediaRule(rule) {
  const queued = queueMediaSound(rule, { lockKey: `test-event:${rule.id}`, label: `Prueba ${rule.mediaName || 'evento'}` });
  if (!queued.accepted) { toast('Audio ocupado', 'Espera a que termine la reproducción actual.', 'error'); return; }
  toast('Prueba en cola', `${rule.mediaName} · ${Math.round(rule.mediaVolume * 100)}%`, 'success');
}

function renderEventMediaRules() {
  const target = $('eventMediaRulesList');
  if (!target) return;
  const labels = { fanSticker:'Sticker de Fan', gift:'Regalo', follow:'Seguidor', subscribe:'Suscripción', share:'Compartido', member:'Entrada', like:'Likes' };
  const rules = normalizedEventMediaRules();
  state.settings.eventMediaRules = rules;
  target.innerHTML = rules.length ? rules.map((rule) => `<div class="event-rule-row" data-id="${escapeHtml(rule.id)}"><label class="switch"><input class="event-rule-toggle" data-id="${escapeHtml(rule.id)}" type="checkbox" ${rule.enabled ? 'checked' : ''}><span></span></label><div class="event-rule-copy"><strong>${escapeHtml(labels[rule.type] || rule.type)}</strong><span>${escapeHtml(rule.match || 'Cualquiera')}</span><small>${escapeHtml(rule.mediaName)}</small></div><div class="event-rule-volume"><div class="label-value"><label>Volumen</label><output>${Math.round(rule.mediaVolume * 100)}%</output></div><input class="event-rule-volume-input" data-id="${escapeHtml(rule.id)}" type="range" min="0" max="1" step="0.05" value="${rule.mediaVolume}"></div><button class="ghost test-event-rule" data-id="${escapeHtml(rule.id)}">Probar</button><button class="remove-event-rule" data-id="${escapeHtml(rule.id)}">×</button></div>`).join('') : '<div class="empty-state small"><strong>Sin reglas de sonido</strong><span>Elige un sonido y agrega una regla.</span></div>';
  qsa('.event-rule-toggle').forEach((input) => input.addEventListener('change', () => {
    const rule = state.settings.eventMediaRules.find((item) => item.id === input.dataset.id);
    if (rule) rule.enabled = input.checked;
    scheduleSave(); renderEventMediaRules();
  }));
  qsa('.event-rule-volume-input').forEach((input) => input.addEventListener('input', () => {
    const rule = state.settings.eventMediaRules.find((item) => item.id === input.dataset.id);
    if (!rule) return;
    rule.mediaVolume = clamp(input.value, 0, 1);
    const output = input.closest('.event-rule-volume')?.querySelector('output');
    if (output) output.textContent = `${Math.round(rule.mediaVolume * 100)}%`;
    scheduleSave();
  }));
  qsa('.test-event-rule').forEach((button) => button.addEventListener('click', () => {
    const rule = state.settings.eventMediaRules.find((item) => item.id === button.dataset.id);
    if (rule) testEventMediaRule(rule);
  }));
  qsa('.remove-event-rule').forEach((button) => button.addEventListener('click', () => {
    releaseAudioLock(`event:${button.dataset.id}`);
    state.settings.eventMediaRules = rules.filter((rule) => rule.id !== button.dataset.id);
    scheduleSave(); renderEventMediaRules();
  }));
}

function formatEvent(event) {
  const name = event.nickname || event.uniqueId || 'Alguien';
  if (event.type === 'fanSticker') return { icon: '✨', title: `${name} envió ${event.stickerName || 'un sticker de Fan'}`, detail: event.stickerId ? `ID ${event.stickerId}` : 'Sticker de Fan' };
  if (event.type === 'gift') return { icon: '🎁', title: `${name} envió ${event.giftName || 'un regalo'}`, detail: `×${event.repeatCount || 1}${event.diamonds ? ` · ${event.diamonds} diamantes` : ''}` };
  if (event.type === 'follow') return { icon: '♡', title: `${name} empezó a seguirte`, detail: 'Nuevo seguidor' };
  if (event.type === 'like') return { icon: '♥', title: `${name} envió ${event.count || 0} likes`, detail: event.total ? `${event.total} likes totales` : 'Likes recibidos' };
  if (event.type === 'share') return { icon: '↗', title: `${name} compartió el LIVE`, detail: 'Compartido' };
  if (event.type === 'subscribe') return { icon: '★', title: `${name} se suscribió`, detail: 'Nueva suscripción' };
  return { icon: '●', title: `${name} entró al LIVE`, detail: event.memberCount ? `${event.memberCount} espectadores` : 'Nuevo espectador' };
}

function eventSettingEnabled(type) {
  const key = { gift:'eventGiftEnabled', follow:'eventFollowEnabled', like:'eventLikeEnabled', share:'eventShareEnabled', member:'eventMemberEnabled', subscribe:'eventSubscribeEnabled' }[type];
  return key ? state.settings[key] !== false : true;
}

function renderLiveEvents() {
  const target = $('liveEventsList');
  if (!target) return;
  $('eventGiftCount').textContent = state.eventCounters.gift.toLocaleString('es-MX');
  $('eventDiamondCount').textContent = `${state.eventCounters.diamonds.toLocaleString('es-MX')} diamantes`;
  $('eventFollowCount').textContent = state.eventCounters.follow.toLocaleString('es-MX');
  $('eventLikeCount').textContent = state.eventCounters.likes.toLocaleString('es-MX');
  $('eventShareCount').textContent = state.eventCounters.share.toLocaleString('es-MX');
  target.innerHTML = state.liveEvents.length ? state.liveEvents.map((event) => {
    const info = formatEvent(event);
    return `<div class="live-event-row"><span class="event-icon">${info.icon}</span><div><strong>${escapeHtml(info.title)}</strong><small>${escapeHtml(info.detail)}</small></div><time>${new Date(event.timestamp).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</time></div>`;
  }).join('') : '<div class="empty-state"><div>✧</div><strong>Esperando eventos</strong><span>La actividad del LIVE aparecerá aquí.</span></div>';
  renderStudioDashboard();
}

const ECONOMY_REWARD_LABELS = {
  comment: ['Comentarios', 'cada comentario'],
  follow: ['Nuevos seguidores', 'cada seguidor'],
  like: ['Likes', 'cada cantidad de likes'],
  share: ['Compartidos', 'cada compartido'],
  subscribe: ['Suscripciones', 'cada suscripción'],
  member: ['Entradas al LIVE', 'cada entrada'],
  gift: ['Regalos / donaciones', 'cada diamante detectado; si TikTok no envía el valor, cada regalo final'],
  fanSticker: ['Stickers de Fan', 'cada sticker']
};

function normalizedEconomyRewards() {
  const defaults = {
    comment:{enabled:false,amount:1,every:1}, follow:{enabled:false,amount:10,every:1}, like:{enabled:false,amount:1,every:10},
    share:{enabled:false,amount:5,every:1}, subscribe:{enabled:false,amount:50,every:1}, member:{enabled:false,amount:2,every:1},
    gift:{enabled:true,amount:1,every:1}, fanSticker:{enabled:false,amount:2,every:1}
  };
  const incoming = state.settings?.economyRewards && typeof state.settings.economyRewards === 'object' ? state.settings.economyRewards : {};
  return Object.fromEntries(Object.entries(defaults).map(([type, fallback]) => {
    const rule = incoming[type] || {};
    return [type, { enabled: rule.enabled === true, amount: Math.max(0, Math.round(Number(rule.amount ?? fallback.amount))), every: Math.max(1, Math.round(Number(rule.every ?? fallback.every))) }];
  }));
}

function currencyText(amount) {
  const symbol = String(state.settings?.currencySymbol || '🌙').trim();
  const name = String(state.settings?.currencyName || 'Lunitas').trim();
  return `${symbol ? `${symbol} ` : ''}${Math.round(Number(amount || 0)).toLocaleString('es-MX')} ${name}`.trim();
}

async function refreshEconomy() {
  try { state.economy = await api.getEconomy(); renderEconomy(); }
  catch (error) { toast('No se pudo leer la economía', error.message || String(error), 'error'); }
}

async function rewardEconomy(type, message, quantity, sourceId) {
  if (!state.settings?.economyEnabled) return;
  const user = normalizeUser(message?.uniqueId);
  if (!user) return;
  const rule = normalizedEconomyRewards()[type];
  if (!rule?.enabled) return;
  const units = Math.floor(Math.max(0, Number(quantity || 0)) / rule.every);
  const amount = units * rule.amount;
  if (amount <= 0) return;
  const result = await api.mutateEconomy({ mode:'add', user, displayName:message?.nickname || user, profilePictureUrl:message?.profilePictureUrl || '', amount, reason:`Recompensa: ${ECONOMY_REWARD_LABELS[type]?.[0] || type}`, transactionId:`reward:${type}:${sourceId}:${user}` });
  if (result?.ok) { await refreshEconomy(); }
}

function rememberFanSticker(event) {
  if (event?.type !== 'fanSticker') return;
  const key = String(event.stickerId || event.stickerImageUrl || event.stickerName || '');
  if (!key) return;
  state.detectedFanStickers = [{ stickerId:String(event.stickerId || ''), stickerName:String(event.stickerName || 'Sticker de Fan'), stickerImageUrl:String(event.stickerImageUrl || '') }, ...state.detectedFanStickers.filter((item) => String(item.stickerId || item.stickerImageUrl || item.stickerName) !== key)].slice(0, 16);
  renderDetectedFanStickers();
}

function renderDetectedFanStickers() {
  const target = $('detectedFanStickers');
  if (!target) return;
  target.innerHTML = state.detectedFanStickers.length ? state.detectedFanStickers.map((sticker) => `<div class="detected-sticker-chip">${sticker.stickerImageUrl ? `<img src="${escapeHtml(sticker.stickerImageUrl)}" alt="">` : '<span>✨</span>'}<div><strong>${escapeHtml(sticker.stickerName)}</strong><small>${escapeHtml(sticker.stickerId || 'sin ID')}</small></div><button class="ghost use-fan-sticker" data-value="${escapeHtml(sticker.stickerId || sticker.stickerName)}">Usar</button></div>`).join('') : '<span class="hint">Los stickers detectados durante el LIVE aparecerán aquí con su ID.</span>';
  qsa('.use-fan-sticker').forEach((button) => button.addEventListener('click', () => { $('eventRuleTypeInput').value='fanSticker'; $('eventRuleMatchInput').value=button.dataset.value || ''; toast('Sticker seleccionado', button.dataset.value || '', 'success'); }));
}

function processLiveEvent(event) {
  handleAutomationEvent(event).catch(()=>{});
  runEventMediaRules(event);
  rememberFanSticker(event);
  const quantity = event.type === 'like' ? Number(event.count || 0) : event.type === 'gift' ? Number(event.rewardUnits || event.diamonds || event.repeatCount || 1) : 1;
  void rewardEconomy(event.type, event, quantity, event.id || `${event.type}-${event.timestamp}`);
}



const RANKING_DEFAULTS = [1,2,3,4].map((slot) => ({
  id:`ranking-${slot}`, type:slot===1?'coins':slot===2?'likes':slot===3?'economy':'comments',
  title:slot===1?'TOP GIFTERS':slot===2?'TOP TAP TAPS':slot===3?'TOP MONEDAS':'TOP COMENTARIOS',
  limit:5, style:'tiktok', font:'Segoe UI', textColor:'#ffffff', accentColor:'#ff2d8f', secondaryColor:'#25f4ee', backgroundColor:'#101018', backgroundOpacity:82,
  rgbText:false, showAvatar:true, showValue:true, showRank:true, uppercaseNames:false
}));
const RANKING_TYPES = new Set(['coins','likes','economy','gifts','comments','shares','follows','members','subscribes','fanStickers']);
const RANKING_STYLES = new Set(['tiktok','glass','neon','minimal']);
const RANKING_FONTS = new Set(['Segoe UI','Arial','Impact','Trebuchet MS','Georgia','Courier New','Comic Sans MS']);

function normalizedRankingOverlays() {
  const incoming = Array.isArray(state.settings?.rankingOverlays) ? state.settings.rankingOverlays : [];
  const validColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  return RANKING_DEFAULTS.map((fallback, index) => {
    const item = incoming[index] && typeof incoming[index] === 'object' ? incoming[index] : {};
    return {
      ...fallback,
      id:`ranking-${index + 1}`,
      type:RANKING_TYPES.has(item.type)?item.type:fallback.type,
      title:String(item.title || fallback.title).trim().slice(0,60),
      limit:[3,5,7,10].includes(Number(item.limit))?Number(item.limit):5,
      style:RANKING_STYLES.has(item.style)?item.style:fallback.style,
      font:RANKING_FONTS.has(item.font)?item.font:fallback.font,
      textColor:validColor(item.textColor,fallback.textColor), accentColor:validColor(item.accentColor,fallback.accentColor), secondaryColor:validColor(item.secondaryColor,fallback.secondaryColor), backgroundColor:validColor(item.backgroundColor,fallback.backgroundColor),
      backgroundOpacity:clamp(item.backgroundOpacity ?? fallback.backgroundOpacity,0,100), rgbText:item.rgbText===true, showAvatar:item.showAvatar!==false, showValue:item.showValue!==false, showRank:item.showRank!==false, uppercaseNames:item.uppercaseNames===true
    };
  });
}

function activeRankingConfig() {
  state.settings.rankingOverlays = normalizedRankingOverlays();
  const slot = clamp($('rankingSlotInput')?.value || state.ranking.slot || 1,1,4);
  return state.settings.rankingOverlays[slot - 1];
}

function setRankingControlValues() {
  if (!$('rankingSlotInput')) return;
  state.settings.rankingOverlays = normalizedRankingOverlays();
  const slot = clamp(state.ranking.slot || $('rankingSlotInput').value || 1,1,4);
  $('rankingSlotInput').value=String(slot);
  const c=state.settings.rankingOverlays[slot-1];
  $('rankingTypeInput').value=c.type; $('rankingTitleInput').value=c.title; $('rankingLimitInput').value=String(c.limit); $('rankingStyleInput').value=c.style; $('rankingFontInput').value=c.font;
  $('rankingTextColorInput').value=c.textColor; $('rankingAccentColorInput').value=c.accentColor; $('rankingSecondaryColorInput').value=c.secondaryColor; $('rankingBackgroundColorInput').value=c.backgroundColor;
  $('rankingBackgroundOpacityInput').value=String(c.backgroundOpacity); $('rankingBackgroundOpacityOutput').textContent=`${Math.round(c.backgroundOpacity)}%`;
  $('rankingRgbInput').checked=c.rgbText; $('rankingShowAvatarInput').checked=c.showAvatar; $('rankingShowValueInput').checked=c.showValue; $('rankingShowRankInput').checked=c.showRank; $('rankingUppercaseInput').checked=c.uppercaseNames;
}

function collectRankingControls() {
  const slot=clamp($('rankingSlotInput').value,1,4);
  state.ranking.slot=slot;
  const previous=normalizedRankingOverlays()[slot-1];
  state.settings.rankingOverlays=normalizedRankingOverlays();
  state.settings.rankingOverlays[slot-1]={...previous,type:$('rankingTypeInput').value,title:$('rankingTitleInput').value.trim()||previous.title,limit:Number($('rankingLimitInput').value),style:$('rankingStyleInput').value,font:$('rankingFontInput').value,textColor:$('rankingTextColorInput').value,accentColor:$('rankingAccentColorInput').value,secondaryColor:$('rankingSecondaryColorInput').value,backgroundColor:$('rankingBackgroundColorInput').value,backgroundOpacity:clamp($('rankingBackgroundOpacityInput').value,0,100),rgbText:$('rankingRgbInput').checked,showAvatar:$('rankingShowAvatarInput').checked,showValue:$('rankingShowValueInput').checked,showRank:$('rankingShowRankInput').checked,uppercaseNames:$('rankingUppercaseInput').checked};
  $('rankingBackgroundOpacityOutput').textContent=`${Math.round(Number($('rankingBackgroundOpacityInput').value||0))}%`;
  clearTimeout(state.rankingSaveTimer);
  state.rankingSaveTimer=setTimeout(async()=>{try{state.settings=await api.saveSettings(state.settings);await api.refreshRanking(slot);if(Number($('rankingSlotInput')?.value||1)===slot)await refreshRankingInfo(slot,true);}catch(error){toast('No se guardó el ranking',error.message||String(error),'error');}},220);
}

async function refreshRankingInfo(slot = null, refreshFrame = false) {
  if (!$('rankingUrlOutput')) return;
  const selected=clamp(slot ?? $('rankingSlotInput').value ?? state.ranking.slot ?? 1,1,4);
  try {
    const info=await api.getRankingInfo(selected);
    state.ranking={...state.ranking,...info,slot:selected};
    $('rankingUrlOutput').value=info.url||'HTTPS no disponible';
    if($('rankingLocalUrlOutput'))$('rankingLocalUrlOutput').value=info.localUrl||'';
    if($('rankingHttpsStatus')){const ready=Boolean(info.url);$('rankingHttpsStatus').textContent=info.tunnelMessage||(ready?'HTTPS fijo listo. Esta URL no cambia al reiniciar.':'No se pudo crear HTTPS. Pulsa Copiar HTTPS para reintentar.');$('rankingHttpsStatus').classList.toggle('ready',ready);$('rankingHttpsStatus').classList.toggle('error',!ready);}
    $('rankingConnectionStatus').textContent=info.connected?`${info.connected} fuente${info.connected===1?'':'s'} conectada${info.connected===1?'':'s'}`:'Sin fuente conectada';
    $('rankingConnectionStatus').classList.toggle('connected',Boolean(info.connected));
    const frame=$('rankingPreviewFrame');
    if(frame&&(refreshFrame||!frame.src||!frame.src.includes(`/ranking?slot=${selected}`))){markPermanentPreviewLoading(frame);frame.src=`${info.previewUrl}&refresh=${Date.now()}`;}
  } catch(error) { $('rankingConnectionStatus').textContent=error.message||'No disponible'; }
}

async function switchRankingSlot() {
  state.ranking.slot=clamp($('rankingSlotInput').value,1,4);
  setRankingControlValues();
  await refreshRankingInfo(state.ranking.slot,true);
  await refreshStreamWidgetInfo('playlist',true);
  await refreshStreamWidgetInfo('wallet',true);
}


function playlistWidgetPayload() {
  const spotify = activeMusicProvider() === 'spotify';
  const current = spotify ? state.currentSpotify : state.currentSong;
  const player = spotify ? state.spotifyPlayer : state.player;
  const queue = spotify ? state.spotifyQueue : state.songQueue;
  const requestedCurrent = Boolean(current && (spotify || !current.isRecommendation));
  return {
    type:'playlist',
    provider:spotify?'Spotify':'YouTube',
    visible:requestedCurrent || queue.length > 0,
    current:requestedCurrent ? {
      title:String(player?.title || current?.title || current?.selectedTitle || current?.query || 'Canción actual').slice(0,180),
      requestedBy:String(current?.requestedBy || (spotify ? player?.artist : '') || '').slice(0,100)
    } : null,
    queue:queue.slice(0,5).map((song)=>({
      title:String(song?.title || song?.selectedTitle || song?.query || 'Canción').slice(0,180),
      requestedBy:String(song?.requestedBy || '').slice(0,100)
    }))
  };
}

function schedulePlaylistWidgetSync() {
  clearTimeout(state.streamWidgetSyncTimer);
  state.streamWidgetSyncTimer=setTimeout(()=>{
    api.updateStreamWidget('playlist',playlistWidgetPayload()).catch(()=>{});
  },90);
}

async function refreshStreamWidgetInfo(type, refreshFrame=false) {
  const normalized=['playlist','wallet','game','alert','goal','gift'].includes(type)?type:'playlist';
  const prefix=normalized==='wallet'?'walletWidget':normalized==='game'?'gameWidget':normalized==='alert'?'alertWidget':normalized==='goal'?'goalWidget':normalized==='gift'?'giftWidget':'playlistWidget';
  try {
    const info=await api.getStreamWidgetInfo(normalized);
    state.streamWidgets[normalized]={...state.streamWidgets[normalized],...info};
    const url=$(prefix+'UrlOutput'),local=$(prefix+'LocalUrlOutput'),status=$(prefix+'Status'),frame=$(prefix+'PreviewFrame');
    if(url)url.value=info.url||'HTTPS no disponible';
    if(local)local.value=info.localUrl||'';
    if(status){status.textContent=info.connected?`${info.connected} fuente${info.connected===1?'':'s'} conectada${info.connected===1?'':'s'}`:(info.tunnelMessage||'Sin fuente conectada');status.classList.toggle('connected',Boolean(info.connected));}
    if(frame&&(refreshFrame||!frame.src||!frame.src.includes(`/widget?type=${normalized}`))){markPermanentPreviewLoading(frame);frame.src=`${info.previewUrl}&refresh=${Date.now()}`;}
    return info;
  } catch(error) {
    const status=$(prefix+'Status');if(status)status.textContent=error.message||'No disponible';
    return null;
  }
}

async function copyStreamWidgetLink(type, local=false) {
  const normalized=['playlist','wallet','game','alert','goal','gift'].includes(type)?type:'playlist';
  const info=local?await api.copyStreamWidgetLocalUrl(normalized):await api.copyStreamWidgetUrl(normalized);
  await refreshStreamWidgetInfo(normalized,false);
  if(local||info?.url)toast('Enlace copiado',local?'Enlace local para OBS.':'Enlace HTTPS para TikTok LIVE Studio.','success');
  else toast('HTTPS no disponible',info?.tunnelMessage||'No se pudo crear el enlace seguro.','error');
}

function spotifyIdentity(value) {
  const text = String(value || '').trim();
  const match = text.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i);
  return match ? `spotify:${match[1]}` : normalizeText(text).replace(/[^a-z0-9]+/g,' ').trim();
}
function enqueueSpotify(query, requestedBy='Manual', metadata={}) {
  query=String(query||'').trim(); if(!query) return false;
  const identity=spotifyIdentity(query);
  if ([state.currentSpotify,...state.spotifyQueue].filter(Boolean).some(x=>spotifyIdentity(x.url||x.title||x.query)===identity)) { toast('Spotify duplicado','Ya está sonando o en la cola.','error'); return false; }
  if (state.spotifyQueue.length >= Math.max(1,Number(state.settings.songQueueLimit)||10)) { toast('Cola de Spotify llena','','error'); return false; }
  const request={id:`sp-${Date.now()}-${Math.random()}`,query,requestedBy,requestedById:normalizeUser(metadata.requestedById||requestedBy),chargedAmount:Math.max(0,Math.round(Number(metadata.chargedAmount||0))),chargeTransactionId:String(metadata.chargeTransactionId||'')};
  state.spotifyQueue.push(request); renderSpotify();
  void sendTikTokAutoChatEvent('songQueued',{song:request,position:state.spotifyQueue.length,queueLength:state.spotifyQueue.length,provider:'Spotify'});
  if(!state.currentSpotify&&!state.spotifyTransitioning) playNextSpotify(); return true;
}
async function playNextSpotify(){
  if(state.spotifyTransitioning)return; state.spotifyTransitioning=true;
  if(!state.spotifyQueue.length){state.currentSpotify=null;state.spotifyTransitioning=false;renderSpotify();return;}
  state.currentSpotify=state.spotifyQueue.shift();renderSpotify();
  try{await api.openSpotify({query:state.currentSpotify.query});toast('Buscando en Spotify',state.currentSpotify.query,'success');void sendTikTokAutoChatEvent('songStarted',{song:state.currentSpotify,position:1,queueLength:state.spotifyQueue.length,provider:'Spotify'});}
  catch(e){toast('No se pudo abrir Spotify',e.message||String(e),'error');}
  finally{state.spotifyTransitioning=false;}
}
function finishSpotify(reason='ended'){const finished=state.currentSpotify;state.currentSpotify=null;state.spotifyPlayer={...state.spotifyPlayer,currentTime:0,duration:0,paused:true};renderSpotify();if(finished){void sendTikTokAutoChatEvent(reason==='skipped'?'songSkipped':'songEnded',{song:finished,queueLength:state.spotifyQueue.length,provider:'Spotify'});}if(state.spotifyQueue.length)playNextSpotify();}
function renderSpotify(){
  if(!$('spotifyCurrentTitle'))return;
  const p=state.spotifyPlayer; $('spotifyCurrentTitle').textContent=p.title||state.currentSpotify?.title||state.currentSpotify?.query||'Sin música';
  $('spotifyCurrentArtist').textContent=p.artist||state.currentSpotify?.requestedBy||'Abre Spotify e inicia sesión una vez.';
  $('spotifyCurrentTime').textContent=formatClock(p.currentTime); $('spotifyDuration').textContent=formatClock(p.duration);
  $('spotifyProgress').value=p.duration?Math.min(100,p.currentTime/p.duration*100):0;
  $('spotifyPlayPauseBtn').textContent=p.paused?'▶':'Ⅱ';
  $('spotifyQueueList').innerHTML=state.spotifyQueue.length?state.spotifyQueue.map((x,i)=>`<div class="spotify-queue-row"><span>${i+1}</span><div><strong>${escapeHtml(x.query)}</strong><small>${escapeHtml(x.requestedBy)}</small></div><button class="remove-spotify" data-id="${escapeHtml(x.id)}">×</button></div>`).join(''):'<div class="empty-state small"><span>Cola vacía</span></div>';
  qsa('.remove-spotify').forEach(b=>b.onclick=()=>{state.spotifyQueue=state.spotifyQueue.filter(x=>x.id!==b.dataset.id);renderSpotify();});
  $('spotifyVolumeOutput').textContent=`${Math.round((state.settings.spotifyVolume??.8)*100)}%`;
  renderDashboardMusic();
}

function youtubeVideoId(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.replace(/^\//, '').split('/')[0] || '';
    if (host.endsWith('youtube.com')) return url.searchParams.get('v') || '';
  } catch {}
  return '';
}

function songIdentity(value) {
  const videoId = youtubeVideoId(value);
  if (videoId) return `video:${videoId.toLowerCase()}`;
  return normalizeText(value)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(audio oficial|official audio|video oficial|lyrics?|letra|hd|4k)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedBlockList(key) {
  return (Array.isArray(state.settings?.[key]) ? state.settings[key] : [])
    .map((item) => normalizeText(item).trim())
    .filter(Boolean);
}

function matchesBlockedValue(value, key) {
  const normalized = normalizeText(value).trim();
  return Boolean(normalized) && normalizedBlockList(key).some((blocked) => normalized.includes(blocked));
}

function songPolicyIssue(request, player = {}) {
  const title = player.title || request?.selectedTitle || request?.query || '';
  const channel = player.channel || request?.channel || '';
  if (matchesBlockedValue(request?.query || '', 'blockedSongs') || matchesBlockedValue(title, 'blockedSongs')) return 'canción bloqueada';
  if (channel && matchesBlockedValue(channel, 'blockedChannels')) return 'canal bloqueado';
  const maxMinutes = Math.max(0, Number(state.settings?.maxSongDurationMinutes) || 0);
  const duration = Number(player.duration || 0);
  if (maxMinutes > 0 && duration > maxMinutes * 60 + 2) return `supera ${maxMinutes} min`;
  return '';
}

function applyDashboardVisibility() {
  const hidden = new Set(Array.isArray(state.settings?.hiddenDashboardPanels) ? state.settings.hiddenDashboardPanels : []);
  const mapping = { stats: 'dashboardStatsPanel', comments: 'dashboardCommentsPanel', music: 'dashboardMusicPanel', simulator: 'dashboardSimulatorPanel' };
  let visibleGridPanels = 0;
  for (const [key, id] of Object.entries(mapping)) {
    const element = $(id);
    if (element) element.classList.toggle('dashboard-hidden', hidden.has(key));
    const checkbox = document.querySelector(`[data-dashboard-panel="${key}"]`);
    if (checkbox) checkbox.checked = hidden.has(key);
    if (key !== 'stats' && !hidden.has(key)) visibleGridPanels += 1;
  }
  document.querySelector('.dashboard-grid-v8')?.classList.toggle('single-column', visibleGridPanels <= 1);
}

function applyAppearance() {
  if (!state.settings) return;
  const palettes = {
    pink: ['255,117,172', '154,87,196'],
    blush: ['255,174,214', '218,139,255'],
    purple: ['174,94,255', '105,79,224'],
    red: ['255,76,105', '187,39,72'],
    blue: ['70,157,255', '112,88,232'],
    dark: ['227,107,157', '143,124,232'],
    'miku-classic': ['37,244,238', '46,195,192'],
    'miku-soft': ['255,166,207', '91,224,216'],
    'miku-dark': ['124,88,232', '37,244,238'],
    'studio-lavender': ['183,145,255', '255,137,198'],
    'studio-pink': ['255,151,198', '180,137,255'],
    'studio-mint': ['103,220,214', '183,145,255']
  };
  const theme = Object.hasOwn(palettes, state.settings.themeMode) ? state.settings.themeMode : 'pink';
  const glow = clamp(state.settings.glowIntensity ?? 70, 0, 100);
  const opacity = clamp(state.settings.panelOpacity ?? 78, 20, 100);
  const radius = clamp(state.settings.cornerRadius ?? 15, 6, 24);
  const [primary, secondary] = palettes[theme];
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--panel-opacity', String(opacity / 100));
  document.documentElement.style.setProperty('--corner-radius', `${radius}px`);
  document.documentElement.style.setProperty('--glow-pink', `rgba(${primary},${(0.36 * glow / 100).toFixed(3)})`);
  document.documentElement.style.setProperty('--glow-purple', `rgba(${secondary},${(0.23 * glow / 100).toFixed(3)})`);
  qsa('[data-theme-choice]').forEach((button) => {
    const active = button.dataset.themeChoice === theme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  applyDashboardVisibility();
  renderStudioDashboard();
}

function studioThemeInfo(theme = state.settings?.themeMode) {
  const map = {
    'studio-lavender': { image:'miku-dark-user.png', label:'Lavanda' },
    'studio-pink': { image:'miku-soft-user.png', label:'Rosa' },
    'studio-mint': { image:'miku-classic-user.jpg', label:'Menta' }
  };
  return map[theme] || null;
}

function studioRelativeTime(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - Number(timestamp || Date.now())) / 1000));
  if (seconds < 45) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

function renderStudioDashboard() {
  if (!$('studioDashboard') || !state.settings) return;
  const themeInfo = studioThemeInfo();
  const studio = Boolean(themeInfo);
  $('studioDashboard').classList.toggle('ready', studio);
  if (themeInfo && $('studioMikuImage')) $('studioMikuImage').src = themeInfo.image;
  qsa('[data-studio-theme]').forEach((button) => button.classList.toggle('active', button.dataset.studioTheme === state.settings.themeMode));

  const connected = Boolean(state.connected);
  if ($('studioLiveBadge')) { $('studioLiveBadge').textContent = connected ? 'LIVE' : 'OFF'; $('studioLiveBadge').classList.toggle('live', connected); }
  if ($('studioConnectionText')) $('studioConnectionText').textContent = connected ? 'En vivo' : 'Desconectado';
  const username = normalizeUser(state.settings.username || $('usernameInput')?.value || '');
  if ($('studioUsername')) $('studioUsername').textContent = username ? `@${username}` : 'Sin cuenta';
  if ($('studioViewerCount')) $('studioViewerCount').textContent = Number(state.viewerCount || 0).toLocaleString('es-MX');
  if ($('studioSessionState')) $('studioSessionState').textContent = connected ? 'En vivo' : 'Sin LIVE';
  if ($('studioConnectBtn')) $('studioConnectBtn').textContent = connected ? 'Desconectar' : 'Conectar';
  if ($('studioCommentCount')) $('studioCommentCount').textContent = Number(state.commentCount || 0).toLocaleString('es-MX');
  if ($('studioLikeCount')) $('studioLikeCount').textContent = Number(state.eventCounters.likes || 0).toLocaleString('es-MX');
  if ($('studioGiftCount')) $('studioGiftCount').textContent = Number(state.giftStats.totalGifts || state.eventCounters.gift || 0).toLocaleString('es-MX');
  if ($('studioDiamondCount')) $('studioDiamondCount').textContent = Number(state.giftStats.totalDiamonds || state.eventCounters.diamonds || 0).toLocaleString('es-MX');
  if ($('studioVoiceQueue')) $('studioVoiceQueue').textContent = String(state.speechQueue.length + (state.speaking ? 1 : 0));

  const activity = $('studioActivityList');
  if (activity) {
    const items = state.liveEvents.slice(0, 5);
    activity.innerHTML = items.length ? items.map((event) => {
      const info = formatEvent(event);
      return `<div class="studio-activity-row"><span>${info.icon}</span><div><strong>${escapeHtml(info.title)}</strong><small>${escapeHtml(info.detail)}</small></div><time>${studioRelativeTime(event.timestamp)}</time></div>`;
    }).join('') : '<div class="studio-empty">Sin actividad todavía</div>';
  }

  const lastAction = state.automationLog.find((item) => item.type === 'action');
  if ($('studioAlertTitle')) $('studioAlertTitle').textContent = lastAction ? lastAction.text : 'Sin alertas pendientes';
  if ($('studioAlertDetail')) $('studioAlertDetail').textContent = lastAction ? studioRelativeTime(lastAction.time) : 'Todo en orden';

  const goals = normalizedLiveGoals();
  const goal = goals.find((item) => item.id === state.settings.selectedGoalId) || goals.find((item) => item.enabled !== false);
  const progress = Math.max(0, Number(goal?.progress || 0));
  const target = Math.max(0, Number(goal?.target || 0));
  const pct = target ? Math.min(100, progress / target * 100) : 0;
  if ($('studioGoalTitle')) $('studioGoalTitle').textContent = goal?.title || 'Sin meta activa';
  if ($('studioGoalText')) $('studioGoalText').textContent = goal ? `${progress.toLocaleString('es-MX')} / ${target.toLocaleString('es-MX')} · ${GOAL_LABELS[goal.type] || ''}` : 'Crea una meta en Automatizaciones';
  if ($('studioGoalPercent')) $('studioGoalPercent').textContent = `${Math.round(pct)}%`;
  if ($('studioGoalBar')) $('studioGoalBar').style.width = `${pct}%`;
  if ($('studioGoalRing')) $('studioGoalRing').style.setProperty('--goal-progress', `${pct * 3.6}deg`);

  const gift = state.giftStats.lastGift;
  if ($('studioGiftUser')) $('studioGiftUser').textContent = gift?.displayName || gift?.nickname || gift?.uniqueId || 'Sin regalos todavía';
  if ($('studioGiftText')) $('studioGiftText').textContent = gift ? `${gift.giftName || 'Regalo'} ×${gift.repeatCount || 1}${gift.diamonds ? ` · ${Number(gift.diamonds).toLocaleString('es-MX')} monedas` : ''}` : 'La sesión aparecerá aquí';

  const ranking = $('studioRankingList');
  if (ranking) {
    const entries = Array.isArray(state.ranking.snapshot?.entries) ? state.ranking.snapshot.entries.slice(0, 5) : [];
    ranking.innerHTML = entries.length ? entries.map((entry, index) => `<div class="studio-ranking-row"><b>${index + 1}</b>${entry.profilePictureUrl ? `<img src="${escapeHtml(entry.profilePictureUrl)}" alt="">` : `<span class="studio-rank-avatar">${escapeHtml(String(entry.displayName || entry.user || '?').slice(0,1).toUpperCase())}</span>`}<strong>${escapeHtml(entry.displayName || entry.user || 'Usuario')}</strong><em>${Number(entry.value || 0).toLocaleString('es-MX')}</em></div>`).join('') : '<div class="studio-empty">Sin datos todavía</div>';
  }
}

function currentSystemVoice(voiceURI = '') {
  const uri = voiceURI || state.settings.voiceURI;
  return state.voices.find((voice) => voice.voiceURI === uri)
    || state.voices.find((voice) => /^es(-|_)/i.test(voice.lang))
    || state.voices[0]
    || null;
}

function languageMatches(locale, filter) {
  if (!filter || filter === 'all') return true;
  return String(locale || '').toLowerCase().startsWith(`${filter.toLowerCase()}-`)
    || String(locale || '').toLowerCase() === filter.toLowerCase();
}

function selectedVoiceValue() {
  if (state.settings.voiceMode === 'local') return `local:${state.settings.localVoiceId || 'lulu-es-mx'}`;
  if (state.settings.voiceMode === 'tiktok') return `tiktok:${state.settings.tiktokVoice || 'es_mx_002'}`;
  if (state.settings.voiceMode === 'online') return `online:${state.settings.onlineVoice || 'es-MX-DaliaNeural'}`;
  return `system:${state.settings.voiceURI || ''}`;
}

function parseVoiceValue(value) {
  const raw = String(value || '');
  if (raw.startsWith('local:')) return { mode:'local', localVoiceId:raw.slice(6), voiceURI:'', tiktokVoice:'', onlineVoice:'' };
  if (raw.startsWith('tiktok:')) return { mode:'tiktok', tiktokVoice:raw.slice(7), voiceURI:'', onlineVoice:'' };
  if (raw.startsWith('online:')) return { mode:'online', onlineVoice:raw.slice(7), voiceURI:'', tiktokVoice:'' };
  if (raw.startsWith('system:')) return { mode:'system', voiceURI:raw.slice(7), tiktokVoice:'', onlineVoice:'' };
  return null;
}

function normalizedUserVoiceRules() {
  const seen = new Set();
  const defaultRate = clamp(state.settings?.rate ?? 1, 0.5, 2);
  const defaultPitch = clamp(state.settings?.pitch ?? 1, 0.5, 2);
  const defaultVolume = clamp(state.settings?.ttsVolume ?? 0.9, 0, 1);
  return (Array.isArray(state.settings?.userVoiceRules) ? state.settings.userVoiceRules : [])
    .map((rule) => ({
      id: String(rule?.id || `${Date.now()}-${Math.random()}`),
      user: normalizeUser(rule?.user),
      voice: String(rule?.voice || ''),
      rate: clamp(rule?.rate ?? defaultRate, 0.5, 2),
      pitch: clamp(rule?.pitch ?? defaultPitch, 0.5, 2),
      volume: clamp(rule?.volume ?? defaultVolume, 0, 1)
    }))
    .filter((rule) => rule.user && parseVoiceValue(rule.voice))
    .filter((rule) => {
      if (seen.has(rule.user)) return false;
      seen.add(rule.user);
      return true;
    });
}

function voiceLabel(value) {
  const parsed = parseVoiceValue(value);
  if (!parsed) return 'Voz predeterminada';
  if (parsed.mode === 'local') { const voice=state.localVoices.find((item)=>item.id===parsed.localVoiceId); return voice?`${voice.name} — ${voice.language} · local`:parsed.localVoiceId; }
  if (parsed.mode === 'tiktok') {
    const voice = state.tiktokVoices.find((item) => item.id === parsed.tiktokVoice);
    return voice ? `${voice.name} — TikTok · ${voice.locale}` : parsed.tiktokVoice;
  }
  if (parsed.mode === 'online') {
    const voice = state.onlineVoices.find((item) => item.shortName === parsed.onlineVoice);
    return voice ? `${voice.localName || voice.name || voice.shortName} — Microsoft · ${voice.locale}` : parsed.onlineVoice;
  }
  const voice = state.voices.find((item) => item.voiceURI === parsed.voiceURI);
  return voice ? `${voice.name} — ${voice.lang}` : (parsed.voiceURI || 'Voz de Windows');
}

function voiceConfigFromRule(rule) {
  const parsed = parseVoiceValue(rule?.voice);
  if (!parsed) return null;
  return {
    ...parsed,
    rate: clamp(rule?.rate ?? state.settings.rate, 0.5, 2),
    pitch: clamp(rule?.pitch ?? state.settings.pitch, 0.5, 2),
    volume: clamp(rule?.volume ?? state.settings.ttsVolume, 0, 1)
  };
}

function voiceForMessage(message) {
  const user = normalizeUser(message?.uniqueId);
  if (!user) return null;
  const rule = normalizedUserVoiceRules().find((item) => item.user === user);
  return rule ? voiceConfigFromRule(rule) : null;
}

function renderCustomVoiceOptions() {
  const source = $('voiceSelect');
  const target = $('customVoiceSelect');
  if (!source || !target) return;
  const previous = target.value;
  target.innerHTML = source.innerHTML;
  if (previous && [...target.options].some((option) => option.value === previous)) target.value = previous;
  else if ([...target.options].some((option) => option.value === selectedVoiceValue())) target.value = selectedVoiceValue();
}

function syncCustomVoiceBuilderOutputs() {
  if ($('customVoiceRateOutput')) $('customVoiceRateOutput').textContent = `${clamp($('customVoiceRateInput')?.value ?? 1, 0.5, 2).toFixed(2)}×`;
  if ($('customVoicePitchOutput')) $('customVoicePitchOutput').textContent = clamp($('customVoicePitchInput')?.value ?? 1, 0.5, 2).toFixed(2);
  if ($('customVoiceVolumeOutput')) $('customVoiceVolumeOutput').textContent = `${Math.round(clamp($('customVoiceVolumeInput')?.value ?? 0.9, 0, 1) * 100)}%`;
}

function customVoiceBuilderConfig() {
  const parsed = parseVoiceValue($('customVoiceSelect')?.value || '');
  if (!parsed) return null;
  return {
    ...parsed,
    rate: clamp($('customVoiceRateInput')?.value ?? 1, 0.5, 2),
    pitch: clamp($('customVoicePitchInput')?.value ?? 1, 0.5, 2),
    volume: clamp($('customVoiceVolumeInput')?.value ?? 0.9, 0, 1)
  };
}

function testCustomVoiceConfig(config, label = 'Voz personalizada') {
  if (!config) { toast('Falta la voz', 'Selecciona un modelo de voz.', 'error'); return; }
  const text = $('customVoiceTestInput')?.value.trim() || 'Hola, esta es mi voz personalizada.';
  const queued = speakText(text, false, null, config, { lockKey: `test-voice:${label}`, label });
  if (!queued.accepted) { toast('Audio ocupado', 'Espera a que termine la prueba anterior.', 'error'); return; }
  toast('Prueba en cola', label, 'success');
}

function renderUserVoiceRules() {
  const list = $('customVoiceRulesList');
  if (!list) return;
  const rules = normalizedUserVoiceRules();
  state.settings.userVoiceRules = rules;
  $('userVoiceRulesCount').textContent = String(rules.length);
  list.innerHTML = rules.length
    ? rules.map((rule) => `<div class="custom-voice-rule" data-id="${escapeHtml(rule.id)}"><div class="custom-voice-rule-head"><strong>@${escapeHtml(rule.user)}</strong><span>${escapeHtml(voiceLabel(rule.voice))}</span><button class="ghost test-user-voice" data-id="${escapeHtml(rule.id)}">Probar</button><button class="danger-outline remove-user-voice" data-id="${escapeHtml(rule.id)}">×</button></div><div class="field-group"><label>Modelo de voz</label><select class="user-voice-select" data-id="${escapeHtml(rule.id)}"></select></div><div class="custom-voice-rule-tuning"><div class="field-group"><div class="label-value"><label>Velocidad</label><output>${rule.rate.toFixed(2)}×</output></div><input class="user-voice-rate" data-id="${escapeHtml(rule.id)}" type="range" min="0.5" max="2" step="0.05" value="${rule.rate}"></div><div class="field-group"><div class="label-value"><label>Tono</label><output>${rule.pitch.toFixed(2)}</output></div><input class="user-voice-pitch" data-id="${escapeHtml(rule.id)}" type="range" min="0.5" max="2" step="0.05" value="${rule.pitch}"></div><div class="field-group"><div class="label-value"><label>Volumen</label><output>${Math.round(rule.volume * 100)}%</output></div><input class="user-voice-volume" data-id="${escapeHtml(rule.id)}" type="range" min="0" max="1" step="0.05" value="${rule.volume}"></div></div></div>`).join('')
    : '<span class="hint">No hay voces personalizadas.</span>';

  qsa('.user-voice-select').forEach((select) => {
    select.innerHTML = $('voiceSelect')?.innerHTML || $('customVoiceSelect')?.innerHTML || '';
    const rule = state.settings.userVoiceRules.find((item) => item.id === select.dataset.id);
    if (rule && [...select.options].some((option) => option.value === rule.voice)) select.value = rule.voice;
    select.addEventListener('change', () => {
      const current = state.settings.userVoiceRules.find((item) => item.id === select.dataset.id);
      if (!current || !parseVoiceValue(select.value)) return;
      current.voice = select.value;
      scheduleSave(); renderUserVoiceRules();
    });
  });

  const bindRuleRange = (selector, key, min, max, formatter) => qsa(selector).forEach((input) => input.addEventListener('input', () => {
    const rule = state.settings.userVoiceRules.find((item) => item.id === input.dataset.id);
    if (!rule) return;
    rule[key] = clamp(input.value, min, max);
    const output = input.closest('.field-group')?.querySelector('output');
    if (output) output.textContent = formatter(rule[key]);
    scheduleSave();
  }));
  bindRuleRange('.user-voice-rate', 'rate', 0.5, 2, (value) => `${value.toFixed(2)}×`);
  bindRuleRange('.user-voice-pitch', 'pitch', 0.5, 2, (value) => value.toFixed(2));
  bindRuleRange('.user-voice-volume', 'volume', 0, 1, (value) => `${Math.round(value * 100)}%`);

  qsa('.test-user-voice').forEach((button) => button.addEventListener('click', () => {
    const rule = state.settings.userVoiceRules.find((item) => item.id === button.dataset.id);
    if (rule) testCustomVoiceConfig(voiceConfigFromRule(rule), `@${rule.user}`);
  }));
  qsa('.remove-user-voice').forEach((button) => button.addEventListener('click', () => {
    state.settings.userVoiceRules = rules.filter((rule) => rule.id !== button.dataset.id);
    releaseAudioLock(`test-voice:@${rules.find((rule) => rule.id === button.dataset.id)?.user || ''}`);
    scheduleSave();
    renderUserVoiceRules();
  }));
}

function addUserVoiceRule() {
  const user = normalizeUser($('customVoiceUserInput').value);
  const voice = $('customVoiceSelect').value;
  if (!user || !parseVoiceValue(voice)) {
    toast('Faltan datos', 'Escribe un usuario y selecciona una voz.', 'error');
    return;
  }
  const rules = normalizedUserVoiceRules().filter((rule) => rule.user !== user);
  rules.push({
    id: `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user,
    voice,
    rate: clamp($('customVoiceRateInput')?.value ?? state.settings.rate, 0.5, 2),
    pitch: clamp($('customVoicePitchInput')?.value ?? state.settings.pitch, 0.5, 2),
    volume: clamp($('customVoiceVolumeInput')?.value ?? state.settings.ttsVolume, 0, 1)
  });
  state.settings.userVoiceRules = rules;
  $('customVoiceUserInput').value = '';
  scheduleSave();
  renderUserVoiceRules();
  toast('Voz personalizada guardada', `@${user} usará ${voiceLabel(voice)}.`, 'success');
}

function voiceGenderLabel(value) {
  const gender = String(value || '').toLowerCase();
  if (gender === 'female') return 'mujer';
  if (gender === 'male') return 'hombre';
  return '';
}

function voiceLocaleLabel(locale) {
  const normalized = String(locale || '').replace('_', '-');
  try {
    const [language, region] = normalized.split('-');
    const languageName = new Intl.DisplayNames(['es'], { type: 'language' }).of(language) || language;
    const regionName = region ? new Intl.DisplayNames(['es'], { type: 'region' }).of(region) : '';
    return regionName ? `${languageName} (${regionName})` : languageName;
  } catch {
    return normalized;
  }
}

function onlineVoiceSearchText(voice) {
  return `${voice.localName} ${voice.name} ${voice.shortName} ${voice.locale} ${voiceLocaleLabel(voice.locale)} ${voice.gender} Microsoft`;
}

function tiktokVoiceSearchText(voice) {
  return `${voice.name} ${voice.id} ${voice.locale} ${voice.category} TikTok`;
}

function renderVoiceOptions() {
  const select = $('voiceSelect');
  if (!select || !state.settings) return;
  const filter = state.settings.voiceLanguageFilter || 'all';
  const search = normalizeText(state.voiceSearch || '');
  const selected = selectedVoiceValue();
  select.innerHTML = '';

  const tiktokMatches = state.tiktokVoices.filter((voice) => (languageMatches(voice.locale, filter) || `tiktok:${voice.id}` === selected) && (!search || normalizeText(tiktokVoiceSearchText(voice)).includes(search) || `tiktok:${voice.id}` === selected));
  const byCategory = new Map();
  for (const voice of tiktokMatches) {
    if (!byCategory.has(voice.category)) byCategory.set(voice.category, []);
    byCategory.get(voice.category).push(voice);
  }
  for (const [category, voices] of byCategory) {
    const group = document.createElement('optgroup');
    group.label = `TikTok · ${category} (${voices.length})`;
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = `tiktok:${voice.id}`;
      option.textContent = `${voice.name} — ${voice.locale}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  const onlineMatches = state.onlineVoices.filter((voice) => (languageMatches(voice.locale, filter) || `online:${voice.shortName}` === selected) && (!search || normalizeText(onlineVoiceSearchText(voice)).includes(search) || `online:${voice.shortName}` === selected));
  const onlineByLocale = new Map();
  for (const voice of onlineMatches) {
    if (!onlineByLocale.has(voice.locale)) onlineByLocale.set(voice.locale, []);
    onlineByLocale.get(voice.locale).push(voice);
  }
  for (const [locale, voices] of onlineByLocale) {
    const group = document.createElement('optgroup');
    group.label = `Microsoft online · ${voiceLocaleLabel(locale)} (${voices.length})`;
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = `online:${voice.shortName}`;
      const gender = voiceGenderLabel(voice.gender);
      option.textContent = `${voice.localName || voice.name || voice.shortName}${gender ? ` · ${gender}` : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  const localMatches=state.localVoices.filter((voice)=>(voice.installed!==false||`local:${voice.id}`===selected)&&(languageMatches(voice.language,filter)||`local:${voice.id}`===selected)&&(!search||normalizeText(`${voice.name} ${voice.language} ${voice.author}`).includes(search)||`local:${voice.id}`===selected));
  if(localMatches.length){const group=document.createElement('optgroup');group.label=`Lulu Local · sin Internet (${localMatches.length})`;for(const voice of localMatches){const option=document.createElement('option');option.value=`local:${voice.id}`;option.textContent=`${voice.name} — ${voice.language}`;group.appendChild(option);}select.appendChild(group);}

  const systemMatches = state.voices.filter((voice) => (languageMatches(voice.lang, filter) || `system:${voice.voiceURI}` === selected) && (!search || normalizeText(`${voice.name} ${voice.lang}`).includes(search) || `system:${voice.voiceURI}` === selected));
  if (systemMatches.length) {
    const group = document.createElement('optgroup');
    group.label = `Voces instaladas de Windows (${systemMatches.length})`;
    for (const voice of systemMatches) {
      const option = document.createElement('option');
      option.value = `system:${voice.voiceURI}`;
      option.textContent = `${voice.name} — ${voice.lang}${voice.default ? ' · predeterminada' : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  if (!select.options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay voces para este idioma';
    select.appendChild(option);
  }

  if ($('voiceVisibleCount')) $('voiceVisibleCount').textContent = `${tiktokMatches.length+onlineMatches.length+localMatches.length+systemMatches.length} visibles de ${state.tiktokVoices.length+state.onlineVoices.length+state.localVoices.length+state.voices.length} voces`;
  renderCustomVoiceOptions();
  renderUserVoiceRules();

  if ([...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  } else {
    const preferredTikTok = tiktokMatches.find((voice) => voice.id === 'es_mx_002') || tiktokMatches[0];
    const preferredOnline = onlineMatches.find((voice) => voice.locale.toLowerCase().startsWith('es-mx')) || onlineMatches[0];
    const preferredLocal=localMatches.find((voice)=>voice.language.toLowerCase().startsWith('es-mx'))||localMatches[0];
    const preferredSystem = systemMatches.find((voice) => /^es(-|_)/i.test(voice.lang)) || systemMatches[0];
    if(preferredLocal){select.value=`local:${preferredLocal.id}`;state.settings.voiceMode='local';state.settings.localVoiceId=preferredLocal.id;}
    else if (preferredOnline) { select.value=`online:${preferredOnline.shortName}`; state.settings.voiceMode='online'; state.settings.onlineVoice=preferredOnline.shortName; }
    else if (preferredTikTok) { select.value=`tiktok:${preferredTikTok.id}`; state.settings.voiceMode='tiktok'; state.settings.tiktokVoice=preferredTikTok.id; }
    else if (preferredSystem) { select.value=`system:${preferredSystem.voiceURI}`;state.settings.voiceMode='system';state.settings.voiceURI=preferredSystem.voiceURI; }
  }
}

function loadSystemVoices() {
  state.voices = window.speechSynthesis.getVoices().slice().sort((a, b) => {
    const aSpanish = /^es(-|_)/i.test(a.lang) ? 0 : 1;
    const bSpanish = /^es(-|_)/i.test(b.lang) ? 0 : 1;
    return aSpanish - bSpanish || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
  });
  renderVoiceOptions();
}

function renderLocalVoices(){
  const list=$('localVoiceList');if(!list)return;const selected=state.settings?.localVoiceId||'lulu-es-mx';
  $('localVoiceStatus').textContent=state.localVoices.length?`${state.localVoices.length} voz${state.localVoices.length===1?'':'es'} local${state.localVoices.length===1?'':'es'} disponible${state.localVoices.length===1?'':'s'}.`:'No se encontró una voz local completa. Importa un paquete .lfvoice.';
  list.innerHTML=state.localVoices.length?state.localVoices.map((voice)=>`<div class="local-voice-card ${voice.id===selected&&state.settings.voiceMode==='local'?'active':''}"><div class="local-voice-copy"><strong>${escapeHtml(voice.name)}</strong><small>${escapeHtml(voice.language)} · ${escapeHtml(voice.author||'Voz local')}${voice.bundled?' · incluida':' · importada'}</small>${voice.description?`<span>${escapeHtml(voice.description)}</span>`:''}</div><div class="local-voice-actions"><button class="secondary select-local-voice" data-id="${escapeHtml(voice.id)}">Usar</button><button class="ghost test-local-voice" data-id="${escapeHtml(voice.id)}">Probar</button>${voice.removable?`<button class="danger-outline remove-local-voice" data-id="${escapeHtml(voice.id)}">Eliminar</button>`:''}</div></div>`).join(''):'<div class="local-voice-card"><div class="local-voice-copy"><strong>Biblioteca vacía</strong><small>Importa una voz .lfvoice para comenzar.</small></div></div>';
  qsa('.select-local-voice').forEach((button)=>button.addEventListener('click',()=>{state.settings.voiceMode='local';state.settings.localVoiceId=button.dataset.id;renderVoiceOptions();renderLocalVoices();scheduleSave();}));
  qsa('.test-local-voice').forEach((button)=>button.addEventListener('click',()=>speakText($('voiceTestInput')?.value.trim()||'Hola, esta es una prueba de Lulu Local.',false,null,{mode:'local',localVoiceId:button.dataset.id},{lockKey:`test-local:${button.dataset.id}`,label:'Prueba Lulu Local'})));
  qsa('.remove-local-voice').forEach((button)=>button.addEventListener('click',async()=>{if(!confirm('¿Eliminar esta voz importada del equipo?'))return;try{await api.removeLocalVoice(button.dataset.id);await loadLocalVoices();toast('Voz eliminada','','success');}catch(error){toast('No se pudo eliminar',error.message||String(error),'error');}}));
}
async function loadLocalVoices(showToast=false){try{state.localVoices=await api.listLocalVoices();if(!Array.isArray(state.localVoices))state.localVoices=[];renderLocalVoices();renderVoiceOptions();if(showToast)toast('Biblioteca local actualizada',`${state.localVoices.length} voces disponibles.`,'success');}catch(error){state.localVoices=[];renderLocalVoices();renderVoiceOptions();if(showToast)toast('No se pudo abrir Lulu Local',error.message||String(error),'error');}}

async function loadOnlineVoices(showToast = false) {
  if (state.voiceLoading) return;
  state.voiceLoading = true;
  const status = $('voiceProviderStatus');
  status.className = 'voice-provider-status loading';
  status.innerHTML = '<span class="status-light connecting"></span><span>Cargando voces de Microsoft y TikTok…</span>';
  try {
    const [onlineResult, tiktokResult] = await Promise.allSettled([
      api.listOnlineVoices({ refresh: showToast }),
      api.listTikTokVoices()
    ]);
    const online = onlineResult.status === 'fulfilled' ? onlineResult.value : null;
    const tiktok = tiktokResult.status === 'fulfilled' ? tiktokResult.value : null;
    state.onlineVoices = Array.isArray(online?.voices) ? online.voices : [];
    state.onlineVoicesFallback = Boolean(online?.fallback);
    state.tiktokVoices = Array.isArray(tiktok?.voices) ? tiktok.voices : [];
    const tiktokSpanishCount = state.tiktokVoices.filter((voice) => /^es(?:-|_)/i.test(String(voice.locale || ''))).length;
    const total = state.onlineVoices.length + state.tiktokVoices.length;
    status.className = `voice-provider-status ${total ? 'ready' : 'error'}`;
    status.innerHTML = total
      ? `<span class="status-light connected"></span><span>${state.onlineVoices.length} voces Microsoft online y ${state.tiktokVoices.length} voces TikTok · ${tiktokSpanishCount} en español. TikTok solo usa la sesión local cuando eliges una de sus voces.</span>`
      : '<span class="status-light error"></span><span>No se pudieron cargar los catálogos online. Lulu Local y las voces de Windows siguen disponibles.</span>';
    renderVoiceOptions();
    if (showToast) toast('Voces actualizadas', `${state.onlineVoices.length} Microsoft y ${state.tiktokVoices.length} TikTok.`, total ? 'success' : 'error');
  } catch (error) {
    state.onlineVoices = [];
    state.tiktokVoices = [];
    status.className = 'voice-provider-status error';
    status.innerHTML = '<span class="status-light error"></span><span>No se pudieron cargar los catálogos online. Usa Lulu Local o una voz de Windows.</span>';
    renderVoiceOptions();
    if (showToast) toast('No se cargaron voces online', error.message || String(error), 'error');
  } finally {
    state.voiceLoading = false;
  }
}

async function refreshVoices(showToast = false) {
  await loadLocalVoices(false);
  loadSystemVoices();
  await loadOnlineVoices(showToast);
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    try {
      state.settings = await api.saveSettings(state.settings);
    } catch (error) {
      toast('No se pudo guardar', error.message || String(error), 'error');
    }
  }, 250);
}

function bindSetting(id, key, event = 'change', transform = (value) => value) {
  const element = $(id);
  element.addEventListener(event, () => {
    const raw = element.type === 'checkbox' ? element.checked : element.value;
    state.settings[key] = transform(raw);
    syncOutputs();
    scheduleSave();
  });
}

function syncOutputs() {
  $('rateOutput').textContent = `${Number(state.settings.rate).toFixed(2)}×`;
  $('pitchOutput').textContent = Number(state.settings.pitch).toFixed(2);
  $('ttsVolumeOutput').textContent = `${Math.round(state.settings.ttsVolume * 100)}%`;
  $('queueLimitOutput').textContent = String(state.settings.queueLimit);
  if ($('maxCommentDelayOutput')) $('maxCommentDelayOutput').textContent = `${clamp(state.settings.maxCommentDelaySeconds||8,3,30)} s`;
  $('maxCharactersOutput').textContent = String(state.settings.maxCharacters);
  $('cooldownOutput').textContent = `${state.settings.userCooldownSeconds} s`;
  $('songQueueLimitOutput').textContent = String(state.settings.songQueueLimit);
  if ($('maxSongDurationOutput')) $('maxSongDurationOutput').textContent = Number(state.settings.maxSongDurationMinutes || 0) > 0 ? `${state.settings.maxSongDurationMinutes} min` : 'Sin límite';
  if ($('glowIntensityOutput')) $('glowIntensityOutput').textContent = `${Math.round(state.settings.glowIntensity ?? 70)}%`;
  if ($('panelOpacityOutput')) $('panelOpacityOutput').textContent = `${Math.round(state.settings.panelOpacity ?? 78)}%`;
  if ($('cornerRadiusOutput')) $('cornerRadiusOutput').textContent = `${Math.round(state.settings.cornerRadius ?? 15)} px`;
  if ($('tiktokAutoChatCooldownOutput')) $('tiktokAutoChatCooldownOutput').textContent = `${Math.max(5, Math.min(120, Number(state.settings.tiktokAutoChatCooldownSeconds || 8)))} s`;
  $('songCommandExample').textContent = `${state.settings.songPrefix || '!cancion'} nombre`;
  if ($('activeMusicCommandHint')) $('activeMusicCommandHint').textContent = state.settings.songPrefix || '!cancion';
  const volume = clamp(activeMusicProvider() === 'spotify' ? (state.settings.spotifyVolume ?? 0.8) : (state.settings.youtubeVolume ?? 0.8), 0, 1);
  if ($('youtubeVolumeOutput')) $('youtubeVolumeOutput').textContent = `${Math.round(volume * 100)}%`;
  if ($('spotifyVolumeOutput')) $('spotifyVolumeOutput').textContent = `${Math.round(clamp(state.settings.spotifyVolume ?? 0.8,0,1)*100)}%`;
  if ($('dashboardQueueCount')) $('dashboardQueueCount').textContent = `(${state.settings.musicProvider === 'spotify' ? state.spotifyQueue.length : state.songQueue.length})`;
}

function populateSettings() {
  const settings = state.settings;
  $('usernameInput').value = settings.username || '';
  $('ttsEnabledInput').checked = Boolean(settings.ttsEnabled);
  $('includeUsernameInput').checked = Boolean(settings.includeUsername);
  $('voiceLanguageFilter').value = settings.voiceLanguageFilter || 'all';
  $('rateInput').value = settings.rate;
  $('pitchInput').value = settings.pitch;
  $('ttsVolumeInput').value = settings.ttsVolume;
  if ($('customVoiceRateInput')) $('customVoiceRateInput').value = settings.rate;
  if ($('customVoicePitchInput')) $('customVoicePitchInput').value = settings.pitch;
  if ($('customVoiceVolumeInput')) $('customVoiceVolumeInput').value = settings.ttsVolume;
  syncCustomVoiceBuilderOutputs();
  $('queueLimitInput').value = settings.queueLimit;
  if ($('maxCommentDelayInput')) $('maxCommentDelayInput').value = clamp(settings.maxCommentDelaySeconds||8,3,30);
  $('youtubeMuteDuringTtsInput').checked = Boolean(settings.youtubeMuteDuringTts);
  $('blockLinksInput').checked = Boolean(settings.blockLinks);
  $('readCommandsInput').checked = Boolean(settings.readCommands);
  if ($('ignoreDirectedMentionsInput')) $('ignoreDirectedMentionsInput').checked = settings.ignoreDirectedMentions !== false;
  $('smartTextEnabledInput').checked=settings.smartTextEnabled!==false;$('blockCjkTextInput').checked=settings.blockCjkText!==false;$('blockMixedScriptsInput').checked=settings.blockMixedScripts!==false;$('stripUsernameEmojiInput').checked=settings.stripUsernameEmoji!==false;
  $('pronunciationDictionaryInput').value=dictionaryToText(settings.pronunciationDictionary);
  $('maxCharactersInput').value = settings.maxCharacters;
  $('cooldownInput').value = settings.userCooldownSeconds;
  $('blockedWordsInput').value = (settings.blockedWords || []).join('\n');
  $('ignoredUsersInput').value = (settings.ignoredUsers || []).join('\n');
  $('songPrefixInput').value = settings.songPrefix || '!cancion';
  $('songQueueLimitInput').value = settings.songQueueLimit;
  $('youtubeSearchSuffixInput').value = settings.youtubeSearchSuffix || '';
  $('preventDuplicateSongsInput').checked = settings.preventDuplicateSongs !== false;
  $('youtubeAdBlockEnabledInput').checked = settings.youtubeAdBlockEnabled !== false;
  if ($('tiktokAutoChatEnabledInput')) $('tiktokAutoChatEnabledInput').checked = settings.tiktokAutoChatEnabled === true;
  if ($('tiktokAutoChatCooldownInput')) $('tiktokAutoChatCooldownInput').value = Math.max(5, Math.min(120, Number(settings.tiktokAutoChatCooldownSeconds || 8)));
  for (const [suffix, enabledKey, textKey] of [
    ['SongQueued','tiktokAutoChatSongQueuedEnabled','tiktokAutoChatSongQueuedText'],
    ['SongStarted','tiktokAutoChatSongStartedEnabled','tiktokAutoChatSongStartedText'],
    ['SongEnded','tiktokAutoChatSongEndedEnabled','tiktokAutoChatSongEndedText'],
    ['SongSkipped','tiktokAutoChatSongSkippedEnabled','tiktokAutoChatSongSkippedText'],
    ['LiveConnected','tiktokAutoChatLiveConnectedEnabled','tiktokAutoChatLiveConnectedText']
  ]) {
    if ($(`tiktokAutoChat${suffix}EnabledInput`)) $(`tiktokAutoChat${suffix}EnabledInput`).checked = settings[enabledKey] === true;
    if ($(`tiktokAutoChat${suffix}TextInput`)) $(`tiktokAutoChat${suffix}TextInput`).value = settings[textKey] || '';
  }
  if ($('tiktokAutoChatTestInput')) $('tiktokAutoChatTestInput').value = settings.tiktokAutoChatTestText || '🌸 Mensaje de prueba enviado desde Lulu Finity.';
  $('maxSongDurationInput').value = Math.max(0, Number(settings.maxSongDurationMinutes) || 0);
  $('blockedSongsInput').value = (settings.blockedSongs || []).join('\n');
  $('blockedChannelsInput').value = (settings.blockedChannels || []).join('\n');
  $('themeModeInput').value = ['pink','blush','purple','red','blue','dark','miku-classic','miku-soft','miku-dark','studio-lavender','studio-pink','studio-mint'].includes(settings.themeMode) ? settings.themeMode : 'pink';
  $('glowIntensityInput').value = clamp(settings.glowIntensity ?? 70, 0, 100);
  $('panelOpacityInput').value = clamp(settings.panelOpacity ?? 78, 20, 100);
  $('cornerRadiusInput').value = clamp(settings.cornerRadius ?? 15, 6, 24);
  $('youtubeVolumeInput').value = settings.youtubeVolume ?? 0.8;
  $('continueRecommendedInput').checked = settings.continueRecommended !== false;
  $('songsContinueRecommendedInput').checked = settings.continueRecommended !== false;
  $('minimumMemberLevelInput').value = Math.max(1, Number(settings.minimumMemberLevel) || 1);
  $('minimumTtsMemberLevelInput').value = Math.max(1, Number(settings.minimumTtsMemberLevel) || 1);
  qsa('input[name="musicPermissionMode"]').forEach((input) => { input.checked = input.value === (settings.musicPermissionMode || 'all'); });
  qsa('input[name="ttsPermissionMode"]').forEach((input) => { input.checked = input.value === (settings.ttsPermissionMode || 'all'); });
  qsa('input[name="musicProvider"]').forEach((input) => { input.checked = input.value === (settings.musicProvider === 'spotify' ? 'spotify' : 'youtube'); });
  qsa('input[name="performanceProfile"]').forEach((input)=>{input.checked=input.value===(settings.performanceProfile||'balanced');});
  renderBalancedKeepActiveControls();
  $('checkUpdatesOnStartupInput').checked = settings.checkUpdatesOnStartup !== false;
  for (const key of ['eventTtsEnabled','eventGiftEnabled','eventFollowEnabled','eventLikeEnabled','eventShareEnabled','eventMemberEnabled','eventSubscribeEnabled']) { const el=$(key+'Input'); if(el) el.checked=settings[key]!==false; }
  if ($('spotifyVolumeInput')) $('spotifyVolumeInput').value=settings.spotifyVolume??0.8;
  if ($('spotifyRecommendedInput')) $('spotifyRecommendedInput').checked=settings.spotifyContinueRecommended!==false;
  state.settings.liveGameCommands = normalizedLiveGameCommands().map(({id,trigger,enabled})=>({id,trigger,enabled}));
  state.settings.automationRules = Array.isArray(state.settings.automationRules) ? state.settings.automationRules : [];
  state.settings.liveGoals = Array.isArray(state.settings.liveGoals) ? state.settings.liveGoals : [];
  state.settings.streamWidgetThemes = normalizedStreamWidgetThemes(state.settings.streamWidgetThemes);
  state.settings.streamWidgetBackgrounds = normalizedStreamWidgetBackgrounds(state.settings.streamWidgetBackgrounds);
  state.settings.streamWidgetStyles = normalizedStreamWidgetStyles(state.settings.streamWidgetStyles);
  renderStreamWidgetThemeStudios();
  renderStreamWidgetBackgroundStudios();
  renderStreamWidgetStyleEditors();
  renderLiveGames();
  renderAutomationStudio();
  syncOutputs();
  applyAppearance();
}

function setStatus(payload) {
  const status = payload?.status || 'disconnected';
  const classes = ['disconnected', 'connecting', 'connected', 'error', 'ended'];
  const banner = $('statusBanner');
  const light = $('sidebarStatusLight');
  banner.classList.remove(...classes);
  light.classList.remove(...classes);
  banner.classList.add(status);
  light.classList.add(status);

  const map = {
    disconnected: ['Lista para conectar', 'Escribe el usuario de TikTok.'],
    connecting: ['Entrando al LIVE…', payload?.message || 'Buscando la sala.'],
    connected: ['LIVE conectado', payload?.message || 'Recibiendo comentarios.'],
    error: ['Conexión fallida', payload?.message || 'Revisa el usuario y el estado del LIVE.'],
    ended: ['LIVE finalizado', payload?.message || 'La transmisión terminó.']
  };
  const [title, message] = map[status] || map.disconnected;
  $('statusTitle').textContent = title;
  $('statusMessage').textContent = message;
  $('roomIdLabel').textContent = payload?.roomId ? `Sala ${payload.roomId}` : '';

  const wasConnected = state.connected;
  state.connected = status === 'connected';
  if (!wasConnected && state.connected && !payload?.reconnected) void sendTikTokAutoChatEvent('liveConnected', { usuario:payload?.username || state.settings?.username || '' });
  $('connectBtn').classList.toggle('hidden', state.connected || status === 'connecting');
  $('disconnectBtn').classList.toggle('hidden', !state.connected && status !== 'connecting');
  $('usernameInput').disabled = state.connected || status === 'connecting';
  $('connectBtn').disabled = status === 'connecting';

  $('sidebarStatusText').textContent = status === 'connected'
    ? 'Conectado'
    : status === 'connecting'
      ? 'Conectando…'
      : status === 'error'
        ? 'Error'
        : status === 'ended'
          ? 'LIVE terminado'
          : 'Desconectado';
  $('sidebarUsername').textContent = payload?.username
    ? `@${payload.username}`
    : (state.settings?.username ? `@${normalizeUser(state.settings.username)}` : 'Sin LIVE');
  const shownUser = payload?.username || normalizeUser(state.settings?.username || '');
  if ($('accountUsername')) $('accountUsername').textContent = shownUser ? `@${shownUser}` : 'Sin cuenta';
  if ($('accountStatus')) $('accountStatus').textContent = $('sidebarStatusText').textContent;
  if ($('accountLight')) $('accountLight').className = status;
  if ($('sidebarDisconnectBtn')) $('sidebarDisconnectBtn').classList.toggle('hidden', !state.connected && status !== 'connecting');
  renderStudioDashboard();
}

function renderStats() {
  $('commentCount').textContent = state.commentCount.toLocaleString('es-MX');
  $('viewerCount').textContent = state.viewerCount.toLocaleString('es-MX');
  $('voiceQueueCount').textContent = String(state.speechQueue.length + (state.speaking ? 1 : 0));
  if ($('ttsLatencyCurrent')) $('ttsLatencyCurrent').textContent = state.speechLatencyCurrentMs ? `${(state.speechLatencyCurrentMs/1000).toFixed(1)} s` : '—';
  if ($('ttsLatencyAverage')) { const samples=state.speechLatencySamples; const average=samples.length?samples.reduce((sum,value)=>sum+value,0)/samples.length:0; $('ttsLatencyAverage').textContent=average?`${(average/1000).toFixed(1)} s`:'—'; }
  $('currentSongStat').textContent = activeMusicProvider() === 'spotify' ? (state.spotifyPlayer.title || state.currentSpotify?.title || state.currentSpotify?.query || 'Ninguna') : (state.player.title || state.currentSong?.selectedTitle || state.currentSong?.query || 'Ninguna');
  $('songQueueStat').textContent = `${activeMusicProvider() === 'spotify' ? state.spotifyQueue.length : state.songQueue.length} en cola`;
  renderStudioDashboard();
  scheduleAudioActivityIndicators();
}

function renderComments() {
  const list = $('commentsList');
  if (!state.comments.length) {
    list.classList.add('empty');
    list.innerHTML = '<div class="empty-state"><div>💬</div><strong>Aún no hay comentarios</strong><span>Los mensajes aparecerán al conectarte al LIVE.</span></div>';
    return;
  }

  list.classList.remove('empty');
  list.innerHTML = state.comments.map((item) => {
    const initials = escapeHtml((item.nickname || item.uniqueId || '?').slice(0, 2).toUpperCase());
    const avatar = item.profilePictureUrl
      ? `<img class="avatar" src="${escapeHtml(item.profilePictureUrl)}" alt="" />`
      : `<div class="avatar">${initials}</div>`;
    const reason = escapeHtml(item.reason || '');
    const flag = item.result === 'game'
      ? '<span class="flag song">JUEGO</span>'
      : item.result === 'command'
      ? '<span class="flag song">COMANDO</span>'
      : item.result === 'song'
      ? '<span class="flag song">MÚSICA</span>'
      : item.result === 'read'
        ? '<span class="flag read">LEÍDO</span>'
        : item.result === 'queued'
          ? '<span class="flag read">EN COLA</span>'
          : item.result === 'skipped'
            ? `<span class="flag" title="${reason}">${reason ? reason.toUpperCase() : 'NO LEÍDO'}</span>`
            : item.result === 'blocked'
              ? `<span class="flag blocked" title="${reason}">${reason ? `FILTRO: ${reason.toUpperCase()}` : 'FILTRADO'}</span>`
              : '<span class="flag">RECIBIDO</span>';
    const role = item.memberLevel > 0 || item.isSubscriber ? `<span class="user-role member">Miembro${item.memberLevel > 0 ? ` ${item.memberLevel}` : ''}</span>` : item.isFollower ? '<span class="user-role">Seguidor</span>' : '';
    return `<div class="comment-item">${avatar}<div class="comment-body"><strong>${escapeHtml(item.nickname || item.uniqueId)} ${role}</strong><p>${escapeHtml(item.comment)}</p></div><div class="comment-flags">${flag}</div></div>`;
  }).join('');
}

function addComment(message, result = 'received') {
  state.commentCount += 1;
  state.comments.unshift({ ...message, result });
  if (state.comments.length > 100) state.comments.length = 100;
  renderStats();
  renderComments();
}

function updateCommentResult(id, result, reason = '') {
  const item = state.comments.find((comment) => comment.id === id);
  if (item) {
    item.result = result;
    item.reason = reason;
    renderComments();
  }
}

function isStableUserId(value) {
  const id = normalizeUser(value);
  return Boolean(id) && !['usuario', 'user', 'prueba', 'unknown', 'desconocido'].includes(id) && !id.startsWith('anon-');
}

function normalizedAllowedUsers(scope = 'music') {
  const key = scope === 'tts' ? 'allowedTtsUsers' : 'allowedMusicUsers';
  return (state.settings[key] || []).map(normalizeUser).filter(Boolean);
}

function hasSelectedAccess(message, scope = 'music') {
  return normalizedAllowedUsers(scope).includes(normalizeUser(message.uniqueId));
}

function isMember(message, minimumLevel = 1) {
  const level = Number(message.memberLevel || 0);
  return Boolean(message.isSubscriber || level >= Math.max(1, Number(minimumLevel) || 1));
}

function hasAudienceAccess(message, mode = 'all', scope = 'music') {
  if (mode === 'all' || !mode) return true;
  const minimumLevel = scope === 'tts' ? state.settings.minimumTtsMemberLevel : state.settings.minimumMemberLevel;
  if (mode === 'selected') return hasSelectedAccess(message, scope);
  if (mode === 'members') return isMember(message, minimumLevel);
  if (mode === 'followers') return Boolean(message.isFollower || isMember(message, 1));
  if (mode === 'music') return hasAudienceAccess(message, state.settings.musicPermissionMode || 'all', 'music');
  if (mode === 'tts') return hasAudienceAccess(message, state.settings.ttsPermissionMode || 'all', 'tts');
  return false;
}

function permissionDeniedLabel(mode, scope = 'music') {
  const minimumLevel = scope === 'tts' ? state.settings.minimumTtsMemberLevel : state.settings.minimumMemberLevel;
  const labels = {
    selected: scope === 'tts' ? 'solo usuarios permitidos para TTS' : 'solo usuarios permitidos',
    members: `miembros nivel ${Math.max(1, Number(minimumLevel) || 1)}+`,
    followers: 'solo seguidores',
    music: 'sin permiso para música',
    tts: 'sin permiso para lectura TTS'
  };
  return labels[mode] || 'sin permiso';
}

function normalizedCommands() {
  return (Array.isArray(state.settings.customCommands) ? state.settings.customCommands : [])
    .filter((command) => command && command.trigger)
    .filter((command) => String(command.id || '').toLowerCase() !== 'spotify' && String(command.trigger || '').trim().toLowerCase() !== '!spotify')
    .map((command) => {
      const resolved = resolveDefaultSound(command);
      return {
        id: String(command.id || `${Date.now()}-${Math.random()}`),
        trigger: String(command.trigger || '').trim().startsWith('!') ? String(command.trigger).trim() : `!${String(command.trigger || '').trim()}`,
        action: command.action === 'spotify' ? 'song' : (['response', 'tts', 'song', 'skip', 'sound', 'image', 'balance', 'revoke'].includes(command.action) ? command.action : 'response'),
        response: String(command.response || ''),
        permission: ['all', 'followers', 'members', 'selected', 'music'].includes(command.permission) ? command.permission : 'all',
        enabled: command.enabled === true,
        soundId: String(resolved.soundId || ''),
        mediaUrl: String(resolved.mediaUrl || ''),
        mediaPath: String(resolved.mediaPath || ''),
        mediaName: String(resolved.mediaName || ''),
        mediaVolume: clamp(command.mediaVolume ?? 0.9, 0, 1),
        mediaDuration: clamp(command.mediaDuration ?? 6, 1, 60),
        overlayScreen: clamp(command.overlayScreen ?? 1, 1, 4),
        cost: Math.max(0, Math.round(Number(command.cost || 0)))
      };
    });
}

function findCommand(comment) {
  const text = String(comment || '').trim();
  const lower = text.toLowerCase();
  const commands = normalizedCommands().filter((command) => command.enabled).sort((a, b) => b.trigger.length - a.trigger.length);
  return commands.find((command) => lower === command.trigger.toLowerCase() || lower.startsWith(`${command.trigger.toLowerCase()} `)) || null;
}

function commandRemainder(comment, command) {
  return String(comment || '').trim().slice(command.trigger.length).trim();
}
function dictionaryToText(dictionary=[]){return(Array.isArray(dictionary)?dictionary:[]).map((item)=>`${String(item?.from||'').trim()} = ${String(item?.to||'').trim()}`).filter((line)=>!line.startsWith(' = ')).join('\n');}
function textToDictionary(value){return String(value||'').split(/\r?\n/).slice(0,250).map((line)=>{const separator=line.indexOf('=');return separator<1?null:{from:line.slice(0,separator).trim().slice(0,80),to:line.slice(separator+1).trim().slice(0,120)};}).filter((item)=>item?.from);}
function smartTextOptions(){return{blockCjk:state.settings.blockCjkText!==false,blockMixedScripts:state.settings.blockMixedScripts!==false,blockLinks:state.settings.blockLinks!==false,dictionary:state.settings.pronunciationDictionary||[],maxCharacters:state.settings.maxCharacters||180,latinOnly:true};}

function filterComment(message) {
  const originalText=String(message.comment||'').trim();let text=originalText;
  const uniqueId = normalizeUser(message.uniqueId);
  const stableUserId = isStableUserId(uniqueId);
  const maxCharacters = Math.max(1, Number(state.settings.maxCharacters) || 180);

  if (!originalText) return { allowed:false, reason:'vacío' };
  if (state.settings.ignoreDirectedMentions !== false && window.LuluChatPolicy?.isDirectedReply(originalText)) {
    return { allowed:false, reason:'conversación entre usuarios' };
  }

  const ignoredUsers = (state.settings.ignoredUsers || [])
    .map(normalizeUser)
    .filter(Boolean);
  if (stableUserId && ignoredUsers.includes(uniqueId)) {
    return { allowed: false, reason: 'usuario ignorado' };
  }

  if (originalText.length>maxCharacters*3) return {allowed:false,reason:'demasiado largo'};
  if (state.settings.blockLinks && /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|gg|tv|io|me|co)\b)/i.test(originalText)) {
    return { allowed: false, reason: 'enlace' };
  }
  if(state.settings.smartTextEnabled!==false&&window.LuluText){const prepared=window.LuluText.prepare(originalText,{...smartTextOptions(),blockLinks:false});if(!prepared.allowed)return{allowed:false,reason:prepared.reason||'texto no legible'};text=prepared.text;}
  const normalized=normalizeText(text);

  const blocked = (state.settings.blockedWords || []).some((word) => {
    const needle = normalizeText(word).trim();
    return needle && normalized.includes(needle);
  });
  if (blocked) return { allowed: false, reason: 'palabra bloqueada' };

  const prefix = String(state.settings.songPrefix || '!cancion').toLowerCase();
  const knownCommand = findCommand(text);
  if (!state.settings.readCommands && text.startsWith('!') && !knownCommand && !text.toLowerCase().startsWith(prefix)) {
    return { allowed: false, reason: 'comando desconocido' };
  }

  if (stableUserId) {
    const now = Date.now();
    const cooldownMs = Math.max(0, Number(state.settings.userCooldownSeconds) || 0) * 1000;
    const lastRead = state.lastReadByUser.get(uniqueId) || 0;
    if (cooldownMs > 0 && now - lastRead < cooldownMs) {
      return { allowed: false, reason: 'espera del usuario' };
    }

    const lastMessage = state.lastMessageByUser.get(uniqueId);
    if (lastMessage && lastMessage.text === normalized && now - lastMessage.at < 15000) {
      return { allowed: false, reason: 'mensaje repetido' };
    }
  }

  return { allowed: true, text, normalized, uniqueId, stableUserId };
}

function rememberAcceptedComment(check) {
  if (!check?.stableUserId) return;
  const now = Date.now();
  state.lastReadByUser.set(check.uniqueId, now);
  state.lastMessageByUser.set(check.uniqueId, { text: check.normalized, at: now });
}

function makeSpeechText(message) {
  const comment = String(message.comment || '').trim();
  if (!state.settings.includeUsername) return comment;
  const source=String(message.nickname||message.uniqueId||'Usuario').replaceAll('_',' ').replace(/([a-zA-Z])([0-9])/g,'$1 $2');
  const name=window.LuluText?.prepareUsername(source,smartTextOptions())?.text||'Usuario';
  return `${name} dice: ${comment}`;
}

function enqueueSpeech(message, options = {}) {
  const lockKey = String(options.lockKey || '');
  const priority = Boolean(lockKey || options.priority === true);
  const fail = (reason) => { if (lockKey && options.lockReserved === true) releaseAudioLock(lockKey); return { added: false, reason }; };
  if (!state.settings.ttsEnabled) return fail('voz apagada');
  if (!hasAudienceAccess(message, state.settings.ttsPermissionMode || 'all', 'tts')) return fail(permissionDeniedLabel(state.settings.ttsPermissionMode, 'tts'));
  if (lockKey && options.lockReserved !== true && !reserveAudioLock(lockKey)) return { added: false, reason: 'comando en cooldown hasta que termine el audio' };

  const item = { id:message.id, text:makeSpeechText(message), voice:voiceForMessage(message), audioLockKey:lockKey, priority, queuedAt:Date.now(), preparedPromise:null, speedMultiplier:1 };
  const queueLimit = Math.max(1, Number(state.settings.queueLimit) || 30);
  if (state.speechQueue.length >= queueLimit) {
    const replaceIndex = state.speechQueue.findIndex((queued) => !queued.priority);
    if (replaceIndex < 0) {
      releaseAudioLock(lockKey);
      return { added:false, reason:'cola ocupada por comandos prioritarios' };
    }
    const [replaced] = state.speechQueue.splice(replaceIndex, 1);
    releaseAudioLock(replaced.audioLockKey);
    updateCommentResult(replaced.id, 'skipped', 'reemplazado por un comentario más reciente');
  }
  state.speechQueue.push(item);
  renderStats();
  if (state.speechPlaybackStarted) prepareNextSpeech();
  speakNext();
  return { added:true };
}
function stopCurrentAudio() {
  state.speechToken += 1;
  try { window.speechSynthesis.cancel(); } catch {}
  if (state.onlineAudio) {
    try { state.onlineAudio.pause(); state.onlineAudio.src = ''; } catch {}
    state.onlineAudio = null;
  }
  if (state.activeAudioJob?.kind === 'speech' && typeof state.activeAudioCancel === 'function') {
    state.activeAudioCancel();
  }
  cancelQueuedAudioJobs((job) => job.kind === 'speech');
}

function speechTuning(voiceConfig = null, speedMultiplier = 1) {
  return {
    rate: clamp((voiceConfig?.rate ?? state.settings.rate) * clamp(speedMultiplier, 1, 1.25), 0.5, 2),
    pitch: clamp(voiceConfig?.pitch ?? state.settings.pitch, 0.5, 2),
    volume: clamp(voiceConfig?.volume ?? state.settings.ttsVolume, 0, 1)
  };
}

function speechItemExpired(item) {
  if (!item || item.priority || !item.queuedAt) return false;
  const maxAge = clamp(state.settings.maxCommentDelaySeconds || 8, 3, 30) * 1000;
  return Date.now() - item.queuedAt > maxAge;
}

function adaptiveSpeechMultiplier() {
  return 1 + Math.min(0.25, Math.max(0, state.speechQueue.length - 1) * 0.035);
}

function markSpeechStarted(item) {
  if (state.speechPlaybackStarted) return;
  state.speechPlaybackStarted = true;
  if (item?.queuedAt) {
    const latency = Math.max(0, Date.now() - item.queuedAt);
    state.speechLatencyCurrentMs = latency;
    state.speechLatencySamples.push(latency);
    if (state.speechLatencySamples.length > 20) state.speechLatencySamples.shift();
  }
  renderStats();
  prepareNextSpeech();
}

async function synthesizeSpeechData(text, voiceConfig, speedMultiplier = 1) {
  const voiceMode = voiceConfig?.mode || state.settings.voiceMode;
  if (voiceMode === 'system') return null;
  const tuning = speechTuning(voiceConfig, speedMultiplier);
  if (voiceMode === 'local') {
    const result = await api.synthesizeLocalVoice({ text, voiceId:voiceConfig?.localVoiceId||state.settings.localVoiceId||'lulu-es-mx', speed:tuning.rate, idleMinutes:state.settings.localVoiceIdleMinutes||2 });
    return { result, voiceMode, tuning };
  }
  const result = voiceMode === 'tiktok'
    ? await api.synthesizeTikTokVoice({ text, voice:voiceConfig?.tiktokVoice||state.settings.tiktokVoice||'es_mx_002' })
    : await api.synthesizeOnlineVoice({ text, voice:voiceConfig?.onlineVoice||state.settings.onlineVoice, rate:tuning.rate, pitch:tuning.pitch });
  return { result, voiceMode, tuning };
}

function prepareNextSpeech() {
  if (!state.speechPlaybackStarted || state.speechPreparation || !state.speechQueue.length) return;
  const item = state.speechQueue[0];
  const voiceMode = item.voice?.mode || state.settings.voiceMode;
  if (voiceMode === 'system' || item.preparedPromise || speechItemExpired(item)) return;
  item.speedMultiplier = adaptiveSpeechMultiplier();
  const generation = state.speechPrepareGeneration;
  const promise = synthesizeSpeechData(item.text, item.voice, item.speedMultiplier)
    .then((prepared) => ({ ok:true, prepared }))
    .catch((error) => ({ ok:false, error }))
    .finally(() => { if (state.speechPreparation?.itemId === item.id && state.speechPrepareGeneration === generation) state.speechPreparation = null; });
  item.preparedPromise = promise;
  state.speechPreparation = { itemId:item.id, promise };
}

function startSystemSpeechNow(text, voiceConfig, token, finish, item = null, speedMultiplier = 1) {
  if (!('speechSynthesis' in window) || token !== state.speechToken) { finish(false); return; }
  const tuning = speechTuning(voiceConfig, speedMultiplier);
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = currentSystemVoice(voiceConfig?.mode === 'system' ? voiceConfig.voiceURI : '');
  if (voice) utterance.voice = voice;
  utterance.rate = tuning.rate; utterance.pitch = tuning.pitch; utterance.volume = tuning.volume;
  utterance.onstart = () => { if (token === state.speechToken) markSpeechStarted(item); };
  utterance.onend = () => finish(true);
  utterance.onerror = () => finish(false);
  try { window.speechSynthesis.speak(utterance); } catch { finish(false); }
}

function runSpeechNow(text, isQueue = false, queueId = null, voiceConfig = null, speechItem = null) {
  if (!text) return Promise.resolve(false);
  const token = ++state.speechToken;
  const speedMultiplier = speechItem?.speedMultiplier || adaptiveSpeechMultiplier();
  if (isQueue) state.speaking = true;
  if (state.settings.youtubeMuteDuringTts) { api.muteYouTube(true).catch(() => {}); api.muteSpotify(true).catch(() => {}); }
  renderStats();

  return new Promise((resolve) => {
    let finished = false;
    const finish = (success, reason = '') => {
      if (finished) return;
      finished = true;
      state.onlineAudio = null;
      state.speechPlaybackStarted = false;
      if (isQueue) state.speaking = false;
      if (state.settings.youtubeMuteDuringTts) { api.muteYouTube(false).catch(() => {}); api.muteSpotify(false).catch(() => {}); }
      if (queueId) updateCommentResult(queueId, success ? 'read' : 'skipped', success ? '' : (reason || 'audio detenido'));
      renderStats();
      if (isQueue) queueMicrotask(speakNext);
      resolve(Boolean(success));
    };

    state.activeAudioCancel = () => {
      try { window.speechSynthesis.cancel(); } catch {}
      if (state.onlineAudio) { try { state.onlineAudio.pause(); state.onlineAudio.src = ''; } catch {} }
      finish(false);
    };

    const voiceMode = voiceConfig?.mode || state.settings.voiceMode;
    if (speechItemExpired(speechItem)) { finish(false, 'comentario vencido'); return; }
    if (voiceMode === 'system') { startSystemSpeechNow(text, voiceConfig, token, finish, speechItem, speedMultiplier); return; }

    (async () => {
      try {
        const preparedState = speechItem?.preparedPromise ? await speechItem.preparedPromise : { ok:true, prepared:await synthesizeSpeechData(text, voiceConfig, speedMultiplier) };
        if (!preparedState?.ok) throw preparedState.error || new Error('No se pudo preparar la voz.');
        if (finished || token !== state.speechToken) { finish(false); return; }
        if (speechItemExpired(speechItem)) { finish(false, 'comentario vencido'); return; }
        const { result, voiceMode:preparedMode, tuning } = preparedState.prepared;
        const audio = new Audio(`data:${result.mimeType || (preparedMode === 'local' ? 'audio/wav' : 'audio/mpeg')};base64,${result.data}`);
        audio.volume = tuning.volume;
        if (preparedMode === 'tiktok') { audio.playbackRate = tuning.rate; audio.preservesPitch = false; }
        state.onlineAudio = audio;
        audio.onplaying = () => markSpeechStarted(speechItem);
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        audio.onabort = () => finish(false);
        await audio.play();
        markSpeechStarted(speechItem);
      } catch (error) {
        if (finished || token !== state.speechToken) { finish(false); return; }
        if (speechItemExpired(speechItem)) { finish(false, 'comentario vencido'); return; }
        const title = voiceMode === 'local' ? 'Lulu Local no disponible' : voiceMode === 'tiktok' ? 'Voz de TikTok no disponible' : 'Voz Microsoft no disponible';
        toast(title, 'Se usó una voz de Windows para este audio.', 'error');
        startSystemSpeechNow(text, { ...voiceConfig, mode:'system' }, token, finish, speechItem, speedMultiplier);
      }
    })();
  });
}
function speakText(text, isQueue = false, queueId = null, voiceConfig = null, options = {}) {
  if (!text) return { accepted:false, reason:'texto vacío', promise:Promise.resolve(false) };
  return enqueueExclusiveAudio(() => runSpeechNow(text, isQueue, queueId, voiceConfig, options.speechItem || null), { ...options, kind:'speech', label:options.label || 'Voz TTS' });
}

function speakNext() {
  if (state.speaking || !state.speechQueue.length) return;
  while (state.speechQueue.length && speechItemExpired(state.speechQueue[0])) {
    const expired = state.speechQueue.shift();
    releaseAudioLock(expired.audioLockKey);
    updateCommentResult(expired.id, 'skipped', 'comentario vencido');
  }
  if (!state.speechQueue.length) { renderStats(); return; }
  const item = state.speechQueue.shift();
  item.speedMultiplier = item.speedMultiplier || adaptiveSpeechMultiplier();
  state.speaking = true;
  renderStats();
  const queued = speakText(item.text, true, item.id, item.voice, { speechItem:item, lockKey:item.audioLockKey||'', lockReserved:Boolean(item.audioLockKey), label:item.priority?'Comando TTS':'Comentario TTS' });
  if (!queued.accepted) {
    releaseAudioLock(item.audioLockKey);
    state.speaking = false;
    updateCommentResult(item.id, 'skipped', queued.reason || 'cola de audio llena');
    renderStats();
    queueMicrotask(speakNext);
  }
}

function clearSpeechQueue() {
  for (const item of state.speechQueue) releaseAudioLock(item.audioLockKey);
  state.speechQueue = [];
  state.speaking = false;
  state.speechPlaybackStarted = false;
  state.speechPrepareGeneration += 1;
  state.speechPreparation = null;
  stopCurrentAudio();
  if (state.settings.youtubeMuteDuringTts) { api.muteYouTube(false).catch(() => {}); api.muteSpotify(false).catch(() => {}); }
  renderStats();
}
function parseSongCommand(comment) {
  const prefix = String(state.settings.songPrefix || '!cancion').trim();
  const enabledSongCommand = normalizedCommands().some((command) => command.enabled && command.action === 'song' && command.trigger.toLowerCase() === prefix.toLowerCase());
  if (!prefix || !enabledSongCommand) return null;
  const text = String(comment || '').trim();
  if (!text.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  return { query: text.slice(prefix.length).trim() };
}

function createSongRequest(query, requestedBy = '', metadata = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    query: String(query || '').trim().slice(0, 180),
    requestedBy: String(requestedBy || '').trim(),
    requestedById: normalizeUser(metadata.requestedById || requestedBy),
    chargedAmount: Math.max(0, Math.round(Number(metadata.chargedAmount || 0))),
    chargeTransactionId: String(metadata.chargeTransactionId || ''),
    createdAt: Date.now()
  };
}

function activeMusicProvider() {
  return state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';
}

async function enqueueRequestedMusic(query, requestedBy = '', metadata = {}) {
  if (activeMusicProvider() === 'spotify') return enqueueSpotify(query, requestedBy, metadata);
  return enqueueSong(createSongRequest(query, requestedBy, metadata));
}

function hasActiveMusic() {
  return activeMusicProvider() === 'spotify'
    ? Boolean(state.currentSpotify || state.spotifyPlayer.title)
    : Boolean(state.currentSong);
}

async function skipActiveMusic() {
  if (activeMusicProvider() === 'spotify') {
    if (state.spotifyQueue.length) finishSpotify('skipped');
    else await api.controlSpotify('next');
    return;
  }
  await finishCurrentSong('skipped');
}

function applyMusicProvider(provider, announce = true) {
  state.settings.musicProvider = provider === 'spotify' ? 'spotify' : 'youtube';
  if (state.settings.musicProvider === 'spotify') api.controlYouTube('pause').catch(() => {});
  else api.controlSpotify('pause').catch(() => {});
  syncOutputs();
  renderPermissions();
  renderDashboardMusic();
  if (announce) toast('Proveedor de música', state.settings.musicProvider === 'spotify' ? 'Spotify está activo.' : 'YouTube está activo.', 'success');
}

async function enqueueSong(request) {
  state.lastSongRejectReason = '';
  if (!request?.query) { state.lastSongRejectReason = 'falta la canción'; return false; }
  const preliminaryIssue = songPolicyIssue(request);
  if (preliminaryIssue) {
    state.lastSongRejectReason = preliminaryIssue;
    toast('Solicitud rechazada', `${request.query}: ${preliminaryIssue}.`, 'error');
    return false;
  }
  if (state.songQueue.length >= state.settings.songQueueLimit) {
    state.lastSongRejectReason = 'cola llena';
    toast('Cola de YouTube llena', 'No se agregó la solicitud.', 'error');
    return false;
  }
  state.resolvingSongs += 1;
  request.resolving = true;
  state.songQueue.push(request);
  renderPlayer(); renderSongs(); renderDashboardMusic();
  try {
    const resolved = await api.resolveYouTube({ query: request.query, suffix: state.settings.youtubeSearchSuffix });
    request.resolving = false;
    request.videoUrl = resolved?.url || '';
    request.selectedTitle = resolved?.title || request.query;
    request.channel = resolved?.channel || '';
    const policyIssue = songPolicyIssue(request, { title: request.selectedTitle, channel: request.channel });
    if (policyIssue) throw new Error(policyIssue);
    if (state.settings.preventDuplicateSongs !== false) {
      const identity = songIdentity(request.videoUrl || request.selectedTitle || request.query);
      const duplicate = identity && [state.currentSong, ...state.songQueue]
        .filter((song) => song && song.id !== request.id && !song.resolving)
        .some((song) => songIdentity(song.videoUrl || song.resolving ? `Buscando: ${song.query}` : (song.selectedTitle || song.query)) === identity);
      if (duplicate) throw new Error('canción duplicada');
    }
    renderPlayer(); renderSongs(); renderDashboardMusic();
    const queuePosition = Math.max(1, state.songQueue.findIndex((song) => song.id === request.id) + 1);
    void sendTikTokAutoChatEvent('songQueued', { song:request, position:queuePosition, queueLength:state.songQueue.length, provider:'YouTube' });
    if (!state.currentSong && !state.youtubeTransitioning && state.songQueue[0]?.id === request.id) playNextSong();
    return true;
  } catch (error) {
    state.songQueue = state.songQueue.filter((song) => song.id !== request.id);
    const reason = error?.message || 'no se encontró un video reproducible';
    state.lastSongRejectReason = reason;
    toast('Solicitud rechazada', `${request.query}: ${reason}.`, 'error');
    renderPlayer(); renderSongs(); renderDashboardMusic();
    if (!state.currentSong && !state.youtubeTransitioning && state.songQueue[0] && !state.songQueue[0].resolving) playNextSong();
    return false;
  } finally {
    state.resolvingSongs = Math.max(0, state.resolvingSongs - 1);
  }
}

async function openSongRequest(request) {
  if (!request) return;
  state.currentSong = request;
  renderPlayer();
  renderSongs();
  try {
    await api.openYouTube({ query: request.videoUrl || request.query, suffix: request.videoUrl ? '' : state.settings.youtubeSearchSuffix });
    toast('Reproduciendo desde la cola', request.selectedTitle || request.query, 'success');
    void sendTikTokAutoChatEvent('songStarted', { song:request, position:1, queueLength:state.songQueue.length, provider:'YouTube' });
  } catch (error) {
    toast('YouTube se abrió fuera de la app', error.message || String(error), 'error');
  }
}

function playNextSong() {
  if (state.youtubeTransitioning) return;
  state.youtubeTransitioning = true;
  state.recommendationActive = false;
  if (!state.songQueue.length) {
    state.currentSong = null;
    state.youtubeTransitioning = false;
    renderPlayer();
    renderSongs();
    return;
  }
  const next = state.songQueue[0];
  if (!next || next.resolving || !next.videoUrl) {
    state.youtubeTransitioning = false;
    renderPlayer(); renderSongs();
    return;
  }
  state.songQueue.shift();
  Promise.resolve(openSongRequest(next)).finally(() => {
    state.youtubeTransitioning = false;
  });
}

async function continueWithRecommendation() {
  state.recommendationActive = true;
  state.currentSong = {
    id: `recommended-${Date.now()}`,
    query: 'Recomendación de YouTube',
    requestedBy: 'Reproducción automática',
    isRecommendation: true,
    createdAt: Date.now()
  };
  renderPlayer();
  renderSongs();
  try {
    const result = await api.continueYouTubeRecommended();
    if (!result?.ok) throw new Error('YouTube no encontró una recomendación disponible.');
  } catch (error) {
    state.currentSong = null;
    state.recommendationActive = false;
    renderPlayer();
    renderSongs();
    toast('No hay recomendación', error.message || String(error), 'error');
  }
}

async function finishCurrentSong(reason = 'ended') {
  const finished = state.currentSong;
  state.currentSong = null;
  state.youtubeTransitioning = false;
  state.player = { ...state.player, currentTime: 0, duration: 0, paused: true };
  renderPlayer();
  renderSongs();
  if (finished && !finished.isRecommendation) {
    if (reason === 'ended') {
      toast('Canción terminada', finished.selectedTitle || finished.query, 'success');
      void sendTikTokAutoChatEvent('songEnded', { song:finished, queueLength:state.songQueue.length, provider:'YouTube' });
    } else if (['skipped','policy','unavailable','youtube-native-next'].includes(reason)) {
      void sendTikTokAutoChatEvent('songSkipped', { song:finished, queueLength:state.songQueue.length, provider:'YouTube' });
    }
  }
  if (state.songQueue.length) {
    playNextSong();
  } else if (state.settings.continueRecommended !== false) {
    await continueWithRecommendation();
  }
}

function enforceCurrentSongRules(payload = {}) {
  if (!state.currentSong || state.currentSong.policyRejected) return;
  if (payload.channel) state.currentSong.channel = payload.channel;
  const issue = songPolicyIssue(state.currentSong, payload);
  if (!issue) return;
  state.currentSong.policyRejected = true;
  const rejectedTitle = payload.title || state.currentSong.selectedTitle || state.currentSong.query;
  toast('Canción omitida', `${rejectedTitle}: ${issue}.`, 'error');
  api.controlYouTube('pause').catch(() => {});
  setTimeout(() => finishCurrentSong('policy'), 120);
}

function formatClock(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}


function renderDashboardMusic() {
  const spotify = activeMusicProvider() === 'spotify';
  const player = spotify ? state.spotifyPlayer : state.player;
  const current = spotify ? state.currentSpotify : state.currentSong;
  const queue = spotify ? state.spotifyQueue : state.songQueue;
  const title = player.title || current?.title || current?.selectedTitle || current?.query || 'Sin música';
  const requester = current
    ? (spotify ? (current.requestedBy ? `Solicitada por ${current.requestedBy}` : (player.artist || 'Spotify')) : (current.isRecommendation ? 'Recomendación de YouTube' : (current.requestedBy ? `Solicitada por ${current.requestedBy}` : 'Solicitud manual')))
    : 'La cola está vacía.';
  const duration = Number(player.duration || 0);
  const currentTime = Number(player.currentTime || 0);
  const percent = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;
  const badge = $('dashboardMusicProviderBadge');
  if (badge) {
    badge.textContent = spotify ? '● Spotify' : '▶ YouTube';
    badge.classList.toggle('provider-spotify', spotify);
  }
  if ($('pauseSongBtn')) $('pauseSongBtn').textContent = spotify ? 'Ver Spotify' : 'Ver YouTube';
  if ($('dashboardRecommendedText')) $('dashboardRecommendedText').textContent = spotify ? 'Cuando termine la cola, Spotify continuará con sus recomendaciones.' : 'Cuando termine la cola, YouTube elegirá una canción relacionada.';
  if ($('dashboardSongInput')) $('dashboardSongInput').placeholder = spotify ? 'Buscar canción o pegar enlace de Spotify…' : 'Buscar canción o pegar enlace de YouTube…';
  if ($('currentSongTitle')) $('currentSongTitle').textContent = title;
  if ($('currentSongCommand')) $('currentSongCommand').textContent = requester;
  if ($('currentTimeLabel')) $('currentTimeLabel').textContent = formatClock(currentTime);
  if ($('durationLabel')) $('durationLabel').textContent = formatClock(duration);
  if ($('playbackProgress')) $('playbackProgress').value = String(percent);
  if ($('playPauseSongBtn')) $('playPauseSongBtn').textContent = player.paused ? '▶' : 'Ⅱ';
  if ($('songDisc')) $('songDisc').classList.toggle('playing', Boolean(current && !player.paused));
  if ($('dashboardQueueCount')) $('dashboardQueueCount').textContent = `(${queue.length})`;
  const volume = spotify ? (state.settings.spotifyVolume ?? 0.8) : (state.settings.youtubeVolume ?? 0.8);
  if ($('youtubeVolumeInput')) $('youtubeVolumeInput').value = String(volume);
  if ($('youtubeVolumeOutput')) $('youtubeVolumeOutput').textContent = `${Math.round(clamp(volume,0,1)*100)}%`;
  if ($('continueRecommendedInput')) $('continueRecommendedInput').checked = spotify ? state.settings.spotifyContinueRecommended !== false : state.settings.continueRecommended !== false;
  renderMiniQueue();
  renderStats();
  schedulePlaylistWidgetSync();
}

function renderMiniQueue() {
  const target = $('miniSongQueue');
  if (!target) return;
  const spotify = activeMusicProvider() === 'spotify';
  const queue = spotify ? state.spotifyQueue : state.songQueue;
  if (!queue.length) {
    target.textContent = !spotify && state.currentSong?.isRecommendation ? 'Continuando con recomendaciones de YouTube.' : 'Cola vacía';
    return;
  }
  target.innerHTML = queue.slice(0, 5).map((song, index) => `<div class="mini-song-item"><span>${index + 1}</span><div><strong>${escapeHtml(song.title || song.query)}</strong><span>${escapeHtml(song.requestedBy || 'Solicitud manual')}</span></div><button class="text-button mini-remove-song" data-id="${escapeHtml(song.id)}">×</button></div>`).join('');
  qsa('.mini-remove-song').forEach((button) => button.addEventListener('click', () => {
    if (spotify) { state.spotifyQueue = state.spotifyQueue.filter((item) => item.id !== button.dataset.id); renderSpotify(); }
    else { state.songQueue = state.songQueue.filter((item) => item.id !== button.dataset.id); renderPlayer(); renderSongs(); }
    renderDashboardMusic();
  }));
}

function renderPlayer() {
  const current = state.currentSong;
  const title = state.player.title || current?.selectedTitle || current?.query || 'Sin música';
  const requester = current
    ? (current.isRecommendation ? 'Recomendación de YouTube' : `${current.requestedBy ? `Solicitada por ${current.requestedBy}` : 'Solicitud manual'}`)
    : 'La cola está vacía.';
  const duration = Number(state.player.duration || 0);
  const currentTime = Number(state.player.currentTime || 0);
  const percent = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;

  $('currentSongTitle').textContent = title;
  $('currentSongCommand').textContent = requester;
  if ($('songsPageCurrentTitle')) $('songsPageCurrentTitle').textContent = title;
  if ($('songsPageRequester')) $('songsPageRequester').textContent = requester;
  if ($('currentTimeLabel')) $('currentTimeLabel').textContent = formatClock(currentTime);
  if ($('durationLabel')) $('durationLabel').textContent = formatClock(duration);
  if ($('songsCurrentTime')) $('songsCurrentTime').textContent = formatClock(currentTime);
  if ($('songsDuration')) $('songsDuration').textContent = formatClock(duration);
  if ($('playbackProgress')) $('playbackProgress').value = String(percent);
  if ($('songsProgressBar')) $('songsProgressBar').style.width = `${percent}%`;
  const playing = Boolean(current && state.youtubeOpen && !state.player.paused);
  $('songDisc').classList.toggle('playing', playing);
  if ($('playPauseSongBtn')) $('playPauseSongBtn').textContent = state.player.paused ? '▶' : 'Ⅱ';
  if ($('songsPlayPauseBtn')) $('songsPlayPauseBtn').textContent = state.player.paused ? '▶' : 'Ⅱ';
  if ($('dashboardQueueCount')) $('dashboardQueueCount').textContent = `(${state.settings.musicProvider === 'spotify' ? state.spotifyQueue.length : state.songQueue.length})`;
  renderDashboardMusic();
}

function renderSongs() {
  const list = $('songsList');
  const all = [
    ...(state.currentSong ? [{ ...state.currentSong, current: true }] : []),
    ...state.songQueue.map((item) => ({ ...item, current: false }))
  ];
  $('songCountPill').textContent = `${all.length} ${all.length === 1 ? 'solicitud' : 'solicitudes'}`;
  if (!all.length) {
    list.classList.add('empty');
    list.innerHTML = '<div class="empty-state small"><div>▶</div><strong>No hay solicitudes</strong><span>Agrega una búsqueda o espera un comando del chat.</span></div>';
    return;
  }

  list.classList.remove('empty');
  list.innerHTML = all.map((song) => `
    <div class="song-row" data-id="${escapeHtml(song.id)}">
      <div class="song-icon">${song.current ? '▶' : '⌛'}</div>
      <div class="song-meta"><strong>${escapeHtml(song.resolving ? `Buscando: ${song.query}` : (song.selectedTitle || song.query))}</strong><span>${song.current ? 'Reproduciendo automáticamente' : 'En cola'}${song.requestedBy ? ` · ${escapeHtml(song.requestedBy)}` : ''}</span></div>
      <span class="queue-order-actions">${song.current ? '' : `<button class="move-song-up" data-id="${escapeHtml(song.id)}" title="Subir">↑</button><button class="move-song-down" data-id="${escapeHtml(song.id)}" title="Bajar">↓</button>`}</span>
      <button class="open-song" data-id="${escapeHtml(song.id)}">Abrir</button>
      <button class="remove remove-song" data-id="${escapeHtml(song.id)}">${song.current ? 'Finalizar' : 'Quitar'}</button>
    </div>`).join('');

  qsa('.move-song-up, .move-song-down').forEach((button) => button.addEventListener('click', () => {
    const index = state.songQueue.findIndex((item) => item.id === button.dataset.id);
    if (index < 0) return;
    const direction = button.classList.contains('move-song-up') ? -1 : 1;
    const target = index + direction;
    if (target < 0 || target >= state.songQueue.length) return;
    [state.songQueue[index], state.songQueue[target]] = [state.songQueue[target], state.songQueue[index]];
    renderPlayer(); renderSongs();
  }));

  qsa('.open-song').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.id;
    const request = state.currentSong?.id === id ? state.currentSong : state.songQueue.find((item) => item.id === id);
    if (!request) return;
    if (state.currentSong?.id !== id) state.songQueue = state.songQueue.filter((item) => item.id !== id);
    openSongRequest(request);
  }));

  qsa('.remove-song').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.id;
    if (state.currentSong?.id === id) {
      state.currentSong = null;
      if (state.songQueue.length) playNextSong();
      else {
        api.openYouTubeHome().catch(() => {});
        renderPlayer();
        renderSongs();
      }
    } else {
      state.songQueue = state.songQueue.filter((item) => item.id !== id);
      renderPlayer();
      renderSongs();
    }
  }));
}

function fillCommandTemplate(template, message, remainder = '') {
  return String(template || '')
    .replaceAll('{usuario}', String(message.nickname || message.uniqueId || 'Usuario'))
    .replaceAll('{mensaje}', remainder || String(message.comment || ''));
}

async function chargeCommand(command, message) {
  const amount = Math.max(0, Math.round(Number(command?.cost || 0)));
  if (!state.settings?.economyEnabled || amount <= 0) return { ok:true, amount:0, transactionId:'' };
  const user = normalizeUser(message?.uniqueId);
  const transactionId = `command:${command.id}:${message.id}:${user}`;
  try {
    const result = await api.mutateEconomy({ mode:'charge', user, displayName:message.nickname || user, profilePictureUrl:message.profilePictureUrl || '', amount, reason:`Comando ${command.trigger}`, transactionId });
    if (!result?.ok) {
      updateCommentResult(message.id, 'blocked', `saldo insuficiente · ${currencyText(result?.balance || 0)}`);
      toast('Saldo insuficiente', `${message.nickname} necesita ${currencyText(amount)}. Tiene ${currencyText(result?.balance || 0)}.`, 'error');
      return { ok:false, amount, transactionId, balance:result?.balance || 0 };
    }
    await refreshEconomy();
    return { ok:true, amount, transactionId, balance:result.balance };
  } catch (error) {
    updateCommentResult(message.id, 'skipped', 'economía no disponible');
    toast('No se pudo cobrar', error?.message || String(error), 'error');
    return { ok:false, amount, transactionId, balance:0 };
  }
}

async function refundCharge(charge, message, reason='Acción cancelada') {
  if (!charge?.amount || !charge.transactionId) return;
  await api.mutateEconomy({ mode:'add', user:normalizeUser(message.uniqueId), displayName:message.nickname, profilePictureUrl:message.profilePictureUrl || '', amount:charge.amount, reason, transactionId:`refund:${charge.transactionId}` });
  await refreshEconomy();
}

async function revokePendingSong(message) {
  const queue = activeMusicProvider() === 'spotify' ? state.spotifyQueue : state.songQueue;
  const user = normalizeUser(message.uniqueId);
  let index = -1;
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const owner = normalizeUser(queue[i]?.requestedById || queue[i]?.requestedBy);
    if (owner && owner === user) { index = i; break; }
  }
  if (index < 0) return { ok:false, reason:'no tienes canciones pendientes' };
  const [removed] = queue.splice(index, 1);
  let refunded = 0;
  if (Number(removed?.chargedAmount || 0) > 0) {
    refunded = Math.round(Number(removed.chargedAmount));
    await api.mutateEconomy({ mode:'add', user, displayName:message.nickname, profilePictureUrl:message.profilePictureUrl || '', amount:refunded, reason:`Reembolso de ${removed.selectedTitle || removed.query}`, transactionId:`revoke:${removed.id}` });
    await refreshEconomy();
  }
  if (activeMusicProvider() === 'spotify') renderSpotify(); else { renderPlayer(); renderSongs(); renderDashboardMusic(); }
  return { ok:true, removed, refunded };
}

const AUDIO_COMMAND_ACTIONS = new Set(['response', 'tts', 'sound', 'balance']);

function commandAudioLockKey(command) {
  return `command:${String(command?.id || command?.trigger || 'audio')}`;
}

function audioCooldownMessage(message, command) {
  updateCommentResult(message.id, 'blocked', 'comando en cooldown hasta que termine el audio');
  toast('Comando en cooldown', `${command.trigger} sigue reproduciendo audio.`, 'error');
}

function reserveCommandAudio(command, message) {
  const lockKey = commandAudioLockKey(command);
  if (!reserveAudioLock(lockKey)) { audioCooldownMessage(message, command); return ''; }
  return lockKey;
}

function draftCommandFromModal() {
  return {
    id: $('commandIdInput')?.value || 'draft',
    trigger: $('commandTriggerInput')?.value.trim() || '!prueba',
    action: $('commandActionInput')?.value || 'response',
    response: $('commandResponseInput')?.value.trim() || '',
    soundId: state.commandMediaDraft?.soundId || '',
    mediaUrl: state.commandMediaDraft?.url || '',
    mediaPath: state.commandMediaDraft?.path || '',
    mediaName: state.commandMediaDraft?.name || 'Sonido de prueba',
    mediaVolume: clamp($('commandMediaVolumeInput')?.value ?? 0.9, 0, 1)
  };
}

function commandAudioTestText(command) {
  const typed = $('commandAudioTestInput')?.value.trim();
  if (command.action === 'response') {
    const sample = { nickname: 'Lulu', uniqueId: 'prueba', comment: `${command.trigger} mensaje de prueba` };
    return fillCommandTemplate(command.response || typed || 'Hola {usuario}, esta es una prueba.', sample, typed || 'mensaje de prueba');
  }
  if (command.action === 'balance') return `Lulu tiene 100 ${state.settings.currencyName || 'Lunitas'}.`;
  return typed || 'Este es un audio de prueba para el comando.';
}

function testCommandAudio(command) {
  if (!AUDIO_COMMAND_ACTIONS.has(command.action)) return;
  const lockKey = `test-command:${command.id || command.trigger}`;
  if (command.action === 'sound') {
    const queued = queueMediaSound(command, { lockKey, label: `Prueba ${command.trigger}` });
    if (!queued.accepted) { toast('Audio ocupado', 'Espera a que termine la prueba anterior.', 'error'); return; }
    toast('Prueba en cola', `${command.mediaName || command.trigger} · ${Math.round(clamp(command.mediaVolume ?? 0.9, 0, 1) * 100)}%`, 'success');
    return;
  }
  const queued = speakText(commandAudioTestText(command), false, null, null, { lockKey, label: `Prueba ${command.trigger}` });
  if (!queued.accepted) { toast('Audio ocupado', 'Espera a que termine la prueba anterior.', 'error'); return; }
  toast('Prueba en cola', command.trigger || 'Comando de voz', 'success');
}

async function handleCustomCommand(command, message) {
  const remainder = commandRemainder(message.comment, command);
  const accessMode = command.permission === 'music' ? (state.settings.musicPermissionMode || 'all') : command.permission;
  if (!hasAudienceAccess(message, accessMode)) {
    updateCommentResult(message.id, 'blocked', permissionDeniedLabel(accessMode));
    toast('Comando sin permiso', `${message.nickname}: ${permissionDeniedLabel(accessMode)}`, 'error');
    return true;
  }

  if (command.action === 'balance') {
    const lockKey = reserveCommandAudio(command, message); if (!lockKey) return true;
    try {
      const balance = await api.getBalance(message.uniqueId);
      const text = `${message.nickname} tiene ${currencyText(balance?.balance || 0)}.`;
      const queued = speakText(text, false, null, null, { lockKey, lockReserved: true, label: command.trigger });
      if (!queued.accepted) { releaseAudioLock(lockKey); updateCommentResult(message.id, 'skipped', queued.reason); return true; }
      updateCommentResult(message.id, 'command');
    } catch (error) {
      releaseAudioLock(lockKey);
      updateCommentResult(message.id, 'skipped', 'saldo no disponible');
      toast('No se pudo consultar el saldo', error?.message || String(error), 'error');
    }
    return true;
  }

  if (command.action === 'revoke') {
    const revoked = await revokePendingSong(message);
    if (!revoked.ok) { updateCommentResult(message.id, 'skipped', revoked.reason); toast('No se pudo revocar', revoked.reason, 'error'); return true; }
    updateCommentResult(message.id, 'command');
    toast('Solicitud revocada', `${revoked.removed?.selectedTitle || revoked.removed?.query}${revoked.refunded ? ` · devueltas ${currencyText(revoked.refunded)}` : ''}`, 'success');
    return true;
  }

  if (command.action === 'song') {
    if (!remainder) { updateCommentResult(message.id, 'blocked', 'falta la canción'); toast('Falta la canción', `Usa ${command.trigger} nombre`, 'error'); return true; }
    if (!hasAudienceAccess(message, state.settings.musicPermissionMode || 'all')) { updateCommentResult(message.id, 'blocked', permissionDeniedLabel(state.settings.musicPermissionMode)); toast('Solicitud rechazada', `${message.nickname} no tiene permiso para pedir música.`, 'error'); return true; }
    const charge = await chargeCommand(command, message); if (!charge.ok) return true;
    const added = await enqueueRequestedMusic(remainder, message.nickname, { requestedById:message.uniqueId, chargedAmount:charge.amount, chargeTransactionId:charge.transactionId });
    if (!added) await refundCharge(charge, message, 'Reembolso: canción no agregada');
    updateCommentResult(message.id, added ? 'song' : 'skipped', added ? '' : (state.lastSongRejectReason || 'no agregada'));
    if (added) toast('Canción agregada', `${remainder} · ${message.nickname}${charge.amount ? ` · ${currencyText(charge.amount)}` : ''}`, 'success');
    return true;
  }

  if (command.action === 'skip') {
    if (!hasActiveMusic()) { updateCommentResult(message.id, 'skipped', 'sin música'); return true; }
    const charge = await chargeCommand(command, message); if (!charge.ok) return true;
    try { await skipActiveMusic(); updateCommentResult(message.id, 'command'); toast('Canción saltada', `Comando de ${message.nickname}`, 'success'); }
    catch (error) { await refundCharge(charge, message); updateCommentResult(message.id, 'skipped', 'no se pudo saltar'); }
    return true;
  }

  if (command.action === 'tts') {
    if (!remainder) { updateCommentResult(message.id, 'blocked', 'falta el mensaje'); return true; }
    const lockKey = reserveCommandAudio(command, message); if (!lockKey) return true;
    const charge = await chargeCommand(command, message);
    if (!charge.ok) { releaseAudioLock(lockKey); return true; }
    const speechResult = enqueueSpeech({ ...message, comment: remainder }, { lockKey, lockReserved: true });
    if (!speechResult.added) await refundCharge(charge, message, 'Reembolso: TTS no agregado');
    updateCommentResult(message.id, speechResult.added ? 'queued' : 'skipped', speechResult.reason || '');
    return true;
  }

  if (command.action === 'response') {
    const response = fillCommandTemplate(command.response || 'Hola {usuario}', message, remainder);
    if (!response.trim()) { updateCommentResult(message.id, 'skipped', 'respuesta vacía'); return true; }
    const lockKey = reserveCommandAudio(command, message); if (!lockKey) return true;
    const charge = await chargeCommand(command, message);
    if (!charge.ok) { releaseAudioLock(lockKey); return true; }
    const queued = speakText(response.trim(), false, null, null, { lockKey, lockReserved: true, label: command.trigger });
    if (!queued.accepted) { releaseAudioLock(lockKey); await refundCharge(charge, message); updateCommentResult(message.id, 'skipped', queued.reason); return true; }
    updateCommentResult(message.id, 'command');
    return true;
  }

  if (command.action === 'sound') {
    if (!safeMediaUrl(command)) { updateCommentResult(message.id, 'skipped', 'sonido no disponible'); return true; }
    const lockKey = reserveCommandAudio(command, message); if (!lockKey) return true;
    const charge = await chargeCommand(command, message);
    if (!charge.ok) { releaseAudioLock(lockKey); return true; }
    const queued = queueMediaSound(command, { lockKey, lockReserved: true, label: command.trigger });
    if (!queued.accepted) { releaseAudioLock(lockKey); await refundCharge(charge, message); }
    updateCommentResult(message.id, queued.accepted ? 'command' : 'skipped', queued.accepted ? '' : (queued.reason || 'sonido no disponible'));
    return true;
  }

  if (command.action === 'image') {
    if (!safeMediaUrl(command)) { updateCommentResult(message.id, 'skipped', 'imagen no disponible'); return true; }
    const charge = await chargeCommand(command, message); if (!charge.ok) return true;
    const shown = await showCommandImage(command); if (!shown) await refundCharge(charge, message);
    updateCommentResult(message.id, shown ? 'command' : 'skipped', shown ? '' : 'imagen no disponible'); return true;
  }
  return false;
}

const LIVE_GAME_DEFINITIONS = Object.freeze([
  { id:'blackjack', label:'Blackjack', icon:'🃏', trigger:'!blackjack', help:'!blackjack 100 · después !pedir o !plantar' },
  { id:'scratch', label:'Rasca y gana', icon:'🎟️', trigger:'!rasca', help:'!rasca 50' },
  { id:'roulette', label:'Ruleta', icon:'🎡', trigger:'!ruleta', help:'!ruleta rojo 100 · negro/par/impar/número' },
  { id:'dice', label:'Dados', icon:'🎲', trigger:'!dados', help:'!dados 50' },
  { id:'rps', label:'Piedra, papel o tijera', icon:'✂️', trigger:'!ppt', help:'!ppt piedra 50' },
  { id:'slots', label:'Tragamonedas', icon:'🎰', trigger:'!slots', help:'!slots 50' }
]);

function normalizedLiveGameCommands() {
  const source = Array.isArray(state.settings?.liveGameCommands) ? state.settings.liveGameCommands : [];
  return LIVE_GAME_DEFINITIONS.map((definition) => {
    const saved = source.find((item) => String(item?.id || '') === definition.id) || {};
    let trigger = String(saved.trigger || definition.trigger).trim().toLowerCase();
    if (!trigger.startsWith('!')) trigger = `!${trigger}`;
    return { ...definition, trigger:trigger.slice(0,32), enabled:saved.enabled !== false };
  });
}

function parseLiveGameCommand(comment) {
  if (state.settings?.liveGamesEnabled === false) return null;
  const text = String(comment || '').trim();
  const lower = text.toLowerCase();
  if (lower === '!pedir' || lower === '!hit') return { game:'blackjack', action:'hit', args:'' };
  if (lower === '!plantar' || lower === '!stand') return { game:'blackjack', action:'stand', args:'' };
  const commands = normalizedLiveGameCommands().filter((item)=>item.enabled).sort((a,b)=>b.trigger.length-a.trigger.length);
  const command = commands.find((item)=>lower===item.trigger || lower.startsWith(`${item.trigger} `));
  if (!command) return null;
  return { game:command.id, action:'play', args:text.slice(command.trigger.length).trim(), command };
}

function gameArgs(match) {
  const tokens = String(match?.args || '').split(/\s+/).map((item)=>item.trim()).filter(Boolean);
  const numericIndex = tokens.findIndex((token)=>/^\d+$/.test(token));
  const bet = numericIndex >= 0 ? Number(tokens[numericIndex]) : null;
  const choice = tokens.filter((_token,index)=>index!==numericIndex).join(' ').toLowerCase();
  return { bet, choice };
}

function gameResultFlag(payload) {
  return payload?.status === 'win' ? 'GANÓ' : payload?.status === 'loss' ? 'PERDIÓ' : payload?.status === 'push' ? 'EMPATE' : 'JUGANDO';
}

function renderLiveGames() {
  if (!$('liveGamesEnabledInput')) return;
  $('liveGamesEnabledInput').checked = state.settings.liveGamesEnabled !== false;
  $('liveGamesMinBetInput').value = Math.max(1, Math.round(Number(state.settings.liveGamesMinBet || 10)));
  $('liveGamesMaxBetInput').value = Math.max(1, Math.round(Number(state.settings.liveGamesMaxBet || 1000)));
  $('liveGamesDefaultBetInput').value = Math.max(1, Math.round(Number(state.settings.liveGamesDefaultBet || 50)));
  $('liveGamesCooldownInput').value = Math.max(0, Math.round(Number(state.settings.liveGamesCooldownSeconds || 8)));
  $('liveGamesSpeakResultsInput').checked = state.settings.liveGamesSpeakResults === true;
  $('liveGamesChatResultsInput').checked = state.settings.liveGamesChatResults === true;
  const list = $('liveGamesList');
  if (list) list.innerHTML = normalizedLiveGameCommands().map((game)=>`<article class="panel live-game-card" data-game="${game.id}"><div class="live-game-icon">${game.icon}</div><div class="live-game-copy"><strong>${escapeHtml(game.label)}</strong><small>${escapeHtml(game.help)}</small></div><div class="live-game-command"><input class="live-game-trigger" value="${escapeHtml(game.trigger)}" maxlength="32"/><label class="switch"><input class="live-game-enabled" type="checkbox" ${game.enabled?'checked':''}/><span></span></label></div></article>`).join('');
  qsa('.live-game-card').forEach((card)=>{
    const gameId=card.dataset.game;
    const save=()=>{
      const commands=normalizedLiveGameCommands();
      const item=commands.find((entry)=>entry.id===gameId); if(!item)return;
      const input=card.querySelector('.live-game-trigger'); let trigger=String(input?.value||item.trigger).trim(); if(!trigger.startsWith('!'))trigger=`!${trigger}`;
      item.trigger=trigger.slice(0,32); item.enabled=card.querySelector('.live-game-enabled')?.checked!==false;
      state.settings.liveGameCommands=commands.map(({id,trigger,enabled})=>({id,trigger,enabled})); scheduleSave();
    };
    card.querySelector('.live-game-trigger')?.addEventListener('change',save);
    card.querySelector('.live-game-enabled')?.addEventListener('change',save);
  });
  const recent=$('liveGameResultsList');
  if (recent) recent.innerHTML=state.liveGameResults.length?state.liveGameResults.slice(0,20).map((item)=>`<div class="live-game-result-row"><div><strong>${escapeHtml(item.title||item.game||'Juego')} · ${escapeHtml(item.displayName||item.user||'Jugador')}</strong><small>${escapeHtml(item.detail||item.text||'')}</small></div><span class="game-result-pill ${escapeHtml(item.status||'pending')}">${gameResultFlag(item)}</span></div>`).join(''):'<div class="empty-state small"><span>Aún no hay partidas en esta sesión.</span></div>';
  if ($('liveGamePlayCount')) $('liveGamePlayCount').textContent=String(state.liveGameStats.plays||0);
  if ($('liveGameWinCount')) $('liveGameWinCount').textContent=String(state.liveGameStats.wins||0);
}

async function announceLiveGameResult(payload) {
  if (!payload?.id) return;
  if (state.liveGameResults.some((item)=>item.id===payload.id && item.timestamp===payload.timestamp && item.detail===payload.detail)) return;
  state.liveGameResults.unshift(payload); if(state.liveGameResults.length>50)state.liveGameResults.length=50;
  if (payload.status !== 'pending') {
    state.liveGameStats.plays += 1;
    if(payload.status==='win')state.liveGameStats.wins+=1;
    else if(payload.status==='loss')state.liveGameStats.losses+=1;
    else if(payload.status==='push')state.liveGameStats.pushes+=1;
  }
  renderLiveGames();
  if (state.settings.liveGamesSpeakResults === true && payload.text) speakText(String(payload.text).slice(0,220), false, null, null, { label:`Juego ${payload.title||''}` });
  if (state.settings.liveGamesChatResults === true && payload.text) {
    api.sendTikTokChat({ message:String(payload.text).slice(0,175), username:state.settings.username || $('usernameInput')?.value || '', cooldownSeconds:Math.max(5,Number(state.settings.tiktokAutoChatCooldownSeconds||8)) }).catch(()=>{});
  }
  refreshEconomy().catch(()=>{});
}

async function handleLiveGameCommand(match, message) {
  if (!match) return false;
  const { bet, choice } = gameArgs(match);
  try {
    const result = await api.playLiveGame({
      game:match.game, action:match.action, bet, choice,
      requestId:message.id, user:message.uniqueId, displayName:message.nickname,
      profilePictureUrl:message.profilePictureUrl || ''
    });
    if (!result?.ok) {
      updateCommentResult(message.id,'blocked',result?.error||'juego no disponible');
      toast('Juego no iniciado', result?.error || 'No se pudo jugar.', 'error');
      return true;
    }
    updateCommentResult(message.id,'game',gameResultFlag(result).toLowerCase());
    return true;
  } catch(error) {
    updateCommentResult(message.id,'skipped','error del juego');
    toast('Error en Juegos del LIVE',error?.message||String(error),'error');
    return true;
  }
}

const AUTOMATION_TRIGGER_LABELS={gift:'Regalo',follow:'Seguidor',like:'Likes',share:'Compartido',subscribe:'Suscripción',member:'Entrada al LIVE',comment:'Comentario'};
const AUTOMATION_ACTION_LABELS={tts:'TTS',chat:'Chat',sound:'Sonido',alert:'Alerta en pantalla',webhook:'Webhook'};
const GOAL_LABELS={likes:'Likes',diamonds:'Monedas',gifts:'Regalos',follows:'Seguidores',shares:'Compartidos',subscribes:'Suscripciones',members:'Entradas',comments:'Comentarios'};

function defaultAutomationRule(){return{id:`auto-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:'Nueva automatización',enabled:true,triggerType:'gift',filter:'',user:'',minValue:0,minRepeat:0,cooldownSeconds:3,perUserCooldown:true,actions:[{id:`act-${Date.now()}`,type:'alert',value:'{user} envió {gift} ×{count}',soundId:'',soundUrl:'',soundPath:'',soundName:'',volume:.9,durationSeconds:6,enabled:true}]}}
function defaultLiveGoal(){return{id:`goal-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,title:'Nueva meta',type:'likes',target:1000,progress:0,enabled:true}}
function automationSoundSelection(action = {}) {
  const resolved = resolveDefaultSound(action);
  return { ...action, soundId:String(resolved.soundId || ''), soundUrl:String(resolved.soundUrl || ''), soundPath:String(resolved.soundPath || ''), soundName:String(resolved.soundName || '') };
}
function normalizedAutomationRules(){return(Array.isArray(state.settings?.automationRules)?state.settings.automationRules:[]).map((rule)=>({...rule,actions:(Array.isArray(rule?.actions)?rule.actions:[]).map((action)=>action?.type==='sound'?automationSoundSelection(action):{...action})}))}
function normalizedLiveGoals(){return Array.isArray(state.settings?.liveGoals)?state.settings.liveGoals:[]}
function saveAutomationStudio(){scheduleSave();renderAutomationStudio()}
function automationEventLine(event){const who=event.nickname||event.uniqueId||'Alguien';if(event.type==='gift')return`${who} · ${event.giftName||'Regalo'} ×${event.repeatCount||1}`;if(event.type==='comment')return`${who} · ${event.comment||''}`;return`${who} · ${AUTOMATION_TRIGGER_LABELS[event.type]||event.type}`}
function pushAutomationLog(text,type='event'){state.automationLog.unshift({id:`log-${Date.now()}-${Math.random()}`,text,type,time:Date.now()});if(state.automationLog.length>60)state.automationLog.length=60;renderAutomationLog()}
function renderAutomationLog(){const target=$('automationActivityList');if(!target)return;target.innerHTML=state.automationLog.length?state.automationLog.slice(0,30).map(item=>`<div class="automation-log-row"><span class="automation-dot ${escapeHtml(item.type)}"></span><strong>${escapeHtml(item.text)}</strong><time>${new Date(item.time).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<div class="empty-state small"><span>Aún no se han ejecutado automatizaciones.</span></div>'}

function automationActionValueHint(type){return type==='tts'?'Texto que leerá Lulu':type==='chat'?'Mensaje para el chat':type==='alert'?'Texto de la alerta':type==='webhook'?'https://...':'Selecciona un archivo de audio'}
function renderAutomationRules(){const target=$('automationRulesList');if(!target)return;const rules=normalizedAutomationRules();target.innerHTML=rules.length?rules.map((rule,index)=>`<article class="panel automation-rule-card" data-rule-index="${index}"><div class="automation-rule-head"><label class="switch"><input class="automation-rule-enabled" type="checkbox" ${rule.enabled!==false?'checked':''}/><span></span></label><input class="automation-rule-name" value="${escapeHtml(rule.name||`Automatización ${index+1}`)}" maxlength="80"/><button class="ghost tiny automation-rule-delete">Eliminar</button></div><div class="automation-trigger-grid"><div class="field-group"><label>Cuando pase</label><select class="automation-trigger-type">${Object.entries(AUTOMATION_TRIGGER_LABELS).map(([value,label])=>`<option value="${value}" ${rule.triggerType===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="field-group"><label>Filtro</label><input class="automation-filter" value="${escapeHtml(rule.filter||'')}" placeholder="Regalo o palabra (opcional)"/></div><div class="field-group"><label>Usuario</label><input class="automation-user" value="${escapeHtml(rule.user||'')}" placeholder="@usuario (opcional)"/></div><div class="field-group"><label>Mínimo</label><input class="automation-min-value" type="number" min="0" value="${Number(rule.minValue||0)}"/></div><div class="field-group"><label>Racha mínima</label><input class="automation-min-repeat" type="number" min="0" value="${Number(rule.minRepeat||0)}"/></div><div class="field-group"><label>Cooldown</label><input class="automation-cooldown" type="number" min="0" max="3600" value="${Number(rule.cooldownSeconds??3)}"/><small>Segundos por usuario.</small></div></div><div class="automation-actions" data-actions>${(Array.isArray(rule.actions)?rule.actions:[]).map((action,aindex)=>`<div class="automation-action-row" data-action-index="${aindex}"><select class="automation-action-type">${Object.entries(AUTOMATION_ACTION_LABELS).map(([value,label])=>`<option value="${value}" ${action.type===value?'selected':''}>${label}</option>`).join('')}</select><input class="automation-action-value" value="${escapeHtml(action.type==='sound'?(action.soundName||''):action.value||'')}" placeholder="${escapeHtml(automationActionValueHint(action.type))}" ${action.type==='sound'?'readonly':''}/>${action.type==='sound'?'<button class="ghost tiny automation-pick-sound">Biblioteca</button>':''}<button class="ghost tiny automation-action-delete">×</button></div>`).join('')}</div><button class="secondary tiny automation-add-action">+ Acción</button></article>`).join(''):'<div class="empty-state"><div>✦</div><strong>Aún no hay automatizaciones</strong><span>Crea una regla para responder a regalos, likes, comentarios y más.</span></div>'}

function renderLiveGoals(){const target=$('liveGoalsList');if(!target)return;const goals=normalizedLiveGoals();const selected=state.settings.selectedGoalId||goals.find(g=>g.enabled!==false)?.id;target.innerHTML=goals.length?goals.map((goal,index)=>{const pct=Math.max(0,Math.min(100,Number(goal.progress||0)/Math.max(1,Number(goal.target||1))*100));return`<article class="panel live-goal-card ${selected===goal.id?'selected':''}" data-goal-index="${index}"><div class="live-goal-head"><label class="switch"><input class="live-goal-enabled" type="checkbox" ${goal.enabled!==false?'checked':''}/><span></span></label><input class="live-goal-title" value="${escapeHtml(goal.title||'Meta del LIVE')}" maxlength="80"/><button class="ghost tiny live-goal-show">${selected===goal.id?'En pantalla':'Mostrar'}</button><button class="ghost tiny live-goal-delete">Eliminar</button></div><div class="live-goal-grid"><div class="field-group"><label>Cuenta</label><select class="live-goal-type">${Object.entries(GOAL_LABELS).map(([value,label])=>`<option value="${value}" ${goal.type===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="field-group"><label>Objetivo</label><input class="live-goal-target" type="number" min="1" value="${Number(goal.target||100)}"/></div><div class="goal-progress-copy"><strong>${Number(goal.progress||0).toLocaleString('es-MX')} / ${Number(goal.target||100).toLocaleString('es-MX')}</strong><span>${Math.round(pct)}%</span></div><button class="secondary tiny live-goal-reset">Reiniciar</button></div><div class="live-goal-track"><span style="width:${pct}%"></span></div></article>`}).join(''):'<div class="empty-state"><div>◎</div><strong>No hay metas</strong><span>Añade una para mostrar el progreso en el stream.</span></div>'}

function renderAutomationStudio(){renderAutomationRules();renderLiveGoals();renderAutomationLog();renderStudioDashboard();if($('giftSessionTotal'))$('giftSessionTotal').textContent=Number(state.giftStats.totalGifts||0).toLocaleString('es-MX');if($('giftSessionDiamonds'))$('giftSessionDiamonds').textContent=Number(state.giftStats.totalDiamonds||0).toLocaleString('es-MX');if($('giftSessionTop'))$('giftSessionTop').textContent=state.giftStats.topGift?`${state.giftStats.topGift.displayName} · ${state.giftStats.topGift.giftName}`:'Esperando';}

async function publishAutomationWidgets(event=null){const goals=normalizedLiveGoals();const selected=goals.find(g=>g.id===state.settings.selectedGoalId)||goals.find(g=>g.enabled!==false);if(selected){const target=Math.max(1,Number(selected.target||1)),progress=Math.max(0,Number(selected.progress||0));api.publishStreamWidget('goal',{id:selected.id,title:selected.title,goalType:selected.type,progress,target,percent:Math.min(100,progress/target*100),text:`${progress.toLocaleString('es-MX')} / ${target.toLocaleString('es-MX')}`}).catch(()=>{});}api.publishStreamWidget('gift',{...state.giftStats,id:'gift-session'}).catch(()=>{});if(event)pushAutomationLog(automationEventLine(event),'event')}

async function executeAutomationAction(action,event){if(!action)return;if(action.type==='tts'&&action.value){speakText(String(action.value).slice(0,450),false,null,null,{label:`Automatización · ${action.ruleName||''}`});return;}if(action.type==='chat'&&action.value){api.sendTikTokChat({message:String(action.value).slice(0,175),username:state.settings.username||$('usernameInput')?.value||'',cooldownSeconds:Math.max(5,Number(state.settings.tiktokAutoChatCooldownSeconds||8))}).catch(()=>{});return;}if(action.type==='sound'){const selected=automationSoundSelection(action);queueMediaSound({mediaUrl:selected.soundUrl,mediaVolume:Math.max(0,Math.min(1,Number(selected.volume??.9)))},{lockKey:`automation:${selected.ruleId||selected.id||selected.soundId||'sound'}`,label:`Automatización · ${selected.soundName||selected.ruleName||'sonido'}`});return;}if(action.type==='alert'){const value=String(action.value||automationEventLine(event)).slice(0,220);const duration=Math.max(1,Math.min(60,Number(action.durationSeconds||6)));api.publishStreamWidget('alert',{id:`alert-${Date.now()}`,title:action.ruleName||'Alerta de Lulu',text:value,icon:event.type==='gift'?'🎁':event.type==='follow'?'♡':event.type==='like'?'♥':event.type==='subscribe'?'★':'✦',durationSeconds:duration,expiresAt:Date.now()+duration*1000}).catch(()=>{});return;}if(action.type==='webhook'&&action.value){api.runAutomationWebhook({url:action.value,method:action.method||'POST',body:action.body||{event}}).then(result=>pushAutomationLog(`Webhook ${result?.status||''} · ${action.ruleName||''}`,result?.ok?'action':'error')).catch(()=>pushAutomationLog(`Webhook falló · ${action.ruleName||''}`,'error'));}}

async function handleAutomationEvent(event) {
  if (!event?.type || !state.settings || !categoryRunsInBackground('automations')) return;
  state.settings.liveGoals = await api.applyGoalEvent(normalizedLiveGoals(), event);
  if (event.type === 'gift') state.giftStats = await api.updateGiftStats(state.giftStats, event);
  const evaluated = await api.evaluateAutomations(normalizedAutomationRules(), event, { now: Date.now(), cooldowns: state.automationCooldowns });
  state.automationCooldowns = evaluated?.cooldowns || {};
  for (const action of evaluated?.actions || []) {
    pushAutomationLog(`${action.ruleName || 'Automatización'} · ${AUTOMATION_ACTION_LABELS[action.type] || action.type}`, 'action');
    await executeAutomationAction(action, event);
  }
  renderAutomationStudio();
  publishAutomationWidgets(event);
}

function automationComposerDefaultValue(type) {
  return type === 'tts' ? '{user} envió {gift}'
    : type === 'chat' ? '¡Gracias {user}!'
      : type === 'webhook' ? 'https://'
        : type === 'sound' ? ''
          : '{user} activó una alerta';
}

function updateAutomationComposer() {
  const trigger = $('automationTriggerInput')?.value || 'gift';
  const action = $('automationActionInput')?.value || 'alert';
  if ($('automationPreviewTrigger')) $('automationPreviewTrigger').textContent = `Al recibir ${String(AUTOMATION_TRIGGER_LABELS[trigger] || trigger).toLowerCase()}`;
  if ($('automationPreviewAction')) $('automationPreviewAction').textContent = AUTOMATION_ACTION_LABELS[action] || action;
  const valueInput = $('automationValueInput');
  if (valueInput) {
    valueInput.placeholder = automationActionValueHint(action);
    if (action === 'sound') {
      valueInput.value = '';
      valueInput.disabled = true;
      valueInput.placeholder = 'Añade el sonido desde la tarjeta después de crearla';
    } else {
      if (valueInput.disabled || !valueInput.value.trim()) valueInput.value = automationComposerDefaultValue(action);
      valueInput.disabled = false;
    }
  }
}

function openAutomationModal() {
  const triggerSelect = $('automationTriggerInput');
  const actionSelect = $('automationActionInput');
  if (!triggerSelect || !actionSelect) return;
  triggerSelect.innerHTML = Object.entries(AUTOMATION_TRIGGER_LABELS).map(([value,label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('');
  actionSelect.innerHTML = Object.entries(AUTOMATION_ACTION_LABELS).map(([value,label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('');
  $('automationForm')?.reset();
  $('automationNameInput').value = 'Nueva automatización';
  triggerSelect.value = 'gift';
  actionSelect.value = 'alert';
  $('automationCooldownInput').value = '3';
  $('automationValueInput').value = automationComposerDefaultValue('alert');
  updateAutomationComposer();
  $('automationModal').classList.remove('hidden');
  setTimeout(() => $('automationNameInput')?.focus(), 60);
}

function closeAutomationModal() {
  $('automationModal')?.classList.add('hidden');
}

function saveAutomationFromComposer(event) {
  event.preventDefault();
  const actionType = $('automationActionInput').value;
  if (actionType === 'sound') {
    toast('Crea primero la regla', 'Después pulsa “Elegir” en la acción Sonido para seleccionar el archivo.', 'success');
  }
  const rule = defaultAutomationRule();
  rule.name = $('automationNameInput').value.trim().slice(0, 80) || 'Nueva automatización';
  rule.triggerType = $('automationTriggerInput').value;
  rule.filter = $('automationFilterInput').value.trim().slice(0, 120);
  rule.user = normalizeUser($('automationUserInput').value).slice(0, 80);
  rule.minValue = Math.max(0, Number($('automationMinValueInput').value || 0));
  rule.cooldownSeconds = Math.max(0, Math.min(3600, Number($('automationCooldownInput').value || 0)));
  rule.actions = [{
    id:`act-${Date.now()}`,
    type:actionType,
    value:actionType === 'sound' ? '' : $('automationValueInput').value.trim().slice(0, 500),
    soundId:'',soundUrl:'',soundPath:'',soundName:'',volume:.9,durationSeconds:6,enabled:true
  }];
  state.settings.automationRules = [...normalizedAutomationRules(), rule];
  saveAutomationStudio();
  closeAutomationModal();
  toast('Automatización creada', rule.name, 'success');
}

function bindAutomationSoundLibrary() {
  const rules = $('automationRulesList');
  rules?.addEventListener('change', (event) => {
    if (!event.target.classList.contains('automation-action-type') || event.target.value === 'sound') return;
    const card = event.target.closest('.automation-rule-card');
    const row = event.target.closest('.automation-action-row');
    const list = normalizedAutomationRules();
    const action = list[Number(card?.dataset.ruleIndex)]?.actions?.[Number(row?.dataset.actionIndex)];
    if (!action) return;
    action.soundId = ''; action.soundUrl = ''; action.soundPath = ''; action.soundName = '';
    state.settings.automationRules = list;
  });
  rules?.addEventListener('click', (event) => {
    const button = event.target.closest('.automation-pick-sound');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const card = button.closest('.automation-rule-card');
    const row = button.closest('.automation-action-row');
    const list = normalizedAutomationRules();
    const rule = list[Number(card?.dataset.ruleIndex)];
    const action = rule?.actions?.[Number(row?.dataset.actionIndex)];
    if (!action) return;
    openSoundLibrary({
      title: `Sonido de ${rule.name || 'automatización'}`,
      selectedId: action.soundId,
      apply: (selected) => {
        Object.assign(action, { type:'sound', value:'', soundId:selected.soundId || '', soundUrl:selected.url || selected.soundUrl || '', soundPath:selected.path || selected.soundPath || '', soundName:selected.name || selected.soundName || 'Sonido' });
        state.settings.automationRules = list;
        saveAutomationStudio();
      }
    });
  });
}

function bindAutomationStudio(){const rules=$('automationRulesList');rules?.addEventListener('change',async(e)=>{const card=e.target.closest('.automation-rule-card');if(!card)return;const index=Number(card.dataset.ruleIndex),list=normalizedAutomationRules();const rule=list[index];if(!rule)return;if(e.target.classList.contains('automation-rule-enabled'))rule.enabled=e.target.checked;if(e.target.classList.contains('automation-rule-name'))rule.name=e.target.value;if(e.target.classList.contains('automation-trigger-type'))rule.triggerType=e.target.value;if(e.target.classList.contains('automation-filter'))rule.filter=e.target.value;if(e.target.classList.contains('automation-user'))rule.user=e.target.value;if(e.target.classList.contains('automation-min-value'))rule.minValue=Math.max(0,Number(e.target.value||0));if(e.target.classList.contains('automation-min-repeat'))rule.minRepeat=Math.max(0,Number(e.target.value||0));if(e.target.classList.contains('automation-cooldown'))rule.cooldownSeconds=Math.max(0,Number(e.target.value||0));const actionRow=e.target.closest('.automation-action-row');if(actionRow){const action=rule.actions?.[Number(actionRow.dataset.actionIndex)];if(action&&e.target.classList.contains('automation-action-type')){action.type=e.target.value;if(action.type!=='sound'){action.soundId='';action.soundUrl='';action.soundPath='';action.soundName='';}}if(action&&e.target.classList.contains('automation-action-value')&&action.type!=='sound')action.value=e.target.value;}state.settings.automationRules=list;saveAutomationStudio();});rules?.addEventListener('click',async(e)=>{const card=e.target.closest('.automation-rule-card');if(!card)return;const index=Number(card.dataset.ruleIndex),list=normalizedAutomationRules(),rule=list[index];if(!rule)return;if(e.target.closest('.automation-rule-delete')){list.splice(index,1);}else if(e.target.closest('.automation-add-action')){rule.actions=Array.isArray(rule.actions)?rule.actions:[];rule.actions.push({id:`act-${Date.now()}`,type:'alert',value:'{user} activó una alerta',soundId:'',soundUrl:'',soundPath:'',soundName:'',volume:.9,durationSeconds:6,enabled:true});}else if(e.target.closest('.automation-action-delete')){const row=e.target.closest('.automation-action-row');rule.actions.splice(Number(row.dataset.actionIndex),1);}else if(e.target.closest('.automation-pick-sound')){return;}else{return;}state.settings.automationRules=list;saveAutomationStudio();});$('addAutomationRuleBtn')?.addEventListener('click',openAutomationModal);
const goals=$('liveGoalsList');goals?.addEventListener('change',(e)=>{const card=e.target.closest('.live-goal-card');if(!card)return;const index=Number(card.dataset.goalIndex),list=normalizedLiveGoals(),goal=list[index];if(!goal)return;if(e.target.classList.contains('live-goal-enabled'))goal.enabled=e.target.checked;if(e.target.classList.contains('live-goal-title'))goal.title=e.target.value;if(e.target.classList.contains('live-goal-type'))goal.type=e.target.value;if(e.target.classList.contains('live-goal-target'))goal.target=Math.max(1,Number(e.target.value||1));state.settings.liveGoals=list;saveAutomationStudio();publishAutomationWidgets();});goals?.addEventListener('click',async(e)=>{const card=e.target.closest('.live-goal-card');if(!card)return;const index=Number(card.dataset.goalIndex),list=normalizedLiveGoals(),goal=list[index];if(!goal)return;if(e.target.closest('.live-goal-delete')){list.splice(index,1);if(state.settings.selectedGoalId===goal.id)state.settings.selectedGoalId=list[0]?.id||'';}else if(e.target.closest('.live-goal-reset')){state.settings.liveGoals=await api.resetGoal(list,goal.id);saveAutomationStudio();publishAutomationWidgets();return;}else if(e.target.closest('.live-goal-show')){state.settings.selectedGoalId=goal.id;}else{return;}state.settings.liveGoals=list;saveAutomationStudio();publishAutomationWidgets();});$('addLiveGoalBtn')?.addEventListener('click',()=>{const goal=defaultLiveGoal();state.settings.liveGoals=[...normalizedLiveGoals(),goal];state.settings.selectedGoalId=state.settings.selectedGoalId||goal.id;saveAutomationStudio();publishAutomationWidgets();});$('resetGiftStatsBtn')?.addEventListener('click',()=>{state.giftStats={totalGifts:0,totalDiamonds:0,topGift:null,topStreak:null,lastGift:null};renderAutomationStudio();publishAutomationWidgets();});for(const [type,prefix] of [['alert','alertWidget'],['goal','goalWidget'],['gift','giftWidget']]){$(`copy${prefix[0].toUpperCase()+prefix.slice(1)}UrlBtn`)?.addEventListener('click',()=>copyStreamWidgetLink(type,false));$(`copy${prefix[0].toUpperCase()+prefix.slice(1)}LocalUrlBtn`)?.addEventListener('click',()=>copyStreamWidgetLink(type,true));$(`refresh${prefix[0].toUpperCase()+prefix.slice(1)}Btn`)?.addEventListener('click',()=>refreshStreamWidgetInfo(type,true));}}

async function processChat(message, simulated = false) {
  const normalizedMessage = {
    id: message.id || `${Date.now()}-${Math.random()}`,
    uniqueId: message.uniqueId || 'prueba',
    nickname: message.nickname || message.uniqueId || 'Usuario',
    comment: String(message.comment || ''),
    profilePictureUrl: message.profilePictureUrl || '',
    isFollower: Boolean(message.isFollower || simulated),
    isSubscriber: Boolean(message.isSubscriber),
    memberLevel: Number(message.memberLevel || 0),
    badges: Array.isArray(message.badges) ? message.badges : [],
    timestamp: message.timestamp || Date.now()
  };
  addComment(normalizedMessage, 'received');
  void rewardEconomy('comment', normalizedMessage, 1, normalizedMessage.id);

  handleAutomationEvent({ type:'comment', id:`comment-${normalizedMessage.id||Date.now()}`, timestamp:Date.now(), uniqueId:normalizedMessage.uniqueId, nickname:normalizedMessage.nickname, profilePictureUrl:normalizedMessage.profilePictureUrl||'', comment:normalizedMessage.comment }).catch(()=>{});
  const customCommand = findCommand(normalizedMessage.comment);
  if (customCommand) {
    await handleCustomCommand(customCommand, normalizedMessage);
    return;
  }

  const liveGameCommand = parseLiveGameCommand(normalizedMessage.comment);
  if (liveGameCommand) {
    await handleLiveGameCommand(liveGameCommand, normalizedMessage);
    return;
  }

  const songRequest = parseSongCommand(normalizedMessage.comment);
  if (songRequest) {
    if (!hasAudienceAccess(normalizedMessage, state.settings.musicPermissionMode || 'all')) {
      updateCommentResult(normalizedMessage.id, 'blocked', permissionDeniedLabel(state.settings.musicPermissionMode));
      toast('Solicitud rechazada', `${normalizedMessage.nickname} no tiene permiso para pedir música.`, 'error');
      return;
    }
    if (!songRequest.query) {
      updateCommentResult(normalizedMessage.id, 'blocked', 'falta la canción');
      toast('Falta la canción', `Usa ${state.settings.songPrefix} nombre`, 'error');
      return;
    }
    const added = await enqueueRequestedMusic(songRequest.query, normalizedMessage.nickname);
    updateCommentResult(normalizedMessage.id, added ? 'song' : 'skipped', added ? '' : (state.lastSongRejectReason || 'no agregada'));
    if (added) toast('Canción agregada', `${songRequest.query} · ${normalizedMessage.nickname}`, 'success');
    return;
  }

  const check = filterComment(normalizedMessage);
  if (!check.allowed) {
    updateCommentResult(normalizedMessage.id, 'blocked', check.reason);
    if (simulated) toast('Comentario filtrado', check.reason, 'error');
    return;
  }

  const speechResult = enqueueSpeech({ ...normalizedMessage, comment:check.text });
  if (speechResult.added) {
    rememberAcceptedComment(check);
    updateCommentResult(normalizedMessage.id, 'queued');
  } else {
    updateCommentResult(normalizedMessage.id, 'skipped', speechResult.reason);
  }
}

const COMMAND_ACTION_LABELS = {
  response: 'Respuesta de voz',
  tts: 'Leer el mensaje',
  song: 'Pedir canción',
  skip: 'Saltar canción',
  sound: 'Reproducir sonido',
  image: 'Mostrar imagen',
  balance: 'Consultar saldo',
  revoke: 'Revocar canción'
};

const PERMISSION_LABELS = {
  all: 'Todos',
  followers: 'Seguidores',
  members: 'Miembros',
  selected: 'Permitidos',
  music: 'Permiso de música'
};

async function refreshOverlayInfo(screen = null) {
  const selected = clamp(screen ?? $('overlayScreenInput')?.value ?? state.overlay.screen ?? 1, 1, 4);
  try {
    const info = await api.getOverlayInfo(selected);
    state.overlay = { ...state.overlay, ...info };
    if ($('overlayScreenInput')) $('overlayScreenInput').value = String(selected);
    if ($('overlayUrlOutput')) $('overlayUrlOutput').value = info.url || 'HTTPS no disponible';
    if ($('overlayLocalUrlOutput')) $('overlayLocalUrlOutput').value = info.localUrl || '';
    if ($('overlayHttpsStatus')) { const ready=Boolean(info.url); $('overlayHttpsStatus').textContent=info.tunnelMessage||(ready?'HTTPS fijo listo. Esta URL no cambia al reiniciar.':'No se pudo crear HTTPS. Pulsa Copiar HTTPS para reintentar.'); $('overlayHttpsStatus').classList.toggle('ready',ready); $('overlayHttpsStatus').classList.toggle('error',!ready); }
    if ($('overlayConnectionStatus')) {
      $('overlayConnectionStatus').textContent = info.connected ? `${info.connected} fuente${info.connected === 1 ? '' : 's'} conectada${info.connected === 1 ? '' : 's'}` : 'Sin fuente conectada';
      $('overlayConnectionStatus').classList.toggle('connected', Boolean(info.connected));
    }
  } catch (error) {
    if ($('overlayConnectionStatus')) $('overlayConnectionStatus').textContent = error?.message || 'No disponible';
  }
}

async function testStreamOverlay() {
  const command = normalizedCommands().find((item) => item.action === 'image' && item.mediaPath);
  if (!command) { toast('No hay imagen de prueba', 'Crea primero un comando con una imagen o GIF.', 'error'); return; }
  const screen = clamp($('overlayScreenInput')?.value || 1, 1, 4);
  const ok = await showCommandImage({ ...command, overlayScreen: screen, mediaDuration: Math.min(5, command.mediaDuration || 5) });
  if (ok) toast('Prueba enviada', `Superposición ${screen}`, 'success');
}

function renderCommands() {
  const commands = normalizedCommands();
  const usesImageOverlay = commands.some((command) => command.action === 'image');
  $('commandOverlaySetupCard')?.classList.toggle('hidden', !usesImageOverlay);
  state.settings.customCommands = commands;
  const target = $('commandsList');
  const preview = $('dashboardCommandsList');
  if (target) {
    target.innerHTML = commands.length ? commands.map((command) => `
      <div class="command-row" data-id="${escapeHtml(command.id)}">
        <span class="trigger">${escapeHtml(command.trigger)}</span>
        <span>${escapeHtml(COMMAND_ACTION_LABELS[command.action] || command.action)}</span>
        <span class="muted">${escapeHtml(PERMISSION_LABELS[command.permission] || command.permission)}</span>
        <span class="cost-pill">${command.cost ? escapeHtml(currencyText(command.cost)) : 'Gratis'}</span>
        <label class="switch"><input class="command-toggle" data-id="${escapeHtml(command.id)}" type="checkbox" ${command.enabled ? 'checked' : ''}/><span></span></label>
        <span class="row-actions">${AUDIO_COMMAND_ACTIONS.has(command.action) ? `<button class="test-command-audio" data-id="${escapeHtml(command.id)}" title="Probar audio">▶</button>` : ''}<button class="edit-command" data-id="${escapeHtml(command.id)}" title="Editar">✎</button><button class="delete-command" data-id="${escapeHtml(command.id)}" title="Eliminar">×</button></span>
      </div>`).join('') : '<div class="empty-state small"><strong>No hay comandos</strong><span>Crea el primero con “Nuevo comando”.</span></div>';
  }
  if (preview) {
    preview.innerHTML = commands.slice(0, 4).map((command) => `<div class="command-preview-row"><strong>${escapeHtml(command.trigger)}</strong><span>${escapeHtml(COMMAND_ACTION_LABELS[command.action] || command.action)}</span><i class="dot-state ${command.enabled ? 'on' : ''}"></i></div>`).join('') || '<div class="empty-state small"><span>Sin comandos</span></div>';
  }

  qsa('.command-toggle').forEach((input) => input.addEventListener('change', () => {
    const command = state.settings.customCommands.find((item) => item.id === input.dataset.id);
    if (!command) return;
    command.enabled = input.checked;
    scheduleSave();
    renderCommands();
  }));
  qsa('.test-command-audio').forEach((button) => button.addEventListener('click', () => {
    const command = state.settings.customCommands.find((item) => item.id === button.dataset.id);
    if (command) testCommandAudio(command);
  }));
  qsa('.edit-command').forEach((button) => button.addEventListener('click', () => openCommandModal(button.dataset.id)));
  qsa('.delete-command').forEach((button) => button.addEventListener('click', () => {
    const command = state.settings.customCommands.find((item) => item.id === button.dataset.id);
    if (!command) return;
    if (!confirm(`¿Eliminar ${command.trigger}?`)) return;
    state.settings.customCommands = state.settings.customCommands.filter((item) => item.id !== button.dataset.id);
    scheduleSave();
    renderCommands();
  }));
}

function updateCommandMediaFields() {
  const action = $('commandActionInput').value;
  const isResponse = action === 'response';
  const isMedia = action === 'sound' || action === 'image';
  const isAudio = AUDIO_COMMAND_ACTIONS.has(action);
  const expectedMediaType = action === 'sound' ? 'audio' : action === 'image' ? 'image' : '';
  if (expectedMediaType && state.commandMediaDraft && state.commandMediaDraft.type !== expectedMediaType) {
    state.commandMediaDraft = null;
    $('commandMediaName').textContent = 'Ningún archivo elegido';
  }
  $('commandResponseField').classList.toggle('hidden', !isResponse);
  $('commandMediaField').classList.toggle('hidden', !isMedia);
  $('commandAudioTestField')?.classList.toggle('hidden', !isAudio);
  $('commandImageDurationField').classList.toggle('hidden', action !== 'image');
  $('commandOverlayScreenField')?.classList.toggle('hidden', action !== 'image');
  $('commandMediaVolumeField').classList.toggle('hidden', action !== 'sound');
  $('pickCommandMediaBtn').textContent = action === 'image' ? 'Elegir imagen' : 'Biblioteca de sonidos';
  if ($('commandMediaVolumeOutput')) $('commandMediaVolumeOutput').textContent = `${Math.round(clamp($('commandMediaVolumeInput').value, 0, 1) * 100)}%`;
  $('commandCostCurrency').textContent = state.settings?.currencyName || 'Lunitas';
  $('commandCostInput').disabled = action === 'balance' || action === 'revoke';
  if (action === 'balance' || action === 'revoke') $('commandCostInput').value = '0';
  updateCommandCreationPreview();
}

function updateCommandCreationPreview() {
  const action = $('commandActionInput')?.value || 'response';
  let trigger = $('commandTriggerInput')?.value.trim().replace(/\s+/g, '') || '!comando';
  if (!trigger.startsWith('!')) trigger = `!${trigger}`;
  const permission = $('commandPermissionInput')?.value || 'all';
  const cost = Math.max(0, Math.round(Number($('commandCostInput')?.value || 0)));
  if ($('commandPreviewTrigger')) $('commandPreviewTrigger').textContent = trigger;
  if ($('commandPreviewAction')) $('commandPreviewAction').textContent = COMMAND_ACTION_LABELS[action] || action;
  if ($('commandPreviewPermission')) $('commandPreviewPermission').textContent = `${PERMISSION_LABELS[permission] || permission} · ${cost ? currencyText(cost) : 'Gratis'}`;
}

function openCommandModal(id = '') {
  const command = normalizedCommands().find((item) => item.id === id) || {
    id: '', trigger: '!', action: 'response', response: '', permission: 'all', enabled: true,
    soundId:'', mediaUrl: '', mediaPath: '', mediaName: '', mediaVolume: 0.9, mediaDuration: 6, overlayScreen: 1, cost: 0
  };
  state.commandMediaDraft = command.mediaUrl ? { type: command.action === 'image' ? 'image' : 'audio', soundId:command.soundId || '', url: command.mediaUrl, path: command.mediaPath, name: command.mediaName } : null;
  $('commandIdInput').value = command.id;
  $('commandTriggerInput').value = command.trigger;
  $('commandActionInput').value = command.action;
  $('commandResponseInput').value = command.response;
  $('commandPermissionInput').value = command.permission === 'music' ? 'all' : command.permission;
  $('commandEnabledInput').checked = command.enabled;
  $('commandMediaVolumeInput').value = String(command.mediaVolume ?? 0.9);
  if ($('commandMediaVolumeOutput')) $('commandMediaVolumeOutput').textContent = `${Math.round(clamp(command.mediaVolume ?? 0.9, 0, 1) * 100)}%`;
  if ($('commandAudioTestInput')) $('commandAudioTestInput').value = command.action === 'response' ? (command.response || 'Hola {usuario}, esta es una prueba.') : 'Este es un audio de prueba para el comando.';
  $('commandImageDurationInput').value = String(command.mediaDuration ?? 6);
  if ($('commandOverlayScreenInput')) $('commandOverlayScreenInput').value = String(command.overlayScreen ?? 1);
  $('commandCostInput').value = String(command.cost ?? 0);
  $('commandMediaName').textContent = command.mediaName || 'Ningún archivo elegido';
  $('commandModalTitle').textContent = command.id ? `Editar ${command.trigger}` : 'Nuevo comando';
  updateCommandMediaFields();
  updateCommandCreationPreview();
  $('commandModal').classList.remove('hidden');
  setTimeout(() => $('commandTriggerInput').focus(), 60);
}

function closeCommandModal() {
  $('commandModal').classList.add('hidden');
  $('commandForm').reset();
}

function saveCommandFromModal(event) {
  event.preventDefault();
  let trigger = $('commandTriggerInput').value.trim().replace(/\s+/g, '');
  if (!trigger.startsWith('!')) trigger = `!${trigger}`;
  if (trigger.length < 2) {
    toast('Comando inválido', 'Escribe algo como !saludo.', 'error');
    return;
  }
  const currentId = $('commandIdInput').value;
  const duplicate = normalizedCommands().find((command) => command.trigger.toLowerCase() === trigger.toLowerCase() && command.id !== currentId);
  if (duplicate) {
    toast('Comando duplicado', `${trigger} ya existe.`, 'error');
    return;
  }
  const command = {
    id: currentId || `command-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    trigger,
    action: $('commandActionInput').value,
    response: $('commandResponseInput').value.trim(),
    permission: $('commandPermissionInput').value,
    enabled: $('commandEnabledInput').checked,
    soundId: state.commandMediaDraft?.soundId || '',
    mediaUrl: state.commandMediaDraft?.url || '',
    mediaPath: state.commandMediaDraft?.path || '',
    mediaName: state.commandMediaDraft?.name || '',
    mediaVolume: clamp($('commandMediaVolumeInput').value, 0, 1),
    mediaDuration: clamp($('commandImageDurationInput').value, 1, 60),
    overlayScreen: clamp($('commandOverlayScreenInput')?.value ?? 1, 1, 4),
    cost: ['balance','revoke'].includes($('commandActionInput').value) ? 0 : Math.max(0, Math.round(Number($('commandCostInput').value || 0)))
  };
  if ((command.action === 'sound' || command.action === 'image') && !command.mediaUrl) {
    toast('Falta el archivo', command.action === 'image' ? 'Elige una imagen.' : 'Elige un sonido.', 'error');
    return;
  }
  const commands = normalizedCommands();
  const index = commands.findIndex((item) => item.id === currentId);
  if (index >= 0) commands[index] = command;
  else commands.push(command);
  state.settings.customCommands = commands;
  if (command.action === 'song') state.settings.songPrefix = command.trigger;
  scheduleSave();
  populateSettings();
  renderCommands();
  closeCommandModal();
  toast('Comando guardado', command.trigger, 'success');
}

function renderEconomy() {
  if (!$('economyEnabledInput')) return;
  state.settings.economyRewards = normalizedEconomyRewards();
  $('economyEnabledInput').checked = Boolean(state.settings.economyEnabled);
  $('currencyNameInput').value = state.settings.currencyName || 'Lunitas';
  $('currencySymbolInput').value = state.settings.currencySymbol || '🌙';
  $('economyStartingBalanceInput').value = Math.max(0, Math.round(Number(state.settings.economyStartingBalance || 0)));
  const rewards = $('economyRewardsList');
  rewards.innerHTML = Object.entries(state.settings.economyRewards).map(([type, rule]) => { const label=ECONOMY_REWARD_LABELS[type]||[type,'cada acción']; return `<div class="economy-reward-row" data-type="${type}"><label class="switch"><input class="economy-reward-enabled" type="checkbox" ${rule.enabled?'checked':''}><span></span></label><div><strong>${escapeHtml(label[0])}</strong><small>${escapeHtml(label[1])}</small></div><div class="field-group"><label>Entregar</label><input class="economy-reward-amount" type="number" min="0" max="1000000" value="${rule.amount}"></div><div class="field-group"><label>Cada</label><input class="economy-reward-every" type="number" min="1" max="1000000" value="${rule.every}"></div></div>`; }).join('');
  qsa('.economy-reward-row').forEach((row) => { const type=row.dataset.type; const save=()=>{ const rule=state.settings.economyRewards[type]; rule.enabled=row.querySelector('.economy-reward-enabled').checked; rule.amount=Math.max(0,Math.round(Number(row.querySelector('.economy-reward-amount').value||0))); rule.every=Math.max(1,Math.round(Number(row.querySelector('.economy-reward-every').value||1))); scheduleSave(); }; row.querySelectorAll('input').forEach((input)=>input.addEventListener(input.type==='checkbox'?'change':'input',save)); });
  const balances = Array.isArray(state.economy?.balances) ? state.economy.balances : [];
  $('economyAccountCount').textContent = String(balances.length);
  $('economyBalancesList').innerHTML = balances.length ? balances.slice(0,50).map((account)=>`<div class="economy-balance-row"><div><strong>@${escapeHtml(account.user)}</strong><span>${escapeHtml(account.displayName||account.user)}</span></div><strong>${escapeHtml(currencyText(account.balance))}</strong></div>`).join('') : '<div class="empty-state small"><span>Sin cuentas todavía.</span></div>';
  const ledger = Array.isArray(state.economy?.ledger) ? state.economy.ledger : [];
  $('economyLedgerList').innerHTML = ledger.length ? ledger.slice(0,80).map((item)=>`<div class="economy-ledger-row"><div><strong>@${escapeHtml(item.user)}</strong><span>${escapeHtml(item.reason||'Movimiento')}</span></div><strong class="${Number(item.delta)>=0?'positive':'negative'}">${Number(item.delta)>=0?'+':''}${escapeHtml(currencyText(item.delta))}</strong></div>`).join('') : '<div class="empty-state small"><span>Sin movimientos.</span></div>';
  if ($('commandCostCurrency')) $('commandCostCurrency').textContent = state.settings.currencyName || 'Lunitas';
}

async function lookupEconomyUser(showToast=false) {
  const user = normalizeUser($('economyUserInput').value);
  if (!user) { if(showToast) toast('Falta el usuario','Escribe un @usuario.','error'); return null; }
  const result = await api.getBalance(user);
  $('economyUserBalance').textContent = currencyText(result?.balance || 0);
  return result;
}

async function adjustEconomyUser(mode) {
  const user = normalizeUser($('economyUserInput').value);
  if (!user) { toast('Falta el usuario','Escribe un @usuario.','error'); return; }
  const raw = Math.max(0, Math.round(Number($('economyAmountInput').value || 0)));
  const amount = mode === 'remove' ? -raw : raw;
  const result = await api.mutateEconomy({ mode:mode==='set'?'set':'add', user, displayName:user, amount, reason:mode==='set'?'Saldo establecido por el propietario':mode==='remove'?'Monedas retiradas por el propietario':'Monedas añadidas por el propietario', transactionId:`admin:${mode}:${Date.now()}:${user}` });
  if (result?.ok) { $('economyUserBalance').textContent=currencyText(result.balance); await refreshEconomy(); toast('Saldo actualizado', `@${user}: ${currencyText(result.balance)}`, 'success'); }
}

function renderAllowedUsers(scope = 'music') {
  const users = normalizedAllowedUsers(scope);
  const count = scope === 'tts' ? $('allowedTtsUsersCount') : $('allowedUsersCount');
  const list = scope === 'tts' ? $('allowedTtsUsersList') : $('allowedUsersList');
  if (!count || !list) return;
  count.textContent = String(users.length);
  list.innerHTML = users.length
    ? users.map((user) => `<span class="user-chip">@${escapeHtml(user)}<button data-user="${escapeHtml(user)}" data-scope="${scope}">×</button></span>`).join('')
    : '<span class="hint">No has agregado usuarios.</span>';
  list.querySelectorAll('.user-chip button').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.scope === 'tts' ? 'allowedTtsUsers' : 'allowedMusicUsers';
    state.settings[key] = normalizedAllowedUsers(button.dataset.scope).filter((user) => user !== button.dataset.user);
    scheduleSave();
    renderPermissions();
  }));
}

function renderPermissions() {
  const musicMode = state.settings.musicPermissionMode || 'all';
  const ttsMode = state.settings.ttsPermissionMode || 'all';
  qsa('input[name="musicPermissionMode"]').forEach((input) => { input.checked = input.value === musicMode; });
  qsa('input[name="ttsPermissionMode"]').forEach((input) => { input.checked = input.value === ttsMode; });
  qsa('input[name="musicProvider"]').forEach((input) => { input.checked = input.value === activeMusicProvider(); });
  $('minimumMemberLevelInput').value = Math.max(1, Number(state.settings.minimumMemberLevel) || 1);
  $('minimumTtsMemberLevelInput').value = Math.max(1, Number(state.settings.minimumTtsMemberLevel) || 1);
  renderAllowedUsers('music');
  renderAllowedUsers('tts');
  if ($('activeMusicCommandHint')) $('activeMusicCommandHint').textContent = state.settings.songPrefix || '!cancion';
}

function addAllowedUser(scope = 'music') {
  const input = scope === 'tts' ? $('allowedTtsUserInput') : $('allowedUserInput');
  const user = normalizeUser(input.value);
  if (!user) return;
  const key = scope === 'tts' ? 'allowedTtsUsers' : 'allowedMusicUsers';
  const users = normalizedAllowedUsers(scope);
  if (!users.includes(user)) users.push(user);
  state.settings[key] = users;
  input.value = '';
  scheduleSave();
  renderPermissions();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderUpdateStatus(payload = {}) {
  state.updateStatus = payload;
  const status = payload.status || 'idle';
  const text = $('updateStatusText');
  const badge = $('updateVersionBadge');
  const progress = $('updateProgress');
  const bar = $('updateProgressBar');
  const checkButton = $('checkUpdatesBtn');
  const installButton = $('installUpdateBtn');

  badge.textContent = payload.version ? `v${payload.version}` : `v${payload.currentVersion || '0.9.0'}`;
  checkButton.disabled = status === 'checking' || status === 'downloading' || status === 'installing';
  checkButton.textContent = status === 'checking' ? 'Buscando…' : 'Buscar actualización';
  installButton.classList.toggle('hidden', status !== 'downloaded');
  progress.classList.toggle('hidden', status !== 'downloading');
  bar.style.width = `${clamp(payload.percent || 0, 0, 100)}%`;

  const messages = {
    idle: 'Se comprobarán automáticamente al iniciar.',
    checking: 'Buscando versiones nuevas en GitHub…',
    current: payload.message || 'Lulu Finity está actualizada.',
    available: payload.message || `La versión ${payload.version} está disponible.`,
    deferred: `La versión ${payload.version} queda pendiente para después.`,
    external: payload.message || 'Se abrió GitHub para descargar la versión nueva.',
    downloading: `Descargando actualización: ${Math.round(payload.percent || 0)}%${payload.total ? ` · ${formatBytes(payload.transferred)} de ${formatBytes(payload.total)}` : ''}`,
    downloaded: payload.message || 'La actualización está lista para instalar.',
    installing: payload.message || 'Reiniciando para instalar la actualización…',
    development: payload.message || 'La búsqueda funciona en la aplicación instalada.',
    error: payload.message || 'No se pudo comprobar la actualización.'
  };
  text.textContent = messages[status] || messages.idle;
}

const PAGE_PREVIEW_FRAMES = Object.freeze({
  rankings: ['rankingPreviewFrame','playlistWidgetPreviewFrame','walletWidgetPreviewFrame'],
  automations: ['alertWidgetPreviewFrame','goalWidgetPreviewFrame','giftWidgetPreviewFrame'],
  games: ['gameWidgetPreviewFrame']
});

function topLevelPages() {
  return qsa('.main-content > .page');
}

function suspendPageView(pageName) {
  for (const id of PAGE_PREVIEW_FRAMES[pageName] || []) {
    const frame = $(id);
    if (!frame) continue;
    frame.removeAttribute('src');
    frame.setAttribute('title', frame.getAttribute('title') || 'Vista previa en pausa');
  }
  if (pageName === 'voice' && state.systemVoicesBound) {
    window.speechSynthesis.onvoiceschanged = null;
    state.systemVoicesBound = false;
  }
}

function applyPageVisibility(pageName) {
  const target = $(`page-${pageName}`);
  const pages = topLevelPages();
  if (!target || !pages.includes(target)) {
    console.error(`La categoría ${pageName} no pertenece a la ventana principal.`);
    return false;
  }
  for (const page of pages) {
    const visible = page === target;
    page.classList.toggle('active', visible);
    page.hidden = !visible;
    page.inert = !visible;
    page.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  document.body.dataset.activePage = pageName;
  return true;
}

function goToPage(pageName, options = {}) {
  const normalizedPage = String(pageName || '').trim();
  if (!applyPageVisibility(normalizedPage)) {
    toast('No se pudo abrir la categoría', 'Lulu evitó mostrar una pantalla incompleta.', 'error');
    return false;
  }
  const previousPage = state.activePage;
  if (previousPage && previousPage !== normalizedPage) suspendPageView(previousPage);
  const visibleNavPage = normalizedPage === 'spotify' ? 'songs' : normalizedPage;
  qsa('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === visibleNavPage));
  state.activePage = normalizedPage;
  if (options.notifyMain !== false) void api.setActivePage(normalizedPage).catch((error) => console.error('No se pudo activar la categoría:', error));
  if (options.activateModules !== false) activatePageModules(normalizedPage);
  scheduleAudioActivityIndicators();
  scheduleRuntimeMonitor(normalizedPage === 'settings' && document.querySelector('[data-category-pane="performance"]')?.classList.contains('active'));
  if (options.scroll !== false) document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}

function setEqualizer(id, active) { $(id)?.classList.toggle('active', Boolean(active)); }
function renderAudioActivityIndicators() {
  if (!state.settings) return;
  const ttsPlaying=Boolean(state.speaking || (state.audioBusy && state.activeAudioJob?.kind === 'speech'));
  const provider=state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';
  const currentMusic=provider === 'spotify' ? state.currentSpotify : state.currentSong;
  const player=provider === 'spotify' ? state.spotifyPlayer : state.player;
  const musicPlaying=Boolean(currentMusic && player && !player.paused), soundPlaying=Boolean(state.audioBusy && state.activeAudioJob?.kind === 'sound');
  setEqualizer('voiceActivityBars',ttsPlaying); if($('voiceActivityText')) $('voiceActivityText').textContent=ttsPlaying?'Reproduciendo':'Silencio';
  setEqualizer('musicActivityBars',musicPlaying); if($('musicActivityText')) $('musicActivityText').textContent=musicPlaying?'Reproduciendo':'Silencio';
  setEqualizer('commandActivityBars',soundPlaying); if($('commandActivityText')) $('commandActivityText').textContent=soundPlaying?'Reproduciendo':'Silencio';
}
const BALANCED_KEEP_ACTIVE_KEYS=['live','account','voice','music','overlays','rankings','automations','commands','games','economy'];
function normalizedBalancedKeepActive(value=state.settings?.balancedKeepActive){const source=value&&typeof value==='object'?value:{};return Object.fromEntries(BALANCED_KEEP_ACTIVE_KEYS.map((key)=>[key,source[key]===true]));}
function categoryRunsInBackground(key){
  if (!state.settings) return false;
  if (key === 'automations') {
    const hasRules = normalizedAutomationRules().some((rule) => rule?.enabled !== false);
    const hasGoals = normalizedLiveGoals().some((goal) => goal?.enabled !== false);
    return hasRules || hasGoals;
  }
  return true;
}
function renderBalancedKeepActiveControls(){if(!state.settings)return;state.settings.balancedKeepActive=normalizedBalancedKeepActive();const balanced=state.settings.performanceProfile==='balanced';qsa('[data-balanced-keep]').forEach((input)=>{input.checked=state.settings.balancedKeepActive[input.dataset.balancedKeep]===true;input.disabled=!balanced;});if($('balancedKeepAllBtn'))$('balancedKeepAllBtn').disabled=!balanced;if($('balancedKeepNoneBtn'))$('balancedKeepNoneBtn').disabled=!balanced;if($('balancedKeepActiveCard'))$('balancedKeepActiveCard').classList.toggle('profile-disabled',!balanced);if($('balancedKeepStatus'))$('balancedKeepStatus').textContent=balanced?'Equilibrado activo':'Disponible en Equilibrado';}
function hasActiveAudioActivity(){const provider=state.settings?.musicProvider==='spotify'?'spotify':'youtube';const current=provider==='spotify'?state.currentSpotify:state.currentSong;const player=provider==='spotify'?state.spotifyPlayer:state.player;return Boolean(state.speaking||state.audioBusy||(current&&player&&!player.paused));}
function hasMusicSession(){const provider=state.settings?.musicProvider==='spotify'?'spotify':'youtube';return provider==='spotify'?Boolean(state.currentSpotify||state.spotifyQueue.length):Boolean(state.currentSong||state.songQueue.length);}
function activeServiceSnapshot(){return{live:Boolean(state.connected),voice:Boolean(state.speaking||state.audioBusy||state.speechQueue.length),music:hasMusicSession(),automations:normalizedAutomationRules().some((rule)=>rule?.enabled!==false)||normalizedLiveGoals().some((goal)=>goal?.enabled!==false),commands:normalizedCommands().some((command)=>command?.enabled),games:Boolean(state.settings?.liveGamesEnabled),economy:Boolean(state.settings?.economyEnabled)}}
function scheduleIdleResourceRelease(){clearTimeout(state.idleResourceTimer);state.idleResourceTimer=null;const profile=state.settings?.performanceProfile||'balanced';const delay=profile==='saving'?30000:profile==='balanced'?180000:0;if(!delay)return;state.idleResourceTimer=setTimeout(()=>{state.idleResourceTimer=null;void api.releaseIdleResources({keepMusic:hasMusicSession(),activeServices:activeServiceSnapshot()});},delay);}
function scheduleAudioActivityIndicators(){clearInterval(state.audioActivityTimer);state.audioActivityTimer=null;scheduleIdleResourceRelease();if(document.hidden||!['dashboard','voice','songs','spotify','commands'].includes(state.activePage))return;renderAudioActivityIndicators();if(!hasActiveAudioActivity())return;state.audioActivityTimer=setInterval(renderAudioActivityIndicators,750);}
function setupAudioActivityIndicators(){scheduleAudioActivityIndicators();document.addEventListener('visibilitychange',()=>{scheduleAudioActivityIndicators();scheduleRuntimeMonitor(state.activePage==='settings'&&document.querySelector('[data-category-pane="performance"]')?.classList.contains('active'));});}

function selectCategoryTab(scope, key, scroll = true) {
  const group = document.querySelector(`[data-category-tabs="${scope}"]`);
  if (!group) return false;
  group.querySelectorAll('[data-category-tab]').forEach((button) => button.classList.toggle('active', button.dataset.categoryTab === key));
  qsa(`[data-category-pane-group="${scope}"]`).forEach((pane) => pane.classList.toggle('active', pane.dataset.categoryPane === key));
  if(scope==='settings')scheduleRuntimeMonitor(key==='performance');
  if (scroll) document.querySelector('.main-content')?.scrollTo({ top:0, behavior:'smooth' });
  return true;
}

async function refreshRuntimeStatus(){if(!$('runtimeStats'))return;try{const runtime=await api.getRuntimeStatus();const total=Number(runtime.totalMemoryMb??runtime.memoryMb??0);$('runtimeStats').innerHTML=`<div class="runtime-stat runtime-stat-total"><strong>${total} MB</strong><span>RAM total de Lulu</span></div><div class="runtime-stat"><strong>${Number(runtime.mainMemoryMb||0)} MB</strong><span>Solo núcleo</span></div><div class="runtime-stat"><strong>${Number(runtime.processes||0)}</strong><span>Procesos protegidos</span></div><div class="runtime-stat"><strong>${Number(runtime.modules?.overlayClients||0)}</strong><span>Fuentes en pantalla</span></div>`;const breakdown=Array.isArray(runtime.breakdown)?runtime.breakdown:[];if($('runtimeBreakdown'))$('runtimeBreakdown').innerHTML=breakdown.length?`<div class="runtime-breakdown-title"><strong>Desglose real aproximado</strong><span>La suma incluye todos los procesos que Windows agrupa como Lulu Finity.</span></div><div class="runtime-breakdown-list">${breakdown.map((item)=>`<div><span>${escapeHtml(item.label||'Otro proceso')}</span><strong>${Number(item.memoryMb||0)} MB</strong></div>`).join('')}</div><p class="runtime-process-note">Electron separa interfaz, reproductor, gráficos y servicios para mantener el aislamiento. No son ocho copias de Lulu. Spotify Web puede usar varios de estos procesos mientras reproduce.</p>`:'';const modules=[['LIVE',runtime.modules?.live],['Lulu Local',runtime.modules?.localTts?.running],['YouTube',runtime.modules?.youtube],['Spotify',runtime.modules?.spotify],['Overlays',runtime.modules?.overlayServer],['Rankings',runtime.modules?.active?.includes('rankings')],['Automatizaciones',runtime.modules?.automationsLoaded],['Juegos',runtime.modules?.gamesLoaded],['Economía',runtime.modules?.active?.includes('economy')]];$('runtimeModules').innerHTML=modules.map(([label,on])=>`<span class="runtime-module ${on?'live':''}">${label} · ${on?'activo':'en espera'}</span>`).join('');}catch(error){$('runtimeStats').textContent=error.message||String(error);}}
function scheduleRuntimeMonitor(active){clearInterval(state.runtimeTimer);state.runtimeTimer=null;if(!active||document.hidden)return;void refreshRuntimeStatus();state.runtimeTimer=setInterval(refreshRuntimeStatus,5000);}
function activatePageModules(page){const first=!state.loadedPages.has(page);state.loadedPages.add(page);if(page==='voice'){if(first){loadSystemVoices();void loadLocalVoices();void loadOnlineVoices(false);}if(!state.systemVoicesBound){window.speechSynthesis.onvoiceschanged=loadSystemVoices;state.systemVoicesBound=true;}}if(page==='rankings'){if(first){state.ranking.slot=clamp(state.ranking?.slot||1,1,4);setRankingControlValues();}void refreshOverlayInfo(state.overlay?.screen||1);void refreshRankingInfo(state.ranking.slot,true);void refreshStreamWidgetInfo('playlist',true);void refreshStreamWidgetInfo('wallet',true);}if(page==='automations'){publishAutomationWidgets();for(const type of ['alert','goal','gift'])void refreshStreamWidgetInfo(type,true);}if(page==='games')void refreshStreamWidgetInfo('game',true);if(page==='economy'){state.economyLoaded=true;void refreshEconomy();}if(page==='settings'&&first)void refreshRelayUsage();if(page==='account')void api.getTikTokChatStatus().then(renderTikTokChatStatus).catch(()=>{});}
const FEATURE_INDEX=[['Conectar TikTok','Cuenta y estado del LIVE','account'],['Lulu Local','Voces sin Internet','voice','local'],['Voces por usuario','TTS personalizado','voice','users'],['Lectura inteligente','Unicode, emojis y CJK','voice','filters'],['Diccionario','Pronunciación personalizada','voice','dictionary'],['Música','YouTube, Spotify y cola','songs'],['Pantalla y overlays','OBS y TikTok LIVE Studio','rankings'],['Alertas y metas','Automatizaciones del LIVE','automations'],['Comandos','Respuestas, sonidos e imágenes','commands'],['Juegos','Interacciones del chat','games'],['Economía','Monedas y saldos','economy'],['Rendimiento','Módulos y memoria','settings','performance'],['Actualizaciones','Versión de Lulu Finity','settings','updates'],['Sobre Lulu','Información y contacto','about']];
function setupFeatureSearch(){const input=$('featureSearchInput'),results=$('featureSearchResults');if(!input||!results)return;const hide=()=>results.classList.add('hidden');input.addEventListener('input',()=>{const query=normalizeText(input.value.trim());if(!query){hide();return;}const matches=FEATURE_INDEX.filter((item)=>normalizeText(item.join(' ')).includes(query)).slice(0,8);results.innerHTML=matches.length?matches.map((item,index)=>`<button data-feature="${FEATURE_INDEX.indexOf(item)}" class="${index?'':'active'}"><strong>${escapeHtml(item[0])}</strong><small>${escapeHtml(item[1])}</small></button>`).join(''):'<small>No encontré esa función.</small>';results.classList.remove('hidden');results.querySelectorAll('button').forEach((button)=>button.addEventListener('click',()=>{const item=FEATURE_INDEX[Number(button.dataset.feature)];goToPage(item[2]);if(item[2]==='voice'&&item[3])document.querySelector(`[data-tts-tab="${item[3]}"]`)?.click();else if(item[3])selectCategoryTab(item[2],item[3]);input.value='';hide();}));});input.addEventListener('keydown',(event)=>{if(event.key==='Escape'){input.value='';hide();}if(event.key==='Enter')results.querySelector('button')?.click();});document.addEventListener('click',(event)=>{if(!event.target.closest('.feature-search'))hide();});}

function setupNavigation() {
  setupFeatureSearch();
  qsa('.nav-item').forEach((button) => button.addEventListener('click', () => goToPage(button.dataset.page)));
  qsa('[data-go-page]').forEach((button) => button.addEventListener('click', () => goToPage(button.dataset.goPage)));
  qsa('[data-tts-tab]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.ttsTab;
    qsa('[data-tts-tab]').forEach((item) => item.classList.toggle('active', item === button));
    qsa('[data-tts-pane]').forEach((pane) => pane.classList.toggle('active', pane.dataset.ttsPane === key));
    if(key==='local')void loadLocalVoices();
    document.querySelector('.main-content')?.scrollTo({ top:0, behavior:'smooth' });
  }));
  qsa('[data-category-tabs]').forEach((group) => group.querySelectorAll('[data-category-tab]').forEach((button) => button.addEventListener('click', () => selectCategoryTab(group.dataset.categoryTabs, button.dataset.categoryTab))));
  applyPageVisibility(state.activePage);
}

async function connectFromUi() {
  const username = $('usernameInput').value.trim();
  if (!username) {
    toast('Falta el usuario', 'Escribe el usuario que está transmitiendo.', 'error');
    $('usernameInput').focus();
    return;
  }
  state.settings.username = username;
  state.lastReadByUser.clear();
  state.lastMessageByUser.clear();
  scheduleSave();
  setStatus({ status: 'connecting', username: normalizeUser(username) });
  try {
    const result = await api.connect(username);
    setStatus(result);
    toast('LIVE conectado', `@${result.username}`, 'success');
    void refreshRelayUsage();
  } catch (error) {
    setStatus({ status: 'error', username: normalizeUser(username), message: error.message || String(error) });
    toast('No se pudo conectar', error.message || String(error), 'error');
  }
}

async function disconnectFromUi() {
  await api.disconnect();
  setStatus({ status: 'disconnected' });
}

async function addManualSong(inputId) {
  const input = $(inputId);
  const query = input.value.trim();
  if (!query) {
    toast('Falta la canción', `Escribe un nombre o enlace de ${activeMusicProvider() === 'spotify' ? 'Spotify' : 'YouTube'}.`, 'error');
    input.focus();
    return;
  }
  const added = await enqueueRequestedMusic(query, 'Solicitud manual');
  if (added) {
    input.value = '';
    toast('Canción agregada', query, 'success');
  }
}

async function skipCurrentSong() {
  if (!state.currentSong) return;
  state.currentSong = null;
  state.youtubeTransitioning = false;
  state.player = { ...state.player, currentTime: 0, duration: 0, paused: true, title: '' };
  if (state.songQueue.length) playNextSong();
  else if (state.settings.continueRecommended !== false) await continueWithRecommendation();
  else { renderPlayer(); renderSongs(); }
}

function syncRecommendedSetting(value) {
  state.settings.continueRecommended = Boolean(value);
  $('continueRecommendedInput').checked = state.settings.continueRecommended;
  $('songsContinueRecommendedInput').checked = state.settings.continueRecommended;
  scheduleSave();
}

function setupEvents() {
  bindStreamWidgetThemeStudios();
  bindStreamWidgetBackgroundStudios();
  bindStreamWidgetStyleEditors();
  bindSoundLibrary();
  $('minimizeBtn').addEventListener('click', api.minimize);
  $('maximizeBtn').addEventListener('click', api.maximize);
  $('closeBtn').addEventListener('click', api.close);

  $('connectBtn').addEventListener('click', connectFromUi);
  $('bannerConnectBtn').addEventListener('click', connectFromUi);
  $('usernameInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') connectFromUi(); });
  $('disconnectBtn').addEventListener('click', disconnectFromUi);
  $('sidebarDisconnectBtn').addEventListener('click', disconnectFromUi);
  $('studioConnectBtn')?.addEventListener('click', () => state.connected ? disconnectFromUi() : connectFromUi());
  qsa('[data-studio-theme]').forEach((button) => button.addEventListener('click', () => { state.settings.themeMode = button.dataset.studioTheme; $('themeModeInput').value = state.settings.themeMode; applyAppearance(); scheduleSave(); }));

  $('clearCommentsBtn').addEventListener('click', () => { state.comments = []; renderComments(); });
  $('simulateBtn').addEventListener('click', () => {
    const comment = $('testCommentInput').value.trim();
    if (!comment) return;
    processChat({
      uniqueId: normalizeUser($('testNameInput').value) || 'usuario_prueba',
      nickname: $('testNameInput').value.trim() || 'Usuario de prueba',
      comment,
      isFollower: true,
      memberLevel: 5,
      isSubscriber: true
    }, true);
    $('testCommentInput').value = '';
  });
  $('testCommentInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('simulateBtn').click(); }
  });

  bindSetting('ttsEnabledInput', 'ttsEnabled');
  bindSetting('includeUsernameInput', 'includeUsername');
  $('voiceSelect').addEventListener('change', () => {
    const parsed=parseVoiceValue($('voiceSelect').value);if(!parsed)return;state.settings.voiceMode=parsed.mode;
    if(parsed.mode==='local')state.settings.localVoiceId=parsed.localVoiceId;else if(parsed.mode==='tiktok')state.settings.tiktokVoice=parsed.tiktokVoice;else if(parsed.mode==='online')state.settings.onlineVoice=parsed.onlineVoice;else state.settings.voiceURI=parsed.voiceURI;renderLocalVoices();
    scheduleSave();
  });
  $('voiceLanguageFilter').addEventListener('change', () => {
    state.settings.voiceLanguageFilter = $('voiceLanguageFilter').value;
    renderVoiceOptions();
    scheduleSave();
  });
  $('voiceSearchInput')?.addEventListener('input', () => {
    state.voiceSearch = $('voiceSearchInput').value;
    renderVoiceOptions();
  });
  bindSetting('rateInput', 'rate', 'input', Number);
  bindSetting('pitchInput', 'pitch', 'input', Number);
  bindSetting('ttsVolumeInput', 'ttsVolume', 'input', Number);
  bindSetting('queueLimitInput', 'queueLimit', 'input', Number);
  bindSetting('maxCommentDelayInput', 'maxCommentDelaySeconds', 'input', Number);
  bindSetting('youtubeMuteDuringTtsInput', 'youtubeMuteDuringTts');
  bindSetting('checkUpdatesOnStartupInput', 'checkUpdatesOnStartup');
  bindSetting('blockLinksInput', 'blockLinks');
  bindSetting('readCommandsInput', 'readCommands');
  bindSetting('ignoreDirectedMentionsInput', 'ignoreDirectedMentions');
  bindSetting('smartTextEnabledInput','smartTextEnabled');bindSetting('blockCjkTextInput','blockCjkText');bindSetting('blockMixedScriptsInput','blockMixedScripts');bindSetting('stripUsernameEmojiInput','stripUsernameEmoji');
  bindSetting('maxCharactersInput', 'maxCharacters', 'input', Number);
  bindSetting('cooldownInput', 'userCooldownSeconds', 'input', Number);
  bindSetting('songQueueLimitInput', 'songQueueLimit', 'input', Number);
  bindSetting('youtubeSearchSuffixInput', 'youtubeSearchSuffix', 'input', (value) => String(value).trim());
  bindSetting('preventDuplicateSongsInput', 'preventDuplicateSongs');
  bindSetting('youtubeAdBlockEnabledInput', 'youtubeAdBlockEnabled');
  bindSetting('tiktokAutoChatEnabledInput', 'tiktokAutoChatEnabled');
  bindSetting('tiktokAutoChatCooldownInput', 'tiktokAutoChatCooldownSeconds', 'input', Number);
  for (const [suffix, enabledKey, textKey] of [
    ['SongQueued','tiktokAutoChatSongQueuedEnabled','tiktokAutoChatSongQueuedText'],
    ['SongStarted','tiktokAutoChatSongStartedEnabled','tiktokAutoChatSongStartedText'],
    ['SongEnded','tiktokAutoChatSongEndedEnabled','tiktokAutoChatSongEndedText'],
    ['SongSkipped','tiktokAutoChatSongSkippedEnabled','tiktokAutoChatSongSkippedText'],
    ['LiveConnected','tiktokAutoChatLiveConnectedEnabled','tiktokAutoChatLiveConnectedText']
  ]) {
    bindSetting(`tiktokAutoChat${suffix}EnabledInput`, enabledKey);
    bindSetting(`tiktokAutoChat${suffix}TextInput`, textKey, 'input', (value) => String(value).trimStart().slice(0, 180));
  }
  $('tiktokAutoChatTestInput')?.addEventListener('input', () => { state.settings.tiktokAutoChatTestText = $('tiktokAutoChatTestInput').value.slice(0, 180); scheduleSave(); });
  $('openTikTokChatBtn')?.addEventListener('click', async () => {
    const status = await api.openTikTokChat({ username:state.settings.username || $('usernameInput').value });
    renderTikTokChatStatus(status);
  });
  $('checkTikTokChatBtn')?.addEventListener('click', async () => renderTikTokChatStatus(await api.getTikTokChatStatus()));
  $('testTikTokChatBtn')?.addEventListener('click', async () => {
    const message = String($('tiktokAutoChatTestInput')?.value || state.settings.tiktokAutoChatTestText || '').trim();
    if (!message) { toast('Falta el mensaje', 'Escribe un texto de prueba.', 'error'); return; }
    const result = await api.sendTikTokChat({ message, username:state.settings.username || $('usernameInput').value, cooldownSeconds:state.settings.tiktokAutoChatCooldownSeconds || 8 });
    toast(result?.ok ? 'Mensaje enviado' : 'No se pudo enviar', result?.message || '', result?.ok ? 'success' : 'error');
  });
  const resetTikTokSessionFromUi = async () => {
    if (!window.confirm('¿Desvincular TikTok y borrar de esta PC todas las cookies, caché y datos locales de esa sesión?')) return;
    renderTikTokChatStatus(await api.resetTikTokChatSession());
    toast('Sesión de TikTok eliminada', 'Lulu Finity ya no conserva datos de esa sesión en esta PC.', 'success');
  };
  $('resetTikTokChatBtn')?.addEventListener('click', resetTikTokSessionFromUi);
  $('privacyResetTikTokBtn')?.addEventListener('click', resetTikTokSessionFromUi);
  bindSetting('maxSongDurationInput', 'maxSongDurationMinutes', 'input', Number);
  $('blockedSongsInput').addEventListener('input', () => { state.settings.blockedSongs = linesToArray($('blockedSongsInput').value); scheduleSave(); });
  $('blockedChannelsInput').addEventListener('input', () => { state.settings.blockedChannels = linesToArray($('blockedChannelsInput').value); scheduleSave(); });
  $('themeModeInput').addEventListener('change', () => { state.settings.themeMode = $('themeModeInput').value; applyAppearance(); scheduleSave(); });
  qsa('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => {
    state.settings.themeMode = button.dataset.themeChoice;
    $('themeModeInput').value = state.settings.themeMode;
    applyAppearance();
    scheduleSave();
  }));
  qsa('input[name="performanceProfile"]').forEach((input)=>input.addEventListener('change',()=>{if(!input.checked)return;state.settings.performanceProfile=input.value;renderBalancedKeepActiveControls();scheduleIdleResourceRelease();scheduleSave();void refreshRuntimeStatus();}));
  qsa('[data-balanced-keep]').forEach((input)=>input.addEventListener('change',()=>{const key=input.dataset.balancedKeep;if(!BALANCED_KEEP_ACTIVE_KEYS.includes(key))return;state.settings.balancedKeepActive={...normalizedBalancedKeepActive(),[key]:input.checked};scheduleIdleResourceRelease();scheduleSave();void refreshRuntimeStatus();}));
  const setAllBalancedCategories=(enabled)=>{state.settings.balancedKeepActive=Object.fromEntries(BALANCED_KEEP_ACTIVE_KEYS.map((key)=>[key,Boolean(enabled)]));renderBalancedKeepActiveControls();scheduleIdleResourceRelease();scheduleSave();void refreshRuntimeStatus();};
  $('balancedKeepAllBtn')?.addEventListener('click',()=>setAllBalancedCategories(true));
  $('balancedKeepNoneBtn')?.addEventListener('click',()=>setAllBalancedCategories(false));
  $('refreshRuntimeBtn')?.addEventListener('click',refreshRuntimeStatus);
  $('releaseIdleResourcesBtn')?.addEventListener('click',async()=>{await api.releaseIdleResources({force:true,keepMusic:hasMusicSession(),activeServices:activeServiceSnapshot()});await refreshRuntimeStatus();toast('Optimización completada','Se liberaron vistas y auxiliares inactivos. Los servicios activados continúan funcionando.','success');});
  for (const [id, key] of [['glowIntensityInput', 'glowIntensity'], ['panelOpacityInput', 'panelOpacity'], ['cornerRadiusInput', 'cornerRadius']]) {
    $(id).addEventListener('input', () => { state.settings[key] = Number($(id).value); syncOutputs(); applyAppearance(); scheduleSave(); });
  }
  qsa('[data-dashboard-panel]').forEach((input) => input.addEventListener('change', () => {
    const hidden = new Set(Array.isArray(state.settings.hiddenDashboardPanels) ? state.settings.hiddenDashboardPanels : []);
    if (input.checked) hidden.add(input.dataset.dashboardPanel); else hidden.delete(input.dataset.dashboardPanel);
    state.settings.hiddenDashboardPanels = [...hidden];
    applyDashboardVisibility(); scheduleSave();
  }));
  $('songPrefixInput').addEventListener('input', () => {
    const trigger = String($('songPrefixInput').value || '').trim() || '!cancion';
    state.settings.songPrefix = trigger;
    const commands = normalizedCommands();
    const songCommand = commands.find((command) => command.action === 'song');
    if (songCommand) songCommand.trigger = trigger;
    state.settings.customCommands = commands;
    syncOutputs(); renderCommands(); scheduleSave();
  });

  $('blockedWordsInput').addEventListener('input', () => { state.settings.blockedWords = linesToArray($('blockedWordsInput').value); scheduleSave(); });
  $('ignoredUsersInput').addEventListener('input', () => { state.settings.ignoredUsers = linesToArray($('ignoredUsersInput').value).map(normalizeUser); scheduleSave(); });
  $('pronunciationDictionaryInput').addEventListener('input',()=>{state.settings.pronunciationDictionary=textToDictionary($('pronunciationDictionaryInput').value);scheduleSave();});

  $('voiceTestBtn').addEventListener('click', () => { stopCurrentAudio(); speakText($('voiceTestInput').value.trim() || 'Prueba de voz.', false, null, null, { lockKey:'test-global-voice', label:'Prueba de voz general' }); });
  ['customVoiceRateInput','customVoicePitchInput','customVoiceVolumeInput'].forEach((id) => $(id)?.addEventListener('input', syncCustomVoiceBuilderOutputs));
  $('testCustomVoiceBtn')?.addEventListener('click', () => testCustomVoiceConfig(customVoiceBuilderConfig(), 'Voz antes de guardar'));
  $('refreshVoicesBtn').addEventListener('click', () => refreshVoices(true));
  $('localVoiceImportBtn').addEventListener('click',async()=>{try{const voice=await api.importLocalVoice();if(!voice)return;await loadLocalVoices();state.settings.voiceMode='local';state.settings.localVoiceId=voice.id;renderVoiceOptions();renderLocalVoices();scheduleSave();toast('Voz local importada',voice.name||voice.id,'success');}catch(error){toast('No se pudo importar',error.message||String(error),'error');}});
  $('dictionaryTestBtn').addEventListener('click',()=>{const prepared=window.LuluText.prepare($('dictionaryTestInput').value,smartTextOptions());if(!prepared.allowed){toast('Texto bloqueado',prepared.reason,'error');return;}speakText(prepared.text,false,null,null,{lockKey:'test-dictionary',label:'Prueba de diccionario'});});
  $('stopVoiceBtn').addEventListener('click', clearSpeechQueue);
  $('clearVoiceQueueBtn').addEventListener('click', () => { clearSpeechQueue(); toast('Cola de voz vaciada', '', 'success'); });

  $('addSongBtn').addEventListener('click', () => addManualSong('youtubeQueryInput'));
  $('dashboardAddSongBtn').addEventListener('click', () => addManualSong('dashboardSongInput'));
  $('youtubeQueryInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') addManualSong('youtubeQueryInput'); });
  $('dashboardSongInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') addManualSong('dashboardSongInput'); });
  $('openYouTubeHomeBtn').addEventListener('click', () => api.showYouTube().catch((error) => toast('No se pudo mostrar YouTube', error.message, 'error')));
  $('pauseSongBtn').addEventListener('click', () => (activeMusicProvider() === 'spotify' ? api.showSpotify() : api.showYouTube()).catch((error) => toast('No se pudo mostrar el reproductor', error.message, 'error')));
  $('songsShowYouTubeBtn').addEventListener('click', () => api.showYouTube().catch((error) => toast('No se pudo mostrar YouTube', error.message, 'error')));
  $('externalSongBtn').addEventListener('click', () => {
    if (activeMusicProvider() === 'spotify') { const query = state.spotifyPlayer.url || state.currentSpotify?.url || state.currentSpotify?.query || ''; api.openSpotifyExternal({ query }).catch((error) => toast('No se pudo abrir el enlace', error.message, 'error')); }
    else { const query = state.currentSong?.videoUrl || state.player.url || state.currentSong?.query || ''; api.openYouTubeExternal({ query, suffix: state.settings.youtubeSearchSuffix }).catch((error) => toast('No se pudo abrir el enlace', error.message, 'error')); }
  });
  $('playPauseSongBtn').addEventListener('click', () => (activeMusicProvider() === 'spotify' ? api.controlSpotify('toggle') : api.controlYouTube('toggle')).catch((error) => toast('Control no disponible', error.message, 'error')));
  $('songsPlayPauseBtn').addEventListener('click', () => api.controlYouTube('toggle').catch((error) => toast('Control no disponible', error.message, 'error')));
  $('previousSongBtn').addEventListener('click', () => (activeMusicProvider() === 'spotify' ? api.controlSpotify('previous') : api.controlYouTube('restart')).catch(() => {}));
  $('songsRestartBtn').addEventListener('click', () => api.controlYouTube('restart').catch(() => {}));
  $('skipSongBtn').addEventListener('click', () => skipActiveMusic().catch(() => {}));
  $('songsSkipBtn').addEventListener('click', skipCurrentSong);
  $('shuffleSongBtn').addEventListener('click', () => {
    const queue = activeMusicProvider() === 'spotify' ? state.spotifyQueue : state.songQueue;
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (activeMusicProvider() === 'spotify') renderSpotify(); else { renderPlayer(); renderSongs(); }
    renderDashboardMusic(); toast('Cola mezclada', '', 'success');
  });
  $('clearSongQueueBtn').addEventListener('click', () => { if (activeMusicProvider() === 'spotify') { state.spotifyQueue = []; renderSpotify(); } else { state.songQueue = []; renderPlayer(); renderSongs(); } renderDashboardMusic(); toast('Cola vaciada', 'La canción actual continúa.', 'success'); });
  $('youtubeVolumeInput').addEventListener('input', () => {
    const volume = clamp($('youtubeVolumeInput').value, 0, 1);
    if (activeMusicProvider() === 'spotify') { state.settings.spotifyVolume = volume; api.setSpotifyVolume(volume).catch(() => {}); }
    else { state.settings.youtubeVolume = volume; api.setYouTubeVolume(volume).catch(() => {}); }
    syncOutputs(); scheduleSave(); renderDashboardMusic();
  });
  $('continueRecommendedInput').addEventListener('change', () => {
    if (activeMusicProvider() === 'spotify') state.settings.spotifyContinueRecommended = $('continueRecommendedInput').checked;
    else syncRecommendedSetting($('continueRecommendedInput').checked);
    scheduleSave(); renderDashboardMusic();
  });
  $('songsContinueRecommendedInput').addEventListener('change', () => syncRecommendedSetting($('songsContinueRecommendedInput').checked));

  $('newCommandBtn').addEventListener('click', () => openCommandModal());
  $('dashboardNewCommandBtn')?.addEventListener('click', () => openCommandModal());
  $('closeCommandModalBtn').addEventListener('click', closeCommandModal);
  $('cancelCommandBtn').addEventListener('click', closeCommandModal);
  $('commandModal').addEventListener('click', (event) => { if (event.target === $('commandModal')) closeCommandModal(); });
  $('commandActionInput').addEventListener('change', updateCommandMediaFields);
  for (const eventName of ['input','change']) {
    for (const id of ['commandTriggerInput','commandActionInput','commandPermissionInput','commandCostInput']) $(id)?.addEventListener(eventName, updateCommandCreationPreview);
  }
  $('commandMediaVolumeInput')?.addEventListener('input', () => { if ($('commandMediaVolumeOutput')) $('commandMediaVolumeOutput').textContent = `${Math.round(clamp($('commandMediaVolumeInput').value,0,1)*100)}%`; });
  $('testCommandAudioBtn')?.addEventListener('click', () => testCommandAudio(draftCommandFromModal()));
  $('pickCommandMediaBtn').addEventListener('click', async () => {
    if ($('commandActionInput').value === 'sound') {
      openSoundLibrary({
        title:'Sonido del comando',
        selectedId:state.commandMediaDraft?.soundId,
        apply:(selected)=>{
          state.commandMediaDraft = { type:'audio', soundId:selected.soundId || '', url:selected.url || selected.mediaUrl || '', path:selected.path || selected.mediaPath || '', name:selected.name || selected.mediaName || 'Sonido' };
          $('commandMediaName').textContent = state.commandMediaDraft.name;
        }
      });
      return;
    }
    const selected = await api.pickMedia('image');
    if (!selected) return;
    state.commandMediaDraft = { ...selected, soundId:'' };
    $('commandMediaName').textContent = selected.name;
  });
  $('commandForm').addEventListener('submit', saveCommandFromModal);
  $('closeAutomationModalBtn')?.addEventListener('click', closeAutomationModal);
  $('cancelAutomationBtn')?.addEventListener('click', closeAutomationModal);
  $('automationModal')?.addEventListener('click', (event) => { if (event.target === $('automationModal')) closeAutomationModal(); });
  $('automationTriggerInput')?.addEventListener('change', updateAutomationComposer);
  $('automationActionInput')?.addEventListener('change', updateAutomationComposer);
  $('automationForm')?.addEventListener('submit', saveAutomationFromComposer);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('soundLibraryModal')?.classList.contains('hidden')) closeSoundLibrary();
    else if (!$('automationModal')?.classList.contains('hidden')) closeAutomationModal();
    else if (!$('commandModal')?.classList.contains('hidden')) closeCommandModal();
  });
  $('rankingSlotInput')?.addEventListener('change',switchRankingSlot);
  ['rankingTypeInput','rankingLimitInput','rankingStyleInput','rankingFontInput','rankingTextColorInput','rankingAccentColorInput','rankingSecondaryColorInput','rankingBackgroundColorInput','rankingRgbInput','rankingShowAvatarInput','rankingShowValueInput','rankingShowRankInput','rankingUppercaseInput'].forEach((id)=>$(id)?.addEventListener('change',collectRankingControls));
  ['rankingTitleInput','rankingBackgroundOpacityInput'].forEach((id)=>$(id)?.addEventListener('input',collectRankingControls));
  $('copyRankingUrlBtn')?.addEventListener('click',async()=>{const info=await api.copyRankingUrl(clamp($('rankingSlotInput').value,1,4));state.ranking={...state.ranking,...info};$('rankingUrlOutput').value=info.url||'HTTPS no disponible';if($('rankingLocalUrlOutput'))$('rankingLocalUrlOutput').value=info.localUrl||'';if(!info.url){toast('No se pudo crear HTTPS',info.tunnelMessage||'Revisa Internet o el firewall y vuelve a intentarlo.','error');return;}toast('Enlace HTTPS copiado','Pégalo en Agregar fuente → Enlace de TikTok LIVE Studio.','success');});
  $('copyRankingLocalUrlBtn')?.addEventListener('click',async()=>{const info=await api.copyRankingLocalUrl(clamp($('rankingSlotInput').value,1,4));if($('rankingLocalUrlOutput'))$('rankingLocalUrlOutput').value=info.localUrl||'';toast('Enlace local copiado','Úsalo como fuente de navegador en OBS. TikTok LIVE Studio requiere HTTPS.','success');});
  $('refreshRankingPreviewBtn')?.addEventListener('click',()=>refreshRankingInfo(null,true));
  $('resetRankingBtn')?.addEventListener('click',async()=>{const config=activeRankingConfig();if(config.type==='economy'){toast('Ranking de economía','Reinicia o modifica los saldos desde la sección Economía.','error');return;}if(!window.confirm(`¿Reiniciar todos los datos del ranking ${config.title}?`))return;await api.resetRanking(config.type);await refreshRankingInfo(null,true);toast('Ranking reiniciado',config.title,'success');});

  $('overlayScreenInput')?.addEventListener('change', () => refreshOverlayInfo());
  $('copyOverlayUrlBtn')?.addEventListener('click', async () => { const info = await api.copyOverlayUrl(clamp($('overlayScreenInput')?.value || 1,1,4)); state.overlay={...state.overlay,...info}; if ($('overlayUrlOutput')) $('overlayUrlOutput').value=info.url||'HTTPS no disponible'; if($('overlayLocalUrlOutput'))$('overlayLocalUrlOutput').value=info.localUrl||''; if(!info.url){toast('No se pudo crear HTTPS',info.tunnelMessage||'Revisa Internet o el firewall y vuelve a intentarlo.','error');return;} toast('Enlace HTTPS copiado', 'Pégalo en Agregar fuente → Enlace de TikTok LIVE Studio.', 'success'); });
  $('copyOverlayLocalUrlBtn')?.addEventListener('click', async () => { const info=await api.copyOverlayLocalUrl(clamp($('overlayScreenInput')?.value||1,1,4)); if($('overlayLocalUrlOutput'))$('overlayLocalUrlOutput').value=info.localUrl||''; toast('Enlace local copiado','Úsalo como fuente de navegador en OBS. TikTok LIVE Studio requiere HTTPS.','success'); });
  $('refreshOverlayBtn')?.addEventListener('click', () => refreshOverlayInfo());
  $('testOverlayBtn')?.addEventListener('click', testStreamOverlay);
  $('clearOverlayBtn')?.addEventListener('click', async () => { await api.clearOverlay(clamp($('overlayScreenInput')?.value || 1,1,4)); });


  qsa('input[name="musicPermissionMode"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    state.settings.musicPermissionMode = input.value;
    scheduleSave(); renderPermissions();
  }));
  qsa('input[name="ttsPermissionMode"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    state.settings.ttsPermissionMode = input.value;
    scheduleSave(); renderPermissions();
  }));
  qsa('input[name="musicProvider"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    applyMusicProvider(input.value);
    scheduleSave();
  }));
  $('minimumMemberLevelInput').addEventListener('input', () => {
    state.settings.minimumMemberLevel = clamp($('minimumMemberLevelInput').value, 1, 50);
    scheduleSave(); renderPermissions();
  });
  $('minimumTtsMemberLevelInput').addEventListener('input', () => {
    state.settings.minimumTtsMemberLevel = clamp($('minimumTtsMemberLevelInput').value, 1, 50);
    scheduleSave(); renderPermissions();
  });
  $('addAllowedUserBtn').addEventListener('click', () => addAllowedUser('music'));
  $('allowedUserInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') addAllowedUser('music'); });
  $('addAllowedTtsUserBtn').addEventListener('click', () => addAllowedUser('tts'));
  $('allowedTtsUserInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') addAllowedUser('tts'); });
  $('addCustomVoiceBtn').addEventListener('click', addUserVoiceRule);
  $('customVoiceUserInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') addUserVoiceRule(); });

  $('clearEventsBtn')?.addEventListener('click',()=>{state.liveEvents=[];renderLiveEvents();});
  for (const key of ['eventTtsEnabled','eventGiftEnabled','eventFollowEnabled','eventLikeEnabled','eventShareEnabled','eventMemberEnabled','eventSubscribeEnabled']) {
    $(key+'Input')?.addEventListener('change',()=>{state.settings[key]=$(key+'Input').checked;scheduleSave();});
  }
  $('pickEventSoundBtn')?.addEventListener('click', async () => {
    openSoundLibrary({
      title:'Sonido de evento',
      selectedId:state.eventMediaDraft?.soundId,
      apply:(selected)=>{
        state.eventMediaDraft = { type:'audio', soundId:selected.soundId || '', url:selected.url || selected.mediaUrl || '', path:selected.path || selected.mediaPath || '', name:selected.name || selected.mediaName || 'Sonido' };
        $('eventSoundName').textContent = state.eventMediaDraft.name;
      }
    });
  });
  $('eventSoundVolumeInput')?.addEventListener('input', () => {
    const value = clamp($('eventSoundVolumeInput').value, 0, 1);
    if ($('eventSoundVolumeOutput')) $('eventSoundVolumeOutput').textContent = `${Math.round(value * 100)}%`;
  });
  $('testEventSoundBtn')?.addEventListener('click', () => {
    if (!state.eventMediaDraft?.url) { toast('Falta el sonido', 'Elige un archivo de audio.', 'error'); return; }
    const draft = { ...state.eventMediaDraft, mediaUrl:state.eventMediaDraft.url, mediaName:state.eventMediaDraft.name, mediaVolume:clamp($('eventSoundVolumeInput')?.value ?? 0.9,0,1) };
    const queued = queueMediaSound(draft, { lockKey:'test-event-draft', label:'Prueba de sticker o evento' });
    if (!queued.accepted) { toast('Audio ocupado', 'Espera a que termine la prueba anterior.', 'error'); return; }
    toast('Prueba en cola', `${draft.mediaName} · ${Math.round(draft.mediaVolume*100)}%`, 'success');
  });
  $('addEventMediaRuleBtn')?.addEventListener('click', () => {
    if (!state.eventMediaDraft?.url) { toast('Falta el sonido', 'Elige un archivo de audio.', 'error'); return; }
    const rules = normalizedEventMediaRules();
    rules.push({ id:`event-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`, type:$('eventRuleTypeInput').value, match:$('eventRuleMatchInput').value.trim(), soundId:state.eventMediaDraft.soundId || '', mediaUrl:state.eventMediaDraft.url, mediaPath:state.eventMediaDraft.path, mediaName:state.eventMediaDraft.name, mediaVolume:clamp($('eventSoundVolumeInput')?.value ?? 0.9,0,1), enabled:true });
    state.settings.eventMediaRules = rules;
    state.eventMediaDraft = null;
    $('eventRuleMatchInput').value = '';
    $('eventSoundName').textContent = 'Ningún sonido elegido';
    scheduleSave(); renderEventMediaRules(); toast('Regla guardada', 'El sonido se activará cuando coincida el evento.', 'success');
  });
  $('copyDiscordBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('Luluvcupidx');toast('Usuario copiado','Luluvcupidx','success');}catch{toast('Discord','Luluvcupidx','info');}});
  const addSpotify=()=>{const input=$('spotifyQueryInput');if(!input)return;if(enqueueSpotify(input.value,'Manual'))input.value='';};
  $('addSpotifyBtn')?.addEventListener('click',addSpotify);
  $('spotifyQueryInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')addSpotify();});
  $('showSpotifyBtn')?.addEventListener('click',()=>api.showSpotify().catch(e=>toast('No se pudo mostrar Spotify Web',e.message,'error')));
  $('showSpotifyDesktopBtn')?.addEventListener('click',()=>api.openSpotifyDesktop({query:state.currentSpotify?.query||state.spotifyPlayer.title||''}).catch(e=>toast('No se pudo abrir Spotify',e.message,'error')));
  $('spotifyPlayPauseBtn')?.addEventListener('click',()=>api.controlSpotify('toggle').catch(()=>{}));
  $('spotifyNextBtn')?.addEventListener('click',()=>{if(state.spotifyQueue.length)finishSpotify('skipped');else api.controlSpotify('next').catch(()=>{});});
  $('spotifyPreviousBtn')?.addEventListener('click',()=>api.controlSpotify('previous').catch(()=>{}));
  $('spotifyExternalBtn')?.addEventListener('click',()=>api.openSpotifyExternal({query:state.spotifyPlayer.url||state.currentSpotify?.query||''}).catch(()=>{}));
  $('clearSpotifyQueueBtn')?.addEventListener('click',()=>{state.spotifyQueue=[];renderSpotify();});
  $('spotifyVolumeInput')?.addEventListener('input',()=>{const input=$('spotifyVolumeInput');if(!input)return;state.settings.spotifyVolume=clamp(input.value,0,1);syncOutputs();scheduleSave();api.setSpotifyVolume(state.settings.spotifyVolume).catch(()=>{});});
  $('spotifyRecommendedInput')?.addEventListener('change',()=>{const input=$('spotifyRecommendedInput');if(!input)return;state.settings.spotifyContinueRecommended=input.checked;scheduleSave();});

  $('economyEnabledInput')?.addEventListener('change',()=>{state.settings.economyEnabled=$('economyEnabledInput').checked;scheduleSave();renderEconomy();});
  $('currencyNameInput')?.addEventListener('input',()=>{state.settings.currencyName=$('currencyNameInput').value.trim().slice(0,24)||'Lunitas';scheduleSave();renderCommands();});
  $('currencySymbolInput')?.addEventListener('input',()=>{state.settings.currencySymbol=$('currencySymbolInput').value.trim().slice(0,4);scheduleSave();renderCommands();});
  $('economyStartingBalanceInput')?.addEventListener('input',()=>{state.settings.economyStartingBalance=Math.max(0,Math.round(Number($('economyStartingBalanceInput').value||0)));scheduleSave();});
  $('refreshEconomyBtn')?.addEventListener('click',refreshEconomy);
  $('economyUseLiveUserBtn')?.addEventListener('click',()=>{$('economyUserInput').value=normalizeUser(state.settings.username||$('usernameInput').value);lookupEconomyUser(false);});
  $('economyUserInput')?.addEventListener('change',()=>lookupEconomyUser(false));
  $('economyAddBtn')?.addEventListener('click',()=>adjustEconomyUser('add'));
  $('economyRemoveBtn')?.addEventListener('click',()=>adjustEconomyUser('remove'));
  $('economySetBtn')?.addEventListener('click',()=>adjustEconomyUser('set'));
  bindAutomationSoundLibrary();
  bindAutomationStudio();
  $('liveGamesEnabledInput')?.addEventListener('change',()=>{state.settings.liveGamesEnabled=$('liveGamesEnabledInput').checked;scheduleSave();renderLiveGames();});
  for (const [id,key,min] of [['liveGamesMinBetInput','liveGamesMinBet',1],['liveGamesMaxBetInput','liveGamesMaxBet',1],['liveGamesDefaultBetInput','liveGamesDefaultBet',1],['liveGamesCooldownInput','liveGamesCooldownSeconds',0]]) {
    $(id)?.addEventListener('change',()=>{state.settings[key]=Math.max(min,Math.round(Number($(id).value||min)));if(state.settings.liveGamesMaxBet<state.settings.liveGamesMinBet)state.settings.liveGamesMaxBet=state.settings.liveGamesMinBet;if(state.settings.liveGamesDefaultBet<state.settings.liveGamesMinBet)state.settings.liveGamesDefaultBet=state.settings.liveGamesMinBet;if(state.settings.liveGamesDefaultBet>state.settings.liveGamesMaxBet)state.settings.liveGamesDefaultBet=state.settings.liveGamesMaxBet;scheduleSave();renderLiveGames();});
  }
  $('liveGamesSpeakResultsInput')?.addEventListener('change',()=>{state.settings.liveGamesSpeakResults=$('liveGamesSpeakResultsInput').checked;scheduleSave();});
  $('liveGamesChatResultsInput')?.addEventListener('change',()=>{state.settings.liveGamesChatResults=$('liveGamesChatResultsInput').checked;scheduleSave();});
  $('copyGameWidgetUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('game',false));
  $('copyGameWidgetLocalUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('game',true));
  $('refreshGameWidgetBtn')?.addEventListener('click',()=>refreshStreamWidgetInfo('game',true));
  $('copyPlaylistWidgetUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('playlist',false));
  $('copyPlaylistWidgetLocalUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('playlist',true));
  $('refreshPlaylistWidgetBtn')?.addEventListener('click',()=>{schedulePlaylistWidgetSync();refreshStreamWidgetInfo('playlist',true);});
  $('copyWalletWidgetUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('wallet',false));
  $('copyWalletWidgetLocalUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('wallet',true));
  $('refreshWalletWidgetBtn')?.addEventListener('click',()=>refreshStreamWidgetInfo('wallet',true));

  $('checkUpdatesBtn').addEventListener('click', async () => {
    renderUpdateStatus({ status: 'checking', currentVersion: $('versionLabel').textContent.replace(/^v/, '') });
    const result = await api.checkForUpdates(true);
    if (result?.status) renderUpdateStatus(result);
  });
  $('installUpdateBtn').addEventListener('click', () => api.installUpdate());
  $('rollbackVersionBtn')?.addEventListener('click', async () => { if(!window.confirm('¿Regresar a Lulu Finity 0.27.0? Se abrirá el instalador oficial de esa versión.'))return; try{await api.rollbackToV027();toast('Regresar a 0.27','Se abrió la descarga oficial. Cierra Lulu e instala 0.27.0.','info');}catch(error){toast('No se pudo abrir 0.27',error.message||String(error),'error');} });
  $('openRepositoryBtn').addEventListener('click', () => api.openUpdateRepository().catch((error) => toast('No se pudo abrir GitHub', error.message, 'error')));
  $('exportSettingsBtn').addEventListener('click', async () => {
    const summary = JSON.stringify({
      version: $('versionLabel').textContent,
      voice: selectedVoiceValue(),
      musicProvider: activeMusicProvider(),
      musicPermissionMode: state.settings.musicPermissionMode,
      ttsPermissionMode: state.settings.ttsPermissionMode,
      economy: { enabled:state.settings.economyEnabled, currencyName:state.settings.currencyName, currencySymbol:state.settings.currencySymbol, rewards:normalizedEconomyRewards() },
      liveGames: { enabled:state.settings.liveGamesEnabled, minBet:state.settings.liveGamesMinBet, maxBet:state.settings.liveGamesMaxBet, defaultBet:state.settings.liveGamesDefaultBet, cooldownSeconds:state.settings.liveGamesCooldownSeconds, commands:normalizedLiveGameCommands().map(({id,trigger,enabled})=>({id,trigger,enabled})) },
      rankings: normalizedRankingOverlays(),
      tiktokAutoChat: { enabled:state.settings.tiktokAutoChatEnabled, cooldownSeconds:state.settings.tiktokAutoChatCooldownSeconds, triggers:Object.fromEntries(Object.entries(TIKTOK_AUTO_CHAT_EVENTS).map(([key,[enabledKey]])=>[key,Boolean(state.settings[enabledKey])])) },
      customVoiceUsers: normalizedUserVoiceRules().map(({ user, voice, rate, pitch, volume }) => ({ user, voice, rate, pitch, volume })),
      customCommands: normalizedCommands().map(({ trigger, action, permission, enabled, cost }) => ({ trigger, action, permission, enabled, cost }))
    }, null, 2);
    try { await navigator.clipboard.writeText(summary); toast('Resumen copiado', '', 'success'); }
    catch { toast('No se pudo copiar', summary, 'error'); }
  });

  api.onLiveEvent((payload)=>processLiveEvent(payload));
  api.onSpotifyStatus((payload)=>{state.spotifyOpen=Boolean(payload?.open);state.spotifyVisible=Boolean(payload?.visible);state.spotifyMuted=Boolean(payload?.muted);renderSpotify();});
  api.onSpotifySelected((payload)=>{if(!state.currentSpotify)return;state.currentSpotify.title=payload?.title||state.currentSpotify.query;state.currentSpotify.artist=payload?.artist||'';state.currentSpotify.url=payload?.url||'';state.spotifyPlayer={...state.spotifyPlayer,title:state.currentSpotify.title,artist:state.currentSpotify.artist,url:state.currentSpotify.url};renderSpotify();});
  api.onSpotifyPlayer((payload)=>{state.spotifyPlayer={...state.spotifyPlayer,...payload};renderSpotify();});
  api.onSpotifyEnded(()=>{if(state.currentSpotify)finishSpotify('ended');else if(state.settings.spotifyContinueRecommended!==false) renderSpotify();});
  api.onSpotifyUnavailable(async (payload)=>{
    const query=state.currentSpotify?.query||'';
    toast('Spotify Web no respondió',payload?.message||'Se abrirá la aplicación de Spotify.','error');
    if(query) await api.openSpotifyDesktop({query}).catch(()=>{});
    finishSpotify('skipped');
  });
  api.onSpotifyError(async (payload)=>{
    toast('Error de Spotify Web',payload?.message||'Se intentará abrir Spotify instalado.','error');
    await api.openSpotifyDesktop({query:state.currentSpotify?.query||''}).catch(()=>{});
  });
  api.onTikTokChatStatus((payload) => renderTikTokChatStatus(payload));
  api.onUpdateStatus((payload) => renderUpdateStatus(payload));
  api.onOverlayStatus((payload) => { if (!payload) return; state.overlay={...state.overlay,...payload}; if (['rankings','commands'].includes(state.activePage) && Number(payload.screen)===Number($('overlayScreenInput')?.value||1)) refreshOverlayInfo(payload.screen); });
  api.onOverlayTunnelStatus((payload)=>{if(!payload)return;const ready=payload.status==='ready'&&payload.url;if($('overlayHttpsStatus')){$('overlayHttpsStatus').textContent=payload.message||'';$('overlayHttpsStatus').classList.toggle('ready',Boolean(ready));$('overlayHttpsStatus').classList.toggle('error',payload.status==='error');}if($('rankingHttpsStatus')){$('rankingHttpsStatus').textContent=payload.message||'';$('rankingHttpsStatus').classList.toggle('ready',Boolean(ready));$('rankingHttpsStatus').classList.toggle('error',payload.status==='error');}if(ready&&state.activePage==='rankings'){refreshOverlayInfo();refreshRankingInfo(null,false);refreshStreamWidgetInfo('playlist',false);refreshStreamWidgetInfo('wallet',false);}if(ready&&state.activePage==='games')refreshStreamWidgetInfo('game',false);if(ready&&state.activePage==='automations')for(const type of ['alert','goal','gift'])refreshStreamWidgetInfo(type,false);});
  api.onRankingStatus((payload)=>{if(!payload)return;state.ranking={...state.ranking,...payload};if(state.activePage==='rankings'&&Number(payload.slot)===Number($('rankingSlotInput')?.value||1))refreshRankingInfo(payload.slot,false);});
  api.onRankingUpdate((payload)=>{const snapshot=payload?.snapshots?.find((item)=>Number(item.slot)===Number(state.ranking.slot));if(snapshot)state.ranking.snapshot=snapshot;renderStudioDashboard();});
  api.onStreamWidgetStatus((payload)=>{if(!payload?.widget)return;state.streamWidgets[payload.widget]={...state.streamWidgets[payload.widget],...payload};const pageByWidget={playlist:'rankings',wallet:'rankings',game:'games',alert:'automations',goal:'automations',gift:'automations'};if(state.activePage===pageByWidget[payload.widget])refreshStreamWidgetInfo(payload.widget,false);});
  api.onStreamWidgetUpdate((payload)=>{if(!payload?.widget)return;state.streamWidgets[payload.widget]={...state.streamWidgets[payload.widget],snapshot:payload.snapshot};});
  api.onLiveGameResult((payload)=>announceLiveGameResult(payload));
  api.onChat((message) => processChat(message));
  api.onStatus((payload) => setStatus(payload));
  api.onStats((payload) => { if(payload?.viewerCount!==undefined) state.viewerCount=Number(payload.viewerCount||0); if(payload?.totalLikeCount!==undefined) state.eventCounters.likes=Math.max(state.eventCounters.likes,Number(payload.totalLikeCount||0)); renderStats(); renderLiveEvents(); });
  api.onError((payload) => toast('Error del conector', payload?.message || 'Error desconocido', 'error'));
  api.onYouTubeStatus((payload) => {
    state.youtubeOpen = Boolean(payload?.open);
    state.youtubeVisible = Boolean(payload?.visible);
    state.youtubeMuted = Boolean(payload?.muted);
    renderPlayer();
  });
  api.onYouTubeSelected((payload) => {
    if (!state.currentSong) return;
    state.currentSong.selectedTitle = payload?.title || state.currentSong.query;
    state.currentSong.videoUrl = payload?.url || '';
    state.player.title = state.currentSong.selectedTitle;
    state.player.url = state.currentSong.videoUrl;
    enforceCurrentSongRules({ title: state.currentSong.selectedTitle, url: state.currentSong.videoUrl });
    renderPlayer(); renderSongs();
  });
  api.onYouTubePlayer((payload) => {
    const expectedVideo = youtubeVideoId(state.currentSong?.videoUrl || '');
    const actualVideo = youtubeVideoId(payload?.url || '');
    if (expectedVideo && actualVideo && expectedVideo !== actualVideo && !state.youtubeTransitioning && !state.currentSong?.isRecommendation) {
      if (!state.handlingExternalYoutubeSkip) {
        state.handlingExternalYoutubeSkip = true;
        Promise.resolve(finishCurrentSong('youtube-native-next')).finally(() => { state.handlingExternalYoutubeSkip = false; });
      }
      return;
    }
    state.player = { ...state.player, ...payload };
    enforceCurrentSongRules(payload);
    if (state.currentSong?.isRecommendation && payload?.title) {
      state.currentSong.selectedTitle = payload.title;
      state.currentSong.videoUrl = payload.url || '';
    }
    renderPlayer(); renderSongs();
  });
  api.onYouTubeEnded(() => finishCurrentSong('ended'));
  api.onYouTubeUnavailable((payload) => {
    toast('Canción omitida', payload?.message || 'No se encontró un video reproducible.', 'error');
    finishCurrentSong('unavailable');
  });
  api.onYouTubeError((payload) => toast('Error de YouTube', payload?.message || 'No se pudo cargar la página.', 'error'));
}

function renderReleaseNotes(target, notes) {
  if (!target) return;
  const cards = notes.map((note) => {
    const card = document.createElement('article');
    card.className = 'release-note-item';
    const icon = document.createElement('span');
    icon.className = 'release-note-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = note.icon;
    const copy = document.createElement('div');
    copy.className = 'release-note-copy';
    const title = document.createElement('strong');
    title.textContent = note.title;
    const text = document.createElement('small');
    text.textContent = note.text;
    copy.append(title, text);
    card.append(icon, copy);
    return card;
  });
  target.replaceChildren(...cards);
}

function setupReleaseNotices(currentVersion) {
  const policy = window.releaseNoticePolicy;
  if (!policy?.releaseNoticeMode) {
    console.warn('No se pudo cargar la política de avisos de versión.');
    return;
  }
  const version = policy.normalizeVersion(currentVersion);
  const mode = policy.releaseNoticeMode({
    currentVersion: version,
    firstInstalledVersion: state.settings?.firstInstalledVersion,
    lastSeenVersion: state.settings?.lastSeenVersion
  });
  if (mode === 'none') return;

  const install = mode === 'install';
  const modal = $(install ? 'installWelcomeModal' : 'updateWelcomeModal');
  const actionButton = $(install ? 'startInstallWelcomeBtn' : 'startUpdate3Btn');
  const closeButton = $(install ? 'closeInstallWelcomeBtn' : 'closeUpdateWelcomeBtn');
  const versionLabel = $(install ? 'installWelcomeVersion' : 'updateWelcomeVersion');
  const notes = RELEASE_NOTES[version] || [{ icon:'✦', title:'Versión instalada', text:'Consulta Actualizaciones para ver el estado de esta versión.' }];
  if (!modal || !actionButton || !closeButton || !version) return;

  if (versionLabel) versionLabel.textContent = `v${version}`;
  renderReleaseNotes($(install ? 'installReleaseNotes' : 'updateReleaseNotes'), install ? notes.slice(0, 3) : notes);
  if (!install) {
    const previous = policy.normalizeVersion(state.settings?.lastSeenVersion);
    const path = $('updateVersionPath');
    if (path) {
      const from = document.createElement('span');
      from.textContent = previous ? `v${previous}` : 'Versión anterior';
      const arrow = document.createElement('i');
      arrow.textContent = '→';
      arrow.setAttribute('aria-hidden', 'true');
      const current = document.createElement('strong');
      current.textContent = `v${version}`;
      path.replaceChildren(from, arrow, current);
    }
  }

  let closing = false;
  const focusable = () => [...modal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      void close();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = focusable();
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const close = async () => {
    if (closing) return;
    closing = true;
    modal.classList.add('hidden');
    modal.removeEventListener('keydown', onKeyDown);
    state.settings.lastSeenVersion = version;
    try { state.settings = await api.saveSettings(state.settings); }
    catch (error) { console.warn('No se pudo guardar el aviso de versión:', error?.message || error); }
  };
  actionButton.addEventListener('click', close, { once:true });
  closeButton.addEventListener('click', close, { once:true });
  modal.addEventListener('click', (event) => { if (event.target === modal) void close(); });
  modal.addEventListener('keydown', onKeyDown);
  modal.classList.remove('hidden');
  requestAnimationFrame(() => actionButton.focus());
}

async function init() {
  ensureV010Ui();
  setupNavigation();
  const initial = await api.getState();
  state.settings = initial.settings;
  try { await loadDefaultSounds(); }
  catch (error) { state.defaultSounds = []; console.warn('La biblioteca de sonidos se cargará después:', error?.message || error); }
  let migratedV100=false;
  if(!state.settings.luluLocalMigratedV100){state.settings.smartTextEnabled=state.settings.smartTextEnabled!==false;state.settings.blockCjkText=state.settings.blockCjkText!==false;state.settings.blockMixedScripts=state.settings.blockMixedScripts!==false;state.settings.stripUsernameEmoji=state.settings.stripUsernameEmoji!==false;state.settings.pronunciationDictionary=Array.isArray(state.settings.pronunciationDictionary)?state.settings.pronunciationDictionary:[{from:'xd',to:'equis de'}];state.settings.performanceProfile=['saving','balanced','instant'].includes(state.settings.performanceProfile)?state.settings.performanceProfile:'balanced';state.settings.luluLocalMigratedV100=true;migratedV100=true;}
  let migratedTikTokVoices=false;
  if(state.settings.localVoiceId==='lulu-official'){state.settings.voiceMode='online';state.settings.onlineVoice=state.settings.onlineVoice||'es-MX-DaliaNeural';migratedTikTokVoices=true;}
  if(!state.settings.tiktokVoice)state.settings.tiktokVoice='es_mx_002';
  if(!state.settings.onlineVoice)state.settings.onlineVoice='es-MX-DaliaNeural';
  state.settings.userVoiceRules=(Array.isArray(state.settings.userVoiceRules)?state.settings.userVoiceRules:[]).map((rule)=>rule?.voice==='local:lulu-official'?{...rule,voice:`online:${state.settings.onlineVoice}`}:rule);
  setupAudioActivityIndicators();
  state.economy = initial.economy || { balances: [], ledger: [] };
  state.overlay = initial.overlay || state.overlay;
  state.ranking = initial.ranking || state.ranking;
  state.streamWidgets = initial.widgets || state.streamWidgets;
  let migratedVoiceCatalog = false;
  if (!state.settings.voiceCatalogExpandedV013) {
    if (!state.settings.voiceLanguageFilter || state.settings.voiceLanguageFilter === 'es') state.settings.voiceLanguageFilter = 'all';
    state.settings.voiceCatalogExpandedV013 = true;
    migratedVoiceCatalog = true;
  }
  let migratedDefaultCommands = false;
  if (!state.settings.defaultCommandsDisabledV012) {
    const defaultIds = new Set(['song','skip','voice','hello','balance','revoke']);
    state.settings.customCommands = (Array.isArray(state.settings.customCommands) ? state.settings.customCommands : []).map((command) => defaultIds.has(String(command?.id || '')) ? { ...command, enabled: false } : command);
    state.settings.defaultCommandsDisabledV012 = true;
    migratedDefaultCommands = true;
  }
  if (!state.settings.economyMigratedV014) {
    const commands = Array.isArray(state.settings.customCommands) ? state.settings.customCommands : [];
    if (!commands.some((command)=>String(command.id)==='balance')) commands.push({id:'balance',trigger:'!saldo',action:'balance',response:'',permission:'all',enabled:false,cost:0});
    if (!commands.some((command)=>String(command.id)==='revoke')) commands.push({id:'revoke',trigger:'!revoke',action:'revoke',response:'',permission:'all',enabled:false,cost:0});
    state.settings.customCommands = commands;
    state.settings.economyMigratedV014 = true;
    migratedDefaultCommands = true;
  }
  if (!state.settings.giftRewardsMigratedV019) {
    const rewards = state.settings.economyRewards && typeof state.settings.economyRewards === 'object' ? state.settings.economyRewards : {};
    const previousGift = rewards.gift && typeof rewards.gift === 'object' ? rewards.gift : {};
    rewards.gift = { enabled:true, amount:Math.max(0,Math.round(Number(previousGift.amount ?? 1))), every:Math.max(1,Math.round(Number(previousGift.every ?? 1))) };
    state.settings.economyRewards = rewards;
    state.settings.giftRewardsMigratedV019 = true;
    migratedDefaultCommands = true;
  }
  state.settings.economyRewards = normalizedEconomyRewards();
  state.settings.rankingOverlays = normalizedRankingOverlays();
  state.settings.streamWidgetThemes = normalizedStreamWidgetThemes();
  state.settings.streamWidgetBackgrounds = normalizedStreamWidgetBackgrounds();
  state.settings.streamWidgetStyles = normalizedStreamWidgetStyles();
  state.settings.customCommands = normalizedCommands();
  state.settings.eventMediaRules = normalizedEventMediaRules();
  state.settings.automationRules = normalizedAutomationRules();
  state.settings.musicProvider = state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';
  state.settings.allowedMusicUsers = Array.isArray(state.settings.allowedMusicUsers) ? state.settings.allowedMusicUsers : [];
  state.settings.allowedTtsUsers = Array.isArray(state.settings.allowedTtsUsers) ? state.settings.allowedTtsUsers : [];
  state.settings.userVoiceRules = Array.isArray(state.settings.userVoiceRules) ? state.settings.userVoiceRules : [];
  state.settings.blockedSongs = Array.isArray(state.settings.blockedSongs) ? state.settings.blockedSongs : [];
  state.settings.blockedChannels = Array.isArray(state.settings.blockedChannels) ? state.settings.blockedChannels : [];
  state.settings.hiddenDashboardPanels = Array.isArray(state.settings.hiddenDashboardPanels) ? state.settings.hiddenDashboardPanels : [];
  state.settings.liveGameCommands = Array.isArray(state.settings.liveGameCommands) ? state.settings.liveGameCommands : LIVE_GAME_DEFINITIONS.map(({id,trigger})=>({id,trigger,enabled:true}));
  state.player.volume = clamp(state.settings.youtubeVolume ?? 0.8, 0, 1);
  $('versionLabel').textContent = `v${initial.version}`;
  populateSettings();
  // Los catálogos TTS y las voces de Windows se cargan al abrir Voz.
  renderUpdateStatus({ status: 'idle', currentVersion: initial.version });
  renderComments();
  renderPlayer();
  renderSongs();
  renderStats();
  renderCommands();
  state.ranking.slot = clamp(state.ranking?.slot || 1,1,4);
  setRankingControlValues();
  renderPermissions();
  renderUserVoiceRules();
  renderEventMediaRules();
  renderDetectedFanStickers();
  renderEconomy();
  renderLiveGames();
  renderAutomationStudio();
  renderDashboardMusic();
  if (migratedV100||migratedTikTokVoices||migratedDefaultCommands || migratedVoiceCatalog || !state.settings.rankingsMigratedV016 || !state.settings.streamWidgetsMigratedV019) { state.settings.rankingsMigratedV016=true; state.settings.streamWidgetsMigratedV019=true; state.settings = await api.saveSettings(state.settings); }
  setStatus({ status: 'disconnected' });
  setupEvents();
  setupReleaseNotices(initial.version);
  // Ningún proveedor musical se crea hasta reproducir o mostrarlo.
  goToPage('dashboard', { activateModules:false, scroll:false });
  api.reportRendererReady();
}

init().catch((error) => {
  console.error(error);
  toast('Error al iniciar', error.message || String(error), 'error');
});
