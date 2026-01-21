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

  // Use the global isInGameplay for singleplayer

  function openPanel() {
    playSelect && playSelect();
    panel.style.display = 'block';
    overlay.style.display = 'block';
    controldisplay = true;
  }
  function closePanel() {
    panel.style.display = 'none';
    overlay.style.display = 'none';
    controldisplay = false;
    playCancel();
  }
  function togglePanel() {
    if (panel.style.display === 'none' || panel.style.display === '') openPanel(); else closePanel();
  }

  // Gear toggles panel
  gear.addEventListener('click', () => {
  togglePanel();
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
  // Add Spectator toggle dynamically if not present in HTML
  let spectateBtn = document.getElementById('settingsSpectatorBtn');
  if (!spectateBtn) {
    try {
      const container = panel.querySelector('div[style]')?.parentElement || panel;
      spectateBtn = document.createElement('button');
      spectateBtn.id = 'settingsSpectatorBtn';
      spectateBtn.textContent = 'Mode: Survival';
      spectateBtn.className = 'primary';
      // Insert before Go Main button if present
      const goMain = document.getElementById('settingsGoMainBtn');
      (goMain?.parentElement)?.insertBefore(spectateBtn, goMain);
    } catch(_) {}
  }
  const soundBtn = document.getElementById('settingsSoundBtn'); // New sound button
  const volumeRow = document.getElementById('settingsVolumeRow'); // New volume row
  const volumeSlider = document.getElementById('settingsVolumeSlider'); // New volume slider
  const volumeValue = document.getElementById('settingsVolumeValue'); // New volume value display
  const goMainBtn = document.getElementById('settingsGoMainBtn');
  const jsRow = document.getElementById('settingsJoystickRow');
  const jsRange = document.getElementById('settingsJoystickScale');
  const jsVal = document.getElementById('settingsJoystickScaleVal');

  function refreshSoundBtn() {
    if (!soundBtn) return;
    if (!window.soundSettings) window.soundSettings = { muted: false, volume: 100 };
    soundBtn.textContent = `Sound: ${window.soundSettings.muted ? 'Off' : 'On'}`;
    if (volumeRow) volumeRow.style.display = window.soundSettings.muted ? 'none' : 'flex';
  }
  
  function toggleSound() {
    playSelect();
    window.soundSettings.muted = !window.soundSettings.muted;
    try {
      localStorage.setItem('sound.muted', window.soundSettings.muted);
    } catch (e) {}
    refreshSoundBtn();
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', toggleSound);
    refreshSoundBtn();
  }

  // Volume slider
  if (volumeSlider && volumeValue) {
    volumeSlider.value = window.soundSettings.volume;
    volumeValue.textContent = `${window.soundSettings.volume}%`;
    
    volumeSlider.addEventListener('input', () => {
      const volume = parseInt(volumeSlider.value, 10);
      volumeValue.textContent = `${volume}%`;
      window.soundSettings.volume = volume;
      try {
        localStorage.setItem('sound.volume', volume);
      } catch (e) {}
    });
  }
  // Reuse death screen respawn logic: emulate clicking respawn (calls socket setName, etc.)
  function doRespawn() {
    console.log('[DEBUG] settingsPanel.js: doRespawn called');
    if (typeof window.respawnNow === 'function') {
      console.log('[DEBUG] settingsPanel.js: calling respawnNow');
      window.respawnNow();
    } else {
      console.log('[DEBUG] settingsPanel.js: respawnNow is not a function');
    }
    closePanel();
  }

  if (respawnBtn) {
    respawnBtn.addEventListener('click', function() {
      console.log('[DEBUG] settingsPanel.js: respawnBtn click');
      if (typeof window.singleplayerRespawn === 'function') {
        console.log('[DEBUG] settingsPanel.js: calling singleplayerRespawn');
        window.singleplayerRespawn();
      } else {
        console.log('[DEBUG] settingsPanel.js: singleplayerRespawn is not a function');
      }
      closePanel();
    });
  }

  function togglePerformance() {
    playSelect();
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
    playSelect();
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
    playSelect();
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

  // Spectator toggle wiring
  function refreshSpectatorBtn(){
    if (!spectateBtn) return;
    const active = !!(window.spectator && window.spectator.active);
    spectateBtn.textContent = `Mode: ${active ? 'Spectator' : 'Survival'}`;
  }
  function toggleSpectator(){
    playSelect();
    try {
      if (window.spectator && window.spectator.active) {
        window.exitSpectator && window.exitSpectator();
      } else {
        window.enterSpectator && window.enterSpectator();
      }
    } finally {
      refreshSpectatorBtn();
    }
  }
  if (spectateBtn) {
    spectateBtn.addEventListener('click', toggleSpectator);
    refreshSpectatorBtn();
  }

  // Joystick size slider wiring
  if (jsRange) {
    jsRange.addEventListener('input', () => {
      const v = parseFloat(jsRange.value || '1');
      if (jsVal) jsVal.textContent = `${v.toFixed(2)}×`;
      try { window.mobileControls && window.mobileControls.setScale(v); } catch(_) {}
    });
  }

  if (goMainBtn) goMainBtn.addEventListener('click', async () => {
    // Save current game before going to main menu
    try {
      await window.SaveManager.saveCurrentGame();
      // Stop autosave when leaving game
      window.SaveManager.stopAutosave();
    } catch (e) {
      console.warn('Failed to save before going to main:', e);
    }
    
    // We stay on this page; show the Singleplayer menu panel instead of navigating away
    // Clear death state and close settings
    try {
      if (window.__deathCountdownTimer) {
        clearInterval(window.__deathCountdownTimer);
        window.__deathCountdownTimer = null;
      }
      const death = document.getElementById('deathScreen');
      if (death) death.style.display = 'none';
      if (window.player && window.player.isDead) window.player.isDead = false;
    } catch(_) {}

    // Show the singlePlayerMenu panel and hide gameplay canvas
    if (typeof window.showSinglePlayerMenu === 'function') {
      window.showSinglePlayerMenu();
    } else {
      // Fallback inline behavior
      try {
        const menu = document.getElementById('singlePlayerMenu');
        const bg = document.getElementById('bgHomepage');
        const gc = document.getElementById('gameCanvas');
        if (gc) gc.style.display = 'none';
        if (bg) bg.style.display = 'block';
        if (menu) menu.style.display = 'block';
      } catch(_) {}
    }
    closePanel();
    try { playCancel && playCancel(); } catch(_) {}
  });

  // Keep gear visible only in gameplay (singleplayer logic)
  function updateGearVisibility(){
    // True if the main menu is hidden and the game canvas is visible
    const menu = document.getElementById('singlePlayerMenu');
    const gameCanvas = document.getElementById('gameCanvas');
  const inGameplay = (!menu || menu.style.display === 'none') && gameCanvas && gameCanvas.style.display !== 'none';
    gear.style.display = inGameplay ? 'block' : 'none';
    // Optionally, update mobileControls and pointer events if needed
    try {
      const mode = window.controlsSettings.getMode();
      window.mobileControls && window.mobileControls.setVisible(mode === 'mobile' && inGameplay);
    } catch(_) {}
    try {
      const gc = document.getElementById('gameCanvas');
      if (gc) gc.style.pointerEvents = inGameplay ? 'auto' : 'none';
    } catch(_) {}
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

