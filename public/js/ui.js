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
    const selfEntries = (player
      ? [{ id: (window.socket && window.socket.id) ? window.socket.id : 'self', name: player.name, level: player.level }]
      : []);
    const others = Object.entries(otherPlayers || {})
      .filter(([, p]) => p && typeof p.name === 'string' && typeof p.level !== 'undefined')
      .map(([id, p]) => ({ id, name: p.name, level: p.level }));
    const allPlayers = [...selfEntries, ...others]
      .sort((a, b) => (b.level || 0) - (a.level || 0))
      .slice(0, 5);
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
  ctx.save();
  const startX = (canvas.width - totalWidth) / 2;
  const y = canvas.height - slotSize - 20;
  drawHealthbar(startX, y);
  drawHungerBar(startX, y);
  // Track hovered slot for tooltip
  let hoveredSlotInfo = null;
  for (let i = 0; i < hotbar.slots.length; i++) {
    const x = startX + i * (slotSize + padding);
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, slotSize, slotSize);
    ctx.restore();
    if (i === hotbar.selectedIndex) {
      ctx.save();
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, slotSize + 4, slotSize + 4);
      ctx.restore();
    }
    // Detect mouse hover over this slot
    const isHover = typeof mouseX === 'number' && typeof mouseY === 'number' &&
                    mouseX >= x && mouseX <= x + slotSize &&
                    mouseY >= y && mouseY <= y + slotSize;
    const slot = hotbar.slots[i];
    if (isHover) {
      hoveredSlotInfo = { x, y, slot };
    }
    if (slot) {
      const toolImage = toolImages[slot.type];
      const resourceImage = resourceImages[slot.type];
      const imgSize = 28;
      const imgX = x + (slotSize - imgSize) / 2;
      const imgY = y + (slotSize - imgSize) / 2;

      if (toolImage && toolImage.complete) {
        ctx.drawImage(toolImage, imgX, imgY, imgSize, imgSize);
      } else if (resourceImage && resourceImage.complete) {
        ctx.drawImage(resourceImage, imgX, imgY, imgSize, imgSize);
      } else {
        const itemColor = ItemTypes[slot.type]?.color || "black";
        ctx.fillStyle = itemColor;
        ctx.fillRect(x + 8, y + 4, 24, 24);
      }
      // Show item count with background overlay at bottom-right of the slot
      const badgeW = 18, badgeH = 14;
      const badgeX = x - 2;  // Changed to left side with small padding
      const badgeY = y + slotSize - badgeH - 2;
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.font = "12px Arial";
      ctx.textBaseline = "middle";
      ctx.fillText(String(slot.count), badgeX + 4, badgeY + badgeH / 2);
    }
  }
  // Draw tooltip for hovered slot showing the item name
  if (hoveredSlotInfo && hoveredSlotInfo.slot) {
    const { x: hx, y: hy, slot } = hoveredSlotInfo;
    const label = String(slot.type);
    ctx.save();
    ctx.font = "12px Arial";
    const paddingX = 6;
    const paddingY = 4;
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = 20; // fits 12px text comfortably
    let boxX = hx + slotSize / 2 - boxWidth / 2;
    let boxY = hy - boxHeight - 6; // above the slot
    // If near the top edge, place below the slot
    if (boxY < 0) boxY = hy + slotSize + 6;
    // Clamp horizontally within canvas
    boxX = Math.max(2, Math.min(canvas.width - boxWidth - 2, boxX));
    // Background
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    // Text
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, boxX + boxWidth / 2, boxY + boxHeight / 2);
    ctx.restore();
  }
  if (draggedItem) {
    const iconSize = 32;
    let drewImage = false;
    const toolImage = toolImages[draggedItem.type];
    const resourceImage = resourceImages[draggedItem.type];

    if (toolImage && toolImage.complete) {
        ctx.drawImage(toolImage, mouseX, mouseY, iconSize, iconSize);
        drewImage = true;
    } else if (resourceImage && resourceImage.complete) {
        ctx.drawImage(resourceImage, mouseX, mouseY, iconSize, iconSize);
        drewImage = true;
    }

    if (!drewImage) {
      // Fallback to colored square if no image
      const draggedColor = ItemTypes[draggedItem.type]?.color || "black";
      ctx.fillStyle = draggedColor;
      ctx.fillRect(mouseX, mouseY, iconSize, iconSize);
    }
    // Draw count overlay at bottom-right of the dragged icon
    const badgeW = 18, badgeH = 14;
    const badgeX = mouseX + iconSize - badgeW;
    const badgeY = mouseY + iconSize - badgeH;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(draggedItem.count), badgeX + badgeW / 2, badgeY + badgeH / 2);
  }
  ctx.restore();
}

function drawCraftingUI() {
  ctx.save();
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
  ctx.restore();
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

// Accurate FPS via EMA of frame interval, capped at 60
let fpsDisplay = 0;           // continuously-updated EMA
let fpsShown = 0;             // throttled value used for UI
let __lastFpsTs = null;
let __lastFpsShownTs = 0;
const FPS_SMOOTH_ALPHA = 0.15; // 0..1, higher = snappier
const FPS_SHOW_INTERVAL_MS = 500; // update UI at most twice per second

function updateFPSCounter() {
  const now = performance.now();
  if (__lastFpsTs != null) {
    const dt = now - __lastFpsTs;
    if (dt > 0 && dt < 10000) { // ignore huge pauses
      const instant = 1000 / dt;
      // Exponential moving average for smooth display
      fpsDisplay = fpsDisplay ? (fpsDisplay + FPS_SMOOTH_ALPHA * (instant - fpsDisplay)) : instant;
    }
  }
  __lastFpsTs = now;
  // Cap FPS at 60 for display
  if (fpsDisplay > 60) fpsDisplay = 60;
  // Throttle the visible FPS updates to reduce flicker
  if (!__lastFpsShownTs || (now - __lastFpsShownTs) >= FPS_SHOW_INTERVAL_MS) {
    fpsShown = fpsDisplay;
    __lastFpsShownTs = now;
  }
}

function drawFPSCounter() {
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "16px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const shown = fpsShown || fpsDisplay || 0;
  const displayText = `FPS: ${shown.toFixed(1)} | Ping: ${ping.toFixed(1)} ms`;
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
    // Try to draw an icon for the dropped item if available
    const iconSize = 24;
    let drewImage = false;
    const tImg = (typeof toolImages !== 'undefined') ? toolImages[item.type] : undefined;
    const rImg = (typeof resourceImages !== 'undefined') ? resourceImages[item.type] : undefined;
    if (tImg && tImg.complete) {
      ctx.drawImage(tImg, screenX - iconSize / 2, screenY - iconSize / 2, iconSize, iconSize);
      drewImage = true;
    } else if (rImg && rImg.complete) {
      ctx.drawImage(rImg, screenX - iconSize / 2, screenY - iconSize / 2, iconSize, iconSize);
      drewImage = true;
    }
    if (!drewImage) {
      const itemColor = ItemTypes[item.type]?.color || "brown";
      ctx.fillStyle = itemColor;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
    }
    // Draw label with amount below the icon/circle
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
  ctx.save();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  ctx.restore();
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