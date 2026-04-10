import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, RESOURCES } from '../constants.js';
import { calculateScore, calculateDebtChange } from '../systems/ScoringSystem.js';
import { recordResult } from '../systems/SaveSystem.js';
import { resumeAutoRotate } from '../globe.js';
import { sfxScoreReveal, sfxScoreGood, sfxScorePoor } from '../audio.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    const scenario   = this.game.registry.get('scenario');
    const role       = this.game.registry.get('role');       // 'defender' | 'attacker'
    const roleData   = this.game.registry.get('roleData');   // { country, flag, debtPct, gdpMult, optimalWeights, rationale, ... }
    const allocation = this.game.registry.get('allocation'); // { shell: n, drone: n, ... }
    const events     = this.game.registry.get('appliedEvents') ?? [];
    const difficulty = this.game.registry.get('difficulty') ?? 'normal';

    // ── Score calculation ─────────────────────────────────────────────
    const result     = calculateScore(allocation, roleData.optimalWeights, events);
    const debtChange = calculateDebtChange(roleData.gdpMult, result.score);
    const newDebt    = roleData.debtPct !== null && debtChange !== null
      ? Math.round((roleData.debtPct + debtChange) * 10) / 10
      : null;

    // Save to localStorage
    recordResult({
      scenarioId: scenario.id,
      role,
      country:    roleData.country,
      score:      result.score,
      grade:      result.grade,
      debtChange,
      difficulty,
    });

    resumeAutoRotate();

    // ── Background ────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(C.BG, 0.88);
    bg.fillRect(0, 0, W, H);

    bg.fillStyle(C.PANEL, 1);
    bg.fillRect(0, 0, W, 60);
    this.add.graphics().lineStyle(2, C.RED, 1).lineBetween(0, 60, W, 60);

    this.add.text(W / 2, 30, '評估結果', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '18px', fontStyle: 'bold', color: '#ecf0f1',
    }).setOrigin(0.5);

    // Back to scenario button
    const backBtn = this.add.text(24, 30, '← 返回', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '13px', color: '#7f8c8d',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ecf0f1'));
    backBtn.on('pointerout',  () => backBtn.setColor('#7f8c8d'));
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(300, 5, 10, 20);
      this.time.delayedCall(300, () => this.scene.start('ScenarioScene'));
    });

    // ── Left column: Grade + Debt ─────────────────────────────────────
    const gradeColor = result.gradeColor;
    const hexColor   = '#' + gradeColor.toString(16).padStart(6, '0');

    const scorePanel = this.add.graphics();
    scorePanel.fillStyle(C.PANEL, 0.95);
    scorePanel.fillRect(24, 72, 310, 260);
    scorePanel.lineStyle(1.5, gradeColor, 0.9);
    scorePanel.strokeRect(24, 72, 310, 260);

    // Grade letter
    const gradeText = this.add.text(179, 138, result.grade, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '88px', fontStyle: '900', color: hexColor,
    }).setOrigin(0.5);
    gradeText.setAlpha(0).setScale(0.3);
    this.tweens.add({ targets: gradeText, alpha: 1, scale: 1, duration: 600, ease: 'Back.easeOut' });

    this.add.text(179, 195, result.gradeLabel, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '15px', color: hexColor, letterSpacing: 2,
    }).setOrigin(0.5);

    // Score number
    const scoreLabel = this.add.text(179, 228, '0', {
      fontFamily: 'monospace', fontSize: '42px', fontStyle: 'bold', color: '#ecf0f1',
    }).setOrigin(0.5);

    let displayScore = 0;
    this.time.addEvent({
      delay: 28, repeat: result.score,
      callback: () => { displayScore++; scoreLabel.setText(String(displayScore)); },
    });

    this.add.text(179, 256, '/ 100 分', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '12px', color: '#7f8c8d',
    }).setOrigin(0.5);

    // Scenario + role info
    const roleLabel = role === 'defender' ? '🛡 守方' : '⚔ 攻方';
    const diffLabel = difficulty === 'easy' ? '簡單' : difficulty === 'hard' ? '困難' : '一般';
    this.add.text(179, 276, `${scenario.title}  ·  ${roleLabel}：${roleData.flag} ${roleData.country}  ·  ${diffLabel}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#7f8c8d',
      wordWrap: { width: 290 },
    }).setOrigin(0.5);

    // ── Debt panel ────────────────────────────────────────────────────
    const debtPanel = this.add.graphics();
    debtPanel.fillStyle(C.PANEL, 0.95);
    debtPanel.fillRect(24, 344, 310, 130);
    debtPanel.lineStyle(1, C.BORDER, 0.5);
    debtPanel.strokeRect(24, 344, 310, 130);

    this.add.text(36, 358, '國債變動', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#c0392b', letterSpacing: 2,
    });

    if (debtChange === null) {
      // Special case (e.g. Houthi attacker)
      this.add.text(179, 410, '特殊規則', {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '18px', color: '#f39c12',
      }).setOrigin(0.5);
      this.add.text(179, 438, '光腳的不怕穿鞋的', {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '12px', color: '#7f8c8d',
      }).setOrigin(0.5);
    } else {
      const debtIncrease = debtChange > 0;
      const debtColor = debtIncrease ? C.RED_BRIGHT : C.GREEN;
      const debtSign  = debtChange >= 0 ? '+' : '';

      const debtChangeTxt = this.add.text(179, 400, `${debtSign}${debtChange}%`, {
        fontFamily: 'monospace', fontSize: '34px', fontStyle: 'bold',
        color: '#' + debtColor.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: debtChangeTxt, alpha: 1, duration: 700, delay: 500 });

      // Debt bar
      const barX = 44, barY = 426, barW = 272, barH = 16;
      this.add.graphics().fillStyle(C.DIM, 0.5).fillRoundedRect(barX, barY, barW, barH, 4);

      const beforePct = Math.min((roleData.debtPct ?? 0) / 150, 1);
      const afterPct  = Math.min((newDebt ?? 0) / 150, 1);
      const fillBar   = this.add.graphics();

      this.tweens.addCounter({
        from: beforePct * 100, to: afterPct * 100,
        duration: 1100, delay: 700,
        onUpdate: (tween) => {
          const pct = tween.getValue() / 100;
          fillBar.clear();
          fillBar.fillStyle(debtColor, 0.8);
          fillBar.fillRoundedRect(barX + 2, barY + 2, Math.max(0, pct * (barW - 4)), barH - 4, 3);
        },
      });

      this.add.text(barX, barY + 20, `前：${roleData.debtPct}%  →  後：${newDebt}%`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#7f8c8d',
      });
    }

    // ── Rationale panel ───────────────────────────────────────────────
    if (roleData.rationale) {
      const ratPanel = this.add.graphics();
      ratPanel.fillStyle(C.PANEL, 0.95);
      ratPanel.fillRect(24, 486, 310, 194);
      ratPanel.lineStyle(1, C.BORDER, 0.4);
      ratPanel.strokeRect(24, 486, 310, 194);

      this.add.text(36, 500, '最優解解析', {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#c0392b', letterSpacing: 2,
      });
      this.add.text(36, 516, roleData.rationale.headline, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '12px', fontStyle: 'bold', color: '#ecf0f1',
      });
      this.add.text(36, 536, roleData.rationale.body, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#7f8c8d',
        wordWrap: { width: 285 }, lineSpacing: 4,
      });
    }

    // ── Right area: Comparison chart ──────────────────────────────────
    const chartLeft   = 354;
    const chartRight  = W - 24;
    const chartW      = chartRight - chartLeft;
    const chartTop    = 88;
    const chartBottom = H - 108;
    const chartH      = chartBottom - chartTop;

    const chartPanel = this.add.graphics();
    chartPanel.fillStyle(C.PANEL, 0.95);
    chartPanel.fillRect(chartLeft, 72, chartW, H - 72 - 64);
    chartPanel.lineStyle(1, C.BORDER, 0.4);
    chartPanel.strokeRect(chartLeft, 72, chartW, H - 72 - 64);

    this.add.text(chartLeft + 16, 86, '資源配置對比（%）', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '12px', fontStyle: 'bold', color: '#ecf0f1',
    });

    // Legend
    this.add.text(chartRight - 160, 86, '■ 你的配置', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#3498db',
    });
    this.add.text(chartRight - 70, 86, '■ 最優解', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#27ae60',
    });

    // Grid lines at 0%, 20%, 40%, 60%, 80%, 100%
    const gridG = this.add.graphics();
    gridG.lineStyle(1, C.BORDER, 0.25);
    for (let pct = 0; pct <= 100; pct += 20) {
      const gy = chartBottom - (pct / 100) * chartH;
      gridG.lineBetween(chartLeft + 16, gy, chartRight - 16, gy);
      this.add.text(chartLeft + 8, gy, `${pct}%`, {
        fontFamily: 'monospace', fontSize: '9px', color: '#34495e',
      }).setOrigin(1, 0.5);
    }

    const numBars  = RESOURCES.length;
    const groupW   = (chartW - 32) / numBars;
    const barWide  = Math.min(30, groupW * 0.3);

    RESOURCES.forEach((res, i) => {
      const bd = result.breakdown[res.id];
      const gx  = chartLeft + 16 + i * groupW + groupW / 2;

      // Player bar
      const playerH   = (bd.playerPct / 100) * chartH;
      const playerBar = this.add.graphics();
      this.tweens.addCounter({
        from: 0, to: playerH, duration: 900, delay: 300 + i * 80,
        onUpdate: (tween) => {
          const h = tween.getValue();
          playerBar.clear();
          playerBar.fillStyle(0x3498db, 0.78);
          playerBar.fillRect(gx - barWide - 2, chartBottom - h, barWide, h);
        },
      });

      // Optimal bar
      const optH   = (bd.optPct / 100) * chartH;
      const optBar = this.add.graphics();
      this.tweens.addCounter({
        from: 0, to: optH, duration: 900, delay: 300 + i * 80,
        onUpdate: (tween) => {
          const h = tween.getValue();
          optBar.clear();
          optBar.fillStyle(0x27ae60, 0.78);
          optBar.fillRect(gx + 2, chartBottom - h, barWide, h);
        },
      });

      // Player percentage label (appears at bar top)
      const playerPctTxt = this.add.text(gx - barWide / 2 - 2, chartBottom - playerH - 14,
        `${bd.playerPct}%`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#3498db',
      }).setOrigin(0.5).setAlpha(0);
      this.time.delayedCall(1100 + i * 80, () => {
        this.tweens.add({ targets: playerPctTxt, alpha: 1, duration: 300 });
      });

      // Optimal percentage label
      const optPctTxt = this.add.text(gx + barWide / 2 + 2, chartBottom - optH - 14,
        `${bd.optPct}%`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#27ae60',
      }).setOrigin(0.5).setAlpha(0);
      this.time.delayedCall(1100 + i * 80, () => {
        this.tweens.add({ targets: optPctTxt, alpha: 1, duration: 300 });
      });

      // Resource icon + name
      this.add.text(gx, chartBottom + 8,  res.icon, { fontSize: '18px' }).setOrigin(0.5, 0);
      this.add.text(gx, chartBottom + 28, res.name, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#7f8c8d',
      }).setOrigin(0.5, 0);

      // Deviation indicator
      const devColor = bd.deviation <= 5 ? C.GREEN : (bd.deviation <= 15 ? 0xf39c12 : C.RED_BRIGHT);
      this.add.text(gx, chartBottom + 46, `±${bd.deviation}%`, {
        fontFamily: 'monospace', fontSize: '11px',
        color: '#' + devColor.toString(16).padStart(6, '0'),
      }).setOrigin(0.5, 0);
    });

    // Applied events summary
    if (events.length > 0) {
      this.add.text(chartLeft + 16, chartBottom + 68, `本局事件：${events.map(e => e.title).join('、')}`, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#34495e',
        wordWrap: { width: chartW - 32 },
      });
    }

    // ── Action buttons ────────────────────────────────────────────────
    const btnY = H - 36;

    const retryBtn = this.add.rectangle(chartLeft + 90, btnY, 160, 44, C.PANEL_LIGHT);
    retryBtn.setStrokeStyle(1, C.BORDER);
    this.add.text(chartLeft + 90, btnY, '↺  再試一次', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', color: '#bdc3c7',
    }).setOrigin(0.5);
    retryBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => retryBtn.setStrokeStyle(1, C.RED))
      .on('pointerout',   () => retryBtn.setStrokeStyle(1, C.BORDER))
      .on('pointerdown',  () => {
        this.cameras.main.fade(300, 5, 10, 20);
        this.time.delayedCall(300, () => this.scene.start('AllocationScene'));
      });

    const newBtn = this.add.rectangle(chartLeft + 270, btnY, 160, 44, C.RED);
    this.add.text(chartLeft + 270, btnY, '▶  選擇情景', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    newBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => newBtn.setFillStyle(C.RED_BRIGHT))
      .on('pointerout',   () => newBtn.setFillStyle(C.RED))
      .on('pointerdown',  () => {
        this.cameras.main.fade(300, 5, 10, 20);
        this.time.delayedCall(300, () => this.scene.start('ScenarioScene'));
      });

    const menuBtn = this.add.rectangle(chartLeft + 450, btnY, 160, 44, C.PANEL_LIGHT);
    menuBtn.setStrokeStyle(1, C.BORDER);
    this.add.text(chartLeft + 450, btnY, '⌂  主選單', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', color: '#bdc3c7',
    }).setOrigin(0.5);
    menuBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => menuBtn.setStrokeStyle(1, C.GOLD))
      .on('pointerout',   () => menuBtn.setStrokeStyle(1, C.BORDER))
      .on('pointerdown',  () => {
        this.cameras.main.fade(300, 5, 10, 20);
        this.time.delayedCall(300, () => this.scene.start('MenuScene'));
      });

    // ── Sound effects ─────────────────────────────────────────────────
    sfxScoreReveal();
    this.time.delayedCall(600, () => {
      if      (result.score >= 75) sfxScoreGood();
      else if (result.score < 35)  sfxScorePoor();
    });

    this.cameras.main.fadeIn(500, 5, 10, 20);
  }
}
