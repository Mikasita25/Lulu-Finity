from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv)>1 else 'app')
assert json.loads((root/'package.json').read_text(encoding='utf-8'))['version']=='1.3.0'
assert json.loads((root/'package-lock.json').read_text(encoding='utf-8'))['packages']['']['version']=='1.3.0'
for name,terms in {
 'src/color-roulette.js':['normalizeRouletteMedia','media: normalizeRouletteMedia(row.media)'],
 'src/live-games.js':['rouletteMedia:selected.media','Math.max(cfg.resultSeconds,selected.media.seconds)'],
 'src/renderer.js':['rouletteActionFields(rows)','readRouletteMedia(panel,index)','rouletteMediaError(config)'],
 'src/main.js':['scheduleRouletteMedia(data)','stopRouletteMedia()'],
 'railway-relay/src/overlay-page.js':['scheduleRouletteMedia(data)','media-src'],
 'src/index.html':['v1.3.0']
}.items():
    content=(root/name).read_text(encoding='utf-8')
    for term in terms:
        assert term in content, (name,term)
assert (root/'src/roulette-action.test.js').exists()
print('Lulu Finity 1.3.0: acciones visuales por color comprobadas')
