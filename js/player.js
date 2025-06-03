


const player = {
  x: Math.random() * (WORLD_WIDTH - 20),
  y: Math.random() * (WORLD_HEIGHT - 20),
  size: 20,
  color: "lime",
  speed: 3,
  facingAngle: 0,
  level: 1,
  xp: 0,
  xpToNextLevel: 10,

};



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


/*
function updatePlayerFacing(mouseX, mouseY) {
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  player.facingAngle = Math.atan2(mouseY - centerY, mouseX - centerX);
}
*/

function updatePlayerFacing(mouseX, mouseY) {
  // Convert mouse screen coordinates to world coordinates
  const worldMouseX = mouseX + camera.x;
  const worldMouseY = mouseY + camera.y;

  const dx = worldMouseX - player.x;
  const dy = worldMouseY - player.y;

  player.facingAngle = Math.atan2(dy, dx);
}



function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);

  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const lineLength = 30;
  const endX = centerX + Math.cos(player.facingAngle) * lineLength;
  const endY = centerY + Math.sin(player.facingAngle) * lineLength;

  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Draw interaction cone
  ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  const coneLength = 50;
  const coneAngle = Math.PI / 4;
  ctx.lineTo(centerX + Math.cos(player.facingAngle - coneAngle / 2) * coneLength, centerY + Math.sin(player.facingAngle - coneAngle / 2) * coneLength);
  ctx.arc(centerX, centerY, coneLength, player.facingAngle - coneAngle / 2, player.facingAngle + coneAngle / 2);
  ctx.lineTo(centerX, centerY);
  ctx.fill();
  
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




function isCollidingWithObjects(objects, newX, newY, objectSize = 30) {
  return objects.some(obj => {
    if (obj.size <= 0) return false;
    return (
      newX < obj.x + objectSize &&
      newX + player.size > obj.x &&
      newY < obj.y + objectSize &&
      newY + player.size > obj.y
    );
  });
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

for (let id in otherPlayers) {
    const p = otherPlayers[id];
    ctx.fillStyle = "blue";
    ctx.fillRect(p.x, p.y, 20, 20);
  }