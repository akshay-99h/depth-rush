// DOM bindings for the HUD. Nothing here decides anything — it only renders
// whatever the sim already computed.
//
// Two surfaces share this: the painted home screen (Dive / Repair and its
// checklist pill) and the underwater HUD (clock, boat progress, checklist pill,
// oxygen badge). Which one is on screen is the caller's business.
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.timerWrap = $('hud-timer');
    this.timer = $('timer-value');
    this.shipFill = $('ship-fill');
    this.boost = $('btn-boost');
    this.vignette = $('danger-vignette');
    this.hint = $('dive-hint');
    this.toast = $('toast');
    // Repair lives on the 3D deck you surface onto, not on the painted home
    // screen — that one is pre-dive, when there is nothing to fit yet.
    this.repairFill = document.querySelector('#btn-deck-repair .fill');
    this.btnRepair = $('btn-deck-repair');
    this.repairLabel = document.querySelector('#btn-deck-repair span');
    this.boatStatus = $('boat-status');

    // Both checklist pills carry the same data-part slots.
    this.pillSlots = [...document.querySelectorAll('#checklist-pill .cl-slot')];
    this.uwSlots = [...document.querySelectorAll('#uw-pill .uw-slot')];

    this.o2 = $('o2-badge');
    this.o2Fill = document.querySelector('#o2-badge .o2-fill');

    this._toastTimer = null;
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
    // Zero-padded to match the artwork's 08:00.
    this.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:`
      + String(Math.floor(t % 60)).padStart(2, '0');
    this.timerWrap.dataset.late = t <= CONFIG.run.criticalSeconds ? 'critical'
      : t <= CONFIG.run.lateGameSeconds ? 'true' : 'false';

    const obj = game.objective;
    const total = game.partsTotal;
    const done = game.goalDone;
    // The bar's painted left cap is its empty state, so the fill starts there
    // rather than at zero width.
    const frac = done / Math.max(1, total);
    this.shipFill.style.width = `${6.2 + frac * 93.2}%`;

    // Three states on both pills: not found, carried, fitted.
    //
    // The two pills hide an unused slot differently, because their rings come
    // from different places. The beige pill's rings are painted into its
    // artwork, so hiding the slot hides only the icon sitting on top of one.
    // The blue pill draws its own rings, so hiding a slot would take the ring
    // with it — collapsing the pill and leaving dead space at its foot. There
    // the ring stays and only the icon is dropped.
    const partState = new Map(game.checklist.map((i) => [i.id, i.state]));
    for (const slot of this.pillSlots) {
      const state = partState.get(slot.dataset.part);
      slot.hidden = !state;
      if (state) slot.dataset.state = state;
    }
    for (const slot of this.uwSlots) {
      slot.dataset.state = partState.get(slot.dataset.part) ?? 'empty';
    }

    if (game.mode === 'dive') {
      this.boost.dataset.state = s.boosting ? 'active' : s.boostReady ? 'ready' : 'cooling';
      this.vignette.dataset.on = s.sharkThreat ? 'true' : 'false';
      this._paintOxygen(game, s);

      let hint = '';
      if (s.drillRock) {
        hint = `${s.holdKind === 'anchor' ? 'Planting' : 'Drilling'} ${Math.round(s.drillProgress * 100)}%`;
      } else if (s.breathing) hint = 'Breathing — tank refilling';
      else if (s.sonar && s.sonar.mode === 'part' && s.sonar.dist < 5) {
        hint = { salvage: 'A part is close', beacon: 'Anchor close', haul: 'Crate close' }[game.objective];
      }
      this.hint.textContent = hint;
      this.hint.dataset.on = hint ? 'true' : 'false';
    } else {
      this.vignette.dataset.on = 'false';
      this.hint.dataset.on = 'false';
      this.o2.dataset.on = 'false';

      const action = game.boatAction;
      this.repairFill.style.setProperty('--fill', `${s.repairProgress * 100}%`);
      this.btnRepair.disabled = !action.enabled;
      this.repairLabel.textContent = action.label;

      const carried = s.carrying.length;
      if (obj === 'beacon') {
        const left = total - s.planted;
        this.boatStatus.innerHTML = done >= total
          ? '📡 Survey complete.'
          : carried
            ? `📡 Carrying <b>${carried}</b> beacon${carried === 1 ? '' : 's'} — ${left} anchor${left === 1 ? '' : 's'} left`
            : `📡 Hold Load to take beacons aboard — ${left} anchor${left === 1 ? '' : 's'} left`;
      } else if (obj === 'haul') {
        this.boatStatus.innerHTML = done >= total
          ? '📦 All cargo delivered.'
          : carried
            ? '📦 Crate on deck — hold Unload to secure it'
            : `📦 Dive for the next crate — <b>${total - done}</b> left`;
      } else {
        this.boatStatus.innerHTML = carried
          ? `Carrying <b>${carried}</b> part${carried === 1 ? '' : 's'} — hold Repair to fit ${carried === 1 ? 'it' : 'them'}`
          : done >= total ? 'The boat is whole.'
          : 'Nothing aboard. Dive for the next part.';
      }
    }
  }

  // The badge rides alongside the diver, so it is pinned to wherever the diver
  // projects on screen this frame. Off-screen it simply hides.
  _paintOxygen(game, s) {
    const p = s.screen;
    if (!p || p.behind) { this.o2.dataset.on = 'false'; return; }
    this.o2.dataset.on = 'true';
    this.o2.style.left = `${p.x * 100}%`;
    this.o2.style.top = `${p.y * 100}%`;
    const pct = Math.max(0, Math.min(1, s.oxygen / CONFIG.oxygen.max));
    this.o2Fill.style.transform = `scaleX(${Math.max(0.001, pct)})`;
    this.o2Fill.style.filter = pct < CONFIG.oxygen.redBelow
      ? 'hue-rotate(-58deg) saturate(1.5)'
      : pct < CONFIG.oxygen.amberBelow ? 'hue-rotate(-28deg) saturate(1.3)' : '';
  }
}
