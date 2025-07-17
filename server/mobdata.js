const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 10000;


const GRID_CELL_SIZE = 100;
const GRID_COLS = Math.floor(WORLD_WIDTH / GRID_CELL_SIZE); // 20
const GRID_ROWS = Math.floor(WORLD_HEIGHT / GRID_CELL_SIZE);

let pond = (() => {
  const col = Math.floor(Math.random() * GRID_COLS);
  const row = Math.floor(Math.random() * GRID_ROWS);
  const { x, y } = getRandomPositionInCell(col, row, 50);
  return { x, y, size: 50 };
})();

function getRandomPositionInCell(col, row, size) {
  const minX = col * GRID_CELL_SIZE;
  const minY = row * GRID_CELL_SIZE;
  const maxX = minX + GRID_CELL_SIZE - size;
  const maxY = minY + GRID_CELL_SIZE - size;
  const x = Math.random() * (maxX - minX) + minX;
  const y = Math.random() * (maxY - minY) + minY;
  return { x, y };
}

const CYCLE_LENGTH = 180; // 20 minutes in seconds
const DAY_LENGTH = 120;   // 15 minutes of day, 5 minutes of night

const crypto = require("crypto");

const mobtype = {
  slime: {
    maxCount: 50,
    size: 32,
    health: 100,
    speed: 50,
    color: "pink",
    drop: "slime",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => 6,
    behavior: 'wander',
    damage: 0,
    turnSpeed: Math.PI,
  },
  pig: {
    maxCount: 50,
    size: 32,
    health: 100,
    speed: 50,
    color: "red",
    drop: "stick",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => 6,
    behavior: 'wander',
    damage: 0,
    turnSpeed: Math.PI,
  },
  wolf: {
    maxCount: (gameTime) => gameTime < DAY_LENGTH ? 50 : 70,
    size: 32,
    health: 150,
    speed: 100,
    color: "gray",
    drop: "fur",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => 3,
    behavior: 'wander',
    isAggressive: true,
    aggroRadius: 100,
    escapeRadius: 225,
    damage: 10,
    turnSpeed: Math.PI * 2,
  },
  spider: {
    maxCount: (gameTime) => gameTime < DAY_LENGTH ? 50 : 60,
    size: 32,
    health: 200,
    speed: 100,
    color: "black",
    drop: "web",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => 3,
    behavior: 'wander',
    isAggressive: true,
    aggroRadius: 150,
    escapeRadius: 350,
    damage: 20,
    turnSpeed: Math.PI * 2,
  },
  hamster: {
    maxCount: 50,
    size: 32,
    health: 150,
    speed: 100,
    color: "yellow",
    drop: "paw",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => 3,
    behavior: 'wander',
    damage: 0,
    turnSpeed: Math.PI,
  },
};

const mobs = Object.fromEntries(Object.keys(mobtype).map(type => [type, []]));

function createMobSpawner(type, targetArray, isOverlapping, gameTime) {
  const config = mobtype[type];
  if (!config) return;
  const maxCount = typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount;
  let activeCount = targetArray.filter(r => r.size > 0).length;
  let deadCount = targetArray.filter(r => r.size === 0).length;

  while (activeCount + deadCount < config.maxCount) {
    const col = Math.floor(Math.random() * GRID_COLS);
    const row = Math.floor(Math.random() * GRID_ROWS);
    const { x, y } = getRandomPositionInCell(col, row, config.size);

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
        behavior: config.behavior,
        currentBehavior: config.behavior,
        targetPlayerId: null,
        chaseTimer: 0,
        facingAngle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        turnSpeed: config.turnSpeed,
        moveSpeed: config.speed,
        moveTimer: Math.random() * 3 + 2,
        isTurning: true,
        respawnTimer: 0,
        respawnTime: config.spawntimer,
        damageCooldown: 0,
        threatTable: {}, // Add threatTable to all mobs
        pauseTimer: 0,
      });
      activeCount++;
    }
  }
}

function spawnAllMob(allResources, players, gameTime) {
  for (const type in mobs) {
    mobs[type] = mobs[type].filter(r => r.size > 0);
    createMobSpawner(type, mobs[type], (x, y, size) =>
      isOverlappingAny(allResources, x, y, size) ||
      isOverlappingAny(mobs, x, y, size) ||
      isOverlappingAny(players, x, y, size),
      gameTime
    );
  }
}

function updateMobs(allResources, players, deltaTime) {
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      const config = mobtype[mob.type];
      const mobSize = config.size;

      // Decrease damage cooldown
      if (mob.damageCooldown > 0) {
        mob.damageCooldown -= deltaTime;
      }

      if (mob.pauseTimer > 0) {
        mob.pauseTimer -= deltaTime;
        continue; // Skip all behavior and movement during pause
      }
      // Handle aggressive behavior with threat system
      if (config.isAggressive) {
        // Add players within escape radius to threatTable
        for (const player of Object.values(players)) {
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < config.escapeRadius) {
            if (!mob.threatTable[player.id]) {
              mob.threatTable[player.id] = 0;
            }
          }
        }

        // Update threat levels for players in the threatTable
        for (const playerId in mob.threatTable) {
          const player = players[playerId];
          if (!player) {
            delete mob.threatTable[playerId];
            continue;
          }
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < config.aggroRadius) {
            mob.threatTable[playerId] += 1 * deltaTime; // +1 threat per second
          } else if (distance > config.escapeRadius) {
            const decay = 2 + (mob.threatTable[playerId] / 50); // Soft cap decay
            mob.threatTable[playerId] -= decay * deltaTime;
            if (mob.threatTable[playerId] <= 0) {
              delete mob.threatTable[playerId];
            }
          }
        }

        // Determine the player with the highest threat
        let maxThreat = 0;
        let targetPlayerId = null;
        for (const [playerId, threat] of Object.entries(mob.threatTable)) {
          if (threat > maxThreat) {
            maxThreat = threat;
            targetPlayerId = playerId;
          }
        }

        // Update mob behavior based on threat
        if (targetPlayerId && maxThreat > 0) {
          mob.currentBehavior = 'chase';
          mob.targetPlayerId = targetPlayerId;
        } else {
          mob.currentBehavior = 'wander';
          mob.targetPlayerId = null;
        }
      }

      // Update targetAngle based on behavior
      if (mob.currentBehavior === 'wander') {
        let closestDistance = Infinity;
        let closestPlayer = null;
        for (const player of Object.values(players)) {
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < config.escapeRadius && distance < closestDistance) {
            closestDistance = distance;
            closestPlayer = player;
          }
        }
        if (closestPlayer && mob.moveTimer <= 0 && !mob.isTurning) {
          mob.targetAngle = Math.atan2(closestPlayer.y - mob.y, closestPlayer.x - mob.x);
          mob.moveTimer = Math.random() * 3 + 2;
          mob.isTurning = true;
        } else if (mob.moveTimer <= 0 && !mob.isTurning) {
          mob.targetAngle = Math.random() * Math.PI * 2;
          mob.moveTimer = Math.random() * 3 + 2;
          mob.isTurning = true;
        } else {
          mob.moveTimer -= deltaTime;
        }
      } else if (mob.currentBehavior === 'chase') {
        if (mob.chaseTimer <= 0) {
          const targetPlayer = players[mob.targetPlayerId];
          if (targetPlayer) {
            const dx = targetPlayer.x - mob.x;
            const dy = targetPlayer.y - mob.y;
            mob.targetAngle = Math.atan2(dy, dx);
            mob.chaseTimer = 0.5;
          }
        } else {
          mob.chaseTimer -= deltaTime;
        }
      }

      // Smooth Turning
      const angleDiff = normalizeAngle(mob.targetAngle - mob.facingAngle);
      const turning = Math.abs(angleDiff) > 0.01;
      if (turning) {
        const maxTurn = mob.turnSpeed * deltaTime;
        mob.facingAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
        mob.isTurning = true;
      } else {
        mob.facingAngle = mob.targetAngle;
        mob.isTurning = false;
      }

      // Move if not turning
      if (!mob.isTurning) {
        const dx = Math.cos(mob.facingAngle) * mob.moveSpeed * deltaTime;
        const dy = Math.sin(mob.facingAngle) * mob.moveSpeed * deltaTime;
        const newX = mob.x + dx;
        const newY = mob.y + dy;

        const minX = 0;
        const minY = 0;
        const maxX = WORLD_WIDTH - mobSize;
        const maxY = WORLD_HEIGHT - mobSize;

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

        if (!collideX) mob.x = Math.max(minX, Math.min(maxX, newX));
        if (!collideY) mob.y = Math.max(minY, Math.min(maxY, newY));
      }

      // Check for collision and deal damage
      if (config.isAggressive && mob.currentBehavior === 'chase' && mob.damageCooldown <= 0 && mob.health > 0) {
        const targetPlayer = players[mob.targetPlayerId];
        if (targetPlayer) {
          if (checkOverlap(mob.x, mob.y, mob.size, targetPlayer.x, targetPlayer.y, targetPlayer.size)) {
            const damage = config.damage;
            targetPlayer.health -= damage;
            targetPlayer.lastDamageTime = Date.now();
            if (!targetPlayer.originalColor) {
              targetPlayer.originalColor = targetPlayer.color || "defaultColor"; // fallback if undefined
            }

            targetPlayer.color = "red";

            // Revert color after 300ms
            setTimeout(() => {
              targetPlayer.color = targetPlayer.originalColor;
            }, 100);

            if (targetPlayer.health < 0) targetPlayer.health = 0;
            mob.damageCooldown = 1; // 1 second cooldown

          }
        }
      }
    }
  }
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
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

function updateMobRespawns(deltaTime, allResources, players, gameTime) {
  for (const type in mobs) {
    const config = mobtype[type];
    const maxCount = typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount;
    const mobList = mobs[type];

    // Step 1: Handle respawning of dead mobs
    for (const r of mobList) {
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        if (r.respawnTimer <= 0) {
          let newX, newY;
          let attempts = 0;
          const maxAttempts = 10;
          do {
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, config.size));
            attempts++;
            if (attempts > maxAttempts) {
              console.warn(`Failed to find valid spawn position for ${type} after ${maxAttempts} attempts.`);
              break;
            }
          } while (
            isOverlappingAny(allResources, newX, newY, config.size) ||
            isOverlappingAny(mobs, newX, newY, config.size) ||
            isOverlappingAny(players, newX, newY, config.size)
          );
          if (attempts <= maxAttempts) {
            r.id = crypto.randomUUID();
            r.x = newX;
            r.y = newY;
            r.size = config.size;
            r.health = config.health;
            r.maxHealth = config.health;
            r.respawnTimer = 0;
            r.behavior = config.behavior;
            r.currentBehavior = config.behavior;
            r.targetPlayerId = null;
            r.chaseTimer = 0;
            r.facingAngle = Math.random() * Math.PI * 2;
            r.targetAngle = Math.random() * Math.PI * 2;
            r.turnSpeed = config.turnSpeed;
            r.moveSpeed = config.speed;
            r.moveTimer = Math.random() * 3 + 2;
            r.isTurning = true;
            r.damageCooldown = 0;
            r.threatTable = {};
            r.pauseTimer = 0;
          }
        }
      }
    }

    // Step 2: Adjust total mob instances to match maxCount
    const totalInstances = mobList.length;
    if (totalInstances < maxCount) {
      const toSpawn = maxCount - totalInstances;
      for (let i = 0; i < toSpawn; i++) {
        let newX, newY;
        let attempts = 0;
        const maxAttempts = 10;
        do {
          const col = Math.floor(Math.random() * GRID_COLS);
          const row = Math.floor(Math.random() * GRID_ROWS);
          ({ x: newX, y: newY } = getRandomPositionInCell(col, row, config.size));
          attempts++;
          if (attempts > maxAttempts) {
            console.warn(`Failed to spawn new ${type} after ${maxAttempts} attempts.`);
            break;
          }
        } while (
          isOverlappingAny(allResources, newX, newY, config.size) ||
          isOverlappingAny(mobs, newX, newY, config.size) ||
          isOverlappingAny(players, newX, newY, config.size)
        );
        if (attempts <= maxAttempts) {
          const id = crypto.randomUUID();
          mobList.push({
            id,
            type,
            x: newX,
            y: newY,
            size: config.size,
            health: config.health,
            maxHealth: config.health,
            behavior: config.behavior,
            currentBehavior: config.behavior,
            targetPlayerId: null,
            chaseTimer: 0,
            facingAngle: Math.random() * Math.PI * 2,
            targetAngle: Math.random() * Math.PI * 2,
            turnSpeed: config.turnSpeed,
            moveSpeed: config.speed,
            moveTimer: Math.random() * 3 + 2,
            isTurning: true,
            respawnTimer: 0,
            respawnTime: config.spawntimer,
            damageCooldown: 0,
            threatTable: {},
            pauseTimer: 0,
          });
        }
      }
    }
  }
}

module.exports = {
  pond,
  mobs,
  mobtype,
  DAY_LENGTH,
  CYCLE_LENGTH,
  spawnAllMob,
  updateMobs,
  updateMobRespawns,
};

