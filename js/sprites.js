import { TILE_W, TILE_H } from './config.js';

export const SPR = {};
function makeSprite(w, h, drawFn, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.save(); g.scale(scale, scale); drawFn(g); g.restore();
  return c;
}
function px(g, x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
function mirrorHalf(g, halfW, h, paintHalf) {
  paintHalf(+1);
  g.save(); g.translate(halfW * 2, 0); g.scale(-1, 1); paintHalf(-1); g.restore();
}
function variantIndex(x, y) { const v = ((x * 73856093) ^ (y * 19349663)) >>> 0; return v & 3; }
export function tileName(base, x, y) { return base + (variantIndex(x, y)); }

function drawBrickTile(g, w = 16, h = 16, opts = {}) {
  const mortar = opts.mortar || '#2a211f';
  const brick1 = opts.brick1 || '#513329';
  const brick2 = opts.brick2 || '#6a3b30';
  const hi = opts.hi || '#8a4b3a';
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  const rowH = 4;
  const brickW = 6;
  for (let y = 0; y < h; y += rowH) {
    const offset = ((y / rowH) | 0) % 2 ? Math.floor(brickW / 2) : 0;
    for (let x = -offset; x < w; x += brickW) {
      const col = Math.random() < 0.5 ? brick1 : brick2;
      g.fillStyle = col;
      g.fillRect(x + 1, y + 1, brickW - 2, rowH - 2);
      g.fillStyle = hi; g.globalAlpha = 0.12;
      g.fillRect(x + 1, y + 1, brickW - 2, 1);
      g.globalAlpha = 1;
    }
  }
  g.globalAlpha = 0.22;
  for (let i = 0; i < 10; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#231a18' : '#3b2c28';
    g.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1);
  }
  g.globalAlpha = 1;
}

function drawPaverTile(g, w = 16, h = 16, opts = {}) {
  const mortar = opts.mortar || '#201916';
  const tileA = opts.tileA || '#3f2b26';
  const tileB = opts.tileB || '#4b332d';
  const hi = opts.hi || '#a07a62';
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  const cellW = 5, cellH = 5;
  for (let y = 0; y < h; y += cellH) {
    const offset = ((y / cellH) | 0) % 2 ? Math.floor(cellW / 2) : 0;
    for (let x = -offset; x < w; x += cellW) {
      const col = Math.random() < 0.5 ? tileA : tileB;
      g.fillStyle = col;
      g.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      g.globalAlpha = 0.10; g.fillStyle = hi;
      g.fillRect(x + 1, y + 1, Math.max(1, cellW - 3), 1);
      g.globalAlpha = 1;
    }
  }
  g.globalAlpha = 0.18; g.fillStyle = '#1b1412';
  for (let i = 0; i < 3; i++) {
    const sx = (Math.random() * w) | 0, sy = (Math.random() * h) | 0;
    const len = 3 + ((Math.random() * 6) | 0);
    for (let k = 0; k < len; k++) g.fillRect((sx + k) % w, (sy + ((Math.random() < 0.5) ? 0 : 1)) % h, 1, 1);
  }
  g.globalAlpha = 1;
}

/* Build all sprites once */
export function buildSprites() {
  const u = 12;

  SPR.commando = makeSprite(10, u, (g) => {
    const skin = '#f1c07a', olive = '#2b4b2b', olive2 = '#3c6a3c', strap = '#4a3a1c', visor = '#9fe3b0', dk = '#142414';
    px(g, 4, 0, dk); px(g, 5, 0, dk);
    px(g, 3, 1, dk); px(g, 4, 1, olive2); px(g, 5, 1, olive2); px(g, 6, 1, dk);
    px(g, 3, 2, olive2); px(g, 4, 2, visor); px(g, 5, 2, visor); px(g, 6, 2, olive2);
    px(g, 4, 3, skin); px(g, 5, 3, skin);
    for (let y = 4; y < 8; y++) { for (let x = 3; x <= 6; x++) px(g, x, y, olive); }
    px(g, 3, 5, '#2f6d2f'); px(g, 6, 6, '#2f6d2f'); px(g, 4, 7, '#397a39');
    px(g, 3, 4, strap); px(g, 6, 4, strap);
    px(g, 2, 5, skin); px(g, 7, 5, skin);
    px(g, 2, 6, olive2); px(g, 7, 6, olive2);
    for (let x = 3; x <= 6; x++) px(g, x, 8, '#0e140e'); px(g, 4, 8, '#8a7b3c');
    for (let y = 9; y < 12; y++) { px(g, 4, y, olive2); px(g, 5, y, olive2); }
    px(g, 3, 11, '#232323'); px(g, 6, 11, '#232323');
  });

  SPR.commando_walk = makeSprite(10, u, (g) => {
    const skin = '#f1c07a', olive = '#2b4b2b', olive2 = '#3c6a3c', strap = '#4a3a1c', visor = '#9fe3b0', dk = '#142414';
    px(g, 4, 0, dk); px(g, 5, 0, dk);
    px(g, 3, 1, dk); px(g, 4, 1, olive2); px(g, 5, 1, olive2); px(g, 6, 1, dk);
    px(g, 3, 2, olive2); px(g, 4, 2, visor); px(g, 5, 2, visor); px(g, 6, 2, olive2);
    px(g, 4, 3, skin); px(g, 5, 3, skin);
    for (let y = 4; y < 8; y++) { for (let x = 3; x <= 6; x++) px(g, x, y, olive); }
    px(g, 3, 5, '#2f6d2f'); px(g, 6, 6, '#2f6d2f'); px(g, 4, 7, '#397a39');
    px(g, 3, 4, strap); px(g, 6, 4, strap);
    px(g, 2, 5, skin); px(g, 7, 5, skin);
    px(g, 2, 6, olive2); px(g, 7, 6, olive2);
    for (let x = 3; x <= 6; x++) px(g, x, 8, '#0e140e');
    px(g, 3, 9, '#0e140e'); px(g, 6, 10, '#0e140e');
    px(g, 4, 8, '#8a7b3c');
    for (let y = 9; y < 12; y++) { px(g, 4, y, olive2); }
    for (let y = 9; y < 12; y++) { if (y - 1 >= 9) px(g, 5, y - 1, olive2); }
    px(g, 3, 11, '#232323'); px(g, 6, 11, '#232323');
  });

  SPR.enemy = makeSprite(10, u, (g) => {
    const base = '#6e1010', mid = '#991b1b', hi = '#ff3c3c', eye = '#ffc04d';
    mirrorHalf(g, 5, u, () => {
      px(g, 2, 0, base); px(g, 3, 0, base);
      px(g, 1, 1, base); px(g, 2, 1, mid); px(g, 3, 1, mid); px(g, 4, 1, base);
      px(g, 1, 2, mid); px(g, 2, 2, hi); px(g, 3, 2, hi); px(g, 4, 2, mid);
      px(g, 2, 3, mid); px(g, 3, 3, eye);
    });
    for (let x = 2; x <= 7; x++) px(g, x, 4, mid);
    px(g, 2, 6, base); px(g, 7, 6, base);
  });

  SPR.ghost = makeSprite(10, u, (g) => {
    const mist = '#cc5570', glow = '#ff89a4', edge = '#5b0f1e';
    mirrorHalf(g, 5, u, () => {
      px(g, 3, 1, mist); px(g, 2, 2, mist); px(g, 3, 2, glow);
      px(g, 3, 3, glow); px(g, 2, 3, mist); px(g, 4, 3, glow);
    });
    px(g, 4, 5, glow); px(g, 5, 6, mist);
    for (let x = 2; x <= 7; x++) px(g, x, 4, edge);
  });

  SPR.palm = makeSprite(10, u, (g) => {
    const trunk = '#6b4a2e', leaf = '#37d065', leaf2 = '#2aa955';
    for (let y = 6; y < 12; y++) px(g, 4, y, trunk);
    px(g, 2, 5, leaf); px(g, 3, 4, leaf2); px(g, 5, 4, leaf2); px(g, 6, 5, leaf);
    px(g, 1, 6, leaf); px(g, 7, 6, leaf);
  });

  SPR.bullet = makeSprite(4, 4, (g) => {
    px(g, 0, 1, '#5c4a1a'); px(g, 1, 1, '#ffd36e'); px(g, 2, 1, '#ffd36e'); px(g, 3, 1, '#fff2b0');
    px(g, 2, 0, '#ffd36e'); px(g, 2, 2, '#ffd36e');
  });

  SPR.diamond = makeSprite(8, 8, (g) => {
    const a = '#00ff66', b = '#a6ffd3';
    px(g, 3, 0, b);
    px(g, 2, 1, a); px(g, 3, 1, b); px(g, 4, 1, a);
    px(g, 1, 2, a); px(g, 2, 2, b); px(g, 3, 2, b); px(g, 4, 2, b); px(g, 5, 2, a);
    px(g, 2, 3, a); px(g, 3, 3, b); px(g, 4, 3, a);
    px(g, 3, 4, a);
  });

  SPR.exit = makeSprite(8, 8, (g) => {
    const c = '#c7d2da', hi = '#eef3f6';
    for (let x = 1; x <= 6; x++) { px(g, x, 1, c); px(g, x, 6, c); }
    for (let y = 2; y <= 5; y++) { px(g, 1, y, c); px(g, 6, y, c); }
    px(g, 2, 2, hi); px(g, 5, 2, hi);
    px(g, 3, 5, hi); px(g, 4, 5, hi);
  });

  SPR.mine = makeSprite(10, 10, (g) => {
    g.fillStyle = '#1a1412'; g.fillRect(3, 7, 4, 1);
    g.fillStyle = '#2a1c18'; g.fillRect(2, 6, 6, 1);
    g.fillStyle = '#3d241c'; g.fillRect(1, 5, 8, 1);
    g.fillStyle = '#8a2a1a'; g.fillRect(3, 3, 4, 2);
    g.fillStyle = '#ff4a2e'; g.fillRect(4, 3, 2, 1);
    g.fillStyle = '#5c1c14'; g.fillRect(2, 2, 6, 1);
    g.fillStyle = '#c43422'; g.fillRect(2, 5, 1, 1); g.fillRect(7, 5, 1, 1);
  });

  SPR.ammo = makeSprite(8, 8, (g) => {
    const box = '#c9a227', hi = '#ffe26a', strap = '#5c4310';
    g.fillStyle = box; g.fillRect(1, 2, 6, 5);
    g.fillStyle = hi; g.fillRect(2, 3, 4, 1);
    g.fillStyle = strap; g.fillRect(1, 5, 6, 1);
    px(g, 2, 1, box); px(g, 5, 1, box);
  });

  SPR.seed = makeSprite(10, 12, (g) => {
    px(g, 4, 0, '#f6eeff');
    px(g, 3, 1, '#c9a6ff'); px(g, 4, 1, '#ffffff'); px(g, 5, 1, '#c9a6ff');
    px(g, 2, 2, '#9b6bff'); px(g, 3, 2, '#e6d4ff'); px(g, 4, 2, '#f6eeff'); px(g, 5, 2, '#e6d4ff'); px(g, 6, 2, '#9b6bff');
    px(g, 2, 3, '#7a4ae8'); px(g, 3, 3, '#c9a6ff'); px(g, 4, 3, '#e6d4ff'); px(g, 5, 3, '#c9a6ff'); px(g, 6, 3, '#7a4ae8');
    px(g, 2, 4, '#9b6bff'); px(g, 3, 4, '#b888ff'); px(g, 4, 4, '#c9a6ff'); px(g, 5, 4, '#b888ff'); px(g, 6, 4, '#9b6bff');
    px(g, 3, 5, '#7a4ae8'); px(g, 4, 5, '#9b6bff'); px(g, 5, 5, '#7a4ae8');
    px(g, 3, 6, '#5a2ec0'); px(g, 4, 6, '#6b3fd4'); px(g, 5, 6, '#5a2ec0');
    px(g, 4, 7, '#4a24a8');
  });

  const wallOpts = { mortar: '#2a211f', brick1: '#513329', brick2: '#6a3b30', hi: '#8a4b3a' };
  const floorOpts = { mortar: '#201916', tileA: '#3f2b26', tileB: '#4b332d', hi: '#a07a62' };

  for (let v = 0; v < 4; v++) {
    SPR['wall' + v] = makeSprite(16, 16, (g) => { drawBrickTile(g, 16, 16, wallOpts); });
    SPR['floor' + v] = makeSprite(16, 16, (g) => { drawPaverTile(g, 16, 16, floorOpts); });
  }

  window.SPR = SPR;
  window.drawSprite = drawSprite;
  try { window.dispatchEvent(new Event('kom:sprites-ready')); } catch {}
}

export function drawSprite(ctx, name, x, y, w = TILE_W, h = TILE_H, opts) {
  const img = SPR[name];
  if (!img) return;
  ctx.imageSmoothingEnabled = false;
  if (opts && opts.fit === 'contain') {
    const iw = img.width, ih = img.height;
    const scale = Math.min(w / iw, h / ih);
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    const ox = x + (w - dw) * 0.5;
    const oy = y + (h - dh) * 0.5;
    ctx.drawImage(img, 0, 0, iw, ih, ox, oy, dw, dh);
    return;
  }
  const aspect = img.height / img.width;
  const targetH = Math.min(h, Math.round(w * aspect));
  const oy = (h - targetH) * 0.5;
  ctx.drawImage(img, x, y + oy, w, targetH);
}

