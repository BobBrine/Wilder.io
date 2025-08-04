// Socket connection
let socket = null;
const devTest = false;

let latestSquare = null;
let ping = 0;
let droppedItems = [];
let currentDropType = null;
let currentMaxCount = 0;

// Fallback for showMessage if not defined
if (typeof showMessage !== "function") {
  window.showMessage = function(msg, timeout = 3) {
    // Simple fallback: log to console
    console.log("[Message]", msg);
  };
}

// ========================
// Socket Initialization
// ========================
function initializeSocket(url) {
  try {
    socket = io(url, { transports: ['websocket'], reconnection: false });
    setupSocketListeners();
    return socket;
  } catch (error) {
    console.error("Socket initialization failed:", error);
    showServerError("Connection failed: " + error.message);
    return null;
  }
}
function setupSocketListeners() {
  if (!socket) return;
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
    document.querySelector("#playerNameInput").disabled = false;
    document.querySelector("#nameEntry button").disabled = false;
  });

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

  socket.on('playerDied', () => {
    isDead = true;
    player = null;
    otherPlayers = {};
    resourcesLoaded = false;
    mobloaded = false;
    if (inventory && typeof inventory.clear === "function") {
      inventory.clear();
    }
    const deathScreen = document.getElementById("deathScreen");
    deathScreen.style.display = "block";
    // Add Respawn button if not already present
    let respawnBtn = document.getElementById("respawnBtn");
    if (!respawnBtn) {
      respawnBtn = document.createElement("button");
      respawnBtn.id = "respawnBtn";
      respawnBtn.textContent = "Respawn";
      respawnBtn.style.marginTop = "20px";
      respawnBtn.onclick = function() {
        // Use previous name from input
        const input = document.getElementById("playerNameInput");
        const name = input.value.trim() || "Unknown";
        if (!socket || socket.disconnected) {
          showMessage("Not connected to server. Please try again.", 5);
          backToHome();
          return;
        }
        deathScreen.style.display = "none";
        isDead = false;
        socket.emit("setName", name);
      };
      deathScreen.appendChild(respawnBtn);
    } else {
      respawnBtn.style.display = "inline-block";
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    showServerError("Server is unavailable. Please try again later.");
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  });

  // Ping check
  setInterval(() => {
    if (socket && socket.connected) {
      const startTime = performance.now();
      socket.emit("pingCheck", () => {
        ping = performance.now() - startTime;
      });
    }
  }, 2000);
  window.socket = socket;
}

// ========================
// UI Navigation Functions
// ========================
function joinMainServer() {
  document.getElementById("homePage").style.display = "none";
  document.getElementById("serverJoin").style.display = "block";
  
  const statusElement = document.getElementById("serverStatus");
  statusElement.textContent = "Connecting to main server...";
  statusElement.style.color = "white";
  
  // Clear any existing retry button
  const existingRetry = document.querySelector('#serverJoin button.retry');
  if (existingRetry) existingRetry.remove();
  
  try {
    initializeSocket("https://survival-io-md0m.onrender.com");
  } catch (error) {
    showServerError("Connection failed: " + error.message);
  }
}

function showLocalLAN() {
  document.getElementById("homePage").style.display = "none";
  document.getElementById("localLAN").style.display = "block";
}

function showHostPrompt() {
  document.getElementById("localLAN").style.display = "none";
  document.getElementById("hostPrompt").style.display = "block";
  
  // Try to auto-detect local IP
  try {
    const hostIPInput = document.getElementById("hostIPInput");
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    const pc = new RTCPeerConnection({iceServers:[]});
    pc.createDataChannel("");
    pc.createOffer().then(pc.setLocalDescription.bind(pc));
    pc.onicecandidate = ice => {
      if (!ice || !ice.candidate || !ice.candidate.candidate) return;
      const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
      const match = ipRegex.exec(ice.candidate.candidate);
      if (match) {
        hostIPInput.value = match[1];
        pc.onicecandidate = () => {};
      }
    };
  } catch (e) {
    console.log("Couldn't detect local IP");
  }
}

function showJoinLocalPrompt() {
  document.getElementById("localLAN").style.display = "none";
  document.getElementById("joinLocalPrompt").style.display = "block";
  document.getElementById("joinIPInput").focus();
}

function backToHome() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  document.getElementById("serverJoin").style.display = "none";
  document.getElementById("localLAN").style.display = "none";
  document.getElementById("hostPrompt").style.display = "none";
  document.getElementById("joinLocalPrompt").style.display = "none";
  document.getElementById("nameEntry").style.display = "none";
  document.getElementById("deathScreen").style.display = "none";
  document.getElementById("homePage").style.display = "block";
}

function backToLocalLAN() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  document.getElementById("hostPrompt").style.display = "none";
  document.getElementById("joinLocalPrompt").style.display = "none";
  document.getElementById("localLAN").style.display = "block";
}

function showServerError(message) {
  const statusElement = document.getElementById("serverStatus");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.color = "#ff5555";
    statusElement.classList.add("error");
    
    // Add retry button
    const existingRetry = document.querySelector('#serverJoin button.retry');
    if (!existingRetry) {
      const retryButton = document.createElement("button");
      retryButton.textContent = "Retry Connection";
      retryButton.className = "retry";
      retryButton.onclick = joinMainServer;
      document.getElementById("serverJoin").appendChild(retryButton);
    }
  }
}

function submitHostIP() {
  const ip = document.getElementById("hostIPInput").value.trim();
  if (!isValidIP(ip)) {
    showMessage("Invalid IP address. Please enter a valid IP (e.g., 192.168.1.100).", 5);
    return;
  }
  const url = `http://${ip}:3000`;
  initializeSocket(url);
  document.getElementById("hostPrompt").style.display = "none";
  document.getElementById("nameEntry").style.display = "block";
}

function submitJoinIP() {
  const ip = document.getElementById("joinIPInput").value.trim();
  if (!isValidIP(ip)) {
    showMessage("Invalid IP address. Please enter a valid IP (e.g., 192.168.1.100).", 5);
    return;
  }
  const url = `http://${ip}:3000`;
  initializeSocket(url);
  document.getElementById("joinLocalPrompt").style.display = "none";
  document.getElementById("nameEntry").style.display = "block";
}

function isValidIP(ip) {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

function backToMain() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  document.getElementById("deathScreen").style.display = "none";
  // Hide respawn button if present
  const respawnBtn = document.getElementById("respawnBtn");
  if (respawnBtn) respawnBtn.style.display = "none";
  document.getElementById("homePage").style.display = "block";
  document.getElementById("playerNameInput").value = "";
}

function submitName() {
  isDead = false;
  const input = document.getElementById("playerNameInput");
  const name = input.value.trim() || "Unknown";
  if (!socket || socket.disconnected) {
    showMessage("Not connected to server. Please try again.", 5);
    backToHome();
    return;
  }
  document.getElementById("nameEntry").style.display = "none";
  document.getElementById("deathScreen").style.display = "none";
  // Hide respawn button if present
  const respawnBtn = document.getElementById("respawnBtn");
  if (respawnBtn) respawnBtn.style.display = "none";
  socket.emit("setName", name);
}

// ========================
// Game Functions
// ========================
let gameTime = 0;
const CYCLE_LENGTH = 180;
const DAY_LENGTH = 180;

if (socket) {
  socket.on('gameTime', (serverTime) => {
    gameTime = serverTime;
  });
}



function dropItem(type, amount) {
  if (inventory.removeItem(type, amount)) {
    socket.emit("dropItem", { type, amount, x: player.x + player.size / 2, y: player.y + player.size / 2 });
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
  input.value = "1";
  dropPrompt.style.display = "block";
  input.focus();
}

// Dev testing
if (devTest) {
  window.addEventListener("DOMContentLoaded", () => {
    // Hide all menus and show game instantly
    document.getElementById("homePage").style.display = "none";
    document.getElementById("serverJoin").style.display = "none";
    document.getElementById("localLAN").style.display = "none";
    document.getElementById("hostPrompt").style.display = "none";
    document.getElementById("joinLocalPrompt").style.display = "none";
    document.getElementById("nameEntry").style.display = "none";
    document.getElementById("deathScreen").style.display = "none";
    // Connect to localhost and login instantly
    initializeSocket("http://localhost:3000");
    // Wait for socket connection before submitting name
    const tryLogin = () => {
      if (socket && socket.connected) {
        socket.emit("setName", "DevUser");
        showMobData = true;
        inventory.addItem("wooden_sword", 1);
        inventory.addItem("wood", 100);
        inventory.addItem("torch", 1);
        inventory.addItem("wooden_axe", 1);
        inventory.addItem("food", 10);
      } else {
        setTimeout(tryLogin, 100);
      }
    };
    tryLogin();
  });
}