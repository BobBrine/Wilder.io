// server/resourceManager.js
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

const crypto = require("crypto");


const resourceTypes = {
  wood: {
    maxCount: 2,
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


function checkOverlap(x1, y1, size1, x2, y2, size2) {
  return x1 < x2 + size2 && x1 + size1 > x2 && y1 < y2 + size2 && y1 + size1 > y2;
}

function isOverlappingAny(allResources, x, y, size) {
  return Object.values(allResources).flat().some(r => r.size > 0 && checkOverlap(x, y, size, r.x, r.y, r.size));
}

function createResourceSpawner(type, targetArray, isOverlapping) {
  const config = resourceTypes[type];
  if (!config) return;

  let activeCount = targetArray.filter(r => r.size > 0).length;
  let deadCount = targetArray.filter(r => r.size === 0).length;

  while (activeCount + deadCount < config.maxCount) {
    const x = Math.random() * (WORLD_WIDTH - config.size);
    const y = Math.random() * (WORLD_HEIGHT - config.size);

    const id = crypto.randomUUID();
    if (!isOverlapping(x, y, config.size)) {
      const id = crypto.randomUUID();
      targetArray.push({
        id,
        type,
        x,
        y,
        size: config.size,
        health: config.health,
        maxHealth: config.health,
        respawnTimer: 0,
        respawnTime: config.spawntimer
      });
      activeCount++;
    }
  }
}

function spawnAllResources() {
  for (const type in allResources) {
    allResources[type] = allResources[type].filter(r => r.size > 0);
    createResourceSpawner(type, allResources[type], (x, y, size) => isOverlappingAny(allResources, x, y, size));
  }
}

function updateResourceRespawns(deltaTime) {
  for (const resources of Object.values(allResources)) {
    for (const r of resources) {
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        //console.log(r.respawnTimer);
        if (r.respawnTimer <= 0) {
          const config = resourceTypes[r.type];
          let newX, newY;
          do {
            newX = Math.random() * (WORLD_WIDTH - r.size);
            newY = Math.random() * (WORLD_HEIGHT - r.size);
          } while (isOverlappingAny(allResources, newX, newY, config.size));
          r.id = crypto.randomUUID();
          r.x = newX;
          r.y = newY;
          r.size = config.size;
          r.health = config.health;
          r.maxHealth = r.health;
          r.respawnTimer = 0;
        
       

        }
      }
    }
  }
}

module.exports = {
  resourceTypes,
  allResources,
  spawnAllResources,
  updateResourceRespawns
};
