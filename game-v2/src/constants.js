// Game dimensions
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Color palette
export const C = {
  BG:          0x050a14,
  PANEL:       0x0d1b2a,
  PANEL_LIGHT: 0x112233,
  BORDER:      0x1e3a5f,
  RED:         0xc0392b,
  RED_BRIGHT:  0xe74c3c,
  NAVY:        0x1a237e,
  GOLD:        0xf1c40f,
  GREEN:       0x27ae60,
  GREEN_BRIGHT:0x2ecc71,
  WHITE:       0xecf0f1,
  LIGHT_GRAY:  0xbdc3c7,
  GRAY:        0x7f8c8d,
  DIM:         0x34495e,
  ORANGE:      0xe67e22,
  PURPLE:      0x9b59b6,
  CYAN:        0x00bcd4,
};

// ── 資源類別（對齊原版 game.html）─────────────────────────────────
export const RESOURCES = [
  { id: 'shell',     name: '砲彈',        icon: '💥', color: 0xe74c3c, desc: '傳統砲兵彈藥、地面火力' },
  { id: 'drone',     name: '無人機／飛彈', icon: '🚁', color: 0x9b59b6, desc: '精準打擊、偵搜、防區外武器' },
  { id: 'intercept', name: '攔截彈',      icon: '🛡️', color: 0x3498db, desc: '防空系統、反飛彈' },
  { id: 'energy',    name: '能源',        icon: '⛽', color: 0xf1c40f, desc: '燃料、電力、後勤動能' },
  { id: 'mineral',   name: '礦產',        icon: '⛏️', color: 0x27ae60, desc: '關鍵原材料、工業生產鏈' },
];

// ── 難度設定 ──────────────────────────────────────────────────────
// Easy  → pts_standard(20 點均分), 倒數 120 秒, 1 個事件
// Normal → pts_realistic(真實工業力), 倒數 90 秒, 2 個事件
// Hard  → pts_realistic, 倒數 60 秒, 3 個事件
export const DIFFICULTY = {
  easy:   { label: '簡單', timer: 120, eventCount: 1, useRealistic: false },
  normal: { label: '一般', timer: 90,  eventCount: 2, useRealistic: true  },
  hard:   { label: '困難', timer: 60,  eventCount: 3, useRealistic: true  },
};

// ── 評分等級 ──────────────────────────────────────────────────────
export const GRADES = [
  { min: 90, grade: 'S', label: '完美配置', color: 0xf1c40f },
  { min: 75, grade: 'A', label: '優秀策略', color: 0x27ae60 },
  { min: 55, grade: 'B', label: '尚可接受', color: 0x3498db },
  { min: 35, grade: 'C', label: '勉強及格', color: 0xe67e22 },
  { min: 0,  grade: 'D', label: '資源錯配', color: 0xe74c3c },
];
