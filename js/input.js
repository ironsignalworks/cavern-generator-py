export function initTouchControls() {
  initJoystick();
  initFireButton();
}

function emitKey(code, key, type) {
  const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
}

function initJoystick() {
  const stick = document.getElementById('stick');
  const nub = document.getElementById('stickNub');
  const canvas = document.getElementById('screen');
  if (!stick || !nub || !canvas) return;

  canvas.setAttribute('tabindex', '0');

  const DEAD = 0.22;
  const MAXR = 44;
  let activeId = null;
  const pressed = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

  function emit(dir, down) {
    const type = down ? 'keydown' : 'keyup';
    const map = {
      ArrowLeft: ['ArrowLeft', 'a'],
      ArrowRight: ['ArrowRight', 'd'],
      ArrowUp: ['ArrowUp', 'w'],
      ArrowDown: ['ArrowDown', 's']
    }[dir];
    canvas.focus({ preventScroll: true });
    emitKey(map[0], map[0], type);
    emitKey(map[0] === 'ArrowLeft' ? 'KeyA' : map[0] === 'ArrowRight' ? 'KeyD' : map[0] === 'ArrowUp' ? 'KeyW' : 'KeyS', map[1], type);
  }

  function setKeys(nx, ny) {
    const want = {
      ArrowLeft: nx < -DEAD,
      ArrowRight: nx > DEAD,
      ArrowUp: ny < -DEAD,
      ArrowDown: ny > DEAD
    };

    for (const k in want) {
      if (want[k] && !pressed[k]) { pressed[k] = true; emit(k, true); }
      if (!want[k] && pressed[k]) { pressed[k] = false; emit(k, false); }
    }
  }

  function reset() {
    nub.style.transform = 'translate(0,0)';
    setKeys(0, 0);
    activeId = null;
  }

  function posFromEvent(e) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x, y;

    if (e.touches) {
      const t = [...e.touches].find(t => t.identifier === activeId) || e.touches[0];
      if (!t) return null;
      x = t.clientX; y = t.clientY;
    } else {
      x = e.clientX; y = e.clientY;
    }

    const dx = x - cx, dy = y - cy;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const clampR = Math.min(dist, MAXR);
    const px = Math.cos(ang) * clampR, py = Math.sin(ang) * clampR;
    const nx = px / MAXR, ny = py / MAXR;
    return { px, py, nx, ny };
  }

  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (activeId === null) activeId = e.changedTouches[0].identifier;
    canvas.focus({ preventScroll: true });
    const p = posFromEvent(e); if (p) { nub.style.transform = `translate(${p.px}px,${p.py}px)`; setKeys(p.nx, p.ny); }
  }, { passive: false });

  stick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (activeId === null) return;
    const p = posFromEvent(e); if (!p) return;
    nub.style.transform = `translate(${p.px}px,${p.py}px)`;
    setKeys(p.nx, p.ny);
  }, { passive: false });

  stick.addEventListener('touchend', (e) => {
    if ([...e.changedTouches].some(t => t.identifier === activeId)) reset();
  });
  stick.addEventListener('touchcancel', reset);

  let md = false;
  stick.addEventListener('mousedown', (e) => {
    md = true;
    const p = posFromEvent(e);
    if (p) { nub.style.transform = `translate(${p.px}px,${p.py}px)`; setKeys(p.nx, p.ny); }
    canvas.focus({ preventScroll: true });
  });
  window.addEventListener('mousemove', (e) => {
    if (!md) return;
    const p = posFromEvent(e);
    if (p) { nub.style.transform = `translate(${p.px}px,${p.py}px)`; setKeys(p.nx, p.ny); }
  });
  window.addEventListener('mouseup', () => {
    if (md) { md = false; reset(); }
  });

  const overlay = document.querySelector('.touch-controls');
  ['touchstart', 'touchmove'].forEach(t => {
    overlay?.addEventListener(t, (e) => {
      if (e.target.closest?.('.stick')) e.preventDefault();
    }, { passive: false });
  });
}

function initFireButton() {
  const btn = document.getElementById('btnFire');
  if (!btn) return;
  let down = false;
  function press(e) {
    e.preventDefault();
    if (down) return;
    down = true;
    window.game?.setFireHeld?.(true);
  }
  function release(e) {
    e.preventDefault();
    if (!down) return;
    down = false;
    window.game?.setFireHeld?.(false);
  }
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
}
