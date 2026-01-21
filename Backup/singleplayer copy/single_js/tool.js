// Load core images
const pureCoreImage = new Image();
pureCoreImage.src = '../images/pure_core.png';
const darkCoreImage = new Image();
darkCoreImage.src = '../images/dark_core.png';
const mythicCoreImage = new Image();
mythicCoreImage.src = '../images/mythic_core.png';
// Load hand image
const handImage = new Image();
handImage.src = "../images/hand.png";
let handImageLoaded = false;
handImage.onload = () => {
  handImageLoaded = true;
};

// Load sword image
const swordImage = new Image();
swordImage.src = '../images/wooden_sword.png'; // Adjust path as needed
const stone_sword_Image = new Image();
stone_sword_Image.src = '../images/stone_sword.png';
const iron_sword_Image = new Image();
iron_sword_Image.src = '../images/iron_sword.png';
const gold_sword_Image = new Image();
gold_sword_Image.src = '../images/gold_sword.png';

// Load pickaxe image
const wooden_pickaxe_Image = new Image();
wooden_pickaxe_Image.src = '../images/wooden_pickaxe.png'; // Adjust path as needed
const stone_pickaxe_Image = new Image();
stone_pickaxe_Image.src = '../images/stone_pickaxe.png';
const iron_pickaxe_Image = new Image();
iron_pickaxe_Image.src = '../images/iron_pickaxe.png';
const gold_pickaxe_Image = new Image();
gold_pickaxe_Image.src = '../images/gold_pickaxe.png';

// Load axe image
const wooden_axe_Image = new Image();
wooden_axe_Image.src = '../images/wooden_axe.png'; // Adjust path as needed
const stone_axe_Image = new Image();
stone_axe_Image.src = '../images/stone_axe.png';
const iron_axe_Image = new Image();
iron_axe_Image.src = '../images/iron_axe.png';
const gold_axe_Image = new Image();
gold_axe_Image.src = '../images/gold_axe.png';

const wooden_hammer_Image = new Image();
wooden_hammer_Image.src = '../images/wooden_hammer.png';

// Load wood image
const woodImage = new Image();
woodImage.src = '../images/wood.png'; // Adjust path as needed
let woodImageLoaded = false;
woodImage.onload = () => {
    woodImageLoaded = true;
};

// Load food image
const foodImage = new Image();
foodImage.src = '../images/food.png';
let foodImageLoaded = false;
foodImage.onload = () => {
    foodImageLoaded = true;
};

const torchImage = new Image();
torchImage.src = '../images/torch.png';
let torchImageLoaded = false;
torchImage.onload = () => {
    torchImageLoaded = true;
};

const stoneImage = new Image();
stoneImage.src = '../images/stone.png';
let stoneImageLoaded = false;
stoneImage.onload = () => {
    stoneImageLoaded = true;
};

const ironImage = new Image();
ironImage.src = '../images/iron.png';
const goldImage = new Image();
goldImage.src = '../images/gold.png';

const craftingImage = new Image();
craftingImage.src = '../images/craftingtable.png';
let craftingImageLoaded = false;
craftingImage.onload = () => {
    craftingImageLoaded = true;
};

const toolImages = {
  'wooden_sword': swordImage,
  'stone_sword': stone_sword_Image,
  'iron_sword': iron_sword_Image,
  'gold_sword': gold_sword_Image,
  'wooden_pickaxe': wooden_pickaxe_Image,
  'stone_pickaxe': stone_pickaxe_Image,
  'iron_pickaxe': iron_pickaxe_Image,
  'gold_pickaxe': gold_pickaxe_Image,
  'wooden_axe': wooden_axe_Image,
  'stone_axe': stone_axe_Image,
  'iron_axe': iron_axe_Image,
  'gold_axe': gold_axe_Image,
  'torch': torchImage,
  'wooden_hammer': wooden_hammer_Image,
};

const healthPotionImage = new Image();
healthPotionImage.src = '../images/health_potion.png';
const strengthPotionImage = new Image();
strengthPotionImage.src = '../images/attack_potion.png';
const mythicPotionImage = new Image();
mythicPotionImage.src = '../images/Raindom_potion.png';

const resourceImages = {
  'wood': woodImage,
  'stone': stoneImage,
  'iron': ironImage,
  'gold': goldImage,
  'food': foodImage,
  'pure_core': pureCoreImage,
  'dark_core': darkCoreImage,
  'mythic_core': mythicCoreImage,
  'health_potion': healthPotionImage,
  'strength_potion': strengthPotionImage,
  'mythic_potion': mythicPotionImage,
  'crafting_table': craftingImage,
};

function drawTool(centerX, centerY, attackRange) {
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
    if (selected && ItemTypes[selected.type] && isAttacking) {
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
      const toolImage = toolImages[selected.type];
      const resourceImage = resourceImages[selected.type];

      if (ItemTypes[selected.type].isTool && toolImage && toolImage.complete) {
        const scale = 1;
        const imgWidth = toolImage.width * scale;
        const imgHeight = toolImage.height * scale;
        ctx.save();
        let toolAngle = Math.PI * 1.5 + Math.PI / 8;
        if (isAttacking) {
          const now = performance.now();
          const attackSpeed = getAttackSpeed();
          const attackDuration = attackSpeed * 1000;
          let attackProgress = (now - attackStartTime) / attackDuration;
          if (attackProgress > 1) attackProgress = 1;
          toolAngle -= (Math.PI / 2) * (1 - attackProgress);
        }
        ctx.rotate(toolAngle);
        const toolOffsetX = 10;
        const toolOffsetY = 6;
        ctx.translate(toolOffsetX, toolOffsetY);
        ctx.drawImage(
          toolImage,
          -imgWidth / 2,
          -imgHeight,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else if (resourceImage && resourceImage.complete) {
          const scale = 1;
          const imgWidth = resourceImage.width * scale;
          const imgHeight = resourceImage.height * scale;
          ctx.save();
          ctx.rotate((Math.PI * 2) - Math.PI/8);
          ctx.translate(0, -12);
          ctx.drawImage(
            resourceImage,
            -imgWidth / 2,
            -imgHeight / 2,
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
}

const GRID_SIZE = 32;
const PLACEMENT_DISTANCE = 64; // Maximum distance for block placement
let lastPlacementTime = 0;
const PLACEMENT_COOLDOWN = 200;
let lastBreakTime = 0;
const BREAK_COOLDOWN = 200;
// World blocks data structure
let placedBlocks = [];
const BlockTypes = {
  'crafting_table': { maxHealth: 100 },
  // Add more block types as needed
};


// Add this function to draw block health bars
function drawBlockHealthBar(block) {
  if (!block.maxHealth) return;
  ctx.save();
  const hpPercent = Math.max(block.health / block.maxHealth, 0);
  const barWidth = GRID_SIZE;
  const barHeight = 5;
  const padding = 2;
  const x = block.worldX - GRID_SIZE/2;
  const y = block.worldY - GRID_SIZE/2 - barHeight - padding;
  
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
  ctx.restore();
}

// Get the grid cell in front of the player
function getFrontGridCell(player) {
  const px = player.x;
  const py = player.y;
  const angle = player.facingAngle;
  
  // Calculate position in front of player
  const dx = Math.cos(angle) * PLACEMENT_DISTANCE;
  const dy = Math.sin(angle) * PLACEMENT_DISTANCE;
  
  // World position in front
  const wx = px + dx;
  const wy = py + dy;
  
  // Snap to grid
  const gridX = Math.round(wx / GRID_SIZE);
  const gridY = Math.round(wy / GRID_SIZE);
  
  return { gridX, gridY, worldX: gridX * GRID_SIZE, worldY: gridY * GRID_SIZE };
}

// Check if a block can be placed at grid cell
function canPlaceBlockAt(gridX, gridY) {
  // Check for collision with existing blocks
  for (const b of placedBlocks) {
    if (b.gridX === gridX && b.gridY === gridY) return false;
  }
  
  // Check if too close to player
  const playerGridX = Math.round(player.x / GRID_SIZE);
  const playerGridY = Math.round(player.y / GRID_SIZE);
  const dist = Math.sqrt(Math.pow(gridX - playerGridX, 2) + Math.pow(gridY - playerGridY, 2));
  if (dist < 1.5) return false; // Minimum distance from player
  
  // Check world bounds
  if (gridX < 0 || gridY < 0 || 
      gridX * GRID_SIZE > WORLD_SIZE || 
      gridY * GRID_SIZE > WORLD_SIZE) return false;
  
  return true;
}

// Render block preview in front of player
function drawBlockPlacementPreview(ctx, player, selectedType) {
  if (!BlockTypes[selectedType]) return;
  
  const { gridX, gridY, worldX, worldY } = getFrontGridCell(player);
  const canPlace = canPlaceBlockAt(gridX, gridY);
  
  // Get image for block
  const img = resourceImages[selectedType] || toolImages[selectedType];
  
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  if (img && img.complete) {
    ctx.drawImage(img, worldX - GRID_SIZE/2, worldY - GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
  } else {
    // Fallback rectangle if image not loaded
    ctx.fillStyle = ItemTypes[selectedType]?.color || 'gray';
    ctx.fillRect(worldX - GRID_SIZE/2, worldY - GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
  }
  
  // Outline to indicate placement status
  ctx.strokeStyle = canPlace ? 'lime' : 'red';
  ctx.lineWidth = 3;
  ctx.strokeRect(worldX - GRID_SIZE/2, worldY - GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
  
  ctx.restore();
}

// Place block at grid cell
function placeBlockAt(selectedType, gridX, gridY) {
  const now = performance.now();
  if (now - lastPlacementTime < PLACEMENT_COOLDOWN) return false;
  
  if (!BlockTypes[selectedType]) return false;
  if (!canPlaceBlockAt(gridX, gridY)) return false;
  
  const block = { 
    type: selectedType, 
    gridX, 
    gridY,
    health: BlockTypes[selectedType].maxHealth,
    maxHealth: BlockTypes[selectedType].maxHealth
  };
  
  placedBlocks.push({ 
    ...block,
    worldX: gridX * GRID_SIZE,
    worldY: gridY * GRID_SIZE
  });
  
  // Emit to server
  socket.emit('placeBlock', block);
  
  lastPlacementTime = now;
  inventory.removeItem(selectedType, 1);
  playBlockPlace();
  showPlacementEffect(gridX * GRID_SIZE, gridY * GRID_SIZE, true);
  
  return true;
}

// Draw all placed blocks
function drawPlacedBlocks(ctx) {
  const now = performance.now();
  
  for (const b of placedBlocks) {
    // Apply hit animation offset if active
    let drawX = b.worldX - GRID_SIZE/2;
    let drawY = b.worldY - GRID_SIZE/2;
    
    if (b.hitAnim) {
      const t = (now - b.hitAnim.startTime) / b.hitAnim.duration;
      if (t >= 1) {
        b.hitAnim = null; // animation done
      } else {
        const phase = t < 0.5
          ? t / 0.5 // going out
          : 1 - ((t - 0.5) / 0.5); // returning
        drawX += b.hitAnim.offsetX * phase;
        drawY += b.hitAnim.offsetY * phase;
      }
    }
    
    const img = resourceImages[b.type] || toolImages[b.type];
    
    if (img && img.complete) {
      ctx.drawImage(img, drawX, drawY, GRID_SIZE, GRID_SIZE);
    } else {
      // Fallback rectangle if image not loaded
      ctx.fillStyle = ItemTypes[b.type]?.color || 'gray';
      ctx.fillRect(drawX, drawY, GRID_SIZE, GRID_SIZE);
    }
    
    // Show health bar if recently hit
    if (b.lastHitTime && now - b.lastHitTime < 1000) {
      drawBlockHealthBar(b);
    }
  }
  
  if (showData) {
    drawCraftingRadius();
  }
}

function tryBreakBlock() {
  if (!player) return false;

  let attackRange = DEFAULT_ATTACK_RANGE + player.playerrange;
  const coneAngle = ATTACK_ANGLE;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";

  const toolInfo = (ItemTypes && ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool)
    ? ItemTypes[selectedTool]
    : { category: "hand", tier: 0, damage: 1, attackRange: 50 };

  if (toolInfo.attackRange) attackRange = toolInfo.attackRange + (player.playerrange);

  let staminaSpent = false;

  // Check if tool is a hammer (required for breaking blocks)
  if (toolInfo.category === 'hammer') {
    // Check placed blocks
    for (let i = 0; i < placedBlocks.length; i++) {
      const block = placedBlocks[i];
      
      // Create a block object with position and size for cone check
      const blockObj = {
        x: block.worldX,
        y: block.worldY,
        sizeX: GRID_SIZE,
        sizeY: GRID_SIZE
      };

      // Check if block is in attack cone
      if (isObjectInAttackCone(player, blockObj, attackRange, coneAngle)) {
        // Spend stamina only once per swing
        if (!staminaSpent) {
          const cost = 2;
          if (stamina < cost) {
            showMessage("Low Stamina");
            return;
          }
          stamina -= cost;
          lastStaminaUseTime = 0;
          staminaSpent = true;
        }
        
        // Apply damage to block
        const damage = toolInfo.damage;
        block.health -= damage;
        socket.emit('blockHit', {
          gridX: block.gridX,
          gridY: block.gridY,
          damage: toolInfo.damage
        });
        // Show damage text
        showDamageText(block.worldX, block.worldY, -damage);
        
        // Trigger hit animation
        triggerBlockHitAnimation(block, player);
        
        // Update last hit time for health bar display
        block.lastHitTime = performance.now();
        
        // Play hit sound
        playChopTree();
        
        // Check if block should break
        if (block.health <= 0) {
          // Break the block
          placedBlocks.splice(i, 1);
          i--; // Adjust index after removal
          
          // Drop the block as an item (instant pickup). Online: ask server; Offline: spawn locally.
          if (window.socket && socket.connected) {
            socket.emit('dropItem', {
              type: block.type,
              amount: 1,
              x: block.worldX,
              y: block.worldY,
              pickupDelay: 0
            });
          } else {
            if (!Array.isArray(window.droppedItems)) window.droppedItems = [];
            window.droppedItems.push({
              id: Math.floor(Math.random() * 1e9),
              type: block.type,
              amount: 1,
              x: block.worldX,
              y: block.worldY,
              pickupDelay: 0,
            });
          }

          playBlockBreak();
          socket.emit('breakBlock', { gridX: block.gridX, gridY: block.gridY });

          // Show break effect
          showPlacementEffect(block.worldX, block.worldY, false);
        }
        
        // Break only one block per swing
        break;
      }
    }
  }
}



function showPlacementEffect(x, y, isPlacement) {
  const effect = {
    x: x,
    y: y,
    radius: 0,
    maxRadius: 20,
    color: isPlacement ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)',
    duration: 300,
    startTime: performance.now()
  };
  
  if (!window.placementEffects) window.placementEffects = [];
  window.placementEffects.push(effect);
}

// Draw placement effects in your main render loop
function drawPlacementEffects() {
  if (!window.placementEffects) return;
  
  const now = performance.now();
  for (let i = window.placementEffects.length - 1; i >= 0; i--) {
    const effect = window.placementEffects[i];
    const elapsed = now - effect.startTime;
    const progress = elapsed / effect.duration;
    
    if (progress >= 1) {
      window.placementEffects.splice(i, 1);
      continue;
    }
    
    effect.radius = (effect.maxRadius * 1.5) * (1 - Math.abs(progress - 0.5) * 2);
    
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - progress);
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
    ctx.fillStyle = effect.color;
    ctx.fill();
    ctx.restore();
  }
}

function isCollidingWithBlocks(newX, newY, sizeX = player.size, sizeY = player.size) {
    const overlapMargin = sizeX * 0.4; // 40% overlap allowed
    const { cx, cy } = getCenter(newX, newY, sizeX, sizeY);
    
    return placedBlocks.some(block => {
        const blockSize = GRID_SIZE;
        const rcx = block.worldX;
        const rcy = block.worldY;
        const minDistX = (sizeX + blockSize) / 2 - overlapMargin;
        const minDistY = (sizeY + blockSize) / 2 - overlapMargin;
        
        return Math.abs(cx - rcx) < minDistX && Math.abs(cy - rcy) < minDistY;
    });
}
const CRAFTING_TABLE_RANGE = 150; // pixels

function isNearCraftingTable() {
  for (const block of placedBlocks) {
    if (block.type === 'crafting_table') {
      const dx = block.worldX - player.x;
      const dy = block.worldY - player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= CRAFTING_TABLE_RANGE) {
        return true;
      }
    }
  }
  return false;
}
function drawCraftingRadius() {
  if (!window.graphicsSettings || window.graphicsSettings.performanceMode) return;
  
  for (const block of placedBlocks) {
    if (block.type === 'crafting_table') {
      const screenX = block.worldX;
      const screenY = block.worldY;

      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, CRAFTING_TABLE_RANGE, 0, Math.PI * 2);
      ctx.fillStyle = 'blue';
      ctx.fill();
      ctx.restore();
    }
  }
}

function triggerBlockHitAnimation(block, attacker) {
  const dx = block.worldX - attacker.x;
  const dy = block.worldY - attacker.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const knockbackDist = 8; // pixels

  block.hitAnim = {
    offsetX: (dx / len) * knockbackDist,
    offsetY: (dy / len) * knockbackDist,
    progress: 0,   // 0 → going out, 1 → returning
    startTime: performance.now(),
    duration: 150 // ms total
  };
}
