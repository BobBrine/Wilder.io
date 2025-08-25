const scoreboardWidth = 200;

function drawHUD() {
  ctx.save();
  let yOffsetUI = 16;
  ctx.font = "16px 'VT323', monospace";
  // SOUL: Draw soul currency at top left (gameplay)
  if (typeof window.soulCurrency === 'object') {
    ctx.save();
    ctx.font = '22px VT323, monospace';
    ctx.fillStyle = '#00ff22ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Soul: ' + window.soulCurrency.get(), 10, yOffsetUI);
    yOffsetUI += 24;
    ctx.fillStyle = '#ffffffff';
    ctx.fillText('Difficulty: ' + difficulty, 10, yOffsetUI);
    yOffsetUI += 24;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Day: ' + Math.floor(Day), 10, yOffsetUI);
    yOffsetUI += 24;
    

    ctx.restore();
  }
  ctx.fillStyle = "white";
  
  ctx.textAlign = "left";
  

  if (showData) {
    if (player) {
      yOffsetUI += 20;
      ctx.fillText('Player position: ' + Math.floor(player.x) + ', ' + Math.floor(player.y), 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText('Gametime: ' + Math.floor(gameTime), 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText(`HP: ${Math.floor(player.health)} / ${player.maxHealth}, Stamina: ${Math.floor(stamina)}, Hunger: ${Math.floor(hunger)}`, 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText(`Level: ${player.level}`, 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText(`XP: ${player.xp} / ${player.xpToNextLevel}`, 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText('Player speed: ' + Math.floor(player.speed), 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText('Player damage: ' + Math.floor(player.playerdamage), 10, yOffsetUI);
      yOffsetUI += 20;
      ctx.fillText(
        'Player attack speed: ' + player.playerattackspeed.toFixed(2) + 
        (player.playerattackspeed >= 0.45 ? ' (MAX)' : ''),
        10, yOffsetUI
      );
      yOffsetUI += 20;

      ctx.fillText(
        'player attack range: ' + Math.floor(player.playerrange) + 
        (player.playerrange >= 130 ? ' (MAX)' : ''),
        10, yOffsetUI
      );
      yOffsetUI += 20;
      ctx.fillText('player knockback: ' + Math.floor(player.playerknockback), 10, yOffsetUI);
      yOffsetUI += 20;
      
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
  ctx.font = "16px 'VT323', monospace";
  ctx.textAlign = "left";
  ctx.fillText("Scoreboard", scoreboardX + 10, scoreboardY + 15);
  let yOffset = scoreboardY + 40;
  for (let i = 0; i < shownPlayers.length; i++) {
    const p = shownPlayers[i];
    ctx.fillText(`${i + 1}. ${p.name}: Lv ${p.level}`, scoreboardX + 10, yOffset);
    yOffset += 20;
  }
  drawControlGuide();
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
      ctx.font = "12px 'VT323', monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(String(slot.count), badgeX + 4, badgeY + badgeH / 2);
    }
  }
  // Draw tooltip for hovered slot showing the item name
  if (hoveredSlotInfo && hoveredSlotInfo.slot) {
    const { x: hx, y: hy, slot } = hoveredSlotInfo;
    const label = String(slot.type);
    ctx.save();
    ctx.font = "12px 'VT323', monospace";
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
    ctx.font = "12px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(draggedItem.count), badgeX + badgeW / 2, badgeY + badgeH / 2);
  }
  ctx.restore();
}


function drawCraftingUI() {
  ctx.save();
  const gridCols = 4;
  const gridRows = 4;
  const cellSize = 32;
  const cellPadding = 10;
  const gridWidth = gridCols * cellSize + (gridCols - 1) * cellPadding;
  const gridHeight = gridRows * cellSize + (gridRows - 1) * cellPadding;
  const gridX = canvas.width - scoreboardWidth - gridWidth - 20;
  const gridY = gridHeight - slotSize - 75;

  // 🔹 Check crafting table proximity
  const nearTable = isNearCraftingTable();

  // 🔹 Filter recipes based on crafting table requirement
  const filteredRecipes = recipes.filter(recipe => {
    if (!recipe.craftingTable) return true; // no table needed
    return nearTable; // only allow if near a table
  });

  // Separate craftable and non-craftable from filtered set
  const craftableRecipes = filteredRecipes.filter(recipe => canCraft(recipe));
  const nonCraftableRecipes = filteredRecipes.filter(recipe => 
    Object.keys(recipe.cost).some(key => {
      if (key === 'soul') {
        return window.soulCurrency.get() >= 1;
      } else {
        return inventory.hasItem(key, 1);
      }
    }) && !canCraft(recipe)
  );
  
  // Combine with craftable items first
  const availableRecipes = [...craftableRecipes, ...nonCraftableRecipes].slice(0, 16);
  
  let hoveredCell = null;
  for (let i = 0; i < availableRecipes.length; i++) {
    const row = Math.floor(i / gridCols);
    const col = gridCols - 1 - (i % gridCols);
    const x = gridX + col * (cellSize + cellPadding);
    const y = gridY + row * (cellSize + cellPadding);
    
    const recipe = availableRecipes[i];
    const canCraftRecipe = canCraft(recipe);
    
    // Draw cell background
    ctx.save();
    ctx.globalAlpha = canCraftRecipe ? 1 : 0.5;
    ctx.fillStyle = "rgba(30,60,30,0.85)";
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.strokeStyle = canCraftRecipe ? "#fff" : "#888";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cellSize, cellSize);
    ctx.restore();
    
    // Draw item image
    const outType = recipe.output.type;
    let img = toolImages[outType] || resourceImages[outType];
    if (img && img.complete) {
      ctx.save();
      ctx.globalAlpha = canCraftRecipe ? 1 : 0.5;
      const iconSize = cellSize - cellSize * 0.25;
      ctx.drawImage(img, x + (cellSize - iconSize)/2, y + (cellSize - iconSize)/2, iconSize, iconSize);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = canCraftRecipe ? 1 : 0.5;
      ctx.fillStyle = '#888';
      ctx.fillRect(x+8, y+8, cellSize-16, cellSize-16);
      ctx.restore();
    }
    
    // Draw count if >1
    if (recipe.output.count > 1) {
      ctx.save();
      ctx.globalAlpha = canCraftRecipe ? 1 : 0.5;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px 'VT323', monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("x"+recipe.output.count, x+cellSize-4, y+cellSize-4);
      ctx.restore();
    }
    
    // Mouse hover detection
    if (mouseX >= x && mouseX <= x+cellSize && mouseY >= y && mouseY <= y+cellSize) {
      hoveredCell = { x, y, recipe, cellSize, canCraft: canCraftRecipe };
      if (canCraftRecipe) {
        ctx.save();
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, cellSize, cellSize);
        ctx.restore();
      }
    }
  }
  
  // Tooltip (unchanged)
  if (hoveredCell) {
    const {x, y, recipe, cellSize, canCraft} = hoveredCell;
    let lines = [recipe.name];
    lines.push('Requires:');
    
    for (const [key, val] of Object.entries(recipe.cost)) {
      let hasEnough = (key === 'soul') 
        ? window.soulCurrency.get() >= val
        : inventory.hasItem(key, val);
      const color = hasEnough ? '#0f0' : '#f00';
      lines.push({text: `- ${key}: ${val}`, color});
    }
    
    ctx.save();
    ctx.font = "13px 'VT323', monospace";
    const paddingX = 10, paddingY = 6;
    let maxWidth = ctx.measureText(recipe.name).width;
    for (const line of lines.slice(1)) {
      const width = ctx.measureText(typeof line === 'string' ? line : line.text).width;
      if (width > maxWidth) maxWidth = width;
    }
    const boxW = maxWidth + paddingX * 2;
    const boxH = lines.length * 18 + paddingY * 2;
    let boxX = x - boxW - 8;
    let boxY = y;
    if (boxX < 0) boxX = x + cellSize + 8;
    if (boxY + boxH > canvas.height) boxY = canvas.height - boxH - 4;
    
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = canCraft ? "#0f0" : "#f00";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    ctx.fillStyle = canCraft ? "#0f0" : "#f00";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(lines[0], boxX + paddingX, boxY + paddingY);
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      ctx.fillStyle = typeof line === 'string' ? "#fff" : line.color;
      ctx.fillText(typeof line === 'string' ? line : line.text, boxX + paddingX, boxY + paddingY + i * 18);
    }
    ctx.restore();
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
    ctx.font = "16px 'VT323', monospace";
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
    ctx.font = "32px 'VT323', monospace";
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
  ctx.font = "16px 'VT323', monospace";
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
  ctx.font = "16px 'VT323', monospace";
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
    if(showData) {
      ctx.fillStyle = "white";
      ctx.font = "10px 'VT323', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${item.type} (${item.amount})`, screenX, screenY + 20);
    }
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
    ctx.font = '16px VT323, monospace';
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
      // createButton(10, canvas.height - 100, label, () => {
      //   applyPerf(!pmOn);
      // });
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

controldisplay = false;

function drawControlGuide() {
  if (!controldisplay) return;
  const guideWidth = 180;
  const guideHeight = 110;
  const padding = 10;
  const x = padding;
  const y = canvas.height - guideHeight - padding;
  
  ctx.save();
  
  // Draw semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y, guideWidth, guideHeight);
  
  // Draw border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, guideWidth, guideHeight);
  
  // Set text properties
  ctx.fillStyle = 'white';
  ctx.font = '14px VT323, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // Draw title
  ctx.font = 'bold 16px VT323, monospace';
  ctx.fillText('Controls', x + 10, y + 15);
  ctx.font = '14px VT323, monospace';

  // Draw control instructions
  ctx.fillText('WASD - Move', x + 10, y + 35);
  ctx.fillText('Space - Sprint', x + 10, y + 55);
  ctx.fillText('Left Click - Attack', x + 10, y + 75);
  
  ctx.restore();
}