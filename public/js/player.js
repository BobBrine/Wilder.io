let otherPlayers = {};

let player = null;

const CONE_LENGTH = 50;

function updatePlayerPosition() {
  let moveX = 0;
  let moveY = 0;

  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;
  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;

  // Normalize diagonal movement
  if (moveX !== 0 && moveY !== 0) {
    const norm = Math.sqrt(2) / 2;
    moveX *= norm;
    moveY *= norm;
  }

  const newX = player.x + moveX * player.speed;
  const newY = player.y + moveY * player.speed;

  

 // Check X axis separately
if (!isCollidingWithResources(newX, player.y)) {
  player.x = newX;
}

// Check Y axis separately
if (!isCollidingWithResources(player.x, newY)) {
  player.y = newY;
}





  // Clamp within canvas
  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.size, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.size, player.y));
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
  if (!player) return;

  // Draw player body
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);

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
    player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.5);

    // Optional: level-up effect
    console.log(`Level Up! You are now level ${player.level}`);
  }
}

function drawOtherPlayers() {
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';

  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    if (!p) continue;
    const screenX = p.x;
    const screenY = p.y;


    ctx.fillStyle = 'blue';
    ctx.fillRect(screenX, screenY, p.size || 20, p.size || 20); 

    ctx.fillStyle = 'white';
    const centerX = screenX + (p.size || 20) / 2;
    ctx.fillText(p.name || 'Unnamed', centerX, screenY - 10);
  }
}

