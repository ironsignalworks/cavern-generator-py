import {
  TILE_W, TILE_H, viewZoom,
  MOVE_COOLDOWN, ENEMY_COOLDOWN, SANITY_DRAIN_PS, BGM_FADE_IN, LEVELS,
  clamp, log,
} from './config.js';
import { spawnMethods } from './spawn.js';
import { combatMethods } from './combat.js';
import { renderMethods } from './render.js';
import { GAMEOVER_SKULL, playAsciiReveal } from './ascii.js';

export class Game {
  constructor(mapBank = null) {
    this.mapBank = mapBank;
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.font = `${TILE_H}px 'VT323', monospace`;
    this.ctx.textBaseline = 'top';
    this.canvas.setAttribute('tabindex', '0');

    this.levelIndex = 0;
    this.keys = new Set();
    this._tapTile = null;
    this.last = 0; this.lastMove = 0; this.lastEnemy = 0; this.lastShot = 0;
    this.flashT = 0; this.flashColor = null; this.glitchT = 0;
    this.gunfireT = 0; this.enemyInterval = ENEMY_COOLDOWN;
    this.controlInvertT = 0; this.trail = [];
    this.collapseTimer = 0; this.extractionCountdown = null;
    this.sanityMul = 1.0; this.levelTicks = 0; this.sanityWarned = false;
    this.rainSeed = Math.random() * 1000; this.staticSeed = Math.random() * 1000;
    this.state = 'play'; this.melt = null; this.transitioning = false;
    this._pauseReasons = new Set();
    this._toastTimer = 0;
    this._warnPulse = {};
    this._sanityBannerShown = false;
    this._exitBannerShown = false;
    this._ammoToastAt = 0;
    this._ghostHitAt = 0;

    this.fitCanvas = this.fitCanvas.bind(this);
    this._loop = this.loop.bind(this);

    this.resetLevel();
    this.bindInput();
    this.bindRestartGate();
    this.bindHudControls();
    this.fitCanvas();
    this.centerStage();

    window.addEventListener('resize', this.fitCanvas, { passive: true });
    window.addEventListener('resize', () => this.centerStage(), { passive: true });
    if (document.hidden) this.pause('hidden');

    requestAnimationFrame(this._loop);
  }

  get worldW() { return (this.map?.w || 1) * TILE_W; }
  get worldH() { return (this.map?.h || 1) * TILE_H; }

  centerStage() {
    const container = document.querySelector('.view');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    this.canvas.style.maxWidth = rect.width + 'px';
    this.canvas.style.maxHeight = rect.height + 'px';
  }
  fitCanvas() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.font = `${TILE_H}px 'VT323', monospace`;
    this.ctx.textBaseline = 'top';
  }

  hideRestartGate() {
    const gate = document.getElementById('restartGate');
    this._abortAsciiStop?.();
    this._abortAsciiStop = null;
    if (!gate) return;
    gate.classList.add('hidden');
    gate.setAttribute('aria-hidden', 'true');
  }

  showRestartGate() {
    const gate = document.getElementById('restartGate');
    if (!gate) return;
    gate.classList.remove('hidden');
    gate.setAttribute('aria-hidden', 'false');
    this._abortAsciiStop?.();
    this._abortAsciiStop = playAsciiReveal(document.getElementById('abortAscii'), GAMEOVER_SKULL);
    document.getElementById('btnDescendAgain')?.focus({ preventScroll: true });
  }

  retryFromZero() {
    this.levelIndex = 0;
    this.resetLevel();
  }

  bindRestartGate() {
    document.getElementById('btnDescendAgain')?.addEventListener('click', () => this.retryFromZero());
  }

  bindHudControls() {
    document.getElementById('btnPause')?.addEventListener('click', () => this.togglePause());
    document.getElementById('btnResume')?.addEventListener('click', () => this.resume('user'));
    document.getElementById('btnMute')?.addEventListener('click', () => {
      const next = !window.KomAudio?.isMuted?.();
      window.KomAudio?.setMuted?.(next);
      this.syncMuteButton();
    });
    this.syncMuteButton();
  }

  syncMuteButton() {
    const btn = document.getElementById('btnMute');
    if (!btn) return;
    const muted = !!window.KomAudio?.isMuted?.();
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.textContent = muted ? '[MUT]' : '[SND]';
    btn.title = muted ? 'Unmute' : 'Mute';
    btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  toast(msg, ms = 900, warn = false) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('toast--warn', !!warn);
    el.classList.remove('hidden');
    el.classList.remove('toast--in');
    void el.offsetWidth;
    el.classList.add('toast--in');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('toast--in');
    }, ms);
  }

  setWarn(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', !on);
  }

  pulseWarn(id, ms = 1100) {
    this.setWarn(id, true);
    clearTimeout(this._warnPulse[id]);
    this._warnPulse[id] = setTimeout(() => this.setWarn(id, false), ms);
  }

  syncWarns() {
    if (this.sanity <= 35) {
      if (!this._sanityBannerShown) {
        this._sanityBannerShown = true;
        this.pulseWarn('warnSanity', 1100);
      }
    } else {
      this._sanityBannerShown = false;
      this.setWarn('warnSanity', false);
    }
    if (this.exitUnlocked && !this._exitBannerShown) {
      this._exitBannerShown = true;
      if (this.extractionCountdown === null) this.pulseWarn('warnExit', 1100);
    }
  }

  hidePauseGate() {
    const gate = document.getElementById('pauseGate');
    if (!gate) return;
    gate.classList.add('hidden');
    gate.setAttribute('aria-hidden', 'true');
  }

  showPauseGate() {
    const gate = document.getElementById('pauseGate');
    if (!gate) return;
    gate.classList.remove('hidden');
    gate.setAttribute('aria-hidden', 'false');
    document.getElementById('btnResume')?.focus({ preventScroll: true });
  }

  canPause() {
    return this.state === 'play' || this.state === 'paused';
  }

  pause(reason = 'user') {
    if (!this.canPause()) return;
    this._pauseReasons.add(reason);
    this.state = 'paused';
    this.keys.clear();
    if (reason === 'user') this.showPauseGate();
  }

  resume(reason = 'user') {
    this._pauseReasons.delete(reason);
    if (reason === 'user') this.hidePauseGate();
    if (this._pauseReasons.size > 0) return;
    if (this.state !== 'paused') return;
    this.state = 'play';
    this.last = 0;
    this.keys.clear();
  }

  togglePause() {
    if (this.state === 'paused' && this._pauseReasons.has('user')) this.resume('user');
    else if (this.state === 'play') this.pause('user');
    else if (this.state === 'paused') this.pause('user');
  }

  pauseFromModal() { this.pause('modal'); }
  resumeFromModal() { this.resume('modal'); }

  bindInput() {
    const isFireKey = (e) => e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        const instr = document.getElementById('instructionsModal');
        if (instr && !instr.classList.contains('hidden')) return;
        if (this.state === 'gameover' || this.state === 'melting') return;
        e.preventDefault();
        this.togglePause();
        return;
      }
      if (isFireKey(e)) {
        if (this.state !== 'play') return;
        e.preventDefault();
        this.setFireHeld(true);
        return;
      }
      if (this.state === 'paused') return;
      if (this.state === 'gameover') {
        if (e.target.closest?.('#restartGate')) return;
        e.preventDefault();
        this.retryFromZero(); return;
      }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        this.setFireHeld(false);
        return;
      }
      this.keys.delete(e.key.toLowerCase());
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause('hidden');
      else this.resume('hidden');
    });

    const unlock = () => {
      if (window.KomAudio && !this._audioUnlocked) {
        this._audioUnlocked = true;
        window.KomAudio.resume(true)?.then(() => {
          window.KomAudio.startBackground({ gain: 0.65, fadeIn: BGM_FADE_IN });
        });
      }
      ['pointerdown', 'mousedown', 'touchstart'].forEach(ev => {
        window.removeEventListener(ev, unlock, { passive: true });
        document.removeEventListener(ev, unlock, { passive: true });
      });
    };
    ['pointerdown', 'mousedown', 'touchstart'].forEach(ev => {
      window.addEventListener(ev, unlock, { once: true, passive: true });
      document.addEventListener(ev, unlock, { once: true, passive: true });
    });

    const tapToTile = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
      const cy = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
      const vW = this.canvas.width, vH = this.canvas.height;
      const ww = this.worldW, wh = this.worldH;
      const scale = Math.min(vW / ww, vH / wh) * viewZoom();
      const vww = vW / scale, vwh = vH / scale;
      const ppx = this.player.x * TILE_W + TILE_W / 2;
      const ppy = this.player.y * TILE_H + TILE_H / 2;
      const camX = clamp(ppx, vww / 2, ww - vww / 2);
      const camY = clamp(ppy, vwh / 2, wh - vwh / 2);
      const wx = (cx - vW / 2) / scale + camX;
      const wy = (cy - vH / 2) / scale + camY;
      this._tapTile = { tx: Math.floor(wx / TILE_W), ty: Math.floor(wy / TILE_H) };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'play') return;
      tapToTile(e);
      this._tapActive = true;
    }, { passive: true });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this._tapActive) tapToTile(e);
    }, { passive: true });
    this.canvas.addEventListener('pointerup',     () => { this._tapActive = false; this._tapTile = null; });
    this.canvas.addEventListener('pointercancel', () => { this._tapActive = false; this._tapTile = null; });
  }

  loop(ts) {
    const dt = this.last ? (ts - this.last) : 16; this.last = ts;

    if (this.state === 'paused') {
      this.render();
      requestAnimationFrame(this._loop);
      return;
    }

    this.levelTicks += dt;

    if (this.state === 'melting') { this.renderMelt(dt); requestAnimationFrame(this._loop); return; }
    if (this.state === 'gameover') { this.renderGameOver(); requestAnimationFrame(this._loop); return; }

    this.sanity = clamp(this.sanity - (SANITY_DRAIN_PS * this.sanityMul * dt / 1000), 0, 100);
    if (this.sanity <= 0) { log('SANITY COLLAPSE. Melting…'); this.startMelt(); this.updateHUD(); this.render(); requestAnimationFrame(this._loop); return; }

    if (this.sanity <= 35) {
      if (!this.sanityWarned) {
        if (window.KomAudio) { window.KomAudio.playSanityLow(); }
        this.updateHUD();
        this.sanityWarned = true;
      }
    } else if (this.sanityWarned && this.sanity > 55) {
      this.sanityWarned = false;
    }

    if (LEVELS[this.levelIndex].key === 'psychosis') {
      if (this.controlInvertT <= 0 && this.sanity < 60 && Math.random() < 0.010) {
        this.controlInvertT = 180;
        this.toast('CONTROLS INVERTED', 1000, true);
      }
      if (this.controlInvertT > 0) { this.controlInvertT--; }
    }

    if (ts - this.lastMove >= MOVE_COOLDOWN) { this.tryMovePlayer(); this.lastMove = ts; }
    if (this.keys.has(' ')) this.tryShoot();
    if (ts - this.lastEnemy >= this.enemyInterval) { this.updateEnemies(); this.updatePhantoms(); this.lastEnemy = ts; }

    this.updateBullets(dt);

    if (LEVELS[this.levelIndex].key === 'collapse') {
      this.collapseTimer -= dt;
      if (this.collapseTimer <= 0) {
        this.crumbleOne();
        const next = Math.max(450, 900 - Math.min(400, (this.trail.length * 2)));
        this.collapseTimer = next;
      }
      if (this.extractionCountdown !== null) {
        this.extractionCountdown -= dt;
        if (this.extractionCountdown <= 0) { log('Extraction window missed.'); this.startMelt(); }
      }
    }

    if (this.state !== 'play') {
      this.updateHUD();
      requestAnimationFrame(this._loop);
      return;
    }

    const pidx = this.player.y * this.map.w + this.player.x;
    if (!this.transitioning && this.diamonds.size === 0 && pidx === this.exit) {
      this.transitioning = true;
      const next = this.levelIndex + 1;
      if (next >= LEVELS.length) {
        if (window.KomAudio) { window.KomAudio.playVictory(); }
        log('Extraction complete. Exiting.');
        setTimeout(() => { window.location.href = 'endgame.html?outcome=extract'; }, 350);
      } else {
        if (window.KomAudio) { window.KomAudio.playLevelUp(); }
        log('Extraction point reached. Descending.');
        setTimeout(() => {
          this.levelIndex = next;
          this.resetLevel({ carryAmmo: true });
          this.transitioning = false;
        }, 0);
      }
      requestAnimationFrame(this._loop);
      return;
    }

    this.updateHUD();
    this.render();
    requestAnimationFrame(this._loop);
  }
}

Object.assign(Game.prototype, spawnMethods, combatMethods, renderMethods);
