'use strict';

(() => {
  const api = window.voiceStudio;
  const policy = window.LuluWidgetCustomizationPolicy;
  if (!api || !policy) return;

  const WIDGETS = Object.freeze([
    { id:'playlist', icon:'♪', name:'Música', detail:'Now Playing' },
    { id:'goal', icon:'◎', name:'Metas', detail:'Progreso del LIVE' },
    { id:'gift', icon:'🎁', name:'Regalos', detail:'Actividad y rachas' },
    { id:'alert', icon:'✦', name:'Alertas', detail:'Eventos automáticos' },
    { id:'wallet', icon:'◉', name:'Monedas / usuario', detail:'Saldo en pantalla' }
  ]);
  const THEMES = Object.freeze([
    ['lulu','Lulu Rosa'],['aurora','Aurora'],['cyber','Cyber'],['arcade','Arcade'],['hologram','Holograma'],['sakura','Sakura'],['miku','Miku'],['lavender','Lavanda'],['sunset','Atardecer'],['gold','Dorado'],['mint','Menta'],['ocean','Océano'],['vampire','Vampiro'],['mono','Monocromo']
  ]);
  const BACKGROUNDS = Object.freeze([
    ['plain','Esencia'],['stars','Estrellas'],['aurora','Aurora viva'],['grid','Cuadrícula'],['glass','Cristal'],['bubbles','Burbujas'],['vinyl','Vinilo'],['pixel','Pixel party'],['waves','Ondas'],['confetti','Confeti'],['spotlight','Reflectores'],['midnight','Medianoche']
  ]);
  const DEFAULT_THEME = Object.freeze({playlist:'aurora',wallet:'gold',alert:'lulu',goal:'hologram',gift:'sakura'});
  const DEFAULT_BACKGROUND = Object.freeze({playlist:'vinyl',wallet:'spotlight',alert:'bubbles',goal:'aurora',gift:'confetti'});
  const RANKING_DEFAULTS = [1,2,3,4].map((slot)=>({
    id:`ranking-${slot}`,type:slot===1?'coins':slot===2?'likes':slot===3?'economy':'comments',
    title:slot===1?'TOP GIFTERS':slot===2?'TOP TAP TAPS':slot===3?'TOP MONEDAS':'TOP COMENTARIOS',
    limit:5,style:'tiktok',font:'Segoe UI',textColor:'#ffffff',accentColor:'#ff2d8f',secondaryColor:'#25f4ee',backgroundColor:'#101018',backgroundOpacity:82,
    rgbText:false,showAvatar:true,showValue:true,showRank:true,uppercaseNames:false
  }));

  let settings = null;
  let current = 'playlist';
  let rankSlot = 1;
  let page = null;
  let frame = null;
  let controls = null;
  let status = null;
  let saveTimer = null;
  let previewToken = 0;

  const esc = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const optionList = (items, selected) => items.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join('');
  const bool = (value) => value === true;

  function normalizeSettings() {
    settings = settings && typeof settings === 'object' ? settings : {};
    settings.streamWidgetCustomizations = policy.sanitizeAll(settings.streamWidgetCustomizations);
    settings.streamWidgetThemes = { ...DEFAULT_THEME, ...(settings.streamWidgetThemes || {}) };
    settings.streamWidgetBackgrounds = { ...DEFAULT_BACKGROUND, ...(settings.streamWidgetBackgrounds || {}) };
    const incoming = Array.isArray(settings.rankingOverlays) ? settings.rankingOverlays : [];
    settings.rankingOverlays = RANKING_DEFAULTS.map((fallback,index)=>({ ...fallback, ...(incoming[index] || {}), id:`ranking-${index+1}` }));
  }

  function setStatus(text, kind='') {
    if (!status) return;
    status.textContent = text;
    status.dataset.kind = kind;
  }

  async function saveNow(reloadPreview=false) {
    clearTimeout(saveTimer);
    saveTimer = null;
    setStatus('Guardando…');
    try {
      settings = await api.saveSettings(settings);
      normalizeSettings();
      setStatus('Guardado','ok');
      if (current === 'rankings') await api.refreshRanking(rankSlot).catch(()=>{});
      if (reloadPreview) await refreshPreview(true);
    } catch (error) {
      setStatus('Error','error');
      console.warn('No se pudo guardar Personalizar:', error);
    }
  }

  function scheduleSave(reloadPreview=false) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>void saveNow(reloadPreview), 260);
  }

  function colorField(label,key,value) {
    return `<label class="lf-customizer-field"><span>${esc(label)}</span><input type="color" value="${esc(value)}" data-custom-key="${esc(key)}"></label>`;
  }

  function rangeField(label,key,value,min,max,suffix='') {
    return `<label class="lf-customizer-field full"><span>${esc(label)}</span><span class="lf-customizer-range"><input type="range" min="${min}" max="${max}" value="${Number(value)}" data-custom-key="${esc(key)}"><output>${Number(value)}${esc(suffix)}</output></span></label>`;
  }

  function switchField(title,help,key,checked) {
    return `<label class="lf-customizer-switch"><span><strong>${esc(title)}</strong><small>${esc(help)}</small></span><input type="checkbox" data-custom-key="${esc(key)}" ${checked?'checked':''}></label>`;
  }

  function renderWidgetControls() {
    const config = settings.streamWidgetCustomizations[current];
    const widget = WIDGETS.find((item)=>item.id===current);
    const theme = settings.streamWidgetThemes[current] || DEFAULT_THEME[current];
    const background = settings.streamWidgetBackgrounds[current] || DEFAULT_BACKGROUND[current];
    let special = '';
    if (current === 'playlist') {
      special = `<div class="lf-customizer-group"><strong>Música · estilo Now Playing</strong><div class="lf-customizer-grid"><label class="lf-customizer-field full"><span>Diseño</span><select data-custom-key="layout"><option value="compact" ${config.layout==='compact'?'selected':''}>Compacto como la referencia</option><option value="glass" ${config.layout==='glass'?'selected':''}>Tarjeta de cristal</option><option value="queue" ${config.layout==='queue'?'selected':''}>Canción + cola</option></select></label>${rangeField('Grosor de la barra','progressHeight',config.progressHeight,2,12,'px')}</div>${switchField('Mostrar portada','Usa la miniatura de YouTube cuando está disponible.','showArtwork',config.showArtwork)}${switchField('Mostrar cola','En compacto normalmente se deja apagada.','showQueue',config.showQueue)}${switchField('Mostrar proveedor','Muestra YouTube o Spotify.','showProvider',config.showProvider)}</div>`;
    } else if (current === 'wallet') {
      special = `<div class="lf-customizer-group"><strong>Forma</strong><label class="lf-customizer-field full"><span>Contenedor</span><select data-custom-key="walletShape"><option value="pill" ${config.walletShape==='pill'?'selected':''}>Pastilla</option><option value="card" ${config.walletShape==='card'?'selected':''}>Tarjeta</option></select></label></div>`;
    } else if (current === 'goal') {
      special = `<div class="lf-customizer-group"><strong>Barra de meta</strong><div class="lf-customizer-grid">${rangeField('Grosor','goalBarHeight',config.goalBarHeight,4,30,'px')}</div></div>`;
    }
    controls.innerHTML = `<div class="lf-customizer-controls-head"><span><strong>${esc(widget?.name || current)}</strong><small>Los cambios se aplican a la fuente local y HTTPS.</small></span><b class="lf-customizer-status">Listo</b></div>
      <div class="lf-customizer-group"><strong>Base</strong>${switchField('Personalización avanzada','Si la apagas, se conserva solamente el tema y fondo predeterminados.','enabled',config.enabled)}<div class="lf-customizer-grid"><label class="lf-customizer-field"><span>Tema</span><select data-setting-kind="theme">${optionList(THEMES,theme)}</select></label><label class="lf-customizer-field"><span>Fondo incluido</span><select data-setting-kind="background">${optionList(BACKGROUNDS,background)}</select></label></div></div>
      <div class="lf-customizer-group"><strong>Colores</strong><div class="lf-customizer-grid">${colorField('Principal','primaryColor',config.primaryColor)}${colorField('Secundario','secondaryColor',config.secondaryColor)}${colorField('Fondo','backgroundColor',config.backgroundColor)}${colorField('Texto','textColor',config.textColor)}${colorField('Texto suave','mutedColor',config.mutedColor)}</div></div>
      <div class="lf-customizer-group"><strong>Forma y efecto</strong><div class="lf-customizer-grid">${rangeField('Transparencia del fondo','backgroundOpacity',config.backgroundOpacity,0,100,'%')}${rangeField('Borde','borderOpacity',config.borderOpacity,0,100,'%')}${rangeField('Esquinas','borderRadius',config.borderRadius,0,48,'px')}${rangeField('Desenfoque','blur',config.blur,0,32,'px')}${rangeField('Sombra','shadow',config.shadow,0,100,'%')}${rangeField('Tamaño','scale',config.scale,60,150,'%')}</div></div>${special}
      <div class="lf-customizer-info">Los juegos quedan fuera de este editor. Blackjack, ruleta, slots y los demás mantienen únicamente los diseños controlados por Lulu Finity.</div>
      <button type="button" class="ghost lf-customizer-reset" data-reset-widget>Restablecer ${esc(widget?.name || '')}</button>`;
    status = controls.querySelector('.lf-customizer-status');
  }

  function rankingConfig() { return settings.rankingOverlays[Math.max(0,rankSlot-1)]; }

  function renderRankingControls() {
    const cfg = rankingConfig();
    controls.innerHTML = `<div class="lf-customizer-controls-head"><span><strong>Rankings</strong><small>Personaliza cada fuente por separado.</small></span><b class="lf-customizer-status">Listo</b></div>
      <div class="lf-customizer-group"><strong>Ranking</strong><div class="lf-customizer-rank-slot">${[1,2,3,4].map((slot)=>`<button type="button" data-rank-slot="${slot}" class="${slot===rankSlot?'active':''}">${slot}</button>`).join('')}</div></div>
      <div class="lf-customizer-group"><strong>Contenido</strong><div class="lf-customizer-grid"><label class="lf-customizer-field full"><span>Título</span><input type="text" maxlength="80" value="${esc(cfg.title)}" data-rank-key="title"></label><label class="lf-customizer-field"><span>Estilo</span><select data-rank-key="style">${optionList([['tiktok','TikTok'],['glass','Cristal'],['neon','Neón'],['minimal','Minimal']],cfg.style)}</select></label><label class="lf-customizer-field"><span>Fuente</span><select data-rank-key="font">${optionList([['Segoe UI','Segoe UI'],['Arial','Arial'],['Impact','Impact'],['Trebuchet MS','Trebuchet'],['Georgia','Georgia'],['Courier New','Courier New'],['Comic Sans MS','Comic Sans']],cfg.font)}</select></label></div></div>
      <div class="lf-customizer-group"><strong>Colores</strong><div class="lf-customizer-grid">${colorField('Texto','rank:textColor',cfg.textColor)}${colorField('Principal','rank:accentColor',cfg.accentColor)}${colorField('Secundario','rank:secondaryColor',cfg.secondaryColor)}${colorField('Fondo','rank:backgroundColor',cfg.backgroundColor)}${rangeField('Transparencia','rank:backgroundOpacity',cfg.backgroundOpacity,0,100,'%')}</div></div>
      <div class="lf-customizer-group"><strong>Elementos</strong>${switchField('Avatar','Foto del usuario.','rank:showAvatar',bool(cfg.showAvatar))}${switchField('Valor','Likes, monedas, regalos, etc.','rank:showValue',bool(cfg.showValue))}${switchField('Posición','Número de ranking.','rank:showRank',bool(cfg.showRank))}${switchField('Nombres en mayúsculas','Convierte los nombres visualmente.','rank:uppercaseNames',bool(cfg.uppercaseNames))}</div>
      <div class="lf-customizer-game-note">Los rankings sí se pueden personalizar libremente porque son fuentes visuales. Los minijuegos permanecen cerrados a los estilos incluidos dentro de la app.</div>`;
    status = controls.querySelector('.lf-customizer-status');
  }

  function renderControls() {
    if (!controls || !settings) return;
    if (current === 'rankings') renderRankingControls();
    else renderWidgetControls();
  }

  function renderNav() {
    page.querySelectorAll('[data-customizer-target]').forEach((button)=>button.classList.toggle('active',button.dataset.customizerTarget===current));
  }

  async function refreshPreview(force=false) {
    if (!frame || !page?.classList.contains('active')) return;
    const token = ++previewToken;
    const loading = page.querySelector('.lf-customizer-loading');
    loading?.classList.remove('hidden');
    try {
      let info;
      if (current === 'rankings') info = await api.getRankingInfo(rankSlot);
      else info = await api.getStreamWidgetInfo(current);
      if (token !== previewToken) return;
      let url = String(info?.previewUrl || info?.localUrl || '');
      if (url && !url.includes('preview=1') && current !== 'rankings') url += (url.includes('?')?'&':'?')+'preview=1';
      if (!url) throw new Error('Vista local no disponible');
      if (force || frame.src !== url) frame.src = url;
      frame.onload = ()=>loading?.classList.add('hidden');
      setTimeout(()=>loading?.classList.add('hidden'),1800);
    } catch {
      loading?.classList.remove('hidden');
      if (loading) loading.textContent='No se pudo cargar la vista previa.';
    }
  }

  function activate() {
    if (typeof window.goToPage === 'function') window.goToPage('customize');
    else {
      document.querySelectorAll('.main-content > .page').forEach((item)=>item.classList.toggle('active',item===page));
    }
    setTimeout(()=>void refreshPreview(false),40);
  }

  function bindControls() {
    controls.addEventListener('input',(event)=>{
      const input = event.target;
      const out = input.closest('.lf-customizer-range')?.querySelector('output');
      if (out && input.type==='range') out.textContent = `${input.value}${['backgroundOpacity','borderOpacity','shadow','scale'].includes(input.dataset.customKey)?'%':['borderRadius','blur','progressHeight','goalBarHeight'].includes(input.dataset.customKey)?'px':''}`;
      applyControl(input,false);
    });
    controls.addEventListener('change',(event)=>applyControl(event.target,true));
    controls.addEventListener('click',(event)=>{
      const rank = event.target.closest('[data-rank-slot]');
      if (rank) { rankSlot=Number(rank.dataset.rankSlot)||1; renderControls(); void refreshPreview(true); return; }
      if (event.target.closest('[data-reset-widget]') && current!=='rankings') {
        const defaults = policy.defaults();
        settings.streamWidgetCustomizations[current] = defaults[current];
        settings.streamWidgetThemes[current] = DEFAULT_THEME[current];
        settings.streamWidgetBackgrounds[current] = DEFAULT_BACKGROUND[current];
        renderControls(); scheduleSave(true);
      }
    });
  }

  function applyControl(input, commit) {
    if (!input || !settings) return;
    if (current === 'rankings') {
      const key = input.dataset.rankKey;
      if (!key) return;
      const cfg = rankingConfig();
      let value = input.type==='checkbox' ? input.checked : input.value;
      if (key === 'backgroundOpacity') value = Math.max(0,Math.min(100,Number(value)||0));
      cfg[key] = value;
      scheduleSave(commit);
      return;
    }
    const config = settings.streamWidgetCustomizations[current];
    const key = input.dataset.customKey;
    if (key) {
      let value = input.type==='checkbox' ? input.checked : input.value;
      if (input.type==='range' || input.type==='number') value = Number(value);
      config[key] = value;
      settings.streamWidgetCustomizations[current] = policy.sanitizeWidget(current,config);
      scheduleSave(false);
      return;
    }
    if (input.dataset.settingKind === 'theme') { settings.streamWidgetThemes[current] = input.value; scheduleSave(true); }
    if (input.dataset.settingKind === 'background') { settings.streamWidgetBackgrounds[current] = input.value; scheduleSave(true); }
  }

  async function init() {
    if (document.getElementById('page-customize')) return;
    const nav = document.querySelector('.nav-list');
    const main = document.querySelector('.main-content');
    if (!nav || !main) return;
    try { const initial = await api.getState(); settings = initial?.settings || {}; } catch { settings = {}; }
    normalizeSettings();

    const navButton = document.createElement('button');
    navButton.type='button'; navButton.className='nav-item'; navButton.dataset.page='customize'; navButton.innerHTML='<span>✦</span>Personalizar';
    navButton.addEventListener('click',(event)=>{event.preventDefault();activate();});
    const previewButton = nav.querySelector('[data-page="preview"]');
    const rankingsButton = nav.querySelector('[data-page="rankings"]');
    if (previewButton) previewButton.insertAdjacentElement('afterend',navButton);
    else if (rankingsButton) rankingsButton.insertAdjacentElement('afterend',navButton);
    else nav.appendChild(navButton);

    page=document.createElement('section'); page.id='page-customize'; page.className='page lf-customizer-page'; page.hidden=true; page.inert=true; page.setAttribute('aria-hidden','true');
    page.innerHTML=`<div class="page-heading simple lf-customizer-heading"><div><h1>Personalizar</h1><p>Diseña las fuentes del stream desde un solo lugar. Música, metas, regalos, alertas, monedas y rankings se actualizan también en el enlace HTTPS.</p></div><span class="lf-customizer-badge">✦ ESTUDIO DE OVERLAYS</span></div>
      <div class="lf-customizer-shell"><aside class="lf-customizer-nav">${WIDGETS.map((item)=>`<button type="button" data-customizer-target="${item.id}"><span>${item.icon}</span><i><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></i></button>`).join('')}<hr><button type="button" data-customizer-target="rankings"><span>▦</span><i><strong>Rankings</strong><small>4 fuentes</small></i></button><div class="lf-customizer-game-note"><strong>Juegos</strong><br>Usan solo los estilos oficiales incluidos en Lulu.</div></aside>
      <section class="lf-customizer-preview"><div class="lf-customizer-preview-head"><span><strong>Vista previa real</strong><small>Fuente local; no abre OBS ni TikTok Studio.</small></span><div class="lf-customizer-preview-actions"><button type="button" class="ghost tiny" data-customizer-reload>↻ Recargar</button></div></div><div class="lf-customizer-stage"><iframe class="lf-customizer-frame" title="Vista previa del overlay" referrerpolicy="no-referrer"></iframe><small class="lf-customizer-loading">Preparando vista…</small></div></section><aside class="lf-customizer-controls"></aside></div>`;
    main.appendChild(page);
    frame=page.querySelector('.lf-customizer-frame'); controls=page.querySelector('.lf-customizer-controls');
    page.querySelector('.lf-customizer-nav').addEventListener('click',(event)=>{const button=event.target.closest('[data-customizer-target]');if(!button)return;current=button.dataset.customizerTarget;renderNav();renderControls();void refreshPreview(true);});
    page.querySelector('[data-customizer-reload]').addEventListener('click',()=>void refreshPreview(true));
    bindControls(); renderNav(); renderControls();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>void init(),{once:true});
  else setTimeout(()=>void init(),0);
})();
