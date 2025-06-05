function drawHUD() {
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";

  // XP & Level
  ctx.fillText(`Level: ${player.level}`, 10, 20);
  ctx.fillText(`XP: ${player.xp} / ${player.xpToNextLevel}`, 10, 40);

  // Dynamic inventory display
  let yOffset = 60;
  for (const [item, count] of Object.entries(inventory)) {
    if (typeof count === "number") {
      ctx.fillText(`${item[0].toUpperCase() + item.slice(1)}: ${count}`, 10, yOffset);
      yOffset += 20;
    }
  }
}

function drawHotbar() {
  const slotSize = 40;
  const padding = 4;
  const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
  const startX = (canvas.width - totalWidth) / 2;
  const y = canvas.height - slotSize - 10;

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

  // Dragged item display
  if (draggedItem) {
    const iconSize = 30;
    const draggedConfig = resourceTypes[draggedItem.type];
    const draggedColor = draggedConfig?.itemColor;
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
  let y = 10;
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
let messageTimer = 0;

function showMessage(text, duration = 2) {
  message = text;
  messageTimer = duration * 60; // Assuming 60 FPS
}

function drawMessage() {
  if (messageTimer > 0) {
    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.fillText(message, canvas.width / 2 - 50, 50);
    messageTimer--;
  }
}

const damageTexts = [];
function showDamageText(x, y, damage) {
  damageTexts.push({
    x,
    y,
    text: `-${damage}`,
    opacity: 1,
    life: 120, // 2 seconds at 60 FPS
    maxLife: 120 // Store max life for smooth fade
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
    ctx.strokeStyle = "black";    // 👈 Outline color
    ctx.fillStyle = "white"; 
    ctx.strokeText(dmg.text, screenX, screenY);

    ctx.fillText(dmg.text, screenX, screenY);
    ctx.restore();

    // Move upward slightly
    dmg.y -= 0.3;

    // Smooth fade based on lifespan
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
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  const displayText = `FPS: ${fpsDisplay.toFixed(1)} | Ping: ${ping.toFixed(1)}ms`;
  ctx.fillText(displayText, 10, canvas.height - 10);
  ctx.restore();
}





