import './style.css';
import { RENDERER, DEBUG, IS_MOBILE, WM_BASE, typeColor, typePulse, esc } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#yr-app');
const STATUS = { breaking: 'BREAKING', ongoing: 'ONGOING', resource: 'RESOURCE', reference: 'REFERENCE', resolved: 'RESOLVED' };
const TYPE_RANK = { confirmed: 0, dam: 0, capital: 1, city: 2, possible: 3 };
const seenKey = 'yr2026-seen';

let globe = null, idx, stats;
const byDate = [];
const state = { cats: new Set(), cutoff: null, sel: null, explored: new Set(), view: 'globe', playing: false };
const detailCache = new Map();

try { JSON.parse(localStorage.getItem(seenKey) || '[]').forEach(s => state.explored.add(s)); } catch (e) { /* storage unavailable */ }
const saveSeen = () => { try { localStorage.setItem(seenKey, JSON.stringify([...state.explored])); } catch (e) { /* ignore */ } };

const fetchJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); };
const fetchDetail = slug => detailCache.get(slug) || (detailCache.set(slug, fetchJson(WM_BASE + 'data/' + slug + '.json')), detailCache.get(slug));
const setLoading = t => { const e = $('#yr-loading-s'); if (e) e.textContent = t; };
const colorOf = m => idx.categories[m.category]?.color || '#8fa3c7';

async function boot() {
  setLoading('載入戰區索引…');
  [idx, stats] = await Promise.all([fetchJson('./index.json'), fetchJson('./stats.json')]);
  Object.keys(idx.categories).forEach(c => state.cats.add(c));
  const dates = [...new Set(idx.maps.filter(m => m.category !== 'reference').map(m => m.date))].sort();
  byDate.push(...dates);
  state.cutoff = dates.length - 1;
  buildUI();

  if (RENDERER !== 'none') {
    try {
      setLoading('初始化 3D 引擎…');
      const { createGlobe } = await import('./globe.js');
      globe = await createGlobe($('#yr-stage'));
      globe.onChange(scheduleOverlay);
    } catch (e) { console.warn('3D 初始化失敗，改用清單模式', e); globe = null; }
  }
  if (!globe) openList(true);
  buildBeacons(); refreshAll();
  if (DEBUG) startDebug();
  $('#yr-loading').classList.add('is-done');
  const h = decodeURIComponent(location.hash.slice(1));
  const hm = idx.maps.find(m => m.slug === h);
  if (hm) selectMap(hm);
}

/* ---------- UI scaffold ---------- */
function buildUI() {
  const n = idx.maps.length;
  app.insertAdjacentHTML('beforeend', `
    <div class="yr-top">
      <div class="yr-brand"><h1>2026 戰爭即工業力・<span>全球戰區地球儀</span></h1><p>${esc(stats.range[0])} → ${esc(stats.range[1])}｜${n} 張戰區地圖</p>
        <div class="yr-stats">
          <div class="yr-stat">已探索 <b id="yr-s-ex">0</b>/${n}</div>
          <div class="yr-stat">標記 <b>${stats.markers}</b></div>
          <div class="yr-stat yr-hide-m">確認事件 <b>${stats.confirmed}</b></div>
          <div class="yr-stat yr-hide-m" title="統計不含延伸參考">不含延伸參考</div>
        </div></div>
      <div class="yr-btns"><button class="yr-btn" id="yr-b-filter">篩選</button><button class="yr-btn" id="yr-b-list">清單</button></div>
    </div>
    <div class="yr-chips ${IS_MOBILE ? 'is-hidden' : ''}" id="yr-chips"></div>
    <div class="yr-timeline" id="yr-tl">
      <button class="yr-play" id="yr-play" aria-label="播放">▶</button>
      <div class="yr-tl"><input type="range" id="yr-range" min="0" max="${byDate.length - 1}" value="${state.cutoff}" step="1" aria-label="時間軸"><div class="yr-months" id="yr-months"></div></div>
      <div class="yr-date" id="yr-date"></div>
    </div>
    <div class="yr-card" id="yr-card"></div>
    <div class="yr-list" id="yr-list"></div>
    <div class="yr-overlay" id="yr-ov"><div class="yr-overlay__bar"><span id="yr-ov-t"></span><button class="yr-btn" id="yr-ov-x">✕ 關閉</button></div><iframe id="yr-ov-f" title="戰區地圖" loading="lazy" allowfullscreen></iframe></div>`);

  $('#yr-chips').innerHTML = Object.entries(idx.categories).map(([k, c]) => `<button class="yr-chip is-on" data-c="${k}" style="--c:${c.color}"><i></i>${esc(c.label)}</button>`).join('');
  $('#yr-chips').addEventListener('click', e => {
    const b = e.target.closest('.yr-chip'); if (!b) return;
    const k = b.dataset.c; state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
    b.classList.toggle('is-on', state.cats.has(k)); refreshAll();
  });
  $('#yr-b-filter').addEventListener('click', () => { $('#yr-chips').classList.toggle('is-hidden'); $('#yr-b-filter').classList.toggle('is-on'); });
  $('#yr-b-list').addEventListener('click', () => (state.view === 'list' && globe ? closeList() : openList()));

  const months = [...new Set(byDate.map(d => d.slice(5, 7)))];
  $('#yr-months').innerHTML = months.map(m => `<span>${+m}月</span>`).join('');
  $('#yr-range').addEventListener('input', e => { stopPlay(); setCutoff(+e.target.value); });
  $('#yr-play').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));
  $('#yr-ov-x').addEventListener('click', closeOverlay);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#yr-ov').classList.contains('is-open')) closeOverlay(); else if (state.sel) closeCard(); } });
  updateDateLabel();
}

const visible = m => state.cats.has(m.category) && (m.category === 'reference' || m.date <= byDate[state.cutoff]);
function updateDateLabel() { $('#yr-date').textContent = byDate[state.cutoff]; $('#yr-s-ex').textContent = [...state.explored].filter(s => idx.maps.some(m => m.slug === s)).length; }

/* ---------- timeline ---------- */
let playTimer = null;
function setCutoff(i, flash) {
  const prev = state.cutoff; state.cutoff = i; $('#yr-range').value = i; updateDateLabel();
  if (flash) for (const m of idx.maps) if (m.category !== 'reference' && m.date > byDate[prev] && m.date <= byDate[i]) { const b = beacons.get(m.slug); if (b) { b.classList.remove('is-new'); void b.offsetWidth; b.classList.add('is-new'); } }
  refreshAll();
}
function startPlay() {
  state.playing = true; $('#yr-play').textContent = '❚❚';
  if (state.cutoff >= byDate.length - 1) setCutoff(0);
  playTimer = setInterval(() => { if (state.cutoff >= byDate.length - 1) return stopPlay(); setCutoff(state.cutoff + 1, true); }, 380);
}
function stopPlay() { state.playing = false; $('#yr-play').textContent = '▶'; clearInterval(playTimer); }

/* ---------- beacons + clustering ---------- */
const beacons = new Map(); const clusterPool = [];
function buildBeacons() {
  const layer = $('#yr-beacons');
  for (const m of idx.maps) {
    const b = document.createElement('button');
    b.className = 'yr-bc' + (m.status === 'breaking' ? ' is-breaking' : '') + (m.category === 'reference' ? ' is-ref' : '');
    b.innerHTML = '<i></i>'; b.style.setProperty('--c', colorOf(m)); b.title = m.shortTitle + '（' + m.date + '）'; b.setAttribute('aria-label', m.shortTitle);
    b.addEventListener('click', () => selectMap(m));
    layer.appendChild(b); beacons.set(m.slug, b);
  }
}
let raf = 0;
function scheduleOverlay() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateBeacons(); updateMarkers(); }); }
function refreshAll() { updateDateLabel(); renderList(); scheduleOverlay(); }

function updateBeacons() {
  if (!globe || state.view === 'list') { beacons.forEach(b => (b.style.display = 'none')); clusterPool.forEach(c => (c.style.display = 'none')); return; }
  const R = IS_MOBILE ? 30 : 26; const items = [];
  for (const m of idx.maps) {
    const b = beacons.get(m.slug);
    b.classList.toggle('is-seen', state.explored.has(m.slug));
    b.classList.toggle('is-sel', state.sel?.m === m);
    b.classList.toggle('is-dim', !!state.sel && state.sel.m !== m);
    if (!visible(m)) { b.style.display = 'none'; continue; }
    const p = globe.project(m.anchor[0], m.anchor[1]);
    if (!p.visible) { b.style.display = 'none'; continue; }
    items.push({ m, b, p });
  }
  const used = new Set(); const clusters = [];
  if (!state.sel) {
    for (const it of items) {
      if (used.has(it)) continue;
      const g = items.filter(o => !used.has(o) && Math.hypot(o.p.x - it.p.x, o.p.y - it.p.y) < R);
      if (g.length > 1) { g.forEach(o => used.add(o)); clusters.push(g); }
    }
  }
  for (const it of items) {
    if (used.has(it)) { it.b.style.display = 'none'; continue; }
    it.b.style.display = ''; it.b.style.transform = `translate(${it.p.x}px,${it.p.y}px)`;
  }
  clusters.forEach((g, i) => {
    let c = clusterPool[i];
    if (!c) { c = document.createElement('button'); c.className = 'yr-cl'; c.addEventListener('click', () => clusterClick(c._g)); $('#yr-beacons').appendChild(c); clusterPool[i] = c; }
    c._g = g;
    const x = g.reduce((s, o) => s + o.p.x, 0) / g.length, y = g.reduce((s, o) => s + o.p.y, 0) / g.length;
    c.style.display = ''; c.textContent = g.length; c.style.transform = `translate(${x}px,${y}px)`;
    c.setAttribute('aria-label', g.length + ' 張地圖');
  });
  for (let i = clusters.length; i < clusterPool.length; i++) clusterPool[i].style.display = 'none';
}

function clusterClick(g) {
  const lat = g.reduce((s, o) => s + o.m.anchor[0], 0) / g.length;
  const lngs = g.map(o => o.m.anchor[1]);
  const spread = Math.max(...g.map(o => Math.hypot(o.m.anchor[0] - lat, (o.m.anchor[1] - lngs[0]))));
  if (spread < 0.4 || globe.state.dist < 1.6) return showChooser(g.map(o => o.m));
  let lng = lngs.reduce((s, x) => s + x, 0) / lngs.length;
  globe.flyTo({ lat, lng, dist: Math.max(1.35, globe.state.dist * 0.5) }, 900);
}

/* ---------- selected-map markers ---------- */
let markerEls = [];
function renderMarkers() {
  const layer = $('#yr-markers'); layer.innerHTML = ''; markerEls = [];
  if (!state.sel) return;
  const locs = [...(state.sel.d.locations || [])].sort((a, b) => (TYPE_RANK[a.type] ?? 4) - (TYPE_RANK[b.type] ?? 4));
  for (const l of locs) {
    const el = document.createElement('button');
    el.className = 'yr-mk' + (typePulse(l.type) ? ' is-pulse' : '');
    el.style.setProperty('--c', typeColor(l.type));
    const base = String(l.nameLocal || l.name || '').split('・')[0];
    const name = base.replace(/（[^）]*）/g, '').trim() || base;
    el.innerHTML = `<i></i><span>${esc(name)}</span>`;
    el.addEventListener('click', () => showMarker(l));
    layer.appendChild(el); markerEls.push({ el, l, w: 0 });
  }
  updateMarkers();
}
function updateMarkers() {
  if (!globe || !markerEls.length) return;
  const placed = [];
  for (const m of markerEls) {
    const p = globe.project(m.l.latlng[0], m.l.latlng[1]);
    if (!p.visible) { m.el.classList.add('is-hidden'); continue; }
    m.el.classList.remove('is-hidden');
    if (!m.w) { m.w = m.el.querySelector('span').offsetWidth + 14; m.tw = m.el.offsetWidth; }
    const flip = p.x + m.w > globe.size.w - 6;
    m.el.classList.toggle('is-flip', flip);
    m.el.style.transform = `translate(${flip ? p.x - m.tw : p.x}px,${p.y - 8}px)`;
    const r = flip ? { x0: p.x - m.w, x1: p.x, y0: p.y - 17, y1: p.y + 1 } : { x0: p.x, x1: p.x + m.w, y0: p.y - 17, y1: p.y + 1 };
    const hit = placed.some(o => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
    m.el.classList.toggle('no-label', hit);
    if (!hit) placed.push(r); else placed.push({ x0: p.x - 6, x1: p.x + 6, y0: p.y - 14, y1: p.y - 2 });
  }
}

/* ---------- selection / card ---------- */
async function selectMap(m, variantSlug) {
  stopPlay(); closeList();
  const slug = variantSlug || m.slug; let d;
  try { d = await fetchDetail(slug); } catch (e) { console.warn(e); return; }
  const first = !state.sel || state.sel.m !== m;
  state.sel = { m, slug, d }; state.explored.add(m.slug); saveSeen();
  history.replaceState(null, '', '#' + m.slug);
  if (globe) {
    globe.showMap(d);
    if (first) { const f = globe.fitFor(m.bbox); globe.flyTo(f, 1500); }
    applyFocusOffset();
  }
  renderMarkers(); renderCard(); refreshAll();
}
function applyFocusOffset() {
  if (!globe) return;
  const { w, h } = globe.size;
  if (!state.sel) return globe.setFocusOffset(0, 0);
  if (w > 900) globe.setFocusOffset(Math.round(Math.min(380, w * 0.38) / 2 + 6), 0);
  else globe.setFocusOffset(0, Math.round(h * 0.24));
}
function closeCard() {
  state.sel = null; $('#yr-card').classList.remove('is-open');
  if (globe) { globe.clearMap(); applyFocusOffset(); globe.flyTo({ lat: globe.state.lat, lng: globe.state.lng, dist: globe.homeDist() }, 1000); setTimeout(() => globe.resumeAutoRotate(), 6000); }
  history.replaceState(null, '', location.pathname + location.search);
  renderMarkers(); refreshAll();
}
function renderCard() {
  const { m, slug, d } = state.sel; const cat = idx.categories[m.category];
  const vars = m.variants?.length ? `<div class="yr-vars">${m.variants.map(v => `<button class="yr-var ${v.slug === slug ? 'is-on' : ''}" data-v="${esc(v.slug)}">${esc(v.label)}</button>`).join('')}</div>` : '';
  const rel = (m.related || []).map(s => idx.maps.find(x => x.slug === s)).filter(Boolean);
  const relHtml = rel.length ? `<div class="yr-rel"><h4>相關地圖</h4>${rel.map(r => `<button data-r="${esc(r.slug)}">${esc(r.shortTitle)}</button>`).join('')}</div>` : '';
  const paras = (d.infoPanel?.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('');
  const card = $('#yr-card');
  card.innerHTML = `<div class="yr-card__hd"><button class="yr-card__x" aria-label="關閉">✕</button>
      <div class="yr-card__meta"><span class="yr-tag" style="--c:${cat?.color}">${esc(cat?.label)}</span><span class="yr-tag yr-tag--${esc(m.status)}">${STATUS[m.status] || ''}</span><span>${esc(m.date)}</span></div>
      <h2>${esc(d.meta?.title || m.title)}</h2></div>
    <div class="yr-card__bd" id="yr-cbd"><div id="yr-mkd"></div>${vars}${paras}${relHtml}
      <div class="yr-note">⚠️ 地球儀上的位置與範圍為示意，精確內容與來源請進入戰區地圖查看。</div></div>
    <button class="yr-go">進入戰區地圖 ›</button>`;
  card.classList.add('is-open');
  $('.yr-card__x', card).onclick = closeCard;
  $('.yr-go', card).onclick = () => openOverlay(state.sel.slug, d.meta?.title || m.title);
  card.querySelectorAll('.yr-var').forEach(b => (b.onclick = () => selectVariant(b.dataset.v)));
  card.querySelectorAll('[data-r]').forEach(b => (b.onclick = () => selectMap(idx.maps.find(x => x.slug === b.dataset.r))));
}
async function selectVariant(slug) {
  const d = await fetchDetail(slug); state.sel = { ...state.sel, slug, d };
  if (globe) globe.showMap(d);
  renderMarkers(); renderCard();
}
function showMarker(l) {
  $('#yr-mkd').innerHTML = `<div class="yr-mkd"><button class="yr-mkd__x" aria-label="收起">✕</button><h3>${esc(l.nameLocal || l.name)}</h3>
    ${l.tag ? `<span class="yr-tag" style="--c:${typeColor(l.type)}">${esc(l.tag)}</span>` : ''}<p style="margin:6px 0 0">${esc(l.desc)}</p>
    <small>📍 ${esc(l.coords || '')}｜${esc(l.source || '')}</small></div>`;
  $('#yr-mkd .yr-mkd__x').onclick = () => ($('#yr-mkd').innerHTML = '');
  $('#yr-cbd').scrollTop = 0; $('#yr-card').classList.add('is-open');
}
function showChooser(ms) {
  state.sel = null; renderMarkers();
  const card = $('#yr-card');
  card.innerHTML = `<div class="yr-card__hd"><button class="yr-card__x" aria-label="關閉">✕</button><h2>此處有 ${ms.length} 張地圖</h2></div>
    <div class="yr-card__bd">${ms.map(m => `<button class="yr-li" data-s="${esc(m.slug)}" style="--c:${colorOf(m)}"><i></i><span><b>${esc(m.shortTitle)}</b><small>${esc(m.date)}</small></span></button>`).join('')}</div>`;
  card.classList.add('is-open'); $('.yr-card__x', card).onclick = () => card.classList.remove('is-open');
  card.querySelectorAll('[data-s]').forEach(b => (b.onclick = () => selectMap(idx.maps.find(x => x.slug === b.dataset.s))));
}

/* ---------- overlay (siterep) ---------- */
function openOverlay(slug, title) {
  $('#yr-ov-t').textContent = title; $('#yr-ov-f').src = WM_BASE + 'siterep.html?d=' + encodeURIComponent(slug); $('#yr-ov').classList.add('is-open');
}
function closeOverlay() { $('#yr-ov').classList.remove('is-open'); $('#yr-ov-f').src = 'about:blank'; }

/* ---------- list view / fallback ---------- */
function openList(forced) {
  state.view = 'list'; $('#yr-list').classList.add('is-open'); $('#yr-b-list').classList.add('is-on'); $('#yr-b-list').textContent = forced ? '清單' : '地球';
  if (forced) $('#yr-b-list').style.display = 'none';
  renderList(); updateBeacons();
}
function closeList() { if (state.view !== 'list' || !globe) return; state.view = 'globe'; $('#yr-list').classList.remove('is-open'); $('#yr-b-list').classList.remove('is-on'); $('#yr-b-list').textContent = '清單'; refreshAll(); }
function renderList() {
  if (state.view !== 'list') return;
  const groups = {};
  [...idx.maps].sort((a, b) => b.date.localeCompare(a.date)).forEach(m => { (groups[m.date.slice(0, 7)] ||= []).push(m); });
  $('#yr-list').innerHTML = Object.entries(groups).map(([k, ms]) => `<h3>${k}</h3>` + ms.map(m => `<button class="yr-li ${state.cats.has(m.category) ? '' : 'is-off'}" data-s="${esc(m.slug)}" style="--c:${colorOf(m)}"><i></i><span><b>${esc(m.shortTitle)}</b><small>${esc(m.date)}｜${esc(idx.categories[m.category]?.label)}${m.variants ? '｜多版本' : ''}</small></span></button>`).join('')).join('');
  $('#yr-list').onclick = e => { const b = e.target.closest('[data-s]'); if (b) selectMap(idx.maps.find(x => x.slug === b.dataset.s)); };
}

/* ---------- debug ---------- */
function startDebug() {
  const d = document.createElement('div'); d.className = 'yr-debug'; app.appendChild(d);
  setInterval(() => { const i = globe?.info?.(); d.textContent = `backend: ${globe ? globe.backend : 'none'}\nfps: ${globe ? globe.fps.value : '-'}\ncalls: ${i ? i.calls : '-'}  tris: ${i ? i.triangles : '-'}\nrenderer param: ${RENDERER}`; }, 500);
}

boot().catch(e => { console.error(e); setLoading('載入失敗：' + e.message); });
