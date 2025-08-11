const WORLD_SIZE = 5000;

const GRID_CELL_SIZE = 100;
const GRID_COLS = Math.floor(WORLD_SIZE / GRID_CELL_SIZE); // 50
const GRID_ROWS = Math.floor(WORLD_SIZE / GRID_CELL_SIZE);

let difficulty = 1; // Set difficulty level (1 = normal, 2 = hard, etc.)
const gameTime = 0; // Example game time
const mobtype = initializeMobTypes(gameTime, difficulty);
const mobs = Object.fromEntries(Object.keys(mobtype).map(type => [type, []]));

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

const crypto = require("crypto");
const CYCLE_LENGTH = 180; // 20 minutes in seconds

// Constants
const passiveColors = ["green", "lightblue", "pink"];
const aggressiveColors = [ "#560202ff", "#000000", "#505050ff" ];
const DAY_LENGTH = 120; // 15 minutes of day, 5 minutes of night

// Helper function to generate random numbers within a range
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to generate a passive mob type with fixed, difficulty-scaled stats
function generatePassiveMobType(id, difficulty) {
  const baseTurnSpeed = Math.PI;
  const turnSpeed = baseTurnSpeed * (1 + 0.1 * (difficulty - 1));
  const dropAmount = 1 * difficulty; // Drops one "pure core"

  // Use midpoint of previous ranges as base, then scale with difficulty
  const fixedHealth = 100 * (1 + 0.5 * (difficulty - 1)); // avg of 50..150
  const fixedSize = 30 * (1 + 0.2 * (difficulty - 1));   // avg of 20..40
  const fixedSpeed = 50 * (1 + 0.2 * (difficulty - 1));  // avg of 30..70

  return {
    maxCount: 20,
    size: fixedSize,
    health: fixedHealth,
    speed: fixedSpeed,
    color: () => passiveColors[Math.floor(Math.random() * passiveColors.length)],
    drop: "pure_core",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => dropAmount,
    behavior: 'wander',
    damage: 0,
    turnSpeed,
  };
}

// Function to generate an aggressive mob type with profiles (fixed stats)
function generateAggressiveMobType(id, gameTime, difficulty, totalMaxCount = 20) {
  const baseTurnSpeed = Math.PI * 2;
  const turnSpeed = baseTurnSpeed * (1 + 0.1 * (difficulty - 1));
  const baseAggroRadius = 100;
  const baseEscapeRadius = 225;
  const aggroRadius = baseAggroRadius * (1 + 0.2 * (difficulty - 1));
  const escapeRadius = baseEscapeRadius * (1 + 0.2 * (difficulty - 1));
  const baseDropAmount = 1 * difficulty;
  const attackSpeedScale = 1 + 0.2 * (difficulty - 1);

  return {
    maxCount: (gameTime) => (gameTime < DAY_LENGTH ? totalMaxCount : totalMaxCount * 1), // *1.4
    profiles: {
      tank: {
        count: (gameTime) => Math.floor((gameTime < DAY_LENGTH ? totalMaxCount : totalMaxCount * 1.4) * 0.2),
        health: 250 * (1 + 0.5 * (difficulty - 1)), // avg of 200..300
        size: 50 * (1 + 0.2 * (difficulty - 1)),   // avg of 40..60
        speed: 30 * (1 + 0.2 * (difficulty - 1)),  // avg of 20..40
        damage: 20 * (1 + 0.3 * (difficulty - 1)), // avg of 15..25
  attackspeed: 0.7 * attackSpeedScale, // slow
      },
      speedster: {
        count: (gameTime) => Math.floor((gameTime < DAY_LENGTH ? totalMaxCount : totalMaxCount * 1.4) * 0.2),
        health: 75 * (1 + 0.5 * (difficulty - 1)),  // avg of 50..100
        size: 20 * (1 + 0.2 * (difficulty - 1)),    // avg of 15..25
        speed: 100 * (1 + 0.2 * (difficulty - 1)),  // avg of 80..120
        damage: 7.5 * (1 + 0.3 * (difficulty - 1)), // avg of 5..10
  attackspeed: 1.5 * attackSpeedScale, // fast
      },
      longRange: {
        count: (gameTime) => Math.floor((gameTime < DAY_LENGTH ? totalMaxCount : totalMaxCount * 1.4) * 0.2),
        health: 115 * (1 + 0.5 * (difficulty - 1)), // avg of 80..150
        size: 25 * (1 + 0.2 * (difficulty - 1)),    // avg of 20..30
        speed: 75 * (1 + 0.2 * (difficulty - 1)),   // avg of 60..90
        damage: 10 * (1 + 0.3 * (difficulty - 1)),  // avg of 8..12
        aggroRadius: aggroRadius * 1.5,
        escapeRadius: escapeRadius * 1.5,
  attackspeed: 1 * attackSpeedScale, // normal = 1
      },
      balanced: {
        count: (gameTime) => Math.floor((gameTime < DAY_LENGTH ? totalMaxCount : totalMaxCount * 1.4) * 0.4),
        health: 150 * (1 + 0.5 * (difficulty - 1)), // avg of 100..200
        size: 30 * (1 + 0.2 * (difficulty - 1)),    // avg of 25..35
        speed: 65 * (1 + 0.2 * (difficulty - 1)),   // avg of 50..80
  damage: 12.5 * (1 + 0.3 * (difficulty - 1)),// avg of 10..15
  attackspeed: 1 * attackSpeedScale, // normal = 1
      },
    },
    color: () => aggressiveColors[Math.floor(Math.random() * aggressiveColors.length)],
    drop: "dark_core",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: () => baseDropAmount,
    behavior: 'wander',
    isAggressive: true,
    aggroRadius,
    escapeRadius,
    turnSpeed,
  };
}

// Function to generate a special aggressive mob
function generateSpecialAggressiveMobType(id, gameTime, difficulty) {
  const baseTurnSpeed = Math.PI * 2;
  const turnSpeed = baseTurnSpeed * (1 + 0.1 * (difficulty - 1));
  const aggroRadius = 200 * (1 + 0.2 * (difficulty - 1));
  const escapeRadius = 400 * (1 + 0.2 * (difficulty - 1));
  const baseDropAmount = 3 * difficulty;
  const attackSpeedScale = 1 + 0.2 * (difficulty - 1);

  // Fixed values based on previous midpoints
  const fixedHealth = 500 * (1 + 0.5 * (difficulty - 1)); // avg of 400..600
  const fixedSize = 30 * (1 + 0.2 * (difficulty - 1));    // avg of 25..35
  const fixedSpeed = 100 * (1 + 0.2 * (difficulty - 1));  // avg of 80..120
  const fixedDamage = 30 * (1 + 0.3 * (difficulty - 1));  // avg of 25..35

  return {
    maxCount: 1,
    size: fixedSize,
    health: fixedHealth,
    speed: fixedSpeed,
  attackspeed: 1.5 * attackSpeedScale, // special = fast
    color: "white",
    drop: ["pure_core", "dark_core", "mythic_core"],
    requiredTool: { categories: ["sword"], minTier: 2 },
    spawntimer: 60,
    getDropAmount: () => [
      { type: "pure_core", amount: baseDropAmount },
      { type: "dark_core", amount: baseDropAmount },
      { type: "mythic_core", amount: 1 },
    ],
    behavior: 'wander',
    isAggressive: true,
    aggroRadius,
    escapeRadius,
    damage: fixedDamage,
    turnSpeed,
  };
}

// Generate mob types and update mobtype object
function initializeMobTypes(gameTime, difficulty) {
  const mobtype = {
    passive_mob: generatePassiveMobType("passive_mob", difficulty),
    aggressive_mob: generateAggressiveMobType("aggressive_mob", gameTime, difficulty),
    special_mob: generateSpecialAggressiveMobType("special_mob", gameTime, difficulty),
  };
  return mobtype;
}

// Modified createMobSpawner to handle profiles and scale attributes
function createMobSpawner(type, targetArray, isOverlapping, gameTime) {
  const config = mobtype[type];
  if (!config) return;

  const maxCount = typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount;
  let activeCount = targetArray.filter(r => r.size > 0).length;

  let profiles = {};
  if (type === "aggressive_mob") {
    profiles = config.profiles;
  } else {
    profiles.default = {
      // Fixed stats for non-aggressive types
      health: config.health,
      size: config.size,
      speed: config.speed,
      damage: config.damage || 0,
      aggroRadius: config.aggroRadius || 0,
      escapeRadius: config.escapeRadius || 0,
  attackspeed: config.attackspeed || 1,
    };
  }

  for (const [profileName, profile] of Object.entries(profiles)) {
  const profileMaxCount = typeof profile.count === 'function' ? profile.count(gameTime) : (typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount || 1);
    let profileActiveCount = targetArray.filter(r => r.size > 0 && r.profile === profileName).length;

    while (profileActiveCount < profileMaxCount) {
      const health = profile.health;
      const size = profile.size;
      const damage = profile.damage ? profile.damage : 0;
      const speed = profile.speed;
  const aggroRadius = profile.aggroRadius || config.aggroRadius || 0;
      const escapeRadius = profile.escapeRadius || config.escapeRadius || 0;
  const attackspeed = profile.attackspeed || 1;

      const col = Math.floor(Math.random() * GRID_COLS);
      const row = Math.floor(Math.random() * GRID_ROWS);
      const { x, y } = getRandomPositionInCell(col, row, size);

      if (!isOverlapping(x, y, size, size)) {
        const id = crypto.randomUUID();
        const color = typeof config.color === "function" ? config.color() : config.color;
        targetArray.push({
          id,
          type,
          profile: profileName,
          x,
          y,
          size,
          health,
          maxHealth: health,
          moveSpeed: speed,
          damage,
          attackspeed,
          behavior: config.behavior,
          currentBehavior: config.behavior,
          targetPlayerId: null,
          chaseTimer: 0,
          facingAngle: Math.random() * Math.PI * 2,
          targetAngle: Math.random() * Math.PI * 2,
          turnSpeed: config.turnSpeed,
          moveTimer: Math.random() * 3 + 2,
          isTurning: true,
          respawnTimer: 0,
          respawnTime: config.spawntimer,
          damageCooldown: 0,
          threatTable: {},
          pauseTimer: 0,
          color,
          aggroRadius,
          escapeRadius,
        });
        profileActiveCount++;
        activeCount++;
      }
    }
  }
}

// Modified updateMobRespawns to handle profiles
function updateMobRespawns(deltaTime, allResources, players, gameTime) {
  for (const type in mobs) {
    const config = mobtype[type];
    const maxCount = typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount;
    const mobList = mobs[type];

    let profiles = {};
    if (type === "aggressive_mob") {

  // Knockback mob: Prevent mob from entering resources
  function applyKnockbackToMob(mob, knockbackVX, knockbackVY, duration, allResources) {
    if (!mob || mob.health <= 0) return;
    // Calculate new position after knockback
    const newX = mob.x + knockbackVX * duration;
    const newY = mob.y + knockbackVY * duration;
    const mobSize = mob.size || 0;
    // Use isOverlappingAny from resourceManager
    const { isOverlappingAny } = require('./resourceManager');
    // Prevent mob from entering resources
    if (!isOverlappingAny(allResources, newX, newY, mobSize, mobSize)) {
      mob.x = newX;
      mob.y = newY;
    } else {
      // Optionally, slide along the edge or cancel knockback
      // For now, just cancel knockback if overlap
      // You can implement sliding logic if needed
    }
  }
      profiles = config.profiles;
    } else {
      profiles.default = {
        count: () => maxCount,
        health: config.health,
        size: config.size,
        speed: config.speed,
        damage: config.damage || 0,
        aggroRadius: config.aggroRadius || 0,
        escapeRadius: config.escapeRadius || 0,
  attackspeed: config.attackspeed || 1,
      };
    }

    for (const r of mobList) {
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        if (r.respawnTimer <= 0) {
          const profile = profiles[r.profile || "default"];
          const health = profile.health;
          const size = profile.size;
          const damage = profile.damage ? profile.damage : 0;
          const speed = profile.speed;
          const aggroRadius = profile.aggroRadius || config.aggroRadius || 0;
          const escapeRadius = profile.escapeRadius || config.escapeRadius || 0;
          const attackspeed = profile.attackspeed || 1;
          const color = typeof config.color === "function" ? config.color() : config.color;

          let newX, newY;
          let attempts = 0;
          const maxAttempts = 10;
          do {
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, size));
            attempts++;
            if (attempts > maxAttempts) {
              console.warn(`Failed to find valid spawn position for ${type} (${r.profile}) after ${maxAttempts} attempts.`);
              break;
            }
          } while (
            mobPositionBlocked(newX, newY, size, allResources, players, mobs, null, size * 0.4) ||
            checkOverlap(newX, newY, size, size, pond.x, pond.y, pond.size, pond.size)
          );
          if (attempts <= maxAttempts) {
            r.id = crypto.randomUUID();
            r.x = newX;
            r.y = newY;
            r.size = size;
            r.health = health;
            r.maxHealth = health;
            r.moveSpeed = speed;
            r.damage = damage;
            r.attackspeed = attackspeed;
            r.color = color;
            r.aggroRadius = aggroRadius;
            r.escapeRadius = escapeRadius;
            r.respawnTimer = 0;
            r.behavior = config.behavior;
            r.currentBehavior = config.behavior;
            r.targetPlayerId = null;
            r.chaseTimer = 0;
            r.facingAngle = Math.random() * Math.PI * 2;
            r.targetAngle = Math.random() * Math.PI * 2;
            r.turnSpeed = config.turnSpeed;
            r.moveTimer = Math.random() * 3 + 2;
            r.isTurning = true;
            r.damageCooldown = 0;
            r.threatTable = {};
            r.pauseTimer = 0;
          }
        }
      }
    }

    const totalInstances = mobList.length;
    if (totalInstances < maxCount) {
      const toSpawn = maxCount - totalInstances;
      for (const [profileName, profile] of Object.entries(profiles)) {
        const profileMaxCount = profile.count(gameTime);
        const profileCurrentCount = mobList.filter(r => r.profile === profileName).length;
        const profileToSpawn = Math.min(profileMaxCount - profileCurrentCount, toSpawn);
        for (let i = 0; i < profileToSpawn; i++) {
          const health = profile.health;
          const size = profile.size;
          const damage = profile.damage ? profile.damage : 0;
          const speed = profile.speed;
          const aggroRadius = profile.aggroRadius || config.aggroRadius || 0;
          const escapeRadius = profile.escapeRadius || config.escapeRadius || 0;
          const attackspeed = profile.attackspeed || 1;
          const color = typeof config.color === "function" ? config.color() : config.color;

          let newX, newY;
          let attempts = 0;
          const maxAttempts = 10;
          do {
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, size));
            attempts++;
            if (attempts > maxAttempts) {
              console.warn(`Failed to spawn new ${type} (${profileName}) after ${maxAttempts} attempts.`);
              break;
            }
          } while (
            mobPositionBlocked(newX, newY, size, allResources, players, mobs, null, size * 0.4) ||
            checkOverlap(newX, newY, size, size, pond.x, pond.y, pond.size, pond.size)
          );
          if (attempts <= maxAttempts) {
            const id = crypto.randomUUID();
            mobList.push({
              id,
              type,
              profile: profileName,
              x: newX,
              y: newY,
              size,
              health,
              maxHealth: health,
              moveSpeed: speed,
              damage,
              attackspeed,
              color,
              aggroRadius,
              escapeRadius,
              behavior: config.behavior,
              currentBehavior: config.behavior,
              targetPlayerId: null,
              chaseTimer: 0,
              facingAngle: Math.random() * Math.PI * 2,
              targetAngle: Math.random() * Math.PI * 2,
              turnSpeed: config.turnSpeed,
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
}

function spawnAllMob(allResources, players, gameTime) {
  let totalMobCount = 0;
  for (const type in mobs) {
    mobs[type] = mobs[type].filter(r => r.size > 0);
    createMobSpawner(
      type,
      mobs[type],
      (x, y, sizeX, sizeY) => {
        const overlapMargin = sizeX * 0.4;
        return (
          mobPositionBlocked(x, y, sizeX, allResources, players, mobs, null, overlapMargin) ||
          checkOverlap(x, y, sizeX, sizeY, pond.x, pond.y, pond.size, pond.size)
        );
      },
      gameTime
    );
    const activeCount = mobs[type].filter(r => r.size > 0).length;
    totalMobCount += activeCount;
  }
  console.log(`Total mobs spawned: ${totalMobCount} (${Object.entries(mobs).map(([type, list]) => `${type}: ${list.filter(r => r.size > 0).length}`).join(', ')})`);
}

let ioRef = null;
function setIO(ioInstance) { ioRef = ioInstance; }

// Shared centered-collider helpers (consistent with updateMobs collision rules)
function getCenterPos(x, y, size) {
  return { cx: x + size / 2, cy: y + size / 2 };
}

function mobCollideResourcesCentered(newX, newY, size, allResources, overlapMargin) {
  const { cx, cy } = getCenterPos(newX, newY, size);
  const all = Object.values(allResources || {}).flat();
  return all.some(resource => {
    if (resource.sizeX > 0 && resource.sizeY > 0) {
      const rcx = resource.x + resource.sizeX / 2;
      const rcy = resource.y + resource.sizeY / 2;
      const minDistX = (size + resource.sizeX) / 2 - overlapMargin;
      const minDistY = (size + resource.sizeY) / 2 - overlapMargin;
      return Math.abs(cx - rcx) < minDistX && Math.abs(cy - rcy) < minDistY;
    }
    return false;
  });
}

function mobCollideMobsCentered(newX, newY, size, selfMob, mobsObj, overlapMargin) {
  const { cx, cy } = getCenterPos(newX, newY, size);
  const allMobs = Object.values(mobsObj || {}).flat();
  return allMobs.some(otherMob => {
    if (otherMob !== selfMob && otherMob.size > 0) {
      const mobColliderSize = otherMob.size * 0.4;
      const offset = (otherMob.size - mobColliderSize) / 2;
      const ocx = otherMob.x + offset + mobColliderSize / 2;
      const ocy = otherMob.y + offset + mobColliderSize / 2;
      const minDistX = (size + mobColliderSize) / 2 - overlapMargin;
      const minDistY = (size + mobColliderSize) / 2 - overlapMargin;
      return Math.abs(cx - ocx) < minDistX && Math.abs(cy - ocy) < minDistY;
    }
    return false;
  });
}

function mobCollidePlayersCentered(newX, newY, size, playersObj, overlapMargin) {
  const { cx, cy } = getCenterPos(newX, newY, size);
  return Object.values(playersObj || {}).some(player => {
    if (player.size > 0) {
      const playerColliderSize = player.size * 0.6;
      const offset = (player.size - playerColliderSize) / 2;
      const pcx = player.x + offset + playerColliderSize / 2;
      const pcy = player.y + offset + playerColliderSize / 2;
      const minDistX = (size + playerColliderSize) / 2 - overlapMargin;
      const minDistY = (size + playerColliderSize) / 2 - overlapMargin;
      return Math.abs(cx - pcx) < minDistX && Math.abs(cy - pcy) < minDistY;
    }
    return false;
  });
}

function mobPositionBlocked(newX, newY, size, allResources, playersObj, mobsObj, selfMob, overlapMargin) {
  return (
    mobCollideResourcesCentered(newX, newY, size, allResources, overlapMargin) ||
    mobCollideMobsCentered(newX, newY, size, selfMob, mobsObj, overlapMargin) ||
    mobCollidePlayersCentered(newX, newY, size, playersObj, overlapMargin)
  );
}

// Helper for server: consistent collision rule used during knockback resolution
function isMobPosBlockedForServer(newX, newY, size, allResources, playersObj, mobsObj, selfMob) {
  const overlapMargin = size * 0.4; // keep in sync with client and spawn logic
  return mobPositionBlocked(newX, newY, size, allResources, playersObj, mobsObj, selfMob, overlapMargin);
}

function updateMobs(allResources, players, deltaTime) {
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      const config = mobtype[mob.type];
      const mobSize = mob.size;

      if (mob.damageCooldown > 0) {
        mob.damageCooldown -= deltaTime;
      }

      if (mob.pauseTimer > 0) {
        mob.pauseTimer -= deltaTime;
        continue;
      }

      if (config.isAggressive) {
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
            mob.threatTable[playerId] += 1 * deltaTime;
          } else if (distance > config.escapeRadius) {
            const decay = 2 + (mob.threatTable[playerId] / 50);
            mob.threatTable[playerId] -= decay * deltaTime;
            if (mob.threatTable[playerId] <= 0) {
              delete mob.threatTable[playerId];
            }
          }
        }

        let maxThreat = 0;
        let targetPlayerId = null;
        for (const [playerId, threat] of Object.entries(mob.threatTable)) {
          if (threat > maxThreat) {
            maxThreat = threat;
            targetPlayerId = playerId;
          }
        }

        if (targetPlayerId && maxThreat > 0) {
          mob.currentBehavior = 'chase';
          mob.targetPlayerId = targetPlayerId;
        } else {
          mob.currentBehavior = 'wander';
          mob.targetPlayerId = null;
        }
      }

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

      if (!mob.isTurning) {
        // Base intended movement from AI
        let moveDx = Math.cos(mob.facingAngle) * mob.moveSpeed * deltaTime;
        let moveDy = Math.sin(mob.facingAngle) * mob.moveSpeed * deltaTime;

        // Apply knockback velocity if active
        if (mob.kbTimer && mob.kbTimer > 0) {
          moveDx += (mob.kbVx || 0) * deltaTime;
          moveDy += (mob.kbVy || 0) * deltaTime;
          // Faster damping for snappier knockback
          const damp = 2.8; // increased damping for more responsive feel
          mob.kbVx *= Math.max(0, 1 - damp * deltaTime);
          mob.kbVy *= Math.max(0, 1 - damp * deltaTime);
          mob.kbTimer -= deltaTime;
          if (mob.kbTimer <= 0 || (Math.abs(mob.kbVx) + Math.abs(mob.kbVy)) < 3) {
            mob.kbTimer = 0;
            mob.kbVx = 0;
            mob.kbVy = 0;
          }
        }

        const newX = mob.x + moveDx;
        const newY = mob.y + moveDy;

        const minX = 0;
        const minY = 0;
        const maxX = WORLD_SIZE - mobSize;
        const maxY = WORLD_SIZE - mobSize;

      

        // Allow mobs to overlap resources and other mobs by a margin
        const overlapMargin = mobSize * 0.4; // 40% overlap allowed
        // Helper to get center coordinates
        function getCenter(x, y, size) {
          return { cx: x + size / 2, cy: y + size / 2 };
        }
        // Centered collision check for resources
        function isCollidingWithResourcesCentered(newX, newY, size, allResources) {
          const { cx, cy } = getCenter(newX, newY, size);
          const all = Object.values(allResources).flat();
          return all.some(resource => {
            if (resource.sizeX > 0 && resource.sizeY > 0) {
              const rcx = resource.x + resource.sizeX / 2;
              const rcy = resource.y + resource.sizeY / 2;
              const minDistX = (size + resource.sizeX) / 2 - overlapMargin;
              const minDistY = (size + resource.sizeY) / 2 - overlapMargin;
              return Math.abs(cx - rcx) < minDistX && Math.abs(cy - rcy) < minDistY;
            }
            return false;
          });
        }
        function isCollidingWithMobsCentered(newX, newY, size, selfMob) {
          const { cx, cy } = getCenter(newX, newY, size); // Center of moving mob's full size
          const allMobs = Object.values(mobs).flat();
          return allMobs.some(otherMob => {
            if (otherMob !== selfMob && otherMob.size > 0) {
              const mobColliderSize = otherMob.size * 0.4; // Use 60% of otherMob.size as collider size
              const offset = (otherMob.size - mobColliderSize) / 2; // Offset to center the collider
              const ocx = otherMob.x + offset + mobColliderSize / 2; // Center X of other mob's collider
              const ocy = otherMob.y + offset + mobColliderSize / 2; // Center Y of other mob's collider
              const minDistX = (size + mobColliderSize) / 2 - overlapMargin;
              const minDistY = (size + mobColliderSize) / 2 - overlapMargin;
              return Math.abs(cx - ocx) < minDistX && Math.abs(cy - ocy) < minDistY;
            }
            return false;
          });
        }
        // Centered collision check for players
        function isCollidingWithPlayersCentered(newX, newY, size, players) {
          const { cx, cy } = getCenter(newX, newY, size);
          return Object.values(players).some(player => {
            if (player.size > 0) {
              const playerColliderSize = player.size * 0.6;
              const offset = (player.size - playerColliderSize) / 2; // Center the smaller collider
              const playerCenterX = player.x + offset + playerColliderSize / 2;
              const playerCenterY = player.y + offset + playerColliderSize / 2;
              const minDistX = (size + playerColliderSize) / 2 - overlapMargin;
              const minDistY = (size + playerColliderSize) / 2 - overlapMargin;
              return Math.abs(cx - playerCenterX) < minDistX && Math.abs(cy - playerCenterY) < minDistY;
            }
            return false;
          });
        }

        const collideX = isCollidingWithResourcesCentered(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          allResources
        ) || isCollidingWithMobsCentered(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          mob
        ) || isCollidingWithPlayersCentered(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          players
        );

        const collideY = isCollidingWithResourcesCentered(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          allResources
        ) || isCollidingWithMobsCentered(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          mob
        ) || isCollidingWithPlayersCentered(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          players
        );

        if (!collideX) mob.x = Math.max(minX, Math.min(maxX, newX));
        if (!collideY) mob.y = Math.max(minY, Math.min(maxY, newY));
        // If both axes blocked (likely tight overlap) attempt gentle separation (mobs first, then resources)
  if (collideX && collideY) {
          const { cx, cy } = getCenterPos(mob.x, mob.y, mobSize);
          let bestSep = null;
          let bestScore = 0;
          // Prefer separating from overlapping mobs
          for (const other of Object.values(mobs).flat()) {
            if (other === mob || other.size <= 0) continue;
            const otherColliderSize = other.size * 0.4;
            const offset = (other.size - otherColliderSize) / 2;
            const ocx = other.x + offset + otherColliderSize / 2;
            const ocy = other.y + offset + otherColliderSize / 2;
            const minDistX = (mobSize + otherColliderSize) / 2 - overlapMargin;
            const minDistY = (mobSize + otherColliderSize) / 2 - overlapMargin;
            const dx = cx - ocx;
            const dy = cy - ocy;
            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            if (adx < minDistX && ady < minDistY) {
              const overlapX = minDistX - adx;
              const overlapY = minDistY - ady;
              const score = overlapX * overlapY;
              if (score > bestScore) {
                bestScore = score;
                bestSep = { dx, dy, overlapX, overlapY };
              }
            }
          }
          // If still stuck, push away from overlapping resources (trees/rocks)
          if (!bestSep) {
            for (const res of Object.values(allResources).flat()) {
              if (!res || res.sizeX <= 0 || res.sizeY <= 0) continue;
              const rcx = res.x + res.sizeX / 2;
              const rcy = res.y + res.sizeY / 2;
              const minDistX = (mobSize + res.sizeX) / 2 - overlapMargin;
              const minDistY = (mobSize + res.sizeY) / 2 - overlapMargin;
              const dx = cx - rcx;
              const dy = cy - rcy;
              const adx = Math.abs(dx);
              const ady = Math.abs(dy);
              if (adx < minDistX && ady < minDistY) {
                const overlapX = minDistX - adx;
                const overlapY = minDistY - ady;
                const score = overlapX * overlapY;
                if (score > bestScore) {
                  bestScore = score;
                  bestSep = { dx, dy, overlapX, overlapY };
                }
              }
            }
          }
          if (bestSep) {
            if (bestSep.overlapX < bestSep.overlapY) {
              const push = bestSep.overlapX * 0.6;
              mob.x += (bestSep.dx >= 0 ? push : -push);
            } else {
              const push = bestSep.overlapY * 0.6;
              mob.y += (bestSep.dy >= 0 ? push : -push);
            }
            mob.x = Math.max(minX, Math.min(maxX, mob.x));
            mob.y = Math.max(minY, Math.min(maxY, mob.y));
          }
        }

        // Final guarantee: if still overlapping any resource (e.g., due to idle server/no players),
        // push the mob out along the least-penetration axis so it can't remain stuck inside.
        if (mobCollideResourcesCentered(mob.x, mob.y, mobSize, allResources, overlapMargin)) {
          const { cx, cy } = getCenterPos(mob.x, mob.y, mobSize);
          let bestRes = null;
          let bestScore = 0;
          for (const res of Object.values(allResources).flat()) {
            if (!res || res.sizeX <= 0 || res.sizeY <= 0) continue;
            const rcx = res.x + res.sizeX / 2;
            const rcy = res.y + res.sizeY / 2;
            const minDistX = (mobSize + res.sizeX) / 2 - overlapMargin;
            const minDistY = (mobSize + res.sizeY) / 2 - overlapMargin;
            const dx = cx - rcx;
            const dy = cy - rcy;
            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            if (adx < minDistX && ady < minDistY) {
              const overlapX = minDistX - adx;
              const overlapY = minDistY - ady;
              const score = overlapX * overlapY;
              if (score > bestScore) {
                bestScore = score;
                bestRes = { dx, dy, overlapX, overlapY };
              }
            }
          }
          if (bestRes) {
            if (bestRes.overlapX < bestRes.overlapY) {
              const push = bestRes.overlapX * 0.8; // stronger push to fully clear resource
              mob.x += (bestRes.dx >= 0 ? push : -push);
            } else {
              const push = bestRes.overlapY * 0.8;
              mob.y += (bestRes.dy >= 0 ? push : -push);
            }
            mob.x = Math.max(minX, Math.min(maxX, mob.x));
            mob.y = Math.max(minY, Math.min(maxY, mob.y));
          }
        }
      }

      if (config.isAggressive && mob.currentBehavior === 'chase' && mob.damageCooldown <= 0 && mob.health > 0) {
        const targetPlayer = players[mob.targetPlayerId];
        if (targetPlayer) {
          if (checkOverlap(mob.x, mob.y, mob.size, mob.size, targetPlayer.x, targetPlayer.y, targetPlayer.size, targetPlayer.size)) {
            const damage = mob.damage;
            targetPlayer.health -= damage;
            targetPlayer.lastDamageTime = Date.now();
            if (!targetPlayer.originalColor) {
              targetPlayer.originalColor = targetPlayer.color || "defaultColor";
            }

            targetPlayer.color = "rgba(255, 0, 0, 0.5)";
            setTimeout(() => {
              targetPlayer.color = targetPlayer.originalColor;
            }, 100);

            if (targetPlayer.health < 0) targetPlayer.health = 0;
            // Damage cooldown scales with mob attackspeed (higher attackspeed => shorter cooldown)
            const atk = mob.attackspeed || 1;
            mob.damageCooldown = Math.max(0.1, 1 / atk);
                // Emit knockback event using stored socketId
                if (ioRef && targetPlayer.socketId) {
                  ioRef.to(targetPlayer.socketId).emit('playerKnockback', {
                    mobX: mob.x,
                    mobY: mob.y,
                    mobId: mob.id || null
                  });
                }
          }
        }
      }
    }
  }
}


function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
  return (
    x1 < x2 + sizeX2 &&
    x1 + sizeX1 > x2 &&
    y1 < y2 + sizeY2 &&
    y1 + sizeY1 > y2
  );
}

function isOverlappingAny(source, x, y, sizeX, sizeY) {
  if (!source) return false;
  const list = Array.isArray(source)
    ? source
    : Object.values(source || {}).flat();
  return list.some(r => {
    const rSizeX = r.sizeX !== undefined ? r.sizeX : r.size;
    const rSizeY = r.sizeY !== undefined ? r.sizeY : r.size;
    return rSizeX > 0 && rSizeY > 0 && checkOverlap(x, y, sizeX, sizeY, r.x, r.y, rSizeX, rSizeY);
  });
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
  difficulty,
  setIO,
  isMobPosBlockedForServer,
};