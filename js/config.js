/** Must match tools/generate_maps.py LAYOUTS. JS only picks a packed grid. */
export const LAYOUTS = {
  landscape: { w: 60, h: 30 },
  portrait: { w: 34, h: 52 },
};

export function isPortraitMobile() {
  return window.matchMedia('(max-width: 860px) and (orientation: portrait)').matches;
}

export function currentLayout() {
  return isPortraitMobile() ? 'portrait' : 'landscape';
}

export function viewZoom() {
  if (isPortraitMobile()) return 2.15;
  if (window.matchMedia('(max-width: 860px)').matches) return 2.6;
  return 2.5;
}

export const BUILD = 'v0.8.0';

export const TILE_W = 24;
export const TILE_H = 26;

export const MOVE_COOLDOWN = 70;
export const ENEMY_COOLDOWN = 130;
export const BULLET_COOLDOWN = 140;
export const BULLET_SPEED = 0.55;
export const SANITY_DRAIN_PS = 3;
export const AMMO_START = 24;
export const AMMO_MAX = 48;
export const AMMO_PICKUP = 12;
export const GHOST_DAMAGE = 14;
export const BGM_FADE_IN = (typeof window.KomBgmFadeIn === 'number' && window.KomBgmFadeIn > 0)
  ? window.KomBgmFadeIn
  : 0.05;

export const Glyphs = { mine: { ch: '✚', fg: '#ff4a2e' } };

export const PALETTES = {
  reality: {
    name: 'Reality',
    tint: [1.30, 1.85, 1.15],
    bg: '#0e141d',
    lampColor: 'rgba(10,80,30,0.32)',
    rainColor: 'rgba(135,165,215,0.6)',
    floorTint: 'rgba(12,58,98,0.44)',
  },
  jungle: {
    name: 'Flashback',
    tint: [0.65, 1.22, 0.70],
    bg: '#041407',
    fogColor: 'rgba(14,60,28,0.55)',
    flash: '#ffd94d',
    tracer: '#ffe871',
    floorTint: 'rgba(46,82,44,0.44)',
  },
  paranoia: {
    name: 'Paranoia',
    tint: [1.35, 0.52, 0.52],
    bg: '#1b0404',
    bleed: '#5c0909',
    flash: '#7a0000',
    floorTint: 'rgba(110,26,26,0.44)',
  },
  psychosis: {
    name: 'Psychosis',
    tint: [1.0, 1.0, 1.0],
    bg: '#050505',
    flash: '#aa0000',
    mode: 'bw',
    floorTint: 'rgba(210,210,210,0.38)',
  },
  collapse: {
    name: 'Collapse',
    tint: [1.12, 1.04, 1.10],
    bg: '#040404',
    flash: '#b8a37a',
    static: '#d0d0d0',
    floorTint: 'rgba(56,54,60,0.46)',
  },
};

/** Keys must match tools/generate_maps.py LEVELS. Carve params live in Python. */
export const LEVELS = [
  { id: 1, key: 'reality', name: 'WELCOME HOME', enemies: 1, diamonds: 1, mines: 0, heals: 2, ammo: 1 },
  { id: 2, key: 'jungle', name: 'FLASHBACK', enemies: 2, diamonds: 2, mines: 0, heals: 2, ammo: 1 },
  { id: 3, key: 'paranoia', name: 'TARGETS OF OPPORTUNITY', enemies: 3, diamonds: 2, mines: 1, heals: 2, ammo: 2 },
  { id: 4, key: 'psychosis', name: 'THE RAID', enemies: 4, diamonds: 3, mines: 2, heals: 2, ammo: 2 },
  { id: 5, key: 'collapse', name: 'EXTRACTION', enemies: 5, diamonds: 3, mines: 3, heals: 2, ammo: 2 },
];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (n) => Math.floor(Math.random() * n);
export const manhattan = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);
export function log(msg) { try { console.log('[LOG]', msg); } catch (_) { /* ignore */ } }
