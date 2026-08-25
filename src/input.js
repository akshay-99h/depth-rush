// Touch/mouse input. Two gestures only: tap-to-swim, hold-to-drill.
// BOOST is a separate DOM button so it never competes with the swim tap.

export class Input {
  constructor(canvas, boostButton) {
    this.pointerDown = false;
    this.holdSeconds = 0;
    this.screen = { x: 0, y: 0 };     // last pointer position, CSS pixels
    this.tapped = false;              // consumed once per frame
    this.boostHeld = false;

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      this.screen.x = e.clientX - r.left;
      this.screen.y = e.clientY - r.top;
    };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pos(e);
      this.pointerDown = true;
      this.holdSeconds = 0;
      this.tapped = true;
    });
    canvas.addEventListener('pointermove', (e) => { if (this.pointerDown) pos(e); });
    const release = () => { this.pointerDown = false; this.holdSeconds = 0; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const boostOn = (e) => { e.preventDefault(); this.boostHeld = true; };
    const boostOff = (e) => { e.preventDefault(); this.boostHeld = false; };
    boostButton.addEventListener('pointerdown', boostOn);
    boostButton.addEventListener('pointerup', boostOff);
    boostButton.addEventListener('pointercancel', boostOff);
    boostButton.addEventListener('pointerleave', boostOff);

    // Desktop convenience for playtesting — space boosts.
    addEventListener('keydown', (e) => { if (e.code === 'Space') this.boostHeld = true; });
    addEventListener('keyup', (e) => { if (e.code === 'Space') this.boostHeld = false; });
  }

  update(dt) {
    if (this.pointerDown) this.holdSeconds += dt;
  }

  consumeTap() {
    const t = this.tapped;
    this.tapped = false;
    return t;
  }
}
