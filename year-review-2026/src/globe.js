import * as THREE from 'three/webgpu';
import { float, vec3, normalView, positionViewDirection, smoothstep } from 'three/tsl';
import { RENDERER, DEBUG, IS_MOBILE, IS_TOUCH, GESTURE_MODE, TEX_WIDTH } from './config.js';
import { ll2v, clamp, angularDistance, lineMesh, polygonMeshes } from './geo.js';
import { paintBasemap, borderLines, land50 } from './basemap.js';

const D2R = Math.PI / 180;
const MIN_DIST = 1.12, MAX_DIST = 6.5;

export async function createGlobe(container) {
  const state = { lat: 20, lng: 60, dist: 3.4 };
  const listeners = new Set();
  let needsRender = true, flight = null, vel = { lat: 0, lng: 0 }, lastInteract = performance.now();
  let autoRotate = true, focusX = 0, focusY = 0, w = 1, h = 1;

  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: RENDERER === 'webgl' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x04060c, 1);
  container.appendChild(renderer.domElement);
  await renderer.init();
  const backend = renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);

  const tex = new THREE.CanvasTexture(paintBasemap(TEX_WIDTH));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.getMaxAnisotropy?.() || 4);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const globeGeo = sphereGeometry(160, 80);
  const globe = new THREE.Mesh(globeGeo, new THREE.MeshBasicMaterial({ map: tex }));
  scene.add(globe);
  scene.add(borderLines(land50));

  const atmoMat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const facing = normalView.dot(positionViewDirection).negate();
  const glow = float(0.78).sub(facing.oneMinus().mul(0.55)).clamp(0, 1).pow(3.2).mul(smoothstep(0.0, 0.18, facing));
  atmoMat.colorNode = vec3(0.30, 0.58, 1.0);
  atmoMat.opacityNode = glow.mul(0.9);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 48), atmoMat));

  scene.add(starfield());

  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  function sphereGeometry(nx, ny) {
    const pos = [], uv = [], idx = [];
    const v = new THREE.Vector3();
    for (let j = 0; j <= ny; j++) {
      const lat = -90 + (180 * j) / ny;
      for (let i = 0; i <= nx; i++) {
        const lng = -180 + (360 * i) / nx;
        ll2v(lat, lng, 1, v); pos.push(v.x, v.y, v.z); uv.push(i / nx, j / ny);
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  function starfield() {
    const n = IS_MOBILE ? 900 : 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 18 + Math.random() * 10;
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9db8e8, size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }));
  }

  function applyCamera() {
    ll2v(state.lat, state.lng, state.dist, camera.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    if (focusX || focusY) camera.setViewOffset(w, h, focusX, focusY, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function homeDist() {
    const vh = (camera.fov * D2R) / 2, hh = Math.atan(Math.tan(vh) * camera.aspect);
    return clamp(1 / Math.sin(Math.min(vh, hh) * 0.93), 2.4, MAX_DIST);
  }

  function resize() {
    w = container.clientWidth || 1; h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    if (!resize.done) { state.dist = homeDist(); resize.done = true; }
    needsRender = true; emit();
  }
  new ResizeObserver(resize).observe(container);

  function emit() { for (const f of listeners) f(); }
  const wrapLng = x => ((x + 180) % 360 + 360) % 360 - 180;

  function touchInteract() { lastInteract = performance.now(); flight = null; autoRotate = false; }
  function rotateBy(dx, dy) {
    const k = 0.13 * (state.dist - 1);
    state.lng = wrapLng(state.lng - dx * k); state.lat = clamp(state.lat + dy * k, -85, 85);
    vel.lng = -dx * k; vel.lat = dy * k; needsRender = true; emit();
  }
  function zoomBy(f) { state.dist = clamp(state.dist * f, MIN_DIST, MAX_DIST); needsRender = true; emit(); }

  const el = renderer.domElement;
  const pts = new Map();
  let pinch0 = null;
  if (!GESTURE_MODE) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); touchInteract(); if (pts.size === 2) pinch0 = pinchDist(); });
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
  function pinchDist() { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; }

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function flyTo({ lat, lng, dist }, ms = 1400) {
    let dl = wrapLng(lng - state.lng);
    const a0 = { lat: state.lat, lng: state.lng, dist: state.dist };
    const travel = angularDistance([a0.lat, a0.lng], [lat, lng]);
    flight = { t0: performance.now(), ms, a0, dl, lat, dist: dist ?? state.dist, bump: Math.min(1.1, travel / 110) };
    autoRotate = false; lastInteract = performance.now(); vel = { lat: 0, lng: 0 };
  }

  let prev = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    if (flight) {
      const t = clamp((now - flight.t0) / flight.ms, 0, 1), e = ease(t);
      state.lat = flight.a0.lat + (flight.lat - flight.a0.lat) * e;
      state.lng = wrapLng(flight.a0.lng + flight.dl * e);
      state.dist = clamp(flight.a0.dist + (flight.dist - flight.a0.dist) * e + flight.bump * Math.sin(Math.PI * t) * flight.a0.dist * 0.35, MIN_DIST, MAX_DIST);
      needsRender = true; if (t >= 1) flight = null; emit();
    } else if (pts.size === 0 && (Math.abs(vel.lat) > 0.01 || Math.abs(vel.lng) > 0.01)) {
      state.lng = wrapLng(state.lng + vel.lng); state.lat = clamp(state.lat + vel.lat, -85, 85);
      const f = Math.pow(0.04, dt); vel.lat *= f; vel.lng *= f; needsRender = true; emit();
    } else if (autoRotate && now - lastInteract > 2500) {
      state.lng = wrapLng(state.lng + 3.5 * dt); needsRender = true; emit();
    }
    if (needsRender) { applyCamera(); renderer.render(scene, camera); needsRender = false; fps.frames++; }
    if (now - fps.t > 1000) { fps.value = fps.frames; fps.frames = 0; fps.t = now; }
  }
  const fps = { frames: 0, t: performance.now(), value: 0 };
  renderer.setAnimationLoop(tick);
  resize();

  const v3 = new THREE.Vector3();
  function project(lat, lng) {
    ll2v(lat, lng, 1.0, v3);
    const camDir = camera.position.clone().normalize();
    const facing = v3.dot(camDir);
    const visible = facing > 1 / state.dist + 0.015;
    const p = v3.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible, facing };
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
    const dist = clamp(1 + ((size * D2R * 1.45) / 2) / half, 1.18, 4.3);
    return { lat, lng, dist };
  }

  return {
    backend, canvas: el, fps, fitFor, homeDist, flyTo, project, showMap, clearMap, state,
    onChange: f => { listeners.add(f); return () => listeners.delete(f); },
    setFocusOffset(x, y) { focusX = x; focusY = y; needsRender = true; emit(); },
    info: () => renderer.info.render,
    resumeAutoRotate() { autoRotate = true; lastInteract = performance.now(); },
    stopAutoRotate() { autoRotate = false; },
    get size() { return { w, h }; },
    requestRender() { needsRender = true; }
  };
}
