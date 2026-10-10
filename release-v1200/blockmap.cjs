const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { buildBlockMap } = require('../tooling/node_modules/app-builder-lib/out/targets/blockmap/blockmap');

(async () => {
  const file = 'release-assets/Lulu-Finity-Setup-1.2.0.exe';
  const info = await buildBlockMap(file, 'gzip', file + '.blockmap');
  const latest = JSON.parse(fs.readFileSync('release-assets/latest.yml', 'utf8'));
  if (info.sha512 !== latest.sha512 || info.size !== latest.files[0].size) throw new Error('Block map changed installer');
  const map = JSON.parse(zlib.gunzipSync(fs.readFileSync(file + '.blockmap')));
  if (map.version !== '2' || map.files[0].sizes.reduce((a,b) => a+b,0) !== info.size) throw new Error('Invalid block map');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file + '.blockmap')).digest('hex');
  fs.appendFileSync('release-assets/SHA256SUMS.txt', hash + '  Lulu-Finity-Setup-1.2.0.exe.blockmap\n');
  console.log('Update block map verified against original installer.');
})().catch(error => { console.error(error); process.exitCode = 1; });
