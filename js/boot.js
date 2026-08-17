import { buildSprites } from './sprites.js';
import { initInstructions } from './ui.js';
import { initTouchControls } from './input.js';
import { Game } from './game.js';
import { loadMapBank } from './map.js';

function armAudioOnce() {
  let armed = false;
  function armOnce() {
    if (armed || !window.KomAudio) return;
    armed = true;
    try {
      window.KomAudio.configureFiles?.();
      window.KomAudio.resume(true);
      const fi = window.KomBgmFadeIn ?? 0.05;
      window.KomAudio.armAutoBackground?.({ gain: 0.62, fadeIn: fi });
      window.KomAudio.startBackground?.({ gain: 0.62, fadeIn: fi });
    } catch (e) { console.warn('Audio unlock error', e); }
  }
  ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, armOnce, { once: true, passive: true });
    document.addEventListener(evt, armOnce, { once: true, passive: true });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    armAudioOnce();
    buildSprites();
    initInstructions();
    initTouchControls();

    const mapsReady = loadMapBank().catch((err) => {
      console.warn('Map bank missing; using fallback rooms', err);
      return null;
    });

    const gate = document.getElementById('startGate');
    const btnStart = document.getElementById('btnStartGame');
    let started = false;
    async function beginPlay() {
      if (started) return;
      started = true;
      gate?.classList.add('hidden');
      gate?.setAttribute('aria-hidden', 'true');
      window.removeEventListener('keydown', onStartKey, true);
      btnStart?.removeEventListener('click', beginPlay);
      btnStart?.blur();
      document.getElementById('screen')?.focus({ preventScroll: true });
      const mapBank = await mapsReady;
      window.game = new Game(mapBank);
    }
    function onStartKey(e) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        beginPlay();
      }
    }
    btnStart?.addEventListener('click', beginPlay);
    window.addEventListener('keydown', onStartKey, true);
    queueMicrotask(() => btnStart?.focus({ preventScroll: true }));
  } catch (e) {
    console.error('Game boot error:', e);
  }
});
