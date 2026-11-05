let ctx = null, on = false;
export const sfx = {
  get enabled() { return on; },
  set(v) {
    on = v;
    if (v && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { on = false; } }
    if (v && ctx && ctx.state === 'suspended') ctx.resume();
  },
  tone(freq, dur = 0.12, type = 'sine', gain = 0.05, delay = 0, slideTo = null) {
    if (!on || !ctx) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  play(kind) {
    if (kind === 'select') { this.tone(520, 0.1, 'sine', 0.05); this.tone(780, 0.16, 'sine', 0.05, 0.07); }
    else if (kind === 'tick') this.tone(960, 0.04, 'square', 0.015);
    else if (kind === 'whoosh') this.tone(180, 0.7, 'sawtooth', 0.02, 0, 900);
    else if (kind === 'chime') [660, 880, 1320].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.045, i * 0.09));
  }
};
