
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

let square = {
  x: Math.random() * (2000 - 50), // assuming square size is 50x50
  y: Math.random() * (2000 - 50),
  size: 50,
};

// Server-side

const crypto = require("crypto");
const mobtype = {
  slime: {
    maxCount: 20,
    size: 32,
    hp: 100,
    speed: 50,
    color: "pink",
    itemColor: "pink",
    drop: "slime",
    tools: [
      "hand",
      "wooden_sword",
      "stone_sword",
      "iron_sword",
      "gold_sword"
    ],
    spawntimer: 10, // 🕒 10 seconds (60fps * 10)
    getDropAmount(hp) {
      return 6;
    },
    behavior: 'wander',
  },
  goblin: {
    maxCount: 10,
    size: 32,
    hp: 100,
    speed: 50,
    color: "red",
    itemColor: "red",
    drop: "stick",
    tools: [
      "hand",
      "wooden_sword",
      "stone_sword",
      "iron_sword",
      "gold_sword"
    ],
    spawntimer: 10, // 🕒 10 seconds (60fps * 10)
    getDropAmount(hp) {
      return 6;
    },
    behavior: 'wander',
  },
};

const mobs = {
  slime: [],
  goblin: [],
}; // <-- keep as only an object of arrays

function createMobSpawner(type, targetArray, isOverlapping) {
  const config = mobtype[type];
    if (!config) return;
    halfSize = config.size / 2;
    let activeCount = targetArray.filter(r => r.size > 0).length;
    let deadCount = targetArray.filter(r => r.size === 0).length;
  
    while (activeCount + deadCount < config.maxCount) {
      const x = Math.random() * (WORLD_WIDTH - config.size);
      const y = Math.random() * (WORLD_HEIGHT - config.size);
  
      if (!isOverlapping(x, y, config.size)) {
        const id = crypto.randomUUID();
        targetArray.push({
          id,
          type,
          x,
          y,
          size: config.size,
          hp: config.hp,
          maxHealth: config.hp,
          behavior: config.behavior,
          facingAngle: Math.random() * Math.PI * 2,
          targetAngle: Math.random() * Math.PI * 2,
          turnSpeed: Math.PI, // radians per second (e.g. 180°/sec)
          moveSpeed: config.speed, // pixels per second
          moveTimer: Math.random() * 3 + 2, // in seconds: 2–5 sec
          isTurning: true,
          respawnTimer: 0,
          respawnTime: config.spawntimer
        });
        activeCount++;
      }
    }
}

function spawnAllMob(allResources, players) {
  for (const type in mobs) {
    mobs[type] = mobs[type].filter(r => r.size > 0);
    createMobSpawner(type, mobs[type], (x, y, size) => isOverlappingAny(allResources, x, y, size) ||
    isOverlappingAny(mobs, x, y, size) || isOverlappingAny(players, x, y, size)
    
    );
  }
}

function updateMobs(allResources, deltaTime) {

  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      const config = mobtype[mob.type];
      const mobSize = config.size;
      const halfSize = mobSize / 2;
      // --- Step 1: Smooth Turning ---
      const angleDiff = normalizeAngle(mob.targetAngle - mob.facingAngle);
      const turning = Math.abs(angleDiff) > 0.01;

      if (turning) {
        const maxTurn = mob.turnSpeed * deltaTime; // radians per update
        mob.facingAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
        mob.isTurning = true;
      } else {
        mob.facingAngle = mob.targetAngle;
        mob.isTurning = false;
      }

      // --- Step 2: Move if not turning ---
      if (!mob.isTurning) {
        const dx = Math.cos(mob.facingAngle) * mob.moveSpeed * deltaTime;
        const dy = Math.sin(mob.facingAngle) * mob.moveSpeed * deltaTime;

        const newX = mob.x + dx;
        const newY = mob.y + dy;

        // Boundary checks (top-left based)
        const minX = 0;
        const minY = 0;
        const maxX = WORLD_WIDTH - mobSize;
        const maxY = WORLD_HEIGHT - mobSize;

        // Collision checks
        const collideX = isCollidingWithResources(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          allResources
        );
        const collideY = isCollidingWithResources(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          allResources
        );

        // Update position if no collision
        if (!collideX) mob.x = Math.max(minX, Math.min(maxX, newX));
        if (!collideY) mob.y = Math.max(minY, Math.min(maxY, newY));


        mob.moveTimer -= deltaTime; // now in seconds
      }

      // --- Step 3: Pick new direction ---
      if (mob.moveTimer <= 0 && !mob.isTurning) {
        mob.targetAngle = Math.random() * Math.PI * 2;
        mob.moveTimer = Math.random() * 3 + 2; // in seconds: 2–5 sec
        mob.isTurning = true;
      }
    }
  }
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle)); // keeps angle between -π and π
}

function isOverlappingAny(source, x, y, size) {
  
  if (!source) return false;
  const list = Array.isArray(source)
    ? source
    : Object.values(source || {}).flat();

  return list.some(r => r.size > 0 && checkOverlap(x, y, size, r.x, r.y, r.size));
}


function checkOverlap(x1, y1, size1, x2, y2, size2) {
  return x1 < x2 + size2 &&
         x1 + size1 > x2 &&
         y1 < y2 + size2 &&
         y1 + size1 > y2;
}

function isCollidingWithResources(newX, newY, size, allResources) {
  const all = Object.values(allResources).flat();
  return all.some(resource =>
    resource.size > 0 &&
    checkOverlap(newX, newY, size, resource.x, resource.y, resource.size)
  );
}

function updateMobRespawns(deltaTime, allResources, players) {
  for (const mob of Object.values(mobs)) {
    for (const r of mob) {
      
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        //console.log(r.respawnTimer);
        if (r.respawnTimer <= 0) {
          const config = mobtype[r.type];
          const mobSize = config.size;
          const halfSize = mobSize / 2;
          let newX, newY;
          do {
            newX = (Math.random() * (WORLD_WIDTH - config.size));
            newY = (Math.random() * (WORLD_HEIGHT - config.size));
          } while (
            isOverlappingAny(allResources, newX, newY, config.size) ||
            isOverlappingAny(mobs, newX, newY, config.size) ||
            isOverlappingAny(players, newX, newY, config.size)
          );
          r.id = crypto.randomUUID();
          r.x = newX;
          r.y = newY;
          r.size = config.size;
          r.hp = config.hp;
          r.maxHealth = config.hp;
          r.respawnTimer = 0;
          r.behavior = config.behavior;
          r.facingAngle = Math.random() * Math.PI * 2;
          r.targetAngle = Math.random() * Math.PI * 2;
          r.turnSpeed = Math.PI; // radians per second (e.g. 180°/sec)
          r.moveSpeed = config.speed; // pixels per second
          r.moveTimer = Math.random() * 3 + 2; // in seconds: 2–5 sec
          r.isTurning = true;
          
       

        }
      }
    }
  }
}











module.exports = {
  square,
  mobs,
  mobtype,
  spawnAllMob,
  updateMobs,
  updateMobRespawns,
};
