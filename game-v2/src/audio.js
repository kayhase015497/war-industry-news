/**
 * Synthesized sound effects using Web Audio API.
 * No audio files needed — all tones are generated programmatically.
 */

let _ctx = null;
let _muted = false;

function ctx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return null; }
  }
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = c.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  } catch { /* ignore */ }
}

// ── Public API ─────────────────────────────────────────────────────

/** UI click / button press */
export function sfxClick() {
  tone(700, 0.04, 'square', 0.05);
}

/** Confirm / selection */
export function sfxConfirm() {
  tone(660, 0.07, 'sine', 0.10);
  tone(880, 0.10, 'sine', 0.10, 0.07);
}

/** Resource value increase */
export function sfxIncrease() {
  tone(600, 0.05, 'sine', 0.07);
}

/** Resource value decrease */
export function sfxDecrease() {
  tone(380, 0.05, 'sine', 0.07);
}

/** Sudden event alarm — three short beeps */
export function sfxEvent() {
  tone(520, 0.12, 'sawtooth', 0.13, 0.00);
  tone(520, 0.12, 'sawtooth', 0.13, 0.20);
  tone(660, 0.18, 'sawtooth', 0.15, 0.40);
}

/** Timer tick (last 30 s) */
export function sfxTick() {
  tone(1100, 0.03, 'square', 0.04);
}

/** Timer warning (last 10 s) — urgent pulse */
export function sfxTimerWarning() {
  tone(880, 0.08, 'square', 0.09);
  tone(880, 0.08, 'square', 0.09, 0.15);
}

/** Score reveal — ascending arpeggio */
export function sfxScoreReveal() {
  [440, 554, 659, 880].forEach((f, i) => tone(f, 0.18, 'sine', 0.10, i * 0.10));
}

/** Good score (≥ 75) — major chord fanfare */
export function sfxScoreGood() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'sine', 0.10, i * 0.06));
}

/** Poor score (< 35) — descending tritone */
export function sfxScorePoor() {
  tone(440, 0.30, 'sine', 0.10, 0.00);
  tone(370, 0.30, 'sine', 0.10, 0.20);
  tone(311, 0.40, 'sine', 0.10, 0.40);
}

/** Scene transition swipe */
export function sfxTransition() {
  tone(200, 0.35, 'sine', 0.06);
}

/** Toggle mute on/off — returns new state */
export function toggleMute() {
  _muted = !_muted;
  return _muted;
}

export function isMuted() {
  return _muted;
}
