// public/resourceTypes.js
let resourceTypes = {
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
    spawntimer: 1, // 🕒 10 seconds (60fps * 10)
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


let allResources = {};

let resourcesLoaded = false;

function checkOverlap(x1, y1, size1, x2, y2, size2) {
  return x1 < x2 + size2 && x1 + size1 > x2 && y1 < y2 + size2 && y1 + size1 > y2;
}

function getResourceArrayByType(type) {
  return allResources[type] || [];
}

function isCollidingWithResources(newX, newY, size = player.size) {
  const all = Object.values(allResources).flat();
  return all.some(resource =>
    resource.size > 0 &&
    checkOverlap(newX, newY, size, resource.x, resource.y, resource.size)
  );
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
  if (!player) return false;
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
        
        socket.emit("resourceHit", {
          type,
          id: resource.id, // ensure resources have a unique id
          newHealth: resource.health,
        });

        //console.log(resource.health);
        //damage to resources
        showDamageText(rx, ry, damage);
        if (resource.health <= 0) {
          resource.size = 0;
          resource.respawnTimer = resource.respawnTime; 
        } 
        else {
          resource.lastHitTime = Date.now(); // NEW: track when it was hit
        }

        return; // only hit one resource
      }
    }
  }
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