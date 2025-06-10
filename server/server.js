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
  square,
  mobs,
  mobtype,
  spawnAllMob,
  updateMobs,
  updateMobRespawns,
} = require('./mobdata');

const {
  players,
} = require('./playerdata');

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback route to serve index.html for SPA support
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

spawnAllResources();
spawnAllMob(allResources, players);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  socket.emit('squarePosition', square);
  
  io.emit("resourceType", resourceTypes);
  io.emit("resources", allResources);
  io.emit("mobType", mobtype);
  io.emit("mobs", mobs);

  socket.on("pingCheck", (callback) => {
    callback();
  });

  socket.on('setName', (name) => {
    players[socket.id] = createNewPlayer(socket.id, name);
    socket.emit('currentPlayers', players);
    socket.emit('playerSelf', players[socket.id]);
    socket.broadcast.emit('newPlayer', players[socket.id]);
  });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('resourceHit', ({ id, type, newHealth }) => {
    const list = allResources[type];
    const resource = list.find(r => r.id === id);
    if (!resource) return;

    resource.health = newHealth;
    resource.lastHitBy = socket.id;

    io.emit("updateResourceHealth", {
      id,
      type,
      health: newHealth
    });
    if (resource.health <= 0) {
      resource.size = 0;
      resource.respawnTimer = resource.respawnTime;

      const config = resourceTypes[type];
      const dropAmount = config.getDropAmount(resource.maxHealth);

      socket.emit("itemDrop", {
        item: config.drop,
        amount: dropAmount
      });
      socket.emit("gainXP", 3);
    }
  });

  socket.on('mobhit', ({ id, type, newHealth }) => {
    const list = mobs[type];
    if (!list) return;

    const mob = list.find(r => r.id === id);
    if (!mob) return;

    mob.hp = newHealth;
    mob.lastHitBy = socket.id;

    io.emit("updateMobHealth", {
      id,
      type,
      hp: newHealth
    });
    if (mob.hp <= 0) {
      mob.size = 0;
      mob.respawnTimer = mob.respawnTime;

      const config = mobtype[type];
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
    io.emit('playerDisconnected', socket.id);
  });
});

let lastUpdate = Date.now();

setInterval(() => {
  for (const [id, socket] of io.of("/").sockets) {
    const filteredPlayers = Object.fromEntries(
      Object.entries(players).filter(([pid]) => pid !== id)
    );
    const selfData = players[id] ? { health: players[id].health } : {};
    socket.emit("state", {
      players: filteredPlayers,
      self: selfData,
      square
    });

    // Check if the player's health is less than or equal to zero
    if (players[id] && players[id].health <= 0) {
      socket.emit('playerDied'); // Notify the client they died
      setTimeout(() => {
        socket.disconnect(true); // Disconnect the player after a short delay
      }, 100);
    }
  }
  const now = Date.now();
  const deltaTime = (now - lastUpdate) / 1000;
  updateResourceRespawns(deltaTime);
  updateMobRespawns(deltaTime, allResources, players);
  lastUpdate = now;

  io.emit("resources", allResources);
  io.emit("mobs", mobs);
  updateMobs(allResources, players, deltaTime);

  
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
    speed: 2,
    facingAngle: 0,
    level: 2,
    xp: 0,
    xpToNextLevel: 10,
    health: 100, // Starting health
    maxHealth: 100 // Maximum health
  };
}