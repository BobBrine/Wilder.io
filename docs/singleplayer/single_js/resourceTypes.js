// Seeded random number generator for consistent world generation
let seedRng = null;

function createSeededRNG(seed) {
  // Simple seeded random number generator (mulberry32)
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getRandomValue() {
  // Use seeded RNG if available (for world generation), otherwise use Math.random
  if (seedRng && typeof window.worldSeed !== 'undefined') {
    const value = seedRng();
    // Debug: log first few random values to verify uniqueness
    if (typeof window._debugRandomCount === 'undefined') window._debugRandomCount = 0;
    if (window._debugRandomCount < 5) {
      console.log(`Seeded random ${window._debugRandomCount}: ${value} (seed: ${window.worldSeed})`);
      window._debugRandomCount++;
    }
    return value;
  }
  return Math.random();
}

// Initialize seeded RNG when world seed is available
function initializeWorldSeed() {
  if (typeof window.worldSeed !== 'undefined' && window.worldSeed) {
    seedRng = createSeededRNG(window.worldSeed);
    console.log('Seeded RNG initialized with seed:', window.worldSeed);
    // Reset debug counter for new world
    window._debugRandomCount = 0;
  // Seed initialized (silent)
  }
}

// Reset seeded RNG (for clearing between worlds)
function resetWorldSeed() {
  seedRng = null;
  console.log('Seeded RNG reset');
}

// Make functions globally available
if (typeof window !== 'undefined') {
  window.initializeWorldSeed = initializeWorldSeed;
  window.resetWorldSeed = resetWorldSeed;
  window.getRandomValue = getRandomValue;
}


const resourceTypes = {
  food: {
    maxCount: 50,
    sizeX: 32,
    sizeY: 32,
    get health() { return Math.floor(getRandomValue() * (25 - 15 + 1)) + 15; },
    color: "red",
    drop: "food",
    requiredTool: { categories: ["hand"], minTier: 0 },
    spawntimer: 8, // faster regen for early game
    getDropAmount(health) { return health <= 20 ? Math.floor(getRandomValue() * 3) + 3 : Math.floor(getRandomValue() * 4) + 4; }
  },

  wood: {
    maxCount: 80,
    get sizeX() {
      const min = 48;
      const maxArea = 8192;
      const x = Math.floor(getRandomValue() * ((maxArea / min) - min + 1)) + min;
      return x;
    },
    get sizeY() {
      const maxArea = 8192;
      const x = this.sizeX;
      return Math.floor(maxArea / x);
    },
    get health() { return Math.floor(getRandomValue() * (35 - 20 + 1)) + 20; },
    color: "green",
    drop: "wood",
    requiredTool: { categories: ["hand", "axe"], minTier: 0 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 28 ? Math.floor(getRandomValue() * 3) + 4 : Math.floor(getRandomValue() * 4) + 5; }
  },

  stone: {
    maxCount: 50,
    sizeX: 64,
    sizeY: 64,
    get health() { return Math.floor(Math.random() * (50 - 30 + 1)) + 30; },
    color: "darkgray",
    drop: "stone",
    requiredTool: { categories: ["pickaxe"], minTier: 1 },
    spawntimer: 12,
    getDropAmount(health) { return health <= 40 ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 4) + 5; }
  },

  iron: {
    maxCount: 25,
    sizeX: 64,
    sizeY: 64,
    get health() { return Math.floor(Math.random() * (70 - 45 + 1)) + 45; },
    color: "white",
    drop: "iron",
    requiredTool: { categories: ["pickaxe"], minTier: 2 },
    spawntimer: 14,
    getDropAmount(health) { return health <= 55 ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 4) + 6; }
  },

  gold: {
    maxCount: 15,
    sizeX: 32,
    sizeY: 32,
    get health() { return Math.floor(Math.random() * (90 - 60 + 1)) + 60; },
    color: "gold",
    drop: "gold",
    requiredTool: { categories: ["pickaxe"], minTier: 3 },
    spawntimer: 16,
    getDropAmount(health) { return health <= 75 ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 4) + 5; }
  }
};

// Initialize global allResources if it doesn't exist (create once and keep same reference)
if (!window.allResources) {
  window.allResources = {
    food: [],
    wood: [],
    stone: [],
    iron: [],
    gold: []
  };
}

// Ensure all resource type arrays exist without replacing the object (to preserve references)
function ensureAllResourceTypes() {
  if (!window.allResources) window.allResources = {};
  const types = Object.keys(resourceTypes);
  for (const t of types) {
    if (!Array.isArray(window.allResources[t])) window.allResources[t] = [];
  }
}

// Expose helper for other modules
window.ensureAllResourceTypes = ensureAllResourceTypes;

// Global graphics settings (persisted)
if (!window.graphicsSettings) {
  try {
    const perf = JSON.parse(localStorage.getItem('graphics.performanceMode') ?? 'false');
    window.graphicsSettings = {
      performanceMode: perf,
      // Shadows should be the inverse of performanceMode
      shadows: !perf
    };
  } catch (_) {
    window.graphicsSettings = { performanceMode: false, shadows: true };
  }
}


let resourcesLoaded = false;

function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
  return x1 < x2 + sizeX2 && x1 + sizeX1 > x2 && y1 < y2 + sizeY2 && y1 + sizeY1 > y2;
}

function getResourceArrayByType(type) {
  return (window.allResources && window.allResources[type]) ? window.allResources[type] : [];
}

function isCollidingWithResources(newX, newY, sizeX = player.size, sizeY = player.size, allResources) {
  const overlapMargin = sizeX * 0.4; // 40% overlap allowed, consistent with mob collision
  const { cx, cy } = getCenter(newX, newY, sizeX);
  const all = Object.values(allResources).flat();
  return all.some(resource => {
    if (resource.sizeX > 0 && resource.sizeY > 0) {
      const rcx = resource.x + resource.sizeX / 2;
      const rcy = resource.y + resource.sizeY / 2;
      const minDistX = (sizeX + resource.sizeX) / 2 - overlapMargin;
      const minDistY = (sizeY + resource.sizeY) / 2 - overlapMargin;
      return Math.abs(cx - rcx) < minDistX && Math.abs(cy - rcy) < minDistY;
    }
    return false;
  });
}

function getCenter(x, y, size) {
  return { cx: x + size / 2, cy: y + size / 2 };
}

function hitResourceInCone() {
  let attackRange = DEFAULT_ATTACK_RANGE + player.playerrange;
  const coneAngle = ATTACK_ANGLE;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";

  const toolInfo = (ItemTypes && ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool)
    ? ItemTypes[selectedTool]
    : { category: "hand", tier: 0, damage: 1, attackRange: 50 };

  if (toolInfo.attackRange) attackRange = toolInfo.attackRange + (player.playerrange);

  let staminaSpent = false; // ✅ track if stamina has been spent

  for (const [type, config] of Object.entries(resourceTypes)) {
    const list = getResourceArrayByType(type);

    for (const resource of list) {
      const rx = resource.x;
      const ry = resource.y;
      // ✅ Only hit if resource is in cone
      if (resource.sizeX > 0 && resource.sizeY > 0 &&
          isObjectInAttackCone(player, resource, attackRange, coneAngle)) {

        // ✅ Tool effectiveness check (skip for food: any item/hand can damage food)
        const isFood = type === 'food';
        if (!isFood) {
          if (!config.requiredTool.categories.includes(toolInfo.category) ||
              toolInfo.tier < config.requiredTool.minTier) {
            showMessage("This tool is not effective.");
            return;
          }
        }

        // ✅ Spend stamina ONCE
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

  // ✅ Apply damage to resource (food always takes 1)
  const damage = (type === 'food') ? 1 : toolInfo.damage;
        resource.health -= damage;
        playChopTree();
        showDamageText(rx, ry, -damage);
        triggerResourceHitAnimation(resource, player);

        if (resource.health <= 0) {
          // Resource destroyed: grant drops to player (singleplayer logic)
          resource.sizeX = 0;
          resource.sizeY = 0;
          resource.respawnTimer = resource.respawnTime;
          // Grant resource drop
          if (typeof inventory !== 'undefined' && typeof inventory.addItem === 'function') {
            const dropType = config.drop;
            let dropAmount = 1;
            if (typeof config.getDropAmount === 'function') {
              dropAmount = config.getDropAmount(resource.health);
            } else if (typeof config.dropAmount === 'number') {
              dropAmount = config.dropAmount;
            }
            if (dropType && dropAmount > 0) {
              // Default singleplayer behavior: auto-add to inventory
              if (typeof inventory !== 'undefined' && inventory.addItem) {
                inventory.addItem(dropType, dropAmount);
                if (typeof showMessage === 'function') showMessage(`+${dropAmount} ${dropType}`);
              }
            }
          }
        } else {
          resource.lastHitTime = performance.now();
        }
      }
    }
  }
}


function drawHealthBarR(resource) {
  const config = resourceTypes[resource.type];
  if (!config || !resource.maxHealth) return;
  ctx.save();
  const hpPercent = Math.max(resource.health / resource.maxHealth, 0);
  const barWidth = resource.sizeX;
  const barHeight = 5;
  const padding = 2;
  const x = resource.x;
  const y = resource.y - barHeight - padding;
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
  ctx.restore();
}



function tryHitResource() {
  // Spectator cannot interact/attack
  try { if (window.isSpectator && window.isSpectator()) return; } catch(_) {}
  const now = performance.now();
  const attackSpeed = getAttackSpeed();
  if ((now - lastHitTime) / 1000 >= attackSpeed && stamina > 0) {
    
    lastHitTime = now;
    tryHitMob();
    hitResourceInCone();
    tryBreakBlock();
    // tryAttack();
    punchHand = (punchHand === 'right') ? 'left' : 'right';
    isAttacking = true;
    attackStartTime = now;
    if (player) {
      player.isAttacking = true;
      player.attackStartTime = now;
    } 
  }
}

if (typeof socket !== "undefined" && socket) {
  socket.on("updateResourceHealth", ({ id, type, health, x, y, sizeX, sizeY, maxHealth }) => {
    if (!window.allResources) window.allResources = {};
    if (!window.allResources[type]) window.allResources[type] = [];
    let list = window.allResources[type];
    let resource = list.find(r => r.id === id);
    // If missing (e.g., just entered visibility), create it so the hit appears instantly
    if (!resource) {
      resource = { id, type, x: x ?? 0, y: y ?? 0, sizeX: sizeX ?? 0, sizeY: sizeY ?? 0, health: health ?? 0, maxHealth: maxHealth ?? health ?? 0 };
      list.push(resource);
    }
    resource.health = health;
    if (typeof x === 'number') resource.x = x;
    if (typeof y === 'number') resource.y = y;
    if (typeof sizeX === 'number') resource.sizeX = sizeX;
    if (typeof sizeY === 'number') resource.sizeY = sizeY;
    if (typeof maxHealth === 'number') resource.maxHealth = maxHealth;
    resource.lastHitTime = performance.now();
    if (health <= 0) {
      resource.sizeX = 0;
      resource.sizeY = 0;
      resource.respawnTimer = resource.respawnTime;
    }
  });
}

function drawResources() {
  const now = performance.now();
  const dotPositions = [
    { x: 0.15, y: 0.25 }, // Top-left quarter
    { x: 0.5,  y: 0.75 }, // Center
    { x: 0.75, y: 0.25 }  // Bottom-right quarter
  ];

  for (const resources of Object.values(window.allResources || {})) {
    for (const r of resources) {
      if (r.sizeX > 0 && r.sizeY > 0) {
        // Resource culling disabled by request: always draw resources even if off-screen
        if (false && typeof isWorldRectOnScreen === 'function') {
          const w = r.sizeX || 32;
          const h = r.sizeY || 32;
          if (!isWorldRectOnScreen(r.x, r.y, w, h)) {
            continue;
          }
        }

        // ===== Apply hit animation offset (visual only) =====
        let drawX = r.x;
        let drawY = r.y;
        if (r.hitAnim) {
          const t = (now - r.hitAnim.startTime) / r.hitAnim.duration;
          if (t >= 1) {
            r.hitAnim = null; // animation done
          } else {
            const phase = t < 0.5
              ? t / 0.5 // going out
              : 1 - ((t - 0.5) / 0.5); // returning
            drawX += r.hitAnim.offsetX * phase;
            drawY += r.hitAnim.offsetY * phase;
          }
        }

        ctx.save();
        // Apply optional shadows
        if (window.graphicsSettings && window.graphicsSettings.shadows) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 5;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        if (r.type === 'food') {
          // Main food rectangle
          ctx.fillStyle = resourceTypes[r.type].color;
          ctx.fillRect(drawX, drawY, r.sizeX, r.sizeY);

          // Green dots
          ctx.fillStyle = '#0f0';
          const dotSize = 10;
          dotPositions.forEach(pos => {
            const dotX = drawX + pos.x * r.sizeX - dotSize / 2;
            const dotY = drawY + pos.y * r.sizeY - dotSize / 2;
            ctx.fillRect(dotX, dotY, dotSize, dotSize);
          });
        } else {
          // Generic resource rectangle
          ctx.fillStyle = resourceTypes[r.type].color;
          ctx.fillRect(drawX, drawY, r.sizeX, r.sizeY);
        }
        ctx.restore();

  // ===== Top & Left highlight =====
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(drawX, drawY + 2);  
  ctx.lineTo(drawX + r.sizeX, drawY + 2);
  ctx.moveTo(drawX + 2, drawY);  
  ctx.lineTo(drawX + 2, drawY + r.sizeY);
  ctx.stroke();
  ctx.restore();

  // ===== Bottom & Right shadow =====
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.moveTo(drawX, drawY + r.sizeY - 2);  
  ctx.lineTo(drawX + r.sizeX, drawY + r.sizeY - 2);
  ctx.moveTo(drawX + r.sizeX - 2, drawY);  
  ctx.lineTo(drawX + r.sizeX - 2, drawY + r.sizeY);
  ctx.stroke();
  ctx.restore();

        // ===== Debug hitboxes =====
        if (showData) {
          ctx.save();
          ctx.strokeStyle = 'blue';
          ctx.lineWidth = 1;
          if (r.sizeX !== undefined && r.sizeY !== undefined) {
            ctx.strokeRect(drawX, drawY, r.sizeX, r.sizeY);
          } else if (r.radius !== undefined) {
            ctx.beginPath();
            ctx.arc(drawX, drawY, r.radius, 0, Math.PI * 2);
            ctx.stroke();
          } else if (r.size !== undefined) {
            ctx.strokeRect(drawX, drawY, r.size, r.size);
          }
          

          ctx.fillStyle = "white";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          let yOffset = -50;
          const texts = [
            `ID: ${r.id.slice(0, 4)}`,
            `HP: ${r.health.toFixed(0)}/${r.maxHealth}`,
            `Pos: ${r.x.toFixed(0)}, ${r.y.toFixed(0)}`,
            `Type: ${r.type}`
          ];
          texts.forEach(text => {
            ctx.fillText(text, drawX + r.sizeX / 2, drawY + yOffset);
            yOffset += 12;
          });
          ctx.restore();
        }

        // ===== Health bar when hit recently =====
        if (r.lastHitTime && now - r.lastHitTime < 1000) {
          drawHealthBarR({ ...r, x: drawX, y: drawY });
        }
      }
    }
  }
}


// Store hit animation data in resource object
function triggerResourceHitAnimation(resource, attacker) {
  const dx = resource.x - attacker.x;
  const dy = resource.y - attacker.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const knockbackDist = 8; // pixels

  resource.hitAnim = {
    offsetX: (dx / len) * knockbackDist,
    offsetY: (dy / len) * knockbackDist,
    progress: 0,   // 0 → going out, 1 → returning
    startTime: performance.now(),
    duration: 150 // ms total
  };
}



function getRandomPositionInCell(col, row, sizeX, sizeY) {
  const minX = col * GRID_CELL_SIZE;
  const minY = row * GRID_CELL_SIZE;
  const maxX = minX + GRID_CELL_SIZE - sizeX;
  const maxY = minY + GRID_CELL_SIZE - sizeY;
  const x = Math.random() * (maxX - minX) + minX;
  const y = Math.random() * (maxY - minY) + minY;
  return { x, y };
}






function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
  return x1 < x2 + sizeX2 && x1 + sizeX1 > x2 && y1 < y2 + sizeY2 && y1 + sizeY1 > y2;
}

function isOverlappingAny(source, x, y, sizeX, sizeY) {
  if (!source) return false;
  const list = Array.isArray(source)
    ? source
    : Object.values(source || {}).flat();

  return list.some(r => {
    if (!r) return false;
    // Check if resource (uses sizeX/sizeY) or player/mob (uses size)
    const rSizeX = r.sizeX !== undefined ? r.sizeX : r.size;
    const rSizeY = r.sizeY !== undefined ? r.sizeY : r.size;
    return rSizeX > 0 && rSizeY > 0 && checkOverlap(x, y, sizeX, sizeY, r.x, r.y, rSizeX, rSizeY);
  });
}

function createResourceSpawner(type, targetArray, isOverlapping) {
  const config = resourceTypes[type];
  if (!config) return;

  let activeCount = targetArray.filter(r => r.sizeX > 0 && r.sizeY > 0).length;
  let deadCount = targetArray.filter(r => r.sizeX === 0 || r.sizeY === 0).length;

  while (activeCount + deadCount < config.maxCount) {
    const col = Math.floor(getRandomValue() * GRID_COLS);
    const row = Math.floor(getRandomValue() * GRID_ROWS);
    const sizeX = typeof config.sizeX === 'function' ? config.sizeX() : config.sizeX;
    const sizeY = typeof config.sizeY === 'function' ? config.sizeY() : config.sizeY;
    const { x, y } = getRandomPositionInCell(col, row, sizeX, sizeY);
    if (!isOverlapping(x, y, sizeX, sizeY)) {
      const id = crypto.randomUUID();
      const initialHealth = typeof config.health === 'function' ? config.health() : config.health;
      targetArray.push({
        id,
        type,
        x,
        y,
        sizeX,
        sizeY,
        health: initialHealth,
        maxHealth: initialHealth,
        respawnTimer: 0,
        respawnTime: config.spawntimer
      });
      activeCount++;
    }
  }
}

function spawnAllResources() {
  console.log('=== SPAWN ALL RESOURCES START ===');
  console.log('Current worldSeed:', window.worldSeed);
  
  // Initialize seeded random generation for consistent world gen
  initializeWorldSeed();
  console.log('Seeded RNG initialized for world seed:', window.worldSeed);
  
  // Ensure window.allResources and all type arrays exist
  ensureAllResourceTypes();
  
  console.log('Spawning resources into window.allResources');
  
  for (const type in window.allResources) {
    // Keep only alive resources but keep the same array reference
    const list = window.allResources[type];
    if (Array.isArray(list)) {
      const beforeCount = list.length;
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (!r || r.sizeX <= 0 || r.sizeY <= 0) {
          // Leave dead resources for respawn logic if they track timers; otherwise remove
          // Here, keep them so respawn system can handle; don't remove
        }
      }
      console.log(`Spawning ${type} resources (had ${beforeCount} before)`);
    }
    createResourceSpawner(type, window.allResources[type], (x, y, sizeX, sizeY) => 
      isOverlappingAny(window.allResources, x, y, sizeX, sizeY) ||
      isOverlappingAny(mobs, x, y, sizeX, sizeY) || 
      isOverlappingAny(player, x, y, sizeX, sizeY)
    );
  }
  
  console.log('After spawning, window.allResources contains:', Object.keys(window.allResources).map(k => `${k}: ${window.allResources[k].length}`));
  window.__resourcesSpawnedOnce = true;
}

function updateResourceRespawns(deltaTime) {
  for (const resources of Object.values(window.allResources || {})) {
    for (const r of resources) {
      if ((r.sizeX === 0 || r.sizeY === 0) && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        if (r.respawnTimer <= 0) {
          const config = resourceTypes[r.type];
          let newX, newY, newSizeX, newSizeY;
          do {
            newSizeX = typeof config.sizeX === 'function' ? config.sizeX() : config.sizeX;
            newSizeY = typeof config.sizeY === 'function' ? config.sizeY() : config.sizeY;
            const col = Math.floor(getRandomValue() * GRID_COLS);
            const row = Math.floor(getRandomValue() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, newSizeX, newSizeY));
          } while (
            isOverlappingAny(window.allResources, newX, newY, newSizeX, newSizeY) ||
            isOverlappingAny(mobs, newX, newY, newSizeX, newSizeY) ||
            isOverlappingAny(player, newX, newY, newSizeX, newSizeY)
          );
          const newHealth = typeof config.health === 'function' ? config.health() : config.health;
          r.id = crypto.randomUUID();
          r.x = newX;
          r.y = newY;
          r.sizeX = newSizeX;
          r.sizeY = newSizeY;
          r.health = newHealth;
          r.maxHealth = newHealth;
          r.respawnTimer = 0;
        }
        console.log(`Respawned ${r.type} at (${newX}, ${newY}) with size (${newSizeX}, ${newSizeY})`);
      }
    }
  }
}

