// Sonar plot. Draws the seabed you have actually lit up, plus live shark
// contacts. It is deliberately *not* a map of where the parts are — the chevron
// above the tank already gives a bearing, and revealing the answers would remove
// the search. What it gives you is memory (where have I already been) and
// situational awareness (what is circling behind me).
import { CONFIG } from './config.js';

const W = CONFIG.world;
const COLS = Math.round(W.halfWidth * 2);
const ROWS = Math.round(Math.abs(W.seabedY - W.surfaceY));

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.explored = new Uint8Array(COLS * ROWS);
    this._sized = false;
  }

  reset() {
    this.explored.fill(0);
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
    this._sized = true;
    return true;
  }

  // Mark everything within `radius` metres of (x, y) as seen.
  reveal(x, y, radius) {
    const cx = (x + W.halfWidth), cy = (W.surfaceY - y);
    const r = Math.ceil(radius);
    for (let gy = Math.floor(cy - r); gy <= cy + r; gy++) {
      if (gy < 0 || gy >= ROWS) continue;
      for (let gx = Math.floor(cx - r); gx <= cx + r; gx++) {
        if (gx < 0 || gx >= COLS) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        if (dx * dx + dy * dy <= radius * radius) this.explored[gy * COLS + gx] = 1;
      }
    }
  }

  isExplored(x, y) {
    const gx = Math.floor(x + W.halfWidth), gy = Math.floor(W.surfaceY - y);
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return false;
    return this.explored[gy * COLS + gx] === 1;
  }

  draw(game) {
    if (!this._size()) return;
    const s = game.state;
    if (!s) return;

    const { ctx } = this;
    const w = this.canvas.width, h = this.canvas.height;
    const sx = w / COLS, sy = h / ROWS;
    const toX = (x) => (x + W.halfWidth) * sx;
    const toY = (y) => (W.surfaceY - y) * sy;
    const dot = (x, y, r, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(toX(x), toY(y), r, 0, Math.PI * 2);
      ctx.fill();
    };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(4,20,28,0.82)';
    ctx.fillRect(0, 0, w, h);

    // explored ground
    ctx.fillStyle = 'rgba(53,214,196,0.14)';
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        if (this.explored[gy * COLS + gx]) ctx.fillRect(gx * sx, gy * sy, sx + 0.6, sy + 0.6);
      }
    }

    // waterline
    ctx.strokeStyle = 'rgba(127,212,217,0.55)';
    ctx.lineWidth = Math.max(1, sy * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, toY(W.surfaceY) + ctx.lineWidth);
    ctx.lineTo(w, toY(W.surfaceY) + ctx.lineWidth);
    ctx.stroke();

    // seabed
    ctx.fillStyle = 'rgba(127,212,217,0.18)';
    ctx.fillRect(0, h - Math.max(2, sy * 0.5), w, Math.max(2, sy * 0.5));

    // contacts you have already lit up
    const r = Math.max(1.6, sx * 0.3);
    for (const rock of s.level.rocks) {
      if (!this.isExplored(rock.x, rock.y)) continue;
      dot(rock.x, rock.y, r, rock.opened ? 'rgba(120,150,160,0.5)' : 'rgba(175,205,212,0.85)');
    }
    for (const item of s.level.pickups) {
      if (item.taken || !this.isExplored(item.x, item.y)) continue;
      dot(item.x, item.y, r, item.kind === 'tank' ? '#35d6c4' : item.kind === 'fins' ? '#5b8dff' : '#fff0b0');
    }
    for (const part of s.level.parts) {
      if (part.taken || !this.isExplored(part.x, part.y)) continue;
      dot(part.x, part.y, r * 1.35, '#ffb340');
    }

    // sharks are live contacts — always plotted, that is the point of the sonar
    for (const shark of s.level.sharks) {
      const px = toX(shark.x), py = toY(shark.y);
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath();
      ctx.moveTo(px + (shark.dir > 0 ? r * 1.9 : -r * 1.9), py);
      ctx.lineTo(px - (shark.dir > 0 ? r * 1.1 : -r * 1.1), py - r * 1.1);
      ctx.lineTo(px - (shark.dir > 0 ? r * 1.1 : -r * 1.1), py + r * 1.1);
      ctx.closePath();
      ctx.fill();
    }

    // boat
    const bx = toX(game.boat.position.x), by = toY(W.surfaceY);
    ctx.fillStyle = '#eaf6f5';
    ctx.fillRect(bx - r * 2.2, by - r * 1.4, r * 4.4, r * 2.2);

    // diver, with a ping ring so the eye finds it instantly
    if (game.mode === 'dive') {
      const dx = toX(game.diver.position.x), dy = toY(game.diver.position.y);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      ctx.strokeStyle = `rgba(53,214,196,${0.25 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(1, r * 0.5);
      ctx.beginPath();
      ctx.arc(dx, dy, r * (2.2 + pulse * 1.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx, dy, r * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
