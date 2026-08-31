// Tilt-to-swim. On a phone the two sticks plus boost is a lot of thumb, so the
// device's own orientation can drive movement instead, leaving one thumb for
// looking and one for boost.
//
// It reports the same shape as a Stick (x, y, magnitude), so the sim can take
// either source without caring which.
const MAX_ANGLE = 22;     // degrees of tilt for full deflection
const DEADZONE = 3;       // degrees of slack, so resting hands do not creep

export class Tilt {
  constructor() {
    this.available = typeof DeviceOrientationEvent !== 'undefined';
    // iOS 13+ will not deliver readings until the user grants them, and the
    // request has to come from inside a real gesture.
    this.needsPermission = this.available
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    this.enabled = false;
    this.active = false;          // enabled AND actually receiving readings
    this.x = 0;
    this.y = 0;
    this.magnitude = 0;
    this.denied = false;
    this._neutral = null;
    this._last = null;
    this._handler = (e) => this._onReading(e);
  }

  async enable() {
    if (!this.available) return false;
    if (this.needsPermission) {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') { this.denied = true; return false; }
      } catch {
        this.denied = true;
        return false;
      }
    }
    addEventListener('deviceorientation', this._handler);
    this.enabled = true;
    this._neutral = null;         // recalibrate on the next reading
    return true;
  }

  disable() {
    removeEventListener('deviceorientation', this._handler);
    this.enabled = false;
    this.active = false;
    this.x = this.y = this.magnitude = 0;
  }

  // Take however the player is holding the phone right now as "centred".
  calibrate() {
    this._neutral = this._last ? { beta: this._last.beta, gamma: this._last.gamma } : null;
    this.x = this.y = this.magnitude = 0;
  }

  _onReading(e) {
    if (e.beta == null || e.gamma == null) return;
    this._last = { beta: e.beta, gamma: e.gamma };
    if (!this._neutral) this._neutral = { beta: e.beta, gamma: e.gamma };
    this.active = true;

    const ramp = (deg) => {
      const s = Math.sign(deg);
      const a = Math.max(0, Math.abs(deg) - DEADZONE);
      return s * Math.min(1, a / (MAX_ANGLE - DEADZONE));
    };
    // Tipping the top of the phone away from you swims forward; rolling it
    // right strafes right.
    this.y = ramp(this._neutral.beta - e.beta);
    this.x = ramp(e.gamma - this._neutral.gamma);
    const m = Math.hypot(this.x, this.y);
    if (m > 1) { this.x /= m; this.y /= m; }
    this.magnitude = Math.min(1, m);
  }

  reset() { this.x = this.y = this.magnitude = 0; }
}
