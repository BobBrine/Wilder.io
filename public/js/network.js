const socket = io("https://survival-io-md0m.onrender.com");
//const socket = io("http://localhost:3000");
const autostart = false;


let gameStarted = false;
 // Change this when deployed

let otherPlayers = {};

let player = null;

let latestSquare = null;

socket.on('connect', () => {
  console.log('Connected as', socket.id);

  // Enable the join button once socket is ready
  document.querySelector("#playerNameInput").disabled = false;
  document.querySelector("button").disabled = false;

  window.submitName = () => {
    const input = document.getElementById("playerNameInput");
    const name = input.value.trim() || "Unknown";
    document.getElementById("nameEntry").style.display = "none";
    socket.emit("setName", name);
    gameStarted = true;
  
  };
  if (autostart) {
      document.getElementById("nameEntry").style.display = "none";
      socket.emit("setName", "Tester"); // or any default name
      gameStarted = true;
      //give player item at the start
      inventory.addItem("gold_axe", 1);
      inventory.addItem("wood", 100);
      inventory.addItem("stone", 100);
      inventory.addItem("iron", 100);
      inventory.addItem("gold", 100);
    } 
});


// Server sends all current players
socket.on('currentPlayers', (players) => {
  otherPlayers = players;
  delete otherPlayers[socket.id];
});

socket.on('playerSelf', (playerData) => {
  player = playerData;  // ✅ Apply name and other info from server
  spawnAllResources();

});


socket.on('playerRenamed', ({ id, name }) => {
  if (otherPlayers[id]) {
    otherPlayers[id].name = name;
  }
});

// New player joins
socket.on('newPlayer', (playerData) => {
  console.log('New player joined:', playerData);
  otherPlayers[playerData.id] = playerData;
});

socket.on("state", (data) => {
  //if (!gameStarted) return;
  latestSquare = data.square;
  
  draw();

  const serverPlayers = data.players;

  // Update your own player
  if (player && serverPlayers[socket.id]) {
    Object.assign(player, serverPlayers[socket.id]);
  }

  // Update other players
  for (const id in serverPlayers) {
    if (id !== socket.id) {
      if (!otherPlayers[id]) {
        otherPlayers[id] = serverPlayers[id];
      } else {
        Object.assign(otherPlayers[id], serverPlayers[id]);
      }
    }
  }

});

// Player moved
socket.on('playerMoved', (playerData) => {
  if (playerData.id !== socket.id && otherPlayers[playerData.id]) {
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

function draw() //test code
{
  if (latestSquare) {
    
    //console.log("draw square");
    ctx.fillStyle = "blue"; // or any color you want for the shared square
    ctx.fillRect(latestSquare.x, latestSquare.y, latestSquare.size, latestSquare.size);
  }
}
