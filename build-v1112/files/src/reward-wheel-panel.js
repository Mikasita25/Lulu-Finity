'use strict';

(() => {
  const api = window.voiceStudio;
  const policy = window.LuluRewardWheelPolicy;
  if (!api || !policy) return;

  let config = policy.sanitizeConfig();
  let settings = null;
  let root = null;
  let wheel = null;
  let labelsLayer = null;
  let resultBox = null;
  let segmentsHost = null;
  let saveTimer = null;
  let spinning = false;
  let rotation = 0;
  const cooldowns = new Map();

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function secureUnit() {
    try {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return buffer[0] / 4294967296;
    } catch { return Math.random(); }
  }

  function currencyLabel() {
    const symbol = String(settings?.currencySymbol || '🌙');
    const name = String(settings?.currencyName || 'Lunitas');
    return { symbol, name };
  }

  function rewardText(segment) {
    const { name } = currencyLabel();
    if (segment.rewardType === 'currency_add') return `+${Number(segment.amount || 0).toLocaleString('es-MX')} ${name}`;
    if (segment.rewardType === 'currency_remove') return `-${Number(segment.amount || 0).toLocaleString('es-MX')} ${name}`;
    if (segment.rewardType === 'none') return 'Sin premio';
    return segment.message || segment.label || 'Premio especial';
  }

  function wheelGradient() {
    const items = policy.segmentProbabilities(config);
    let cursor = 0;
    const stops = [];
    for (const item of items) {
      const start = cursor * 360;
      cursor += item.probability;
      const end = cursor * 360;
      stops.push(`${item.color} ${start.toFixed(3)}deg ${end.toFixed(3)}deg`);
    }
    return `conic-gradient(${stops.join(',')})`;
  }

  function renderWheelLabels() {
    if (!labelsLayer) return;
    const items = policy.segmentProbabilities(config);
    let cursor = 0;
    labelsLayer.replaceChildren(...items.map((item) => {
      const start = cursor * 360;
      cursor += item.probability;
      const mid = (start + cursor * 360) / 2;
      const label = document.createElement('span');
      label.className = 'reward-wheel-label';
      label.textContent = item.label;
      label.title = `${item.label} · ${(item.probability * 100).toFixed(1)}%`;
      label.style.transform = `translate(-50%,-50%) rotate(${mid}deg) translateY(-116px) rotate(${-mid}deg)`;
      if (items.length > 20) label.classList.add('compact');
      return label;
    }));
  }

  function renderWheel() {
    if (!wheel) return;
    wheel.style.background = wheelGradient();
    renderWheelLabels();
  }

  function segmentMidAngle(index) {
    const items = policy.segmentProbabilities(config);
    let cursor = 0;
    for (let i = 0; i < items.length; i += 1) {
      const start = cursor;
      cursor += items[i].probability;
      if (i === index) return ((start + cursor) / 2) * 360;
    }
    return 0;
  }

  function setResult(title, detail = '') {
    if (!resultBox) return;
    const strong = resultBox.querySelector('strong');
    const span = resultBox.querySelector('span');
    if (strong) strong.textContent = title;
    if (span) span.textContent = detail;
  }

  function renderSegments() {
    if (!segmentsHost) return;
    const probabilities = policy.segmentProbabilities(config);
    segmentsHost.innerHTML = probabilities.map((segment, index) => {
      const currency = segment.rewardType === 'currency_add' || segment.rewardType === 'currency_remove';
      return `<div class="reward-wheel-segment" data-wheel-index="${index}">
        <input class="reward-wheel-color" data-field="color" type="color" value="${escapeHtml(segment.color)}" title="Color"/>
        <label>Texto<input data-field="label" maxlength="60" value="${escapeHtml(segment.label)}"/></label>
        <label class="reward-wheel-type">Premio<select data-field="rewardType">
          <option value="currency_add" ${segment.rewardType==='currency_add'?'selected':''}>Sumar monedas</option>
          <option value="currency_remove" ${segment.rewardType==='currency_remove'?'selected':''}>Quitar monedas</option>
          <option value="none" ${segment.rewardType==='none'?'selected':''}>Sin premio</option>
          <option value="message" ${segment.rewardType==='message'?'selected':''}>Premio / texto especial</option>
        </select></label>
        <label class="reward-wheel-amount">Cantidad<input data-field="amount" type="number" min="0" max="1000000000" step="1" value="${currency ? Number(segment.amount || 0) : 0}" ${currency?'':'disabled'}/></label>
        <label>Peso<input data-field="weight" type="number" min="1" max="10000" step="1" value="${segment.weight}"/></label>
        <div class="reward-wheel-probability" title="Probabilidad aproximada">${(segment.probability*100).toFixed(segment.probability < .01 ? 2 : 1)}%</div>
        <button class="ghost reward-wheel-remove" type="button" title="Quitar espacio">×</button>
      </div>`;
    }).join('');
    const countInput = root?.querySelector('#rewardWheelCount');
    if (countInput) countInput.value = String(config.segments.length);
    renderWheel();
  }

  function renderBasic() {
    if (!root) return;
    root.querySelector('#rewardWheelEnabled').checked = config.enabled;
    root.querySelector('#rewardWheelCommand').value = config.command;
    root.querySelector('#rewardWheelCost').value = String(config.cost);
    root.querySelector('#rewardWheelCooldown').value = String(config.cooldownSeconds);
    const warning = root.querySelector('#rewardWheelEconomyWarning');
    const currencyReward = config.segments.some((segment) => ['currency_add','currency_remove'].includes(segment.rewardType));
    warning?.classList.toggle('hidden', Boolean(settings?.economyEnabled) || (!currencyReward && config.cost <= 0));
  }

  async function saveConfig(immediate = false) {
    clearTimeout(saveTimer);
    const run = async () => {
      if (!root) return;
      root.classList.add('reward-wheel-saving');
      try {
        config = policy.sanitizeConfig(config);
        const saved = await api.saveSettings({ rewardWheel:config });
        settings = saved || settings || {};
        config = policy.sanitizeConfig(settings.rewardWheel || config);
        renderBasic();
        renderSegments();
      } catch (error) {
        setResult('No se pudo guardar', error?.message || String(error));
      } finally {
        root.classList.remove('reward-wheel-saving');
      }
    };
    if (immediate) await run();
    else saveTimer = setTimeout(() => { void run(); }, 350);
  }

  function readBasicFromUi() {
    config = policy.sanitizeConfig({
      ...config,
      enabled:root.querySelector('#rewardWheelEnabled').checked,
      command:root.querySelector('#rewardWheelCommand').value,
      cost:root.querySelector('#rewardWheelCost').value,
      cooldownSeconds:root.querySelector('#rewardWheelCooldown').value
    });
    renderBasic();
  }

  function updateSegment(index, field, value) {
    const segments = config.segments.map((item) => ({ ...item }));
    const target = segments[index];
    if (!target) return;
    target[field] = value;
    if (field === 'rewardType' && !['currency_add','currency_remove'].includes(value)) target.amount = 0;
    config = policy.sanitizeConfig({ ...config, segments });
    renderSegments();
    void saveConfig();
  }

  function wheelCommandPayload(message = {}) {
    return {
      user:String(message.uniqueId || message.user?.uniqueId || message.username || '').replace(/^@/,'').trim().slice(0,80),
      displayName:String(message.nickname || message.displayName || message.user?.nickname || message.uniqueId || 'Usuario').trim().slice(0,100),
      profilePictureUrl:String(message.profilePictureUrl || message.user?.profilePictureUrl || '').slice(0,1000),
      comment:String(message.comment || message.content || '').trim()
    };
  }

  function matchesCommand(comment) {
    const text = String(comment || '').trim().toLowerCase();
    const command = String(config.command || '!girar').toLowerCase();
    return text === command || text.startsWith(`${command} `);
  }

  function transactionId(prefix, user) {
    let suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { suffix = crypto.randomUUID(); } catch {}
    return `reward-wheel:${prefix}:${user || 'preview'}:${suffix}`;
  }

  async function applyEconomy(user, displayName, profilePictureUrl, mode, amount, reason) {
    if (!amount) return { ok:true, balance:null };
    return api.mutateEconomy({
      user, displayName, profilePictureUrl, mode, amount,
      transactionId:transactionId(reason.replace(/[^a-z0-9]+/gi,'-').toLowerCase(), user), reason
    });
  }

  async function publishWidget(payload) {
    try { await api.updateStreamWidget('game', payload); } catch {}
  }

  async function spinVisual(index) {
    if (!wheel) return;
    const mid = segmentMidAngle(index);
    const normalizedTarget = ((360 - mid) % 360 + 360) % 360;
    const currentNormalized = ((rotation % 360) + 360) % 360;
    const turns = 6 + Math.floor(secureUnit() * 2);
    const delta = ((normalizedTarget - currentNormalized + 360) % 360) + turns * 360;
    rotation += delta;
    wheel.style.transition = 'transform 4s cubic-bezier(.12,.72,.08,1)';
    labelsLayer?.style.setProperty('transition', 'transform 4s cubic-bezier(.12,.72,.08,1)');
    wheel.style.transform = `rotate(${rotation}deg)`;
    if (labelsLayer) labelsLayer.style.transform = `rotate(${rotation}deg)`;
    await new Promise((resolve) => setTimeout(resolve, 4050));
  }

  async function executeSpin(player, preview = false) {
    if (spinning) {
      if (preview) setResult('La ruleta ya está girando', 'Espera a que termine el giro actual.');
      return { ok:false, reason:'busy' };
    }
    if (!config.enabled && !preview) return { ok:false, reason:'disabled' };
    const user = player.user || (preview ? 'usuario-prueba' : '');
    if (!user) return { ok:false, reason:'user' };
    const now = Date.now();
    const cooldownUntil = cooldowns.get(user) || 0;
    if (!preview && cooldownUntil > now) {
      const seconds = Math.ceil((cooldownUntil - now) / 1000);
      await publishWidget({ game:'reward-wheel', title:'Ruleta de premios', status:'pending', user, displayName:player.displayName, detail:`Espera ${seconds} s para volver a girar.`, text:`${player.displayName} debe esperar ${seconds} s.`, payout:0, bet:config.cost, currencyName:settings?.currencyName, currencySymbol:settings?.currencySymbol });
      return { ok:false, reason:'cooldown' };
    }
    if (!preview && config.cost > 0) {
      if (!settings?.economyEnabled) return { ok:false, reason:'economy-disabled' };
      const charged = await applyEconomy(user, player.displayName, player.profilePictureUrl, 'charge', config.cost, 'Ruleta: costo de giro');
      if (!charged?.ok) {
        await publishWidget({ game:'reward-wheel', title:'Ruleta de premios', status:'loss', user, displayName:player.displayName, detail:'Saldo insuficiente para girar.', text:`${player.displayName} no tiene saldo suficiente para girar.`, payout:0, bet:config.cost, currencyName:settings?.currencyName, currencySymbol:settings?.currencySymbol });
        return { ok:false, reason:'balance' };
      }
    }

    const picked = policy.pickSegment(config, secureUnit());
    const segment = picked.segment;
    spinning = true;
    setResult('Girando…', preview ? 'Prueba local · no modifica ningún saldo.' : `${player.displayName} está girando la ruleta.`);
    await publishWidget({ game:'reward-wheel', title:'Ruleta de premios', status:'pending', user, displayName:player.displayName, detail:'La ruleta está girando…', text:`${player.displayName} está girando la ruleta.`, payout:0, bet:config.cost, currencyName:settings?.currencyName, currencySymbol:settings?.currencySymbol, wheel:{ spinning:true, selectedIndex:picked.index, segments:config.segments } });
    try { await spinVisual(picked.index); }
    finally { spinning = false; }

    let economyResult = null;
    if (!preview && segment.rewardType === 'currency_add' && segment.amount > 0 && settings?.economyEnabled) {
      economyResult = await applyEconomy(user, player.displayName, player.profilePictureUrl, 'add', segment.amount, `Ruleta: ${segment.label}`);
    } else if (!preview && segment.rewardType === 'currency_remove' && segment.amount > 0 && settings?.economyEnabled) {
      economyResult = await applyEconomy(user, player.displayName, player.profilePictureUrl, 'charge', segment.amount, `Ruleta: ${segment.label}`);
    }

    if (!preview && config.cooldownSeconds > 0) cooldowns.set(user, Date.now() + config.cooldownSeconds * 1000);
    const detail = segment.rewardType === 'currency_remove' && economyResult && economyResult.ok === false
      ? `${segment.label} · no se pudo descontar el premio porque el saldo era insuficiente.`
      : segment.rewardType === 'message' && segment.message ? `${segment.label} · ${segment.message}` : segment.label;
    const payout = segment.rewardType === 'currency_add' ? segment.amount : 0;
    const status = segment.rewardType === 'currency_remove' ? 'loss' : segment.rewardType === 'none' ? 'push' : 'win';
    setResult(segment.label, preview ? `${rewardText(segment)} · prueba local` : rewardText(segment));
    await publishWidget({
      game:'reward-wheel', title:'Ruleta de premios', status, user, displayName:player.displayName,
      profilePictureUrl:player.profilePictureUrl, detail, text:`${player.displayName}: ${detail}`,
      payout, bet:config.cost, currencyName:settings?.currencyName, currencySymbol:settings?.currencySymbol,
      rewardType:segment.rewardType, rewardAmount:segment.amount, selectedIndex:picked.index,
      wheel:{ spinning:false, selectedIndex:picked.index, segments:config.segments }
    });
    return { ok:true, segment, index:picked.index };
  }

  function buildUi(page) {
    const section = document.createElement('article');
    section.className = 'panel reward-wheel-studio';
    section.id = 'rewardWheelStudio';
    section.innerHTML = `<div class="reward-wheel-head"><div><h2>Ruleta de premios</h2><p>Configura los espacios, probabilidades y recompensas. Los premios de monedas usan la misma Economía de Lulu Finity.</p></div><div class="reward-wheel-head-actions"><label class="switch"><input id="rewardWheelEnabled" type="checkbox"/><span></span></label><button class="ghost tiny" id="rewardWheelSaveBtn" type="button">Guardar</button></div></div>
      <div class="reward-wheel-layout"><div class="reward-wheel-preview"><div class="reward-wheel-wrap"><div class="reward-wheel-pointer"></div><div class="reward-wheel-disc" id="rewardWheelDisc"></div><div class="reward-wheel-labels" id="rewardWheelLabels"></div></div><div class="reward-wheel-result" id="rewardWheelResult"><strong>Lista para girar</strong><span>La prueba local no cambia saldos.</span></div><div class="reward-wheel-preview-actions"><input id="rewardWheelPreviewName" value="Usuario 1" maxlength="80"/><button class="secondary" id="rewardWheelPreviewBtn" type="button">Girar prueba</button></div></div>
      <div class="reward-wheel-settings"><div class="reward-wheel-basic-grid"><label>Comando<input id="rewardWheelCommand" value="!girar" maxlength="40"/></label><label>Costo por giro<input id="rewardWheelCost" type="number" min="0" max="1000000000" step="1" value="0"/></label><label>Cooldown por usuario (s)<input id="rewardWheelCooldown" type="number" min="0" max="86400" step="1" value="30"/></label><label>Espacios<input id="rewardWheelCount" type="number" min="2" max="40" step="1" value="8"/></label></div><div class="reward-wheel-economy-warning hidden" id="rewardWheelEconomyWarning">Activa Economía para que los premios o costos de monedas cambien el saldo real del canal.</div><div class="reward-wheel-segments-head"><strong>Espacios y premios</strong><div><button class="ghost tiny" id="rewardWheelEqualWeights" type="button">Igualar probabilidades</button><button class="secondary tiny" id="rewardWheelAddSegment" type="button">+ Espacio</button></div></div><div class="reward-wheel-segments" id="rewardWheelSegments"></div><div class="reward-wheel-note">El peso controla la probabilidad. Si todos tienen el mismo peso, todos los espacios tienen la misma posibilidad. Máximo: 40 espacios.</div></div></div>`;
    const heading = page.querySelector('.page-heading');
    if (heading?.nextSibling) page.insertBefore(section, heading.nextSibling);
    else page.prepend(section);
    return section;
  }

  function bindUi() {
    if (!root) return;
    root.querySelectorAll('#rewardWheelEnabled,#rewardWheelCommand,#rewardWheelCost,#rewardWheelCooldown').forEach((element) => {
      element.addEventListener('change', () => { readBasicFromUi(); void saveConfig(); });
    });
    root.querySelector('#rewardWheelSaveBtn')?.addEventListener('click', async () => { readBasicFromUi(); await saveConfig(true); setResult('Guardado', 'La ruleta ya usa esta configuración.'); });
    root.querySelector('#rewardWheelPreviewBtn')?.addEventListener('click', () => {
      const displayName = root.querySelector('#rewardWheelPreviewName')?.value.trim() || 'Usuario 1';
      void executeSpin({ user:'usuario-prueba', displayName, profilePictureUrl:'' }, true);
    });
    root.querySelector('#rewardWheelCount')?.addEventListener('change', (event) => {
      config = policy.resizeSegments(config, event.target.value);
      renderSegments();
      void saveConfig();
    });
    root.querySelector('#rewardWheelAddSegment')?.addEventListener('click', () => {
      config = policy.resizeSegments(config, Math.min(40, config.segments.length + 1));
      renderSegments();
      void saveConfig();
    });
    root.querySelector('#rewardWheelEqualWeights')?.addEventListener('click', () => {
      config = policy.sanitizeConfig({ ...config, segments:config.segments.map((segment) => ({ ...segment, weight:1 })) });
      renderSegments();
      void saveConfig();
    });
    segmentsHost?.addEventListener('change', (event) => {
      const row = event.target.closest('[data-wheel-index]');
      if (!row) return;
      const index = Number(row.dataset.wheelIndex);
      const field = event.target.dataset.field;
      if (!field) return;
      updateSegment(index, field, event.target.value);
    });
    segmentsHost?.addEventListener('click', (event) => {
      const button = event.target.closest('.reward-wheel-remove');
      if (!button) return;
      const row = button.closest('[data-wheel-index]');
      const index = Number(row?.dataset.wheelIndex);
      if (!Number.isInteger(index) || config.segments.length <= 2) return;
      const segments = config.segments.filter((_item, itemIndex) => itemIndex !== index);
      config = policy.sanitizeConfig({ ...config, segments });
      renderSegments();
      void saveConfig();
    });
  }

  async function init() {
    const page = document.getElementById('page-games');
    if (!page || document.getElementById('rewardWheelStudio')) return;
    const initial = await api.getState().catch(() => null);
    settings = initial?.settings || {};
    config = policy.sanitizeConfig(settings.rewardWheel || {});
    root = buildUi(page);
    wheel = root.querySelector('#rewardWheelDisc');
    labelsLayer = root.querySelector('#rewardWheelLabels');
    resultBox = root.querySelector('#rewardWheelResult');
    segmentsHost = root.querySelector('#rewardWheelSegments');
    renderBasic();
    renderSegments();
    bindUi();
    api.onChat((message) => {
      const player = wheelCommandPayload(message);
      if (!matchesCommand(player.comment)) return;
      void executeSpin(player, false).catch((error) => {
        setResult('No se pudo girar', error?.message || String(error));
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void init(); }, { once:true });
  else setTimeout(() => { void init(); }, 0);
})();
