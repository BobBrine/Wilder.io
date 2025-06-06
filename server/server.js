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
  updateResourceRespawns
} = require('./resourceManager');

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback route to serve index.html for SPA support
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
//player
let players = {};

//test
let square = {
  x: Math.random() * (2000 - 50), // assuming square size is 50x50
  y: Math.random() * (2000 - 50),
  size: 50,
};


io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  spawnAllResources();
  //test
  socket.emit('squarePosition', square);
  
  socket.emit("resourceType", resourceTypes);

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
  }
}, 1000 / 20);

let lastUpdate = Date.now();

setInterval(() => {
  const now = Date.now();           // <-- define now here
  const deltaTime = (now - lastUpdate) / 1000; 
  lastUpdate = now;
  updateResourceRespawns(deltaTime);

  // Send updated resource list to all players
  io.emit("resources", allResources);

  

}, 100); // Every 100ms



server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

function createNewPlayer(id, name) {
  return {
    id,
    name: name || "Unnamed",
    x: Math.random() * (2000 - 20),
    y: Math.random() * (2000 - 20),
    size: 20,
    color: "lime",
    speed: 3,
    facingAngle: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
  };
}

