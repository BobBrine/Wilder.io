let otherPlayers = {};

let player = null;
let maxStamina = 0;
let stamina = 0;
let staminaRegenSpeed = 0;
const CONE_LENGTH = 50;
function updatePlayerPosition(deltaTime) {
  if (isDead) return;

  let moveX = 0;
  let moveY = 0;
  let speed = player.speed;

  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;
  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;
  const wantsToSprint = keys[" "];
  // Normalize diagonal movement
  if (moveX !== 0 && moveY !== 0) {
    const norm = Math.sqrt(2) / 2;
    moveX *= norm;
    moveY *= norm;
  }
  
  if (stamina < 10 * deltaTime) {
    showMessage("Low Stamina");
  }
  if (wantsToSprint && stamina > 0) {
    
    speed *= 1.5;
    stamina -= 20 * deltaTime; // Deplete 10 stamina per second
    lastStaminaUseTime = 0;
    
  }
  const newX = player.x + moveX * speed * deltaTime;
  const newY = player.y + moveY * speed * deltaTime;

  

  // Check X axis separately
  if (!isCollidingWithResources(newX, player.y)) {
    player.x = newX;
  }

  // Check Y axis separately
  if (!isCollidingWithResources(player.x, newY)) {
    player.y = newY;
  }



  sendPlayerPosition(player.x, player.y);


  // Clamp within canvas
  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.size, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.size, player.y));
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
}

lastStaminaUseTime = 0;

function staminaRegen(deltaTime)
{
  lastStaminaUseTime += deltaTime;
  
  if (lastStaminaUseTime >= 0.5){
    stamina = Math.min(maxStamina, stamina + staminaRegenSpeed * deltaTime);

  }
  
  if (stamina < 0) stamina = 0;
  
}

let maxHunger = 100;
let hunger = 100;

function consumeFood() {
  if (!player || isDead) return;
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (selected?.type === "food" && inventory.hasItem("food", 1) && player.hunger < player.maxHunger) {
    inventory.removeItem("food", 1); // Automatically updates hotbar
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

  // Draw background
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Draw current hunger
  const hungerRatio = player.hunger / player.maxHunger;
  ctx.fillStyle = "orange";
  ctx.fillRect(barX, barY, barWidth * hungerRatio, barHeight);
}
function drawHealthbar(startX, hotbarY) {
  const barWidth = totalWidth / 2.5;
  const barHeight = 10;
  const barX = startX;
  const barY = hotbarY - barHeight - padding;

  // Draw background
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Draw current hunger
  const healthRatio = player.health / player.maxHealth;
  ctx.fillStyle = "green";
  ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
}

function updatePlayerFacing(mouseX, mouseY) {
  // Convert mouse screen coordinates to world coordinates
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

function drawPlayer() {
  if (!player || isDead) return;

  // Draw player body
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);

  //draw border around mob
  ctx.strokeStyle = "white";
  ctx.strokeRect(player.x, player.y, player.size, player.size);

  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const coneLength = CONE_LENGTH;
  const coneAngle = Math.PI / 4;



  // Draw center-facing line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(player.facingAngle) * coneLength,
    centerY + Math.sin(player.facingAngle) * coneLength
  );
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.stroke();


  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(player.facingAngle - coneAngle / 2) * coneLength,
    centerY + Math.sin(player.facingAngle - coneAngle / 2) * coneLength
  );
  ctx.arc(
    centerX,
    centerY,
    coneLength,
    player.facingAngle - coneAngle / 2,
    player.facingAngle + coneAngle / 2
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
  ctx.fill();


  // ✅ Draw player name
  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player.name || "You", centerX, player.y - 10);

  drawTool();

}



function drawTool() {
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (!selected) return;

  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;

  let toolColor = null;

  if (selected.type === "axe") {
    toolColor = "sienna"; // Axe color
  } else if (selected.type === "wooden_pickaxe") {
    toolColor = "gray"; // Pickaxe color
  }
  const toolLength = 20;
  if (toolColor) {
    const offsetX = centerX  + Math.cos(player.facingAngle) * (player.size / 2 + toolLength / 2);
    const offsetY = centerY + Math.sin(player.facingAngle) * (player.size / 2 + toolLength / 2);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.rotate(player.facingAngle);
    ctx.fillStyle = toolColor;
    ctx.fillRect(-2, -toolLength / 2, 4, toolLength);
    ctx.restore();
  }
}




function gainXP(amount) {
  player.xp += amount;

  // Level up if enough XP
  while (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level++;
    player.xpToNextLevel = Math.floor(player.xpToNextLevel * 2);
    socket.emit("playerLeveledUp", {
      id: socket.id,
      level: player.level
    });

    // Optional: level-up effect
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

    if (p.lastHitTime && now - p.lastHitTime < 1000) {
      drawHealthBarP(p);
    }
  }
}

function drawHealthBarP(p) {
  ctx.save();
  const maxHealth = p.maxHealth || 100;
  const hpPercent = Math.max(p.health / maxHealth, 0);
  const barWidth = p.size || 20;
  const barHeight = 5;
  const padding = 2;

  const x = p.x + barWidth / 2 - barWidth / 2; // center horizontally (simplify)
  const y = p.y - barHeight - padding;

  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth , barHeight);

  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
  ctx.restore();
}


function drawStaminaBar() {
  
  const barWidth = canvas.width;
  const barHeight = 10;
  const barX = 0; // start at the left edge
  const barY = canvas.height - barHeight; // position at the bottom

  // Draw background
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Draw current stamina
  const staminaRatio = stamina / maxStamina;
  ctx.fillStyle = "yellow";
  ctx.fillRect(barX, barY, barWidth * staminaRatio, barHeight);
}

socket.on("updatePlayerHealth", ({ id, health }) => {
  if (otherPlayers[id]) {
    otherPlayers[id].health = health;
  }
});

function tryAttack() {
  if (!player) return; // Safety check

  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";
  const swordTypes = ["wooden_sword", "stone_sword", "iron_sword", "gold_sword","hand"];

  if (!toolDamage[selectedTool]) {
    selectedTool = "hand";
  }

  

  const coneLength = CONE_LENGTH + 20;
  const coneAngle = Math.PI / 4;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;

  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    if (p.isDead) continue; // Skip dead players
    const px = p.x + p.size / 2;
    const py = p.y + p.size / 2;
    if (p.size > 0 && pointInCone(px, py, centerX, centerY, player.facingAngle, coneAngle, coneLength)) {
      if (!swordTypes.includes(selectedTool)) {
        showMessage("This tool is not effective.");
        return;
      }
      const damage = toolDamage[selectedTool] || toolDamage.hand;
      const cost = 10;
      if (stamina < cost) {
        showMessage("Low Stamina");
        return;
      }
      stamina -= cost;
      lastStaminaUseTime = 0;
      p.health -= damage; // Local update for immediate feedback
      socket.emit("playerhit", {
        targetId: id,
        newHealth: Math.max(0, p.health), // Ensure health doesn't go below 0
      });
      showDamageText(px, py, -damage);
      otherPlayers[id].lastHitTime = performance.now();
      return; // Hit one target per attack
    }
  }
}

