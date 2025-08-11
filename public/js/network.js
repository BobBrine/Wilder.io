// Socket connection
let socket = null;
const devTest = false; // Set to true for development testing
// Dev mode strictly follows devTest only (no localStorage/host overrides)
const devModeActive = !!devTest;
// Helpful diagnostic
try { console.log('Dev mode check', { devTest, devModeActive, host: location.hostname }); } catch (_) {}

// Run a callback now if DOM is ready, otherwise on DOMContentLoaded
function onReady(cb) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', cb, { once: true });
  } else {
    try { cb(); } catch (e) { console.error('onReady error', e); }
  }
}

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
    // If client is loaded over HTTPS, force WSS/HTTPS for socket.io
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
      url = url.replace('ws://', 'wss://');
    }
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

  socket.on("itemTypes", (data) => {
    // Merge server ItemTypes into local ItemTypes, preserving local tool properties
    if (typeof ItemTypes !== 'object' || !ItemTypes) ItemTypes = {};
    for (const key in data) {
      if (ItemTypes[key] && ItemTypes[key].isTool) {
        // Keep local tool definition (attackRange, isTool, etc.)
        ItemTypes[key] = { ...data[key], ...ItemTypes[key] };
      } else {
        ItemTypes[key] = data[key];
      }
    }
  });

  socket.on('connect', () => {
    console.log('Connected as', socket.id);
    const nameInput = document.querySelector("#playerNameInput");
    const nameBtn = document.querySelector("#nameEntry button");
    if (nameInput) nameInput.disabled = false;
    if (nameBtn) nameBtn.disabled = false;

    // Initialize graphics settings from localStorage or defaults
    if (!window.graphicsSettings) window.graphicsSettings = {};
    try {
      const savedPerformanceMode = localStorage.getItem('graphics.performanceMode');
      window.graphicsSettings.performanceMode = savedPerformanceMode ? JSON.parse(savedPerformanceMode) : false;
      // Shadows are always inverse of performance mode
      window.graphicsSettings.shadows = !window.graphicsSettings.performanceMode;
    } catch (e) {
      // Fallback to defaults if localStorage fails
      window.graphicsSettings.performanceMode = false;
      window.graphicsSettings.shadows = true; // Default: shadows on when performance mode off
    }
  });

  // Receive server time at a modest rate for lighting/day-night effects
  socket.on('gameTime', (serverTime) => {
    gameTime = serverTime;
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
    if (!mobs) mobs = {};
    const nowTs = performance.now();
    for (const type in data) {
      const list = mobs[type] || [];
      const byId = new Map();
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m && m.id) byId.set(m.id, m);
      }
      const nextList = [];
      const incoming = data[type] || [];
      for (let i = 0; i < incoming.length; i++) {
        const serverR = incoming[i];
        const existing = byId.get(serverR.id) || {};
        const prevServerX = existing._serverX ?? existing.x ?? serverR.x;
        const prevServerY = existing._serverY ?? existing.y ?? serverR.y;
        const prevTime = existing._serverTime ?? nowTs;
        nextList.push({
          ...serverR,
          lastHitTime: existing.lastHitTime,
          _lastServerX: prevServerX,
          _lastServerY: prevServerY,
          _lastServerTime: prevTime,
          _serverX: serverR.x,
          _serverY: serverR.y,
          _serverTime: nowTs,
        });
      }
      mobs[type] = nextList;
    }
    mobloaded = true;
  });

  // Apply delta updates for mobs to reduce payload size
  socket.on("mobsDelta", ({ add = [], update = [], remove = [] }) => {
    const nowTs = performance.now();
    const ensureList = (type) => { if (!mobs[type]) mobs[type] = []; return mobs[type]; };
    const indexById = (list) => {
      const map = new Map();
      for (let i = 0; i < list.length; i++) map.set(list[i]?.id, i);
      return map;
    };
    // Adds
    for (const m of add) {
      const list = ensureList(m.type);
      const byId = indexById(list);
      if (byId.has(m.id)) continue; // already present
      list.push({
        ...m,
        _lastServerX: m.x,
        _lastServerY: m.y,
        _lastServerTime: nowTs,
        _serverX: m.x,
        _serverY: m.y,
        _serverTime: nowTs,
      });
    }
    // Updates
    for (const m of update) {
      const list = ensureList(m.type);
      const idx = list.findIndex(x => x && x.id === m.id);
      if (idx === -1) { // treat as add if not found
        list.push({
          ...m,
          _lastServerX: m.x,
          _lastServerY: m.y,
          _lastServerTime: nowTs,
          _serverX: m.x,
          _serverY: m.y,
          _serverTime: nowTs,
        });
      } else {
        const existing = list[idx] || {};
        // If we missed prior updates (stale), snap to current to avoid rubber-banding
        const prevTime = existing._serverTime ?? nowTs;
        const dt = nowTs - prevTime;
        const tooOld = dt > 500; // >0.5s
        const snap = tooOld || Math.hypot((existing._serverX ?? existing.x ?? m.x) - m.x, (existing._serverY ?? existing.y ?? m.y) - m.y) > 600;
        list[idx] = {
          ...existing,
          ...m,
          lastHitTime: existing.lastHitTime,
          _lastServerX: snap ? m.x : (existing._serverX ?? existing.x ?? m.x),
          _lastServerY: snap ? m.y : (existing._serverY ?? existing.y ?? m.y),
          _lastServerTime: snap ? nowTs : (existing._serverTime ?? nowTs),
          _serverX: m.x,
          _serverY: m.y,
          _serverTime: nowTs,
        };
      }
    }
    // Removes
    for (const r of remove) {
      const list = ensureList(r.type);
      const idx = list.findIndex(x => x && x.id === r.id);
      if (idx !== -1) list.splice(idx, 1);
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
  // Ensure the game loop resumes after respawn without waiting for a resources re-broadcast
  if (typeof resourcesLoaded !== 'undefined') resourcesLoaded = true;
  if (typeof mobloaded !== 'undefined') mobloaded = true;
  // Close death screen immediately on respawn
  const deathScreen = document.getElementById("deathScreen");
  if (deathScreen) deathScreen.style.display = "none";
  });

  socket.on('playerRenamed', ({ id, name }) => {
    if (otherPlayers[id]) {
      otherPlayers[id].name = name;
    }
  });

  // Apply players delta for non-pos fields
  socket.on("playersDelta", ({ add = [], update = [], remove = [] }) => {
    // Adds
    for (const p of add) {
      if (!otherPlayers[p.id]) otherPlayers[p.id] = {};
      otherPlayers[p.id].name = p.name;
      otherPlayers[p.id].level = p.level;
      otherPlayers[p.id].color = p.color;
      otherPlayers[p.id].health = p.health;
    }
    // Updates
    for (const p of update) {
      if (!otherPlayers[p.id]) otherPlayers[p.id] = {};
      otherPlayers[p.id].name = p.name;
      otherPlayers[p.id].level = p.level;
      otherPlayers[p.id].color = p.color;
      otherPlayers[p.id].health = p.health;
    }
    // Removes
    for (const r of remove) {
      delete otherPlayers[r.id];
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
  // droppedItems moved to its own event for diffed proximity updates

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

  // Receive per-client, proximity-filtered dropped items snapshot
  socket.on("droppedItems", (items) => {
    droppedItems = items || [];
  });

  // Low-latency item appear: merge single new item between snapshots
  socket.on("newDroppedItem", (item) => {
    if (!item || typeof item.id !== 'number') return;
    if (!Array.isArray(droppedItems)) droppedItems = [];
    const exists = droppedItems.some(it => it && it.id === item.id);
    if (!exists) droppedItems.push(item);
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
  if (!Array.isArray(droppedItems)) { droppedItems = []; return; }
  droppedItems = droppedItems.filter(item => item && item.id !== itemId);
  });

  socket.on('playerDied', () => {
    isDead = true;
  player = null;
  otherPlayers = {};
  // Keep resources/mobs flags so the loop doesn't stall during respawn
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
  // Clear dead flag immediately to resume gameplay visuals
  deathScreen.style.display = "none";
  isDead = false;
  // Reset any local movement/input state if needed
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

    // Listen for knockback event from server
    socket.on('playerKnockback', ({ mobX, mobY, mobId }) => {
      // Create a minimal mob object for knockback direction
      if (window.applyKnockbackFromMob) {
        window.applyKnockbackFromMob({ x: mobX, y: mobY });
      }
    });

    // Listen for mob knockback when player hits mob
  
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
  
  let statusElement = document.getElementById("serverStatus");
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = 'serverStatus';
    const container = document.getElementById('serverJoin');
    if (container) container.prepend(statusElement);
  }
  if (statusElement) {
    statusElement.textContent = "Connecting to main server...";
    statusElement.style.color = "white";
  }
  
  // Clear any existing retry button
  const existingRetry = document.querySelector('#serverJoin button.retry');
  if (existingRetry) existingRetry.remove();
  
  try {
    // Always use Render URL for main server
    const url = "https://survival-io-md0m.onrender.com";
    initializeSocket(url);
    // Add connection timeout for better feedback
    window._mainServerTimeout && clearTimeout(window._mainServerTimeout);
    window._mainServerTimeout = setTimeout(() => {
      if (!socket || !socket.connected) {
        showServerError("Failed to connect to main server. Please check your internet connection or try again later.");
        console.error("Socket.io connection timeout: Could not connect to main server at " + url);
      }
    }, 5000); // 5 seconds timeout
    // Listen for socket connect event to show name entry
    if (socket) {
      socket.on('connect', () => {
        console.log('Socket connected, showing name entry UI');
        const serverJoin = document.getElementById("serverJoin");
        const nameEntry = document.getElementById("nameEntry");
        if (serverJoin) serverJoin.style.display = "none";
        if (nameEntry) {
          nameEntry.style.display = "block";
          const input = document.getElementById("playerNameInput");
          if (input) input.focus();
        }
      });
    }
  } catch (error) {
    showServerError("Connection failed: " + error.message);
    console.error("Socket.io connection error:", error);
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

window.backToLocalLAN = function() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  document.getElementById("hostPrompt").style.display = "none";
  document.getElementById("joinLocalPrompt").style.display = "none";
  document.getElementById("localLAN").style.display = "block";
};

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
    // Log error for diagnostics
    console.error("Server connection error:", message);
  }
}

function submitHostIP() {
  const ip = document.getElementById("hostIPInput").value.trim();
  if (!isValidIP(ip)) {
    showMessage("Invalid IP address. Please enter a valid IP (e.g., 192.168.1.100).", 5);
    return;
  }
  // Host LAN: connect to local server
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
  // Join LAN: connect to host's local server
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
if (devModeActive) {
  onReady(() => {
    // Hide all menus and show game instantly
    document.getElementById("homePage").style.display = "none";
    document.getElementById("serverJoin").style.display = "none";
    document.getElementById("localLAN").style.display = "none";
    document.getElementById("hostPrompt").style.display = "none";
    document.getElementById("joinLocalPrompt").style.display = "none";
    document.getElementById("nameEntry").style.display = "none";
    document.getElementById("deathScreen").style.display = "none";
    console.log('[Dev] Auto-connect initializing...');
    // Connect to localhost and login instantly
    initializeSocket("http://localhost:3000");
    // Wait for socket connection before submitting name
    const tryLogin = () => {
      if (socket && socket.connected) {
        socket.emit("setName", "DevUser");
        showData = false;
        inventory.addItem("wooden_sword", 1);
        inventory.addItem("wooden_pickaxe", 1);
        inventory.addItem("wooden_axe", 1);
        inventory.addItem("wood", 100);
        inventory.addItem("torch", 1);
        inventory.addItem("food", 10);
        console.log('[Dev] Auto-login done');
      } else {
        setTimeout(tryLogin, 100);
      }
    };
    tryLogin();
  });
} else {
  // Minimal UI bootstrap for non-dev mode to ensure menus/buttons exist
  onReady(() => {
    const home = document.getElementById('homePage');
    if (home && home.children.length <= 1) {
      const btnOnline = document.createElement('button');
      btnOnline.textContent = 'Play Online';
      btnOnline.onclick = joinMainServer;
      const btnLAN = document.createElement('button');
      btnLAN.textContent = 'Local LAN';
      btnLAN.onclick = showLocalLAN;
      home.appendChild(btnOnline);
      home.appendChild(btnLAN);
    }
    const nameEntry = document.getElementById('nameEntry');
    if (nameEntry && nameEntry.children.length === 0) {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'playerNameInput';
      input.placeholder = 'Enter your name';
      input.disabled = true;
      const btn = document.createElement('button');
      btn.textContent = 'Join';
      btn.onclick = submitName;
      btn.disabled = true;
      nameEntry.appendChild(input);
      nameEntry.appendChild(btn);
    }
    // Hide non-home pages on load
    ['serverJoin','localLAN','hostPrompt','joinLocalPrompt','nameEntry','deathScreen']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const homePage = document.getElementById('homePage');
    if (homePage) homePage.style.display = 'block';
  });
}