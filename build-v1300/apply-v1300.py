from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()
resources = Path(__file__).parent / 'files/src'

def patch(name, old, new):
    path = root / name
    value = path.read_text(encoding='utf-8')
    found = value.count(old)
    if found != 1:
        raise RuntimeError(f'{name}: se esperaba un anclaje ({found}): {old[:110]}')
    path.write_text(value.replace(old, new, 1), encoding='utf-8')

for name in ('package.json', 'package-lock.json'):
    path = root / name
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('version') != '1.2.9':
        raise RuntimeError(f'{name}: requiere la fuente 1.2.9')
    data['version'] = '1.3.0'
    if name.endswith('package-lock.json'):
        if data['packages'][''].get('version') != '1.2.9':
            raise RuntimeError('package-lock.json inesperado')
        data['packages']['']['version'] = '1.3.0'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Cada color conserva premio, lunitas y probabilidad, y suma un recurso visual opcional.
color = 'src/color-roulette.js'
patch(color, "const DURATION_MS = 14110;", """
const DURATION_MS = 14110;
function normalizeRouletteMedia(input = {}) {
  const type = ['gif','image','video'].includes(input?.type) ? input.type : 'none';
  const seconds = Number(input?.seconds);
  return {
    type,
    url: String(input?.url || '').trim().slice(0,1400),
    seconds: Number.isFinite(seconds) ? Math.max(1,Math.min(30,seconds)) : 5,
    muted: true
  };
}
""".strip())
patch(color,
      "amount: Math.max(0, Math.min(1000000000, Math.round(finite(row.amount, 0)))) };",
      "amount: Math.max(0, Math.min(1000000000, Math.round(finite(row.amount, 0)))),\n        media: normalizeRouletteMedia(row.media) };")
patch(color,
      "function validateColorRoulette(config) {\n  const total",
      """function validateColorRoulette(config) {
  for (const row of config.colors) {
    if (row.media?.type === 'none' || !row.media) continue;
    try {
      const url = new URL(row.media.url);
      if (url.protocol !== 'https:' || !url.hostname) throw new Error('Invalid URL');
    } catch {
      return 'El color ' + row.name + ' requiere un enlace directo HTTPS para su acción visual.';
    }
  }
  const total""")
patch(color,
      "normalizeColorRoulette, validateColorRoulette, pickColor };",
      "normalizeColorRoulette, normalizeRouletteMedia, validateColorRoulette, pickColor };")

# El recurso se determina con el premio y solo se muestra después del giro.
games = 'src/live-games.js'
patch(games,
      "    const totalMs = DURATION_MS + cfg.resultSeconds * 1000;",
      "    let totalMs = DURATION_MS + cfg.resultSeconds * 1000;")
patch(games,
      "      const selected = pickColor(cfg, max => secureRandomInt(max, this.rng));",
      """      const selected = pickColor(cfg, max => secureRandomInt(max, this.rng));
      if (selected.media?.type !== 'none' && selected.media?.url) {
        totalMs = DURATION_MS + Math.max(cfg.resultSeconds,selected.media.seconds) * 1000;
      }""")
patch(games,
      "rouletteColor:selected.name, prize:selected.prize || 'Sin premio', animationStartedAt,",
      "rouletteColor:selected.name, prize:selected.prize || 'Sin premio', rouletteMedia:selected.media, animationStartedAt,")

# Campos independientes para cada color, con validación antes de guardar o probar.
ui = (resources / 'roulette-actions-ui.js').read_text(encoding='utf-8')
patch('src/renderer.js',
      "function renderColorRouletteSettings(){",
      ui + "\nfunction renderColorRouletteSettings(){")
visual_markup = '$' + '{rouletteActionFields(rows)}'
patch('src/renderer.js',
      '</tbody></table></div><p id="rouletteProbabilityTotal"',
      '</tbody></table></div>' + visual_markup + '<p id="rouletteProbabilityTotal"')
patch('src/renderer.js',
      'amount:Number(tr.querySelector(\'[data-field="amount"]\').value)}))});',
      'amount:Number(tr.querySelector(\'[data-field="amount"]\').value),media:readRouletteMedia(panel,index)}))});')
patch('src/renderer.js',
      "const valid=()=>{const total=read().colors.reduce((sum,row)=>sum+row.probability,0),ok=Math.abs(total-100)<.000001;$('rouletteProbabilityTotal').textContent=",
      "const valid=()=>{const config=read(),total=config.colors.reduce((sum,row)=>sum+row.probability,0),mediaError=rouletteMediaError(config),ok=Math.abs(total-100)<.000001&&!mediaError;$('rouletteProbabilityTotal').textContent=")
patch('src/renderer.js',
      "Total: " + '$' + "{Number(total.toFixed(4))}%" + '$' + "{ok?'':' · Debe sumar 100%'}",
      "Total: " + '$' + "{Number(total.toFixed(4))}%" + '$' + "{mediaError?' · '+mediaError:(Math.abs(total-100)<.000001?'':' · Debe sumar 100%')}")

# Las dos fuentes de Juego (local y Railway) usan el mismo overlay transparente.
helper = (resources / 'roulette-actions-overlay.js').read_text(encoding='utf-8')
for name in ('src/main.js', 'railway-relay/src/overlay-page.js'):
    patch(name, 'let rouletteFrame=null,roulettePayload=null,rouletteTimer=0,rouletteReady=false;',
          helper + '\nlet rouletteFrame=null,roulettePayload=null,rouletteTimer=0,rouletteReady=false;')
    patch(name,
          'function stopColorRoulette(){\n  clearTimeout(rouletteTimer);',
          'function stopColorRoulette(){\n  stopRouletteMedia();\n  clearTimeout(rouletteTimer);')
    patch(name,
          'if(data.visible===false||Number(data.expiresAt)<=Date.now())return;',
          'if(data.visible===false||Number(data.expiresAt)<=Date.now()){stopColorRoulette();return;}')
    patch(name,
          'rouletteTimer=setTimeout(stopColorRoulette,Math.max(0,Number(data.expiresAt)-Date.now()));',
          'rouletteTimer=setTimeout(stopColorRoulette,Math.max(0,Number(data.expiresAt)-Date.now()));\n  scheduleRouletteMedia(data);')

patch('src/main.js',
      "function renderGame(data){hideAll();if(data.game==='roulette'&&Number.isInteger(data.rouletteIndex)){showColorRoulette(data);return;}",
      "function renderGame(data){if(data.game==='roulette'&&Number.isInteger(data.rouletteIndex)){showColorRoulette(data);return;}hideAll();")
patch('railway-relay/src/overlay-page.js',
      "function renderGame(data){hideRoot();if(data.game==='roulette'&&Number.isInteger(data.rouletteIndex)){showColorRoulette(data);return;}",
      "function renderGame(data){if(data.game==='roulette'&&Number.isInteger(data.rouletteIndex)){root.replaceChildren();showColorRoulette(data);return;}hideRoot();")
patch('railway-relay/src/overlay-page.js',
      "img-src 'self' data: https:; connect-src",
      "img-src 'self' data: https:; media-src 'self' https:; connect-src")

patch('src/index.html', 'v1.2.9', 'v1.3.0')
(root / 'src/roulette-action.test.js').write_bytes((resources / 'roulette-action.test.js').read_bytes())
print('1.3.0: acciones visuales por color para GIF, imagen y video integradas')
