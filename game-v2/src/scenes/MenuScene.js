import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, DIFFICULTY } from '../constants.js';
import { loadSave } from '../systems/SaveSystem.js';
import { resumeAutoRotate } from '../globe.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.selectedDifficulty = 'normal';
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    resumeAutoRotate();

    // ── Semi-transparent overlay panels ──────────────────────────────────────
    // Left dark gradient panel
    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(0x050a14, 0.78);
    leftPanel.fillRect(0, 0, 580, H);

    // Subtle red top stripe
    const stripe = this.add.graphics();
    stripe.fillStyle(C.RED, 1);
    stripe.fillRect(0, 0, 580, 3);

    // ── Radar sweep animation ─────────────────────────────────────────────────
    this._buildRadarSweep(80, H / 2 + 60, 55);

    // ── Title block ───────────────────────────────────────────────────────────
    this.add.text(60, 80, 'v2.0', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#c0392b',
      backgroundColor: '#1a0a0a',
      padding: { x: 6, y: 3 },
    });

    this.add.text(60, 108, '工業力試煉', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '54px',
      fontStyle: '900',
      color: '#ecf0f1',
    });

    this.add.text(60, 170, '戰爭即工業力', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '18px',
      color: '#c0392b',
      letterSpacing: 4,
    });

    this.add.text(60, 206, '在有限的資源與倒數計時中\n做出正確的工業配置決策', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      color: '#7f8c8d',
      lineSpacing: 6,
    });

    // ── Divider ───────────────────────────────────────────────────────────────
    const divider = this.add.graphics();
    divider.lineStyle(1, C.RED, 0.4);
    divider.lineBetween(60, 260, 520, 260);

    // ── Difficulty selector ───────────────────────────────────────────────────
    this.add.text(60, 278, '難度選擇', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#7f8c8d',
      letterSpacing: 2,
    });

    this._diffBtns = {};
    const diffs = ['easy', 'normal', 'hard'];
    const diffLabels = { easy: '簡單', normal: '一般', hard: '困難' };
    const diffColors = { easy: 0x27ae60, normal: 0x3498db, hard: 0xc0392b };

    diffs.forEach((d, i) => {
      const bx = 60 + i * 155;
      const by = 305;
      const bg = this.add.rectangle(bx + 68, by + 18, 140, 36, C.PANEL_LIGHT);
      bg.setStrokeStyle(1, d === this.selectedDifficulty ? diffColors[d] : C.BORDER);

      const txt = this.add.text(bx + 68, by + 18, diffLabels[d], {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '14px',
        color: d === this.selectedDifficulty ? '#ecf0f1' : '#7f8c8d',
      }).setOrigin(0.5);

      const hint = DIFFICULTY[d];
      this.add.text(bx + 68, by + 44, `${hint.timer}秒 / ${hint.eventCount}事件`, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '10px',
        color: '#34495e',
      }).setOrigin(0.5);

      bg.setInteractive({ useHandCursor: true })
        .on('pointerover',  () => { if (this.selectedDifficulty !== d) bg.setStrokeStyle(1, diffColors[d]); })
        .on('pointerout',   () => { if (this.selectedDifficulty !== d) bg.setStrokeStyle(1, C.BORDER); })
        .on('pointerdown',  () => this._selectDifficulty(d, diffColors));

      this._diffBtns[d] = { bg, txt, color: diffColors[d] };
    });

    // ── Play button ───────────────────────────────────────────────────────────
    const playBg = this.add.rectangle(200, 420, 300, 56, C.RED);
    playBg.setStrokeStyle(2, 0xff6b5b);

    const playTxt = this.add.text(200, 420, '▶  開始遊戲', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    playBg.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => { playBg.setFillStyle(C.RED_BRIGHT); })
      .on('pointerout',   () => { playBg.setFillStyle(C.RED); })
      .on('pointerdown',  () => {
        this.game.registry.set('difficulty', this.selectedDifficulty);
        this.cameras.main.fade(400, 5, 10, 20);
        this.time.delayedCall(400, () => this.scene.start('ScenarioScene'));
      });

    // ── Stats from save ───────────────────────────────────────────────────────
    const save = loadSave();

    const divider2 = this.add.graphics();
    divider2.lineStyle(1, C.BORDER, 0.6);
    divider2.lineBetween(60, 468, 520, 468);

    const statsData = [
      { label: '已遊玩', value: save.gamesPlayed },
      { label: '最高分', value: save.bestScore },
    ];
    statsData.forEach(({ label, value }, i) => {
      this.add.text(60 + i * 200, 486, label, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '11px',
        color: '#34495e',
      });
      this.add.text(60 + i * 200, 503, String(value), {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ecf0f1',
      });
    });

    // ── How-to-play teaser ────────────────────────────────────────────────────
    this.add.text(60, 570, [
      '如何遊玩：',
      '  ① 選擇情景與陣營角色',
      '  ② 在倒計時內配置工業資源',
      '  ③ 隨機事件將迫使你重新評估',
      '  ④ 配置越接近最優解，國債改善越多',
    ].join('\n'), {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#34495e',
      lineSpacing: 5,
    });

    // Entrance animation
    this.cameras.main.fadeIn(500, 5, 10, 20);
  }

  _selectDifficulty(d, diffColors) {
    this.selectedDifficulty = d;
    for (const [key, btn] of Object.entries(this._diffBtns)) {
      const active = key === d;
      btn.bg.setStrokeStyle(1, active ? btn.color : C.BORDER);
      btn.bg.setFillStyle(active ? C.PANEL_LIGHT : C.PANEL_LIGHT);
      btn.txt.setColor(active ? '#ecf0f1' : '#7f8c8d');
    }
  }

  _buildRadarSweep(cx, cy, radius) {
    const g = this.add.graphics();
    let angle = 0;

    // Outer ring
    g.lineStyle(1, C.RED, 0.18);
    g.strokeCircle(cx, cy, radius);
    g.strokeCircle(cx, cy, radius * 0.67);
    g.strokeCircle(cx, cy, radius * 0.33);

    // Crosshairs
    g.lineStyle(1, C.RED, 0.1);
    g.lineBetween(cx - radius, cy, cx + radius, cy);
    g.lineBetween(cx, cy - radius, cx, cy + radius);

    // Sweep line — updated each frame
    const sweep = this.add.graphics();

    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        angle = (angle + 4) % 360;
        sweep.clear();
        // Gradient trail
        for (let i = 0; i < 60; i += 4) {
          const a = Phaser.Math.DegToRad(angle - i);
          sweep.lineStyle(1, C.RED, (60 - i) / 60 * 0.35);
          sweep.beginPath();
          sweep.moveTo(cx, cy);
          sweep.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
          sweep.strokePath();
        }
        // Bright leading edge
        const lead = Phaser.Math.DegToRad(angle);
        sweep.lineStyle(2, C.RED_BRIGHT, 0.6);
        sweep.beginPath();
        sweep.moveTo(cx, cy);
        sweep.lineTo(cx + Math.cos(lead) * radius, cy + Math.sin(lead) * radius);
        sweep.strokePath();
      },
    });
  }
}
