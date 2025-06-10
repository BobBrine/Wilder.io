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
  
  
  //test
  socket.emit('squarePosition', square);
  
  
  
  io.emit("resourceType", resourceTypes);

  io.emit("resources", allResources);
  
  io.emit("mobType", mobtype);

  io.emit("mobs", mobs);

  socket.on("pingCheck", (callback) => {
    callback(); // just respond immediately
  });


  socket.on('setName', (name) => {
      if (players[socket.id]) {
      players[socket.id].name = name;
      }
      // Then inside setName:
      players[socket.id] = createNewPlayer(socket.id, name);

    // Send full player list to the new player
    socket.emit('currentPlayers', players);

    // ✅ Send back self info
    socket.emit('playerSelf', players[socket.id]);

    // Notify everyone else
    socket.broadcast.emit('newPlayer', players[socket.id]);
  });


  //update player position
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

  //update resource
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

      // Reward the player
      socket.emit("itemDrop", {
        item: config.drop,
        amount: dropAmount
      });

      socket.emit("gainXP", 3);
    }

    
  });

  //update mob
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

      // Reward the player
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




// ⬇ Add this after the io.on block
setInterval(() => {
  
  for (const [id, socket] of io.of("/").sockets) {
    const filteredPlayers = Object.fromEntries(
      Object.entries(players).filter(([pid]) => pid !== id)
    );

    socket.emit("state", {
      players: filteredPlayers,
      square
    });

    // Send updated resource list to all players
  }
}, 1000 / 20);

let lastUpdate = Date.now();

setInterval(() => {
  const now = Date.now();          
  const deltaTime = (now - lastUpdate) / 1000; 
  updateResourceRespawns(deltaTime);
  updateMobRespawns(deltaTime, allResources, players)
  lastUpdate = now;

  io.emit("resources", allResources);
  
  io.emit("mobs", mobs);
  updateMobs(allResources, deltaTime);


  

}, 50); // Every 100ms



server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

function createNewPlayer(id, name) {
  const size = 32;
  let x, y;
  let attempts = 0;

  // Keep searching until a valid non-overlapping position is found
  while (true) {
    x = Math.random() * (2000 - size);
    y = Math.random() * (2000 - size);
    attempts++;

    const overlapsResource = isOverlappingAny(allResources, x, y, size);
    const overlapsMob = isOverlappingAny(mobs, x, y, size);

    if (!overlapsResource && !overlapsMob) break;

    // Optional: log if it takes unusually long
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
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    
  };

}

