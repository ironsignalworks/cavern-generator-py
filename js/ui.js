import { SPR } from './sprites.js';

export function initHudLogo() {
  const HUD_ASCII = `
  █████   ████    ███████    ██████   ██████ ██████   ██████   █████████   ██████   █████ ██████████      ███████
  ▒▒███   ███▒   ███▒▒▒▒▒███ ▒▒██████ ██████ ▒▒██████ ██████   ███▒▒▒▒▒███ ▒▒██████ ▒▒███ ▒▒███▒▒▒▒███   ███▒▒▒▒▒███
   ▒███  ███    ███     ▒▒███ ▒███▒█████▒███  ▒███▒█████▒███  ▒███    ▒███  ▒███▒███ ▒███  ▒███   ▒▒███ ███     ▒▒███
   ▒███████    ▒███      ▒███ ▒███▒▒███ ▒███  ▒███▒▒███ ▒███  ▒███████████  ▒███▒▒███▒███  ▒███    ▒███▒███      ▒███
   ▒███▒▒███   ▒███      ▒███ ▒███ ▒▒▒  ▒███  ▒███ ▒▒▒  ▒███  ▒███▒▒▒▒▒███  ▒███ ▒▒██████  ▒███    ▒███▒███      ▒███
   ▒███ ▒▒███  ▒▒███     ███  ▒███      ▒███  ▒███      ▒███  ▒███    ▒███  ▒███  ▒▒█████  ▒███    ███ ▒▒███     ███
   █████ ▒▒████ ▒▒▒███████▒   █████     █████ █████     █████ █████   █████ █████  ▒▒█████ ██████████   ▒▒▒███████▒
  ▒▒▒▒▒   ▒▒▒▒    ▒▒▒▒▒▒▒    ▒▒▒▒▒     ▒▒▒▒▒ ▒▒▒▒▒     ▒▒▒▒▒ ▒▒▒▒▒   ▒▒▒▒▒ ▒▒▒▒▒    ▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒      ▒▒▒▒▒▒▒
  `;
  const padding = 2;
  const px = 3;
  function renderHudLogo() {
    const canvas = document.getElementById('hudLogo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const lines = HUD_ASCII.split('\n');
    const rows = lines.length;
    const cols = Math.max(...lines.map(l => l.length));
    const font = `${px}px ui-monospace, Menlo, Consolas, "Courier New", monospace`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = font;
    const charWidth = Math.ceil(ctx.measureText('█').width || px);
    const lineHeight = Math.ceil(px * 1.1);
    const width = charWidth * cols + padding * 2;
    const height = lineHeight * rows + padding * 2;
    const DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(width * DPR);
    canvas.height = Math.ceil(height * DPR);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#d1d725';
    ctx.clearRect(0, 0, width, height);
    for (let r = 0; r < rows; r++) {
      ctx.fillText(lines[r], padding, padding + r * lineHeight);
    }
  }
  window.addEventListener('resize', renderHudLogo, { passive: true });
  renderHudLogo();
}

export function initInstructions() {
  const openBtn = document.getElementById('btnInstructions');
  const modal = document.getElementById('instructionsModal');
  const closeBtn = document.getElementById('btnCloseInstructions');
  if (!modal || !openBtn || openBtn.dataset.bound) return;
  openBtn.dataset.bound = '1';

  const open = () => {
    modal.classList.remove('hidden');
    closeBtn?.focus();
    window.game?.pauseFromModal?.();
  };
  const close = () => {
    modal.classList.add('hidden');
    window.game?.resumeFromModal?.();
  };

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.classList.contains('modal-backdrop')) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modal.classList.contains('hidden')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
  });

  function opaqueBounds(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] < 10) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return { x: 0, y: 0, w: img.width, h: img.height };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function paint(canvas, name) {
    const ctx = canvas.getContext('2d');
    const cssW = +canvas.getAttribute('width') || 20;
    const cssH = +canvas.getAttribute('height') || 20;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cssW, cssH);

    const spriteName = name || canvas.getAttribute('data-sprite');
    const img = SPR[spriteName];
    if (!img) return;

    const pad = 4;
    const innerW = Math.max(1, cssW - pad * 2);
    const innerH = Math.max(1, cssH - pad * 2);
    const b = opaqueBounds(img);
    const scale = Math.min(innerW / b.w, innerH / b.h);
    const dw = Math.max(1, Math.floor(b.w * scale));
    const dh = Math.max(1, Math.floor(b.h * scale));
    const ox = Math.floor((cssW - dw) / 2);
    const oy = Math.floor((cssH - dh) / 2);
    ctx.drawImage(img, b.x, b.y, b.w, b.h, ox, oy, dw, dh);
  }

  function renderAll() {
    document.querySelectorAll('canvas.instr-icon[data-sprite]').forEach(c => {
      paint(c, c.getAttribute('data-sprite'));
    });
  }

  function renderAllWhenReady(tries = 0) {
    if (SPR && Object.keys(SPR).length) {
      renderAll();
    } else if (tries < 120) {
      requestAnimationFrame(() => renderAllWhenReady(tries + 1));
    }
  }

  document.getElementById('btnInstructions')?.addEventListener('click', renderAllWhenReady);
  renderAllWhenReady();
  window.addEventListener('resize', renderAllWhenReady, { passive: true });
  window.addEventListener('kom:sprites-ready', renderAll);
}
