function drawHUD() {
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText(`HP: ${Math.floor(player.health)} / ${player.maxHealth}, Stamina: ${Math.floor(stamina)}`, 10, 20);
  ctx.fillText(`Level: ${player.level}`, 10, 40);
  ctx.fillText(`XP: ${player.xp} / ${player.xpToNextLevel}`, 10, 60);

  if (devTest)
  {

    let yOffset = 80;
    for (const [item, count] of Object.entries(inventory)) {
      if (typeof count === "number") {
        ctx.fillText(`${item[0].toUpperCase() + item.slice(1)}: ${count}`, 10, yOffset);
        yOffset += 20;
      }
    }
  }
}

const slotSize = 40;
const padding = 4;
function drawHotbar() {
  const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
  const startX = (canvas.width - totalWidth) / 2;
  const y = canvas.height - slotSize - 20;

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
      const resourceConfig = resourceTypes[slot.type];
      const recipeConfig = recipes.find(r => r.output?.type === slot.type);
      const itemColor = resourceConfig?.color || recipeConfig?.itemColor || "black";
      ctx.fillStyle = itemColor;
      ctx.fillRect(x + 8, y + 4, 24, 24);

      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.fillText(slot.type, x + 2, y + slotSize - 16);

      const liveCount = inventory[slot.type] ?? 0;
      ctx.font = "12px Arial";
      ctx.fillText(liveCount, x + 2, y + slotSize - 4);
    }
  }

  if (draggedItem) {
    const iconSize = 30;
    const draggedConfig = resourceTypes[draggedItem.type];
    const draggedColor = draggedConfig?.itemColor || "black";
    ctx.fillStyle = draggedColor;
    ctx.fillRect(mouseX, mouseY, iconSize, iconSize);

    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText(draggedItem.type, mouseX + 2, mouseY + 12);
    ctx.fillText(draggedItem.count, mouseX + 2, mouseY + 0);
  }
}

function drawCraftingUI() {
  let x = canvas.width - 110;
  let y = 40;
  const width = 100;
  const height = 30;

  for (const recipe of recipes) {
    if (!canCraft(recipe)) continue;
    ctx.fillStyle = "darkgreen";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(`${recipe.name}`, x + 5, y + 20);
    y += height + 10;
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
  damageTexts.push({
    x,
    y,
    text: `${damage}`,
    opacity: 1,
    life: 120,
    maxLife: 120
  });
}

function drawDamageTexts() {
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
    dmg.y -= 0.3;
    dmg.life--;
    dmg.opacity = dmg.life / dmg.maxLife;
    if (dmg.life <= 0) {
      damageTexts.splice(i, 1);
    }
  }
}

let lastFrameTime = performance.now();
let fps = 0;
let ms = 0;
let fpsDisplay = 0;
let msDisplay = 0;
let fpsUpdateCounter = 0;
const FPS_UPDATE_DELAY_FRAMES = 20;

function updateFPSCounter() {
  const now = performance.now();
  ms = now - lastFrameTime;
  fps = 1000 / ms;
  lastFrameTime = now;
  fpsUpdateCounter++;
  if (fpsUpdateCounter >= FPS_UPDATE_DELAY_FRAMES) {
    fpsDisplay = fps;
    msDisplay = ms;
    fpsUpdateCounter = 0;
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
  const displayText = `@BobBrine`;
  ctx.fillText(displayText, canvas.width - 10, canvas.height - 10);
  ctx.restore();
}

function draw() {
  if (latestSquare) {
    ctx.fillStyle = "blue";
    ctx.fillRect(latestSquare.x, latestSquare.y, latestSquare.size, latestSquare.size);
  }
  drawResources();
  drawMob();
  drawDroppedItems(); // Draw dropped items
}

function drawDroppedItems() {
  droppedItems.forEach(item => {
    const screenX = item.x;
    const screenY = item.y;
    ctx.save();
    // Use item-specific color if available
    const itemColor = resourceTypes[item.type]?.color || recipes.find(r => r.output?.type === item.type)?.itemColor || "brown";
    ctx.fillStyle = itemColor;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    // Debug: Draw item type and amount
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${item.type} (${item.amount})`, screenX, screenY + 20);
    ctx.restore();
  });
}

function drawTimeIndicator() {
  const isDay = gameTime < DAY_LENGTH;
  ctx.fillStyle = isDay ? 'yellow' : 'gray';
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 30, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawLightSources() {
  if (gameTime >= DAY_LENGTH) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y);
    ctx.globalCompositeOperation = 'lighter';
    const playerWorldX = player.x + player.size / 2;
    const playerWorldY = player.y + player.size / 2;
    const playerRadius = 200;
    let gradient = ctx.createRadialGradient(
      playerWorldX, playerWorldY, 0,
      playerWorldX, playerWorldY, playerRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 245, 0.3)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 245, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 245, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(
      camera.x - playerRadius, camera.y - playerRadius,
      canvas.width + 2 * playerRadius, canvas.height + 2 * playerRadius
    );

    if (hotbar.slots[hotbar.selectedIndex]?.type === 'torch') {
      const torchRadius = 400;
      gradient = ctx.createRadialGradient(
        playerWorldX, playerWorldY, 0,
        playerWorldX, playerWorldY, torchRadius
      );
      gradient.addColorStop(0, 'rgba(255, 255, 245, 0.3)');
      gradient.addColorStop(0.5, 'rgba(255, 140, 50, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(
        camera.x - torchRadius, camera.y - torchRadius,
        canvas.width + 2 * torchRadius, canvas.height + 2 * torchRadius
      );
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}