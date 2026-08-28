'use strict';

(() => {
  const api = window.voiceStudio;
  if (!api) return;
  let timer = null;

  function activeSlot(target) {
    const root = target.closest('#page-customize');
    const active = root?.querySelector('.lf-customizer-rank-slot button.active');
    return Math.max(1,Math.min(4,Number(active?.dataset.rankSlot || 1)));
  }

  async function persist(input) {
    const raw = String(input?.dataset?.customKey || '');
    if (!raw.startsWith('rank:')) return;
    const key = raw.slice(5);
    const initial = await api.getState();
    const settings = initial?.settings && typeof initial.settings === 'object' ? initial.settings : {};
    const list = Array.isArray(settings.rankingOverlays) ? settings.rankingOverlays.slice(0,4).map((item)=>({...(item||{})})) : [];
    while (list.length < 4) list.push({ id:`ranking-${list.length+1}` });
    const slot = activeSlot(input);
    const current = list[slot-1] || { id:`ranking-${slot}` };
    let value = input.type === 'checkbox' ? input.checked : input.value;
    if (key === 'backgroundOpacity') value = Math.max(0,Math.min(100,Number(value)||0));
    current[key] = value;
    current.id = `ranking-${slot}`;
    list[slot-1] = current;
    settings.rankingOverlays = list;
    await api.saveSettings(settings);
    await api.refreshRanking(slot).catch(()=>{});
  }

  function onControl(event) {
    const input = event.target?.closest?.('[data-custom-key^="rank:"]');
    if (!input) return;
    const output = input.closest('.lf-customizer-range')?.querySelector('output');
    if (output && input.type === 'range') output.textContent = `${input.value}%`;
    clearTimeout(timer);
    timer = setTimeout(()=>persist(input).catch((error)=>console.warn('Ranking personalizado no se guardó:',error)),220);
  }

  document.addEventListener('input',onControl,true);
  document.addEventListener('change',onControl,true);
})();
