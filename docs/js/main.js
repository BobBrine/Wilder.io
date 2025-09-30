
const TICK_RATE = 60; // Target FPS
const TICK_INTERVAL = 1000 / TICK_RATE;
let lastUpdate = performance.now();
let tickTimeout = null;

// Clearing is handled opportunistically; avoid full-canvas clears every frame to reduce fill-rate
function clearCanvas() {
  // Intentionally left lightweight; background draw clears the viewport region.
}


function update() {
  const now = performance.now();
  let deltaTime = (now - lastUpdate) / 1000;
  if (deltaTime > 0.25) deltaTime = 0.25; // Clamp to avoid spiral of death

  // DEBUG: Log update state
  if (!window._debugUpdateLoggedOnce) {
    console.log('[update] running. player:', player, 'resourcesLoaded:', resourcesLoaded, 'window.player:', window.player);
    window._debugUpdateLoggedOnce = true;
  }

  if (!window.socket) {
    scheduleNextTick();
    return;
  }
  // Keep rendering UI even if player/resources not yet ready to avoid a frozen feel
  if (!player || !resourcesLoaded) {

    scheduleNextTick();
    return;
  }

  updateFPSCounter();

  // World rendering (camera-clipped)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.clip();
  clearCanvas();

  updatePlayerPosition(deltaTime);
  staminaRegen(deltaTime);
  updateCamera();
  updatePlayerFacing(mouseX, mouseY);
  
  // Mobile: auto-attack while right aim joystick is held
  try {
    const mode = (window.controlsSettings && window.controlsSettings.getMode && window.controlsSettings.getMode()) || 'pc';
    if (mode === 'mobile' && window.mobileControls && typeof window.mobileControls.aim === 'function') {
      const aim = window.mobileControls.aim();
      if (aim && aim.active && typeof tryHitResource === 'function') {
        tryHitResource();
      }
    }
  } catch (_) {}

  // Apply world transform
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y);
  drawBackground();
  
  if (typeof drawPlayer === 'function') drawPlayer();
  if (typeof drawOtherPlayers === 'function') drawOtherPlayers();
  if (typeof draw === 'function') draw();
  if (typeof drawPlacedBlocks === 'function') drawPlacedBlocks(ctx);
  if (typeof drawPlacementEffects === 'function') drawPlacementEffects();
  if (hotbar && hotbar.selectedIndex !== null && hotbar.slots[hotbar.selectedIndex]) {
    const selectedType = hotbar.slots[hotbar.selectedIndex].type;
    if (typeof drawBlockPlacementPreview === 'function') {
      drawBlockPlacementPreview(ctx, player, selectedType);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();

  // UI (screen space)
  calculateDayNightCycle();
  

  drawTimeIndicator();
  drawFPSCounter();
  drawCreatorTag();
  drawDamageTexts();
  drawStaminaBar();
  drawHUD();
  drawHotbar();
  drawCraftingUI();
  drawMessage();
  drawButtons();

  lastUpdate = now;
  scheduleNextTick();
}

function scheduleNextTick() {
  if (tickTimeout) clearTimeout(tickTimeout);
  const nextTick = Math.max(0, TICK_INTERVAL - (performance.now() - lastUpdate));
  tickTimeout = setTimeout(update, nextTick);
}

if (!window.isSinglePlayer) {
  update();
} 
