'use strict';

(() => {
  const api = window.voiceStudio;
  if (!api) return;

  const PUBLIC_UPDATE_LABEL = '3.0';
  const SEEN_KEY = 'lastSeenVersion';

  const FEATURES = Object.freeze([
    ['LIVE', 'conexión y chat en vivo de TikTok.'],
    ['TTS', 'voces, Lulu Local sin internet, botón Probar voz.'],
    ['Música', 'reproductor, cola, Now Playing personalizable.'],
    ['Comandos', 'comandos configurables del chat.'],
    ['Juegos', 'minijuegos seleccionables desde la sección Juegos.'],
    ['Rankings', 'rankings personalizados.'],
    ['Metas', 'metas de stream configurables.'],
    ['Economía', 'sistema de comunidad/wallet.'],
    ['Pantalla', 'overlays, widgets, fuentes HTTPS estables.'],
    ['Personalizar', 'edición visual de widgets, fotos, capas y estilos.'],
    ['Conexión y cuenta', 'gestión de sesión.'],
    ['Configuración', 'ajustes generales y rendimiento.'],
    ['Vista previa', 'probar la apariencia sin OBS ni TikTok Studio.']
  ]);

  const NEWS = Object.freeze([
    'Sistema de botones renovado, sincronizado con los 12 temas.',
    'Mejoras visuales en las tarjetas de selección de tema.',
    'Personalizar admite fondo propio, logo/decoración y marco transparente.',
    'Fuentes HTTPS estables con recuperación de estado y recursos.',
    'Vista previa interna para revisar chat y overlays sin OBS ni TikTok Studio.',
    'Música incluye Now Playing personalizable con portada y progreso.',
    'Ruleta de premios configurable dentro de Juegos.'
  ]);

  function parts(version) {
    return String(version || '').trim().replace(/^v/i, '').split(/[.-]/).map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isFinite(value) ? value : 0;
    });
  }

  function compareVersions(left, right) {
    const a = parts(left);
    const b = parts(right);
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const av = a[index] || 0;
      const bv = b[index] || 0;
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  }

  function shouldShow(installedVersion, lastSeenVersion) {
    if (!String(installedVersion || '').trim()) return false;
    if (!String(lastSeenVersion || '').trim()) return true;
    return compareVersions(installedVersion, lastSeenVersion) > 0;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function featureRow(label, detail) {
    const row = element('li', 'lf-update3-feature');
    row.append(element('strong', '', label), element('span', '', detail));
    return row;
  }

  async function markSeen(_state, installedVersion) {
    const latest = await api.getState();
    const current = latest?.settings && typeof latest.settings === 'object' ? latest.settings : {};
    if (String(current[SEEN_KEY] || '') === String(installedVersion || '')) return;
    await api.saveSettings({ ...current, [SEEN_KEY]: installedVersion });
  }

  function decorateButtons(root = document) {
    const candidates = root instanceof Element && root.matches('button')
      ? [root, ...root.querySelectorAll('button')]
      : [...root.querySelectorAll('button')];
    for (const button of candidates) {
      if (button.closest('.window-controls')) continue;
      if (button.matches('.nav-item,.theme-choice,.studio-theme-choice,.section-tab,.text-button,.icon-button,.lf-preview-source')) continue;
      button.classList.add('lf-cute');
      if (button.classList.contains('tiny')) button.classList.add('lf-cute-sm');
    }
  }

  function installButtonObserver() {
    decorateButtons(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) decorateButtons(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function openAbout() {
    if (typeof window.goToPage === 'function') {
      window.goToPage('about');
      return true;
    }
    const button = document.querySelector('[data-page="about"]');
    if (button) {
      button.click();
      return true;
    }
    return false;
  }

  function buildModal(state, installedVersion) {
    if (document.querySelector('.lf-update3-backdrop')) return;

    const backdrop = element('div', 'lf-update3-backdrop');
    backdrop.setAttribute('role', 'presentation');

    const modal = element('section', 'lf-update3-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'lfUpdate3Title');
    modal.setAttribute('aria-describedby', 'lfUpdate3Subtitle');

    const hero = element('header', 'lf-update3-hero');
    const badge = element('span', 'lf-update3-badge', `UPDATE ${PUBLIC_UPDATE_LABEL}`);
    const title = element('h2', '', `Update ${PUBLIC_UPDATE_LABEL} — Lulu Finity`);
    title.id = 'lfUpdate3Title';
    const subtitle = element('p', '', 'Esto es lo nuevo y lo que ya puedes usar.');
    subtitle.id = 'lfUpdate3Subtitle';
    hero.append(badge, title, subtitle);

    const content = element('div', 'lf-update3-content');

    const news = element('article', 'lf-update3-block');
    news.append(element('h3', '', 'Novedades de esta versión'));
    const newsList = element('ul', 'lf-update3-news-list');
    NEWS.forEach((item) => newsList.append(element('li', '', item)));
    news.append(newsList);

    const all = element('article', 'lf-update3-block lf-update3-all');
    all.append(element('h3', '', 'Todo lo que ya incluye Lulu Finity'));
    const featureList = element('ul', 'lf-update3-feature-list');
    FEATURES.forEach(([label, detail]) => featureList.append(featureRow(label, detail)));
    all.append(featureList);
    content.append(news, all);

    const footer = element('footer', 'lf-update3-actions');
    const versionNote = element('small', '', `Build instalado ${installedVersion}`);
    const buttons = element('div', 'lf-update3-buttons');
    const about = element('button', 'ghost lf-cute-md lf-update3-about', 'Ver todas las novedades');
    about.type = 'button';
    const start = element('button', 'primary lf-cute-lg', 'Empezar');
    start.type = 'button';
    buttons.append(about, start);
    footer.append(versionNote, buttons);

    modal.append(hero, content, footer);
    backdrop.append(modal);
    document.body.append(backdrop);

    let closing = false;
    const close = async (goAbout = false) => {
      if (closing) return;
      closing = true;
      try {
        await markSeen(state, installedVersion);
      } catch (error) {
        console.warn('No se pudo guardar lastSeenVersion:', error);
      }
      backdrop.classList.add('closing');
      setTimeout(() => {
        backdrop.remove();
        if (goAbout) openAbout();
      }, 140);
    };

    start.addEventListener('click', () => void close(false));
    about.addEventListener('click', () => void close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) void close(false);
    });
    modal.addEventListener('click', (event) => event.stopPropagation());

    requestAnimationFrame(() => {
      backdrop.classList.add('ready');
      start.focus({ preventScroll: true });
    });
  }

  async function init() {
    try {
      const state = await api.getState();
      const installedVersion = String(state?.version || '').trim();
      const lastSeenVersion = String(state?.settings?.[SEEN_KEY] || '').trim();
      if (!shouldShow(installedVersion, lastSeenVersion)) return;
      buildModal(state, installedVersion);
    } catch (error) {
      console.warn('No se pudo preparar el mensaje de Update 3.0:', error);
    }
  }

  window.LuluUpdate3Welcome = Object.freeze({ compareVersions, shouldShow });
  const boot = () => {
    installButtonObserver();
    setTimeout(init, 0);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
