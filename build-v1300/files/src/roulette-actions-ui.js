function rouletteActionFields(rows) {
  const names = ['Rojo','Naranja','Amarillo','Verde','Cyan','Azul','Morado','Magenta'];
  const swatches = ['#fa2943','#ff9818','#ffdf20','#3afb22','#00e3de','#283bff','#8831ef','#ef28d9'];
  let html = '<div class="roulette-visual-actions"><h3>Acción visual al ganar</h3><p class="hint">Opcional para cada color. Al terminar el giro, muestra el GIF, la imagen o el video seleccionado en la fuente web de Juegos. Usa un enlace directo público HTTPS (.gif, .png, .jpg, .webp, .mp4 o .webm), no el enlace a una página.</p>';
  names.forEach((name, index) => {
    const item = rows[index] || {};
    const media = item.media || {};
    const type = ['image','gif','video'].includes(media.type) ? media.type : 'none';
    const url = escapeHtml(String(media.url || ''));
    const seconds = Math.max(1, Math.min(30, Number(media.seconds) || 5));
    html += '<div class="roulette-visual-row" data-roulette-media-color="' + index + '" style="display:grid;grid-template-columns:100px 120px minmax(180px,1fr) 95px;gap:9px;align-items:center;margin:10px 0;">';
    html += '<strong style="color:' + swatches[index] + '">' + name + '</strong>';
    html += '<select data-roulette-media="type" aria-label="Acción de ' + name + '">';
    [['none','Sin acción'],['gif','GIF'],['image','Imagen'],['video','Video']].forEach(option => {
      html += '<option value="' + option[0] + '"' + (type === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
    });
    html += '</select><input data-roulette-media="url" aria-label="Enlace HTTPS para ' + name + '" placeholder="https://.../animacion.gif" maxlength="1400" value="' + url + '">';
    html += '<label style="font-size:12px">Segundos<input data-roulette-media="seconds" type="number" min="1" max="30" step="1" value="' + seconds + '"></label></div>';
  });
  html += '<p class="hint">La acción visual aparece después de que la ruleta señala el color ganador y se oculta automáticamente. Los videos se reproducen sin sonido para permitir su inicio automático en TikTok Studio.</p></div>';
  return html;
}
function readRouletteMedia(panel, index) {
  const row = panel.querySelector('[data-roulette-media-color="' + index + '"]');
  return {
    type: row.querySelector('[data-roulette-media="type"]').value,
    url: row.querySelector('[data-roulette-media="url"]').value.trim(),
    seconds: Number(row.querySelector('[data-roulette-media="seconds"]').value),
    muted: true
  };
}
function rouletteMediaError(config) {
  for (const row of config.colors) {
    if (row.media.type === 'none') continue;
    let valid = false;
    try {
      const url = new URL(row.media.url);
      valid = url.protocol === 'https:' && Boolean(url.hostname);
    } catch {}
    if (!valid) return 'El color ' + row.name + ' necesita un enlace directo HTTPS.';
    if (!Number.isFinite(row.media.seconds) || row.media.seconds < 1 || row.media.seconds > 30) return 'La duración de ' + row.name + ' debe ser de 1 a 30 segundos.';
  }
  return '';
}
