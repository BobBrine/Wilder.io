let otherPlayers = {};
let player = null;
let maxStamina = 0;
let stamina = 0;
let staminaRegenSpeed = 0;
const CONE_LENGTH = 50;

function updatePlayerPosition(deltaTime) {
  if (isDead) return;
  let moveX = 0, moveY = 0;
  let speed = player.speed;
  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;
  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;
  const wantsToSprint = keys[" "];
  if (moveX !== 0 && moveY !== 0) {
    const norm = Math.sqrt(2) / 2;
    moveX *= norm;
    moveY *= norm;
  }
  if (wantsToSprint && stamina > 0) {
    speed *= 1.5;
    stamina -= 20 * deltaTime;
    lastStaminaUseTime = 0;
  }
  const newX = player.x + moveX * speed * deltaTime;
  const newY = player.y + moveY * speed * deltaTime;
  if (!isCollidingWithResources(newX, player.y)) player.x = newX;
  if (!isCollidingWithResources(player.x, newY)) player.y = newY;
  sendPlayerPosition(player.x, player.y);
  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.size, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.size, player.y));
  if (player) {
    const playerCenterX = player.x + player.size / 2;
    const playerCenterY = player.y + player.size / 2;
    droppedItems.forEach(item => {
      const dx = playerCenterX - item.x;
      const dy = playerCenterY - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 26 && item.pickupDelay <= 0 && inventory.canAddItem(item.type)) {
        socket.emit("pickupItem", item.id);
      }
    });
  }
}

let lastStaminaUseTime = 0;

function staminaRegen(deltaTime) {
  lastStaminaUseTime += deltaTime;
  if (lastStaminaUseTime >= 0.5) stamina = Math.min(maxStamina, stamina + staminaRegenSpeed * deltaTime);
  if (stamina < 0) stamina = 0;
}

let maxHunger = 100;
let hunger = 100;

function consumeFood() {
  if (!player || isDead) return;
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (selected?.type === "food" && inventory.hasItem("food", 1) && player.hunger < player.maxHunger) {
    inventory.removeItem("food", 1);
    socket.emit("consumeFood", { amount: 1 });
    showMessage("Ate food, hunger restored!");
  } else if (selected?.type === "food" && player.hunger >= player.maxHunger) {
    showMessage("You are not hungry!");
  } else {
    showMessage("No food selected!");
  }
}

function drawHungerBar(startX, hotbarY) {
  const barWidth = totalWidth / 2.5;
  const barHeight = 10;
  const barX = startX + totalWidth - barWidth;
  const barY = hotbarY - barHeight - padding;
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  const hungerRatio = player.hunger / player.maxHunger;
  ctx.fillStyle = "orange";
  ctx.fillRect(barX, barY, barWidth * hungerRatio, barHeight);
}

function drawHealthbar(startX, hotbarY) {
  const barWidth = totalWidth / 2.5;
  const barHeight = 10;
  const barX = startX;
  const barY = hotbarY - barHeight - padding;
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  const healthRatio = player.health / player.maxHealth;
  ctx.fillStyle = "green";
  ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
}

function updatePlayerFacing(mouseX, mouseY) {
  const worldMouseX = mouseX + camera.x;
  const worldMouseY = mouseY + camera.y;
  const dx = worldMouseX - player.x;
  const dy = worldMouseY - player.y;
  player.facingAngle = Math.atan2(dy, dx);
}

function pointInCone(px, py, ox, oy, dir, angle, length) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > length) return false;
  const normX = dx / dist;
  const normY = dy / dist;
  const coneX = Math.cos(dir);
  const coneY = Math.sin(dir);
  const dot = normX * coneX + normY * coneY;
  return dot > Math.cos(angle / 2);
}

//load player image
const playerImage = new Image();
playerImage.src = "/Player1.png"; // Adjust the path if needed
let playerImageLoaded = false;
playerImage.onload = () => {
  playerImageLoaded = true;
};

function drawPlayer() {
  if (!player || isDead) return;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const coneLength = CONE_LENGTH;
  const coneAngle = Math.PI / 4;
  
  // ctx.fillStyle = "rgba(0, 0, 0, 0)"
  // ctx.fillRect(player.x, player.y, player.size, player.size);

  

  
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(player.facingAngle) * coneLength, centerY + Math.sin(player.facingAngle) * coneLength);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(player.facingAngle - coneAngle / 2) * coneLength, centerY + Math.sin(player.facingAngle - coneAngle / 2) * coneLength);
  ctx.arc(centerX, centerY, coneLength, player.facingAngle - coneAngle / 2, player.facingAngle + coneAngle / 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
  ctx.fill();
  
  drawTool();
  ctx.save();

  // Translate to player position and rotate based on facing angle
  ctx.translate(centerX, centerY);
  ctx.rotate(player.facingAngle + Math.PI/2)
  ctx.drawImage(
      playerImage,
      -player.size / 2 - 10, // Center image horizontally
      -player.size / 2 - 10, // Center image vertically
      50,
      45
    );
  ctx.restore();
  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player.name || "You", centerX, player.y - 10);
}

function drawTool() {
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (!selected || !ItemTypes[selected.type]?.isTool) return;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const toolLength = 20;
  const offsetX = centerX + Math.cos(player.facingAngle) * (player.size / 2 + toolLength / 2);
  const offsetY = centerY + Math.sin(player.facingAngle) * (player.size / 2 + toolLength / 2);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.rotate(player.facingAngle);
  ctx.fillStyle = ItemTypes[selected.type].color;
  ctx.fillRect(-2, -toolLength / 2, 4, toolLength);
  ctx.restore();
}

function gainXP(amount) {
  player.xp += amount;
  while (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level++;
    player.xpToNextLevel = Math.floor(player.xpToNextLevel * 2);
    socket.emit("playerLeveledUp", { id: socket.id, level: player.level });
    showMessage(`Level Up! You are now level ${player.level}`);
  }
}

function drawOtherPlayers() {
  const now = performance.now();
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';
  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    if (!p) continue;
    const screenX = p.x;
    const screenY = p.y;
    ctx.fillStyle = p.color || 'gray';
    ctx.fillRect(screenX, screenY, p.size || 20, p.size || 20);
    ctx.fillStyle = 'white';
    const centerX = screenX + (p.size || 20) / 2;
    ctx.fillText(p.name || 'Unnamed', centerX, screenY - 10);
    if (p.health < p.maxHealth) drawHealthBarP(p);
  }
}

function drawHealthBarP(p) {
  ctx.save();
  const maxHealth = p.maxHealth || 100;
  const hpPercent = Math.max(p.health / maxHealth, 0);
  const barWidth = p.size || 20;
  const barHeight = 5;
  const padding = 2;
  const x = p.x + barWidth / 2 - barWidth / 2;
  const y = p.y - barHeight - padding;
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
  ctx.restore();
}

function drawStaminaBar() {
  const barWidth = canvas.width;
  const barHeight = 10;
  const barX = 0;
  const barY = canvas.height - barHeight;
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  const staminaRatio = stamina / maxStamina;
  ctx.fillStyle = "yellow";
  ctx.fillRect(barX, barY, barWidth * staminaRatio, barHeight);
}

socket.on("updatePlayerHealth", ({ id, health }) => {
  if (otherPlayers[id]) otherPlayers[id].health = health;
});

function tryAttack() {
  if (!player) return;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";
  const toolInfo = ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool ? ItemTypes[selectedTool] : { category: "hand", tier: 0, damage: 1 };
  const swordTypes = ["hand", "sword"];
  const coneLength = CONE_LENGTH + 20;
  const coneAngle = Math.PI / 4;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    if (p.isDead) continue;
    const px = p.x + p.size / 2;
    const py = p.y + p.size / 2;
    if (p.size > 0 && pointInCone(px, py, centerX, centerY, player.facingAngle, coneAngle, coneLength)) {
      if (!swordTypes.includes(toolInfo.category)) {
        showMessage("This tool is not effective.");
        return;
      }
      const damage = toolInfo.damage;
      const cost = 10;
      if (stamina < cost) {
        showMessage("Low Stamina");
        return;
      }
      stamina -= cost;
      lastStaminaUseTime = 0;
      p.health -= damage;
      socket.emit("playerhit", { targetId: id, newHealth: Math.max(0, p.health) });
      showDamageText(px, py, -damage);
      otherPlayers[id].lastHitTime = performance.now();
      return;
    }
  }
}