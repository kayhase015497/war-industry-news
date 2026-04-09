import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, RESOURCES, GRADES } from '../constants.js';
import { calculateScore, calculateDebtChange } from '../systems/ScoringSystem.js';
import { recordResult } from '../systems/SaveSystem.js';
import { resumeAutoRotate } from '../globe.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    const scenario   = this.game.registry.get('scenario');
    const role       = this.game.registry.get('role');
    const allocation = this.game.registry.get('allocation');
    const events     = this.game.registry.get('appliedEvents') ?? [];
    const difficulty = this.game.registry.get('difficulty') ?? 'normal';

    // Calculate score
    const result = calculateScore(allocation, role.optimalAllocation, events);
    const debtChange = calculateDebtChange(role.optimalDebtChange, result.debtMultiplier);
    const newDebt    = Math.round((role.baseDebt + debtChange) * 10) / 10;

    // Save to localStorage
    recordResult({
      scenarioId: scenario.id,
      roleId: role.id,
      score: result.score,
      grade: result.grade,
      debtChange,
      difficulty,
    });

    resumeAutoRotate();

    // ── Background ────────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(C.BG, 0.88);
    bg.fillRect(0, 0, W, H);

    // Top bar
    bg.fillStyle(C.PANEL, 1);
    bg.fillRect(0, 0, W, 60);
    const topLine = this.add.graphics();
    topLine.lineStyle(2, C.RED, 1);
    topLine.lineBetween(0, 60, W, 60);

    this.add.text(W / 2, 30, '評估結果', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0.5);

    // ── Score panel (left) ────────────────────────────────────────────────────
    const scorePanel = this.add.graphics();
    scorePanel.fillStyle(C.PANEL, 0.95);
    scorePanel.fillRect(30, 76, 340, 280);
    scorePanel.lineStyle(1, result.gradeColor, 0.8);
    scorePanel.strokeRect(30, 76, 340, 280);

    // Grade letter
    const gradeText = this.add.text(200, 140, result.grade, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '96px',
      fontStyle: '900',
      color: '#' + result.gradeColor.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);

    // Entrance animation for grade
    gradeText.setAlpha(0).setScale(0.3);
    this.tweens.add({
      targets: gradeText,
      alpha: 1,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });

    this.add.text(200, 200, result.gradeLabel, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '16px',
      color: '#' + result.gradeColor.toString(16).padStart(6, '0'),
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Score number
    const scoreLabel = this.add.text(200, 228, '0', {
      fontFamily: "'Noto Sans TC', monospace",
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0.5);

    // Animate score counting up
    let displayScore = 0;
    this.time.addEvent({
      delay: 30,
      repeat: result.score,
      callback: () => {
        displayScore++;
        scoreLabel.setText(String(displayScore));
      },
    });

    this.add.text(200, 258, '/ 100 分', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '13px',
      color: '#7f8c8d',
    }).setOrigin(0.5);

    // Scenario + role
    this.add.text(200, 286, `${scenario.title}`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '13px',
      color: '#bdc3c7',
    }).setOrigin(0.5);

    this.add.text(200, 306, `${role.flag} ${role.name}  ·  ${difficulty === 'easy' ? '簡單' : difficulty === 'normal' ? '一般' : '困難'}`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#7f8c8d',
    }).setOrigin(0.5);

    // ── Debt gauge panel ──────────────────────────────────────────────────────
    const debtPanel = this.add.graphics();
    debtPanel.fillStyle(C.PANEL, 0.95);
    debtPanel.fillRect(30, 370, 340, 160);
    debtPanel.lineStyle(1, C.BORDER, 0.5);
    debtPanel.strokeRect(30, 370, 340, 160);

    this.add.text(40, 386, '國債變動', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#c0392b',
      letterSpacing: 2,
    });

    const debtColor = debtChange <= 0 ? C.GREEN : C.RED;
    const debtSign  = debtChange >= 0 ? '+' : '';

    const debtChangeText = this.add.text(200, 430, `${debtSign}${debtChange}%`, {
      fontFamily: "'Noto Sans TC', monospace",
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#' + debtColor.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);

    debtChangeText.setAlpha(0);
    this.tweens.add({ targets: debtChangeText, alpha: 1, duration: 800, delay: 400 });

    // Debt bar
    const barX = 50, barY = 468, barW = 300, barH = 18;
    const barBg = this.add.graphics();
    barBg.fillStyle(C.DIM, 0.5);
    barBg.fillRoundedRect(barX, barY, barW, barH, 4);

    const beforePct = Math.min(role.baseDebt / 150, 1);
    const afterPct  = Math.min(newDebt / 150, 1);

    // Animate bar
    const fillBar = this.add.graphics();
    let fillPct = beforePct;

    this.tweens.addCounter({
      from: beforePct * 100,
      to:   afterPct  * 100,
      duration: 1200,
      delay: 600,
      onUpdate: (tween) => {
        fillPct = tween.getValue() / 100;
        fillBar.clear();
        fillBar.fillStyle(debtColor, 0.8);
        fillBar.fillRoundedRect(barX + 2, barY + 2, Math.max(0, fillPct * (barW - 4)), barH - 4, 3);
      },
    });

    this.add.text(barX, barY + 22, `前：${role.baseDebt}%  →  後：${newDebt}%`, {
      fontFamily: "'Noto Sans TC', monospace",
      fontSize: '12px',
      color: '#7f8c8d',
    });

    // ── Comparison chart (center/right) ───────────────────────────────────────
    const chartPanel = this.add.graphics();
    chartPanel.fillStyle(C.PANEL, 0.95);
    chartPanel.fillRect(390, 76, 860, 554);
    chartPanel.lineStyle(1, C.BORDER, 0.5);
    chartPanel.strokeRect(390, 76, 860, 554);

    this.add.text(406, 92, '資源配置對比', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    });

    this.add.text(1070, 92, '■ 你的配置   ', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#3498db',
    }).setOrigin(1, 0);

    this.add.text(1230, 92, '■ 最優解', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#27ae60',
    }).setOrigin(1, 0);

    const chartTop     = 120;
    const chartHeight  = 460;
    const chartLeft    = 420;
    const chartRight   = 1220;
    const chartWidth   = chartRight - chartLeft;
    const numBars      = RESOURCES.length;
    const groupW       = chartWidth / numBars;
    const barWide      = 28;

    // Grid lines
    const gridG = this.add.graphics();
    gridG.lineStyle(1, C.BORDER, 0.3);
    const maxPts = this._bestTotalPoints(role, result.adjustedOptimal);

    for (let v = 0; v <= maxPts; v += 2) {
      const gy = chartTop + chartHeight - (v / maxPts) * chartHeight;
      gridG.lineBetween(chartLeft, gy, chartRight, gy);
      if (v % 4 === 0) {
        this.add.text(chartLeft - 8, gy, String(v), {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#34495e',
        }).setOrigin(1, 0.5);
      }
    }

    RESOURCES.forEach((res, i) => {
      const bd = result.breakdown[res.id];
      const gx = chartLeft + i * groupW + groupW / 2;

      // Player bar
      const playerH = maxPts > 0 ? (bd.player / maxPts) * chartHeight : 0;
      const playerBar = this.add.graphics();
      playerBar.fillStyle(0x3498db, 0.75);

      this.tweens.addCounter({
        from: 0, to: playerH,
        duration: 900,
        delay: 200 + i * 80,
        onUpdate: (tween) => {
          const h = tween.getValue();
          playerBar.clear();
          playerBar.fillStyle(0x3498db, 0.75);
          playerBar.fillRect(gx - barWide - 2, chartTop + chartHeight - h, barWide, h);
        },
      });

      // Optimal bar
      const optH = maxPts > 0 ? (bd.optimal / maxPts) * chartHeight : 0;
      const optBar = this.add.graphics();
      optBar.fillStyle(0x27ae60, 0.75);

      this.tweens.addCounter({
        from: 0, to: optH,
        duration: 900,
        delay: 200 + i * 80,
        onUpdate: (tween) => {
          const h = tween.getValue();
          optBar.clear();
          optBar.fillStyle(0x27ae60, 0.75);
          optBar.fillRect(gx + 2, chartTop + chartHeight - h, barWide, h);
        },
      });

      // Resource icon + name
      this.add.text(gx, chartTop + chartHeight + 8, res.icon, {
        fontSize: '18px',
      }).setOrigin(0.5, 0);

      this.add.text(gx, chartTop + chartHeight + 28, res.name, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '10px',
        color: '#7f8c8d',
      }).setOrigin(0.5, 0);

      // Deviation indicator
      const deviationColor = bd.deviation <= 5 ? C.GREEN : (bd.deviation <= 15 ? 0xf39c12 : C.RED_BRIGHT);
      this.add.text(gx, chartTop + chartHeight + 46, `±${bd.deviation}%`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#' + deviationColor.toString(16).padStart(6, '0'),
      }).setOrigin(0.5, 0);
    });

    // ── Events summary ────────────────────────────────────────────────────────
    if (events.length > 0) {
      this.add.text(406, 548, `本局觸發事件：${events.map(e => e.title).join('、')}`, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '11px',
        color: '#34495e',
        wordWrap: { width: 830 },
      });
    }

    // ── Action buttons ────────────────────────────────────────────────────────
    // Play again
    const retryBtn = this.add.rectangle(100, H - 36, 170, 44, C.PANEL_LIGHT);
    retryBtn.setStrokeStyle(1, C.BORDER);
    this.add.text(100, H - 36, '↺  再試一次', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      color: '#bdc3c7',
    }).setOrigin(0.5);

    retryBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => retryBtn.setStrokeStyle(1, C.RED))
      .on('pointerout',   () => retryBtn.setStrokeStyle(1, C.BORDER))
      .on('pointerdown',  () => {
        this.cameras.main.fade(300, 5, 10, 20);
        this.time.delayedCall(300, () => this.scene.start('AllocationScene'));
      });

    // New scenario
    const newBtn = this.add.rectangle(290, H - 36, 170, 44, C.RED);
    this.add.text(290, H - 36, '▶  選擇情景', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    newBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => newBtn.setFillStyle(C.RED_BRIGHT))
      .on('pointerout',   () => newBtn.setFillStyle(C.RED))
      .on('pointerdown',  () => {
        this.cameras.main.fade(300, 5, 10, 20);
        this.time.delayedCall(300, () => this.scene.start('ScenarioScene'));
      });

    // Main menu
    const menuBtn = this.add.rectangle(480, H - 36, 170, 44, C.PANEL_LIGHT);
    menuBtn.setStrokeStyle(1, C.BORDER);
    this.add.text(480, H - 36, '⌂  主選單', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      color: '#bdc3c7',
    }).setOrigin(0.5);

    menuBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => menuBtn.setStrokeStyle(1, C.GOLD))
      .on('pointerout',   () => menuBtn.setStrokeStyle(1, C.BORDER))
      .on('pointerdown',  () => {
        this.cameras.main.fade(300, 5, 10, 20);
        this.time.delayedCall(300, () => this.scene.start('MenuScene'));
      });

    this.cameras.main.fadeIn(500, 5, 10, 20);
  }

  _bestTotalPoints(role, adjustedOptimal) {
    const optMax  = Math.max(...Object.values(adjustedOptimal));
    const playMax = Math.max(...Object.values(
      this.game.registry.get('allocation') ?? {}
    ));
    return Math.max(optMax, playMax, 4) + 2;
  }
}
