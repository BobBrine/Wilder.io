const scoreboardWidth = 200;

function drawHUD() {
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  // Null checks for player, inventory
  if (player) {
    ctx.fillText(`HP: ${Math.floor(player.health)} / ${player.maxHealth}, Stamina: ${Math.floor(stamina)}, Hunger: ${Math.floor(hunger)}`, 10, 20);
    ctx.fillText(`Level: ${player.level}`, 10, 40);
    ctx.fillText(`XP: ${player.xp} / ${player.xpToNextLevel}`, 10, 60);
  }
  const isDevUI = (typeof devModeActive !== 'undefined' ? devModeActive : (typeof devTest !== 'undefined' && devTest));
  if (isDevUI && inventory && inventory.items) {
    let yOffset = 80;
    for (const [item, count] of Object.entries(inventory.items)) {
      ctx.fillText(`${item[0].toUpperCase() + item.slice(1)}: ${count}`, 10, yOffset);
      yOffset += 20;
    }
    uiButtons = [];
    if (uiButtons.length === 0) {
      createButton(10, canvas.height - 50, "DEBUG", () => {
        // toggle showing mob data
        showData = !showData;
      });
    }
  }
  // Scoreboard improvements
  const scoreboardX = canvas.width - scoreboardWidth - 10;
  const scoreboardY = 40;
  // Throttle scoreboard build to reduce per-frame work
  if (!window.__scoreCache) window.__scoreCache = { last: 0, list: [] };
  const nowTs = performance.now();
  if (nowTs - window.__scoreCache.last > 150) {
    const allPlayers = [
      ...(player ? [{ id: socket.id, name: player.name, level: player.level }] : []),
      ...Object.entries(otherPlayers).map(([id, p]) => ({ id, name: p.name, level: p.level }))
    ].sort((a, b) => b.level - a.level).slice(0, 5);
    window.__scoreCache.list = allPlayers;
    window.__scoreCache.last = nowTs;
  }
  const shownPlayers = window.__scoreCache.list;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(scoreboardX, scoreboardY, scoreboardWidth, 20 + 20 * (5 + 1)); // Always height for 5 players
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Scoreboard", scoreboardX + 10, scoreboardY + 15);
  let yOffset = scoreboardY + 40;
  for (let i = 0; i < shownPlayers.length; i++) {
    const p = shownPlayers[i];
    ctx.fillText(`${i + 1}. ${p.name}: Lv ${p.level}`, scoreboardX + 10, yOffset);
    yOffset += 20;
  }
  ctx.restore();
 
}

const slotSize = 40;
const padding = 4;
const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;

function drawHotbar() {
  if (!hotbar || !hotbar.slots) return;
  const startX = (canvas.width - totalWidth) / 2;
  const y = canvas.height - slotSize - 20;
  drawHealthbar(startX, y);
  drawHungerBar(startX, y);
  for (let i = 0; i < hotbar.slots.length; i++) {
    const x = startX + i * (slotSize + padding);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, slotSize, slotSize);
    if (i === hotbar.selectedIndex) {
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, slotSize + 4, slotSize + 4);
    }
    const slot = hotbar.slots[i];
    if (slot) {
      if (slot.type === 'wooden_sword' && typeof swordImage !== 'undefined' && swordImage.complete) {
        const imgSize = 28;
        ctx.drawImage(
          swordImage,
          x + (slotSize - imgSize) / 2,
          y + (slotSize - imgSize) / 2,
          imgSize,
          imgSize
        );
      } else if (slot.type === 'wooden_pickaxe' && typeof wooden_pickaxe_Image !== 'undefined' && pickaxeImageLoaded) {
        const imgSize = 28;
        ctx.drawImage(
          wooden_pickaxe_Image,
          x + (slotSize - imgSize) / 2,
          y + (slotSize - imgSize) / 2,
          imgSize,
          imgSize
        );
      } else if (slot.type === 'wooden_axe' && typeof wooden_axe_Image !== 'undefined' && axeImageLoaded) {
        const imgSize = 28;
        ctx.drawImage(
          wooden_axe_Image,
          x + (slotSize - imgSize) / 2,
          y + (slotSize - imgSize) / 2,
          imgSize,
          imgSize
        );
      } else {
        const itemColor = ItemTypes[slot.type]?.color || "black";
        ctx.fillStyle = itemColor;
        ctx.fillRect(x + 8, y + 4, 24, 24);
      }
      ctx.fillStyle = "white";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(slot.type, x + slotSize / 2, y + slotSize - 16);
      ctx.font = "13px Arial";
      ctx.fillText(slot.count, x + slotSize / 2, y + slotSize - 4);
    }
  }
  if (draggedItem) {
    const iconSize = 30;
    const draggedColor = ItemTypes[draggedItem.type]?.color || "black";
    ctx.fillStyle = draggedColor;
    ctx.fillRect(mouseX, mouseY, iconSize, iconSize);
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(draggedItem.type, mouseX + iconSize / 2, mouseY + 18);
    ctx.fillText(draggedItem.count, mouseX + iconSize / 2, mouseY + 30);
  }
}

function drawCraftingUI() {
  const craftX = canvas.width - scoreboardWidth - 110 - 10;
  let craftY = 40;
  const width = 100;
  const height = 30;
  for (const recipe of recipes) {
    if (!canCraft(recipe)) continue;
    ctx.fillStyle = "darkgreen";
    ctx.fillRect(craftX, craftY, width, height);
    ctx.strokeStyle = "white";
    ctx.strokeRect(craftX, craftY, width, height);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${recipe.name}`, craftX + width / 2, craftY + 20);
    ctx.textAlign = "left";
    craftY += height + 10;
  }
}

let message = "";
let messageEndTime = 0;

function showMessage(text, duration = 2) {
  message = text;
  messageEndTime = Date.now() + duration * 1000;
}

function drawMessage() {
  if (Date.now() < messageEndTime) {
    ctx.save();
    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, 75);
    ctx.restore();
  }
}

const damageTexts = [];

function showDamageText(x, y, damage) {
  damageTexts.push({ x, y, text: `${damage}`, opacity: 1, life: 1, maxLife: 1 });
}

function drawDamageTexts() {
  const deltaTime = (performance.now() - lastUpdate) / 1000;
  for (let i = damageTexts.length - 1; i >= 0; i--) {
    const dmg = damageTexts[i];
    const screenX = dmg.x - camera.x;
    const screenY = dmg.y - camera.y;
    ctx.save();
    ctx.globalAlpha = dmg.opacity;
    ctx.font = "32px Arial";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";
    ctx.strokeText(dmg.text, screenX, screenY);
    ctx.fillText(dmg.text, screenX, screenY);
    ctx.restore();
    dmg.y -= 15 * deltaTime;
    dmg.life -= deltaTime;
    dmg.opacity = dmg.life / dmg.maxLife;
    if (dmg.life <= 0) damageTexts.splice(i, 1);
  }
}

// Accurate FPS via moving average over a time window
let fpsTimes = [];
let fpsDisplay = 0;
const FPS_WINDOW_MS = 1000; // 1-second window

function updateFPSCounter() {
  const now = performance.now();
  fpsTimes.push(now);
  const cutoff = now - FPS_WINDOW_MS;
  // Drop samples older than the window
  while (fpsTimes.length && fpsTimes[0] < cutoff) fpsTimes.shift();
  if (fpsTimes.length >= 2) {
    const elapsed = fpsTimes[fpsTimes.length - 1] - fpsTimes[0];
    const frames = fpsTimes.length - 1;
    fpsDisplay = frames > 0 && elapsed > 0 ? (frames / (elapsed / 1000)) : 0;
  } else {
    fpsDisplay = 0;
  }
}

function drawFPSCounter() {
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "16px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const displayText = `FPS: ${fpsDisplay.toFixed(1)} | Ping: ${ping.toFixed(1)} ms`;
  ctx.fillText(displayText, canvas.width - 10, 10);
  ctx.restore();
}

function drawCreatorTag() {
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "16px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`@BobBrine`, canvas.width - 10, canvas.height - 10);
  ctx.restore();
}

function draw() {
  
  drawMob();
  drawResources();
  drawDroppedItems();
  drawWorldBorder();
}

function drawDroppedItems() {
  droppedItems.forEach(item => {
    // Cull off-screen
    if (typeof isWorldRectOnScreen === 'function' && !isWorldRectOnScreen(item.x - 10, item.y - 10, 20, 20)) {
      return;
    }
    const screenX = item.x;
    const screenY = item.y;
    ctx.save();
    const itemColor = ItemTypes[item.type]?.color || "brown";
    ctx.fillStyle = itemColor;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${item.type} (${item.amount})`, screenX, screenY + 20);
    ctx.restore();
  });
}

function drawTimeIndicator() {
  const isDay = gameTime < DAY_LENGTH;
  ctx.save();
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 30, 20, 0, Math.PI * 2);
  ctx.fillStyle = isDay ? 'yellow' : 'gray';
  ctx.fill(); // Only fill, never stroke
  ctx.restore();
}

function drawLightSources() {
  if (gameTime >= DAY_LENGTH) {
    // Skip heavy lighting entirely in Performance Mode
    if (window.graphicsSettings && window.graphicsSettings.performanceMode) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y);
    ctx.globalCompositeOperation = 'lighter';
    const playerWorldX = player.x + player.size / 2;
    const playerWorldY = player.y + player.size / 2;
  const playerRadius = 160;
    let gradient = ctx.createRadialGradient(playerWorldX, playerWorldY, 0, playerWorldX, playerWorldY, playerRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 245, 0.3)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 245, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 245, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(camera.x - playerRadius, camera.y - playerRadius, canvas.width + 2 * playerRadius, canvas.height + 2 * playerRadius);
  if (hotbar && hotbar.slots && hotbar.slots[hotbar.selectedIndex]?.type === 'torch') {
  const torchRadius = 300;
      gradient = ctx.createRadialGradient(playerWorldX, playerWorldY, 0, playerWorldX, playerWorldY, torchRadius);
      gradient.addColorStop(0, 'rgba(255, 255, 245, 0.3)');
      gradient.addColorStop(0.5, 'rgba(255, 140, 50, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(camera.x - torchRadius, camera.y - torchRadius, canvas.width + 2 * torchRadius, canvas.height + 2 * torchRadius);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

function drawWorldBorder() {
  if (window.graphicsSettings && window.graphicsSettings.performanceMode) return;
  ctx.strokeStyle = "red";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
}

function drawButtons() {
  ctx.save(); // Save the current context state
  // Only show dev-only buttons (Performance) when dev UI is enabled
  const isDevUI = (typeof devModeActive !== 'undefined' ? devModeActive : (typeof devTest !== 'undefined' && devTest));
  if (isDevUI) {
    if (typeof ensurePerformanceToggle === 'function') ensurePerformanceToggle();
  } else {
    // Remove any dev-only buttons if present
    uiButtons = uiButtons.filter(b => !(b && b.text && (b.text.startsWith('Performance:'))));
  }
  uiButtons.forEach(button => {
    if (button.image) {
      ctx.drawImage(button.image, button.x, button.y, button.width, button.height);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillRect(button.x, button.y, button.width, button.height);
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Arial';
    ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
  });
  ctx.restore(); // Restore the context state
}

// Create/update a Performance Mode toggle that controls both performance and shadows
function ensurePerformanceToggle() {
  if (!window.graphicsSettings) window.graphicsSettings = {};
  const pmOn = !!window.graphicsSettings.performanceMode;
  const label = pmOn ? 'Performance: On' : 'Performance: Off';
  const idx = uiButtons.findIndex(b => b && b.text && b.text.startsWith('Performance:'));
  const applyPerf = (next) => {
    window.graphicsSettings.performanceMode = next;
    // Shadows are always inverse of performance mode
    window.graphicsSettings.shadows = !next;
    try { 
      localStorage.setItem('graphics.performanceMode', JSON.stringify(next)); 
      // Remove old shadows setting from localStorage since it's now controlled by performance mode
      localStorage.removeItem('graphics.shadows');
    } catch (_) {}
  };
  if (idx === -1) {
    if (typeof createButton === 'function') {
      createButton(10, canvas.height - 100, label, () => {
        applyPerf(!pmOn);
      });
    } else {
      uiButtons.unshift({
        x: 10, y: 50, width: 160, height: 32,
        text: label,
        callback: () => applyPerf(!pmOn),
      });
    }
  } else {
    uiButtons[idx].text = label;
  }
}