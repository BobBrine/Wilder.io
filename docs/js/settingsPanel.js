// Settings Panel and Gear UI
(function(){
  const panel = document.getElementById('settingsPanel');
  const overlay = document.getElementById('settingsOverlay');
  const gear = document.getElementById('settingsGear');
  if (!panel || !overlay || !gear) return;

  // Controls settings persistence and helpers
  window.controlsSettings = (function(){
    const KEY = 'controls.mode'; // 'pc' | 'mobile'
    function getMode(){
      try { return localStorage.getItem(KEY) || 'pc'; } catch(_) { return 'pc'; }
    }
    function setMode(mode){
      const m = (mode === 'mobile') ? 'mobile' : 'pc';
      try { localStorage.setItem(KEY, m); } catch(_){ }
      // Reflect visibility immediately during gameplay
      try { window.mobileControls && window.mobileControls.setVisible(m === 'mobile' && isInGameplay()); } catch(_) {}
    }
    return { getMode, setMode };
  })();

  // Simple hover/click styling
  gear.addEventListener('mouseenter', () => { gear.style.background = 'rgba(0,0,0,0.8)'; });
  gear.addEventListener('mouseleave', () => { gear.style.background = 'rgba(0,0,0,0.6)'; });
  gear.addEventListener('mousedown', () => { gear.style.transform = 'scale(0.96)'; });
  window.addEventListener('mouseup', () => { gear.style.transform = 'scale(1)'; });

  function isInGameplay() {
    // Only show during gameplay (no menus visible, not at death screen)
    const ids = ['homePage','serverJoin','localLAN','hostPrompt','joinLocalPrompt','nameEntry','deathScreen'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') return false;
    }
    // Socket connected and player context present
    return !!(window.socket && window.socket.connected);
  }

  function openPanel() {
    if (!isInGameplay()) return;
    panel.style.display = 'block';
    overlay.style.display = 'block';
  }
  function closePanel() {
    panel.style.display = 'none';
    overlay.style.display = 'none';
  }
  function togglePanel() {
    if (panel.style.display === 'none' || panel.style.display === '') openPanel(); else closePanel();
  }

  // Gear toggles panel
  gear.addEventListener('click', togglePanel);

  // Esc toggles open/close; also closes when already open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // If any blocking menu (death screen, prompts) is open, close panel
      if (!isInGameplay()) { closePanel(); return; }
      togglePanel();
    }
  });

  // Close button
  const closeBtn = document.getElementById('settingsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closePanel);

  // Close when clicking outside the panel
  document.addEventListener('click', (e) => {
    if (panel.style.display === 'none') return;
    if (panel.contains(e.target) || gear.contains(e.target)) return;
    // Ignore clicks on other menus
    if (!isInGameplay()) { closePanel(); return; }
    closePanel();
  });

  // Wire up buttons
  const respawnBtn = document.getElementById('settingsRespawnBtn');
  const perfBtn = document.getElementById('settingsPerformanceBtn');
  const debugBtn = document.getElementById('settingsDebugBtn');
  const controlsBtn = document.getElementById('settingsControlsModeBtn');
  const goMainBtn = document.getElementById('settingsGoMainBtn');
  const jsRow = document.getElementById('settingsJoystickRow');
  const jsRange = document.getElementById('settingsJoystickScale');
  const jsVal = document.getElementById('settingsJoystickScaleVal');

  // Reuse death screen respawn logic: emulate clicking respawn (calls socket setName, etc.)
  function doRespawn() {
    if (typeof window.respawnNow === 'function') window.respawnNow();
    closePanel();
  }

  if (respawnBtn) respawnBtn.addEventListener('click', doRespawn);

  function togglePerformance() {
    const gs = (window.graphicsSettings ||= {});
    const next = !gs.performanceMode;
    gs.performanceMode = next;
    // Turn off shadows when performance mode is ON (mirror ensurePerformanceToggle)
    gs.shadows = !next;
    try {
      localStorage.setItem('graphics.performanceMode', JSON.stringify(next));
      localStorage.removeItem('graphics.shadows');
    } catch(_) {}
    if (window.showMessage) window.showMessage(`Performance Mode: ${next ? 'On' : 'Off'}`, 2);
  }
  if (perfBtn) perfBtn.addEventListener('click', togglePerformance);

  function toggleDebug() {
    // Match in-game DEBUG button: toggle the global showData binding
    try {
      // Use identifier, not window.showData, so it affects the global lexical binding
      /* eslint-disable no-undef */
      showData = !showData;
      /* eslint-enable no-undef */
      if (window.showMessage) window.showMessage(`Debug: ${showData ? 'On' : 'Off'}`, 2);
    } catch (e) {
      // Fallback if binding not available yet
      const curr = !!window.showData;
      window.showData = !curr;
      if (window.showMessage) window.showMessage(`Debug: ${!curr ? 'On' : 'Off'}`, 2);
    }
  }
  if (debugBtn) debugBtn.addEventListener('click', toggleDebug);

  // Controls mode toggle button
  function refreshControlsBtn(){
    if (!controlsBtn) return;
    const mode = window.controlsSettings.getMode();
    controlsBtn.textContent = `Controls: ${mode === 'mobile' ? 'Mobile' : 'PC'}`;
    if (jsRow) jsRow.style.display = mode === 'mobile' ? 'flex' : 'none';
    // Sync range with stored scale
    try {
      const scale = (function(){ try { return parseFloat(localStorage.getItem('controls.joystickScale')||'1'); } catch(_) { return 1; } })();
      if (jsRange) jsRange.value = String(scale);
      if (jsVal) jsVal.textContent = `${scale.toFixed(2)}×`;
    } catch(_) {}
  }
  function toggleControlsMode(){
    const curr = window.controlsSettings.getMode();
    const next = (curr === 'pc') ? 'mobile' : 'pc';
    window.controlsSettings.setMode(next);
    refreshControlsBtn();
    if (window.showMessage) window.showMessage(`Controls: ${next === 'mobile' ? 'Mobile' : 'PC'}`, 2);
  }
  if (controlsBtn) {
    controlsBtn.addEventListener('click', toggleControlsMode);
    refreshControlsBtn();
  }

  // Joystick size slider wiring
  if (jsRange) {
    jsRange.addEventListener('input', () => {
      const v = parseFloat(jsRange.value || '1');
      if (jsVal) jsVal.textContent = `${v.toFixed(2)}×`;
      try { window.mobileControls && window.mobileControls.setScale(v); } catch(_) {}
    });
  }

  if (goMainBtn) goMainBtn.addEventListener('click', () => {
    closePanel();
    if (typeof window.backToMain === 'function') window.backToMain();
  });

  // Keep gear visible only in gameplay
  function updateGearVisibility(){
    gear.style.display = isInGameplay() ? 'block' : 'none';
    // Keep mobileControls visibility in sync when gameplay state changes
    try {
      const mode = window.controlsSettings.getMode();
      window.mobileControls && window.mobileControls.setVisible(mode === 'mobile' && isInGameplay());
    } catch(_) {}
    // Ensure canvas captures input only during gameplay (fixes PC mouse not working)
    try {
      const gc = document.getElementById('gameCanvas');
      if (gc) gc.style.pointerEvents = isInGameplay() ? 'auto' : 'none';
    } catch(_) {}
    // Position gear under scoreboard: scoreboard starts at top-right 10px + header (~40px), so we offset ~150-220px
    // Already positioned via CSS inline (top:190px). We could adjust dynamically based on canvas height if needed.
  }
  setInterval(updateGearVisibility, 250);
  updateGearVisibility();

  // Expose for other modules to close when needed
  window.__settingsPanel = { open: openPanel, close: closePanel, toggle: togglePanel };

  // Auto-close on death or navigation
  const origBackToMain = window.backToMain;
  window.backToMain = function(){ closePanel(); if (origBackToMain) origBackToMain(); };
  const origBackToHome = window.backToHome;
  window.backToHome = function(){ closePanel(); if (origBackToHome) origBackToHome(); };

  // Close when death screen appears
  const obs = new MutationObserver(() => {
    const death = document.getElementById('deathScreen');
    if (death && death.style.display !== 'none') closePanel();
  });
  obs.observe(document.body, { attributes:true, subtree:true, attributeFilter:['style'] });
})();
