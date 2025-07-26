// Socket connection
let socket = io("https://survival-io-md0m.onrender.com"); // For complete game testing
//let socket = io("http://localhost:3000"); // For local testing
const devTest = true;

let latestSquare = null;
let ping = 0;
let droppedItems = [];
let currentDropType = null;
let currentMaxCount = 0;

// Ping check
setInterval(() => {
  const startTime = performance.now();
  socket.emit("pingCheck", () => {
    ping = performance.now() - startTime;
  });
}, 2000);

// Socket event handlers
socket.on("resourceType", (data) => {  
  resourceTypes = data;
});

socket.on("mobType", (data) => {  
  mobtype = data;
});

socket.on("itemTypes", (data) => ItemTypes = data);


socket.on('connect', () => {
  console.log('Connected as', socket.id);

  socket.on("resources", (data) => {
    if (!allResources) {
      allResources = data;
    } else {
      for (const type in data) {
        if (!allResources[type]) allResources[type] = [];
        data[type].forEach((serverR, i) => {
          const existing = allResources[type][i] || {};
          allResources[type][i] = {
            ...serverR,
            lastHitTime: existing.lastHitTime,
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
        if (!mobs[type]) mobs[type] = [];
        data[type].forEach((serverR, i) => {
          const existing = mobs[type][i] || {};
          mobs[type][i] = {
            ...serverR,
            lastHitTime: existing.lastHitTime,
          };
        });
      }
    }
    mobloaded = true;
  });

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
    socket.emit("setName", "Tester");
    showMobData = true;
    inventory.addItem("gold_sword", 1);
    inventory.addItem("wood", 100);
    inventory.addItem("torch", 1);
    inventory.addItem("wooden_axe", 1);
    inventory.addItem("food", 10);
 
  }
});

socket.on('currentPlayers', (players) => {
  otherPlayers = players;
  delete otherPlayers[socket.id];
});

socket.on('playerSelf', (playerData) => {
  player = playerData;
  maxStamina = playerData.maxStamina;
  stamina = maxStamina;
  staminaRegenSpeed = playerData.staminaRegenSpeed;
  maxHunger = playerData.maxHunger;
  hunger = playerData.hunger;
  isDead = playerData.isDead;
});

socket.on('playerRenamed', ({ id, name }) => {
  if (otherPlayers[id]) {
    otherPlayers[id].name = name;
  }
});

socket.on('newPlayer', (playerData) => {
  console.log('New player joined:', playerData);
  otherPlayers[playerData.id] = playerData;
});

socket.on("state", (data) => {
  latestSquare = data.pond;
  const serverPlayers = data.players;
  maxStamina = data.self.maxStamina;
  staminaRegenSpeed = data.self.staminaRegenSpeed;
  maxHunger = data.self.maxHunger;
  hunger = data.self.hunger;
  droppedItems = data.droppedItems || [];

  for (const id in serverPlayers) {
    if (id !== socket.id) {
      if (!otherPlayers[id]) {
        otherPlayers[id] = { ...serverPlayers[id], lastHitTime: undefined };
      } else {
        const existing = otherPlayers[id];
        otherPlayers[id] = {
          ...serverPlayers[id],
          lastHitTime: existing.lastHitTime,
        };
      }
    }
  }

  if (data.self && player) {
    player.health = data.self.health;
    player.color = data.self.color || player.color;
    player.hunger = data.self.hunger;
    player.maxHunger = data.self.maxHunger;
  }
});

socket.on('playerMoved', (playerData) => {
  if (playerData.id !== socket.id && otherPlayers[playerData.id]) {
    otherPlayers[playerData.id].x = playerData.x;
    otherPlayers[playerData.id].y = playerData.y;
  }
});

socket.on('playerDisconnected', (id) => {
  delete otherPlayers[id];
});

socket.on("itemDrop", ({ item, amount }) => {
  if (inventory.addItem(item, amount)) {
    showMessage(`+${amount} ${item}`);
  }
});

socket.on("gainXP", (amount) => {
  gainXP(amount);
});

//new
socket.on("playerLevelUpdated", ({ id, level }) => {
  if (otherPlayers[id]) {
    otherPlayers[id].level = level;
  }
});


socket.on("addItem", ({ type, amount }) => {
  if (inventory.addItem(type, amount)) {
    showMessage(`Picked up ${amount} ${type}`);
  }
});

socket.on("removeDroppedItem", (itemId) => {
  droppedItems = droppedItems.filter(item => item.id !== itemId);
});

// Functions
function sendPlayerPosition(x, y) {
  socket.emit('move', { x, y });
}

let isDead = null;
socket.on('playerDied', () => {
  isDead = true;
  player = null;
  otherPlayers = {};
  resourcesLoaded = false;
  mobloaded = false;
  if (inventory && typeof inventory.clear === "function") {
    inventory.clear();
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
  isDead = false;
  const input = document.getElementById("playerNameInput");
  const name = input.value.trim() || "Unknown";
  if (!socket || socket.disconnected) return;
  document.getElementById("nameEntry").style.display = "none";
  document.getElementById("deathScreen").style.display = "none";
  socket.emit("setName", name);
}

let gameTime = 0;
const CYCLE_LENGTH = 180;
const DAY_LENGTH = 180; //120

socket.on('gameTime', (serverTime) => {
  gameTime = serverTime;
});

function dropItem(type, amount) {
  if (inventory.removeItem(type, amount)) {
    socket.emit("dropItem", { type, amount, x: player.x + player.size / 2, y: player.y + player.size / 2 });
    // No need for updateHotbarFromInventory() here; handled by removeItem
    showMessage(`You dropped ${amount} ${type}`);
  } else {
    showMessage("Failed to drop item");
  }
}

function submitDropAmount() {
  const input = document.getElementById("dropAmountInput");
  const amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount < 1 || amount > currentMaxCount) {
    showMessage("Invalid amount");
    document.getElementById("dropAmountPrompt").style.display = "none";
    return;
  }
  dropItem(currentDropType, amount);
  document.getElementById("dropAmountPrompt").style.display = "none";
  document.getElementById("dropAmountInput").value = "";
}

function dropAll() {
  dropItem(currentDropType, currentMaxCount);
  document.getElementById("dropAmountPrompt").style.display = "none";
  document.getElementById("dropAmountInput").value = "";
}

function promptDropAmount(type, maxCount) {
  currentDropType = type;
  currentMaxCount = maxCount;
  const dropPrompt = document.getElementById("dropAmountPrompt");
  const input = document.getElementById("dropAmountInput");
  input.placeholder = `Amount to drop (1-${maxCount})`;
  input.max = maxCount;
  input.value = "1"; // Set default value to 1
  dropPrompt.style.display = "block";
  input.focus();
}
