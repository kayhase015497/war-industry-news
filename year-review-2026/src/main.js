import './style.css';
import { RENDERER, DEBUG, IS_MOBILE, WM_BASE, typeColor, typePulse, esc } from './config.js';
import { sfx } from './sfx.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#yr-app');
const STATUS = { breaking: 'BREAKING', ongoing: 'ONGOING', resource: 'RESOURCE', reference: 'REFERENCE', resolved: 'RESOLVED' };
const TYPE_RANK = { confirmed: 0, dam: 0, capital: 1, city: 2, possible: 3 };
const seenKey = 'yr2026-seen';

let globe = null, idx, stats;
const byDate = [];
const state = { cats: new Set(), cutoff: null, sel: null, explored: new Set(), view: 'globe', playing: false, tour: null, bases: false, quality: 'std', toasted: new Set() };
const BASE_FLAG = ['一般基地', '核武基地', '無人機基地', 'NATO 基地'];
const BASE_HEX = ['#58a6ff', '#ff4433', '#ffc21f', '#b48cff'];
const detailCache = new Map();

try { JSON.parse(localStorage.getItem(seenKey) || '[]').forEach(s => state.explored.add(s)); } catch (e) { /* storage unavailable */ }
const saveSeen = () => { try { localStorage.setItem(seenKey, JSON.stringify([...state.explored])); } catch (e) { /* ignore */ } };

const fetchJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); };
const fetchDetail = slug => detailCache.get(slug) || (detailCache.set(slug, fetchJson(WM_BASE + 'data/' + slug + '.json')), detailCache.get(slug));
const setLoading = t => { const e = $('#yr-loading-s'); if (e) e.textContent = t; };
const ICON = {
  base: '<svg class="yr-ico" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/></svg>',
  spark: '<svg class="yr-ico" viewBox="0 0 24 24"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></svg>',
  snd: '<svg class="yr-ico" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11"/></svg>'
};
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
      globe.onTap(onGlobeTap);
      ['pointerdown', 'wheel', 'touchstart'].forEach(ev => globe.canvas.addEventListener(ev, () => { if (state.tour) stopTour(); }, { passive: true }));
      try { if (localStorage.getItem('yr2026-q') === 'high') toggleQuality(true); } catch (e) { /* ignore */ }
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
      <div class="yr-btns"><button class="yr-btn" id="yr-b-tour">導覽</button><button class="yr-btn" id="yr-b-filter">篩選</button><button class="yr-btn" id="yr-b-list">清單</button></div>
    </div>
    <div class="yr-chips ${IS_MOBILE ? 'is-hidden' : ''}" id="yr-chips"></div>
    <div class="yr-timeline" id="yr-tl">
      <button class="yr-play" id="yr-play" aria-label="播放">▶</button>
      <div class="yr-tl"><input type="range" id="yr-range" min="0" max="${byDate.length - 1}" value="${state.cutoff}" step="1" aria-label="時間軸"><div class="yr-months" id="yr-months"></div></div>
      <div class="yr-date" id="yr-date"></div>
    </div>
    <div class="yr-tour is-hidden" id="yr-tour"></div>
    <div class="yr-toasts" id="yr-toasts"></div>
    <div class="yr-tip is-hidden" id="yr-tip"></div>
    <div class="yr-legend is-hidden" id="yr-legend"></div>
    <div class="yr-card" id="yr-card"></div>
    <div class="yr-list" id="yr-list"></div>
    <div class="yr-overlay" id="yr-ov"><div class="yr-overlay__bar"><span id="yr-ov-t"></span><button class="yr-btn" id="yr-ov-x">✕ 關閉</button></div><iframe id="yr-ov-f" title="戰區地圖" loading="lazy" allowfullscreen></iframe></div>`);

  const cnt = c => idx.maps.filter(m => m.category === c).length;
  $('#yr-chips').innerHTML = Object.entries(idx.categories).map(([k, c]) => `<button class="yr-chip is-on" data-c="${k}" style="--c:${c.color}"><i></i>${esc(c.label)}<em>${cnt(k)}</em></button>`).join('')
    + `<span class="yr-tools"><button class="yr-btn" id="yr-t-bases" aria-pressed="false">${ICON.base}軍事基地</button><button class="yr-btn" id="yr-t-q" aria-pressed="false">${ICON.spark}高畫質</button><button class="yr-btn" id="yr-t-snd" aria-pressed="false">${ICON.snd}音效</button></span>`;
  $('#yr-chips').addEventListener('click', e => {
    const b = e.target.closest('.yr-chip'); if (!b) return;
    const k = b.dataset.c; state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
    b.classList.toggle('is-on', state.cats.has(k)); refreshAll();
  });
  $('#yr-b-filter').addEventListener('click', () => { $('#yr-chips').classList.toggle('is-hidden'); $('#yr-b-filter').classList.toggle('is-on'); });
  $('#yr-b-tour').addEventListener('click', () => (state.tour ? stopTour() : startTour()));
  $('#yr-t-bases').addEventListener('click', toggleBases);
  $('#yr-t-q').addEventListener('click', toggleQuality);
  $('#yr-t-snd').addEventListener('click', toggleSound);
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
async function selectMap(m, variantSlug, fromTour) {
  if (!fromTour && state.tour) stopTour();
  stopPlay(); closeList();
  const slug = variantSlug || m.slug; let d;
  try { d = await fetchDetail(slug); } catch (e) { console.warn(e); return; }
  const first = !state.sel || state.sel.m !== m;
  state.sel = { m, slug, d }; state.explored.add(m.slug); saveSeen(); sfx.play('select'); checkAchievements(m);
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
  if (state.tour) stopTour();
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
  const chain = m.series ? idx.maps.filter(x => x.series === m.series).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const ci = chain.indexOf(m);
  const chainHtml = chain.length > 1 ? `<div class="yr-chain"><button data-ch="-1" ${ci <= 0 ? 'disabled' : ''}>‹ 上一則</button><span>戰役鏈・${esc(idx.seriesLabels?.[m.series] || '')}（${ci + 1}/${chain.length}）</span><button data-ch="1" ${ci >= chain.length - 1 ? 'disabled' : ''}>下一則 ›</button></div>` : '';
  const card = $('#yr-card');
  card.innerHTML = `<div class="yr-card__hd"><button class="yr-card__x" aria-label="關閉">✕</button>
      <div class="yr-card__meta"><span class="yr-tag" style="--c:${cat?.color}">${esc(cat?.label)}</span><span class="yr-tag yr-tag--${esc(m.status)}">${STATUS[m.status] || ''}</span><span>${esc(m.date)}</span></div>
      <h2>${esc(d.meta?.title || m.title)}</h2></div>
    <div class="yr-card__bd" id="yr-cbd"><div id="yr-mkd"></div>${chainHtml}${vars}${paras}${relHtml}
      <div class="yr-note">⚠️ 地球儀上的位置與範圍為示意，精確內容與來源請進入戰區地圖查看。</div></div>
    <button class="yr-go">進入戰區地圖 ›</button>`;
  card.classList.add('is-open');
  $('.yr-card__x', card).onclick = closeCard;
  $('.yr-go', card).onclick = () => openOverlay(state.sel.slug, d.meta?.title || m.title);
  card.querySelectorAll('[data-ch]').forEach(b => (b.onclick = () => selectMap(chain[ci + +b.dataset.ch])));
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


/* ---------- toast / achievements / summary ---------- */
function toast(msg, kind) {
  const box = $('#yr-toasts'); const t = document.createElement('div'); t.className = 'yr-toast'; t.textContent = msg; box.appendChild(t);
  if (kind === 'ach') sfx.play('chime');
  setTimeout(() => t.classList.add('is-out'), 3200); setTimeout(() => t.remove(), 3800);
}
function exploredCount() { return idx.maps.filter(m => state.explored.has(m.slug)).length; }
function checkAchievements() {
  const n = exploredCount(), total = idx.maps.length;
  for (const [k, label] of [[1, '第一個戰區：探索開始'], [10, '探索 10 個戰區'], [30, '探索 30 個戰區'], [total, '全部探索完成']]) {
    if (n >= k && !state.toasted.has('n' + k)) { state.toasted.add('n' + k); if (!(k === 1 && state.explored.size > 1)) toast('成就解鎖：' + label, 'ach'); if (k === total) setTimeout(() => showSummary('全部戰區探索完成'), 1200); }
  }
  for (const [c, def] of Object.entries(idx.categories)) {
    const ms = idx.maps.filter(m => m.category === c);
    if (ms.length > 1 && ms.every(m => state.explored.has(m.slug)) && !state.toasted.has('c' + c)) { state.toasted.add('c' + c); toast(`成就解鎖：「${def.label}」全數探索`, 'ach'); }
  }
  updateDateLabel();
}
function showSummary(title) {
  closeSummary();
  const months = Object.entries(stats.byMonth); const mx = Math.max(...months.map(x => x[1]));
  const cats = Object.entries(stats.byCategory);
  const el = document.createElement('div'); el.className = 'yr-sum'; el.id = 'yr-sum';
  el.innerHTML = `<div class="yr-sum__box"><button class="yr-card__x" aria-label="關閉">✕</button><h2>${esc(title)}</h2>
    <div class="yr-sum__nums"><div><b>${stats.counted}</b>張戰區地圖</div><div><b>${stats.markers}</b>個標記</div><div><b>${stats.confirmed}</b>確認事件</div><div><b>${stats.breaking}</b>則即時戰況</div></div>
    <div class="yr-sum__bars">${months.map(([k, v]) => `<div class="yr-bar"><i style="height:${Math.round((v / mx) * 70) + 6}px"></i><span>${+k.slice(5)}月</span><em>${v}</em></div>`).join('')}</div>
    <div class="yr-sum__cats">${cats.map(([k, v]) => `<span style="--c:${idx.categories[k].color}"><i></i>${esc(idx.categories[k].label)} ${v}</span>`).join('')}</div>
    <p class="yr-sum__n">統計不含延伸參考；已探索 ${exploredCount()}/${idx.maps.length}</p>
    <div class="yr-sum__btns"><button class="yr-btn" id="yr-sum-x">繼續探索</button><button class="yr-btn" id="yr-sum-r">重新探索</button></div></div>`;
  app.appendChild(el);
  $('.yr-card__x', el).onclick = closeSummary; $('#yr-sum-x').onclick = closeSummary;
  $('#yr-sum-r').onclick = () => { state.explored.clear(); state.toasted.clear(); saveSeen(); closeSummary(); refreshAll(); };
  sfx.play('chime');
}
function closeSummary() { $('#yr-sum')?.remove(); }

/* ---------- 自動導覽 ---------- */
function startTour() {
  const list = idx.maps.filter(m => m.featured && m.category !== 'reference').sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return;
  closeList(); closeSummary(); if (state.playing) stopPlay();
  if (state.sel) { state.sel = null; globe?.clearMap(); renderMarkers(); $('#yr-card').classList.remove('is-open'); }
  state.tour = { list, i: -1, timer: null }; $('#yr-b-tour').textContent = '停止'; $('#yr-b-tour').classList.add('is-on');
  setCutoff(0); sfx.play('whoosh'); tourNext();
}
function tourNext() {
  const t = state.tour; if (!t) return;
  t.i++;
  if (t.i >= t.list.length) { stopTour(); showSummary('2026 年度回顧'); return; }
  const m = t.list[t.i]; const di = byDate.findIndex(d => d >= m.date); setCutoff(di < 0 ? byDate.length - 1 : di, true);
  const bar = $('#yr-tour'); bar.classList.remove('is-hidden');
  bar.innerHTML = `<span>年度回顧 ${t.i + 1}/${t.list.length}・${+m.date.slice(5, 7)} 月</span><i style="--p:${((t.i + 1) / t.list.length) * 100}%"></i>`;
  selectMap(m, null, true);
  t.timer = setTimeout(tourNext, 9500);
}
function stopTour() {
  const t = state.tour; if (!t) return; clearTimeout(t.timer); state.tour = null;
  $('#yr-b-tour').textContent = '導覽'; $('#yr-b-tour').classList.remove('is-on'); $('#yr-tour').classList.add('is-hidden');
}

/* ---------- 工具：基地、畫質、音效 ---------- */
const setPressed = (id, on) => { const b = $(id); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); };
async function toggleBases() {
  if (!globe) return;
  state.bases = !state.bases; setPressed('#yr-t-bases', state.bases);
  if (state.bases) {
    try { const rows = await fetchJson('./bases.json'); globe.setBases(rows); } catch (e) { toast('基地資料載入失敗'); state.bases = false; setPressed('#yr-t-bases', false); return; }
  }
  globe.showBases(state.bases);
  const lg = $('#yr-legend'); lg.classList.toggle('is-hidden', !state.bases);
  lg.innerHTML = `<b>全球軍事基地 1,232 座</b>` + BASE_FLAG.map((t, i) => `<span><i style="background:${BASE_HEX[i]}"></i>${t}</span>`).join('') + '<small>World BEYOND War 資料・點基地看名稱</small>';
  if (!state.bases) $('#yr-tip').classList.add('is-hidden');
}
async function toggleQuality(silent) {
  if (!globe) return;
  const want = state.quality === 'std' || silent === true ? 'high' : 'std';
  const ok = await globe.setQuality(want);
  state.quality = want === 'high' && ok ? 'high' : 'std'; setPressed('#yr-t-q', state.quality === 'high');
  try { localStorage.setItem('yr2026-q', state.quality); } catch (e) { /* ignore */ }
  if (want === 'high' && !ok) toast('此裝置不支援輝光特效');
}
function toggleSound() { sfx.set(!sfx.enabled); setPressed('#yr-t-snd', sfx.enabled); sfx.play('select'); }
function onGlobeTap(x, y) {
  if (!state.bases) return;
  const i = globe.pickBase(x, y); const tip = $('#yr-tip');
  if (i < 0) return tip.classList.add('is-hidden');
  const r = globe.baseRow(i);
  tip.innerHTML = `<b>${esc(r[5])}</b><span>${esc(r[4])}・${esc(r[3])}</span><em style="color:${BASE_HEX[r[2]]}">${BASE_FLAG[r[2]]}</em>`;
  tip.style.transform = `translate(${Math.min(x + 12, globe.size.w - 230)}px,${Math.max(8, y - 12)}px)`; tip.classList.remove('is-hidden'); sfx.play('tick');
}

/* ---------- debug ---------- */
function startDebug() {
  const d = document.createElement('div'); d.className = 'yr-debug'; app.appendChild(d);
  setInterval(() => { const i = globe?.info?.(); d.textContent = `backend: ${globe ? globe.backend : 'none'}\nfps: ${globe ? globe.fps.value : '-'}  pixelRatio: ${i ? i.pr : '-'}\ncalls/frame: ${i ? i.frameCalls : '-'}  tris: ${i ? i.triangles : '-'}\ndetail patch: ${i ? i.patch : '-'}  bloom: ${i ? i.bloom : '-'}\nrenderer param: ${RENDERER}`; }, 500);
}

boot().catch(e => { console.error(e); setLoading('載入失敗：' + e.message); });
