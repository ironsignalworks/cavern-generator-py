import {
  TILE_W, TILE_H, viewZoom, PALETTES, LEVELS, clamp,
} from './config.js';
import { computeFOV } from './map.js';
import { drawSprite, tileName } from './sprites.js';

export const renderMethods = {
  render() {
    const ctx = this.ctx;
    const spec = LEVELS[this.levelIndex];
    const pal = PALETTES[spec.key];

    if (this.state === 'melting') { return; }
    if (this.state === 'gameover') { this.renderGameOver(); return; }

    const viewW = this.canvas.width;
    const viewH = this.canvas.height;
    const ww = this.worldW, wh = this.worldH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();

    const scale = Math.min(viewW / ww, viewH / wh) * viewZoom();

    const viewWorldW = viewW / scale;
    const viewWorldH = viewH / scale;
    const playerPx = this.player.x * TILE_W + TILE_W / 2;
    const playerPy = this.player.y * TILE_H + TILE_H / 2;
    const camX = ww <= viewWorldW ? ww / 2 : clamp(playerPx, viewWorldW / 2, ww - viewWorldW / 2);
    const camY = wh <= viewWorldH ? wh / 2 : clamp(playerPy, viewWorldH / 2, wh - viewWorldH / 2);

    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    if (spec.key === 'reality') {
      const lampCount = Math.max(2, Math.floor(ww / 260));
      const lampColor = pal.lampColor || 'rgba(145,170,210,0.32)';
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < lampCount; i++) {
        const lx = (i + 0.5) * ww / lampCount;
        const lampW = Math.max(28, ww / lampCount * 0.42);
        const grad = ctx.createLinearGradient(lx, 0, lx, wh);
        grad.addColorStop(0, 'rgba(60,80,120,0.02)');
        grad.addColorStop(0.25, lampColor);
        grad.addColorStop(0.75, 'rgba(70,90,130,0.08)');
        grad.addColorStop(1, 'rgba(30,40,60,0.02)');
        ctx.fillStyle = grad; ctx.fillRect(lx - lampW / 2, 0, lampW, wh);
      }
      ctx.globalAlpha = 1;
    } else if (spec.key === 'jungle') {
      ctx.globalAlpha = 0.10;
      for (let i = 0; i < 5; i++) {
        const px = Math.random() * ww, py = Math.random() * wh;
        const radius = 90 + Math.random() * 140;
        const grad = ctx.createRadialGradient(px, py, radius * 0.15, px, py, radius);
        grad.addColorStop(0, pal.fogColor || 'rgba(18,70,32,0.45)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
      }
      ctx.globalAlpha = 1;
    }

    const vis = computeFOV(this.map, this.player.x, this.player.y, 12); for (const i of vis) this.seen.add(i);
    const halfVW = viewWorldW / 2, halfVH = viewWorldH / 2;
    const minPx = camX - halfVW, minPy = camY - halfVH;
    const maxPx = camX + halfVW, maxPy = camY + halfVH;
    const x0 = Math.max(0, Math.floor(minPx / TILE_W) - 1);
    const x1 = Math.min(this.map.w - 1, Math.ceil(maxPx / TILE_W) + 1);
    const y0 = Math.max(0, Math.floor(minPy / TILE_H) - 1);
    const y1 = Math.min(this.map.h - 1, Math.ceil(maxPy / TILE_H) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * this.map.w + x, seen = this.seen.has(i), visible = vis.has(i), isWall = this.map.isWall(x, y);
        const sx = x * TILE_W, sy = y * TILE_H;

        if (isWall) {
          const alpha = visible ? 1 : (seen ? 0.7 : 0.38);
          ctx.globalAlpha = alpha;
          drawSprite(ctx, tileName('wall', x, y), sx, sy, TILE_W, TILE_H);
          if (pal.wallTint) { ctx.fillStyle = pal.wallTint; ctx.fillRect(sx, sy, TILE_W, TILE_H); }
          if (y > 0 && !this.map.isWall(x, y - 1)) { ctx.globalAlpha = 0.14; ctx.fillStyle = 'rgba(255,245,210,1)'; ctx.fillRect(sx, sy, TILE_W, 2); }
          if (x > 0 && !this.map.isWall(x - 1, y)) { ctx.globalAlpha = 0.22; ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fillRect(sx, sy, 2, TILE_H); }
          if (y < this.map.h - 1 && !this.map.isWall(x, y + 1)) { ctx.globalAlpha = 0.25; ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fillRect(sx, sy + TILE_H - 2, TILE_W, 2); }
          ctx.globalAlpha = 1;
        } else {
          const explored = visible || seen;
          ctx.globalAlpha = explored ? 1 : 0.4;
          drawSprite(ctx, tileName('floor', x, y), sx, sy, TILE_W, TILE_H);
          if (pal.floorTint) { ctx.fillStyle = pal.floorTint; ctx.fillRect(sx, sy, TILE_W, TILE_H); }
          ctx.globalAlpha = 1;

          if (this.decor && this.decor.has(i)) {
            const spriteName = this.decor.get(i) || "palm";
            ctx.globalAlpha = explored ? 1 : 0.5;
            drawSprite(ctx, spriteName, sx, sy, TILE_W, TILE_H);
            ctx.globalAlpha = 1;
          }

          if (this.diamonds.has(i)) {
            ctx.globalAlpha = explored ? 1 : 0.7;
            drawSprite(ctx, 'diamond', sx + TILE_W * 0.1, sy + TILE_H * 0.1, TILE_W * 0.8, TILE_H * 0.8);
            ctx.globalAlpha = 1;
          }

          if (this.seeds.has(i)) {
            const pulse = (Math.sin((this.levelTicks || 0) / 220 + i * 0.21) * 0.5 + 0.5);
            const baseAlpha = visible ? 1 : 0.55;
            ctx.globalAlpha = (visible ? 0.22 : 0.12) + 0.10 * pulse;
            const gx = sx + TILE_W * 0.5, gy = sy + TILE_H * 0.5, r = 9 + 3 * pulse;
            const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, r);
            grad.addColorStop(0, 'rgba(180,130,255,0.45)');
            grad.addColorStop(1, 'rgba(180,130,255,0)');
            ctx.fillStyle = grad; ctx.fillRect(sx - 8, sy - 8, TILE_W + 16, TILE_H + 16);
            ctx.globalAlpha = baseAlpha;
            drawSprite(ctx, 'seed', sx + TILE_W * 0.06, sy + TILE_H * 0.04, TILE_W * 0.88, TILE_H * 0.92);
            ctx.globalAlpha = 1;
          }

          if (this.ammoPacks && this.ammoPacks.has(i)) {
            ctx.globalAlpha = explored ? 1 : 0.6;
            drawSprite(ctx, 'ammo', sx + TILE_W * 0.18, sy + TILE_H * 0.18, TILE_W * 0.64, TILE_H * 0.64);
            ctx.globalAlpha = 1;
          }

          if (this.mines.has(i)) {
            const pulse = (Math.sin((this.levelTicks || 0) / 200 + i * 0.13) * 0.5 + 0.5);
            const baseAlpha = visible ? 1 : 0.5;
            ctx.globalAlpha = (visible ? 0.22 : 0.12) + 0.12 * pulse;
            const gx = sx + TILE_W * 0.5, gy = sy + TILE_H * 0.6, r = 7 + 2 * pulse;
            const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, r);
            grad.addColorStop(0, 'rgba(255,74,46,0.45)');
            grad.addColorStop(1, 'rgba(255,74,46,0)');
            ctx.fillStyle = grad; ctx.fillRect(sx - 8, sy - 8, TILE_W + 16, TILE_H + 16);
            ctx.globalAlpha = baseAlpha;
            drawSprite(ctx, 'mine', sx + TILE_W * 0.2, sy + TILE_H * 0.25, TILE_W * 0.6, TILE_H * 0.6);
            ctx.globalAlpha = 1;
          }

          if (this.exit === i) {
            const exitAlpha = explored ? 1 : 0.6;
            ctx.globalAlpha = exitAlpha;
            drawSprite(ctx, 'exit', sx + TILE_W * 0.1, sy + TILE_H * 0.1, TILE_W * 0.8, TILE_H * 0.8);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    for (const e of this.entities) {
      if (e.type === 'jack') {
        const pressing = this.keys.has('arrowup') || this.keys.has('arrowdown') || this.keys.has('arrowleft') || this.keys.has('arrowright') || this.keys.has('w') || this.keys.has('a') || this.keys.has('s') || this.keys.has('d');
        const alt = ((Math.floor((this.levelTicks || 0) / 140) % 2) === 1);
        const sprite = (pressing && alt) ? 'commando_walk' : 'commando';
        drawSprite(ctx, sprite, e.x * TILE_W, e.y * TILE_H, TILE_W, TILE_H);
      } else {
        drawSprite(ctx, 'enemy', e.x * TILE_W, e.y * TILE_H, TILE_W, TILE_H);
      }
    }

    for (const b of this.bullets) {
      drawSprite(ctx, 'bullet', b.x * TILE_W + TILE_W * 0.25, b.y * TILE_H + TILE_H * 0.35, TILE_W * 0.5, TILE_H * 0.3);
    }

    if (spec.key === 'paranoia' && this.phantoms.length) {
      for (const ph of this.phantoms) {
        const i = ph.y * this.map.w + ph.x;
        const on = (Math.sin((performance.now() / 180) + ph.phase) > -0.2);
        if (!on) continue;
        if (!vis.has(i) && !this.seen.has(i)) continue;
        const jx = Math.sin((this.levelTicks || 0) / 260 + ph.phase) * 0.3;
        const jy = Math.cos((this.levelTicks || 0) / 320 + ph.phase) * 0.25;
        ctx.globalAlpha = vis.has(i) ? 0.75 : 0.35;
        drawSprite(ctx, 'ghost', (ph.x + jx) * TILE_W, (ph.y + jy) * TILE_H, TILE_W, TILE_H);
        ctx.globalAlpha = 1;
      }
    }

    if (spec.key === 'reality') {
      ctx.globalAlpha = 0.32; ctx.strokeStyle = pal.rainColor || 'rgba(130,160,210,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      const drops = Math.max(48, Math.floor(ww / 6));
      const drift = (this.levelTicks || 0) * 0.35 + (this.rainSeed || 0);
      for (let i = 0; i < drops; i++) { const x = Math.random() * ww; const y = (Math.random() * wh + drift + i * 11) % wh; ctx.moveTo(x, y); ctx.lineTo(x + 0.6, y + 8); }
      ctx.stroke();
      ctx.globalAlpha = 0.22; ctx.fillStyle = 'rgba(20,30,40,0.35)'; ctx.fillRect(0, wh - 6, wh * 2, 6); ctx.globalAlpha = 1;
    }

    if (spec.key === 'psychosis') {
      if (this.sanity < 75 && Math.random() < 0.05) { ctx.globalAlpha = 0.07; ctx.fillStyle = PALETTES.psychosis.flash; ctx.fillRect(0, 0, ww, wh); ctx.globalAlpha = 1; }
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 4; i++) { const bx = Math.random() * ww; const bw = 1 + Math.random() * 2; ctx.fillStyle = 'rgba(240,240,240,0.35)'; ctx.fillRect(bx, Math.random() * wh, bw, 1); }
      ctx.globalAlpha = 1;
    }

    if (spec.key === 'collapse') {
      ctx.globalAlpha = 0.24;
      const staticCount = Math.max(160, Math.floor(ww * wh / 1400));
      const baseShift = ((this.levelTicks || 0) * 0.12) + (this.staticSeed || 0);
      for (let i = 0; i < staticCount; i++) {
        ctx.fillStyle = (Math.random() < 0.5) ? (PALETTES.collapse.static || '#d4d4d4') : 'rgba(20,20,20,0.45)';
        const px = (Math.random() * ww + baseShift) % ww;
        const py = (Math.random() * wh + baseShift * 0.7) % wh;
        const pw = (Math.random() < 0.2) ? 2 : 1;
        ctx.fillRect(px, py, pw, 1);
      }
      ctx.globalAlpha = 1;
    }

    if (this.glitchT > 0) {
      const n = 120; ctx.globalAlpha = 0.9;
      for (let k = 0; k < n; k++) { ctx.fillStyle = (Math.random() < 0.5) ? '#ffd400' : '#ffee55'; const px = Math.random() * ww, py = Math.random() * wh; ctx.fillRect(px, py, 1, 1); }
      ctx.globalAlpha = 1; if (this.state !== 'paused') this.glitchT--;
    }
    if (this.flashT > 0) {
      if (this.state !== 'paused') this.flashT--;
      ctx.globalAlpha = 0.10; ctx.fillStyle = this.flashColor || pal.flash || '#aa0000'; ctx.fillRect(0, 0, ww, wh); ctx.globalAlpha = 1;
      if (this.flashT === 0) this.flashColor = null;
    }

    ctx.restore();
  },

  renderMelt(dt) {
    const m = this.melt; if (!m) return;
    const ctx = this.ctx; const w = this.canvas.width, h = this.canvas.height; ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < m.cols; i++) { m.offs[i] += m.vels[i] * (dt / 16); m.vels[i] += 0.04; }
    for (let i = 0; i < m.cols; i++) {
      const sx = i * m.colW; const dx = sx; const dy = Math.min(h, m.offs[i]);
      ctx.drawImage(m.off, sx, 0, m.colW, h, dx, dy, m.colW, h);
    }
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    const avg = m.offs.reduce((a, c) => a + c, 0) / m.cols;
    if (avg > h * 1.1) {
      this.state = 'gameover';
      this.melt = null;
      this.showRestartGate();
    }
  },

  renderGameOver() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  },

  updateHUD() {
    const bar = document.getElementById('sanityBar');
    const pct = document.getElementById('sanityPct');
    const v = Math.max(0, Math.min(100, this.sanity));
    if (bar) {
      const n = 10;
      const filled = Math.round((v / 100) * n);
      bar.textContent = `${'█'.repeat(filled)}${'░'.repeat(n - filled)}`;
      bar.setAttribute('aria-valuenow', v | 0);
      bar.classList.toggle('is-warn', v <= 60 && v > 35);
      bar.classList.toggle('is-bad', v <= 35);
    }
    if (pct) pct.textContent = `${v | 0}%`;

    const spec = LEVELS[this.levelIndex];
    const diamondTotal = this.diamondGoal ?? spec.diamonds;
    const diamondCollected = Math.max(0, diamondTotal - this.diamonds.size);

    const diamondsEl = document.getElementById('diamonds');
    const exitEl = document.getElementById('exitState');

    if (diamondsEl) diamondsEl.textContent = `${diamondCollected}/${diamondTotal}`;
    if (exitEl) exitEl.textContent = this.exitUnlocked ? 'OPEN' : 'LOCK';

    const ammoEl = document.getElementById('ammoCount');
    if (ammoEl) ammoEl.textContent = String(this.ammo);

    const extractChip = document.getElementById('extractChip');
    const extractSecs = document.getElementById('extractSecs');
    if (extractChip) {
      const active = this.extractionCountdown !== null && this.extractionCountdown > 0;
      extractChip.classList.toggle('hidden', !active);
      if (active && extractSecs) {
        extractSecs.textContent = String(Math.max(0, Math.ceil(this.extractionCountdown / 1000)));
      }
    }
    this.syncWarns();
  },
};
