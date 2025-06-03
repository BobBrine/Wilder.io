const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*', // allow all origins (for local dev)
  }
});

const PORT = 3000;

let players = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Add new player
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 800,
    y: Math.random() * 600
  };

  // Send current players to the new one
  socket.emit('currentPlayers', players);

  // Tell others about the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Movement update
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
