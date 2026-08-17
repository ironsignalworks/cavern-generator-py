import {
  BULLET_COOLDOWN, BULLET_SPEED, LEVELS, PALETTES,
  AMMO_MAX, AMMO_PICKUP, GHOST_DAMAGE,
  clamp, rand, manhattan, log,
} from './config.js';
import { Entity } from './entity.js';

export const combatMethods = {
  canStep(x, y) { return this.map.inb(x, y) && !this.map.isWall(x, y); },
  stepEntity(ent, dx, dy) { const nx = ent.x + dx, ny = ent.y + dy; if (this.canStep(nx, ny)) { ent.x = nx; ent.y = ny; return true; } return false; },

  tryMovePlayer() {
    let dx = 0, dy = 0;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy = -1; else if (this.keys.has('arrowdown') || this.keys.has('s')) dy = 1;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx = -1; else if (this.keys.has('arrowright') || this.keys.has('d')) dx = 1;

    if (!dx && !dy && this._tapTile) {
      const ddx = this._tapTile.tx - this.player.x;
      const ddy = this._tapTile.ty - this.player.y;
      if (Math.abs(ddx) >= Math.abs(ddy) && ddx !== 0) dx = Math.sign(ddx);
      else if (ddy !== 0) dy = Math.sign(ddy);
      if (ddx === 0 && ddy === 0) this._tapTile = null;
    }

    if (this.controlInvertT > 0) { dx = -dx; dy = -dy; }

    if (dx || dy) {
      this.lastDir = [dx, dy];
      if (this.stepEntity(this.player, dx, dy)) {
        const idx = this.player.y * this.map.w + this.player.x;
        this.trail.push(idx);
        if (this.trail.length > 140) this.trail.shift();
        this.collectAtPlayer();
        this.checkMine();
      }
    }
  },

  setFireHeld(down) {
    if (down) {
      this.keys.add(' ');
      if (this.state === 'play') this.tryShoot();
    } else {
      this.keys.delete(' ');
    }
  },

  tryShoot() {
    const now = performance.now();
    if (now - this.lastShot < BULLET_COOLDOWN) return;
    this.shoot();
    this.lastShot = now;
  },

  shoot() {
    if (this.state !== 'play') return;
    if (this.ammo <= 0) {
      if (performance.now() - this._ammoToastAt > 2000) {
        this._ammoToastAt = performance.now();
        this.toast('OUT OF AMMO', 800, true);
      }
      return;
    }
    this.ammo--;
    let [dx, dy] = this.lastDir;
    if (!dx && !dy) { dx = 1; dy = 0; }
    this.bullets.push({ x: this.player.x + dx * 0.35, y: this.player.y + dy * 0.35, dx, dy, life: 140 });
    if (window.KomAudio) { window.KomAudio.playShoot(); }
  },

  updateBullets(dt) {
    const speed = BULLET_SPEED * (dt / 16);
    this.bullets = this.bullets.filter(b => {
      b.x += b.dx * speed; b.y += b.dy * speed; b.life--;
      const ix = Math.round(b.x), iy = Math.round(b.y);
      if (!this.map.inb(ix, iy) || this.map.isWall(ix, iy) || b.life <= 0) return false;
      const hit = this.entities.find(e => e.type === 'enemy' && e.x === ix && e.y === iy);
      if (hit) { hit.hp = 0; this.entities = this.entities.filter(e => e !== hit); this.flashT = 12; return false; }
      const midx = iy * this.map.w + ix;
      if (this.mines.has(midx)) { this.mines.delete(midx); this.flashColor = this.currentFlashColor(); this.flashT = 10; this.glitchT = Math.max(this.glitchT, 8); return false; }
      return true;
    });
  },

  updateEnemies() {
    const spec = LEVELS[this.levelIndex];
    const playerIdx = this.player.y * this.map.w + this.player.x;
    const canopySafe = this.decor && this.decor.has(playerIdx);

    for (const e of this.entities) {
      if (e.type !== 'enemy') continue;

      if (spec.key === 'paranoia') {
        const dist = manhattan(e.x, e.y, this.player.x, this.player.y);
        const aligned = (e.x === this.player.x || e.y === this.player.y);
        let clear = false;
        if (aligned) {
          clear = true;
          if (e.x === this.player.x) {
            const step = Math.sign(this.player.y - e.y);
            for (let y = e.y + step; y !== this.player.y; y += step) { if (this.map.isWall(e.x, y)) { clear = false; break; } }
          } else {
            const step = Math.sign(this.player.x - e.x);
            for (let x = e.x + step; x !== this.player.x; x += step) { if (this.map.isWall(x, e.y)) { clear = false; break; } }
          }
        }
        if (dist <= 10 || (aligned && clear)) {
          e.tx = this.player.x; e.ty = this.player.y;
        } else if (e.x === e.tx && e.y === e.ty) {
          this.pickNewPatrol(e);
        }
      } else {
        if (e.x === e.tx && e.y === e.ty) this.pickNewPatrol(e);
      }

      const stepOnce = () => {
        const dx = Math.sign(e.tx - e.x), dy = Math.sign(e.ty - e.y);
        let moved = false;
        if (Math.random() < 0.5) { moved = (dx !== 0 && this.stepEntity(e, dx, 0)); if (!moved && dy !== 0) moved = this.stepEntity(e, 0, dy); }
        else { moved = (dy !== 0 && this.stepEntity(e, 0, dy)); if (!moved && dx !== 0) moved = this.stepEntity(e, dx, 0); }
        if (!moved) {
          if (!this.stepEntity(e, (Math.random() < 0.5 ? 1 : -1), 0)) this.stepEntity(e, 0, (Math.random() < 0.5 ? 1 : -1));
          if (Math.random() < 0.3) this.pickNewPatrol(e);
        }
      };

      stepOnce();
      if (spec.key === 'psychosis' && e.fast) stepOnce();

      if (e.x === this.player.x && e.y === this.player.y && !canopySafe) { this.onPlayerHit(); }
    }

    if (spec.key === 'jungle' && Math.random() < 0.05 && this.entities.filter(e => e.type === 'enemy').length < spec.enemies + 4) {
      let ex = 1, ey = 1; let tries = 0;
      do { ex = rand(this.map.w); ey = rand(this.map.h); tries++; }
      while ((!this.canStep(ex, ey) || (Math.abs(ex - this.player.x) + Math.abs(ey - this.player.y) < 18)) && tries < 1500);
      const e = new Entity(ex, ey, 'enemy'); this.pickNewPatrol(e); this.entities.push(e);
    }
  },

  onPlayerHit() { log('CAUGHT: GAME OVER'); this.startMelt(); },

  updatePhantoms() {
    if (!this.phantoms || !this.phantoms.length) return;
    const now = performance.now();
    for (const ph of this.phantoms) {
      const on = (Math.sin((now / 180) + ph.phase) > -0.2);
      if (on && Math.random() < 0.18) {
        const dx = Math.sign(this.player.x - ph.x);
        const dy = Math.sign(this.player.y - ph.y);
        if (Math.random() < 0.5) {
          if (dx && this.canStep(ph.x + dx, ph.y)) ph.x += dx;
          else if (dy && this.canStep(ph.x, ph.y + dy)) ph.y += dy;
        } else {
          if (dy && this.canStep(ph.x, ph.y + dy)) ph.y += dy;
          else if (dx && this.canStep(ph.x + dx, ph.y)) ph.x += dx;
        }
      }
      const dist = manhattan(ph.x, ph.y, this.player.x, this.player.y);
      if (on && dist <= 1) this.hitByGhost();
    }
  },

  hitByGhost() {
    const now = performance.now();
    if (now - this._ghostHitAt < 420) return;
    this._ghostHitAt = now;
    this.sanity = clamp(this.sanity - GHOST_DAMAGE, 0, 100);
    this.flashT = 12;
    this.flashColor = '#ff5577';
    this.glitchT = Math.max(this.glitchT, 10);
    this.toast('GHOST CONTACT', 700, true);
    if (this.sanity <= 0) { log('Ghost drain: sanity collapse'); this.startMelt(); }
  },

  collectAtPlayer() {
    const idx = this.player.y * this.map.w + this.player.x;

    if (this.diamonds.has(idx)) {
      this.diamonds.delete(idx);
      this.sanity = clamp(this.sanity + 5, 0, 100);
      this.flashT = 12; this.flashColor = '#ffd400'; this.glitchT = Math.max(this.glitchT, 24);
      if (window.KomAudio) { window.KomAudio.playHeal(); }
      if (this.diamonds.size === 0) {
        this.exitUnlocked = true;
        log('All memory fragments collected. Exit unlocked.');
        if (LEVELS[this.levelIndex].key === 'collapse' && this.extractionCountdown === null) {
          this.extractionCountdown = 20000;
          log('Extraction timer started: 20 seconds.');
          this.toast('EXTRACT 20s', 1200, true);
        }
        this.syncWarns();
      } else {
        this.toast('FRAGMENT', 700);
      }
    }

    if (this.seeds.has(idx)) {
      this.seeds.delete(idx);
      this.sanity = clamp(this.sanity + 25, 0, 100);
      this.flashT = 10; this.flashColor = '#6bff98';
      if (window.KomAudio) { window.KomAudio.playPickup(); }
      this.toast('SANITY +25', 700);
    }

    if (this.ammoPacks && this.ammoPacks.has(idx)) {
      this.ammoPacks.delete(idx);
      this.ammo = clamp(this.ammo + AMMO_PICKUP, 0, AMMO_MAX);
      this.flashT = 10; this.flashColor = '#ffe26a';
      if (window.KomAudio) { window.KomAudio.playPickup(); }
      this.toast(`AMMO +${AMMO_PICKUP}`, 700);
    }
  },

  checkMine() {
    const idx = this.player.y * this.map.w + this.player.x;
    if (this.mines.has(idx)) {
      this.mines.delete(idx);
      this.flashColor = this.currentFlashColor();
      this.flashT = 18;
      this.glitchT = Math.max(this.glitchT, 18);
      this.sanity = clamp(this.sanity - 60, 0, 100);
      if (window.KomAudio) { window.KomAudio.playMine(); }
      this.toast('MINE HIT', 800, true);
      if (this.sanity <= 0) { log('Mine detonation: sanity collapse'); this.startMelt(); }
    }
  },

  currentFlashColor() {
    const spec = LEVELS[this.levelIndex]; const pal = PALETTES[spec.key];
    return pal.flash || '#aa0000';
  },

  crumbleOne() {
    if (!this.trail.length) return;
    const pickIndex = Math.max(0, this.trail.length - 30);
    const idx = this.trail.splice(pickIndex, 1)[0] ?? this.trail.shift();
    if (idx == null) return;
    const x = idx % this.map.w, y = (idx / this.map.w) | 0;

    const pidx = this.player.y * this.map.w + this.player.x;
    if (idx === pidx || idx === this.exit) return;

    this.map.cells[idx] = 1;
    this.diamonds.delete(idx);
    if (this.diamondGoal > 0 && this.diamonds.size === 0) this.exitUnlocked = true;
    this.mines.delete(idx);
    this.seeds.delete(idx);
    this.ammoPacks?.delete(idx);
    this.decor.delete(idx);

    for (const e of this.entities) {
      if (e.type !== 'enemy') continue;
      if (e.x === x && e.y === y) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) { if (this.canStep(x + dx, y + dy)) { e.x += dx; e.y += dy; break; } }
      }
    }
    this.flashColor = this.currentFlashColor();
    this.flashT = 8;
  },

  startMelt() {
    this._pauseReasons.clear();
    this.hidePauseGate();
    if (window.KomAudio && this.state !== 'melting' && this.state !== 'gameover') {
      try {
        window.KomAudio.stopBackground({ fade: true });
        window.KomAudio.playGameOver();
      } catch (e) { console.warn('KomAudio gameover audio failed', e); }
    }
    const w = this.canvas.width, h = this.canvas.height;
    const off = document.createElement('canvas'); off.width = w; off.height = h; const octx = off.getContext('2d');
    octx.drawImage(this.canvas, 0, 0);
    const colW = 2, cols = Math.ceil(w / colW); const offs = new Array(cols).fill(0); const vels = new Array(cols);
    for (let i = 0; i < cols; i++) { vels[i] = 1.2 + Math.random() * 2.0; offs[i] = 0; }
    this.melt = { off: off, colW, cols, offs, vels, done: false, timer: 0 };
    this.state = 'melting';
  },
};
