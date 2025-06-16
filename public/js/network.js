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
      showMobData = true;
      inventory.addItem("gold_sword", 1);
      inventory.addItem("wood", 100);
      inventory.addItem("torch", 1);
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
  maxStamina = playerData.maxStamina;
  stamina = maxStamina;
  staminaRegenSpeed = playerData.staminaRegenSpeed;
  isDead = playerData.isDead;
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
  latestSquare = data.pond;
  
  const serverPlayers = data.players;
  maxStamina = data.self.maxStamina;
  staminaRegenSpeed = data.self.staminaRegenSpeed;

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
    player.color = data.self.color || player.color; 
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
  showMessage(`+${amount} ${item}`);
});

socket.on("gainXP", (amount) => {
  gainXP(amount);
});

// Send your position to the server
function sendPlayerPosition(x, y) {
  socket.emit('move', { x, y });
  
}
let isDead = null;
// Handle 'playerDied' event
socket.on('playerDied', () => {
  isDead = true; 
  // Reset game variables
  player = null;
  otherPlayers = {};
  resourcesLoaded = false;
  mobloaded = false;
  // Optionally clear inventory or game-specific state
  if (inventory && typeof inventory.clear === "function") {
    inventory.clear(); // implement this if needed
  }
  document.getElementById("deathScreen").style.display = "block";
});

function backToMain() {
  const deathScreen = document.getElementById("deathScreen");
  const nameEntry = document.getElementById("nameEntry");
  
  deathScreen.style.display = "none";
  nameEntry.style.display = "block";
  document.getElementById("playerNameInput").value = "";
  document.querySelector("button").disabled = false;


}

function submitName() {
  isDead = false; // Reset dead flag on rejoin
  const input = document.getElementById("playerNameInput");
  const name = input.value.trim() || "Unknown";

  // Prevent re-joining if socket is null or disconnected
  if (!socket || socket.disconnected) return;

  document.getElementById("nameEntry").style.display = "none";
  document.getElementById("deathScreen").style.display = "none";
  socket.emit("setName", name);

}

let gameTime = 0;
const CYCLE_LENGTH = 180; // 20 minutes in seconds
const DAY_LENGTH = 120;    // 15 minutes of day

socket.on('gameTime', (serverTime) => {
  gameTime = serverTime;
});





