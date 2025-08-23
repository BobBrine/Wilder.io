const WORLD_SIZE = 5000;

const GRID_CELL_SIZE = 100;
const GRID_COLS = Math.floor(WORLD_SIZE / GRID_CELL_SIZE);
const GRID_ROWS = Math.floor(WORLD_SIZE / GRID_CELL_SIZE);

function getRandomPositionInCell(col, row, sizeX, sizeY) {
  const minX = col * GRID_CELL_SIZE;
  const minY = row * GRID_CELL_SIZE;
  const maxX = minX + GRID_CELL_SIZE - sizeX;
  const maxY = minY + GRID_CELL_SIZE - sizeY;
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
    maxCount: 50,
    sizeX: 32,
    sizeY: 32,
    get health() { return Math.floor(Math.random() * (25 - 15 + 1)) + 15; },
    color: "red",
    drop: "food",
    requiredTool: { categories: ["hand"], minTier: 0 },
    spawntimer: 8, // faster regen for early game
    getDropAmount(health) { return health <= 20 ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 4) + 4; }
  },

  wood: {
    maxCount: 80,
    get sizeX() {
      const min = 48;
      const maxArea = 8192;
      const x = Math.floor(Math.random() * ((maxArea / min) - min + 1)) + min;
      return x;
    },
    get sizeY() {
      const maxArea = 8192;
      const x = this.sizeX;
      return Math.floor(maxArea / x);
    },
    get health() { return Math.floor(Math.random() * (35 - 20 + 1)) + 20; },
    color: "green",
    drop: "wood",
    requiredTool: { categories: ["hand", "axe"], minTier: 0 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 28 ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 4) + 5; }
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

const allResources = {
  food: [],
  wood: [],
  stone: [],
  iron: [],
  gold: []
};

function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
  return x1 < x2 + sizeX2 && x1 + sizeX1 > x2 && y1 < y2 + sizeY2 && y1 + sizeY1 > y2;
}

function isOverlappingAny(source, x, y, sizeX, sizeY) {
  if (!source) return false;
  const list = Array.isArray(source)
    ? source
    : Object.values(source || {}).flat();

  return list.some(r => {
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
    const col = Math.floor(Math.random() * GRID_COLS);
    const row = Math.floor(Math.random() * GRID_ROWS);
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
  for (const type in allResources) {
    allResources[type] = allResources[type].filter(r => r.sizeX > 0 && r.sizeY > 0);
    createResourceSpawner(type, allResources[type], (x, y, sizeX, sizeY) => 
      isOverlappingAny(allResources, x, y, sizeX, sizeY) ||
      isOverlappingAny(mobs, x, y, sizeX, sizeY) || 
      isOverlappingAny(players, x, y, sizeX, sizeY)
    );
  }
}

function updateResourceRespawns(deltaTime) {
  for (const resources of Object.values(allResources)) {
    for (const r of resources) {
      if ((r.sizeX === 0 || r.sizeY === 0) && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        if (r.respawnTimer <= 0) {
          const config = resourceTypes[r.type];
          let newX, newY, newSizeX, newSizeY;
          do {
            newSizeX = typeof config.sizeX === 'function' ? config.sizeX() : config.sizeX;
            newSizeY = typeof config.sizeY === 'function' ? config.sizeY() : config.sizeY;
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, newSizeX, newSizeY));
          } while (
            isOverlappingAny(allResources, newX, newY, newSizeX, newSizeY) ||
            isOverlappingAny(mobs, newX, newY, newSizeX, newSizeY) ||
            isOverlappingAny(players, newX, newY, newSizeX, newSizeY)
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

module.exports = {
  resourceTypes,
  allResources,
  spawnAllResources,
  updateResourceRespawns,
  isOverlappingAny
};