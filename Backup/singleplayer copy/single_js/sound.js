// Sound settings (shared with settings panel)
window.soundSettings = window.soundSettings || {
  muted: localStorage.getItem('sound.muted') === 'true',
  volume: parseInt(localStorage.getItem('sound.volume') || '100', 10)
};

// Low-latency SoundManager using Web Audio API with preload and context resume
(function(){
  const KNOWN_URLS = [
    '../Sound/select1.wav',
    '../Sound/choptree.wav',
    '../Sound/blockbreak.wav',
    '../Sound/enemyhit6.wav',
    '../Sound/enemydeath.wav',
    '../Sound/playerhurt.wav',
    '../Sound/popclaim.wav',
    '../Sound/consume.wav',
    '../Sound/cancal1.wav',
    '../Sound/playerdeath.wav',
    '../Sound/placeblock.wav'
  ];

  let audioCtx = null;
  let gainNode = null;
  const buffers = new Map(); // url -> AudioBuffer
  const fetchFailed = new Set(); // urls that failed to fetch (e.g., file:// CORS)
  const IS_FILE_ORIGIN = (typeof location !== 'undefined' && location.protocol === 'file:');

  // HTMLAudio fallback cache (if Web Audio unavailable)
  const htmlAudioCache = new Map(); // url -> HTMLAudioElement (preloaded)

  function ensureContext(){
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      gainNode = audioCtx.createGain();
      gainNode.gain.value = (window.soundSettings?.muted ? 0 : (window.soundSettings?.volume ?? 100) / 100);
      gainNode.connect(audioCtx.destination);
      // Try to unlock/resume context on first user gesture and visibility changes
      const resume = () => { try { audioCtx && audioCtx.resume && audioCtx.resume(); } catch(_) {} };
      ['pointerdown','touchstart','keydown','click','visibilitychange'].forEach(ev => {
        document.addEventListener(ev, resume, { passive: true });
      });
      // Warm up: play a tiny silent buffer once to prime hardware path (non-blocking)
      try {
        const sr = audioCtx.sampleRate || 48000;
        const len = Math.max(1, Math.floor(sr * 0.02)); // 20ms
        const buf = audioCtx.createBuffer(1, len, sr);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const silent = audioCtx.createGain(); silent.gain.value = 0;
        src.connect(silent).connect(gainNode);
        src.start();
      } catch(_) {}
    } catch (e) {
      // Web Audio not available; preload HTMLAudio fallbacks
      KNOWN_URLS.forEach(url => {
        if (!htmlAudioCache.has(url)) {
          const el = new Audio(url);
          el.preload = 'auto';
          htmlAudioCache.set(url, el);
        }
      });
    }
    return audioCtx;
  }

  async function loadBuffer(url){
    if (buffers.has(url)) return buffers.get(url);
    const ctx = ensureContext();
    if (!ctx) return null;
    try {
      // Avoid fetch on file:// origins where it is typically blocked by CORS
      if (IS_FILE_ORIGIN) {
        fetchFailed.add(url);
        return null;
      }
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      buffers.set(url, buf);
      return buf;
    } catch (e) {
      console.warn('Failed to load sound', url, e);
      fetchFailed.add(url);
      return null;
    }
  }

  // Preload known sounds eagerly (non-blocking)
  (function preloadAll(){
    // On file://, skip fetch/decode and rely on HTMLAudio preloads
    if (IS_FILE_ORIGIN) {
      KNOWN_URLS.forEach(url => {
        if (!htmlAudioCache.has(url)) {
          const el = new Audio(url);
          el.preload = 'auto';
          htmlAudioCache.set(url, el);
        }
      });
      return;
    }
    // If Web Audio works, decode; otherwise, preload HTMLAudio elements
    if (ensureContext()) {
      KNOWN_URLS.forEach(url => { loadBuffer(url); });
    } else {
      KNOWN_URLS.forEach(url => {
        if (!htmlAudioCache.has(url)) {
          const el = new Audio(url);
          el.preload = 'auto';
          htmlAudioCache.set(url, el);
        }
      });
    }
  })();

  function playWithWebAudio(url){
    // Sync gain each play to reflect latest settings
    if (gainNode) gainNode.gain.value = (window.soundSettings?.muted ? 0 : (window.soundSettings?.volume ?? 100) / 100);
    try { audioCtx && audioCtx.resume && audioCtx.resume(); } catch(_) {}
    const buf = buffers.get(url);
    if (buf) {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(gainNode);
      try { src.start(0); } catch(e) { /* ignore */ }
      return src;
    } else {
      // Lazy-load then play next time; also kick off loading now
      loadBuffer(url);
      return null;
    }
  }

  function playWithHTMLAudio(url){
    if (window.soundSettings?.muted) return null;
    const base = htmlAudioCache.get(url) || new Audio(url);
    base.preload = 'auto';
    htmlAudioCache.set(url, base);
    // Clone to allow overlapping plays
    const sound = base.cloneNode(true);
    sound.volume = (window.soundSettings?.volume ?? 100) / 100;
    sound.play().catch(() => {});
    return sound;
  }

  function playSound(url){
    try {
      if (!url) return null;
      // Ensure settings object exists
      if (!window.soundSettings) window.soundSettings = { muted: false, volume: 100 };
      if (window.soundSettings.muted) {
        return null;
      }
      // On file:// origins or known fetch failures, use HTMLAudio fallback
      if (IS_FILE_ORIGIN || fetchFailed.has(url)) {
        return playWithHTMLAudio(url);
      }
      const ctx = ensureContext();
      if (ctx) {
        const node = playWithWebAudio(url);
        // If buffer not yet ready, fall back to HTMLAudio for immediate playback
        return node || playWithHTMLAudio(url);
      }
      return playWithHTMLAudio(url);
    } catch (e) {
      // Last-resort fallback
      try {
        const a = new Audio(url);
        a.volume = (window.soundSettings?.volume ?? 100) / 100;
        a.play();
        return a;
      } catch(_) { return null; }
    }
  }

  // Public helper setters (optional use from settings panel)
  window.setSoundMuted = function(muted){
    window.soundSettings.muted = !!muted;
    try { localStorage.setItem('sound.muted', String(window.soundSettings.muted)); } catch(_) {}
    if (gainNode) gainNode.gain.value = window.soundSettings.muted ? 0 : (window.soundSettings.volume / 100);
  };
  window.setSoundVolume = function(vol){
    const v = Math.max(0, Math.min(100, parseInt(vol||0, 10)));
    window.soundSettings.volume = v;
    try { localStorage.setItem('sound.volume', String(v)); } catch(_) {}
    if (gainNode) gainNode.gain.value = window.soundSettings.muted ? 0 : (v / 100);
  };

  // Exported play functions remain the same API
  function playSelect() { playSound('../Sound/select1.wav'); }
  function playChopTree() { playSound('../Sound/choptree.wav'); }
  function playBlockBreak() { playSound('../Sound/blockbreak.wav'); }
  function playEnemyHit() { playSound('../Sound/enemyhit6.wav'); }
  function playEnemyDeath() { playSound('../Sound/enemydeath.wav'); }
  function playPlayerHurt() { playSound('../Sound/playerhurt.wav'); }
  function playPopClaim() { playSound('../Sound/popclaim.wav'); }
  function playConsume() { playSound('../Sound/consume.wav'); }
  function playCancel() { playSound('../Sound/cancal1.wav'); }
  function playDeath() { playSound('../Sound/playerdeath.wav'); }
  function playBlockPlace() { playSound('../Sound/placeblock.wav'); }

  window.playChopTree = playChopTree;
  window.playEnemyHit = playEnemyHit;
  window.playPlayerHurt = playPlayerHurt;
  window.playPopClaim = playPopClaim;
  window.playConsume = playConsume;
  window.playSelect = playSelect;
  window.playCancel = playCancel;
  window.playDeath = playDeath;
  window.playBlockPlace = playBlockPlace;

  // Also expose generic playSound if needed elsewhere
  window.__playSoundRaw = playSound;
})();