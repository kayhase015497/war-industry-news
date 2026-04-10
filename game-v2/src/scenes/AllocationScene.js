import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT, RESOURCES, DIFFICULTY } from '../constants.js';
import eventsData from '../data/events.json';
import { focusOnRegion } from '../globe.js';
import { sfxClick, sfxIncrease, sfxDecrease, sfxEvent, sfxTick, sfxTimerWarning, sfxTransition } from '../audio.js';

const BAR_X   = 670;   // center X of bar
const BAR_W   = 440;
const BAR_H   = 26;
const LEFT_X  = 60;
const RIGHT_X = 930;
const ROW_H   = 95;
const Y_START = 74;

export class AllocationScene extends Phaser.Scene {
  constructor() {
    super('AllocationScene');
  }

  create() {
    this._scenario    = this.game.registry.get('scenario');
    this._role        = this.game.registry.get('role');          // 'defender' | 'attacker'
    this._roleData    = this.game.registry.get('roleData');
    this._difficulty  = DIFFICULTY[this.game.registry.get('difficulty') ?? 'normal'];
    this._totalPoints = this.game.registry.get('totalPoints');
    this._allocation  = { shell: 0, drone: 0, intercept: 0, energy: 0, mineral: 0 };
    this._appliedEvents = [];
    this._timeLeft    = this._difficulty.timer;
    this._submitted   = false;
    this._tickPlayed  = false;

    // Special rules (Houthi attacker)
    this._lockedResources = this._roleData.specialRules?.lockedResources ?? [];

    focusOnRegion(this._scenario.region);

    this._buildBackground();
    this._buildTopBar();
    this._buildIntelPanel();
    this._buildResourceRows();
    this._buildRightPanel();
    this._buildSubmitBar();
    this._updateRemainingPoints();

    this._timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this._timeLeft - 1,
      callback: this._onTimerTick,
      callbackScope: this,
    });

    this._scheduleEvents();
    this.cameras.main.fadeIn(400, 5, 10, 20);
  }

  // ── Background & panels ────────────────────────────────────────────

  _buildBackground() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const bg = this.add.graphics();
    bg.fillStyle(C.BG, 0.83);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(C.PANEL, 0.93);
    bg.fillRect(0, 62, 220, H - 62);
    bg.fillStyle(C.PANEL, 0.93);
    bg.fillRect(RIGHT_X - 10, 62, W - RIGHT_X + 10, H - 62);

    const lines = this.add.graphics();
    lines.lineStyle(1, C.RED, 0.7);
    lines.lineBetween(0, 62, W, 62);
    lines.lineStyle(1, C.BORDER, 0.4);
    lines.lineBetween(220, 62, 220, H);
    lines.lineBetween(RIGHT_X - 10, 62, RIGHT_X - 10, H);
  }

  _buildTopBar() {
    const W = GAME_WIDTH;
    const top = this.add.graphics();
    top.fillStyle(C.PANEL, 1);
    top.fillRect(0, 0, W, 62);
    top.lineStyle(2, C.RED, 1);
    top.lineBetween(0, 62, W, 62);

    // Scenario + role label
    const roleLabel = this._role === 'defender' ? '🛡 守方' : '⚔ 攻方';
    this.add.text(LEFT_X, 31,
      `${this._scenario.emoji} ${this._scenario.title}  —  ${roleLabel}：${this._roleData.country} ${this._roleData.flag}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', fontStyle: 'bold', color: '#ecf0f1',
    }).setOrigin(0, 0.5);

    // Timer
    this._timerBg = this.add.rectangle(W / 2, 31, 130, 40, C.PANEL_LIGHT);
    this._timerBg.setStrokeStyle(1.5, C.GREEN);
    this._timerText = this.add.text(W / 2, 28, this._fmtTime(this._timeLeft), {
      fontFamily: "'Noto Sans TC', monospace", fontSize: '22px', fontStyle: 'bold', color: '#2ecc71',
    }).setOrigin(0.5);
    this.add.text(W / 2, 52, '剩餘時間', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '9px', color: '#34495e',
    }).setOrigin(0.5);

    // Remaining points (top-right)
    this.add.text(W - 20, 20, `可用點數：${this._totalPoints}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#ecf0f1',
    }).setOrigin(1, 0.5);
    this._remainText = this.add.text(W - 20, 44, `剩餘 ${this._totalPoints}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', fontStyle: 'bold', color: '#f1c40f',
    }).setOrigin(1, 0.5);
  }

  _buildIntelPanel() {
    const intel = this._scenario.intel;
    const diff  = this.game.registry.get('difficulty') ?? 'normal';
    const count = diff === 'hard' ? 1 : 2;

    this.add.text(14, 78, '情報', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#c0392b', letterSpacing: 3,
    });
    this.add.text(14, 92, '─'.repeat(13), { fontSize: '10px', color: '#1e3a5f' });

    intel.slice(0, count).forEach((item, i) => {
      const isAccurate = diff === 'easy' || (diff === 'normal' ? Math.random() > 0.25 : Math.random() > 0.6);
      const display    = isAccurate ? item : (intel.find(x => x !== item) ?? item);
      const icon = display.accurate ? '◆' : '◇';
      const col  = display.accurate ? '#27ae60' : '#e67e22';

      this.add.text(14, 108 + i * 62, icon, { fontFamily: 'monospace', fontSize: '10px', color: col });
      this.add.text(24, 108 + i * 62, display.text, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#bdc3c7',
        wordWrap: { width: 188 }, lineSpacing: 3,
      });
    });

    this._eventsLogBaseY = 108 + count * 62 + 24;
    this.add.text(14, this._eventsLogBaseY - 18, '─'.repeat(13), { fontSize: '10px', color: '#1e3a5f' });
    this.add.text(14, this._eventsLogBaseY - 6, '事件紀錄', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#c0392b', letterSpacing: 2,
    });
  }

  _buildResourceRows() {
    this._rowElements = {};

    RESOURCES.forEach((res, i) => {
      const y = Y_START + i * ROW_H;
      const locked = this._lockedResources.includes(res.id);
      this._buildResourceRow(res, i, y, locked);
    });
  }

  _buildResourceRow(res, index, y, locked) {
    const { id, name, icon, color, desc } = res;

    // Zebra stripe
    if (index % 2 === 0) {
      const stripe = this.add.graphics();
      stripe.fillStyle(C.PANEL_LIGHT, 0.25);
      stripe.fillRect(222, y - 2, RIGHT_X - 232, ROW_H - 6);
    }

    // Icon + name
    const iconAlpha = locked ? 0.3 : 1;
    this.add.text(236, y + 20, icon, { fontSize: '20px', alpha: iconAlpha });
    this.add.text(268, y + 10, name, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', fontStyle: 'bold',
      color: locked ? '#34495e' : '#ecf0f1',
    });
    this.add.text(268, y + 30, desc, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#4a6274',
    });

    if (locked) {
      this.add.text(268, y + 50, '（此陣營不使用）', {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '9px', color: '#34495e',
      });
    }

    // Bar track
    const trackX = BAR_X - BAR_W / 2;
    const trackBg = this.add.graphics();
    trackBg.fillStyle(0x0d1b2a, locked ? 0.3 : 1);
    trackBg.fillRoundedRect(trackX, y + 46, BAR_W, BAR_H, 4);
    if (!locked) {
      trackBg.lineStyle(1, C.BORDER, 0.6);
      trackBg.strokeRoundedRect(trackX, y + 46, BAR_W, BAR_H, 4);
    }

    // Bar fill
    const fill = this.add.graphics();

    // Value text
    const valText = this.add.text(BAR_X + BAR_W / 2 + 46, y + 59, '0', {
      fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold',
      color: locked ? '#34495e' : '#ecf0f1',
    }).setOrigin(0.5);

    this.add.text(BAR_X + BAR_W / 2 + 72, y + 59, `/ ${this._totalPoints}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#34495e',
    }).setOrigin(0, 0.5);

    if (!locked) {
      // Minus button
      const minusBg = this.add.rectangle(BAR_X - BAR_W / 2 - 36, y + 59, 30, 30, C.PANEL_LIGHT);
      minusBg.setStrokeStyle(1, C.BORDER);
      this.add.text(BAR_X - BAR_W / 2 - 36, y + 59, '−', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ecf0f1',
      }).setOrigin(0.5);

      // Plus button
      const plusBg = this.add.rectangle(BAR_X + BAR_W / 2 + 24, y + 59, 30, 30, C.RED);
      this.add.text(BAR_X + BAR_W / 2 + 24, y + 59, '+', {
        fontFamily: 'monospace', fontSize: '18px', color: '#fff',
      }).setOrigin(0.5);

      minusBg.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { sfxDecrease(); this._adjustAllocation(id, -1); })
        .on('pointerover', () => minusBg.setFillStyle(C.DIM))
        .on('pointerout',  () => minusBg.setFillStyle(C.PANEL_LIGHT));

      plusBg.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { sfxIncrease(); this._adjustAllocation(id, 1); })
        .on('pointerover', () => plusBg.setFillStyle(C.RED_BRIGHT))
        .on('pointerout',  () => plusBg.setFillStyle(C.RED));

      // Click on bar to set value
      this.add.rectangle(BAR_X, y + 59, BAR_W, BAR_H + 10, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (ptr) => {
          const pct    = Phaser.Math.Clamp((ptr.x - trackX) / BAR_W, 0, 1);
          const newVal = Math.round(pct * this._totalPoints);
          const delta  = newVal - this._allocation[id];
          if (delta !== 0) {
            delta > 0 ? sfxIncrease() : sfxDecrease();
            this._adjustAllocation(id, delta);
          }
        });
    }

    this._rowElements[id] = { fill, valText, trackX, y, color, locked };
  }

  _buildRightPanel() {
    const X = RIGHT_X + 5, W = GAME_WIDTH;

    this.add.text(X, 78, '陣營資訊', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#c0392b', letterSpacing: 2,
    });
    this.add.text(X, 92, '─'.repeat(14), { fontSize: '10px', color: '#1e3a5f' });

    const roleLabel = this._role === 'defender' ? '🛡 守方' : '⚔ 攻方';
    this.add.text(X, 106, `${roleLabel}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#7f8c8d',
    });
    this.add.text(X, 122, `${this._roleData.flag} ${this._roleData.country}`, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '16px', fontStyle: 'bold', color: '#ecf0f1',
    });

    const diff = this.game.registry.get('difficulty') ?? 'normal';
    const pts  = this._totalPoints;
    const stats = [
      { label: '工業力點數', value: `${pts} 點` },
      { label: '起始國債',  value: this._roleData.debtPct !== null ? `${this._roleData.debtPct}% GDP` : '特殊規則' },
      { label: '懲罰係數',  value: this._roleData.gdpMult !== null ? `×${this._roleData.gdpMult}` : '—' },
    ];
    stats.forEach(({ label, value }, i) => {
      this.add.text(X, 165 + i * 42, label, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#34495e',
      });
      this.add.text(X, 178 + i * 42, value, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '13px', fontStyle: 'bold', color: '#bdc3c7',
      });
    });

    // Tips divider
    const td = this.add.graphics();
    td.lineStyle(1, C.BORDER, 0.5);
    td.lineBetween(X, 308, W - 10, 308);

    this.add.text(X, 316, '提示', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#c0392b', letterSpacing: 2,
    });

    const tips = diff === 'easy'
      ? ['所有點數用完\n可獲效率加成。', '仔細閱讀情報\n但也別全信。']
      : ['突發事件會改變\n最優解配置\n請保持彈性。', '國債懲罰依\n陣營規模不同\n小國代價更大！'];

    tips.forEach((tip, i) => {
      this.add.text(X, 334 + i * 72, tip, {
        fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', color: '#34495e', lineSpacing: 4,
      });
    });
  }

  _buildSubmitBar() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const subBg = this.add.graphics();
    subBg.fillStyle(C.PANEL, 1);
    subBg.fillRect(220, H - 56, RIGHT_X - 230, 56);
    subBg.lineStyle(1, C.BORDER, 0.4);
    subBg.lineBetween(220, H - 56, RIGHT_X - 10, H - 56);

    const btn = this.add.rectangle(BAR_X, H - 28, 240, 40, C.GREEN);
    btn.setStrokeStyle(1, 0x2ecc71);
    this.add.text(BAR_X, H - 28, '⚑  提前提交配置', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '14px', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5);

    btn.setInteractive({ useHandCursor: true })
      .on('pointerover',  () => btn.setFillStyle(C.GREEN_BRIGHT))
      .on('pointerout',   () => btn.setFillStyle(C.GREEN))
      .on('pointerdown',  () => { sfxClick(); this._submitAllocation(); });
  }

  // ── Timer ─────────────────────────────────────────────────────────

  _onTimerTick() {
    if (this._submitted) return;
    this._timeLeft--;
    this._timerText.setText(this._fmtTime(this._timeLeft));

    if (this._timeLeft <= 10) {
      this._timerText.setColor('#e74c3c');
      this._timerBg.setStrokeStyle(2, C.RED_BRIGHT);
      sfxTimerWarning();
      this.cameras.main.shake(100, 0.003);
    } else if (this._timeLeft <= 30) {
      this._timerText.setColor('#f39c12');
      this._timerBg.setStrokeStyle(1.5, 0xf39c12);
      sfxTick();
    }

    if (this._timeLeft <= 0) this._submitAllocation();
  }

  _fmtTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Allocation ────────────────────────────────────────────────────

  _adjustAllocation(id, delta) {
    if (this._submitted || this._lockedResources.includes(id)) return;
    const cur = this._allocation[id];
    const rem = this._getRemainingPoints();
    let nv    = Phaser.Math.Clamp(cur + delta, 0, cur + rem);
    if (nv === cur) return;
    this._allocation[id] = nv;
    this._updateRowVisual(id);
    this._updateRemainingPoints();
  }

  _getRemainingPoints() {
    return this._totalPoints - Object.values(this._allocation).reduce((a, b) => a + b, 0);
  }

  _updateRowVisual(id) {
    const el = this._rowElements[id];
    if (!el || el.locked) return;
    const val   = this._allocation[id];
    const pct   = this._totalPoints > 0 ? val / this._totalPoints : 0;
    const fillW = Math.max(0, pct * BAR_W - 4);

    el.fill.clear();
    if (fillW > 0) {
      el.fill.fillStyle(el.color, 0.85);
      el.fill.fillRoundedRect(el.trackX + 2, el.y + 48, fillW, BAR_H - 4, 3);
    }
    el.valText.setText(String(val));
  }

  _updateRemainingPoints() {
    const rem = this._getRemainingPoints();
    this._remainText.setText(`剩餘 ${rem}`);
    this._remainText.setColor(rem === 0 ? '#2ecc71' : '#f1c40f');
  }

  // ── Events ────────────────────────────────────────────────────────

  _scheduleEvents() {
    const count = this._difficulty.eventCount;
    const total = this._timeLeft;
    const applicable = eventsData.filter(e => e.scenarios.includes(this._scenario.id));
    if (!applicable.length) return;

    const shuffled = Phaser.Utils.Array.Shuffle([...applicable]);
    const selected = shuffled.slice(0, count);

    selected.forEach((event, i) => {
      const minT     = total * 0.15;
      const maxT     = total * 0.80;
      const span     = (maxT - minT) / (count + 1);
      const triggerT = Math.round(minT + span * (i + 1));

      this.time.addEvent({
        delay: triggerT * 1000,
        callback: () => { if (!this._submitted) this._triggerEvent(event); },
      });
    });
  }

  _triggerEvent(eventData) {
    this._timerEvent.paused = true;
    sfxEvent();

    // Apply immediate point loss
    if (eventData.effects?.pointLoss) {
      for (const [k, v] of Object.entries(eventData.effects.pointLoss)) {
        this._allocation[k] = Math.max(0, this._allocation[k] - v);
        this._updateRowVisual(k);
      }
      this._totalPoints = Math.max(
        Object.values(this._allocation).reduce((a, b) => a + b, 0) + 1,
        this._totalPoints - Object.values(eventData.effects.pointLoss).reduce((a, b) => a + b, 0)
      );
    }

    if (eventData.effects?.pointGain) this._totalPoints += eventData.effects.pointGain;

    this._updateRemainingPoints();
    this._appliedEvents.push(eventData);
    this._addEventLog(eventData);

    this.scene.launch('EventScene', {
      event: eventData,
      onDismiss: () => {
        this.scene.stop('EventScene');
        if (!this._submitted) this._timerEvent.paused = false;
      },
    });
  }

  _addEventLog(eventData) {
    const logY = this._eventsLogBaseY + (this._appliedEvents.length - 1) * 46;
    if (logY > GAME_HEIGHT - 70) return;
    this.add.text(14, logY + 2, eventData.icon, { fontSize: '13px' });
    this.add.text(30, logY + 2, eventData.title, {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '11px', fontStyle: 'bold', color: '#e74c3c',
    });
    this.add.text(30, logY + 18, '已觸發', {
      fontFamily: "'Noto Sans TC', sans-serif", fontSize: '10px', color: '#34495e',
    });
  }

  // ── Submit ────────────────────────────────────────────────────────

  _submitAllocation() {
    if (this._submitted) return;
    this._submitted = true;
    this._timerEvent.paused = true;
    sfxTransition();

    this.game.registry.set('allocation',    { ...this._allocation });
    this.game.registry.set('appliedEvents', [...this._appliedEvents]);
    this.game.registry.set('totalPoints',   this._totalPoints);

    this.cameras.main.fade(500, 5, 10, 20);
    this.time.delayedCall(500, () => this.scene.start('ResultScene'));
  }
}
