import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, DIFFICULTY } from '../constants.js';
import { loadSave } from '../systems/SaveSystem.js';
import { focusOnRegion } from '../globe.js';
import { sfxClick, sfxConfirm } from '../audio.js';
import scenariosData from '../data/scenarios.json';

const CARD_W = 360, CARD_H = 130, CARD_GAP = 20;
const COLS = 3, ROWS = 2;
const GRID_W = COLS * CARD_W + (COLS - 1) * CARD_GAP;  // 1120
const GRID_X = (GAME_WIDTH - GRID_W) / 2;              // 80
const ROW1_Y = 98,  ROW2_Y = ROW1_Y + CARD_H + CARD_GAP;

export class ScenarioScene extends Phaser.Scene {
  constructor() {
    super('ScenarioScene');
    this.selectedScenario = null;
    this.selectedRole     = null;   // 'defender' | 'attacker'
  }

  create() {
    this.cameras.main.fadeIn(400, 5, 10, 20);
    const save = loadSave();
    this._scenarioCardGraphics = {};
    this._roleCardGraphics     = {};

    // ── Background ──────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(C.BG, 0.85);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Top bar
    bg.fillStyle(C.PANEL, 1);
    bg.fillRect(0, 0, GAME_WIDTH, 60);
    this.add.graphics().lineStyle(2, C.RED, 1).lineBetween(0, 60, GAME_WIDTH, 60);

    // Back button
    const backBtn = this.add.text(24, 30, '← 返回', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '13px', color: '#7f8c8d',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover',  () => backBtn.setColor('#ecf0f1'));
    backBtn.on('pointerout',   () => backBtn.setColor('#7f8c8d'));
    backBtn.on('pointerdown',  () => {
      sfxClick();
      this.cameras.main.fade(300, 5, 10, 20);
      this.time.delayedCall(300, () => this.scene.start('MenuScene'));
    });

    this.add.text(GAME_WIDTH / 2, 30, '選擇作戰情景', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '18px', fontStyle: 'bold', color: '#ecf0f1',
    }).setOrigin(0.5);

    // Difficulty badge
    const diff = DIFFICULTY[this.game.registry.get('difficulty') ?? 'normal'];
    this.add.text(GAME_WIDTH - 20, 30, `難度：${diff.label}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '12px', color: '#7f8c8d',
    }).setOrigin(1, 0.5);

    // ── Section label ────────────────────────────────────────────────
    this.add.text(GAME_WIDTH / 2, 78, '選擇情景（共 6 局）', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#7f8c8d', letterSpacing: 2,
    }).setOrigin(0.5);

    // ── 6 Scenario cards ─────────────────────────────────────────────
    scenariosData.forEach((sc, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx  = GRID_X + col * (CARD_W + CARD_GAP) + CARD_W / 2;
      const cy  = (row === 0 ? ROW1_Y : ROW2_Y) + CARD_H / 2;
      this._buildScenarioCard(sc, cx, cy);
    });

    // ── Role selection area (appears after scenario pick) ─────────────
    this._roleSection = this.add.container(0, 0).setAlpha(0);

    const roleDividerY = ROW2_Y + CARD_H + 18;
    const roleDivider  = this.add.graphics();
    roleDivider.lineStyle(1, C.BORDER, 0.4);
    roleDivider.lineBetween(80, roleDividerY, GAME_WIDTH - 80, roleDividerY);
    this._roleDivider = roleDivider;

    this._roleLabelY = roleDividerY + 8;
    this._roleCardsY = roleDividerY + 32;

    // ── Confirm button ────────────────────────────────────────────────
    this._confirmBg  = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 36, 280, 50, C.RED).setAlpha(0);
    this._confirmTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 36, '確認出擊 →', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0);

    this._confirmBg.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this._confirmBg.setFillStyle(C.RED_BRIGHT))
      .on('pointerout',   () => this._confirmBg.setFillStyle(C.RED))
      .on('pointerdown',  () => { sfxConfirm(); this._startGame(); });
  }

  // ── Scenario card ─────────────────────────────────────────────────

  _buildScenarioCard(sc, cx, cy) {
    const bg = this.add.rectangle(cx, cy, CARD_W, CARD_H, C.PANEL_LIGHT);
    bg.setStrokeStyle(1, C.BORDER);

    // Year badge
    this.add.rectangle(cx - CARD_W / 2 + 28, cy - CARD_H / 2 + 13, 46, 18, C.RED);
    this.add.text(cx - CARD_W / 2 + 28, cy - CARD_H / 2 + 13, String(sc.year), {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#fff',
    }).setOrigin(0.5);

    // Emoji + title
    this.add.text(cx - CARD_W / 2 + 14, cy - CARD_H / 2 + 34, sc.emoji, { fontSize: '20px' });
    this.add.text(cx - CARD_W / 2 + 42, cy - CARD_H / 2 + 36, sc.title, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '17px', fontStyle: 'bold', color: '#ecf0f1',
    }).setOrigin(0, 0.5);

    // Description
    this.add.text(cx - CARD_W / 2 + 14, cy - CARD_H / 2 + 58, sc.description, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#7f8c8d',
      wordWrap: { width: CARD_W - 28 }, lineSpacing: 3,
    });

    // Sides tag
    this.add.text(cx - CARD_W / 2 + 14, cy + CARD_H / 2 - 16,
      `🛡 ${sc.defender.country}  vs  ⚔ ${sc.attacker.country}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#34495e',
    });

    bg.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => { if (this.selectedScenario?.id !== sc.id) bg.setStrokeStyle(1.5, C.RED); })
      .on('pointerout',   () => { if (this.selectedScenario?.id !== sc.id) bg.setStrokeStyle(1, C.BORDER); })
      .on('pointerdown',  () => { sfxClick(); this._selectScenario(sc, bg); });

    this._scenarioCardGraphics[sc.id] = bg;
  }

  _selectScenario(sc, bg) {
    // Reset borders
    for (const [id, g] of Object.entries(this._scenarioCardGraphics)) {
      g.setStrokeStyle(id === sc.id ? 2 : 1, id === sc.id ? C.RED : C.BORDER);
    }
    this.selectedScenario = sc;
    this.selectedRole     = null;
    focusOnRegion(sc.region);
    this._buildRoleCards(sc);

    // Hide confirm
    this._confirmBg.setAlpha(0);
    this._confirmTxt.setAlpha(0);
  }

  // ── Role cards (defender / attacker) ──────────────────────────────

  _buildRoleCards(sc) {
    // Destroy previous role cards
    if (this._roleCardContainer) this._roleCardContainer.destroy(true);
    this._roleCardContainer = this.add.container(0, 0);
    this._roleCardGraphics  = {};

    const labelY  = this._roleLabelY;
    const cardsY  = this._roleCardsY;
    const cardW2  = 480, cardH2 = 110, gap2 = 20;
    const totalW  = 2 * cardW2 + gap2;
    const startX  = (GAME_WIDTH - totalW) / 2;

    // Label
    const lbl = this.add.text(GAME_WIDTH / 2, labelY + 5, '選擇陣營', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#c0392b', letterSpacing: 3,
    }).setOrigin(0.5);
    this._roleCardContainer.add(lbl);

    const diff = DIFFICULTY[this.game.registry.get('difficulty') ?? 'normal'];

    ['defender', 'attacker'].forEach((side, i) => {
      const roleData = sc[side];
      const cx = startX + i * (cardW2 + gap2) + cardW2 / 2;
      const cy = cardsY + cardH2 / 2;
      const icon = side === 'defender' ? '🛡' : '⚔';
      const sideLabel = side === 'defender' ? '守方' : '攻方';
      const pts = diff.useRealistic ? roleData.pts_realistic : roleData.pts_standard;
      const debtStr = roleData.debtPct !== null ? `起始國債 ${roleData.debtPct}%` : '特殊規則';

      const bg = this.add.rectangle(cx, cy, cardW2, cardH2, C.PANEL);
      bg.setStrokeStyle(1, C.BORDER);

      this.add.text(cx - cardW2 / 2 + 20, cy - cardH2 / 2 + 20,
        `${icon} ${sideLabel}：${roleData.country} ${roleData.flag}`, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '16px', fontStyle: 'bold', color: '#ecf0f1',
      });

      this.add.text(cx - cardW2 / 2 + 20, cy - cardH2 / 2 + 48,
        `工業力 ${pts} 點  ·  ${debtStr}  ·  懲罰係數 ×${roleData.gdpMult ?? '—'}`, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#7f8c8d',
      });

      this.add.text(cx - cardW2 / 2 + 20, cy + cardH2 / 2 - 26,
        sc.description.slice(0, 50) + '…', {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#34495e',
        wordWrap: { width: cardW2 - 40 },
      });

      bg.setInteractive({ useHandCursor: true })
        .on('pointerover',  () => {
          if (this.selectedRole !== side) bg.setStrokeStyle(1.5, C.GOLD);
        })
        .on('pointerout',   () => {
          if (this.selectedRole !== side) bg.setStrokeStyle(1, C.BORDER);
        })
        .on('pointerdown',  () => { sfxClick(); this._selectRole(side, bg); });

      this._roleCardGraphics[side] = bg;
      this._roleCardContainer.add([bg]);
    });

    // Fade in
    this._roleCardContainer.setAlpha(0);
    this.tweens.add({ targets: this._roleCardContainer, alpha: 1, duration: 280 });
  }

  _selectRole(side, bg) {
    for (const [key, g] of Object.entries(this._roleCardGraphics)) {
      g.setStrokeStyle(key === side ? 2 : 1, key === side ? C.GOLD : C.BORDER);
    }
    this.selectedRole = side;

    if (this._confirmBg.alpha < 0.5) {
      this.tweens.add({ targets: [this._confirmBg, this._confirmTxt], alpha: 1, duration: 280 });
    }
  }

  _startGame() {
    if (!this.selectedScenario || !this.selectedRole) return;
    const roleData = this.selectedScenario[this.selectedRole];
    const diff = DIFFICULTY[this.game.registry.get('difficulty') ?? 'normal'];
    const pts  = diff.useRealistic ? roleData.pts_realistic : roleData.pts_standard;

    this.game.registry.set('scenario',  this.selectedScenario);
    this.game.registry.set('role',      this.selectedRole);
    this.game.registry.set('roleData',  roleData);
    this.game.registry.set('totalPoints', pts);

    this.cameras.main.fade(400, 5, 10, 20);
    this.time.delayedCall(400, () => this.scene.start('AllocationScene'));
  }
}
