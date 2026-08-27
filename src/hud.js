// DOM bindings for the persistent HUD. Nothing here decides anything — it only
// renders whatever the sim already computed.
import { CONFIG } from './config.js';
import { PART_COUNT } from './parts.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.timerWrap = $('hud-timer');
    this.timer = $('timer-value');
    this.shipFill = $('ship-fill');
    this.checklist = $('checklist');
    this.checklistItems = $('checklist-items');
    this.checklistCount = $('checklist-count');
    this.boost = $('btn-boost');
    this.vignette = $('danger-vignette');
    this.hint = $('dive-hint');
    this.toast = $('toast');
    this.repairFill = document.querySelector('#btn-repair .fill');
    this.btnRepair = $('btn-repair');
    this.boatStatus = $('boat-status');

    this._toastTimer = null;
    this._checklistSig = '';

    $('btn-checklist').addEventListener('click', () => {
      const open = this.checklist.dataset.open === 'true';
      this.checklist.dataset.open = String(!open);
    });
  }

  toastMessage(text) {
    this.toast.textContent = text;
    this.toast.dataset.on = 'true';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toast.dataset.on = 'false'; }, 1600);
  }

  update(game) {
    const s = game.state;
    if (!s) return;

    const t = Math.max(0, s.timeLeft);
    this.timer.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    this.timerWrap.dataset.late = t <= CONFIG.run.criticalSeconds ? 'critical'
      : t <= CONFIG.run.lateGameSeconds ? 'true' : 'false';

    this.shipFill.style.width = `${(s.installed.length / PART_COUNT) * 100}%`;

    const items = game.checklist;
    this.checklistCount.textContent = `${s.installed.length}/${PART_COUNT}`;
    const sig = items.map((i) => i.state).join('|');
    if (sig !== this._checklistSig) {
      this._checklistSig = sig;
      // Always name the part, even before it is found — knowing you still need a
      // rudder is the whole point of having a checklist.
      this.checklistItems.innerHTML = items.map((i) => `
        <div class="cl-item" data-state="${i.state}">
          <span class="cl-glyph">${i.glyph}</span>
          <span>${i.label}</span>
        </div>`).join('');
    }

    if (game.mode === 'dive') {
      this.boost.dataset.state = s.boosting ? 'active' : s.boostReady ? 'ready' : 'cooling';
      this.vignette.dataset.on = s.sharkThreat ? 'true' : 'false';

      let hint = '';
      if (s.drillRock) hint = `Drilling ${Math.round(s.drillProgress * 100)}%`;
      else if (s.sonar && s.sonar.dist < 4) hint = 'A part is close';
      this.hint.textContent = hint;
      this.hint.dataset.on = hint ? 'true' : 'false';
    } else {
      this.vignette.dataset.on = 'false';
      this.hint.dataset.on = 'false';
      this.repairFill.style.setProperty('--fill', `${s.repairProgress * 100}%`);
      this.btnRepair.disabled = !game.canRepair();

      const carried = s.carrying.length;
      this.boatStatus.innerHTML = carried
        ? `Carrying <b>${carried}</b> part${carried === 1 ? '' : 's'} — hold Repair to fit ${carried === 1 ? 'it' : 'them'}`
        : s.installed.length >= PART_COUNT ? 'The boat is whole.'
        : 'Nothing aboard. Dive for the next part.';
    }
  }
}
