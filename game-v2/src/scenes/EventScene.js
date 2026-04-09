import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, RESOURCES } from '../constants.js';

/**
 * Overlay scene that displays a random event popup.
 * Launched on top of AllocationScene via scene.launch().
 * Init data: { event, onDismiss }
 */
export class EventScene extends Phaser.Scene {
  constructor() {
    super('EventScene');
  }

  init(data) {
    this._eventData  = data.event;
    this._onDismiss  = data.onDismiss;
    this._countdown  = 12; // seconds to auto-dismiss
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const panelW = 520, panelH = 320;
    const cx = W / 2, cy = H / 2;

    // Darken background
    const dim = this.add.rectangle(cx, cy, W, H, 0x000000, 0.55);
    dim.setInteractive();  // block clicks through to AllocationScene

    // Animated red border pulse
    this._borderGraphics = this.add.graphics();
    this._borderAlpha = 1;
    this._borderDir   = -1;

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x0a1520, 0.97);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 8);
    panel.lineStyle(2, C.RED, 1);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 8);

    // Flashing header bar
    const headerBg = this.add.rectangle(cx, cy - panelH / 2 + 22, panelW, 44, C.RED);

    this.add.text(cx - panelW / 2 + 20, cy - panelH / 2 + 22, '⚠  突發事件', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      letterSpacing: 3,
    }).setOrigin(0, 0.5);

    // Flash header
    this.tweens.add({
      targets: headerBg,
      alpha: 0.5,
      duration: 400,
      yoyo: true,
      repeat: 4,
    });

    // Event icon + title
    this.add.text(cx - panelW / 2 + 30, cy - panelH / 2 + 70, this._eventData.icon, {
      fontSize: '38px',
    });

    this.add.text(cx - panelW / 2 + 80, cy - panelH / 2 + 72, this._eventData.title, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0, 0.5);

    // Description
    this.add.text(cx - panelW / 2 + 30, cy - panelH / 2 + 110, this._eventData.description, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '13px',
      color: '#bdc3c7',
      wordWrap: { width: panelW - 60 },
      lineSpacing: 5,
    });

    // Effects display
    const effects = this._buildEffectsSummary();
    this.add.text(cx - panelW / 2 + 30, cy - panelH / 2 + 190, effects, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#e74c3c',
      wordWrap: { width: panelW - 60 },
      lineSpacing: 4,
    });

    // Auto-dismiss countdown
    this._countdownText = this.add.text(cx - panelW / 2 + 30, cy + panelH / 2 - 50, ``, {
      fontFamily: "'Noto Sans TC', monospace",
      fontSize: '11px',
      color: '#34495e',
    });

    // Dismiss button
    const btnBg = this.add.rectangle(cx + panelW / 2 - 80, cy + panelH / 2 - 36, 130, 36, C.PANEL_LIGHT);
    btnBg.setStrokeStyle(1, C.RED);

    this.add.text(cx + panelW / 2 - 80, cy + panelH / 2 - 36, '✓  已知悉', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      color: '#ecf0f1',
    }).setOrigin(0.5);

    btnBg.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => btnBg.setFillStyle(C.DIM))
      .on('pointerout',   () => btnBg.setFillStyle(C.PANEL_LIGHT))
      .on('pointerdown',  () => this._dismiss());

    // Auto-dismiss timer
    this._autoTimer = this.time.addEvent({
      delay: 1000,
      repeat: this._countdown,
      callback: () => {
        this._countdown--;
        this._countdownText.setText(`${this._countdown}秒後自動關閉`);
        if (this._countdown <= 0) this._dismiss();
      },
    });

    // Entrance animation
    const panelObjs = [dim, panel, headerBg];
    panelObjs.forEach(o => o.setAlpha(0));
    this.tweens.add({ targets: panelObjs, alpha: 1, duration: 250 });

    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  _buildEffectsSummary() {
    const effects = this._eventData.effects;
    const lines = [];

    if (effects.weightShift) {
      const parts = Object.entries(effects.weightShift).map(([k, v]) => {
        const res = RESOURCES.find(r => r.id === k);
        return `${res?.name ?? k} 優先級 ${v > 0 ? '+' : ''}${v}`;
      });
      lines.push('⬆ 最優解變化：' + parts.join('、'));
    }

    if (effects.pointLoss) {
      const parts = Object.entries(effects.pointLoss).map(([k, v]) => {
        const res = RESOURCES.find(r => r.id === k);
        return `${res?.name ?? k} -${v}點`;
      });
      lines.push('⬇ 立即扣除：' + parts.join('、'));
    }

    if (effects.pointGain) {
      lines.push(`⬆ 立即獲得：+${effects.pointGain} 點工業產能`);
    }

    if (effects.randomShift) {
      lines.push('⚠ 最優解發生隨機偏移，需重新評估！');
    }

    return lines.join('\n') || '無直接效果';
  }

  _dismiss() {
    if (this._autoTimer) this._autoTimer.remove();
    this.cameras.main.fade(200, 5, 10, 20);
    this.time.delayedCall(200, () => {
      if (this._onDismiss) this._onDismiss();
    });
  }
}
