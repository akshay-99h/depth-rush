// Every sound is synthesised at runtime — the build ships no audio files and may
// make no network request. Placeholder-grade on purpose, but it makes the
// Music / Sound toggles in the settings sheet do something real.

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this._musicNodes = null;
  }

  // Browsers require a gesture before audio starts; call this from the first tap.
  unlock() {
    if (this.ctx) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.musicOn) this.startMusic();
  }

  _blip({ freq = 440, dur = 0.12, type = 'sine', gain = 0.14, slide = 0 }) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  pickup()    { this._blip({ freq: 620, slide: 480, dur: 0.16, type: 'triangle' }); }
  partFound() { this._blip({ freq: 440, slide: 440, dur: 0.26, type: 'square', gain: 0.1 }); }
  drillTick() { this._blip({ freq: 120, dur: 0.05, type: 'sawtooth', gain: 0.05 }); }
  installed() { this._blip({ freq: 300, slide: 300, dur: 0.3, type: 'triangle', gain: 0.14 }); }
  surfaced()  { this._blip({ freq: 300, slide: 320, dur: 0.22, type: 'sine' }); }
  alarm()     { this._blip({ freq: 880, slide: -420, dur: 0.2, type: 'square', gain: 0.09 }); }
  danger()    { this._blip({ freq: 200, slide: -110, dur: 0.22, type: 'sawtooth', gain: 0.09 }); }
  lose()      { this._blip({ freq: 240, slide: -180, dur: 0.7, type: 'sawtooth', gain: 0.14 }); }
  win()       { this._blip({ freq: 420, slide: 420, dur: 0.5, type: 'triangle', gain: 0.16 }); }

  // A slow two-note drone. Not a soundtrack — just enough that Music toggles something.
  startMusic() {
    if (!this.ctx || this._musicNodes) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    const a = this.ctx.createOscillator();
    const b = this.ctx.createOscillator();
    a.type = b.type = 'sine';
    a.frequency.value = 55;
    b.frequency.value = 82.5;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    a.connect(g); b.connect(g);
    g.connect(this.ctx.destination);
    a.start(t); b.start(t); lfo.start(t);
    this._musicNodes = { a, b, lfo, g };
  }

  stopMusic() {
    if (!this._musicNodes) return;
    const { a, b, lfo, g } = this._musicNodes;
    try { a.stop(); b.stop(); lfo.stop(); g.disconnect(); } catch { /* already stopped */ }
    this._musicNodes = null;
  }

  setMusic(on) { this.musicOn = on; on ? this.startMusic() : this.stopMusic(); }
  setSfx(on)   { this.sfxOn = on; }
}
