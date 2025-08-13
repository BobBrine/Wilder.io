let lastUpdate = performance.now();

// Clearing is handled opportunistically; avoid full-canvas clears every frame to reduce fill-rate
function clearCanvas() {
  // Intentionally left lightweight; background draw clears the viewport region.
}


function update() {
  
  const now = performance.now();
  const deltaTime = (now - lastUpdate) / 1000;
  if (!window.socket) { requestAnimationFrame(update); return; }
  // Keep rendering UI even if player/resources not yet ready to avoid a frozen feel
  if (!player || !resourcesLoaded) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    requestAnimationFrame(update);
    return;
  }

  updateFPSCounter();
  
  // World rendering (camera-clipped)
  // Set clip to the current viewport to avoid overdraw off-screen
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
        // tryHitResource() is rate-limited internally by attackSpeed and stamina
        tryHitResource();
      }
    }
  } catch (_) {}
  
  
  // Apply world transform
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y);
  // Environment (world space)
  drawBackground();
  if (typeof drawPlayer === 'function') drawPlayer();
  if (typeof drawOtherPlayers === 'function') drawOtherPlayers();
  if (typeof draw === 'function') draw(); // Includes drawDroppedItems() from ui.js
  // Restore to screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();

  // UI (screen space)
  if (player && gameTime >= DAY_LENGTH) {
    if (!(window.graphicsSettings && window.graphicsSettings.performanceMode)) {
    // Cheaper overlay: set globalAlpha once and fill with solid color
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    drawLightSources();
    }
  }
  

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
  requestAnimationFrame(update);
  lastUpdate = now;
}

update();