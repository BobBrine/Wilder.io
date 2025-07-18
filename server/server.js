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
const ItemTypes = {
  // Resources
  wood: { name: "Wood", color: "green" },
  stone: { name: "Stone", color: "darkgray" },
  iron: { name: "Iron", color: "white" },
  gold: { name: "Gold", color: "gold" },
  food: { name: "Food", color: "red" },
  slime: { name: "Slime", color: "pink" },
  stick: { name: "Stick", color: "brown" },
  fur: { name: "Fur", color: "gray" },
  web: { name: "Web", color: "white" },
  paw: { name: "Paw", color: "yellow" },
  torch: { name: "Torch", color: "yellow" },
  // Tools
  wooden_axe: { name: "Wooden Axe", color: "sienna", isTool: true, category: "axe", tier: 1, damage: 5 },
  stone_axe: { name: "Stone Axe", color: "darkgray", isTool: true, category: "axe", tier: 2, damage: 10 },
  iron_axe: { name: "Iron Axe", color: "white", isTool: true, category: "axe", tier: 3, damage: 20 },
  gold_axe: { name: "Gold Axe", color: "gold", isTool: true, category: "axe", tier: 4, damage: 40 },
  wooden_pickaxe: { name: "Wooden Pickaxe", color: "sienna", isTool: true, category: "pickaxe", tier: 1, damage: 5 },
  stone_pickaxe: { name: "Stone Pickaxe", color: "darkgray", isTool: true, category: "pickaxe", tier: 2, damage: 10 },
  iron_pickaxe: { name: "Iron Pickaxe", color: "white", isTool: true, category: "pickaxe", tier: 3, damage: 20 },
  gold_pickaxe: { name: "Gold Pickaxe", color: "gold", isTool: true, category: "pickaxe", tier: 4, damage: 40 },
  wooden_sword: { name: "Wooden Sword", color: "sienna", isTool: true, category: "sword", tier: 1, damage: 5 },
  stone_sword: { name: "Stone Sword", color: "darkgray", isTool: true, category: "sword", tier: 2, damage: 10 },
  iron_sword: { name: "Iron Sword", color: "white", isTool: true, category: "sword", tier: 3, damage: 20 },
  gold_sword: { name: "Gold Sword", color: "gold", isTool: true, category: "sword", tier: 4, damage: 40 },
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



setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastUpdate) / 1000;
  updatePlayers(deltaTime, now);
  updateResourceRespawns(deltaTime);
  updateMobRespawns(deltaTime, allResources, players, gameTime);
  gameTime = (gameTime + deltaTime) % CYCLE_LENGTH;
  lastUpdate = now;

  io.emit("resources", allResources);
  emitMobsWithPlayerNames();
  updateMobs(allResources, players, deltaTime);
  io.emit("gameTime", gameTime);
}, 50);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Server running on http://10.141.21.216:${PORT} (LAN accessible)`);
});

function createNewPlayer(id, name) {
  const size = 32;
  let x, y;
  let attempts = 0;

  while (true) {
    x = Math.random() * (2000 - size);
    y = Math.random() * (2000 - size);
    attempts++;
    const overlapsResource = isOverlappingAny(allResources, x, y, size);
    const overlapsMob = isOverlappingAny(mobs, x, y, size);
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
    color: "lime",
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
    entity.size = 0;
    entity.respawnTimer = entity.respawnTime;
    const dropAmount = config.getDropAmount(entity.maxHealth);
    if (isMob) socket.emit("itemDrop", { item: config.drop, amount: dropAmount});
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

