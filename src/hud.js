// DOM bindings for the persistent HUD. Nothing here decides anything — it only
// renders whatever the sim already computed.
import { CONFIG } from './config.js';


const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.timerWrap = $('hud-timer');
    this.timer = $('timer-value');
    this.shipFill = $('ship-fill');
    this.checklist = $('checklist');
    this.checklistItems = $('checklist-items');
    this.clInstalled = $('cl-installed');
    this.clCarry = $('cl-carry');
    this.clTotal = document.querySelector('#checklist-count .cl-total');
    this.boost = $('btn-boost');
    this.vignette = $('danger-vignette');
    this.hint = $('dive-hint');
    this.toast = $('toast');
    this.repairFill = document.querySelector('#btn-repair .fill');
    this.btnRepair = $('btn-repair');
    this.repairLabel = document.querySelector('#btn-repair span');
    this.boatStatus = $('boat-status');
    this.depth = $('depth-value');
    this.progressCap = document.querySelector('#ship-progress .cap');
    this.partsCap = document.querySelector('#btn-checklist .chip-label');

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
    const obj = game.objective;
    const NOUN = { salvage: 'Parts', beacon: 'Beacons', haul: 'Cargo' }[obj];

    const t = Math.max(0, s.timeLeft);
    this.timer.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    this.timerWrap.dataset.late = t <= CONFIG.run.criticalSeconds ? 'critical'
      : t <= CONFIG.run.lateGameSeconds ? 'true' : 'false';

    const total = game.partsTotal;
    const done = game.goalDone;
    this.shipFill.style.width = `${(done / Math.max(1, total)) * 100}%`;
    this.progressCap.textContent =
      obj === 'beacon' ? 'Survey progress' : obj === 'haul' ? 'Cargo delivered' : 'Progress of ship';
    this.partsCap.textContent = NOUN;

    const items = game.checklist;
    // Fitted is the number that matters, but carrying has to register too —
    // otherwise recovering a part looks like nothing happened.
    this.clInstalled.textContent = `${done}`;
    this.clTotal.textContent = `/${total}`;
    this.clCarry.textContent = s.carrying.length ? `+${s.carrying.length}` : '';
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

    this.depth.textContent = game.mode === 'dive'
      ? `${Math.round(Math.abs(game.diver.position.y))}M` : '0M';

    if (game.mode === 'dive') {
      this.boost.dataset.state = s.boosting ? 'active' : s.boostReady ? 'ready' : 'cooling';
      this.vignette.dataset.on = s.sharkThreat ? 'true' : 'false';

      let hint = '';
      if (s.drillRock) {
        hint = `${s.holdKind === 'anchor' ? 'Planting' : 'Drilling'} ${Math.round(s.drillProgress * 100)}%`;
      }
      else if (s.breathing) hint = 'Breathing — tank refilling';
      else if (s.sonar && s.sonar.mode === 'part' && s.sonar.dist < 5) hint = 'A part is close';
      this.hint.textContent = hint;
      this.hint.dataset.on = hint ? 'true' : 'false';
    } else {
      this.vignette.dataset.on = 'false';
      this.hint.dataset.on = 'false';
      const action = game.boatAction;
      this.repairFill.style.setProperty('--fill', `${s.repairProgress * 100}%`);
      this.btnRepair.disabled = !action.enabled;
      this.repairLabel.textContent = action.label;

      const carried = s.carrying.length;
      if (obj === 'beacon') {
        const left = total - s.planted;
        this.boatStatus.innerHTML = done >= total
          ? 'Survey complete.'
          : carried
            ? `Carrying <b>${carried}</b> beacon${carried === 1 ? '' : 's'} — ${left} anchor${left === 1 ? '' : 's'} left`
            : `Hold Load to take beacons aboard — ${left} anchor${left === 1 ? '' : 's'} left`;
      } else if (obj === 'haul') {
        this.boatStatus.innerHTML = done >= total
          ? 'All cargo delivered.'
          : carried
            ? 'Crate on deck — hold Unload to secure it'
            : `Dive for the next crate — <b>${total - done}</b> left`;
      } else {
        this.boatStatus.innerHTML = carried
          ? `Carrying <b>${carried}</b> part${carried === 1 ? '' : 's'} — hold Repair to fit ${carried === 1 ? 'it' : 'them'}`
          : done >= total ? 'The boat is whole.'
          : 'Nothing aboard. Dive for the next part.';
      }
    }
  }
}
