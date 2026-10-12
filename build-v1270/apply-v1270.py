from pathlib import Path
import json
import sys

root = Path(sys.argv[1]).resolve()

def edit(name, old, new):
    path = root / name
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise RuntimeError(f'{name}: expected one patch anchor: {old[:70]}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

for name in ['package.json', 'package-lock.json']:
    path = root / name
    data = json.loads(path.read_text(encoding='utf-8'))
    assert data['version'] == '1.2.6'
    data['version'] = '1.2.7'
    if name == 'package-lock.json':
        data['packages']['']['version'] = '1.2.7'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

edit('src/relay-protocol.js',
     'return safeUser(source.user || source.sender || source.fromUser || source.member || source);',
     '''const nested = record(source.user || source.sender || source.fromUser || source.member);
  const merged = { ...source };
  for (const [key, value] of Object.entries(nested)) {
    if (value !== undefined && value !== null && value !== '') merged[key] = value;
  }
  return safeUser(merged);''')

edit('src/main.js',
     'return data?.user || data?.sender || data?.fromUser || data?.member || {};',
     '''const nested = data?.user || data?.sender || data?.fromUser || data?.member || {};
  const merged = { ...data };
  for (const [key, value] of Object.entries(nested)) {
    if (value !== undefined && value !== null && value !== '') merged[key] = value;
  }
  return merged;''')
path = root / 'src/main.js'
main = path.read_text(encoding='utf-8')
anchor = 'const user = data?.user || data?.sender || data || {};'
assert main.count(anchor) == 3
main = main.replace(anchor, 'const user = cloudUser(data);')
main = main.replace('const user = source?.user || source?.sender || source || {};', 'const user = cloudUser(source);')
path.write_text(main, encoding='utf-8')
edit('src/main.js',
     "|| user.avatarMedium?.urlList?.[0]\n      || '';",
     "|| user.avatarMedium?.urlList?.[0]\n      || user.profilePictureUrl\n      || '';" )
edit('src/main.js',
     "uniqueId: String(user.uniqueId || user.displayId || user.userId || ''),",
     "uniqueId: String(user.uniqueId || user.displayId || user.userIdStr || user.userId || ''),")
edit('src/main.js',
     "nickname: String(user.nickname || user.displayName || user.uniqueId || 'Usuario'),",
     "nickname: String(user.nickname || user.nickName || user.displayName || user.uniqueId || 'Usuario'),")
edit('src/main.js',
     "profilePictureUrl: user.profilePicture?.urlList?.[0] || user.avatarThumb?.urlList?.[0] || ''",
     "profilePictureUrl: user.profilePicture?.urlList?.[0] || user.avatarThumb?.urlList?.[0] || user.profilePictureUrl || ''")

edit('src/text-processor.js',
     "prepare(String(value || '').replace(/^@/, ''), {",
     "prepare(String(value || '').replace(/^@/, '').replace(/[._]/g, ' '), {")
edit('src/text-processor.js',
     "const username = prepareUsername(message?.nickname || message?.uniqueId || '', options);",
     "const username = prepareUsername(message?.nickname || '', options);\n    if (!username.text) username.text = prepareUsername(message?.uniqueId || '', options).text;")
edit('src/renderer.js',
     "const name=window.LuluText?.prepareUsername(source,smartTextOptions())?.text||'Usuario';",
     "const name=window.LuluText?.prepareUsername(source,smartTextOptions())?.text||window.LuluText?.prepareUsername(message.uniqueId,smartTextOptions())?.text||'Usuario';")

edit('src/main.js', 'maxCommentDelaySeconds: 8,', 'maxCommentDelaySeconds: 8,\n  queueWaitSeconds: 0,')
edit('src/renderer.js',
     "$('queueLimitInput').value = settings.queueLimit;",
     "$('queueLimitInput').value = settings.queueLimit;\n  $('queueWaitInput').value = settings.queueWaitSeconds ?? 0;")
edit('src/renderer.js',
     "bindSetting('queueLimitInput', 'queueLimit', 'input', Number);",
     "bindSetting('queueLimitInput', 'queueLimit', 'input', Number);\n  bindSetting('queueWaitInput', 'queueWaitSeconds', 'input', value => clamp(value, 0, 600));")
edit('src/renderer.js',
     "const maxAge = clamp(state.settings.maxCommentDelaySeconds || 8, 3, 30) * 1000;\n  const originAt = Number(item.sourceTimestamp || item.queuedAt || 0);",
     "const maxAge = clamp(state.settings.queueWaitSeconds ?? 0, 0, 600) * 1000;\n  if (maxAge === 0) return false;\n  const originAt = Number(item.queuedAt || 0);")
old = '''  const queueLimit = Math.max(1, Number(state.settings.queueLimit) || 30);
  if (state.speechQueue.length >= queueLimit) {
    const replaceIndex = state.speechQueue.findIndex((queued) => !queued.priority);
    if (replaceIndex < 0) {
      releaseAudioLock(lockKey);
      return { added:false, reason:'cola ocupada por comandos prioritarios' };
    }
    const [replaced] = state.speechQueue.splice(replaceIndex, 1);
    releaseAudioLock(replaced.audioLockKey);
    updateCommentResult(replaced.id, 'skipped', 'reemplazado por un comentario más reciente');
  }
  state.speechQueue.push(item);'''
new = '''  const queueLimit = Math.round(clamp(state.settings.queueLimit || 30, 1, 100));
  state.speechQueue = state.speechQueue.filter((queued) => {
    if (!speechItemExpired(queued)) return true;
    releaseAudioLock(queued.audioLockKey);
    updateCommentResult(queued.id, 'skipped', 'comentario vencido');
    return false;
  });
  if (state.speechQueue.length >= queueLimit) {
    releaseAudioLock(lockKey);
    return { added:false, reason:'cola llena; se conservan los comentarios pendientes' };
  }
  const firstNormal = priority ? state.speechQueue.findIndex((queued) => !queued.priority) : -1;
  if (firstNormal >= 0) state.speechQueue.splice(firstNormal, 0, item);
  else state.speechQueue.push(item);'''
edit('src/renderer.js', old, new)
edit('src/index.html', '<label>Omitir después de</label>', '<label>Retraso máximo al recibir</label>')
edit('src/index.html',
     '<div class="tts-latency-grid">',
     '''<div class="field-group">
<label for="queueWaitInput">Espera máxima en cola (segundos)</label>
<input id="queueWaitInput" type="number" min="0" max="600" step="1" value="0"/>
<p class="hint">0 conserva los comentarios pendientes sin vencimiento.</p>
</div>
<div class="tts-latency-grid">''')
edit('src/index.html',
     'Lulu prepara solo el siguiente comentario. Si el chat se atrasa, omite mensajes viejos y conserva los comandos prioritarios.',
     'Lulu prepara solo el siguiente comentario. La cola conserva los mensajes aceptados; si está llena, los nuevos se marcan como omitidos. Los comandos de voz tienen prioridad.')
edit('src/index.html', 'v1.2.6', 'v1.2.7')

files = Path(__file__).parent / 'files/src'
for path in files.iterdir():
    (root / 'src' / path.name).write_bytes(path.read_bytes())
print('1.2.7: preserve user identity and accepted speech queue entries')
