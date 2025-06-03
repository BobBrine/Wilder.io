const socket = io("https://survival-io-md0m.onrender.com");
 // Change this when deployed

let otherPlayers = {};

socket.on('connect', () => {
  console.log('Connected as', socket.id);
});

// Server sends all current players
socket.on('currentPlayers', (players) => {
  otherPlayers = players;
  delete otherPlayers[socket.id]; // Don't render yourself
});

// New player joins
socket.on('newPlayer', (playerData) => {
  otherPlayers[playerData.id] = playerData;
});

// Player moved
socket.on('playerMoved', (playerData) => {
  if (otherPlayers[playerData.id]) {
    otherPlayers[playerData.id].x = playerData.x;
    otherPlayers[playerData.id].y = playerData.y;
  }
});

// Player left
socket.on('playerDisconnected', (id) => {
  delete otherPlayers[id];
});

// Send your position to the server
function sendPlayerPosition(x, y) {
  socket.emit('move', { x, y });
}
