// Existing variables
let player = {};
player = createNewPlayer();
const playersMap = { [player.id]: player };
// Slightly larger radius makes pickup feel snappier; keep in sync with server PICKUP_RADIUS
const PICKUP_RADIUS = 32;
let __lastPickupMsgAt = 0;
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
playerImage.src = "../images/Player1.png"; // Adjust the path if needed
let playerImageLoaded = false;
playerImage.onload = () => {
  playerImageLoaded = true;
};



// New variables for attack animation
let isAttacking = false;
let attackStartTime = 0;

// Use per-tool or per-hand attack speed
function getAttackSpeed() {
  if (!player) return 0.5;
  const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
  if (selected && ItemTypes[selected.type] && ItemTypes[selected.type].attackSpeed) {

    return Math.max(0.05, ItemTypes[selected.type].attackSpeed - player.playerattackspeed);
  }
  // Hand attack speed fallback
  if (ItemTypes.hand && ItemTypes.hand.attackSpeed) {
    return (Math.max(0.05, ItemTypes.hand.attackSpeed - player.playerattackspeed));
  }
  return (player.playerattackspeed); // fallback default
}



function updatePlayerPosition(deltaTime) {
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
                isCollidingWithMobs(x, y, player.size, player.size, mobs)) ||
               (typeof isCollidingWithBlocks === 'function' && 
                isCollidingWithBlocks(x, y, player.size, player.size));
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

  // Prefer mobile joystick axis when mode is mobile and joystick active
  const controlsMode = (typeof window !== 'undefined' && window.controlsSettings && window.controlsSettings.getMode && window.controlsSettings.getMode()) || 'pc';
  const hasMobile = controlsMode === 'mobile' && typeof window !== 'undefined' && window.mobileControls && window.mobileControls.isActive();
  if (hasMobile) {
    const axis = window.mobileControls.axis;
    moveX = axis.x;
    moveY = axis.y;
  } else {
    if (keys["a"]) moveX -= 1;
    if (keys["d"]) moveX += 1;
    if (keys["w"]) moveY -= 1;
    if (keys["s"]) moveY += 1;
  }
  
  let wantsToSprint = hasMobile ? false : keys[" "];
  // Mobile sprint button
  if (hasMobile && window.mobileControls && typeof window.mobileControls.isSprinting === 'function') {
    wantsToSprint = window.mobileControls.isSprinting();
  }
  const isMovingInput = (moveX !== 0 || moveY !== 0);
  if (!hasMobile && moveX !== 0 && moveY !== 0) {
    const norm = Math.sqrt(2) / 2;
    moveX *= norm;
    moveY *= norm;
  }
  
  // Only sprint (and drain stamina) when there's movement input
  if (wantsToSprint && isMovingInput && stamina > 0) {
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
                isCollidingWithMobs(x, y, player.size, player.size, mobs)) ||
               (typeof isCollidingWithBlocks === 'function' && 
                isCollidingWithBlocks(x, y, player.size, player.size));
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
  
  
  // Item pickup logic (unchanged)
  if (player && typeof droppedItems !== 'undefined' && typeof inventory !== 'undefined') {
    const playerCenterX = player.x + player.size / 2;
    const playerCenterY = player.y + player.size / 2;
    droppedItems.forEach(item => {
      const dx = playerCenterX - item.x;
      const dy = playerCenterY - item.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
    // Ignore client-side pickupDelay (server enforces true delay)
    const canAdd = inventory.canAddItem && inventory.canAddItem(item.type);
  if (distance < PICKUP_RADIUS && canAdd) {
      } else if (distance < PICKUP_RADIUS && !canAdd) {
        const now = Date.now();
        if (typeof showMessage === 'function' && now - __lastPickupMsgAt > 1200) {
          showMessage('Inventory full');
          __lastPickupMsgAt = now;
        }
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
    playConsume();
    inventory.removeItem("food", 1);
    if (typeof showMessage === 'function') showMessage("Ate food, hunger restored!");
  } else if (selected?.type === "food" && player.hunger >= player.maxHunger) {
    if (typeof showMessage === 'function') playCancel(); showMessage("You are not hungry!");
  } else {
    if (typeof showMessage === 'function') showMessage("No food selected!");
  }
}

function consumePotion(type) {
  if (!player || isDead || typeof hotbar === 'undefined' || typeof inventory === 'undefined') return;
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (selected?.type === type && inventory.hasItem && inventory.hasItem(type, 1)) {
    playConsume();
    inventory.removeItem(type, 1);
    if (typeof showMessage === 'function') showMessage(`Consumed ${ItemTypes[type].name}!`);
  } else {
    if (typeof showMessage === 'function') showMessage("No potion selected!");
  }
}


function drawHungerBar(startX, hotbarY) {
  ctx.save();
  const barWidth = totalWidth / 2.5;
  const barHeight = 10;
  const barX = startX + totalWidth - barWidth;
  const barY = hotbarY - barHeight - padding;
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  const hungerRatio = player.hunger / player.maxHunger;
  ctx.fillStyle = "orange";
  ctx.fillRect(barX, barY, barWidth * hungerRatio, barHeight);
  ctx.restore();
}

function drawHealthbar(startX, hotbarY) {
  ctx.save();
  const barWidth = totalWidth / 2.5;
  const barHeight = 10;
  const barX = startX;
  const barY = hotbarY - barHeight - padding;
  ctx.fillStyle = "gray";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  const healthRatio = player.health / player.maxHealth;
  ctx.fillStyle = "red";
  ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
  ctx.restore();
}

function updatePlayerFacing(mouseX, mouseY) {
  // On mobile joystick, face toward joystick vector when active; otherwise aim at mouse.
  const controlsMode = (typeof window !== 'undefined' && window.controlsSettings && window.controlsSettings.getMode && window.controlsSettings.getMode()) || 'pc';
  if (controlsMode === 'mobile' && typeof window !== 'undefined' && window.mobileControls) {
    const aim = (typeof window.mobileControls.aim === 'function') ? window.mobileControls.aim() : { active:false };
    if (aim && aim.active && typeof aim.angle === 'number') {
      // Mobile: right joystick controls face angle exclusively while held
      player.facingAngle = aim.angle;
    }
  } else {
    const worldMouseX = mouseX + camera.x;
    const worldMouseY = mouseY + camera.y;
    const dx = worldMouseX - player.x;
    const dy = worldMouseY - player.y;
    player.facingAngle = Math.atan2(dy, dx);
  }
}

function drawPlayer() {
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  
  // Enable high-quality image smoothing for cleaner rotations
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Determine attack range from selected tool or default
  let attackRange = DEFAULT_ATTACK_RANGE + player.playerrange;
  const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
  // Debug: log hotbar and selected slot
  if (window._debugHotbarSlots !== JSON.stringify(hotbar.slots) || window._debugSelectedIndex !== hotbar.selectedIndex) {
    window._debugHotbarSlots = JSON.stringify(hotbar.slots);
    window._debugSelectedIndex = hotbar.selectedIndex;
  }
  if (selected && ItemTypes[selected.type] && ItemTypes[selected.type].isTool && ItemTypes[selected.type].attackRange) {
    attackRange = ItemTypes[selected.type].attackRange + (player.playerrange);
  }
  // Debug: log attackRange to verify cone length changes
  if (window._debugAttackRange !== attackRange) {
    window._debugAttackRange = attackRange;
  }

  // Draw attack cone if attacking
  if (player.isAttacking) {
    const now = performance.now();
    const attackSpeed = getAttackSpeed();
    const attackProgress = Math.min(
      (now - (player.attackStartTime || 0)) / (attackSpeed * 1000), 1
    );
    const startAngle = player.facingAngle - ATTACK_ANGLE / 2;
    const currentAngle = startAngle + attackProgress * ATTACK_ANGLE;
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
    if (attackProgress >= 1) {
      player.isAttacking = false;
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
  drawTool(centerX, centerY, attackRange);

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
  ctx.font = "14px cursive";
  ctx.textAlign = "center";
  ctx.fillText(player.name || "You", centerX, player.y - 10);

}



function gainXP(amount) {
  if (!player) return;
  player.xp += amount;
  while (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level++;
    player.xpToNextLevel = Math.floor(player.xpToNextLevel * 2);
    showMessage(`Level Up! You are now level ${player.level}`);
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

function createNewPlayer() {
  const size = 32;
  let x, y;
  let attempts = 0;
  while (true) {
    x = Math.random() * (WORLD_SIZE / 5 - size);
    y = Math.random() * (WORLD_SIZE / 5 - size);
    attempts++;
    const overlapsResource = isOverlappingAny(allResources, x, y, size, size);
    const overlapsMob = isOverlappingAny(mobs, x, y, size, size);
    if (!overlapsResource && !overlapsMob) break;
    if (attempts % 1000 === 0) {
      console.warn(`⚠️ Still trying to place player ${id}, attempts: ${attempts}`);
    }
  }
  return {
    id: "singleplayer",
    x,
    y,
    size,
    color: "rgba(0, 0, 0, 0)",
    speed: 175,
    facingAngle: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    health: 100,
    maxHealth: 100,
    playerdamage: 1,
    playerattackspeed: 0.15,
    playerrange: 0,
    playerknockback: 0,

    healthRegen: 0.01,
    lastDamageTime: null,
    isDead: false,
    maxStamina: 100,
    staminaRegenSpeed: 40,
    hunger: 100, // Add hunger
    maxHunger: 100,
    hungerDepletionSpeed: 2,
    lastHungerDepletion: Date.now(),
    
  };
}