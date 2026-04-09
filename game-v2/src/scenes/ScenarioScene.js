import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { loadSave } from '../systems/SaveSystem.js';
import { focusOnRegion } from '../globe.js';
import scenariosData from '../data/scenarios.json';

export class ScenarioScene extends Phaser.Scene {
  constructor() {
    super('ScenarioScene');
    this.selectedScenario = null;
    this.selectedRole = null;
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const save = loadSave();

    this.cameras.main.fadeIn(400, 5, 10, 20);

    // ── Background panel ──────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(C.BG, 0.85);
    bg.fillRect(0, 0, W, H);

    // Top bar
    bg.fillStyle(C.PANEL, 1);
    bg.fillRect(0, 0, W, 60);
    const topLine = this.add.graphics();
    topLine.lineStyle(2, C.RED, 1);
    topLine.lineBetween(0, 60, W, 60);

    // Back button
    const backBtn = this.add.text(24, 30, '← 返回', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '13px',
      color: '#7f8c8d',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ecf0f1'));
    backBtn.on('pointerout',  () => backBtn.setColor('#7f8c8d'));
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(300, 5, 10, 20);
      this.time.delayedCall(300, () => this.scene.start('MenuScene'));
    });

    this.add.text(W / 2, 30, '選擇作戰情景', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0.5);

    // ── Scenario cards ────────────────────────────────────────────────────────
    this.add.text(W / 2, 82, '情景', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#7f8c8d',
      letterSpacing: 3,
    }).setOrigin(0.5);

    const cardW = 350, cardH = 200, cardGap = 30;
    const totalW = scenariosData.length * cardW + (scenariosData.length - 1) * cardGap;
    const startX = (W - totalW) / 2;

    this._scenarioCardGraphics = {};

    scenariosData.forEach((scenario, i) => {
      const cx = startX + i * (cardW + cardGap) + cardW / 2;
      const cy = 200;
      const locked = !save.unlockedScenarios.includes(scenario.id);

      this._buildScenarioCard(scenario, cx, cy, cardW, cardH, locked);
    });

    // ── Role selection area (shown after scenario pick) ───────────────────────
    this._roleContainer = this.add.container(0, 0).setAlpha(0);

    this.add.text(W / 2, 424, '陣營角色', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#7f8c8d',
      letterSpacing: 3,
    }).setOrigin(0.5);

    const roleDivider = this.add.graphics();
    roleDivider.lineStyle(1, C.BORDER, 0.5);
    roleDivider.lineBetween(80, 416, W - 80, 416);

    this._roleDivider = roleDivider;
    this._roleArea = this.add.container(0, 0).setAlpha(0);

    // ── Confirm button ────────────────────────────────────────────────────────
    this._confirmBg  = this.add.rectangle(W / 2, 670, 280, 50, C.RED).setAlpha(0);
    this._confirmTxt = this.add.text(W / 2, 670, '確認出擊 →', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0);

    this._confirmBg.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this._confirmBg.setFillStyle(C.RED_BRIGHT))
      .on('pointerout',   () => this._confirmBg.setFillStyle(C.RED))
      .on('pointerdown',  () => this._startGame());
  }

  _buildScenarioCard(scenario, cx, cy, w, h, locked) {
    const alpha = locked ? 0.4 : 1;

    const bg = this.add.rectangle(cx, cy, w, h, C.PANEL_LIGHT).setAlpha(alpha);
    bg.setStrokeStyle(1, C.BORDER);

    // Year badge
    this.add.rectangle(cx - w / 2 + 30, cy - h / 2 + 14, 48, 20, C.RED)
      .setAlpha(alpha);
    this.add.text(cx - w / 2 + 30, cy - h / 2 + 14, String(scenario.year), {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(alpha);

    if (locked) {
      this.add.text(cx, cy - h / 2 + 14, '🔒 需先完成前一情景', {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '11px',
        color: '#7f8c8d',
      }).setOrigin(0.5);
    }

    this.add.text(cx, cy - h / 2 + 36, scenario.title, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0.5).setAlpha(alpha);

    this.add.text(cx, cy - h / 2 + 62, scenario.subtitle, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#c0392b',
    }).setOrigin(0.5).setAlpha(alpha);

    // Description (2-line truncated)
    const descLines = this._wrapText(scenario.description, 42);
    this.add.text(cx, cy - h / 2 + 88, descLines.slice(0, 2).join('\n'), {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#7f8c8d',
      wordWrap: { width: w - 30 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setAlpha(alpha);

    // Role count
    this.add.text(cx, cy + h / 2 - 22, `${scenario.roles.length} 個可選陣營`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#34495e',
    }).setOrigin(0.5).setAlpha(alpha);

    if (!locked) {
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover',  () => { bg.setStrokeStyle(2, C.RED); })
        .on('pointerout',   () => {
          if (this.selectedScenario?.id !== scenario.id) bg.setStrokeStyle(1, C.BORDER);
        })
        .on('pointerdown',  () => this._selectScenario(scenario, bg));

      this._scenarioCardGraphics[scenario.id] = bg;
    }
  }

  _selectScenario(scenario, cardBg) {
    // Reset all card borders
    for (const [id, g] of Object.entries(this._scenarioCardGraphics)) {
      g.setStrokeStyle(id === scenario.id ? 2 : 1, id === scenario.id ? C.RED : C.BORDER);
    }

    this.selectedScenario = scenario;
    this.selectedRole = null;

    // Focus globe
    focusOnRegion(scenario.region);

    // Show roles
    this._roleArea.destroy(true);
    this._roleArea = this.add.container(0, 0);

    const W = GAME_WIDTH;
    const roleCardW = 240, roleCardH = 130, roleGap = 20;
    const totalW = scenario.roles.length * roleCardW + (scenario.roles.length - 1) * roleGap;
    const startX = (W - totalW) / 2;

    this._roleCardGraphics = {};

    scenario.roles.forEach((role, i) => {
      const cx = startX + i * (roleCardW + roleGap) + roleCardW / 2;
      const cy = 528;

      const bg = this.add.rectangle(cx, cy, roleCardW, roleCardH, C.PANEL);
      bg.setStrokeStyle(1, C.BORDER);

      const flag = this.add.text(cx - roleCardW / 2 + 24, cy - 30, role.flag, {
        fontSize: '28px',
      });

      this.add.text(cx - roleCardW / 2 + 60, cy - 30, role.name, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ecf0f1',
      }).setOrigin(0, 0.5);

      this.add.text(cx, cy + 4, role.description, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '11px',
        color: '#7f8c8d',
        wordWrap: { width: roleCardW - 20 },
        lineSpacing: 3,
        align: 'center',
      }).setOrigin(0.5, 0);

      this.add.text(cx, cy + 52, `總點數：${role.totalPoints}　國債：${role.baseDebt}%`, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '10px',
        color: '#34495e',
      }).setOrigin(0.5);

      bg.setInteractive({ useHandCursor: true })
        .on('pointerover',  () => { if (this.selectedRole?.id !== role.id) bg.setStrokeStyle(1, C.GOLD); })
        .on('pointerout',   () => { if (this.selectedRole?.id !== role.id) bg.setStrokeStyle(1, C.BORDER); })
        .on('pointerdown',  () => this._selectRole(role, bg));

      this._roleCardGraphics[role.id] = bg;
      this._roleArea.add([bg, flag]);
    });

    // Fade in roles
    this._roleArea.setAlpha(0);
    this.tweens.add({ targets: this._roleArea, alpha: 1, duration: 300 });
    this.tweens.add({ targets: this._roleDivider, alpha: 0.5, duration: 300 });
  }

  _selectRole(role, cardBg) {
    for (const [id, g] of Object.entries(this._roleCardGraphics)) {
      g.setStrokeStyle(id === role.id ? 2 : 1, id === role.id ? C.GOLD : C.BORDER);
    }
    this.selectedRole = role;

    // Show confirm button
    if (this._confirmBg.alpha === 0) {
      this.tweens.add({ targets: [this._confirmBg, this._confirmTxt], alpha: 1, duration: 300 });
    }
  }

  _startGame() {
    if (!this.selectedScenario || !this.selectedRole) return;

    this.game.registry.set('scenario', this.selectedScenario);
    this.game.registry.set('role', this.selectedRole);

    this.cameras.main.fade(400, 5, 10, 20);
    this.time.delayedCall(400, () => this.scene.start('AllocationScene'));
  }

  _wrapText(text, maxCharsPerLine) {
    const words = text.split('');
    const lines = [];
    let current = '';
    for (const ch of words) {
      current += ch;
      if (current.length >= maxCharsPerLine) {
        lines.push(current);
        current = '';
      }
    }
    if (current) lines.push(current);
    return lines;
  }
}
