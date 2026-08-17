import { LAYOUTS, currentLayout, rand } from './config.js';

/** Recursive shadowcasting. Walls occlude; radius is in tiles. */
export function computeFOV(map, ox, oy, radius = 12) {
  const vis = new Set();
  vis.add(oy * map.w + ox);

  function castRow(row, start, end, xx, xy, yx, yy) {
    if (start < end) return;
    let r = row;
    while (r <= radius) {
      let dx = -r - 1;
      let dy = -r;
      let blocked = false;
      while (dx <= 0) {
        dx++;
        const X = ox + dx * xx + dy * xy;
        const Y = oy + dx * yx + dy * yy;
        const ldx = -dx;
        const ldy = dy;
        const lSlope = (ldx - 0.5) / (ldy + 0.5);
        const rSlope = (ldx + 0.5) / (ldy - 0.5);
        if (!(X >= 0 && Y >= 0 && X < map.w && Y < map.h) || start < rSlope) continue;
        if (end > lSlope) break;
        const i = Y * map.w + X;
        if ((dx * dx + dy * dy) <= radius * radius) vis.add(i);
        if (map.isWall(X, Y)) {
          if (!blocked) {
            blocked = true;
            start = rSlope;
            castRow(r + 1, start, end, xx, xy, yx, yy);
          } else {
            end = lSlope;
          }
        } else if (blocked) {
          blocked = false;
          start = rSlope;
        }
      }
      r++;
    }
  }

  castRow(1, 1.0, 0.0, 1, 0, 0, 1);
  castRow(1, 1.0, 0.0, 1, 0, 0, -1);
  castRow(1, 1.0, 0.0, -1, 0, 0, 1);
  castRow(1, 1.0, 0.0, -1, 0, 0, -1);
  castRow(1, 1.0, 0.0, 0, 1, 1, 0);
  castRow(1, 1.0, 0.0, 0, 1, -1, 0);
  castRow(1, 1.0, 0.0, 0, -1, 1, 0);
  castRow(1, 1.0, 0.0, 0, -1, -1, 0);

  if (radius > 0 && vis.size === 1) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = ox + dx;
      const ny = oy + dy;
      if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && !map.isWall(nx, ny)) {
        vis.add(ny * map.w + nx);
      }
    }
  }
  return vis;
}

/** Packed 0/1 grid from Python. Generation does not run in the browser. */
export class CaveMap {
  constructor(w, h) {
    const W = Math.max(5, Number.isFinite(w) ? Math.floor(w) : 0);
    const H = Math.max(5, Number.isFinite(h) ? Math.floor(h) : 0);
    this.w = W;
    this.h = H;
    this.cells = new Array(W * H).fill(1);
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  isWall(x, y) { return this.cells[this.idx(x, y)] === 1; }
  carve(x, y) { this.cells[this.idx(x, y)] = 0; }
  carveRect(x0, y0, x1, y1) {
    const xA = Math.max(1, Math.min(x0, x1));
    const xB = Math.min(this.w - 2, Math.max(x0, x1));
    const yA = Math.max(1, Math.min(y0, y1));
    const yB = Math.min(this.h - 2, Math.max(y0, y1));
    for (let y = yA; y <= yB; y++) {
      for (let x = xA; x <= xB; x++) this.carve(x, y);
    }
  }

  static fromPacked(w, h, packed) {
    const map = new CaveMap(w, h);
    const n = Math.min(map.cells.length, packed.length);
    for (let i = 0; i < n; i++) map.cells[i] = packed[i] === '1' ? 1 : 0;
    return map;
  }

  static fallback(w, h) {
    const map = new CaveMap(w, h);
    map.carveRect(2, 2, w - 3, h - 3);
    return map;
  }
}

export async function loadMapBank() {
  const res = await fetch('./data/maps.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`maps.json HTTP ${res.status}`);
  return res.json();
}

export function pickCaveMap(bank, levelKey) {
  const layout = currentLayout();
  const pool = bank?.levels?.[levelKey]?.[layout];
  if (pool && pool.length) {
    const pick = pool[rand(pool.length)];
    return CaveMap.fromPacked(pick.w, pick.h, pick.cells);
  }
  const size = LAYOUTS[layout] || LAYOUTS.landscape;
  return CaveMap.fallback(size.w, size.h);
}
