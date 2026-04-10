import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { sfxClick } from '../audio.js';

const PX = 48;          // left padding
const COL2 = 660;       // right column start
const CW   = 560;       // column width
const TOP  = 68;        // content area top
const LS   = 4;         // line spacing

export class InfoScene extends Phaser.Scene {
  constructor() {
    super('InfoScene');
    this._page = 0;
    this._containers = [];
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this._page = 0;

    // ── Background ──────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(C.BG, 0.94);
    bg.fillRect(0, 0, W, H);

    // Top bar
    bg.fillStyle(C.PANEL, 1);
    bg.fillRect(0, 0, W, 56);
    this.add.graphics().lineStyle(2, C.RED, 1).lineBetween(0, 56, W, 56);

    this.add.text(W / 2, 28, '方法論 · 資料說明', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '16px', fontStyle: 'bold', color: '#ecf0f1',
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.text(W - 24, 28, '✕ 關閉', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '13px', color: '#7f8c8d',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ecf0f1'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#7f8c8d'));
    closeBtn.on('pointerdown', () => {
      sfxClick();
      this.cameras.main.fade(300, 5, 10, 20);
      this.time.delayedCall(300, () => this.scene.start('MenuScene'));
    });

    // Bottom nav bar
    const navBg = this.add.graphics();
    navBg.fillStyle(C.PANEL, 1);
    navBg.fillRect(0, H - 52, W, 52);
    navBg.lineStyle(1, C.BORDER, 0.6);
    navBg.lineBetween(0, H - 52, W, H - 52);

    // Page dots
    this._dots = [0, 1].map(i => {
      const d = this.add.circle(W / 2 - 10 + i * 20, H - 26, 5, C.BORDER);
      return d;
    });

    // Prev / Next buttons
    this._prevBtn = this.add.text(PX, H - 26, '← 上一頁', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '13px', color: '#7f8c8d',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this._prevBtn.on('pointerover', () => this._prevBtn.setColor('#ecf0f1'));
    this._prevBtn.on('pointerout',  () => this._prevBtn.setColor('#7f8c8d'));
    this._prevBtn.on('pointerdown', () => { sfxClick(); this._setPage(this._page - 1); });

    this._nextBtn = this.add.text(W - PX, H - 26, '下一頁 →', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '13px', color: '#7f8c8d',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this._nextBtn.on('pointerover', () => this._nextBtn.setColor('#ecf0f1'));
    this._nextBtn.on('pointerout',  () => this._nextBtn.setColor('#7f8c8d'));
    this._nextBtn.on('pointerdown', () => { sfxClick(); this._setPage(this._page + 1); });

    // Column divider (used by both pages)
    const colDiv = this.add.graphics();
    colDiv.lineStyle(1, C.BORDER, 0.3);
    colDiv.lineBetween(W / 2, TOP + 10, W / 2, H - 60);

    // ── Build pages ──────────────────────────────────────────────────
    this._containers = [
      this._buildPage1(),
      this._buildPage2(),
    ];

    this._setPage(0);
    this.cameras.main.fadeIn(400, 5, 10, 20);
  }

  // ── Page navigation ─────────────────────────────────────────────

  _setPage(n) {
    this._page = Phaser.Math.Clamp(n, 0, this._containers.length - 1);
    this._containers.forEach((c, i) => c.setVisible(i === this._page));
    this._dots.forEach((d, i) => d.setFillStyle(i === this._page ? C.RED : C.BORDER));
    this._prevBtn.setAlpha(this._page > 0 ? 1 : 0.2);
    this._nextBtn.setAlpha(this._page < this._containers.length - 1 ? 1 : 0.2);
  }

  // ── Page 1: 計分公式 + 懲罰係數 ｜ 工業力方法論 ─────────────────

  _buildPage1() {
    const c = this.add.container(0, 0);
    let y = TOP;

    // ─── LEFT COLUMN ────────────────────────────────────────────────

    // Section: 計分公式
    c.add(this._sectionHead(PX, y, '如何計算得分'));  y += 22;
    c.add(this._body(PX, y, CW,
      '「你的配置比例」與「最優解比例」之差距決定得分，差距越小得分越高。'));
    y += 32;

    c.add(this._formula(PX, y,
      '偏差值 = Σ |（你的配置 ÷ 總點數）−（最優解比例）|'));
    y += 22;
    c.add(this._formula(PX, y,
      '得分   = max(0,  100 − 偏差值 × 100)'));
    y += 30;

    c.add(this._note(PX, y, CW,
      '為何用比例而非絕對點數？各國總點數差異懸殊（胡塞 4 點 vs 美國 95 點），\n用比例才能公平比較不同陣營的決策品質。'));
    y += 50;

    // Divider
    c.add(this._hdiv(PX, y, CW * 0.9));  y += 18;

    // Section: 國債公式
    c.add(this._sectionHead(PX, y, '國債變動公式'));  y += 22;
    c.add(this._formula(PX, y,
      '國債增減 = (1 − 得分/100) × 25 × 懲罰係數'));
    y += 26;
    c.add(this._note(PX, y, CW,
      '得分越低，國債增加越多。\n例：得分 60 分 → 台灣(×1.0)增加 10%；烏克蘭(×4.0)增加 40%。'));
    y += 42;

    // Divider
    c.add(this._hdiv(PX, y, CW * 0.9));  y += 18;

    // Section: 懲罰係數
    c.add(this._sectionHead(PX, y, '懲罰係數各國差異'));  y += 22;
    c.add(this._note(PX, y, CW,
      '係數反映各國財政脆弱性：小國犯錯代價遠高於大國。'));
    y += 20;

    const multRows = [
      ['🇺🇸 美國', '×0.03', '大國規模優勢，犯錯代價最低'],
      ['🇨🇳 中國', '×0.05', '大國規模優勢'],
      ['🇷🇺 俄羅斯', '×0.4', '中等強國'],
      ['🇮🇱 以色列', '×0.5', '小強國'],
      ['🇹🇼 台灣', '×1.0', '基準：小經濟體但供應鏈完整'],
      ['🌐 多線聯盟', '×1.5', '多戰線壓力放大財政脆弱性'],
      ['🇮🇷 伊朗', '×2.0', '受制裁，財政結構脆弱'],
      ['🇺🇦 烏克蘭', '×4.0', '戰地國家，配置錯誤代價最高'],
    ];
    multRows.forEach(([country, mult, desc], i) => {
      const ry = y + i * 24;
      c.add(this._val(PX,      ry, country));
      c.add(this._val(PX + 95, ry, mult, C.GOLD));
      c.add(this._note(PX + 140, ry, CW - 140, desc));
    });

    // ─── RIGHT COLUMN ────────────────────────────────────────────────
    let ry = TOP;

    c.add(this._sectionHead(COL2, ry, '工業力點數怎麼來'));  ry += 22;
    c.add(this._body(COL2, ry, CW,
      '真實難度的工業力點數，以「台灣 = 10 分」為基準，綜合以下 10 項指標\n相對比較，反映戰時軍事工業動員能力：'));
    ry += 42;

    const indicators = [
      ['① MVA 製造業增加值',    '實際工業產出規模，為最主要的權重指標'],
      ['② ECI 經濟複雜性指數',  '產品多樣性與精密度，反映高端軍工潛力（設有規模上限）'],
      ['③ 造艦噸位',            '最直接的軍工動員能力——造船 ≈ 裝甲/武器生產潛力'],
      ['④ 探明儲量',            '自有能源與礦產，決定戰時自給程度'],
      ['⑤ 關鍵礦物',            '鋰、鈷等精密武器不可或缺的原料'],
      ['⑥ 供應鏈韌性',          '被制裁或封鎖時，維持生產的抗壓能力'],
      ['⑦ PPI 生產者物價指數',  '武器生產成本壓力指標'],
      ['⑧ PPP 購買力平價',      '調整生產成本使各國可橫向比較'],
      ['⑨ 基礎設施',            '鐵路、港口、電網的戰時動員支撐力'],
      ['⑩ 能源成本',            '低能源成本可放大整體工業產出效率'],
    ];
    indicators.forEach(([name, desc], i) => {
      const iy = ry + i * 38;
      c.add(this._val(COL2, iy, name, C.CYAN));
      c.add(this._note(COL2, iy + 16, CW, desc));
    });

    ry += indicators.length * 38 + 10;
    c.add(this._hdiv(COL2, ry, CW * 0.9));  ry += 16;
    c.add(this._note(COL2, ry, CW,
      '中國造艦佔全球 55–60%（超過其他所有國家總和）；\n台灣 ECI 全球前五，但引入 MVA 規模上限，防止高精密小國超越體量天花板。'));

    return c;
  }

  // ── Page 2: 各國數據表 + 數據來源 ───────────────────────────────

  _buildPage2() {
    const c = this.add.container(0, 0);
    let y = TOP;

    // ─── LEFT COLUMN ────────────────────────────────────────────────

    c.add(this._sectionHead(PX, y, '各國工業力與財政數據'));  y += 24;

    // Table header
    const headers = ['國家', '工業力\n標準/真實', '起始國債', '懲罰係數'];
    const colXs   = [PX, PX + 120, PX + 235, PX + 335];
    headers.forEach((h, i) => {
      c.add(this.add.text(colXs[i], y, h, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px',
        fontStyle: 'bold', color: '#7f8c8d', lineSpacing: 2,
      }));
    });
    y += 36;

    const rows = [
      ['🇺🇸 美國',    '20 / 95', '122%',    '×0.03'],
      ['🇨🇳 中國',    '20 / 82', '83% *',   '×0.05'],
      ['🇷🇺 俄羅斯',  '20 / 40', '16%',     '×0.4'],
      ['🇮🇱 以色列',  '20 / 20', '67%',     '×0.5'],
      ['🇹🇼 台灣',    '20 / 10', '27% †',   '×1.0 (基準)'],
      ['🌐 多線聯盟',  '20 / 30', '60%',     '×1.5'],
      ['🇮🇷 伊朗',    '20 / 12', '30% ‡',   '×2.0'],
      ['🇺🇦 烏克蘭',  '20 / 8',  '90%',     '×4.0'],
      ['🏴 胡塞武裝', '4 / 4',   '特殊規則', '—'],
    ];

    rows.forEach((row, ri) => {
      const ry = y + ri * 28;
      if (ri % 2 === 0) {
        const stripe = this.add.graphics();
        stripe.fillStyle(C.PANEL_LIGHT, 0.25);
        stripe.fillRect(PX - 4, ry - 4, CW + 8, 26);
        c.add(stripe);
      }
      row.forEach((cell, ci) => {
        const isVal = ci > 0;
        c.add(this.add.text(colXs[ci], ry, cell, {
          fontFamily: isVal ? 'monospace' : "'Noto Sans TC', sans-serif",
          fontSize: '11px',
          color: ci === 3 ? '#f1c40f' : (ci === 0 ? '#ecf0f1' : '#bdc3c7'),
        }));
      });
    });

    y += rows.length * 28 + 16;

    // Source notes
    c.add(this._hdiv(PX, y, CW * 0.9));  y += 14;
    c.add(this._sectionHead(PX, y, '數據來源'));  y += 20;
    const notes = [
      '• 工業力點數：以台灣（10分）為基準，綜合 10 項指標相對比較',
      '• 國債/GDP：CEIC 2024（各國採中央政府口徑）',
      '• * 中國：IMF WEO 2024 廣義口徑，含地方政府融資平台（LGFV），',
      '       中央口徑僅 ~28%，廣義估算約 83%，本遊戲採後者',
      '• † 台灣：行政院主計總處（2024），台灣非 CEIC/IMF 成員',
      '• ‡ 伊朗：廣義估算值，制裁影響 CEIC 統計可信度',
    ];
    notes.forEach((n, i) => {
      c.add(this._note(PX, y + i * 18, CW, n));
    });

    // ─── RIGHT COLUMN ────────────────────────────────────────────────
    let ry = TOP;

    c.add(this._sectionHead(COL2, ry, '關鍵工業指標比較'));  ry += 24;

    const indHeaders = ['國家', '造艦全球佔比', '鋼鐵產量', '製造業PMI (2024)'];
    const indXs = [COL2, COL2 + 110, COL2 + 230, COL2 + 360];
    indHeaders.forEach((h, i) => {
      c.add(this.add.text(indXs[i], ry, h, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px',
        fontStyle: 'bold', color: '#7f8c8d', wordWrap: { width: 120 },
      }));
    });
    ry += 30;

    const indRows = [
      ['🇺🇸 美國',    '<1%',        '8,000萬噸',       '~46–48（長期收縮）'],
      ['🇨🇳 中國',    '55–60% ★',  '11億噸（全球54%）', '~49–51（榮枯線附近）'],
      ['🇷🇺 俄羅斯',  '~1%',        '7,600萬噸',       '~54–56 ⚠ 軍工動員'],
      ['🇮🇱 以色列',  '無商業造艦', '~100萬噸',         '~50–52'],
      ['🇹🇼 台灣',    '<1%',        '~2,100萬噸',      '~50–52（電子回升）'],
      ['🇮🇷 伊朗',    '波灣小型',   '~3,200萬噸',      '（制裁影響統計）'],
      ['🇺🇦 烏克蘭',  '船廠已損毀', '~700萬噸（戰時）', '~45–47（持續收縮）'],
    ];

    indRows.forEach((row, ri) => {
      const iRy = ry + ri * 32;
      if (ri % 2 === 0) {
        const stripe = this.add.graphics();
        stripe.fillStyle(C.PANEL_LIGHT, 0.25);
        stripe.fillRect(COL2 - 4, iRy - 4, CW + 8, 30);
        c.add(stripe);
      }
      row.forEach((cell, ci) => {
        const highlight = ci === 1 && row[1].includes('★');
        c.add(this.add.text(indXs[ci], iRy, cell, {
          fontFamily: ci === 0 ? "'Noto Sans TC', sans-serif" : 'monospace',
          fontSize: '10px',
          color: highlight ? C.RED_BRIGHT : (ci === 0 ? '#ecf0f1' : '#bdc3c7'),
          wordWrap: { width: 118 },
        }));
      });
    });

    ry += indRows.length * 32 + 16;
    c.add(this._hdiv(COL2, ry, CW * 0.9));  ry += 14;
    c.add(this._sectionHead(COL2, ry, '數據來源'));  ry += 20;
    const indNotes = [
      '• 造艦：Clarksons Research（2023）',
      '• 鋼鐵：世界鋼鐵協會（2023）',
      '• PMI：S&P Global / ISM（2024）',
      '• ⚠ 俄羅斯 PMI 54–56 為戰時軍工動員的重要預警指標',
      '• ★ 中國造艦佔比超過其他所有國家總和',
    ];
    indNotes.forEach((n, i) => {
      c.add(this._note(COL2, ry + i * 18, CW, n));
    });

    return c;
  }

  // ── Text helpers ─────────────────────────────────────────────────

  _sectionHead(x, y, text) {
    return this.add.text(x, y, text, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px', fontStyle: 'bold',
      color: '#c0392b', letterSpacing: 2,
    });
  }

  _body(x, y, width, text) {
    return this.add.text(x, y, text, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px', color: '#bdc3c7',
      wordWrap: { width }, lineSpacing: LS,
    });
  }

  _note(x, y, width, text) {
    return this.add.text(x, y, text, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px', color: '#7f8c8d',
      wordWrap: { width }, lineSpacing: LS,
    });
  }

  _val(x, y, text, color = 0xecf0f1) {
    const hex = '#' + color.toString(16).padStart(6, '0');
    return this.add.text(x, y, text, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px', fontStyle: 'bold', color: hex,
    });
  }

  _formula(x, y, text) {
    return this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '11px', color: '#3498db',
      backgroundColor: '#0d1b2a',
      padding: { x: 8, y: 4 },
    });
  }

  _hdiv(x, y, width) {
    const g = this.add.graphics();
    g.lineStyle(1, C.BORDER, 0.4);
    g.lineBetween(x, y, x + width, y);
    return g;
  }
}
