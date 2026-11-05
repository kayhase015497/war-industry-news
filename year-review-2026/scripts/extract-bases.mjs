import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.resolve(root, '../war-map/military-bases-world.html'), 'utf8');
const m = html.match(/const B\s*=\s*(\[[\s\S]*?\]);\s*\n/);
if (!m) { console.log('bases: 找不到資料，略過'); process.exit(0); }
const B = vm.runInNewContext(m[1]);
const out = B.filter(b => Number.isFinite(b[0]) && Number.isFinite(b[1])).map(b => [
  +b[0].toFixed(3), +b[1].toFixed(3),
  b[9] === 'Nuclear weapons' ? 1 : b[11] === 'Drone Base' ? 2 : b[10] === 'NATO' ? 3 : 0,
  b[2], b[3], b[4]
]);
fs.writeFileSync(path.join(root, 'public/bases.json'), JSON.stringify(out));
console.log(`bases: ${out.length} 座`);
