// Two virtual sticks: the left one swims, the right one (the eye) turns the head.
// Nothing else in the game reads raw pointer events.

export class Stick {
  constructor(base, knob) {
    this.base = base;
    this.knob = knob;
    this.x = 0;              // -1..1, right positive
    this.y = 0;              // -1..1, up positive
    this.magnitude = 0;
    this.active = false;
    this._pointerId = null;

    const set = (e) => {
      const r = base.getBoundingClientRect();
      const radius = r.width * 0.38;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, radius);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      this.magnitude = clamped / radius;
      this.x = nx * this.magnitude;
      this.y = -ny * this.magnitude;      // screen-down is world-down
      knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    };

    const release = (e) => {
      if (e && this._pointerId !== null && e.pointerId !== this._pointerId) return;
      this.active = false;
      this._pointerId = null;
      this.x = this.y = this.magnitude = 0;
      knob.style.transform = '';
    };

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._pointerId = e.pointerId;
      this.active = true;
      base.setPointerCapture?.(e.pointerId);
      set(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (this.active && e.pointerId === this._pointerId) { e.preventDefault(); set(e); }
    });
    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);
    base.addEventListener('lostpointercapture', release);
  }

  // Set from outside (keyboard, tests) without touching the knob transform.
  setVector(x, y, magnitude = Math.min(1, Math.hypot(x, y))) {
    if (this.active) return;
    this.x = x; this.y = y; this.magnitude = magnitude;
  }

  reset() {
    this.x = this.y = this.magnitude = 0;
    this.active = false;
    this.knob.style.transform = '';
  }
}

// A press-and-hold button that reports its state through a callback.
export function bindHold(el, onChange) {
  const on = (e) => { e.preventDefault(); onChange(true); };
  const off = (e) => { e.preventDefault(); onChange(false); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}

// Desktop playtesting: WASD swims, arrows look, shift/space boosts.
export function bindKeyboard(move, look, setBoost) {
  const keys = new Set();
  const sync = () => {
    const mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const my = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const ml = Math.hypot(mx, my) || 1;
    move.setVector(mx / ml, my / ml, (mx || my) ? 1 : 0);

    const lx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    const ly = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
    const ll = Math.hypot(lx, ly) || 1;
    look.setVector(lx / ll, ly / ll, (lx || ly) ? 1 : 0);

    setBoost(keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Space'));
  };
  addEventListener('keydown', (e) => { keys.add(e.code); sync(); });
  addEventListener('keyup', (e) => { keys.delete(e.code); sync(); });
}
