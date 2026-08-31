// Sonar plot: a top-down slice of the dive site with fog of war, plus a depth
// gutter down the side showing where in the water column you are.
//
// It deliberately does NOT plot the parts you have not found — the chevron above
// the tank already gives a bearing, and revealing the answers would delete the
// search. What it gives is memory (where have I swept) and live threat contacts.
import { CONFIG } from './config.js';

const W = CONFIG.world;

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rebuild();
  }

  // The world can change size between levels, so the grid is rebuilt on demand.
  rebuild() {
    this.cols = Math.max(4, Math.round(W.halfWidth * 2));
    this.rows = Math.max(4, Math.round(W.halfDepth * 2));
    this.explored = new Uint8Array(this.cols * this.rows);
  }

  reset() {
    if (this.explored.length !== Math.round(W.halfWidth * 2) * Math.round(W.halfDepth * 2)) this.rebuild();
    else this.explored.fill(0);
  }

  _size() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(devicePixelRatio, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return true;
  }

  // Mark everything within `radius` metres of (x, z) as swept.
  reveal(x, z, radius) {
    const cx = x + W.halfWidth, cz = z + W.halfDepth;
    const r = Math.ceil(radius);
    for (let gz = Math.floor(cz - r); gz <= cz + r; gz++) {
      if (gz < 0 || gz >= this.rows) continue;
      for (let gx = Math.floor(cx - r); gx <= cx + r; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        const dx = gx + 0.5 - cx, dz = gz + 0.5 - cz;
        if (dx * dx + dz * dz <= radius * radius) this.explored[gz * this.cols + gx] = 1;
      }
    }
  }

  isExplored(x, z) {
    const gx = Math.floor(x + W.halfWidth), gz = Math.floor(z + W.halfDepth);
    if (gx < 0 || gx >= this.cols || gz < 0 || gz >= this.rows) return false;
    return this.explored[gz * this.cols + gx] === 1;
  }

  draw(game) {
    if (!this._size()) return;
    const s = game.state;
    if (!s) return;

    const { ctx } = this;
    const W_PX = this.canvas.width, H_PX = this.canvas.height;
    const gutter = Math.max(8, W_PX * 0.11);          // depth strip on the right
    const mapW = W_PX - gutter - 3;
    const sx = mapW / this.cols, sz = H_PX / this.rows;
    const toX = (x) => (x + W.halfWidth) * sx;
    const toZ = (z) => (z + W.halfDepth) * sz;
    const dot = (x, z, r, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2);
      ctx.fill();
    };

    ctx.clearRect(0, 0, W_PX, H_PX);
    ctx.fillStyle = 'rgba(4,20,28,0.86)';
    ctx.fillRect(0, 0, W_PX, H_PX);

    // swept ground
    ctx.fillStyle = 'rgba(53,214,196,0.15)';
    for (let gz = 0; gz < this.rows; gz++) {
      for (let gx = 0; gx < this.cols; gx++) {
        if (this.explored[gz * this.cols + gx]) ctx.fillRect(gx * sx, gz * sz, sx + 0.7, sz + 0.7);
      }
    }

    const r = Math.max(1.5, sx * 0.32);
    for (const rock of s.level.rocks) {
      if (!this.isExplored(rock.x, rock.z)) continue;
      dot(rock.x, rock.z, r, rock.opened ? 'rgba(120,150,160,0.45)' : 'rgba(175,205,212,0.8)');
    }
    for (const item of s.level.pickups) {
      if (item.taken || !this.isExplored(item.x, item.z)) continue;
      dot(item.x, item.z, r, item.kind === 'tank' ? '#35d6c4' : item.kind === 'fins' ? '#5b8dff' : '#fff0b0');
    }
    for (const part of s.level.parts) {
      if (part.taken || !this.isExplored(part.x, part.z)) continue;
      dot(part.x, part.z, r * 1.4, '#ffb340');
    }

    // live threat contacts — plotted whether or not you have swept there
    for (const e of s.level.sharks) {
      const px = toX(e.x), pz = toZ(e.z);
      const a = Math.atan2(e.vz ?? 0, e.vx ?? 1);
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * r * 2.1, pz + Math.sin(a) * r * 2.1);
      ctx.lineTo(px + Math.cos(a + 2.5) * r * 1.5, pz + Math.sin(a + 2.5) * r * 1.5);
      ctx.lineTo(px + Math.cos(a - 2.5) * r * 1.5, pz + Math.sin(a - 2.5) * r * 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // boat
    ctx.fillStyle = '#eaf6f5';
    ctx.fillRect(toX(game.boat.position.x) - r * 2.2, toZ(game.boat.position.z) - r * 1.3, r * 4.4, r * 2.6);

    // diver, with a ping ring and a heading tick
    if (game.mode === 'dive') {
      const dx = toX(game.diver.position.x), dz = toZ(game.diver.position.z);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      ctx.strokeStyle = `rgba(53,214,196,${0.25 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(1, r * 0.5);
      ctx.beginPath();
      ctx.arc(dx, dz, r * (2.2 + pulse * 1.4), 0, Math.PI * 2);
      ctx.stroke();
      // facing: yaw 0 looks down -Z, which is up on this plot
      const hx = Math.sin(s.yaw + Math.PI), hz = -Math.cos(s.yaw + Math.PI);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(dx, dz);
      ctx.lineTo(dx + hx * r * 3.4, dz + hz * r * 3.4);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx, dz, r * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- depth gutter ---
    const gx0 = W_PX - gutter;
    ctx.fillStyle = 'rgba(8,30,40,0.9)';
    ctx.fillRect(gx0, 0, gutter, H_PX);
    const depthOf = (y) => ((W.surfaceY - y) / Math.abs(W.seabedY)) * H_PX;
    ctx.fillStyle = 'rgba(127,212,217,0.35)';
    ctx.fillRect(gx0, 0, gutter, Math.max(1.5, H_PX * 0.012));                 // surface
    ctx.fillRect(gx0, H_PX - Math.max(1.5, H_PX * 0.02), gutter, Math.max(1.5, H_PX * 0.02));  // bed
    if (game.mode === 'dive') {
      const dy = depthOf(game.diver.position.y);
      ctx.fillStyle = '#35d6c4';
      ctx.fillRect(gx0, dy - 1.5, gutter, 3);
    }
    for (const e of s.level.sharks) {
      ctx.fillStyle = 'rgba(255,77,94,0.75)';
      ctx.fillRect(gx0 + gutter * 0.3, depthOf(e.y) - 1, gutter * 0.4, 2);
    }
  }
}
