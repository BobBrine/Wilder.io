// Ensure Day is defined globally for this module
if (typeof Day === 'undefined') {
  var Day = 0;
}
// Ensure DAY_LENGTH is defined globally for this module
if (typeof DAY_LENGTH === 'undefined') {
  var DAY_LENGTH = 120;
}
// --- Singleplayer: Provide isInGameplay for UI/gear logic ---
function isInGameplay() {
  // True if the main menu is hidden and the game canvas is visible
  const menu = document.getElementById('singlePlayerMenu');
  const gameCanvas = document.getElementById('gameCanvas');
  return (
    (!menu || menu.style.display === 'none') &&
    gameCanvas && gameCanvas.style.display !== 'none'
  );
}
const scoreboardWidth = 200;
function uiCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  return { w: canvas.width / dpr, h: canvas.height / dpr };
}

function drawHUD() {
  ctx.save();
  let yOffsetUI = 16;
  ctx.font = "16px 'VT323', monospace";
  const css = uiCanvasSize();
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
      
      
      // Show save countdown in debug mode
      if (window.SaveManager && typeof window.SaveManager.getSaveCountdown === 'function') {
        const saveInfo = window.SaveManager.getSaveCountdown();
        if (saveInfo && saveInfo.isActive) {
          yOffsetUI += 20;
          ctx.fillStyle = saveInfo.remainingSeconds <= 10 ? '#ffaa00' : '#00ff00';
          ctx.fillText(`Next save in: ${saveInfo.remainingSeconds}s`, 10, yOffsetUI);
          ctx.fillStyle = '#fff';
        } else if (saveInfo) {
          yOffsetUI += 20;
          ctx.fillStyle = '#00ff00';
          ctx.fillText('Autosave: Active', 10, yOffsetUI);
          ctx.fillStyle = '#fff';
        }
      }
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
  

  // Draw crafting UI in top right (where scoreboard was)
  drawCraftingUI();
  drawControlGuide();
  ctx.restore();
  
}

const slotSize = 40;
const padding = 0;

function drawHotbar() {
  // Safely handle cases where hotbar isn't initialized yet
  const hb = (typeof window !== 'undefined' && window.hotbar) ? window.hotbar : { slots: new Array(12).fill(null), selectedIndex: null };
  const slots = Array.isArray(hb.slots) ? hb.slots : new Array(12).fill(null);
  const totalWidth = (slotSize + padding) * slots.length - padding;
  
  ctx.save();
  const css = uiCanvasSize();
  const startX = (css.w - totalWidth) / 2;
  const y = css.h - slotSize - 20;
  drawHealthbar(startX, y, totalWidth, padding);
  drawHungerBar(startX, y, totalWidth, padding);
  // Track hovered slot for tooltip
  let hoveredSlotInfo = null;
  for (let i = 0; i < slots.length; i++) {
    const x = startX + i * (slotSize + padding);
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, slotSize, slotSize);
    ctx.restore();
    if (i === hb.selectedIndex) {
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
  const slot = slots[i];
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
  const css = uiCanvasSize();
  const gridCols = 4;
  const gridRows = 4;
  const cellSize = 32;
  const cellPadding = 10;
  const gridWidth = gridCols * cellSize + (gridCols - 1) * cellPadding;
  const gridHeight = gridRows * cellSize + (gridRows - 1) * cellPadding;
  // Place crafting UI at scoreboard's old top-right position
  const gridX = css.w - gridWidth - 20;
  const gridY = 40;

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
    if (boxY + boxH > css.h) boxY = css.h - boxH - 4;
    
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
    const { w } = uiCanvasSize();
    ctx.fillText(message, w / 2, 75);
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
    const screenX = dmg.x;
    const screenY = dmg.y;
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
  const { w } = uiCanvasSize();
  const shown = fpsShown || fpsDisplay || 0;
  const displayText = `FPS: ${shown.toFixed(1)}`;
  ctx.fillText(displayText, w - 10, 10);
  ctx.restore();
}

function drawCreatorTag() {
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "16px 'VT323', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const css = uiCanvasSize();
  ctx.fillText(`@BobBrine`, css.w - 10, css.h - 10);
  ctx.restore();
}

function draw() {
  
  drawMob();
  // drawResources();
  drawDroppedItems();
  drawWorldBorder();
  
}

function drawDroppedItems() {
  // Delegate to the blinking renderer defined in items.js using a stable alias
  if (typeof window.__drawDroppedItemsBlink === 'function') {
    return window.__drawDroppedItemsBlink();
  }
  // Fallback: do nothing (prevents double-draw and ensures the blinking version is used)
}

function drawTimeIndicator() {
  const isDay = gameTime < DAY_LENGTH;
  ctx.save();
  ctx.beginPath();
  const css = uiCanvasSize();
  ctx.arc(css.w / 2, 30, 20, 0, Math.PI * 2);
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
    ctx.fillRect(-5000, -5000, 10000, 10000);
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

// Settings Panel and Gear UI

function beginUITransform() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);  // UI in CSS pixels
  ctx.imageSmoothingEnabled = false;
}

function drawStaminaBar() {
  if (typeof canvas === 'undefined' || typeof ctx === 'undefined') return;
  ctx.save();
  const cssW = canvas.width / (window.devicePixelRatio || 1);
  const cssH = canvas.height / (window.devicePixelRatio || 1);

  const barWidth = cssW;
  const barHeight = 10;
  const barX = 0;
  const barY = cssH - barHeight;

  // Derive stamina and max from safest sources available
  const ms = (typeof window !== 'undefined' && window.player && typeof window.player.maxStamina === 'number')
    ? window.player.maxStamina
    : (typeof maxStamina !== 'undefined' ? maxStamina : 100);
  const st = (typeof window !== 'undefined' && typeof window.stamina === 'number')
    ? window.stamina
    : (typeof stamina !== 'undefined' ? stamina : ms);
  let staminaRatio = (ms > 0) ? (st / ms) : 0;
  if (!isFinite(staminaRatio)) staminaRatio = 0;
  staminaRatio = Math.max(0, Math.min(1, staminaRatio));

  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = "yellow";
  ctx.fillRect(barX, barY, barWidth * staminaRatio, barHeight);
  ctx.restore();
}