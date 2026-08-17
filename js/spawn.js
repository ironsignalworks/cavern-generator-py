import {
  BGM_FADE_IN, LEVELS, ENEMY_COOLDOWN,
  AMMO_START, AMMO_MAX, clamp, rand, manhattan,
} from './config.js';
import { pickCaveMap } from './map.js';
import { Entity } from './entity.js';

export const spawnMethods = {
  resetLevel({ carryAmmo = false } = {}) {
    this.hideRestartGate();
    if (window.KomAudio) { try { window.KomAudio.hardStopAll({ immediate: true }); } catch (e) { } }
    const spec = LEVELS[this.levelIndex];
    this.levelTicks = 0;
    this.rainSeed = Math.random() * 1000;
    this.staticSeed = Math.random() * 1000;
    try { window.KomAudio.startBackground?.({ gain: 0.62, fadeIn: BGM_FADE_IN }); } catch { }

    this.map = pickCaveMap(this.mapBank, spec.key);

    let px = 1, py = 1; do { px = 2 + rand(this.map.w - 4); py = 2 + rand(this.map.h - 4); } while (this.map.isWall(px, py));
    this.player = new Entity(px, py, 'jack');
    this.entities = [this.player];

    for (let i = 0; i < spec.enemies; i++) {
      let ex = 1, ey = 1, spawnTries = 0;
      do { ex = rand(this.map.w); ey = rand(this.map.h); spawnTries++; }
      while ((this.map.isWall(ex, ey) || manhattan(ex, ey, px, py) < 12) && spawnTries < 2000);
      const e = new Entity(ex, ey, 'enemy'); this.pickNewPatrol(e);
      if (spec.key === 'psychosis' && Math.random() < 0.35) { e.fast = true; }
      this.entities.push(e);
    }

    this.diamonds = new Set();
    const totalCells = this.map.w * this.map.h;
    let d = 0, diamondAttempts = 0;
    const diamondTarget = spec.diamonds || 0;
    while (d < diamondTarget && diamondAttempts < totalCells * 4) {
      diamondAttempts++;
      const dx = rand(this.map.w), dy = rand(this.map.h);
      if (this.map.isWall(dx, dy)) continue;
      const idx = dy * this.map.w + dx;
      if (idx === py * this.map.w + px) continue;
      if (this.diamonds.has(idx)) continue;
      this.diamonds.add(idx); d++;
    }

    let ex = px, ey = py, tries = 0;
    do {
      ex = 2 + rand(this.map.w - 4); ey = 2 + rand(this.map.h - 4); tries++;
    } while ((Math.abs(ex - px) + Math.abs(ey - py) < 24 || this.map.isWall(ex, ey)) && tries < 2000);
    this.exit = ey * this.map.w + ex;

    if (this.diamonds.size === 0 && diamondTarget > 0) {
      const fallback = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [0, 3], [-3, 0], [0, -3], [4, 0], [0, 4]];
      for (const [fx, fy] of fallback) {
        const nx = clamp(px + fx, 1, this.map.w - 2);
        const ny = clamp(py + fy, 1, this.map.h - 2);
        const idx = ny * this.map.w + nx;
        if (this.map.isWall(nx, ny) || idx === this.exit) continue;
        this.diamonds.add(idx);
        break;
      }
      if (this.diamonds.size === 0) {
        const spawnIdx = py * this.map.w + px;
        if (spawnIdx !== this.exit) this.diamonds.add(spawnIdx);
      }
    }
    this.diamondGoal = this.diamonds.size;
    this.exitUnlocked = false;
    this._sanityBannerShown = false;
    this._exitBannerShown = false;
    Object.values(this._warnPulse).forEach(clearTimeout);
    this._warnPulse = {};
    this.setWarn('warnSanity', false);
    this.setWarn('warnExit', false);
    clearTimeout(this._toastTimer);
    const toastEl = document.getElementById('toast');
    if (toastEl) {
      toastEl.classList.add('hidden');
      toastEl.classList.remove('toast--in');
    }

    this.bullets = []; this.seen = new Set(); this.sanity = 100; this.lastDir = [1, 0];
    this.ammo = carryAmmo ? clamp(this.ammo ?? AMMO_START, 0, AMMO_MAX) : AMMO_START;
    this.sanityWarned = false;

    this.mines = new Set();
    const wantedMines = spec.mines || 0;
    let placed = 0, mineAttempts = 0, maxMineAttempts = totalCells * 4;
    while (placed < wantedMines && mineAttempts < maxMineAttempts) {
      mineAttempts++;
      const mx = 2 + rand(this.map.w - 4), my = 2 + rand(this.map.h - 4);
      const midx = my * this.map.w + mx;
      if (this.map.isWall(mx, my)) continue;
      if (midx === this.exit) continue;
      if (this.diamonds.has(midx)) continue;
      if (mx === px && my === py) continue;
      if (this.entities.some(e => e.x === mx && e.y === my)) continue;
      if (this.mines.has(midx)) continue;
      this.mines.add(midx);
      placed++;
    }
    this.mineGoal = placed;

    this.seeds = new Set();
    const wantSeeds = spec.heals || 0;
    let sPlaced = 0, sTry = 0, sMax = totalCells * 3;
    while (sPlaced < wantSeeds && sTry < sMax) {
      sTry++;
      const sx = 2 + rand(this.map.w - 4), sy = 2 + rand(this.map.h - 4);
      const si = sy * this.map.w + sx;
      if (this.map.isWall(sx, sy)) continue;
      if (si === this.exit) continue;
      if (this.diamonds.has(si) || this.mines.has(si)) continue;
      if (sx === px && sy === py) continue;
      if (this.entities.some(e => e.x === sx && e.y === sy)) continue;
      if (this.seeds.has(si)) continue;
      this.seeds.add(si);
      sPlaced++;
    }

    this.ammoPacks = new Set();
    const wantAmmo = spec.ammo || 0;
    let aPlaced = 0, aTry = 0, aMax = totalCells * 3;
    while (aPlaced < wantAmmo && aTry < aMax) {
      aTry++;
      const ax = 2 + rand(this.map.w - 4), ay = 2 + rand(this.map.h - 4);
      const ai = ay * this.map.w + ax;
      if (this.map.isWall(ax, ay)) continue;
      if (ai === this.exit) continue;
      if (this.diamonds.has(ai) || this.mines.has(ai) || this.seeds.has(ai)) continue;
      if (ax === px && ay === py) continue;
      if (this.entities.some(e => e.x === ax && e.y === ay)) continue;
      if (this.ammoPacks.has(ai)) continue;
      this.ammoPacks.add(ai);
      aPlaced++;
    }

    this.decor = new globalThis.Map();
    const placeDecor = (count, sprite) => {
      let placed = 0, attempts = 0, maxAttempts = totalCells * 3;
      while (placed < count && attempts < maxAttempts) {
        attempts++;
        const x = 2 + rand(this.map.w - 4), y = 2 + rand(this.map.h - 4);
        const i = y * this.map.w + x;
        if (this.map.isWall(x, y) || i === this.exit || this.diamonds.has(i) ||
          this.mines.has(i) || this.seeds.has(i) || this.ammoPacks.has(i) ||
          (x === this.player.x && y === this.player.y) ||
          this.entities.some(e => e.x === x && e.y === y) || this.decor.has(i)) continue;
        this.decor.set(i, sprite); placed++;
      }
    };
    const levelKey = spec.key;
    if (levelKey === 'reality' || levelKey === 'jungle' || levelKey === 'paranoia') {
      placeDecor(16, 'palm');
    }

    if (spec.key === 'paranoia') {
      this.phantoms = [];
      const phCount = 10;
      let triesP = 0;
      while (this.phantoms.length < phCount && triesP < totalCells) {
        triesP++;
        const x = rand(this.map.w), y = rand(this.map.h);
        if (this.map.isWall(x, y)) continue;
        if (manhattan(x, y, px, py) < 10) continue;
        if (this.entities.some(e => e.x === x && e.y === y)) continue;
        if (this.diamonds.has(y * this.map.w + x)) continue;
        this.phantoms.push({ x, y, phase: Math.random() * Math.PI * 2 });
      }
    } else {
      this.phantoms = [];
    }

    this.enemyInterval = (spec.key === 'jungle') ? Math.max(80, ENEMY_COOLDOWN * 0.75) : ENEMY_COOLDOWN;
    this.gunfireT = 0;
    this.controlInvertT = 0;
    this.trail = [];
    this.collapseTimer = (spec.key === 'collapse') ? 900 : 0;
    this.extractionCountdown = null;
    this.sanityMul = (spec.key === 'collapse') ? 1.35 : 1.0;

    document.getElementById('levelName').textContent = spec.name;
    document.getElementById('levelName').title = spec.name;

    if (window.KomAudio) { window.KomAudio.playDeployment(); }
    this._pauseReasons.clear();
    this.hidePauseGate();
    this.state = 'play'; this.melt = null;
    this.updateHUD();

    if (document.hidden) this.pause('hidden');

    if (this.levelIndex === 0) {
      this.toast('COLLECT THE FRAGMENT\nREACH THE EXIT', 2000);
    }
  },

  pickNewPatrol(e) {
    let tx, ty; do { tx = rand(this.map.w); ty = rand(this.map.h); } while (this.map.isWall(tx, ty));
    e.tx = tx; e.ty = ty;
  },
};
