const socket = io("https://survival-io-md0m.onrender.com");
//const socket = io("http://localhost:3000");
const devTest = false;

let latestSquare = null;

let ping = 0;

setInterval(() => {
  const startTime = performance.now();
  socket.emit("pingCheck", () => {
    ping = performance.now() - startTime;
  });
}, 1000); // Ping every second

socket.on('connect', () => {
  console.log('Connected as', socket.id);

  // Update resources from server
  
  socket.on("resourceType", (data) => {  
    resourceTypes = data;
  });




  socket.on("resources", (data) => {    
    allResources = data;
    resourcesLoaded = true;
  });
  

  // Enable the join button once socket is ready
  document.querySelector("#playerNameInput").disabled = false;
  document.querySelector("button").disabled = false;

  window.submitName = () => {
    const input = document.getElementById("playerNameInput");
    const name = input.value.trim() || "Unknown";
    document.getElementById("nameEntry").style.display = "none";
    socket.emit("setName", name);
    
  
  };
  if (devTest) {
      document.getElementById("nameEntry").style.display = "none";
      socket.emit("setName", "Tester"); // or any default name
      
      //give player item at the start
      //inventory.addItem("gold_axe", 1);
      //inventory.addItem("wood", 100);
      //inventory.addItem("stone", 100);
      //inventory.addItem("iron", 100);
      //inventory.addItem("gold", 100);
    } 
});


// Server sends all current players
socket.on('currentPlayers', (players) => {
  otherPlayers = players;
  delete otherPlayers[socket.id];
});

socket.on('playerSelf', (playerData) => {
  player = playerData;  // ✅ Apply name and other info from server

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
  
  const serverPlayers = data.players;
  /*
  let smoothing = 0.2; 
  // Update your own player
  if (player && serverPlayers[socket.id]) {
    let serverPlayer = serverPlayers[socket.id];
    player.x += (serverPlayer.x - player.x) * smoothing;
    player.y += (serverPlayer.y - player.y) * smoothing;
    const { x, y, ...rest } = serverPlayer;
    Object.assign(player, rest);
  }
  */

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

function resourceHealth(){
  socket.emit('resourcehealth', resource.health);
}



