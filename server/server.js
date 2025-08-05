const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  },
  path: '/socket.io',
});
const PORT = process.env.PORT || 3000;

const {
  resourceTypes,
  allResources,
  spawnAllResources,
  updateResourceRespawns,
  isOverlappingAny
} = require('./resourceManager');

const {
  pond,
  mobs,
  mobtype,
  DAY_LENGTH,
  CYCLE_LENGTH,
  spawnAllMob,
  updateMobs,
  updateMobRespawns,
} = require('./mobdata');

const {
  players,
} = require('./playerdata');

let gameTime = 0;
let droppedItems = [];
let nextItemId = 0;
let lastUpdate = Date.now();
let lastStaticUpdate = Date.now();
const WORLD_SIZE = 5000;
const ItemTypes = {
  // Resources
  wood: { name: "Wood", color: "green", attackSpeed: 0.35 },
  stone: { name: "Stone", color: "darkgray", attackSpeed: 0.35 },
  iron: { name: "Iron", color: "white", attackSpeed: 0.35 },
  gold: { name: "Gold", color: "gold", attackSpeed: 0.35 },
  food: { name: "Food", color: "red", attackSpeed: 0.35 },
  slime: { name: "Slime", color: "pink", attackSpeed: 0.35 },
  stick: { name: "Stick", color: "brown", attackSpeed: 0.35 },
  fur: { name: "Fur", color: "gray", attackSpeed: 0.35 },
  web: { name: "Web", color: "white", attackSpeed: 0.35 },
  paw: { name: "Paw", color: "yellow", attackSpeed: 0.35 },
  torch: { name: "Torch", color: "yellow", attackSpeed: 0.35 },
  // Tools
  wooden_axe: { name: "Wooden Axe", color: "sienna", isTool: true, category: "axe", tier: 1, damage: 5, attackRange: 50, attackSpeed: 0.3 },
  stone_axe: { name: "Stone Axe", color: "darkgray", isTool: true, category: "axe", tier: 2, damage: 10, attackRange: 50, attackSpeed: 0.3 },
  iron_axe: { name: "Iron Axe", color: "white", isTool: true, category: "axe", tier: 3, damage: 20, attackRange: 50, attackSpeed: 0.3 },
  gold_axe: { name: "Gold Axe", color: "gold", isTool: true, category: "axe", tier: 4, damage: 40, attackRange: 50, attackSpeed: 0.3 },
  wooden_pickaxe: { name: "Wooden Pickaxe", color: "sienna", isTool: true, category: "pickaxe", tier: 1, damage: 5, attackRange: 50, attackSpeed: 0.3 },
  stone_pickaxe: { name: "Stone Pickaxe", color: "darkgray", isTool: true, category: "pickaxe", tier: 2, damage: 10, attackRange: 50, attackSpeed: 0.3 },
  iron_pickaxe: { name: "Iron Pickaxe", color: "white", isTool: true, category: "pickaxe", tier: 3, damage: 20, attackRange: 50, attackSpeed: 0.3 },
  gold_pickaxe: { name: "Gold Pickaxe", color: "gold", isTool: true, category: "pickaxe", tier: 4, damage: 40, attackRange: 50, attackSpeed: 0.3 },
  wooden_sword: { name: "Wooden Sword", color: "sienna", isTool: true, category: "sword", tier: 1, damage: 5, attackRange: 50, attackSpeed: 0.3 },
  stone_sword: { name: "Stone Sword", color: "darkgray", isTool: true, category: "sword", tier: 2, damage: 10, attackRange: 50, attackSpeed: 0.3 },
  iron_sword: { name: "Iron Sword", color: "white", isTool: true, category: "sword", tier: 3, damage: 20, attackRange: 50, attackSpeed: 0.3 },
  gold_sword: { name: "Gold Sword", color: "gold", isTool: true, category: "sword", tier: 4, damage: 40, attackRange: 50, attackSpeed: 0.3 },
  hand: { name: "Hand", color: "peachpuff", attackSpeed: 0.35 },
};

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

spawnAllResources();
spawnAllMob(allResources, players, gameTime);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  io.emit("resourceType", resourceTypes);
  io.emit("resources", allResources);
  io.emit("mobType", mobtype);
  io.emit("itemTypes", ItemTypes);

  socket.on("pingCheck", (callback) => {callback();});

  socket.on('setName', (name) => {
    if (players[socket.id]) {
      delete players[socket.id];
    }
    players[socket.id] = createNewPlayer(socket.id, name);
    socket.emit('currentPlayers', players);
    socket.emit('playerSelf', players[socket.id]);
    socket.broadcast.emit('newPlayer', players[socket.id]);
  });

  

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (p && p.health > 0) {
      p.x = data.x;
      p.y = data.y;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
      });
    }
  });

  //new code
  socket.on("playerLeveledUp", ({ id, level }) => {
    const p = players[socket.id];
    if (p && p.health > 0) {
      p.level = level;

      // Broadcast to all other clients
      socket.broadcast.emit("playerLevelUpdated", {
        id: socket.id,
        level: level
      });
    }
  });

  //old code
  socket.on('resourceHit', ({ id, type, newHealth }) => handleHit(socket, allResources, type, id, newHealth, resourceTypes));
  socket.on('mobhit', ({ id, type, newHealth }) => handleHit(socket, mobs, type, id, newHealth, mobtype, true));
  socket.on('dropItem', ({ type, amount, x, y }) => handleDropItem(socket, type, amount, x, y));
  socket.on('pickupItem', itemId => handlePickupItem(socket, itemId));
  // Inside io.on('connection', (socket) => {...})
  socket.on('playerhit', ({ targetId, newHealth }) => handlePlayerHit(socket, targetId, newHealth));
  socket.on('consumeFood', ({ amount }) => handleConsumeFood(socket, amount));
  socket.on('disconnect', () => handleDisconnect(socket));

});


//update contiunous
setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastUpdate) / 1000;
  lastUpdate = now;
  updatePlayers(deltaTime, now);
  
  gameTime = (gameTime + deltaTime) % CYCLE_LENGTH;

  
  emitMobsWithPlayerNames();
  updateMobs(allResources, players, deltaTime);
  io.emit("gameTime", gameTime);
}, 50);

// Static update loop (every 10s)
setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastStaticUpdate) / 1000; // in seconds
  lastStaticUpdate = now;

  updateResourceRespawns(deltaTime);
  updateMobRespawns(deltaTime, allResources, players, gameTime);
  io.emit("resources", allResources);


}, 10000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Server running on http://192.168.4.48:${PORT} (LAN accessible)`);
});

function createNewPlayer(id, name) {
  const size = 32;
  let x, y;
  let attempts = 0;

  while (true) {
    x = Math.random() * (WORLD_SIZE / 5 - size);
    y = Math.random() * (WORLD_SIZE / 5 - size);
    attempts++;
    const overlapsResource = isOverlappingAny(allResources, x, y, size, size);
    const overlapsMob = isOverlappingAny(mobs, x, y, size, size);
    if (!overlapsResource && !overlapsMob) break;
    if (attempts % 1000 === 0) {
      console.warn(`⚠️ Still trying to place player ${id}, attempts: ${attempts}`);
    }
  }
  return {
    id,
    name: name || "Unnamed",
    x,
    y,
    size,
    color: "rgba(0, 0, 0, 0)",
    speed: 200,
    facingAngle: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    health: 100,
    maxHealth: 100,
    healthRegen: 10,
    lastDamageTime: null,
    isDead: false,
    maxStamina: 100,
    staminaRegenSpeed: 40,
    hunger: 100, // Add hunger
    maxHunger: 100,
    hungerDepletionSpeed: 2,
    lastHungerDepletion: Date.now(),
    
  };
}

function emitMobsWithPlayerNames() {
  io.emit("mobs", Object.fromEntries(
    Object.entries(mobs).map(([type, mobList]) => [
      type,
      mobList.map(mob => ({
        type: type,
        id: mob.id,
        x: mob.x,
        y: mob.y,
        profile: mob.profile,
        color: mob.color,
        health: mob.health,
        maxHealth: mob.maxHealth,
        size: mob.size,
        facingAngle: mob.facingAngle,
        threatTable: Object.fromEntries(
          Object.entries(mob.threatTable || {}).map(([playerId, threat]) => [players[playerId]?.name || 'Unknown', threat])
        )
      }))
    ])
  ));
}

function handleHit(socket, collection, type, id, newHealth, configTypes, isMob = false) {
  const list = collection[type];
  if (!list) return;
  const entity = list?.find(e => e.id === id);
  if (!entity) return;
  const damage = entity.health - newHealth;
  entity.health = newHealth;
  entity.lastHitBy = socket.id;
  if (isMob) entity.pauseTimer = 0.1;
  const config = configTypes[type];
  if (isMob && config.isAggressive) {
    entity.threatTable[socket.id] = (entity.threatTable[socket.id] || 0) + (5 + damage * 0.2);
  }
  io.emit(isMob ? "updateMobHealth" : "updateResourceHealth", { id, type, health: newHealth });
  if (!isMob) socket.emit("itemDrop", { item: config.drop, amount: damage });
  if (entity.health <= 0) {
    entity.sizeX = 0;
    entity.sizeY = 0;
    
    entity.respawnTimer = entity.respawnTime;
    const drops = config.getDropAmount();
    if (Array.isArray(drops)) {
      drops.forEach(drop => {
        socket.emit("itemDrop", { item: drop.type, amount: drop.amount });
      });
    } else {
      socket.emit("itemDrop", { item: config.drop, amount: drops });
    }
    socket.emit("gainXP", 3);
  }
}

function handlePlayerHit(socket, targetId, newHealth) {
  const attacker = players[socket.id], target = players[targetId];
  if (!attacker || !target || target.health <= 0 || targetId === socket.id || newHealth > target.health) return;
  target.health = newHealth;
  target.lastDamageTime = Date.now();
  target.lastHitBy = socket.id;
  target.originalColor = target.originalColor || target.color || "lime";
  target.color = "red";
  setTimeout(() => target.color = target.originalColor, 100);
  io.emit("updatePlayerHealth", { id: targetId, health: target.health });
  if (target.health <= 0) {
    target.isDead = true;
    io.emit('playerDisconnected', targetId);
  }
}

function handleDropItem(socket, type, amount, x, y) {
  const item = { id: nextItemId++, type, amount, x, y, despawnTimer: 60, pickupDelay: 1 };
  droppedItems.push(item);
  io.emit("newDroppedItem", item);
}

function handlePickupItem(socket, itemId) {
  const item = droppedItems.find(i => i.id === itemId), p = players[socket.id];
  if (!item || !p) return;
  const distance = Math.sqrt((p.x + p.size / 2 - item.x) ** 2 + (p.y + p.size / 2 - item.y) ** 2);
  if (distance > 26 || item.pickupDelay > 0) return;
  droppedItems = droppedItems.filter(i => i.id !== itemId);
  io.emit("removeDroppedItem", itemId);
  socket.emit("addItem", { type: item.type, amount: item.amount });
}

function handleConsumeFood(socket, amount) {
  const p = players[socket.id];
  if (!p || p.isDead || p.hunger >= p.maxHunger) return;
  p.hunger = Math.min(p.maxHunger, p.hunger + 20 * amount);
}

function handleDisconnect(socket) {
  console.log(`Player disconnected: ${socket.id}`);
  delete players[socket.id];
  for (const mobList of Object.values(mobs)) {
    mobList.forEach(mob => delete mob.threatTable?.[socket.id]);
  }
  io.emit('playerDisconnected', socket.id);
}

function updatePlayers(deltaTime, now) {
  for (const [id, socket] of io.of("/").sockets) {
    const p = players[id];
    if (!p) continue;
    if (p && p.health > 0 && p.health < p.maxHealth) {
      // Regenerate health if not recently damaged and hunger > 0
      if (!p.lastDamageTime || (now - p.lastDamageTime) / 1000 >= 5) {
        if (p.hunger > 25) {
          p.health = Math.min(p.maxHealth, p.health + p.healthRegen * deltaTime);
        }
      }
    }
    // Hunger depletion every 5 seconds
    if (p.health > 0) {
      
      if (!p.lastHungerDepletion) p.lastHungerDepletion = now; // Initialize timer
      const timeSinceLastDepletion = (now - p.lastHungerDepletion) / 1000;
      if (timeSinceLastDepletion >= 5) {
        if (p.hunger > 0) {
          p.hunger = Math.max(0, p.hunger - 5); // Deplete 10 hunger every 5 seconds
          p.lastHungerDepletion = now;
        }
      }
      // Lose health if hunger is 0
      if (p.hunger <= 0) {
        p.health = Math.max(0, p.health - 1 * deltaTime); // 1 health per second
      }
    }

    const filteredPlayers = Object.fromEntries(
      Object.entries(players).filter(([pid]) => pid !== id)
    );
    const selfData = players[id] ? { 
      x: players[id].x, // Include position for reconciliation
      y: players[id].y,
      health: players[id].health,
      color: players[id].color,
      maxStamina: players[id].maxStamina,
      staminaRegenSpeed: players[id].staminaRegenSpeed,
      hunger: players[id].hunger,
      maxHunger: players[id].maxHunger,
    } : {};
    socket.emit("state", {
      players: filteredPlayers,
      self: selfData,
      pond,
      droppedItems,
      timestamp: now,
    });

    if (players[id] && players[id].health <= 0) {
      socket.emit('playerDied');
      delete players[id];
      io.emit('playerDisconnected', id);
    }
  }

  droppedItems = droppedItems.filter(item => {
    if (item.pickupDelay > 0) item.pickupDelay -= deltaTime;
    item.despawnTimer -= deltaTime;
    if (item.despawnTimer <= 0) {
      io.emit("removeDroppedItem", item.id);
      return false;
    }
    return true;
  });
}

