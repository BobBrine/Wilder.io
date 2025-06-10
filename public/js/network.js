let socket = io("https://survival-io-md0m.onrender.com");
//let socket = io("http://localhost:3000");
const devTest = false;

let latestSquare = null;

let ping = 0;

setInterval(() => {
  const startTime = performance.now();
  socket.emit("pingCheck", () => {
    ping = performance.now() - startTime;
  });
}, 1000); // Ping every second

socket.on("resourceType", (data) => {  
    resourceTypes = data;
});

socket.on("mobType", (data) => {  
    mobtype = data;
});

socket.on('connect', () => {
  console.log('Connected as', socket.id);

  socket.on("resources", (data) => {
    if (!allResources) {
      allResources = data;
    } else {
      for (const type in data) {
        // Ensure array exists
        if (!allResources[type]) allResources[type] = [];

        data[type].forEach((serverR, i) => {
          const existing = allResources[type][i] || {};
          allResources[type][i] = {
            ...serverR,
            lastHitTime: existing.lastHitTime, // keep lastHitTime if any
          };
        });
      }
    }

    resourcesLoaded = true;
  });

  socket.on("mobs", (data) => {
    if (!mobs) {
      mobs = data;
    } else {
      for (const type in data) {
        // Ensure array exists
        if (!mobs[type]) mobs[type] = [];

        data[type].forEach((serverR, i) => {
          const existing = mobs[type][i] || {};
          mobs[type][i] = {
            ...serverR,
            lastHitTime: existing.lastHitTime, // keep lastHitTime if any
          };
        });
      }
    }

    mobloaded = true;
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
      inventory.addItem("gold_sword", 1);
      inventory.addItem("wood", 100);
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

  // Update player's own health
  if (data.self && player) {
    player.health = data.self.health;
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


socket.on("itemDrop", ({ item, amount }) => {
  inventory.addItem(item, amount);
});

socket.on("gainXP", (amount) => {
  gainXP(amount);
});

// Send your position to the server
function sendPlayerPosition(x, y) {
  socket.emit('move', { x, y });
}

// Handle 'playerDied' event
socket.on('playerDied', () => {
  // Reset game state
  player = null;
  otherPlayers = {};
  allResources = null;
  mobs = null;
  resourcesLoaded = false;
  mobloaded = false;

  // Show alert and refresh the page
  showMessage("You died! The page will now refresh.");
  setTimeout(() => {
    window.location.reload();
  }, 2000); // 2-second delay
});





