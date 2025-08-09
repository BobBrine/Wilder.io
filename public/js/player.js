// Existing variables
let otherPlayers = {};
let player = null;
let maxStamina = 0;
let stamina = 0;
let staminaRegenSpeed = 0;
const DEFAULT_ATTACK_RANGE = 50;
const ATTACK_ANGLE = Math.PI / 2; // 90 degrees
let punchHand = 'right'; // 'left' or 'right'
// Knockback variables
let knockback = { active: false, vx: 0, vy: 0, timer: 0 };
const KNOCKBACK_DURATION = 0.2; // seconds
const KNOCKBACK_FORCE = 350; // pixels/sec

// Load player image
const playerImage = new Image();
playerImage.src = "/Player1.png"; // Adjust the path if needed
let playerImageLoaded = false;
playerImage.onload = () => {
  playerImageLoaded = true;
};

// Load hand image
const handImage = new Image();
handImage.src = "/hand.png";
let handImageLoaded = false;
handImage.onload = () => {
  handImageLoaded = true;
};

// Load sword image
const swordImage = new Image();
swordImage.src = 'wooden_sword.png'; // Adjust path as needed

// Load pickaxe image
const wooden_pickaxe_Image = new Image();
wooden_pickaxe_Image.src = 'wooden_pickaxe.png'; // Adjust path as needed
let pickaxeImageLoaded = false;
wooden_pickaxe_Image.onload = () => {
  pickaxeImageLoaded = true;
};

// Load axe image
const wooden_axe_Image = new Image();
wooden_axe_Image.src = 'wooden_axe.png'; // Adjust path as needed
let axeImageLoaded = false;
wooden_axe_Image.onload = () => {
  axeImageLoaded = true;
};

// New variables for attack animation
let isAttacking = false;
let attackStartTime = 0;

// Use per-tool or per-hand attack speed
function getAttackSpeed() {
  const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
  if (selected && ItemTypes[selected.type] && ItemTypes[selected.type].attackSpeed) {
    return ItemTypes[selected.type].attackSpeed;
  }
  // Hand attack speed fallback
  if (ItemTypes.hand && ItemTypes.hand.attackSpeed) {
    return ItemTypes.hand.attackSpeed;
  }
  return 0.35; // fallback default
}

function sendPlayerPosition(x, y) {
  if (window.socket && window.socket.connected) {
    window.socket.emit('move', { x, y });
  }
}

function updatePlayerPosition(deltaTime) {
  if (isDead || !player) return;
  if (typeof keys === 'undefined') return;

  // Knockback physics
  if (knockback.active && player) {
      // Desired movement this frame from knockback
      let kdx = knockback.vx * deltaTime;
      let kdy = knockback.vy * deltaTime;

      // Collision aware move: attempt full, then axis, then damp/stop
      function isCollidingAt(x, y) {
        return (typeof isCollidingWithResources === 'function' && 
                isCollidingWithResources(x, y, player.size, player.size, allResources)) ||
               (typeof isCollidingWithMobs === 'function' && 
                isCollidingWithMobs(x, y, player.size, player.size, mobs));
      }

      const attemptX = player.x + kdx;
      const attemptY = player.y + kdy;
      if (!isCollidingAt(attemptX, attemptY)) {
        player.x = attemptX;
        player.y = attemptY;
      } else {
        // Try X only
        if (!isCollidingAt(attemptX, player.y)) {
          player.x = attemptX;
          // damp Y velocity if blocked
          knockback.vy *= 0.4;
        } else if (!isCollidingAt(player.x, attemptY)) {
          player.y = attemptY;
          knockback.vx *= 0.4;
        } else {
          // Fully blocked: cancel knockback
          knockback.active = false;
          knockback.vx = 0;
          knockback.vy = 0;
        }
      }

      // Apply friction/damping each frame
      const damping = 6; // higher = stops faster
      const speedBefore = Math.hypot(knockback.vx, knockback.vy);
      const speedAfter = Math.max(0, speedBefore - damping * speedBefore * deltaTime);
      if (speedBefore > 0) {
        const scale = speedAfter / speedBefore;
        knockback.vx *= scale;
        knockback.vy *= scale;
      }

      knockback.timer -= deltaTime;
      if (knockback.timer <= 0 || speedAfter < 5) {
        knockback.active = false;
        knockback.vx = 0;
        knockback.vy = 0;
      }
  }
  
  let moveX = 0, moveY = 0;
  let speed = player.speed || 0;
  
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
  
  const dx = moveX * speed * deltaTime;
  const dy = moveY * speed * deltaTime;
  
  // New multi-axis collision resolution with sliding
  let newX = player.x;
  let newY = player.y;
  
  // Helper function for collision detection
  function isCollidingAt(x, y) {
    return (typeof isCollidingWithResources === 'function' && 
            isCollidingWithResources(x, y, player.size, player.size, allResources)) ||
           (typeof isCollidingWithMobs === 'function' && 
            isCollidingWithMobs(x, y, player.size, player.size, mobs));
  }
  
  // Try full movement first
  if (!isCollidingAt(player.x + dx, player.y + dy)) {
    newX += dx;
    newY += dy;
  } 
  else {
    // Calculate separate axis movements
    const canMoveX = !isCollidingAt(player.x + dx, player.y);
    const canMoveY = !isCollidingAt(player.x, player.y + dy);
    
    // Handle both axes separately with sliding
    if (canMoveX) {
      newX += dx;
      // Try sliding along Y-axis if X-movement causes collision
      if (isCollidingAt(newX, newY) && !canMoveY) {
        for (let fraction = 0.9; fraction > 0.1; fraction -= 0.2) {
          const slideY = dy * fraction;
          if (!isCollidingAt(newX, player.y + slideY)) {
            newY = player.y + slideY;
            break;
          }
        }
      }
    }
    
    if (canMoveY) {
      newY += dy;
      // Try sliding along X-axis if Y-movement causes collision
      if (isCollidingAt(newX, newY) && !canMoveX) {
        for (let fraction = 0.9; fraction > 0.1; fraction -= 0.2) {
          const slideX = dx * fraction;
          if (!isCollidingAt(player.x + slideX, newY)) {
            newX = player.x + slideX;
            break;
          }
        }
      }
    }
    
    // Handle case where both axes are blocked
    if (!canMoveX && !canMoveY) {
      // Try reduced movement in primary direction
      const primaryAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      for (let fraction = 0.9; fraction > 0.1; fraction -= 0.2) {
        if (primaryAxis === "x") {
          if (!isCollidingAt(player.x + dx * fraction, player.y)) {
            newX = player.x + dx * fraction;
            break;
          }
        } else {
          if (!isCollidingAt(player.x, player.y + dy * fraction)) {
            newY = player.y + dy * fraction;
            break;
          }
        }
      }
    }
  }
  
  // Apply movement if valid
  if (!isCollidingAt(newX, newY)) {
    player.x = newX;
    player.y = newY;
  }
  
  // World boundaries
  player.x = Math.max(0, Math.min(WORLD_SIZE - player.size, player.x));
  player.y = Math.max(0, Math.min(WORLD_SIZE - player.size, player.y));
  
  sendPlayerPosition(player.x, player.y);
  
  // Item pickup logic (unchanged)
  if (player && typeof droppedItems !== 'undefined' && typeof inventory !== 'undefined') {
    const playerCenterX = player.x + player.size / 2;
    const playerCenterY = player.y + player.size / 2;
    droppedItems.forEach(item => {
      const dx = playerCenterX - item.x;
      const dy = playerCenterY - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 26 && item.pickupDelay <= 0 && inventory.canAddItem && inventory.canAddItem(item.type)) {
        if (window.socket && window.socket.connected) window.socket.emit("pickupItem", item.id);
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
  if (!player || isDead || typeof hotbar === 'undefined' || typeof inventory === 'undefined') return;
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (selected?.type === "food" && inventory.hasItem && inventory.hasItem("food", 1) && player.hunger < player.maxHunger) {
    inventory.removeItem("food", 1);
    if (window.socket && window.socket.connected) window.socket.emit("consumeFood", { amount: 1 });
    if (typeof showMessage === 'function') showMessage("Ate food, hunger restored!");
  } else if (selected?.type === "food" && player.hunger >= player.maxHunger) {
    if (typeof showMessage === 'function') showMessage("You are not hungry!");
  } else {
    if (typeof showMessage === 'function') showMessage("No food selected!");
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

function drawPlayer() {
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  
  if (!player || isDead || typeof ctx === 'undefined') return;
  // Enable high-quality image smoothing for cleaner rotations
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Determine attack range from selected tool or default
  let attackRange = DEFAULT_ATTACK_RANGE;
  const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
  // Debug: log hotbar and selected slot
  if (window._debugHotbarSlots !== JSON.stringify(hotbar.slots) || window._debugSelectedIndex !== hotbar.selectedIndex) {
    window._debugHotbarSlots = JSON.stringify(hotbar.slots);
    window._debugSelectedIndex = hotbar.selectedIndex;
  }
  if (selected && ItemTypes[selected.type] && ItemTypes[selected.type].isTool && ItemTypes[selected.type].attackRange) {
    attackRange = ItemTypes[selected.type].attackRange;
  }
  // Debug: log attackRange to verify cone length changes
  if (window._debugAttackRange !== attackRange) {
    window._debugAttackRange = attackRange;
  }

  // Draw attack cone if attacking
  if (isAttacking) {
    ctx.save();
    const now = performance.now();
    const attackSpeed = getAttackSpeed();
    const attackProgress = Math.min((now - attackStartTime) / (attackSpeed * 1000), 1);
    const startAngle = player.facingAngle - ATTACK_ANGLE / 2;
    const currentAngle = startAngle + attackProgress * ATTACK_ANGLE;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(startAngle) * attackRange,
      centerY + Math.sin(startAngle) * attackRange
    );
    ctx.arc(centerX, centerY, attackRange, startAngle, currentAngle);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
    ctx.fill();
    ctx.restore();
    if (attackProgress >= 1) {
      isAttacking = false;
    }
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(player.facingAngle - ATTACK_ANGLE / 2) * attackRange,
      centerY + Math.sin(player.facingAngle - ATTACK_ANGLE / 2) * attackRange
    );
    ctx.arc(centerX, centerY, attackRange, player.facingAngle - ATTACK_ANGLE / 2, player.facingAngle + ATTACK_ANGLE / 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
    ctx.fill();
    ctx.restore();
  }

  // Draw left hand
  if (handImageLoaded) {
    const handScale = player.size / 32;
    let handXOffset = player.size * 0.75;
    let handYOffset = -player.size * 0.55;
    let handAngle = -Math.PI / 8;
    const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.facingAngle + Math.PI / 2);
    ctx.rotate(handAngle);
    let localX = -handXOffset;
    let localY = handYOffset;
    let moveBack = false;
    if (selected && ItemTypes[selected.type] && isAttacking) {
      moveBack = true;
    } else if (!selected && isAttacking) {
      if (punchHand === 'left') {
        const now = performance.now();
        const attackSpeed = getAttackSpeed();
        const attackDuration = attackSpeed * 1000;
        let attackProgress = (now - attackStartTime) / attackDuration;
        function bezier(t, p0, p1, p2) {
          return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
        }
        const startX = -handXOffset;
        const startY = handYOffset;
        const punchLength = attackRange - 10;
        const angleOffset = Math.PI / 18;
        const cosA = Math.cos(angleOffset);
        const sinA = Math.sin(angleOffset);
        let rawEndX = -player.size * 0.03;
        let rawEndY = -punchLength;
        let rawControlX = -handXOffset * 0.07;
        let rawControlY = -punchLength * 0.99;
        const endX = rawEndX * cosA - rawEndY * sinA;
        const endY = rawEndX * sinA + rawEndY * cosA;
        const controlX = rawControlX * cosA - rawControlY * sinA;
        const controlY = rawControlX * sinA + rawControlY * cosA;
        if (attackProgress <= 0.5) {
          const t = attackProgress / 0.5;
          localX = bezier(t, startX, controlX, endX);
          localY = bezier(t, startY, controlY, endY);
        } else {
          const t = (attackProgress - 0.5) / 0.5;
          localX = bezier(1 - t, startX, controlX, endX);
          localY = bezier(1 - t, startY, controlY, endY);
        }
      } else if (punchHand === 'right') {
        moveBack = true;
      }
    }
    if (moveBack) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      const attackProgress = Math.min((now - attackStartTime) / attackDuration, 1);
      const backAmount = player.size * 0.25 * Math.sin(Math.PI * attackProgress);
      localX = -handXOffset - backAmount;
      localY = handYOffset + backAmount * 0.5;
    }
    ctx.translate(localX, localY);
    ctx.drawImage(
      handImage,
      -handImage.width / 2 * handScale,
      -handImage.height / 2 * handScale,
      handImage.width * handScale,
      handImage.height * handScale
    );
    ctx.restore();
  }

  // Draw right hand with item/tool
  if (handImageLoaded) {
    const handScale = player.size / 32;
    let handXOffset = player.size * 0.8;
    let handYOffset = -player.size * 0.55;
    let handAngle = Math.PI / 8;
    const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.facingAngle + Math.PI / 2);
    ctx.rotate(handAngle);
    let localX = handXOffset;
    let localY = handYOffset;
    let animate = false;
    let counterMove = false;
    if (selected && isAttacking) {
      animate = true;
    } else if (!selected && isAttacking) {
      if (punchHand === 'right') animate = true;
      if (punchHand === 'left') counterMove = true;
    }
    if (animate) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      let attackProgress = (now - attackStartTime) / attackDuration;
      function bezier(t, p0, p1, p2) {
        return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
      }
      const startX = handXOffset;
      const startY = handYOffset;
      const punchLength = attackRange - 10;
      const angleOffset = -Math.PI / 18;
      const cosA = Math.cos(angleOffset);
      const sinA = Math.sin(angleOffset);
      let rawEndX = player.size * 0.03;
      let rawEndY = -punchLength;
      let rawControlX = handXOffset * 0.07;
      let rawControlY = -punchLength * 0.99;
      const endX = rawEndX * cosA - rawEndY * sinA;
      const endY = rawEndX * sinA + rawEndY * cosA;
      const controlX = rawControlX * cosA - rawControlY * sinA;
      const controlY = rawControlX * sinA + rawControlY * cosA;
      if (attackProgress <= 0.5) {
        const t = attackProgress / 0.5;
        localX = bezier(t, startX, controlX, endX);
        localY = bezier(t, startY, controlY, endY);
      } else {
        const t = (attackProgress - 0.5) / 0.5;
        localX = bezier(1 - t, startX, controlX, endX);
        localY = bezier(1 - t, startY, controlY, endY);
      }
    } else if (counterMove) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      const attackProgress = Math.min((now - attackStartTime) / attackDuration, 1);
      const backAmount = player.size * 0.25 * Math.sin(Math.PI * attackProgress);
      localX = handXOffset + backAmount;
      localY = handYOffset + backAmount * 0.5;
    }
    ctx.translate(localX, localY);
    if (selected && ItemTypes[selected.type]) {
      if (ItemTypes[selected.type].isTool && selected.type === 'wooden_sword' && swordImage.complete) {
        const scale = 1.25;
        const imgWidth = swordImage.width * scale;
        const imgHeight = swordImage.height * scale;
        ctx.save();
        let swordAngle = Math.PI * 1.5 + Math.PI / 8;
        if (isAttacking) {
          const now = performance.now();
          const attackSpeed = getAttackSpeed();
          const attackDuration = attackSpeed * 1000;
          let attackProgress = (now - attackStartTime) / attackDuration;
          if (attackProgress > 1) attackProgress = 1;
          swordAngle -= (Math.PI / 2) * (1 - attackProgress);
        }
        ctx.rotate(swordAngle);
        const swordOffsetX = 10;
        const swordOffsetY = 6;
        ctx.translate(swordOffsetX, swordOffsetY);
        ctx.drawImage(
          swordImage,
          -imgWidth / 2,
          -imgHeight,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else if (ItemTypes[selected.type].isTool && selected.type === 'wooden_pickaxe' && pickaxeImageLoaded) {
        const scale = 1.25;
        const imgWidth = wooden_pickaxe_Image.width * scale;
        const imgHeight = wooden_pickaxe_Image.height * scale;
        ctx.save();
        let pickaxeAngle = Math.PI * 1.5 + Math.PI / 8;
        if (isAttacking) {
          const now = performance.now();
          const attackSpeed = getAttackSpeed();
          const attackDuration = attackSpeed * 1000;
          let attackProgress = (now - attackStartTime) / attackDuration;
          if (attackProgress > 1) attackProgress = 1;
          pickaxeAngle -= (Math.PI / 2) * (1 - attackProgress);
        }
        ctx.rotate(pickaxeAngle);
        const pickaxeOffsetX = 10;
        const pickaxeOffsetY = 6;
        ctx.translate(pickaxeOffsetX, pickaxeOffsetY);
        ctx.drawImage(
          wooden_pickaxe_Image,
          -imgWidth / 2,
          -imgHeight,
          imgWidth,
          imgHeight
        );
        ctx.restore();
        } else if (ItemTypes[selected.type].isTool && selected.type === 'wooden_axe' && axeImageLoaded) {
          const scale = 1.25;
          const imgWidth = wooden_axe_Image.width * scale;
          const imgHeight = wooden_axe_Image.height * scale;
          ctx.save();
          let axeAngle = Math.PI * 1.5 + Math.PI / 8;
          if (isAttacking) {
            const now = performance.now();
            const attackSpeed = getAttackSpeed();
            const attackDuration = attackSpeed * 1000;
            let attackProgress = (now - attackStartTime) / attackDuration;
            if (attackProgress > 1) attackProgress = 1;
            axeAngle -= (Math.PI / 2) * (1 - attackProgress);
          }
          ctx.rotate(axeAngle);
          const axeOffsetX = 10;
          const axeOffsetY = 6;
          ctx.translate(axeOffsetX, axeOffsetY);
          ctx.drawImage(
            wooden_axe_Image,
            -imgWidth / 2,
            -imgHeight,
            imgWidth,
            imgHeight
          );
          ctx.restore();
      } else {
        ctx.save();
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = ItemTypes[selected.type].color || 'gray';
        ctx.fillRect(-6, -24, 12, 48);
        ctx.restore();
      }
    }
    ctx.drawImage(
      handImage,
      -handImage.width / 2 * handScale,
      -handImage.height / 2 * handScale,
      handImage.width * handScale,
      handImage.height * handScale
    );
    ctx.restore();
  }

  // Draw player body
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(player.facingAngle + Math.PI / 2);
  if (playerImageLoaded) {
    ctx.drawImage(
      playerImage,
      -player.size / 2,
      -player.size / 2,
      player.size,
      player.size
    );
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, player.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = player.color || 'blue';
    ctx.fill();
    ctx.closePath();
  }
  // Draw hit overlay if not fully transparent
  if (player.color && !player.color.endsWith(", 0)")) {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(0, 0, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player.name || "You", centerX, player.y - 10);
}

function drawTool() {
  if (typeof hotbar === 'undefined' || typeof ItemTypes === 'undefined' || typeof ctx === 'undefined' || !player) return;
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (!selected || !ItemTypes[selected.type] || !ItemTypes[selected.type].isTool) return;

  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const toolLength = 20;

  let toolAngle = player.facingAngle;

  if (isAttacking) {
    const now = performance.now();
    const attackSpeed = getAttackSpeed();
    const attackProgress = Math.min((now - attackStartTime) / (attackSpeed * 1000), 1);
    const startAngle = player.facingAngle - ATTACK_ANGLE / 2;
    toolAngle = startAngle + attackProgress * ATTACK_ANGLE;
  }

  const handScale = player.size / 32;
  const handXOffset = player.size * 0.95;
  const handYOffset = -player.size * 0.55;
  const handLocalX = -handImage.width / 2 * handScale + handXOffset;
  const handLocalY = -handImage.height / 2 * handScale + handYOffset;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(player.facingAngle + Math.PI / 2);
  ctx.rotate(Math.PI / 8);
  ctx.translate(handLocalX, handLocalY);
  ctx.rotate(toolAngle - player.facingAngle);
  if (selected.type === 'wooden_sword' && swordImage.complete) {
    const scale = 1.25;
    const imgWidth = swordImage.width * scale;
    const imgHeight = swordImage.height * scale;
    ctx.save();
    ctx.rotate(Math.PI * 1.5 + Math.PI / 8);
    ctx.drawImage(
      swordImage,
      -imgWidth / 2,
      -imgHeight * 0.82,
      imgWidth,
      imgHeight
    );
    ctx.restore();
  } else if (selected.type === 'wooden_pickaxe' && pickaxeImageLoaded) {
    const scale = 1.25;
    const imgWidth = wooden_pickaxe_Image.width * scale;
    const imgHeight = wooden_pickaxe_Image.height * scale;
    ctx.save();
    ctx.rotate(Math.PI * 1.5 + Math.PI / 8);
    ctx.drawImage(
      wooden_pickaxe_Image,
      -imgWidth / 2,
      -imgHeight * 0.82,
      imgWidth,
      imgHeight
    );
    ctx.restore();
  } else {
    ctx.fillStyle = ItemTypes[selected.type].color || 'gray';
    ctx.fillRect(-2, -toolLength / 2, 4, toolLength);
  }
  ctx.restore();
}

function gainXP(amount) {
  if (!player) return;
  player.xp += amount;
  while (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level++;
    player.xpToNextLevel = Math.floor(player.xpToNextLevel * 2);
    if (window.socket && window.socket.connected) window.socket.emit("playerLeveledUp", { id: window.socket.id, level: player.level });
    if (typeof showMessage === 'function') showMessage(`Level Up! You are now level ${player.level}`);
  }
}

function drawOtherPlayers() {
  if (typeof ctx === 'undefined' || typeof otherPlayers === 'undefined') return;
  const now = performance.now();
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';
  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    if (!p) continue;
    const screenX = p.x;
    const screenY = p.y;
    ctx.fillStyle = 'green';
    ctx.fillRect(screenX, screenY, p.size || 20, p.size || 20);
    ctx.fillStyle = 'white';
    const centerX = screenX + (p.size || 20) / 2;
    ctx.fillText(p.name || 'Unnamed', centerX, screenY - 10);
    if (p.health < p.maxHealth) drawHealthBarP(p);
  }
}

function drawHealthBarP(p) {
  if (typeof ctx === 'undefined' || !p) return;
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
  if (typeof canvas === 'undefined' || typeof ctx === 'undefined') return;
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

if (typeof socket !== "undefined" && socket) {
  socket.on("updatePlayerHealth", ({ id, health }) => {
    if (otherPlayers[id]) otherPlayers[id].health = health;
  });
}

function tryAttack() {
  if (!player || typeof hotbar === 'undefined' || typeof ItemTypes === 'undefined' || typeof otherPlayers === 'undefined') return;
  punchHand = (punchHand === 'right') ? 'left' : 'right';
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = (selected && selected.type) ? selected.type : "hand";
  const toolInfo = ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool ? ItemTypes[selectedTool] : { category: "hand", tier: 0, damage: 1, attackRange: DEFAULT_ATTACK_RANGE };
  const swordTypes = ["hand", "sword"];
  const coneLength = toolInfo.attackRange || DEFAULT_ATTACK_RANGE;
  const coneAngle = ATTACK_ANGLE;
  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    if (!p || p.isDead) continue;
    const px = p.x;
    const py = p.y;
    if (p.size > 0 && isObjectInAttackCone(player, p, coneLength, coneAngle)) {
      if (!swordTypes.includes(toolInfo.category)) {
        if (typeof showMessage === 'function') showMessage("This tool is not effective.");
        return;
      }
      const damage = toolInfo.damage;
      const cost = 10;
      if (stamina < cost) {
        if (typeof showMessage === 'function') showMessage("Low Stamina");
        return;
      }
      stamina -= cost;
      lastStaminaUseTime = 0;
      p.health -= damage;
      if (window.socket && window.socket.connected) window.socket.emit("playerhit", { targetId: id, newHealth: Math.max(0, p.health) });
      if (typeof showDamageText === 'function') showDamageText(px, py, -damage);
      otherPlayers[id].lastHitTime = performance.now();
    }
  }
}

function isObjectInAttackCone(player, object, coneLength, ATTACK_ANGLE) {
  const playerCenterX = player.x + player.size / 2;
  const playerCenterY = player.y + player.size / 2;
  const isRectangle = object.sizeX !== undefined && object.sizeY !== undefined;
  const isCircle = object.radius !== undefined;
  
  // 1. Check if player is INSIDE the object
  if (isCircle) {
    const dx = playerCenterX - object.x;
    const dy = playerCenterY - object.y;
    if (Math.sqrt(dx * dx + dy * dy) <= object.radius) {
      return true;
    }
  } else if (isRectangle) {
    if (playerCenterX >= object.x && playerCenterX <= object.x + object.sizeX &&
        playerCenterY >= object.y && playerCenterY <= object.y + object.sizeY) {
      return true;
    }
  } else { // Square (uses object.size)
    if (playerCenterX >= object.x && playerCenterX <= object.x + object.size &&
        playerCenterY >= object.y && playerCenterY <= object.y + object.size) {
      return true;
    }
  }

  // 2. Circle or Square: Center check with angular allowance
  if (!isRectangle) {
    const objectCenterX = isCircle ? object.x : object.x + object.size / 2;
    const objectCenterY = isCircle ? object.y : object.y + object.size / 2;
    const objectRadius = isCircle ? object.radius : object.size / 2;

    const dx = objectCenterX - playerCenterX;
    const dy = objectCenterY - playerCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= coneLength + objectRadius) {
      const angleToObject = Math.atan2(dy, dx);
      let angleDiff = normalizeAngle(angleToObject - player.facingAngle);
      let angularAllowance = distance > 0 ? Math.asin(objectRadius / distance) : 0;
      if (Math.abs(angleDiff) <= ATTACK_ANGLE / 2 + angularAllowance) {
        return true;
      }
    }
  }

  // 3. Rectangle: Full coverage checks
  if (isRectangle) {
    const objectCenterX = object.x + object.sizeX / 2;
    const objectCenterY = object.y + object.sizeY / 2;
    const corners = [
      { x: object.x, y: object.y },
      { x: object.x + object.sizeX, y: object.y },
      { x: object.x + object.sizeX, y: object.y + object.sizeY },
      { x: object.x, y: object.y + object.sizeY }
    ];

    // Corner checks
    for (const corner of corners) {
      const dx = corner.x - playerCenterX;
      const dy = corner.y - playerCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= coneLength) {
        const angle = Math.atan2(dy, dx);
        const angleDiff = normalizeAngle(angle - player.facingAngle);
        if (Math.abs(angleDiff) <= ATTACK_ANGLE / 2) {
          return true;
        }
      }
    }

    // Center point check
    const dxCenter = objectCenterX - playerCenterX;
    const dyCenter = objectCenterY - playerCenterY;
    const distanceCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
    if (distanceCenter <= coneLength) {
      const angleCenter = Math.atan2(dyCenter, dxCenter);
      const angleDiffCenter = normalizeAngle(angleCenter - player.facingAngle);
      if (Math.abs(angleDiffCenter) <= ATTACK_ANGLE / 2) {
        return true;
      }
    }

    // Edge-Ray intersections
    const rayAngles = [
      player.facingAngle - ATTACK_ANGLE / 2,
      player.facingAngle + ATTACK_ANGLE / 2
    ];
    const rayEnds = rayAngles.map(angle => ({
      x: playerCenterX + coneLength * Math.cos(angle),
      y: playerCenterY + coneLength * Math.sin(angle)
    }));

    for (let i = 0; i < corners.length; i++) {
      const edgeStart = corners[i];
      const edgeEnd = corners[(i + 1) % corners.length];
      
      for (const rayEnd of rayEnds) {
        if (doSegmentsIntersect(
          playerCenterX, playerCenterY, rayEnd.x, rayEnd.y,
          edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y
        )) {
          return true;
        }
      }
    }

    // Edge-Arc overlap (simplified)
    for (let i = 0; i < corners.length; i++) {
      const edgeStart = corners[i];
      const edgeEnd = corners[(i + 1) % corners.length];
      if (isEdgeIntersectingArc(
        edgeStart, edgeEnd, playerCenterX, playerCenterY, coneLength, 
        player.facingAngle, ATTACK_ANGLE
      )) {
        return true;
      }
    }
  }

  return false;
}

// Helper: Normalize angle to [-π, π]
function normalizeAngle(angle) {
  angle = angle % (2 * Math.PI);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// Helper: Segment-segment intersection
function doSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// Helper: Edge-arc overlap (simplified)
function isEdgeIntersectingArc(edgeStart, edgeEnd, cx, cy, radius, facingAngle, attackAngle) {
  // Check if edge endpoints are beyond the arc
  const startDist = Math.hypot(edgeStart.x - cx, edgeStart.y - cy);
  const endDist = Math.hypot(edgeEnd.x - cx, edgeEnd.y - cy);
  if (startDist > radius && endDist > radius) return false;

  // Check if edge midpoint is within the cone
  const midX = (edgeStart.x + edgeEnd.x) / 2;
  const midY = (edgeStart.y + edgeEnd.y) / 2;
  const dx = midX - cx;
  const dy = midY - cy;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) {
    const angle = Math.atan2(dy, dx);
    const angleDiff = normalizeAngle(angle - facingAngle);
    if (Math.abs(angleDiff) <= attackAngle / 2) {
      return true;
    }
  }
  return false;
}

window.sendPlayerPosition = sendPlayerPosition;
window.consumeFood = consumeFood;
window.tryAttack = tryAttack;
window.applyKnockbackFromMob = applyKnockbackFromMob;

// Called when mob hits player
function applyKnockbackFromMob(mob) {
  if (!player || !mob) return;
  const dx = player.x - mob.x;
  const dy = player.y - mob.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  knockback.vx = (dx / dist) * KNOCKBACK_FORCE;
  knockback.vy = (dy / dist) * KNOCKBACK_FORCE;
  knockback.timer = KNOCKBACK_DURATION;
  knockback.active = true;
}