import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDate, shortTitle, collectPoints, bboxOf, wrapLng, validatePoints, isRegional } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(root, '../war-map/data');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const errors = [], warnings = [];

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).sort();
const raw = {};
for (const f of files) {
  const slug = f.slice(0, -5);
  try { raw[slug] = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); }
  catch (e) { errors.push(`${slug}: JSON 無法解析 (${e.message})`); }
}

for (const slug of Object.keys(manifest.maps)) if (!raw[slug]) errors.push(`manifest 引用不存在的 slug: ${slug}`);
for (const [slug, m] of Object.entries(manifest.maps)) {
  for (const v of m.variants || []) if (!raw[v.slug]) errors.push(`${slug}: variants 引用不存在的 slug ${v.slug}`);
  for (const r of m.related || []) if (!raw[r]) errors.push(`${slug}: related 引用不存在的 slug ${r}`);
}

const maps = [];
for (const [slug, d] of Object.entries(raw)) {
  const mf = manifest.maps[slug] || {};
  if (mf.include === false) continue;
  if (!manifest.maps[slug]) warnings.push(`${slug}: manifest 沒有條目，使用預設分類 reference`);
  const meta = d.meta || {};
  const date = parseDate(mf.displayDate) || parseDate(meta.date);
  if (!date) { errors.push(`${slug}: 日期無法解析 (${meta.date}) 且 manifest 未提供 displayDate`); continue; }
  const pts = collectPoints(d);
  const bad = validatePoints(pts);
  if (bad.length) errors.push(`${slug}: ${bad.length} 個座標超出範圍，例如 ${JSON.stringify(bad[0])}`);
  if (!meta.theme) warnings.push(`${slug}: theme 為 null`);
  const bbox = bboxOf(pts);
  const confirmed = (d.locations || []).find(l => l.type === 'confirmed' || l.type === 'dam');
  const regional = mf.regional ?? isRegional(bbox);
  let anchor = mf.anchor || (!regional && confirmed ? confirmed.latlng : d.map?.center);
  if (!anchor) { errors.push(`${slug}: 無法決定 anchor`); continue; }
  anchor = [anchor[0], wrapLng(anchor[1])];
  const cat = mf.category || 'reference';
  if (!manifest.categories[cat]) errors.push(`${slug}: 未知分類 ${cat}`);
  maps.push({
    slug, title: meta.title || slug, shortTitle: mf.shortTitle || shortTitle(meta.title || slug),
    date, category: cat, status: meta.status || 'ongoing', theme: meta.theme || null,
    anchor, bbox, regional,
    counts: { loc: (d.locations || []).length, poly: (d.polygons || []).length, line: (d.lines || []).length },
    summary: String((d.infoPanel?.paragraphs || [])[0] || '').slice(0, 140),
    series: mf.series || null, featured: !!mf.featured,
    variants: mf.variants || null, related: mf.related || null,
    hasGeo: Array.isArray(d.geojsonLayers) && d.geojsonLayers.length > 0
  });
}

const titles = new Map();
for (const m of maps) {
  const k = m.shortTitle + m.date;
  if (titles.has(k)) warnings.push(`近重複: ${m.slug} 與 ${titles.get(k)} (同標題同日期)`);
  else titles.set(k, m.slug);
}

maps.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));

const counted = maps.filter(m => m.category !== 'reference');
const byMonth = {}, byCategory = {};
for (const m of counted) byMonth[m.date.slice(0, 7)] = (byMonth[m.date.slice(0, 7)] || 0) + 1;
for (const m of maps) byCategory[m.category] = (byCategory[m.category] || 0) + 1;
let markers = 0, confirmedN = 0;
for (const m of counted) {
  markers += m.counts.loc;
  for (const v of (m.variants?.length ? [m.variants[0]] : [{ slug: m.slug }])) {
    confirmedN += (raw[v.slug].locations || []).filter(l => l.type === 'confirmed' || l.type === 'dam').length;
  }
}
const stats = {
  generated: new Date().toISOString().slice(0, 10),
  total: maps.length, counted: counted.length, markers, confirmed: confirmedN,
  breaking: counted.filter(m => m.status === 'breaking').length,
  range: [counted[0]?.date, counted[counted.length - 1]?.date],
  byMonth, byCategory
};

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/index.json'), JSON.stringify({ categories: manifest.categories, maps }));
fs.writeFileSync(path.join(root, 'public/stats.json'), JSON.stringify(stats));

console.log(`index: ${maps.length} 張（統計用 ${counted.length}）｜警告 ${warnings.length}｜錯誤 ${errors.length}`);
warnings.forEach(w => console.log('  ⚠', w));
errors.forEach(e => console.log('  ✖', e));
if (errors.length) process.exit(1);
