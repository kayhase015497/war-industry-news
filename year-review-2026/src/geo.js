import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Delaunay } from 'd3-delaunay';

const D2R = Math.PI / 180;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function ll2v(lat, lng, r = 1, out = new THREE.Vector3()) {
  const la = lat * D2R, lo = lng * D2R;
  return out.set(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

export function angularDistance(a, b) {
  const va = ll2v(a[0], a[1]), vb = ll2v(b[0], b[1]);
  return Math.acos(clamp(va.dot(vb), -1, 1)) / D2R;
}

export function densifyGeodesic(points, stepDeg = 1.2, r = 1.0015) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = ll2v(points[i][0], points[i][1]);
    if (i === 0) { out.push(a.clone().multiplyScalar(r)); continue; }
    const p = ll2v(points[i - 1][0], points[i - 1][1]);
    const ang = Math.acos(clamp(p.dot(a), -1, 1));
    const n = Math.max(1, Math.ceil(ang / (stepDeg * D2R)));
    const sinA = Math.sin(ang);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      let v;
      if (sinA < 1e-6) v = a.clone();
      else v = p.clone().multiplyScalar(Math.sin((1 - t) * ang) / sinA).add(a.clone().multiplyScalar(Math.sin(t * ang) / sinA));
      out.push(v.normalize().multiplyScalar(r));
    }
  }
  return out;
}

function unwrap(points) {
  const out = []; let prev = null;
  for (const [la, lo] of points) {
    let x = lo;
    if (prev !== null) { while (x - prev > 180) x -= 360; while (x - prev < -180) x += 360; }
    out.push([x, la]); prev = x;
  }
  if (out.length > 2) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) out.pop();
  }
  return out;
}

function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function polygonFill(points, r = 1.001) {
  const ring = unwrap(points);
  if (ring.length < 3) return null;
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const span = Math.max(maxx - minx, maxy - miny);
  const step = clamp(span / 28, 0.02, 2);
  const boundary = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < k; j++) boundary.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  const pts = boundary.slice();
  for (let x = minx + step / 2; x < maxx; x += step)
    for (let y = miny + step / 2; y < maxy; y += step)
      if (inside(x, y, boundary)) pts.push([x, y]);
  const tri = Delaunay.from(pts).triangles;
  const index = [];
  for (let i = 0; i < tri.length; i += 3) {
    const a = pts[tri[i]], b = pts[tri[i + 1]], c = pts[tri[i + 2]];
    if (inside((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, boundary)) index.push(tri[i], tri[i + 1], tri[i + 2]);
  }
  if (!index.length) return null;
  const pos = new Float32Array(pts.length * 3);
  const v = new THREE.Vector3();
  pts.forEach((p, i) => { ll2v(p[1], p[0], r, v); pos.set([v.x, v.y, v.z], i * 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  return { geometry: g, outline: boundary.map(p => [p[1], p[0]]) };
}

export function tubeGeometry(vs, radius) {
  const pts = [];
  for (const v of vs) if (!pts.length || pts[pts.length - 1].distanceToSquared(v) > 1e-10) pts.push(v);
  if (pts.length < 2) return null;
  const R = 4, pos = [], idx = [];
  const t = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), a = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    t.subVectors(p1, p0).normalize();
    n.copy(pts[i]).normalize();
    b.crossVectors(t, n).normalize();
    for (let k = 0; k < R; k++) {
      const th = (k / R) * Math.PI * 2;
      a.copy(n).multiplyScalar(Math.cos(th) * radius).addScaledVector(b, Math.sin(th) * radius).add(pts[i]);
      pos.push(a.x, a.y, a.z);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < R; k++) {
    const k2 = (k + 1) % R, q0 = i * R + k, q1 = i * R + k2, q2 = (i + 1) * R + k, q3 = (i + 1) * R + k2;
    idx.push(q0, q2, q1, q1, q2, q3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function dashSegments(vs, onRad, offRad) {
  const out = []; let cur = [vs[0]]; let on = true; let left = onRad;
  for (let i = 1; i < vs.length; i++) {
    let a = vs[i - 1], b = vs[i];
    let len = a.distanceTo(b);
    while (len > left) {
      const t = left / len;
      const m = a.clone().lerp(b, t).normalize().multiplyScalar(a.length());
      if (on) { cur.push(m); out.push(cur); cur = []; } else { cur = [m]; }
      a = m; len = a.distanceTo(b); on = !on; left = on ? onRad : offRad;
    }
    left -= len;
    if (on) cur.push(b);
  }
  if (on && cur.length > 1) out.push(cur);
  return out;
}

export function lineMesh(points, { color = '#e67e22', weight = 2, opacity = 0.85, dash = null } = {}) {
  const vs = densifyGeodesic(points, 1.2, 1.0016);
  const radius = 0.0016 * clamp(weight, 1, 6) / 2.2 + 0.0008;
  let geos = [];
  if (dash) {
    const parts = String(dash).split(/[ ,]+/).map(Number).filter(n => n > 0);
    const on = (parts[0] || 6) * 0.0042, off = (parts[1] || parts[0] || 4) * 0.0042;
    if (parts.length && parts[0] > 0 && on + off > 0 && !(dash === '0')) geos = dashSegments(vs, on, off).map(s => tubeGeometry(s, radius)).filter(Boolean);
  }
  if (!geos.length) { const g = tubeGeometry(vs, radius); if (g) geos = [g]; }
  if (!geos.length) return null;
  const geometry = geos.length > 1 ? mergeGeometries(geos) : geos[0];
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: clamp(opacity + 0.1, 0.3, 1), depthWrite: false });
  return new THREE.Mesh(geometry, material);
}

export function polygonMeshes(points, { fillColor = '#e74c3c', fillOpacity = 0.4, borderColor = '#ffffff', borderWeight = 2, borderOpacity = 0.9, dash = null } = {}) {
  const res = polygonFill(points);
  const group = new THREE.Group();
  if (res) {
    const mat = new THREE.MeshBasicMaterial({ color: fillColor, transparent: true, opacity: clamp(fillOpacity, 0.1, 0.85), side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    group.add(new THREE.Mesh(res.geometry, mat));
    const ring = res.outline.concat([res.outline[0]]);
    const b = lineMesh(ring, { color: borderColor, weight: borderWeight, opacity: borderOpacity, dash });
    if (b) group.add(b);
  }
  return group;
}
