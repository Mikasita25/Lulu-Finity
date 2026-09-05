'use strict';

const WIDGET_STUDIO_TYPES = {playlist:['Música','Canción actual y solicitudes del chat','rankings','♫'],wallet:['Monedas','El saldo de cada espectador','rankings','☾'],alert:['Alertas','Bienvenidas y eventos de tu LIVE','automations','✦'],goal:['Metas','Dale forma a tu siguiente objetivo','automations','◔'],gift:['Regalos','Regalos, rachas y agradecimientos','automations','◇'],game:['Juegos','Resultados e interacciones en pantalla','games','♧']};
let focusedWidget = null;

function widgetStudioFields(type) {
  const ranges = [['fontSize','Tamaño de letra',12,40,22],['scale','Escala',50,150,100],['padding','Espaciado interior',8,40,18],['borderWidth','Grosor del marco',0,8,1],['shadow','Sombra',0,60,24],['blur','Desenfoque',0,24,0]];
  return `<div class="design-presets" aria-label="Diseños iniciales"><button type="button" data-design-preset="sakura">Sakura</button><button type="button" data-design-preset="sky">Cielo</button><button type="button" data-design-preset="mono">Minimal</button></div><label class="design-font"><span>Tipografía</span><select data-widget-style-field="fontFamily"><option value="system">Clásica</option><option value="rounded">Redondeada</option><option value="modern">Moderna</option><option value="editorial">Editorial</option><option value="mono">Monoespaciada</option></select></label><div class="widget-style-range-grid">${ranges.map(([field,label,min,max,value])=>`<label><span>${label} <output data-design-output="${field}">${value}${field==='scale'?'%':' px'}</output></span><input aria-label="${label}" type="range" min="${min}" max="${max}" step="1" data-widget-style-field="${field}"></label>`).join('')}</div><div class="design-media">${[['backgroundImage','Fondo propio'],['logoImage','Logo']].map(([field,label])=>`<div><strong>${label}</strong><small data-design-image-state="${field}">Sin imagen</small><button type="button" class="ghost tiny" data-design-import="${field}">Elegir imagen</button><button type="button" class="text-button" data-design-remove="${field}">Quitar</button></div>`).join('')}</div><label class="design-font"><span>Ajuste del fondo</span><select data-widget-style-field="backgroundFit"><option value="cover">Cubrir</option><option value="contain">Imagen completa</option></select></label><div class="design-history"><button type="button" class="ghost tiny" data-design-undo>Deshacer cambio</button><button type="button" class="ghost tiny" data-design-copy>Copiar diseño</button><button type="button" class="ghost tiny" data-design-paste>Pegar diseño</button></div>`;
}

const designHistory = new Map();
let copiedDesign = null;
function rememberWidgetDesign(type) {
  const history = designHistory.get(type) || [];
  const design = {...normalizedStreamWidgetStyles()[type]};
  if (JSON.stringify(history.at(-1)) !== JSON.stringify(design)) history.push(design);
  if (history.length > 30) history.shift();
  designHistory.set(type, history);
}
function setStudioDesign(type, changes) {
  rememberWidgetDesign(type);
  state.settings.streamWidgetStyles = {...normalizedStreamWidgetStyles(), [type]:normalizeStreamWidgetStyle({...normalizedStreamWidgetStyles()[type], ...changes, enabled:true}, DEFAULT_STREAM_WIDGET_STYLES[type])};
  renderStreamWidgetStyleEditors();
  void persistSettings().catch(error=>toast('No se pudo guardar',error.message,'error'));
  scheduleStreamWidgetStyleRefresh(type);
}
function closeWidgetFocus() {
  if (!focusedWidget) return;
  const {card,placeholder,button} = focusedWidget;
  focusedWidget = null;
  placeholder.replaceWith(card);
  card.classList.remove('focus-card');
  const dialog = document.getElementById('widgetFocusDialog');
  if (dialog.open) dialog.close();
  button?.focus();
}
function openWidgetFocus(type,button) {
  const spec = WIDGET_STUDIO_TYPES[type];
  if (!spec) return;
  goToPage(spec[2]);
  const card = document.querySelector(`[data-widget-style-editor="${type}"]`)?.closest('.stream-widget-card');
  if (!card) return;
  const placeholder = document.createElement('span');
  card.before(placeholder);
  const dialog = document.getElementById('widgetFocusDialog');
  document.getElementById('widgetFocusTitle').textContent = `Diseña tu widget · ${spec[0]}`;
  focusedWidget = {card,placeholder,button};
  card.classList.add('focus-card');
  document.getElementById('widgetFocusBody').append(card);
  dialog.showModal();
  void refreshStreamWidgetInfo(type, true).catch(error=>toast('Vista previa',error.message,'error'));
}
function setupWidgetStudio() {
  document.querySelectorAll('.nav-group-label').forEach(label=>label.remove());
  const nav = document.createElement('button');nav.className='nav-item';nav.dataset.page='widgets';nav.innerHTML='<span>▧</span>Editor de widgets';
  document.querySelector('[data-page="rankings"]').before(nav);
  const page = document.createElement('section');page.id='page-widgets';page.className='page';
  page.innerHTML=`<header class="design-page-header"><span class="studio-eyebrow">PERSONALIZACIÓN</span><h1>Tus widgets, a tu estilo.</h1><p>Elige un widget y hazlo tuyo. Puedes probarlo sin conectar un LIVE.</p></header><div class="widget-launch-grid">${Object.entries(WIDGET_STUDIO_TYPES).map(([type,[name,detail,,icon]],i)=>`<button class="widget-launch" data-design-open="${type}"><div class="widget-launch-art art-${type}"><span>${icon}</span>${type==='goal'?'<i class="launch-progress"></i>':''}<small>${['NOW PLAYING','LUNITAS','NUEVO SEGUIDOR','TU SIGUIENTE META','GRACIAS POR EL APOYO','A JUGAR'][i]}</small></div><div class="widget-launch-copy"><strong>${name}<b>↗</b></strong><p>${detail}</p><span>Personalizar</span></div></button>`).join('')}</div><div class="design-page-note"><strong>Un enlace para cada widget</strong><p>Al editar su apariencia, el enlace que agregaste a OBS o LIVE Studio se conserva.</p></div>`;
  document.querySelector('.main-content').append(page);
  const dialog = document.createElement('dialog');dialog.id='widgetFocusDialog';dialog.setAttribute('aria-labelledby','widgetFocusTitle');
  dialog.innerHTML='<header class="widget-focus-header"><div><small>EDITOR DE WIDGETS</small><h2 id="widgetFocusTitle">Tu widget</h2></div><button class="primary" id="widgetFocusClose">Listo</button></header><div id="widgetFocusBody"></div>';
  document.body.append(dialog);
  document.getElementById('widgetFocusClose').addEventListener('click',closeWidgetFocus);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeWidgetFocus();});
  document.addEventListener('click', async event=>{
    const launch=event.target.closest('[data-design-open]');if(launch){openWidgetFocus(launch.dataset.designOpen,launch);return;}
    const editor=event.target.closest('[data-widget-style-editor]');if(!editor)return;
    const type=editor.dataset.widgetStyleEditor;
    const preset=event.target.closest('[data-design-preset]');
    if(preset){const options={sakura:{primaryColor:'#f7a6cc',secondaryColor:'#c8b5ee',textColor:'#fff6fb',backgroundColor:'#302339',fontFamily:'rounded',borderRadius:26},sky:{primaryColor:'#9edbff',secondaryColor:'#a9aff4',textColor:'#f4fbff',backgroundColor:'#19293b',fontFamily:'modern',borderRadius:18},mono:{primaryColor:'#ffffff',secondaryColor:'#acb5c2',textColor:'#ffffff',backgroundColor:'#18191d',fontFamily:'system',borderRadius:10,shadow:0}};setStudioDesign(type,options[preset.dataset.designPreset]);}
    const remove=event.target.closest('[data-design-remove]');if(remove)setStudioDesign(type,{[remove.dataset.designRemove]:''});
    if(event.target.closest('[data-design-copy]')){copiedDesign={...normalizedStreamWidgetStyles()[type]};toast('Diseño copiado','Puedes pegarlo en otro widget.');}
    if(event.target.closest('[data-design-paste]')){if(copiedDesign)setStudioDesign(type,copiedDesign);else toast('Copia un diseño primero','Usa Copiar diseño en cualquier widget.');}
    if(event.target.closest('[data-design-undo]')){const previous=designHistory.get(type)?.pop();if(previous){state.settings.streamWidgetStyles={...normalizedStreamWidgetStyles(),[type]:previous};renderStreamWidgetStyleEditors();void persistSettings().catch(error=>toast('No se pudo guardar',error.message,'error'));scheduleStreamWidgetStyleRefresh(type);}}
    const pick=event.target.closest('[data-design-import]');
    if(pick){pick.disabled=true;try{const result=await api.importWidgetImage();if(result)setStudioDesign(type,{[pick.dataset.designImport]:result.url});}catch(error){toast('No se pudo importar',error.message,'error');}finally{pick.disabled=false;}}
  });
  document.addEventListener('focusin',event=>{const editor=event.target.closest('[data-widget-style-editor]');if(editor&&event.target.matches('[data-widget-style-field]'))rememberWidgetDesign(editor.dataset.widgetStyleEditor);});
  document.addEventListener('pointerdown',event=>{const editor=event.target.closest('[data-widget-style-editor]');if(editor&&event.target.matches('[data-widget-style-field]'))rememberWidgetDesign(editor.dataset.widgetStyleEditor);});
  document.addEventListener('keydown',event=>{
    const editing=/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();closeWidgetFocus();document.getElementById('featureSearchInput').focus();}
    if(!editing&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&focusedWidget){event.preventDefault();focusedWidget.card.querySelector('[data-design-undo]')?.click();}
  });
  document.getElementById('featureSearchInput').placeholder='Buscar…  Ctrl K';
}
