// HUD is plain DOM over the canvas — cheaper and crisper than in-scene text.
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.o2Fill = $('o2-fill');
    this.o2Wrap = $('hud-o2');
    this.timer = $('timer-value');
    this.timerWrap = $('hud-timer');
    this.score = $('score-value');
    this.parts = $('parts-value');
    this.depth = $('depth-value');
    this.sonarSweep = $('sonar-sweep');
    this.sonarTick = $('sonar-tick');
    this.boostBtn = $('boost-btn');
    this.warning = $('shark-warning');
  }

  update(state) {
    const pct = state.oxygen / CONFIG.oxygen.max;
    this.o2Fill.style.height = `${Math.max(0, pct) * 100}%`;
    this.o2Wrap.dataset.level = pct < CONFIG.oxygen.redBelow ? 'red'
      : pct < CONFIG.oxygen.amberBelow ? 'amber' : 'ok';

    const t = Math.max(0, state.timeLeft);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    this.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    this.timerWrap.dataset.late = t <= CONFIG.run.lateGameSeconds ? 'true' : 'false';

    this.score.textContent = state.bankedScore.toLocaleString();
    this.parts.textContent = `${state.carrying}`;
    this.depth.textContent = `${Math.abs(Math.round(state.depth))}M`;

    // Sonar: sweep rate and the bearing tick both key off the nearest part.
    const near = state.sonar;
    if (near) {
      this.sonarSweep.style.animationDuration = `${(0.35 + near.normalized * 2.6).toFixed(2)}s`;
      this.sonarSweep.style.opacity = `${0.35 + (1 - near.normalized) * 0.65}`;
      this.sonarTick.style.transform = `rotate(${near.bearingDeg}deg)`;
      this.sonarTick.style.opacity = '1';
    } else {
      this.sonarSweep.style.opacity = '0.25';
      this.sonarTick.style.opacity = '0';
    }

    this.boostBtn.dataset.state = state.boostReady ? (state.boosting ? 'active' : 'ready') : 'cooling';
    this.warning.dataset.on = state.sharkThreat ? 'true' : 'false';
  }
}
