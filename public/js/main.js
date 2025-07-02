let lastUpdate = performance.now();

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}


function update() {
  const now = performance.now();
  const deltaTime = (now - lastUpdate) / 1000;
  if (!player || !resourcesLoaded) {
    requestAnimationFrame(update);
    return;
  }

  updateFPSCounter();

  clearCanvas();

  updatePlayerPosition(deltaTime);
  sendPlayerPosition(player.x, player.y);
  staminaRegen(deltaTime);
  updateCamera();
  updatePlayerFacing(mouseX, mouseY);

  

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y);
  // Environment (world space)
  draw(); // Includes drawDroppedItems() from ui.js
  drawPlayer();
  drawOtherPlayers();
  ctx.restore();

  // UI (screen space)
  if (gameTime >= DAY_LENGTH) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLightSources();
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

  requestAnimationFrame(update);
  lastUpdate = now;
}

update();