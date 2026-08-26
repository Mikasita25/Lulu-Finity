'use strict';

(() => {
  const api = window.voiceStudio;
  if (!api) return;

  const SAMPLE_EVENTS = Object.freeze({
    comment: { icon: '💬', title: 'Usuario 1', meta: '@usuario1', text: 'Hola Lulu, esta es una prueba del chat.' },
    gift: { icon: '🎁', title: 'Usuario 2', meta: 'Regalo · Rosa ×5', text: 'Envió un regalo de prueba.' },
    like: { icon: '♡', title: 'Usuario 3', meta: 'Tap taps', text: 'Mandó 250 likes al LIVE.' },
    follow: { icon: '＋', title: 'Usuario 4', meta: 'Nuevo follow', text: 'Comenzó a seguir la cuenta.' },
    goal: { icon: '◎', title: 'Meta', meta: '725 / 1,000 likes', text: 'La meta va al 73%.' }
  });

  const SOURCES = Object.freeze([
    { id: 'wallet', label: 'Usuario 1', detail: 'Saldo / usuario', kind: 'widget', value: 'wallet' },
    { id: 'goal', label: 'Meta', detail: 'Meta del LIVE', kind: 'widget', value: 'goal' },
    { id: 'gift', label: 'Regalo', detail: 'Actividad de regalos', kind: 'widget', value: 'gift' },
    { id: 'alert', label: 'Alerta', detail: 'Alertas automáticas', kind: 'widget', value: 'alert' },
    { id: 'playlist', label: 'Música', detail: 'Canción y cola', kind: 'widget', value: 'playlist' },
    { id: 'game', label: 'Juego', detail: 'Ruleta / juegos', kind: 'widget', value: 'game' },
    { id: 'ranking-1', label: 'Ranking 1', detail: 'Top de ejemplo', kind: 'ranking', value: 1 },
    { id: 'ranking-2', label: 'Ranking 2', detail: 'Top de ejemplo', kind: 'ranking', value: 2 },
    { id: 'ranking-3', label: 'Ranking 3', detail: 'Top de ejemplo', kind: 'ranking', value: 3 },
    { id: 'ranking-4', label: 'Ranking 4', detail: 'Top de ejemplo', kind: 'ranking', value: 4 },
    { id: 'overlay-1', label: 'Superposición 1', detail: 'Salida real local', kind: 'overlay', value: 1 },
    { id: 'overlay-2', label: 'Superposición 2', detail: 'Salida real local', kind: 'overlay', value: 2 },
    { id: 'overlay-3', label: 'Superposición 3', detail: 'Salida real local', kind: 'overlay', value: 3 },
    { id: 'overlay-4', label: 'Superposición 4', detail: 'Salida real local', kind: 'overlay', value: 4 }
  ]);

  let currentSource = 'wallet';
  let eventCounter = 0;

  function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function activatePage() {
    if (typeof window.goToPage === 'function') {
      window.goToPage('preview');
      return;
    }
    document.querySelectorAll('.main-content > .page').forEach((page) => {
      const active = page.id === 'page-preview';
      page.classList.toggle('active', active);
      page.hidden = !active;
      page.inert = !active;
      page.setAttribute('aria-hidden', String(!active));
    });
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === 'preview'));
  }

  function appendEvent(feed, type) {
    const sample = SAMPLE_EVENTS[type] || SAMPLE_EVENTS.comment;
    eventCounter += 1;
    const card = node('article', 'lf-preview-event');
    const icon = node('span', 'lf-preview-event-icon', sample.icon);
    const body = node('div', 'lf-preview-event-copy');
    const top = node('div', 'lf-preview-event-top');
    top.append(node('strong', '', sample.title), node('small', '', sample.meta));
    const text = node('p', '', sample.text);
    const time = node('em', '', `Prueba ${eventCounter}`);
    body.append(top, text, time);
    card.append(icon, body);
    feed.prepend(card);
    while (feed.children.length > 7) feed.lastElementChild?.remove();
  }

  async function resolveSource(source) {
    if (source.kind === 'widget') {
      const info = await api.getStreamWidgetInfo(source.value);
      return { url: info?.previewUrl || info?.localUrl || '', info };
    }
    if (source.kind === 'ranking') {
      const info = await api.getRankingInfo(source.value);
      return { url: info?.previewUrl || info?.localUrl || '', info };
    }
    const info = await api.getOverlayInfo(source.value);
    return { url: info?.localUrl || '', info };
  }

  async function loadSource(sourceId, frame, status, sourceButtons) {
    const source = SOURCES.find((item) => item.id === sourceId) || SOURCES[0];
    currentSource = source.id;
    sourceButtons.forEach((button) => button.classList.toggle('active', button.dataset.previewSource === source.id));
    status.className = 'lf-preview-frame-status loading';
    status.textContent = `Cargando ${source.label}…`;
    frame.removeAttribute('src');
    try {
      const { url, info } = await resolveSource(source);
      if (!url) throw new Error('La fuente local todavía no está disponible.');
      frame.src = url;
      status.className = 'lf-preview-frame-status ready';
      status.textContent = source.kind === 'overlay'
        ? `${source.label} · vista local real · ${Number(info?.connected || 0)} conectado(s)`
        : `${source.label} · datos de muestra locales`;
    } catch (error) {
      status.className = 'lf-preview-frame-status error';
      status.textContent = error?.message || 'No se pudo abrir la vista previa.';
    }
  }

  function createChatPane() {
    const pane = node('div', 'lf-preview-pane active');
    pane.dataset.previewPane = 'chat';
    const toolbar = node('div', 'lf-preview-sim-toolbar');
    const copy = node('div', 'lf-preview-sim-copy');
    copy.append(node('strong', '', 'Chat simulado'), node('small', '', 'No envía nada a TikTok y no necesita estar en LIVE.'));
    const actions = node('div', 'lf-preview-sim-actions');
    [
      ['comment', 'Comentario'], ['gift', 'Regalo'], ['like', 'Likes'], ['follow', 'Follow'], ['goal', 'Meta']
    ].forEach(([type, label]) => {
      const button = node('button', 'ghost tiny', label);
      button.type = 'button';
      button.addEventListener('click', () => appendEvent(feed, type));
      actions.appendChild(button);
    });
    toolbar.append(copy, actions);

    const stage = node('div', 'lf-preview-chat-stage');
    const phone = node('div', 'lf-preview-chat-phone');
    const phoneHead = node('div', 'lf-preview-chat-head');
    phoneHead.append(node('span', 'lf-preview-live-dot', '● LIVE'), node('strong', '', 'Vista del chat'), node('small', '', 'LOCAL'));
    const feed = node('div', 'lf-preview-chat-feed');
    phone.append(phoneHead, feed);
    stage.appendChild(phone);
    pane.append(toolbar, stage);

    ['goal', 'follow', 'like', 'gift', 'comment'].forEach((type) => appendEvent(feed, type));
    return pane;
  }

  function createOverlayPane() {
    const pane = node('div', 'lf-preview-pane');
    pane.dataset.previewPane = 'overlay';
    const layout = node('div', 'lf-preview-overlay-layout');
    const sidebar = node('div', 'lf-preview-source-list');
    sidebar.append(node('strong', 'lf-preview-source-title', 'Qué quieres ver'));
    const sourceButtons = [];
    SOURCES.forEach((source) => {
      const button = node('button', 'lf-preview-source');
      button.type = 'button';
      button.dataset.previewSource = source.id;
      const text = node('span');
      text.append(node('strong', '', source.label), node('small', '', source.detail));
      button.append(node('i', '', source.kind === 'widget' ? '◫' : source.kind === 'ranking' ? '▦' : '◇'), text);
      button.addEventListener('click', () => loadSource(source.id, frame, status, sourceButtons));
      sourceButtons.push(button);
      sidebar.appendChild(button);
    });

    const viewer = node('div', 'lf-preview-viewer');
    const viewerHead = node('div', 'lf-preview-viewer-head');
    const viewerCopy = node('div');
    viewerCopy.append(node('strong', '', 'Pantalla del stream'), node('small', '', 'La muestra usa el servidor local de Lulu Finity, no el HTTPS público.'));
    const reload = node('button', 'ghost tiny', '↻ Recargar');
    reload.type = 'button';
    reload.addEventListener('click', () => loadSource(currentSource, frame, status, sourceButtons));
    viewerHead.append(viewerCopy, reload);
    const canvas = node('div', 'lf-preview-canvas');
    const frame = document.createElement('iframe');
    frame.className = 'lf-preview-frame';
    frame.title = 'Vista previa local de la fuente seleccionada';
    frame.setAttribute('referrerpolicy', 'no-referrer');
    canvas.appendChild(frame);
    const status = node('small', 'lf-preview-frame-status loading', 'Preparando vista local…');
    viewer.append(viewerHead, canvas, status);
    layout.append(sidebar, viewer);
    pane.appendChild(layout);

    setTimeout(() => loadSource(currentSource, frame, status, sourceButtons), 50);
    return pane;
  }

  function init() {
    if (document.getElementById('page-preview')) return;
    const nav = document.querySelector('.nav-list');
    const main = document.querySelector('.main-content');
    if (!nav || !main) return;

    const navButton = node('button', 'nav-item');
    navButton.type = 'button';
    navButton.dataset.page = 'preview';
    navButton.innerHTML = '<span>◫</span>Vista previa';
    navButton.addEventListener('click', (event) => {
      event.preventDefault();
      activatePage();
    });
    const rankingsButton = nav.querySelector('[data-page="rankings"]');
    if (rankingsButton) rankingsButton.insertAdjacentElement('afterend', navButton);
    else nav.appendChild(navButton);

    const page = node('section', 'page lf-preview-page');
    page.id = 'page-preview';
    page.hidden = true;
    page.inert = true;
    page.setAttribute('aria-hidden', 'true');

    const heading = node('div', 'page-heading simple lf-preview-heading');
    const headingCopy = node('div');
    headingCopy.append(node('h1', '', 'Vista previa'), node('p', '', 'Mira cómo se verá Lulu Finity sin abrir TikTok Studio ni OBS.'));
    const badge = node('span', 'lf-preview-local-badge', '100% LOCAL');
    heading.append(headingCopy, badge);

    const tabs = node('div', 'section-tabs lf-preview-tabs');
    const chatTab = node('button', 'section-tab active', 'Chat');
    const overlayTab = node('button', 'section-tab', 'Pantalla / Overlay');
    chatTab.type = overlayTab.type = 'button';
    chatTab.dataset.previewTab = 'chat';
    overlayTab.dataset.previewTab = 'overlay';
    tabs.append(chatTab, overlayTab);

    const body = node('div', 'lf-preview-body');
    const chatPane = createChatPane();
    const overlayPane = createOverlayPane();
    body.append(chatPane, overlayPane);

    const selectTab = (name) => {
      [chatTab, overlayTab].forEach((tab) => tab.classList.toggle('active', tab.dataset.previewTab === name));
      [chatPane, overlayPane].forEach((pane) => pane.classList.toggle('active', pane.dataset.previewPane === name));
    };
    chatTab.addEventListener('click', () => selectTab('chat'));
    overlayTab.addEventListener('click', () => selectTab('overlay'));

    page.append(heading, tabs, body);
    main.appendChild(page);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else setTimeout(init, 0);
})();
