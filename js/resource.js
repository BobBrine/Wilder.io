const resourceTypes = {
  wood: {
    maxCount: 50,
    size: 32,
    get health() {
      return Math.floor(Math.random() * (40 - 20 + 1)) + 20; // 20–40
    },
    color: "green",
    itemColor: "green",
    drop: "wood",
    tools: [
      "hand",
      "wooden_axe",
      "stone_axe",
      "iron_axe",
      "gold_axe"
    ],
    spawntimer: 10, // 🕒 10 seconds (60fps * 10)
    getDropAmount(health) {
      return health <= 30
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    },
  },

  stone: {
    maxCount: 30,
    size: 32,
    get health() {
      return Math.floor(Math.random() * (60 - 30 + 1)) + 30; // 30–60
    },
    color: "darkgray",
    itemColor: "darkgray",
    drop: "stone",
    tools: [
      "wooden_pickaxe",
      "stone_pickaxe",
      "iron_pickaxe",
      "gold_pickaxe"
    ],
    spawntimer: 900,
    getDropAmount(health) {
      return health <= 45
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    }
    
  },

  iron: {
    maxCount: 10,
    size: 32,
    get health() {
      return Math.floor(Math.random() * (80 - 40 + 1)) + 40; // 40–80
    },
    color: "white",
    itemColor: "white",
    drop: "iron",
    tools: [
      "stone_pickaxe",
      "iron_pickaxe",
      "gold_pickaxe"
    ],
    spawntimer: 1200,
    getDropAmount(health) {
      return health <= 60
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    }
  },

  gold: {
    maxCount: 5,
    size: 32,
    get health() {
      return Math.floor(Math.random() * (100 - 50 + 1)) + 50; // 50–100
    },
    color: "gold",
    itemColor: "gold",
    drop: "gold",
    tools: [
      "iron_pickaxe",
      "gold_pickaxe"
    ],
    spawntimer: 1500,
    getDropAmount(health) {
      return health <= 75
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    }
  }
};


const allResources = {
  wood: [],
  stone: [],
  iron: [],
  gold: []
};




function createResourceSpawner(type, targetArray, isOverlapping) {
  const config = resourceTypes[type];
  if (!config) {
    console.warn(`Unknown resource type: ${type}`);
    return;
  }

  // 🔥 Count only alive resources
  let activeCount = targetArray.filter(r => r.size > 0).length;
  let deadCount = targetArray.filter(r => r.size === 0).length;


  while (activeCount + deadCount < config.maxCount) {
    const x = Math.random() * (WORLD_WIDTH - config.size);
    const y = Math.random() * (WORLD_HEIGHT - config.size);

    if (!isOverlapping(x, y, config.size)) {
      targetArray.push({
        type,
        x,
        y,
        size: config.size,
        health: config.health, // now dynamic
        maxHealth: config.health, // store for later use in drawHealthBar

        color: config.color,
        respawnTimer: 0, // no timer needed while alive
        respawnTime: config.spawntimer || 2000, // default if not set
        
      });
      activeCount++;
      //break; // Spawn only one per interval for smoother control
    }
  }
}


function checkOverlap(x1, y1, size1, x2, y2, size2) {
  return (
    x1 < x2 + size2 &&
    x1 + size1 > x2 &&
    y1 < y2 + size2 &&
    y1 + size1 > y2
  );
}

function drawHealthBar(resource) {
  const config = resourceTypes[resource.type];
  if (!config || !resource.maxHealth) return;

  const healthRatio = resource.health / resource.maxHealth;
  const barWidth = resource.size;
  const barHeight = 5;
  const padding = 2;

  const x = resource.x;
  const y = resource.y - barHeight - padding;

  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth , barHeight);

  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * healthRatio, barHeight);

  //ctx.strokeStyle = "black";
  //ctx.strokeRect(x, y, barWidth, barHeight);
}




function drawAllResources() {
  const now = Date.now();

  for (const resources of Object.values(allResources)) {
    for (const r of resources) {
      if (r.size > 0) {
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, r.size, r.size);

        // Draw health bar if recently hit
        if (r.lastHitTime && now - r.lastHitTime < 1000) {
          drawHealthBar(r);
        }
      }
    }
  }
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

function hitResourceInCone() {
  const coneLength = 50;
  const coneAngle = Math.PI / 4;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;

    const selected = hotbar.slots[hotbar.selectedIndex];
    let selectedTool = selected?.type || "hand";

    // If the selected item is NOT a valid tool, treat it as "hand"
    if (!toolDamage[selectedTool]) {
    selectedTool = "hand";
    }

  for (const [type, config] of Object.entries(resourceTypes)) {
    const list = getResourceArrayByType(type); // trees, rocks, etc.

    for (const resource of list) {
      const rx = resource.x + resource.size / 2;
      const ry = resource.y + resource.size / 2;

      if (
        resource.size > 0 &&
        pointInCone(rx, ry, centerX, centerY, player.facingAngle, coneAngle, coneLength)
      ) {
        // Check if tool is valid
        if (!config.tools.includes(selectedTool)) {
          showMessage("This tool is not effective.");
          return;
        }

        const damage = toolDamage[selectedTool] || toolDamage.hand;
        resource.health -= damage;


        //damage to resources
        showDamageText(rx, ry, damage);
        if (resource.health <= 0) {
          resource.size = 0;
          resource.respawnTimer = resource.respawnTime; 
          const dropAmount = config.getDropAmount(resource.maxHealth);
            inventory.addItem(config.drop, dropAmount);
            
            gainXP(3);
        } 
        else {
            resource.lastHitTime = Date.now(); // NEW: track when it was hit
        }

        return; // only hit one resource
      }
    }
  }
}



function isOverlappingAnythings(x, y, size) {
  const all = Object.values(allResources).flat(); // flatten all resource arrays

  const overlappingResource = all.some(obj =>
    obj.size > 0 && 
    checkOverlap(x, y, size, obj.x, obj.y, obj.size)
  );

  const overlappingPlayer = checkOverlap(x, y, size, player.x, player.y, player.size);

  return overlappingResource || overlappingPlayer;
}



function getResourceArrayByType(type) {
  return allResources[type] || [];
}

function isCollidingWithResources(newX, newY, size = player.size) {
    const all = Object.values(allResources).flat();
    return all.some(resource =>
        checkOverlap(newX, newY, size, resource.x, resource.y, resource.size)
    );
}

function spawnAllResources() {
    for (const type in allResources) {
        // Remove dead resources
        allResources[type] = allResources[type].filter(r => r.size > 0);
        
        createResourceSpawner(type, allResources[type], isOverlappingAnythings);
    }
}

function updateResourceRespawns(deltaTime) {
  for (const resources of Object.values(allResources)) {
    for (const r of resources) {
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        //console.log(r.respawnTimer);
        if (r.respawnTimer <= 0) {
          // Respawn the resource at a new location
          let newX, newY;
          do {
            newX = Math.random() * (WORLD_WIDTH - r.size);
            newY = Math.random() * (WORLD_HEIGHT - r.size);
          } while (isOverlappingAnythings(newX, newY, r.size));

          r.x = newX;
          r.y = newY;
          r.size = r.size || resourceTypes[r.type].size;
          r.health = resourceTypes[r.type].health;
          r.maxHealth = r.health;
          r.color = resourceTypes[r.type].color;
          r.respawnTimer = 0;
        }
      }
    }
  }
}


spawnAllResources();
/*
setInterval(() => {
  spawnAllResources(); // This will try to spawn missing resources
}, 1000); 
*/