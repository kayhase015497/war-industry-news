import * as THREE from 'three/webgpu';
import { float, vec3, normalView, normalWorld, positionViewDirection, smoothstep, texture, uniform, mix, pass } from 'three/tsl';
import { geoEquirectangular, geoPath, geoGraticule, geoBounds } from 'd3-geo';
import { feature } from 'topojson-client';
import { RENDERER, IS_MOBILE, GESTURE_MODE, TEX_WIDTH } from './config.js';
import { ll2v, clamp, angularDistance, lineMesh, polygonMeshes, pulseRing, widthScale } from './geo.js';
import { paintBasemap, borderLines, land50 } from './basemap.js';

const D2R = Math.PI / 180;
const MIN_DIST = 1.1, MAX_DIST = 6.5;
const PATCH_N = IS_MOBILE ? 1536 : 2048;
const BASE_COLORS = [0x58a6ff, 0xff4433, 0xffc21f, 0xb48cff];

export async function createGlobe(container) {
  const state = { lat: 20, lng: 60, dist: 3.4 };
  const listeners = new Set(), tapListeners = new Set();
  let needsRender = true, flight = null, vel = { lat: 0, lng: 0 };
  let lastInteract = performance.now(), lastChange = 0, lastRender = 0, lastTick = 0;
  let autoRotate = true, focusX = 0, focusY = 0, w = 1, h = 1, moved = 0;

  const dprMax = Math.min(window.devicePixelRatio || 1, 2);
  let pr = dprMax;
  const renderer = new THREE.WebGPURenderer({ antialias: dprMax < 1.8, forceWebGL: RENDERER === 'webgl' });
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x04060c, 1);
  container.appendChild(renderer.domElement);
  await renderer.init();
  const backend = renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  const lightDir = uniform(new THREE.Vector3(0, 0, 1));

  function shaded(map, transparent = false) {
    const m = new THREE.MeshBasicNodeMaterial({ transparent, depthWrite: !transparent });
    const tx = texture(map);
    const lamb = normalWorld.dot(lightDir).clamp(0, 1);
    const rim = normalView.dot(positionViewDirection).clamp(0, 1).pow(0.4);
    const shade = lamb.mul(0.45).add(0.78).mul(mix(float(0.62), float(1.0), rim));
    m.colorNode = tx.rgb.mul(shade);
    if (transparent) m.opacityNode = tx.a;
    return m;
  }

  function sphereGeometry(nx, ny, lat0 = -90, lat1 = 90, lng0 = -180, lng1 = 180, r = 1) {
    const pos = [], nor = [], uv = [], idx = [];
    const v = new THREE.Vector3();
    for (let j = 0; j <= ny; j++) {
      const lat = lat0 + ((lat1 - lat0) * j) / ny;
      for (let i = 0; i <= nx; i++) {
        const lng = lng0 + ((lng1 - lng0) * i) / nx;
        ll2v(lat, lng, 1, v); nor.push(v.x, v.y, v.z);
        ll2v(lat, lng, r, v); pos.push(v.x, v.y, v.z); uv.push(i / nx, j / ny);
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  const tex = new THREE.CanvasTexture(paintBasemap(TEX_WIDTH));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(16, renderer.getMaxAnisotropy?.() || 8);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const globe = new THREE.Mesh(sphereGeometry(160, 80), shaded(tex));
  scene.add(globe);
  const borders3d = borderLines(land50);
  scene.add(borders3d);

  const atmoMat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const facing = normalView.dot(positionViewDirection).negate();
  const glow = float(0.78).sub(facing.oneMinus().mul(0.55)).clamp(0, 1).pow(3.2).mul(smoothstep(0.0, 0.18, facing));
  atmoMat.colorNode = vec3(0.30, 0.58, 1.0);
  atmoMat.opacityNode = glow.mul(0.9);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 48), atmoMat));
  scene.add(starfield());

  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  function starfield() {
    const n = IS_MOBILE ? 900 : 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 18 + Math.random() * 10;
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9db8e8, size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }));
  }

  /* ---------- 高精度細節貼片（放大時以 10m 向量重繪視野範圍） ---------- */
  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = patchCanvas.height = PATCH_N;
  const patchTex = new THREE.CanvasTexture(patchCanvas);
  patchTex.colorSpace = THREE.SRGBColorSpace;
  patchTex.anisotropy = tex.anisotropy; patchTex.generateMipmaps = true; patchTex.minFilter = THREE.LinearMipmapLinearFilter;
  const patch = new THREE.Mesh(new THREE.BufferGeometry(), shaded(patchTex, true));
  patch.visible = false; patch.renderOrder = -1; scene.add(patch);
  let topo10 = null, topo10Promise = null, patchInfo = null, patchBusy = false;

  let landPolys = null, countryFeats = null;
  const loadTopo10 = () => topo10Promise || (topo10Promise = import('world-atlas/countries-10m.json').then(m => {
    topo10 = m.default || m;
    const lf = feature(topo10, topo10.objects.land);
    const geoms = lf.type === 'FeatureCollection' ? lf.features.map(f => f.geometry) : [lf.geometry];
    const polys = geoms.flatMap(g => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]));
    landPolys = polys.map(c => { const g = { type: 'Polygon', coordinates: c }; return { g, b: geoBounds(g) }; });
    countryFeats = feature(topo10, topo10.objects.countries).features.map(f => ({ g: f, b: geoBounds(f) }));
    return topo10;
  }));
  function hits(b, lngC, hw, s, n) {
    if (b[1][1] < s || b[0][1] > n) return false;
    const ivs = b[0][0] <= b[1][0] ? [[b[0][0], b[1][0]]] : [[b[0][0], 180], [-180, b[1][0]]];
    for (const [a, z] of ivs) for (const k of [-360, 0, 360]) if (a < lngC + k + hw && z > lngC + k - hw) return true;
    return false;
  }

  let patchMs = 0;
  function paintPatch(latC, lngC, half) {
    const t0 = performance.now();
    const n = Math.min(89, latC + half), s = Math.max(-89, latC - half), latSpan = n - s;
    const lngHalf = Math.min(179, half / Math.max(0.2, Math.cos(latC * D2R))), lngSpan = lngHalf * 2;
    const N = PATCH_N, sx = N / lngSpan, sy = N / latSpan;
    const ctx = patchCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, N, N);
    ctx.fillStyle = '#07101e'; ctx.fillRect(0, 0, N, N);
    ctx.setTransform(sx, 0, 0, sy, N / 2, n * sy);
    const proj = geoEquirectangular().scale(180 / Math.PI).rotate([-lngC, 0]).translate([0, 0]).precision(0.05);
    const path = geoPath(proj, ctx);
    const px = 1 / ((sx + sy) / 2);
    ctx.beginPath(); path(geoGraticule().step([5, 5])()); ctx.strokeStyle = 'rgba(100,150,210,0.18)'; ctx.lineWidth = 1 * px; ctx.stroke();
    if (half < 14) { ctx.beginPath(); path(geoGraticule().step([1, 1])()); ctx.strokeStyle = 'rgba(100,150,210,0.07)'; ctx.lineWidth = 1 * px; ctx.stroke(); }
    const lp = landPolys.filter(x => hits(x.b, lngC, lngHalf, s, n)), cf = countryFeats.filter(x => hits(x.b, lngC, lngHalf, s, n));
    ctx.beginPath(); lp.forEach(x => path(x.g)); ctx.fillStyle = '#15233a'; ctx.fill();
    ctx.beginPath(); cf.forEach(x => path(x.g)); ctx.strokeStyle = 'rgba(130,180,235,0.5)'; ctx.lineWidth = 1.2 * px; ctx.stroke();
    ctx.beginPath(); lp.forEach(x => path(x.g)); ctx.strokeStyle = 'rgba(150,205,255,0.8)'; ctx.lineWidth = 1.4 * px; ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.8, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N); ctx.globalCompositeOperation = 'source-over';
    patchTex.needsUpdate = true;
    patch.geometry.dispose();
    patch.geometry = sphereGeometry(40, 40, s, n, lngC - lngHalf, lngC + lngHalf, 1.0004);
    patch.visible = true; borders3d.visible = false;
    patchInfo = { lat: latC, lng: lngC, dist: state.dist, half }; patchMs = Math.round(performance.now() - t0);
    needsRender = true;
  }

  async function updatePatch() {
    if (patchBusy) return;
    if (state.dist > 2.5) { if (patch.visible) { patch.visible = false; borders3d.visible = true; needsRender = true; } return; }
    const half = clamp((state.dist - 1) * 26, 6, 46);
    if (patchInfo && patch.visible && Math.abs(Math.log(half / patchInfo.half)) < 0.14 && angularDistance([state.lat, state.lng], [patchInfo.lat, patchInfo.lng]) < patchInfo.half * 0.3) return;
    patchBusy = true;
    try { await loadTopo10(); paintPatch(state.lat, state.lng, half); } catch (e) { console.warn('detail patch failed', e); } finally { patchBusy = false; }
  }

  /* ---------- 後處理（高畫質：bloom） ---------- */
  let pipeline = null, bloomOn = false;
  async function setQuality(q) {
    if (q === 'high' && !pipeline) {
      try {
        const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
        pipeline = new THREE.RenderPipeline(renderer);
        const sp = pass(scene, camera), col = sp.getTextureNode('output');
        pipeline.outputNode = col.add(bloom(col, 0.7, 0.5, 0.8));
      } catch (e) { console.warn('bloom unavailable', e); pipeline = null; return false; }
    }
    bloomOn = q === 'high' && !!pipeline; needsRender = true; return bloomOn;
  }

  /* ---------- 軍事基地圖層 ---------- */
  let basesMesh = null, basesRim = null, basesDist = 0;
  const baseObj = new THREE.Object3D(), baseCol = new THREE.Color();
  function layoutBases() {
    const rows = basesMesh.userData.rows, k = state.dist * 0.00098 * (IS_MOBILE ? 2.2 : 2.5);
    rows.forEach((r, i) => {
      const sc = k * (r[2] ? 1.45 : 1);
      baseObj.position.copy(ll2v(r[0], r[1], 1.0013)); baseObj.lookAt(baseObj.position.clone().multiplyScalar(2));
      baseObj.scale.setScalar(sc); baseObj.updateMatrix(); basesMesh.setMatrixAt(i, baseObj.matrix);
      baseObj.position.copy(ll2v(r[0], r[1], 1.0009)); baseObj.scale.setScalar(sc * 1.4); baseObj.updateMatrix(); basesRim.setMatrixAt(i, baseObj.matrix);
    });
    basesMesh.instanceMatrix.needsUpdate = true; basesRim.instanceMatrix.needsUpdate = true; basesDist = state.dist;
  }
  function setBases(rows) {
    if (basesMesh) return;
    const geo = new THREE.CircleGeometry(1, 16);
    basesMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }), rows.length);
    basesRim = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }), rows.length);
    basesRim.renderOrder = 2; basesMesh.renderOrder = 3;
    basesMesh.userData.rows = rows;
    rows.forEach((r, i) => basesMesh.setColorAt(i, baseCol.setHex(BASE_COLORS[r[2]] ?? BASE_COLORS[0])));
    basesMesh.instanceColor.needsUpdate = true;
    layoutBases();
    basesMesh.visible = basesRim.visible = false; scene.add(basesRim, basesMesh);
  }
  function showBases(on) { if (basesMesh) { basesMesh.visible = basesRim.visible = on; if (on) layoutBases(); needsRender = true; } }
  function pickBase(x, y, radius = 16) {
    if (!basesMesh?.visible) return -1;
    let best = -1, bd = radius;
    basesMesh.userData.rows.forEach((r, i) => {
      const p = project(r[0], r[1]); if (!p.visible) return;
      const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /* ---------- 相機 ---------- */
  const camDir = new THREE.Vector3(), camRight = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function applyCamera() {
    ll2v(state.lat, state.lng, state.dist, camera.position);
    camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    if (focusX || focusY) camera.setViewOffset(w, h, focusX, focusY, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camDir.copy(camera.position).normalize(); camRight.crossVectors(UP, camDir).normalize();
    widthScale.value = clamp(state.dist / 2.1, 0.4, 3);
    lightDir.value.copy(camDir).addScaledVector(camRight, -0.55).addScaledVector(UP, 0.45).normalize();
  }

  function homeDist() {
    const vh = (camera.fov * D2R) / 2, hh = Math.atan(Math.tan(vh) * camera.aspect);
    return clamp(1 / Math.sin(Math.min(vh, hh) * 0.93), 2.4, MAX_DIST);
  }

  function resize() {
    w = container.clientWidth || 1; h = container.clientHeight || 1;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    if (!resize.done) { state.dist = homeDist(); resize.done = true; }
    needsRender = true; emit();
  }
  new ResizeObserver(resize).observe(container);

  function emit() { lastChange = performance.now(); for (const f of listeners) f(); }
  const wrapLng = x => ((x + 180) % 360 + 360) % 360 - 180;

  function touchInteract() { lastInteract = performance.now(); flight = null; autoRotate = false; }
  function rotateBy(dx, dy) {
    const k = 0.13 * (state.dist - 1);
    state.lng = wrapLng(state.lng - dx * k); state.lat = clamp(state.lat + dy * k, -85, 85);
    vel.lng = -dx * k; vel.lat = dy * k; moved += Math.abs(dx) + Math.abs(dy); needsRender = true; emit();
  }
  function zoomBy(f) { state.dist = clamp(state.dist * f, MIN_DIST, MAX_DIST); moved += 10; needsRender = true; emit(); }

  const el = renderer.domElement;
  const pts = new Map();
  let pinch0 = null;
  const pinchDist = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
  if (!GESTURE_MODE) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; touchInteract(); if (pts.size === 2) pinch0 = pinchDist(); });
    el.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) rotateBy(dx, dy);
      else if (pts.size === 2) { const d = pinchDist(); if (pinch0) zoomBy(pinch0 / d); pinch0 = d; }
      touchInteract();
    });
    const up = e => { pts.delete(e.pointerId); pinch0 = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); touchInteract(); }, { passive: false });
  } else {
    el.style.touchAction = 'pan-y';
    let last = null, hintTimer;
    const hint = document.createElement('div'); hint.className = 'yr-hint'; hint.textContent = '雙指旋轉／縮放地球儀'; container.appendChild(hint);
    const mid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) });
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { hint.classList.add('show'); clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.remove('show'), 1200); }
      if (e.touches.length >= 2) { e.preventDefault(); last = mid(e.touches); touchInteract(); }
    }, { passive: false });
    el.addEventListener('touchmove', e => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      const m = mid(e.touches);
      if (last) { rotateBy(m.x - last.x, m.y - last.y); zoomBy(last.d / m.d); }
      last = m; touchInteract();
    }, { passive: false });
    el.addEventListener('touchend', () => { last = null; });
  }
  el.addEventListener('click', e => {
    if (moved > 6) return;
    const r = el.getBoundingClientRect();
    for (const f of tapListeners) f(e.clientX - r.left, e.clientY - r.top);
  });

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function flyTo({ lat, lng, dist }, ms = 1400) {
    const a0 = { lat: state.lat, lng: state.lng, dist: state.dist };
    const travel = angularDistance([a0.lat, a0.lng], [lat, lng]);
    flight = { t0: performance.now(), ms, a0, dl: wrapLng(lng - state.lng), lat, dist: dist ?? state.dist, bump: Math.min(1.1, travel / 110) };
    autoRotate = false; lastInteract = performance.now(); vel = { lat: 0, lng: 0 };
  }

  const fps = { frames: 0, t: performance.now(), value: 0, good: 0 };
  function adaptPixelRatio() {
    if (fps.frames >= 12 && fps.frames < 32 && pr > 1) { pr = Math.max(1, +(pr - 0.25).toFixed(2)); fps.good = 0; resize(); }
    else if (fps.frames >= 57 && pr < dprMax && ++fps.good >= 4) { pr = Math.min(dprMax, +(pr + 0.25).toFixed(2)); fps.good = 0; resize(); }
    else if (fps.frames < 57) fps.good = 0;
  }

  let prev = performance.now();
  function tick(now) {
    const idleRotate = autoRotate && !flight && pts.size === 0 && Math.abs(vel.lat) < 0.01 && Math.abs(vel.lng) < 0.01;
    if (idleRotate && now - lastTick < 30) return;
    lastTick = now;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    let moving = false;
    if (flight) {
      const t = clamp((now - flight.t0) / flight.ms, 0, 1), e = ease(t);
      state.lat = flight.a0.lat + (flight.lat - flight.a0.lat) * e;
      state.lng = wrapLng(flight.a0.lng + flight.dl * e);
      state.dist = clamp(flight.a0.dist + (flight.dist - flight.a0.dist) * e + flight.bump * Math.sin(Math.PI * t) * flight.a0.dist * 0.35, MIN_DIST, MAX_DIST);
      needsRender = true; moving = true; if (t >= 1) flight = null; emit();
    } else if (pts.size === 0 && (Math.abs(vel.lat) > 0.01 || Math.abs(vel.lng) > 0.01)) {
      state.lng = wrapLng(state.lng + vel.lng); state.lat = clamp(state.lat + vel.lat, -85, 85);
      const f = Math.pow(0.04, dt); vel.lat *= f; vel.lng *= f; needsRender = true; moving = true; emit();
    } else if (autoRotate && now - lastInteract > 2500) {
      state.lng = wrapLng(state.lng + 3.5 * dt); needsRender = true; emit();
    }
    if (!needsRender && mapGroup.children.length && now - lastRender > 33) needsRender = true;
    if (needsRender) {
      if (basesMesh?.visible && Math.abs(state.dist - basesDist) / basesDist > 0.04) layoutBases();
      applyCamera();
      if (bloomOn && pipeline) pipeline.render(); else renderer.render(scene, camera);
      needsRender = false; lastRender = now; fps.frames++;
    }
    if (!moving && pts.size === 0 && now - lastChange > 260) updatePatch();
    if (now - fps.t > 1000) { fps.value = fps.frames; adaptPixelRatio(); fps.frames = 0; fps.t = now; }
  }
  renderer.setAnimationLoop(tick);
  resize();

  const v3 = new THREE.Vector3();
  function project(lat, lng) {
    ll2v(lat, lng, 1.0, v3);
    const facingDot = v3.dot(camDir);
    const visible = facingDot > 1 / state.dist + 0.015;
    const p = v3.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible, facing: facingDot };
  }

  function clearMap() {
    mapGroup.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    mapGroup.clear(); needsRender = true;
  }

  function showMap(d) {
    clearMap();
    for (const pg of d.polygons || []) {
      mapGroup.add(polygonMeshes(pg.points, { fillColor: pg.fillColor, fillOpacity: pg.fillOpacity ?? 0.4, borderColor: pg.borderColor || pg.fillColor, borderWeight: pg.borderWeight, borderOpacity: pg.borderOpacity ?? 0.9, dash: pg.borderDashArray }));
    }
    for (const ln of d.lines || []) {
      const m = lineMesh(ln.points, { color: ln.color, weight: ln.weight, opacity: ln.opacity ?? 0.85, dash: ln.dashArray });
      if (m) mapGroup.add(m);
    }
    for (const layer of d.geojsonLayers || []) addGeoJson(layer);
    (d.locations || []).filter(l => l.type === 'confirmed' || l.type === 'dam').slice(0, 14)
      .forEach((l, i) => mapGroup.add(pulseRing(l.latlng[0], l.latlng[1], '#ff5a4a', (i * 0.37) % 1)));
    needsRender = true;
  }

  function addGeoJson(layer) {
    const st = layer.style || {};
    const feats = layer.data?.type === 'FeatureCollection' ? layer.data.features : [layer.data];
    for (const f of feats) {
      const g = f.geometry || f, p = f.properties || {};
      const toLL = c => c.map(([lo, la]) => [la, lo]);
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const l of lines) { const m = lineMesh(toLL(l), { color: p.color || st.color || '#e67e22', weight: p.weight || st.weight || 2, opacity: p.opacity || st.opacity || 0.85, dash: p.dashArray || st.dashArray }); if (m) mapGroup.add(m); }
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) mapGroup.add(polygonMeshes(toLL(poly[0]), { fillColor: p.fillColor || st.fillColor || p.color || st.color || '#e67e22', fillOpacity: p.fillOpacity ?? st.fillOpacity ?? 0.3, borderColor: p.color || st.color || '#e67e22' }));
    }
  }

  function fitFor(bbox) {
    const [[s, w0], [n, e]] = bbox;
    const lat = (s + n) / 2, lng = wrapLng((w0 + e) / 2);
    const latSpan = n - s, lngSpan = (e - w0) * Math.max(0.35, Math.cos(lat * D2R));
    const size = Math.max(latSpan, lngSpan, 3);
    const vfov = camera.fov * D2R, hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.min(1.6, camera.aspect));
    const half = Math.min(Math.tan(hfov / 2), Math.tan(vfov / 2) * 0.8);
    return { lat, lng, dist: clamp(1 + ((size * D2R * 1.45) / 2) / half, 1.18, 4.3) };
  }

  return {
    backend, canvas: el, fps, fitFor, homeDist, flyTo, project, showMap, clearMap, state, setQuality, setBases, showBases, pickBase, baseRow: i => basesMesh.userData.rows[i],
    onChange: f => { listeners.add(f); return () => listeners.delete(f); },
    onTap: f => { tapListeners.add(f); return () => tapListeners.delete(f); },
    setFocusOffset(x, y) { focusX = x; focusY = y; needsRender = true; emit(); },
    info: () => ({ ...renderer.info.render, pr, patch: patch.visible ? `on(${patchMs}ms)` : 'off', bloom: bloomOn }),
    resumeAutoRotate() { autoRotate = true; lastInteract = performance.now(); },
    stopAutoRotate() { autoRotate = false; },
    get size() { return { w, h }; },
    requestRender() { needsRender = true; }
  };
}
