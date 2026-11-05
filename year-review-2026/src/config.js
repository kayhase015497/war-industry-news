const q = new URLSearchParams(location.search);
export const RENDERER = (q.get('renderer') || 'auto').toLowerCase();
export const DEBUG = q.has('debug');
export const IN_FRAME = window.self !== window.top;
export const IS_TOUCH = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
export const IS_MOBILE = Math.min(window.innerWidth, window.innerHeight) < 700 || (IS_TOUCH && window.innerWidth < 900);
export const GESTURE_MODE = IN_FRAME && IS_TOUCH && IS_MOBILE;
export const WM_BASE = import.meta.env.DEV ? '/__wm/' : '../../war-map/';
export const TEX_WIDTH = IS_MOBILE ? 4096 : 6144;
export const TYPE_COLOR = {
  confirmed: '#e74c3c', dam: '#e74c3c', capital: '#f1c40f', city: '#f1c40f',
  possible: '#64B5F6', high_recovery: '#1E88E5', medium_recovery: '#64B5F6', seismic: '#e67e22'
};
export const typeColor = t => TYPE_COLOR[t] || '#27ae60';
export const typePulse = t => t === 'confirmed' || t === 'dam';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
