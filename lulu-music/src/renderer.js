'use strict';

const api = window.luluMusic;
const policy = window.LuluMusicPolicy;
const $ = (id) => document.getElementById(id);

let appState = null;
let saveTimer = null;
let toastTimer = null;
let audiusNonce = 0;
let audiusStopping = false;
let lastAudiusProgressAt = 0;

const PROVIDER_LABELS = Object.freeze({ auto:'Automático', audius:'Audius', youtube:'YouTube' });
const PROVIDER_HINTS = Object.freeze({
  auto:'Prueba audio directo de Audius y usa YouTube si no hay una coincidencia exacta.',
  audius:'Usa un solo elemento de audio y nunca abre una página adicional.',
  youtube:'Usa el catálogo completo en un único reproductor oficial reutilizable.'
});

function providerLabel(value) {
  return PROVIDER_LABELS[String(value || '').toLowerCase()] || 'Automático';
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = String(message || '');
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setStatusMessage(element, message, kind = '') {
  element.textContent = String(message || '');
  element.classList.toggle('error', kind === 'error');
  element.classList.toggle('success', kind === 'success');
}

function renderLive(live = {}) {
  const status = String(live.status || 'offline');
  $('livePill').dataset.status = status;
  $('livePillText').textContent = status === 'connected' ? 'LIVE conectado' : status === 'connecting' ? 'Conectando…' : 'Sin conectar';
  $('connectBtn').classList.toggle('hidden', status === 'connected');
  $('disconnectBtn').classList.toggle('hidden', status !== 'connected');
  $('connectBtn').disabled = status === 'connecting';
  $('creatorUsername').disabled = status === 'connected' || status === 'connecting';
  setStatusMessage($('liveMessage'), live.message || 'Lista para conectarse a un LIVE.', status === 'error' ? 'error' : status === 'connected' ? 'success' : '');
}

function renderNow(playback = {}) {
  const current = playback.current;
  for (const id of ['playPauseBtn','restartBtn','skipBtn','showPlayerBtn']) $(id).disabled = !current;
  $('showPlayerBtn').textContent = current?.provider === 'audius' ? 'Ver en Audius' : 'Abrir reproductor';
  $('nowEmpty').classList.toggle('hidden', Boolean(current));
  $('nowContent').classList.toggle('hidden', !current);
  $('providerBadge').textContent = providerLabel(current?.provider || appState?.settings?.provider).toUpperCase();
  if (!current) {
    $('playPauseBtn').textContent = '▶';
    $('progressBar').style.width = '0%';
    return;
  }
  $('trackTitle').textContent = current.resolvedTitle || current.query || 'Canción';
  const requester = current.requestedBy ? `Pedida por ${current.requestedBy}` : 'Solicitud manual';
  $('trackMeta').textContent = current.artist ? `${current.artist} · ${requester}` : requester;
  $('trackStatus').textContent = playback.loading ? 'BUSCANDO' : playback.paused ? 'EN PAUSA' : 'REPRODUCIENDO';
  const duration = Number(playback.duration) || 0;
  const elapsed = Number(playback.currentTime) || 0;
  $('progressBar').style.width = duration > 0 ? `${Math.min(100, (elapsed / duration) * 100)}%` : '0%';
  $('currentTime').textContent = formatTime(elapsed);
  $('duration').textContent = duration > 0 ? formatTime(duration) : '--:--';
  $('playPauseBtn').textContent = playback.paused ? '▶' : 'Ⅱ';
}

function queueRow(item, index) {
  const row = document.createElement('li');
  row.className = 'queue-item';
  row.dataset.id = item.id;
  const number = document.createElement('span');
  number.className = 'queue-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const copy = document.createElement('div');
  copy.className = 'queue-copy';
  const title = document.createElement('strong');
  title.textContent = item.query || 'Canción';
  const meta = document.createElement('span');
  meta.textContent = item.requestedBy ? `@${String(item.requestedBy).replace(/^@/, '')} · ${providerLabel(item.provider)}` : `Manual · ${providerLabel(item.provider)}`;
  copy.append(title, meta);
  const actions = document.createElement('div');
  actions.className = 'queue-actions';
  [['up','↑','Subir'],['down','↓','Bajar'],['remove','×','Quitar']].forEach(([action, label, titleText]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-button';
    button.dataset.action = action;
    button.title = titleText;
    button.textContent = label;
    actions.appendChild(button);
  });
  row.append(number, copy, actions);
  return row;
}

function renderQueue(queue = []) {
  const list = $('queueList');
  list.replaceChildren(...queue.map(queueRow));
  $('queueEmpty').classList.toggle('hidden', queue.length > 0);
  list.classList.toggle('hidden', queue.length === 0);
  $('queueCount').textContent = `${queue.length} / ${appState?.settings?.queueLimit || 30}`;
  $('clearQueueBtn').disabled = queue.length === 0;
}

function renderSettings(settings = {}) {
  $('creatorUsername').value = settings.creatorUsername || '';
  $('musicCommand').value = settings.command || '!cancion';
  $('commandPreview').textContent = settings.command || '!cancion';
  $('musicProvider').value = settings.provider || 'auto';
  $('providerHint').textContent = PROVIDER_HINTS[$('musicProvider').value] || PROVIDER_HINTS.auto;
  $('requestPermission').value = settings.permission || 'all';
  $('queueLimit').value = String(settings.queueLimit || 30);
  $('selectedUsers').value = (settings.selectedUsers || []).join(', ');
  $('blockedTerms').value = (settings.blockedTerms || []).join(', ');
  $('preventDuplicates').checked = settings.preventDuplicates !== false;
  $('onePerUser').checked = settings.onePerUser !== false;
  $('continueRecommended').checked = Boolean(settings.continueRecommended);
  $('continueRecommended').disabled = settings.provider === 'audius';
  $('continueRecommended').closest('.toggle-card').classList.toggle('is-disabled', settings.provider === 'audius');
  $('volumeRange').value = String(Math.round((Number(settings.volume) || 0.8) * 100));
  $('volumeValue').textContent = `${$('volumeRange').value}%`;
  $('selectedUsersField').classList.toggle('hidden-field', settings.permission !== 'selected');
}

function renderState(next) {
  if (!next) return;
  const first = !appState;
  appState = next;
  $('appVersion').textContent = next.version || '1.0.0';
  renderLive(next.live);
  renderNow(next.playback);
  renderQueue(next.queue || []);
  if (first) renderSettings(next.settings);
}

function readSettingsForm() {
  return {
    creatorUsername: $('creatorUsername').value.trim().replace(/^@+/, ''),
    command: policy.normalizeMusicCommand($('musicCommand').value),
    provider: $('musicProvider').value,
    permission: $('requestPermission').value,
    queueLimit: Number($('queueLimit').value),
    selectedUsers: $('selectedUsers').value.split(',').map((item) => item.trim().replace(/^@+/, '')).filter(Boolean),
    blockedTerms: $('blockedTerms').value.split(',').map((item) => item.trim()).filter(Boolean),
    preventDuplicates: $('preventDuplicates').checked,
    onePerUser: $('onePerUser').checked,
    continueRecommended: $('continueRecommended').checked,
    volume: Number($('volumeRange').value) / 100
  };
}

function scheduleSettingsSave(immediate = false) {
  clearTimeout(saveTimer);
  const save = async () => {
    try {
      const result = await api.saveSettings(readSettingsForm());
      renderState(result);
      $('musicCommand').value = result.settings.command;
      $('commandPreview').textContent = result.settings.command;
      $('selectedUsersField').classList.toggle('hidden-field', result.settings.permission !== 'selected');
      $('providerHint').textContent = PROVIDER_HINTS[result.settings.provider] || PROVIDER_HINTS.auto;
      $('continueRecommended').disabled = result.settings.provider === 'audius';
      $('continueRecommended').closest('.toggle-card').classList.toggle('is-disabled', result.settings.provider === 'audius');
    } catch (error) {
      showToast(error.message || 'No se pudieron guardar los ajustes.');
    }
  };
  if (immediate) void save();
  else saveTimer = setTimeout(save, 350);
}

function reportAudius(type, extra = {}) {
  const audio = $('audiusPlayer');
  api.reportAudiusState({
    nonce:audiusNonce,
    type,
    currentTime:Number(audio.currentTime) || 0,
    duration:Number(audio.duration) || 0,
    ...extra
  });
}

function stopAudius() {
  const audio = $('audiusPlayer');
  audiusStopping = true;
  try { audio.pause(); } catch {}
  audio.removeAttribute('src');
  try { audio.load(); } catch {}
  audiusStopping = false;
}

function bindAudiusPlayer() {
  const audio = $('audiusPlayer');
  audio.addEventListener('loadedmetadata', () => reportAudius('loaded'));
  audio.addEventListener('playing', () => reportAudius('playing'));
  audio.addEventListener('pause', () => { if (!audiusStopping && audio.getAttribute('src') && !audio.ended) reportAudius('paused'); });
  audio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastAudiusProgressAt < 450) return;
    lastAudiusProgressAt = now;
    reportAudius('progress');
  });
  audio.addEventListener('ended', () => reportAudius('ended'));
  audio.addEventListener('error', () => {
    if (audiusStopping || !audio.getAttribute('src')) return;
    const code = Number(audio.error?.code) || 0;
    reportAudius('error', { message:code ? `error de audio ${code}` : 'el stream dejó de responder' });
  });
  api.onAudiusLoad(async (payload = {}) => {
    const streamUrl = String(payload.streamUrl || '');
    try {
      const parsed = new URL(streamUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.audius.co' || !/^\/v1\/tracks\/[A-Za-z0-9_-]+\/stream$/.test(parsed.pathname)) {
        throw new Error('dirección de audio rechazada');
      }
      stopAudius();
      audiusNonce = Number(payload.nonce) || 0;
      audio.volume = Math.max(0, Math.min(1, Number(payload.volume) || 0));
      audio.src = parsed.toString();
      audio.load();
      await audio.play();
    } catch (error) {
      reportAudius('error', { message:error?.message || 'no se pudo iniciar el audio' });
    }
  });
  api.onAudiusCommand((payload = {}) => {
    const action = String(payload.action || '');
    const nonce = Number(payload.nonce) || 0;
    if (action === 'stop') { if (!nonce || nonce === audiusNonce) stopAudius(); return; }
    if (nonce !== audiusNonce || !audio.getAttribute('src')) return;
    if (action === 'volume') audio.volume = Math.max(0, Math.min(1, Number(payload.value) || 0));
    if (action === 'toggle') { if (audio.paused) void audio.play().catch((error) => reportAudius('error', { message:error?.message })); else audio.pause(); }
    if (action === 'restart') { audio.currentTime = 0; void audio.play().catch((error) => reportAudius('error', { message:error?.message })); }
  });
}

function bindEvents() {
  $('connectForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = $('creatorUsername').value.trim();
    if (!username) return showToast('Escribe el usuario que está en LIVE.');
    setStatusMessage($('liveMessage'), 'Conectando con el LIVE…');
    try { await api.connectLive(username); }
    catch (error) { setStatusMessage($('liveMessage'), error.message, 'error'); }
  });
  $('disconnectBtn').addEventListener('click', () => api.disconnectLive().catch((error) => showToast(error.message)));
  $('manualSongForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = $('manualSongInput').value.trim();
    if (!query) return;
    try {
      const result = await api.addSong(query);
      $('manualSongInput').value = '';
      showToast(result.message || 'Canción agregada.');
    } catch (error) { showToast(error.message); }
  });
  $('queueList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    const row = button?.closest('.queue-item');
    if (!button || !row) return;
    try {
      if (button.dataset.action === 'remove') await api.removeSong(row.dataset.id);
      else await api.moveSong(row.dataset.id, button.dataset.action);
    } catch (error) { showToast(error.message); }
  });
  $('clearQueueBtn').addEventListener('click', () => api.clearQueue().catch((error) => showToast(error.message)));
  $('playPauseBtn').addEventListener('click', () => api.playerControl('toggle').catch((error) => showToast(error.message)));
  $('restartBtn').addEventListener('click', () => api.playerControl('restart').catch((error) => showToast(error.message)));
  $('skipBtn').addEventListener('click', () => api.playerControl('next').catch((error) => showToast(error.message)));
  $('showPlayerBtn').addEventListener('click', () => api.showPlayer().catch((error) => showToast(error.message)));
  $('volumeRange').addEventListener('input', () => {
    $('volumeValue').textContent = `${$('volumeRange').value}%`;
    void api.playerControl('volume', Number($('volumeRange').value) / 100);
    scheduleSettingsSave();
  });
  ['musicCommand','musicProvider','requestPermission','queueLimit','selectedUsers','blockedTerms','preventDuplicates','onePerUser','continueRecommended']
    .forEach((id) => $(id).addEventListener($(id).type === 'text' || $(id).type === 'number' ? 'input' : 'change', () => scheduleSettingsSave()));
  $('musicProvider').addEventListener('change', () => {
    const provider = $('musicProvider').value;
    $('providerHint').textContent = PROVIDER_HINTS[provider] || PROVIDER_HINTS.auto;
    $('continueRecommended').disabled = provider === 'audius';
    $('continueRecommended').closest('.toggle-card').classList.toggle('is-disabled', provider === 'audius');
  });
}

async function start() {
  bindAudiusPlayer();
  bindEvents();
  api.onState(renderState);
  api.onLiveStatus((live) => { if (appState) { appState.live = live; renderLive(live); } });
  api.onRequest((request) => {
    $('lastRequest').textContent = `${request.requestedBy || 'Manual'} pidió “${request.query}”.`;
    showToast(`Nueva solicitud: ${request.query}`);
  });
  api.onNotice((notice) => showToast(notice?.message || notice));
  try {
    renderState(await api.getState());
  } catch (error) {
    showToast(error.message || 'No se pudo iniciar Lulu Music.');
  }
}

void start();
