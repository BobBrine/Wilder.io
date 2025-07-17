// server/resourceManager.js
const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 10000;

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
    get health() { return Math.floor(Math.random() * (30 - 15 + 1)) + 15; },
    color: "red",
    drop: "food",
    requiredTool: { categories: ["hand"], minTier: 0 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 22.5 ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 4) + 5; }
  },
  wood: {
    maxCount: 1000,
    size: 32,
    get health() { return Math.floor(Math.random() * (40 - 20 + 1)) + 20; },
    color: "green",
    drop: "wood",
    requiredTool: { categories: ["hand", "axe"], minTier: 0 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 30 ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 4) + 7; }
  },
  stone: {
    maxCount: 500,
    size: 32,
    get health() { return Math.floor(Math.random() * (60 - 30 + 1)) + 30; },
    color: "darkgray",
    drop: "stone",
    requiredTool: { categories: ["pickaxe"], minTier: 1 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 45 ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 4) + 7; }
  },
  iron: {
    maxCount: 300,
    size: 32,
    get health() { return Math.floor(Math.random() * (80 - 40 + 1)) + 40; },
    color: "white",
    drop: "iron",
    requiredTool: { categories: ["pickaxe"], minTier: 2 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 60 ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 4) + 7; }
  },
  gold: {
    maxCount: 100,
    size: 32,
    get health() { return Math.floor(Math.random() * (100 - 50 + 1)) + 50; },
    color: "gold",
    drop: "gold",
    requiredTool: { categories: ["pickaxe"], minTier: 3 },
    spawntimer: 10,
    getDropAmount(health) { return health <= 75 ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 4) + 7; }
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
