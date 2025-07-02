// server/resourceManager.js
const WORLD_WIDTH = 20000;
const WORLD_HEIGHT = 20000;

const GRID_CELL_SIZE = 100;
const GRID_COLS = Math.floor(WORLD_WIDTH / GRID_CELL_SIZE);
const GRID_ROWS = Math.floor(WORLD_HEIGHT / GRID_CELL_SIZE);


function getRandomPositionInCell(col, row, size) {
  const minX = col * GRID_CELL_SIZE;
  const minY = row * GRID_CELL_SIZE;
  const maxX = minX + GRID_CELL_SIZE - size;
  const maxY = minY + GRID_CELL_SIZE - size;
  const x = Math.random() * (maxX - minX) + minX;
  const y = Math.random() * (maxY - minY) + minY;
  return { x, y };
}

const crypto = require("crypto");

const {

  mobs,


} = require('./mobdata');

const {

  players,


} = require('./playerdata');


const resourceTypes = {
  food: {
  maxCount: 500,
  size: 32,
  get health() {
    return Math.floor(Math.random() * (30 - 15 + 1)) + 15; // 15–30
  },
  color: "red",
  itemColor: "red",
  drop: "food",
  tools: ["hand"],
  spawntimer: 10,
  getDropAmount(health) {
    return health <= 22.5
      ? Math.floor(Math.random() * 3) + 3   // 3–5
      : Math.floor(Math.random() * 4) + 5;  // 5–8
  }
},
  wood: {
    maxCount: 1000,
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
    maxCount: 500,
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
    spawntimer: 10,
    getDropAmount(health) {
      return health <= 45
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    }
    
  },

  iron: {
    maxCount: 300,
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
    spawntimer: 10,
    getDropAmount(health) {
      return health <= 60
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    }
  },

  gold: {
    maxCount: 100,
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
    spawntimer: 10,
    getDropAmount(health) {
      return health <= 75
        ? Math.floor(Math.random() * 3) + 5   // 5–7
        : Math.floor(Math.random() * 4) + 7;  // 7–10
    }
  }
};

const allResources = {
  food: [],
  wood: [],
  stone: [],
  iron: [],
  gold: []
};


function checkOverlap(x1, y1, size1, x2, y2, size2) {
  return x1 < x2 + size2 && x1 + size1 > x2 && y1 < y2 + size2 && y1 + size1 > y2;
}

function isOverlappingAny(source, x, y, size) {
  if (!source) return false;
  const list = Array.isArray(source)
    ? source
    : Object.values(source || {}).flat();

  return list.some(r => r.size > 0 && checkOverlap(x, y, size, r.x, r.y, r.size));
}




function createResourceSpawner(type, targetArray, isOverlapping) {
  const config = resourceTypes[type];
  if (!config) return;

  let activeCount = targetArray.filter(r => r.size > 0).length;
  let deadCount = targetArray.filter(r => r.size === 0).length;

  while (activeCount + deadCount < config.maxCount) {
    const col = Math.floor(Math.random() * GRID_COLS);
    const row = Math.floor(Math.random() * GRID_ROWS);
    const { x, y } = getRandomPositionInCell(col, row, config.size);
    if (!isOverlapping(x, y, config.size)) {
      const id = crypto.randomUUID();
      const initialHealth = config.health;
      targetArray.push({
        id,
        type,
        x,
        y,
        size: config.size,
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
  for (const type in allResources) {
    allResources[type] = allResources[type].filter(r => r.size > 0);
    createResourceSpawner(type, allResources[type], (x, y, size) => isOverlappingAny(allResources, x, y, size) ||
    isOverlappingAny(mobs, x, y, size) || isOverlappingAny(players, x, y, size)
    
  );

    
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
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ newX, newY } = getRandomPositionInCell(col, row, config.size));
          } while (
            isOverlappingAny(allResources, newX, newY, config.size) ||
            isOverlappingAny(mobs, newX, newY, config.size) ||
            isOverlappingAny(players, newX, newY, config.size)
          );
          const newHealth = config.health;
          r.id = crypto.randomUUID();
          r.x = newX;
          r.y = newY;
          r.size = config.size;
          r.health = newHealth;
          r.maxHealth = newHealth;
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
  updateResourceRespawns,
  isOverlappingAny
};
