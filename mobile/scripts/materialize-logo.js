const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'assets', 'logo-source');
const out = path.join(root, 'assets', 'lulu-logo.jpg');

const parts = fs.readdirSync(sourceDir)
  .filter((name) => /^part-\d+\.txt$/.test(name))
  .sort();

if (!parts.length) throw new Error('No se encontraron partes del logo.');

const base64 = parts.map((name) => fs.readFileSync(path.join(sourceDir, name), 'utf8').trim()).join('');
fs.writeFileSync(out, Buffer.from(base64, 'base64'));
console.log(`Logo materializado: ${out}`);
