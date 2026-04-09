import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, RESOURCES, DIFFICULTY } from '../constants.js';
import eventsData from '../data/events.json';
import { focusOnRegion } from '../globe.js';

const ROW_H   = 82;    // height of each resource row
const BAR_X   = 640;   // center X of allocation bar
const BAR_W   = 480;   // total width of bar
const BAR_H   = 28;
const LEFT_X  = 60;    // left column start
const RIGHT_X = 940;   // right column start

export class AllocationScene extends Phaser.Scene {
  constructor() {
    super('AllocationScene');
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    this._scenario    = this.game.registry.get('scenario');
    this._role        = this.game.registry.get('role');
    this._difficulty  = DIFFICULTY[this.game.registry.get('difficulty') ?? 'normal'];
    this._totalPoints = this._role.totalPoints;

    // Apply ±5% randomisation to total points (starts at ±0 for easy, ±5% for normal/hard)
    const variance = this.game.registry.get('difficulty') === 'easy' ? 0 : 0.05;
    const rand = 1 + (Math.random() * 2 - 1) * variance;
    this._totalPoints = Math.round(this._role.totalPoints * rand);

    this._allocation  = { artillery: 0, air_defense: 0, energy: 0, logistics: 0, cyber: 0, naval: 0 };
    this._appliedEvents = [];
    this._timeLeft    = this._difficulty.timer;
    this._submitted   = false;

    // Focus globe on region
    focusOnRegion(this._scenario.region);

    // ── Build UI ──────────────────────────────────────────────────────────────
    this._buildBackground();
    this._buildTopBar();
    this._buildIntelPanel();
    this._buildResourceRows();
    this._buildRightPanel();
    this._buildSubmitBar();
    this._updateRemainingPoints();

    // ── Timer ─────────────────────────────────────────────────────────────────
    this._timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this._timeLeft - 1,
      callback: this._onTimerTick,
      callbackScope: this,
    });

    // ── Schedule random events ────────────────────────────────────────────────
    this._scheduleEvents();

    this.cameras.main.fadeIn(400, 5, 10, 20);
  }

  _buildBackground() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const bg = this.add.graphics();

    // Semi-transparent full overlay
    bg.fillStyle(C.BG, 0.82);
    bg.fillRect(0, 0, W, H);

    // Left intel panel background
    bg.fillStyle(C.PANEL, 0.9);
    bg.fillRect(0, 62, 220, H - 62);

    // Right info panel background
    bg.fillStyle(C.PANEL, 0.9);
    bg.fillRect(RIGHT_X - 10, 62, W - RIGHT_X + 10, H - 62);

    // Panel separators
    const lines = this.add.graphics();
    lines.lineStyle(1, C.RED, 0.6);
    lines.lineBetween(0, 62, W, 62);
    lines.lineStyle(1, C.BORDER, 0.5);
    lines.lineBetween(220, 62, 220, H);
    lines.lineBetween(RIGHT_X - 10, 62, RIGHT_X - 10, H);
  }

  _buildTopBar() {
    const W = GAME_WIDTH;
    const topBg = this.add.graphics();
    topBg.fillStyle(C.PANEL, 1);
    topBg.fillRect(0, 0, W, 62);
    topBg.lineStyle(2, C.RED, 1);
    topBg.lineBetween(0, 62, W, 62);

    // Scenario + role
    this.add.text(LEFT_X, 31, `${this._scenario.title} — ${this._role.flag} ${this._role.name}`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0, 0.5);

    // Timer display
    this._timerBg = this.add.rectangle(W / 2, 31, 130, 40, C.PANEL_LIGHT);
    this._timerBg.setStrokeStyle(1, C.GREEN);

    this._timerText = this.add.text(W / 2, 31, this._fmtTime(this._timeLeft), {
      fontFamily: "'Noto Sans TC', monospace",
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#2ecc71',
    }).setOrigin(0.5);

    this.add.text(W / 2, 52, '剩餘時間', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '9px',
      color: '#34495e',
    }).setOrigin(0.5);

    // Total points label (top-right)
    this.add.text(W - 20, 18, `可分配點數：${this._totalPoints}`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '12px',
      color: '#ecf0f1',
    }).setOrigin(1, 0.5);

    this._remainText = this.add.text(W - 20, 44, `剩餘：${this._totalPoints}`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#f1c40f',
    }).setOrigin(1, 0.5);
  }

  _buildIntelPanel() {
    const intel = this._scenario.intel;
    const diff  = this.game.registry.get('difficulty') ?? 'normal';

    this.add.text(14, 80, '情報', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px',
      color: '#c0392b',
      letterSpacing: 3,
    });

    this.add.text(14, 96, '─'.repeat(14), { fontSize: '10px', color: '#1e3a5f' });

    let count = diff === 'easy' ? 2 : (diff === 'normal' ? 2 : 1);

    intel.slice(0, count).forEach((item, i) => {
      // In easy mode show all intel as-is; in hard mode sometimes show misleading ones
      const showAccurate = diff === 'easy' ? true : (diff === 'normal' ? Math.random() > 0.3 : Math.random() > 0.6);
      const displayItem = showAccurate ? item : this._scrambleIntel(item, intel);

      const iconColor = displayItem.accurate ? '#27ae60' : '#e67e22';
      const icon      = displayItem.accurate ? '◆' : '◇';

      this.add.text(14, 112 + i * 66, icon, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: iconColor,
      });

      this.add.text(24, 112 + i * 66, displayItem.text, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '11px',
        color: '#bdc3c7',
        wordWrap: { width: 186 },
        lineSpacing: 3,
      });
    });

    // Events log header
    this._eventsLogY = 112 + count * 66 + 20;
    this._eventsLogContainer = this.add.container(0, 0);

    this.add.text(14, this._eventsLogY - 20, '─'.repeat(14), { fontSize: '10px', color: '#1e3a5f' });
    this.add.text(14, this._eventsLogY - 6, '事件紀錄', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px',
      color: '#c0392b',
      letterSpacing: 2,
    });
  }

  _buildResourceRows() {
    this._rowElements = {};
    const yStart = 78;

    RESOURCES.forEach((res, i) => {
      const y = yStart + i * ROW_H;
      this._buildResourceRow(res, i, y);
    });
  }

  _buildResourceRow(res, index, y) {
    const { id, name, icon, color, desc } = res;

    // Row bg (zebra stripe)
    if (index % 2 === 0) {
      const rowBg = this.add.graphics();
      rowBg.fillStyle(C.PANEL_LIGHT, 0.3);
      rowBg.fillRect(222, y - 2, RIGHT_X - 232, ROW_H - 4);
    }

    // Icon
    this.add.text(236, y + 20, icon, { fontSize: '22px' });

    // Name
    this.add.text(268, y + 10, name, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    });

    // Description
    this.add.text(268, y + 30, desc, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px',
      color: '#7f8c8d',
    });

    // Bar track
    const trackX = BAR_X - BAR_W / 2;
    const trackBg = this.add.graphics();
    trackBg.fillStyle(0x0d1b2a, 1);
    trackBg.fillRoundedRect(trackX, y + 44, BAR_W, BAR_H, 4);
    trackBg.lineStyle(1, C.BORDER, 0.7);
    trackBg.strokeRoundedRect(trackX, y + 44, BAR_W, BAR_H, 4);

    // Bar fill
    const fill = this.add.graphics();
    fill.fillStyle(color, 0.85);

    // Value text
    const valText = this.add.text(BAR_X + BAR_W / 2 + 50, y + 58, '0', {
      fontFamily: 'monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    }).setOrigin(0.5);

    // Max text
    this.add.text(BAR_X + BAR_W / 2 + 78, y + 58, `/ ${this._totalPoints}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#34495e',
    }).setOrigin(0, 0.5);

    // Minus button
    const minusBg = this.add.rectangle(BAR_X - BAR_W / 2 - 36, y + 58, 30, 30, C.PANEL_LIGHT);
    minusBg.setStrokeStyle(1, C.BORDER);
    const minusTxt = this.add.text(BAR_X - BAR_W / 2 - 36, y + 58, '−', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ecf0f1',
    }).setOrigin(0.5);

    // Plus button
    const plusBg = this.add.rectangle(BAR_X + BAR_W / 2 + 24, y + 58, 30, 30, C.RED);
    const plusTxt = this.add.text(BAR_X + BAR_W / 2 + 24, y + 58, '+', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Interactivity
    minusBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this._adjustAllocation(id, -1))
      .on('pointerover', () => minusBg.setFillStyle(C.DIM))
      .on('pointerout',  () => minusBg.setFillStyle(C.PANEL_LIGHT));

    plusBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this._adjustAllocation(id, 1))
      .on('pointerover', () => plusBg.setFillStyle(C.RED_BRIGHT))
      .on('pointerout',  () => plusBg.setFillStyle(C.RED));

    // Allow clicking on the bar itself to set a value
    const hitArea = this.add.rectangle(BAR_X, y + 58, BAR_W, BAR_H + 12, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (ptr) => {
        const pct = Phaser.Math.Clamp((ptr.x - trackX) / BAR_W, 0, 1);
        const newVal = Math.round(pct * this._totalPoints);
        const delta = newVal - this._allocation[id];
        this._adjustAllocation(id, delta);
      });

    this._rowElements[id] = { fill, valText, trackX, y, color };
  }

  _buildRightPanel() {
    const X = RIGHT_X + 5;
    const W = GAME_WIDTH;

    this.add.text(X, 80, '角色資訊', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px',
      color: '#c0392b',
      letterSpacing: 2,
    });

    this.add.text(X, 96, '─'.repeat(14), { fontSize: '10px', color: '#1e3a5f' });

    this.add.text(X, 110, `${this._role.flag} ${this._role.name}`, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    });

    this.add.text(X, 132, this._role.description, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      color: '#7f8c8d',
      wordWrap: { width: W - X - 10 },
      lineSpacing: 3,
    });

    // Stats
    const stats = [
      { label: '初始國債', value: `${this._role.baseDebt}% GDP` },
      { label: '初始 GDP', value: `${this._role.baseGDP} 兆美元` },
      { label: '可用點數', value: `${this._totalPoints} 點` },
    ];

    stats.forEach(({ label, value }, i) => {
      this.add.text(X, 190 + i * 44, label, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '10px',
        color: '#34495e',
      });
      this.add.text(X, 204 + i * 44, value, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#bdc3c7',
      });
    });

    // Tips
    const tipsDivider = this.add.graphics();
    tipsDivider.lineStyle(1, C.BORDER, 0.5);
    tipsDivider.lineBetween(X, 340, W - 10, 340);

    this.add.text(X, 348, '提示', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px',
      color: '#c0392b',
      letterSpacing: 2,
    });

    const diff = this.game.registry.get('difficulty') ?? 'normal';
    const tips = diff === 'easy'
      ? ['初學者建議：\n先閱讀情報提示\n再平衡各項分配。']
      : ['所有點數用完\n可獲得效率加成。', '事件將改變\n最優配置，\n保留彈性！'];

    tips.forEach((tip, i) => {
      this.add.text(X, 366 + i * 70, tip, {
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: '11px',
        color: '#34495e',
        lineSpacing: 4,
      });
    });
  }

  _buildSubmitBar() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    const submitBg = this.add.graphics();
    submitBg.fillStyle(C.PANEL, 1);
    submitBg.fillRect(220, H - 56, W - 220 - (W - RIGHT_X + 10), 56);
    submitBg.lineStyle(1, C.BORDER, 0.5);
    submitBg.lineBetween(220, H - 56, RIGHT_X - 10, H - 56);

    const submitBtn = this.add.rectangle(BAR_X, H - 28, 240, 40, C.GREEN);
    submitBtn.setStrokeStyle(1, 0x2ecc71);

    this.add.text(BAR_X, H - 28, '⚑  提前提交', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    submitBtn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => submitBtn.setFillStyle(C.GREEN_BRIGHT))
      .on('pointerout',   () => submitBtn.setFillStyle(C.GREEN))
      .on('pointerdown',  () => this._submitAllocation());
  }

  // ── Timer ────────────────────────────────────────────────────────────────────

  _onTimerTick() {
    if (this._submitted) return;
    this._timeLeft--;

    this._timerText.setText(this._fmtTime(this._timeLeft));

    // Color shift
    if (this._timeLeft <= 10) {
      this._timerText.setColor('#e74c3c');
      this._timerBg.setStrokeStyle(1, C.RED_BRIGHT);
      // Screen shake
      this.cameras.main.shake(120, 0.003);
    } else if (this._timeLeft <= 30) {
      this._timerText.setColor('#f39c12');
      this._timerBg.setStrokeStyle(1, 0xf39c12);
    }

    if (this._timeLeft <= 0) {
      this._submitAllocation();
    }
  }

  _fmtTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Allocation ───────────────────────────────────────────────────────────────

  _adjustAllocation(resId, delta) {
    if (this._submitted) return;

    const current = this._allocation[resId];
    const remaining = this._getRemainingPoints();

    let newVal = current + delta;
    newVal = Math.max(0, newVal);

    // Can't exceed total points
    if (delta > 0 && remaining < delta) {
      newVal = current + remaining;
    }
    if (newVal === current) return;

    this._allocation[resId] = newVal;
    this._updateRowVisual(resId);
    this._updateRemainingPoints();
  }

  _getRemainingPoints() {
    const used = Object.values(this._allocation).reduce((a, b) => a + b, 0);
    return this._totalPoints - used;
  }

  _updateRowVisual(resId) {
    const el = this._rowElements[resId];
    if (!el) return;

    const val  = this._allocation[resId];
    const pct  = this._totalPoints > 0 ? val / this._totalPoints : 0;
    const fillW = Math.max(0, pct * BAR_W - 4);

    el.fill.clear();
    if (fillW > 0) {
      el.fill.fillStyle(el.color, 0.85);
      el.fill.fillRoundedRect(el.trackX + 2, el.y + 46, fillW, BAR_H - 4, 3);
    }

    el.valText.setText(String(val));
  }

  _updateRemainingPoints() {
    const rem = this._getRemainingPoints();
    this._remainText.setText(`剩餘：${rem}`);
    this._remainText.setColor(rem === 0 ? '#27ae60' : '#f1c40f');
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  _scheduleEvents() {
    const count = this._difficulty.eventCount;
    const timerDuration = this._timeLeft;

    // Select applicable events for this scenario
    const applicable = eventsData.filter(e =>
      e.scenarios.includes(this._scenario.id)
    );

    if (applicable.length === 0) return;

    // Shuffle and pick `count` events
    const shuffled = Phaser.Utils.Array.Shuffle([...applicable]);
    const selected = shuffled.slice(0, count);

    // Spread them across the timer, avoiding first/last 15%
    selected.forEach((event, i) => {
      const minT = timerDuration * 0.15;
      const maxT = timerDuration * 0.85;
      const span = (maxT - minT) / (count + 1);
      const triggerAt = timerDuration - Math.round(minT + span * (i + 1));

      this.time.addEvent({
        delay: (timerDuration - triggerAt) * 1000,
        callback: () => {
          if (!this._submitted) this._triggerEvent(event);
        },
      });
    });
  }

  _triggerEvent(eventData) {
    // Pause timer
    this._timerEvent.paused = true;

    // Apply point changes immediately (before player sees)
    if (eventData.effects?.pointLoss) {
      for (const [key, val] of Object.entries(eventData.effects.pointLoss)) {
        this._allocation[key] = Math.max(0, this._allocation[key] - val);
        this._updateRowVisual(key);
      }
      this._totalPoints = Math.max(1, this._totalPoints - Object.values(eventData.effects.pointLoss).reduce((a, b) => a + b, 0));
    }

    if (eventData.effects?.pointGain) {
      this._totalPoints += eventData.effects.pointGain;
    }

    this._updateRemainingPoints();

    // Store event
    this._appliedEvents.push(eventData);

    // Log entry
    this._addEventLog(eventData);

    // Launch EventScene overlay
    this.scene.launch('EventScene', {
      event: eventData,
      onDismiss: () => {
        this.scene.stop('EventScene');
        if (!this._submitted) this._timerEvent.paused = false;
      },
    });
  }

  _addEventLog(eventData) {
    const logY = this._eventsLogY + this._appliedEvents.length * 50;
    if (logY > GAME_HEIGHT - 60) return;

    this.add.text(14, logY, eventData.icon, { fontSize: '14px' });
    this.add.text(30, logY, eventData.title, {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#e74c3c',
      wordWrap: { width: 180 },
    });
    this.add.text(30, logY + 18, '已觸發', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '10px',
      color: '#34495e',
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  _submitAllocation() {
    if (this._submitted) return;
    this._submitted = true;

    this._timerEvent.paused = true;

    this.game.registry.set('allocation', { ...this._allocation });
    this.game.registry.set('appliedEvents', [...this._appliedEvents]);
    this.game.registry.set('totalPoints', this._totalPoints);

    this.cameras.main.fade(500, 5, 10, 20);
    this.time.delayedCall(500, () => this.scene.start('ResultScene'));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────

  _scrambleIntel(item, allIntel) {
    // Return a different intel item (for misleading mode)
    const other = allIntel.filter(i => i !== item);
    return other.length > 0 ? other[Math.floor(Math.random() * other.length)] : item;
  }
}
