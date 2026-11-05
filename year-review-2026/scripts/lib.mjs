export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function shortTitle(title) {
  let t = String(title || '').trim();
  t = t.replace(/\s*[・\-－—]\s*\d{4}-\d{2}-\d{2}\s*$/, '');
  t = t.replace(/\s*[（(][^）)]*\d{4}[^）)]*[）)]\s*$/, '');
  return t.trim();
}

export function collectPoints(d) {
  const pts = [];
  for (const l of d.locations || []) if (Array.isArray(l.latlng)) pts.push(l.latlng);
  for (const p of d.polygons || []) for (const q of p.points || []) pts.push(q);
  for (const l of d.lines || []) for (const q of l.points || []) pts.push(q);
  return pts;
}

export function bboxOf(pts) {
  if (!pts.length) return null;
  let s = 90, n = -90, w = Infinity, e = -Infinity;
  for (const [la, lo] of pts) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
  return [[s, w], [n, e]];
}

export function wrapLng(lng) {
  let x = ((lng + 180) % 360 + 360) % 360 - 180;
  return x;
}

export function validatePoints(pts) {
  const bad = [];
  for (const p of pts) {
    if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number') { bad.push(p); continue; }
    if (p[0] < -90 || p[0] > 90 || p[1] < -180 || p[1] > 360) bad.push(p);
  }
  return bad;
}

export function isRegional(bbox, threshold = 25) {
  if (!bbox) return false;
  const [[s, w], [n, e]] = bbox;
  return (n - s) > threshold || (e - w) > threshold;
}
