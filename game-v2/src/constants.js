// Game dimensions
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Color palette (hex numbers for Phaser, strings for CSS)
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
  CYAN:        0x00bcd4,
};

// CSS hex strings
export const CSS = {
  BG:         '#050a14',
  RED:        '#c0392b',
  RED_BRIGHT: '#e74c3c',
  GOLD:       '#f1c40f',
  GREEN:      '#27ae60',
  WHITE:      '#ecf0f1',
  GRAY:       '#7f8c8d',
};

// Resource categories
export const RESOURCES = [
  { id: 'artillery',   name: '砲彈補給',   icon: '🔫', color: 0xe74c3c, desc: '砲兵彈藥與火力支援系統' },
  { id: 'air_defense', name: '防空系統',   icon: '🛡️', color: 0x3498db, desc: '飛彈攔截與防空武器' },
  { id: 'energy',      name: '能源安全',   icon: '⚡', color: 0xf1c40f, desc: '電網保護與能源基礎設施' },
  { id: 'logistics',   name: '後勤補給',   icon: '🚛', color: 0x27ae60, desc: '物資運輸與補給線維持' },
  { id: 'cyber',       name: '網路作戰',   icon: '💻', color: 0x9b59b6, desc: '電子戰與網路防禦攻擊' },
  { id: 'naval',       name: '海上力量',   icon: '⚓', color: 0x00bcd4, desc: '艦艇部署與海域控制' },
];

// Difficulty settings
export const DIFFICULTY = {
  easy:   { label: '簡單', timer: 120, eventCount: 1, intelAccuracy: 0.9 },
  normal: { label: '一般', timer: 90,  eventCount: 2, intelAccuracy: 0.6 },
  hard:   { label: '困難', timer: 60,  eventCount: 3, intelAccuracy: 0.3 },
};

// Score grades
export const GRADES = [
  { min: 90, grade: 'S', label: '完美配置', color: 0xf1c40f },
  { min: 75, grade: 'A', label: '優秀策略', color: 0x27ae60 },
  { min: 55, grade: 'B', label: '尚可接受', color: 0x3498db },
  { min: 35, grade: 'C', label: '勉強及格', color: 0xe67e22 },
  { min: 0,  grade: 'D', label: '資源錯配', color: 0xe74c3c },
];
