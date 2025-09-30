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
          
   

          playBlockBreak();

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
