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

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback route to serve index.html for SPA support
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
  // Transform threatTable to include player names before sending
  const mobsWithPlayerNames = Object.fromEntries(
    Object.entries(mobs).map(([type, mobList]) => [
      type,
      mobList.map(mob => ({
        ...mob,
        threatTable: Object.fromEntries(
          Object.entries(mob.threatTable || {}).map(([playerId, threat]) => [
            players[playerId]?.name || 'Unknown',
            threat
          ])
        )
      }))
    ])
  );
  io.emit("mobs", mobsWithPlayerNames);

  socket.on("pingCheck", (callback) => {
    callback();
  });

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

  socket.on('resourceHit', ({ id, type, newHealth }) => {

    const list = allResources[type];
    const resource = list.find(r => r.id === id);
    if (!resource) return;

    const damage = resource.health - newHealth;
    resource.health = newHealth;
    resource.lastHitBy = socket.id;
    io.emit("updateResourceHealth", {
      id,
      type,
      health: newHealth
    });
    const config = resourceTypes[type];
    const dropAmount = config.getDropAmount(resource.maxHealth);
    socket.emit("itemDrop", {
      item: config.drop,
      amount: damage
    });
    if (resource.health <= 0) {
      resource.size = 0;
      resource.respawnTimer = resource.respawnTime;

      

      socket.emit("gainXP", 3);
    }
  });

  socket.on('mobhit', ({ id, type, newHealth }) => {


    const list = mobs[type];
    if (!list) return;

    const mob = list.find(r => r.id === id);
    if (!mob) return;
    mob.pauseTimer = 0.1; // Pause for 0.1 seconds

    const damage = mob.hp - newHealth;
    mob.hp = newHealth;
    mob.lastHitBy = socket.id;

    const config = mobtype[type];
    if (config.isAggressive) {
      mob.threatTable[socket.id] = (mob.threatTable[socket.id] || 0) + (5 + damage * 0.2);
    }

    io.emit("updateMobHealth", {
      id,
      type,
      hp: newHealth
    });
    if (mob.hp <= 0) {
      mob.size = 0;
      mob.respawnTimer = mob.respawnTime;

      const dropAmount = config.getDropAmount(mob.maxHealth);

      socket.emit("itemDrop", {
        item: config.drop,
        amount: dropAmount
      });
      socket.emit("gainXP", 3);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    for (const mobList of Object.values(mobs)) {
      for (const mob of mobList) {
        if (mob.threatTable && mob.threatTable[socket.id]) {
          delete mob.threatTable[socket.id];
        }
      }
    }
    io.emit('playerDisconnected', socket.id);
  });
});

let lastUpdate = Date.now();
setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastUpdate) / 1000;

  for (const [id, socket] of io.of("/").sockets) {
    const filteredPlayers = Object.fromEntries(
      Object.entries(players).filter(([pid]) => pid !== id)
    );
    const selfData = players[id] ? { 
      health: players[id].health,
      color: players[id].color,
      maxStamina: players[id].maxStamina,
      staminaRegenSpeed: players[id].staminaRegenSpeed,
    } : {};
    socket.emit("state", {
      players: filteredPlayers,
      self: selfData,
      pond
    });

    if (players[id] && players[id].health <= 0) {
      socket.emit('playerDied');
      delete players[id];
      io.emit('playerDisconnected', id);
    }
  }
 

  updateResourceRespawns(deltaTime);
  updateMobRespawns(deltaTime, allResources, players, gameTime);
  gameTime += deltaTime;
  gameTime %= CYCLE_LENGTH
  lastUpdate = now;

  io.emit("resources", allResources);
  // Transform threatTable to include player names before sending
  const mobsWithPlayerNames = Object.fromEntries(
    Object.entries(mobs).map(([type, mobList]) => [
      type,
      mobList.map(mob => ({
        ...mob,
        threatTable: Object.fromEntries(
          Object.entries(mob.threatTable || {}).map(([playerId, threat]) => [
            players[playerId]?.name || 'Unknown',
            threat
          ])
        )
      }))
    ])
  );
  io.emit("mobs", mobsWithPlayerNames);
  updateMobs(allResources, players, deltaTime);
  io.emit("gameTime", gameTime);
}, 50);

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
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
    isDead: false,
    maxStamina: 100,
    staminaRegenSpeed:40,
  };
}

