let lastUpdate = performance.now();

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawWorldBorder() {
  ctx.strokeStyle = "red";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
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

  // Update dropped items collision detection
  if (player) {
    const playerCenterX = player.x + player.size / 2;
    const playerCenterY = player.y + player.size / 2;
    droppedItems.forEach(item => {
      const dx = playerCenterX - item.x;
      const dy = playerCenterY - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 26 && item.pickupDelay <= 0 && inventory.canAddItem(item.type)) { // Player size/2 (16) + item radius (10)
        socket.emit("pickupItem", item.id);
      }
    });
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y);
  // Environment (world space)
  draw(); // Includes drawDroppedItems() from ui.js
  drawWorldBorder();
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