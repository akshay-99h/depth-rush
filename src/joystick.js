// Virtual joystick + boost, per the lofi's bottom-left thumb circle.
// The stick reports a normalised vector; nothing else in the game reads raw pointers.

export class Joystick {
  constructor(base, knob, boostButton) {
    this.base = base;
    this.knob = knob;
    this.x = 0;              // -1..1, right positive
    this.y = 0;              // -1..1, up positive
    this.magnitude = 0;      // 0..1
    this.active = false;
    this.boostHeld = false;
    this._pointerId = null;
    this._radius = 44;

    const set = (e) => {
      const r = base.getBoundingClientRect();
      this._radius = r.width * 0.38;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, this._radius);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      this.magnitude = clamped / this._radius;
      this.x = nx * this.magnitude;
      this.y = -ny * this.magnitude;      // screen-down is world-down
      knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    };

    const release = () => {
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

    const on = (e) => { e.preventDefault(); this.boostHeld = true; };
    const off = (e) => { e.preventDefault(); this.boostHeld = false; };
    boostButton.addEventListener('pointerdown', on);
    boostButton.addEventListener('pointerup', off);
    boostButton.addEventListener('pointercancel', off);
    boostButton.addEventListener('pointerleave', off);

    // Desktop playtesting: WASD/arrows steer, shift boosts.
    this._keys = new Set();
    addEventListener('keydown', (e) => { this._keys.add(e.code); this._syncKeys(); });
    addEventListener('keyup', (e) => { this._keys.delete(e.code); this._syncKeys(); });
  }

  _syncKeys() {
    if (this.active) return;
    const k = this._keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const len = Math.hypot(x, y) || 1;
    this.x = x / len; this.y = y / len;
    this.magnitude = (x || y) ? 1 : 0;
    this.boostHeld = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space');
  }

  reset() {
    this.x = this.y = this.magnitude = 0;
    this.active = false;
    this.boostHeld = false;
    this.knob.style.transform = '';
  }
}
