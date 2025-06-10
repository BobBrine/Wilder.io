const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

let square = {
  x: Math.random() * (2000 - 50),
  y: Math.random() * (2000 - 50),
  size: 50,
};

const crypto = require("crypto");

const mobtype = {
  slime: {
    maxCount: 10,
    size: 32,
    hp: 100,
    speed: 50,
    color: "pink",
    itemColor: "pink",
    drop: "slime",
    tools: ["hand", "wooden_sword", "stone_sword", "iron_sword", "gold_sword"],
    spawntimer: 10,
    getDropAmount(hp) {
      return 6;
    },
    behavior: 'wander',
    damage: 0, // Non-aggressive
    turnSpeed:Math.PI,
  },
  goblin: {
    maxCount: 5,
    size: 32,
    hp: 100,
    speed: 50,
    color: "red",
    itemColor: "red",
    drop: "stick",
    tools: ["hand", "wooden_sword", "stone_sword", "iron_sword", "gold_sword"],
    spawntimer: 10,
    getDropAmount(hp) {
      return 6;
    },
    behavior: 'wander',
    damage: 0, 
    turnSpeed: Math.PI,
  },
  wolf: {
    maxCount: 5,
    size: 32,
    hp: 150,
    speed: 100,
    color: "gray",
    itemColor: "gray",
    drop: "fur",
    tools: ["hand", "wooden_sword", "stone_sword", "iron_sword", "gold_sword"],
    spawntimer: 10,
    getDropAmount(hp) {
      return 3;
    },
    behavior: 'wander',
    isAggressive: true,
    aggroRadius: 200,
    escapeRadius: 400,
    damage: 20, 
    turnSpeed: Math.PI * 2,
  },
};

const mobs = Object.fromEntries(Object.keys(mobtype).map(type => [type, []]));

function createMobSpawner(type, targetArray, isOverlapping) {
  const config = mobtype[type];
  if (!config) return;
  const halfSize = config.size / 2;
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
        damageCooldown: 0 // Initialize damage cooldown
      });
      activeCount++;
    }
  }
}

function spawnAllMob(allResources, players) {
  for (const type in mobs) {
    mobs[type] = mobs[type].filter(r => r.size > 0);
    createMobSpawner(type, mobs[type], (x, y, size) =>
      isOverlappingAny(allResources, x, y, size) ||
      isOverlappingAny(mobs, x, y, size) ||
      isOverlappingAny(players, x, y, size)
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

      // Handle aggressive behavior switching
      if (config.isAggressive) {
        if (mob.currentBehavior === 'wander') {
          for (const player of Object.values(players)) {
            const dx = player.x - mob.x;
            const dy = player.y - mob.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < config.aggroRadius) {
              mob.currentBehavior = 'chase';
              mob.targetPlayerId = player.id;
              mob.chaseTimer = 0;
              break;
            }
          }
        } else if (mob.currentBehavior === 'chase') {
          const targetPlayer = players[mob.targetPlayerId];
          if (!targetPlayer) {
            mob.currentBehavior = 'wander';
            mob.targetPlayerId = null;
          } else {
            const dx = targetPlayer.x - mob.x;
            const dy = targetPlayer.y - mob.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > config.escapeRadius) {
              mob.currentBehavior = 'wander';
              mob.targetPlayerId = null;
            }
          }
        }
      }

      // Update targetAngle based on behavior
      if (mob.currentBehavior === 'wander') {
        if (mob.moveTimer <= 0 && !mob.isTurning) {
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
      if (config.isAggressive && mob.currentBehavior === 'chase' && mob.damageCooldown <= 0) {
        const targetPlayer = players[mob.targetPlayerId];
        if (targetPlayer) {
          if (checkOverlap(mob.x, mob.y, mob.size, targetPlayer.x, targetPlayer.y, targetPlayer.size)) {
            const damage = config.damage;
            targetPlayer.health -= damage;
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

function updateMobRespawns(deltaTime, allResources, players) {
  for (const mob of Object.values(mobs)) {
    for (const r of mob) {
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        if (r.respawnTimer <= 0) {
          const config = mobtype[r.type];
          const mobSize = config.size;
          let newX, newY;
          do {
            newX = Math.random() * (WORLD_WIDTH - config.size);
            newY = Math.random() * (WORLD_HEIGHT - config.size);
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
          r.currentBehavior = config.behavior;
          r.targetPlayerId = null;
          r.chaseTimer = 0;
          r.facingAngle = Math.random() * Math.PI * 2;
          r.targetAngle = Math.random() * Math.PI * 2;
          r.turnSpeed = config.turnSpeed,
          r.moveSpeed = config.speed;
          r.moveTimer = Math.random() * 3 + 2;
          r.isTurning = true;
          r.damageCooldown = 0; // Reset damage cooldown
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