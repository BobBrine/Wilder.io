// Socket connection (will be real socket in online, or shim in offline)
// Set to true only if you want to support multiple remote players in this client.
const ENABLE_MULTIPLAYER_CLIENT = false;
let socket = null;
let devTest = false; // will be set by server after connect

// Difficulty progression (highest ever reached)
if (typeof difficultyProgression === 'undefined') {
  var difficultyProgression = Number(localStorage.getItem('difficulty.progression') || '0');
}
window.difficultyProgression = difficultyProgression;

// Dev mode strictly follows devTest only (no localStorage/host overrides)
const isDevMode = () => !!devTest;
// Helpful diagnostic
try { console.log('Dev mode check', { devTest, devModeActive: isDevMode(), host: location.hostname }); } catch (_) {}

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
window.droppedItems = [];
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
    if (window.location.protocol === 'https:' && url && url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (window.location.protocol === 'https:' && url && url.startsWith('ws://')) {
      url = url.replace('ws://', 'wss://');
    }
    if (!url) throw new Error('No server URL provided');
    if (typeof io !== 'undefined') {
      socket = io(url, { transports: ['websocket'], reconnection: false });
      setupSocketListeners();
      return socket;
    }
    throw new Error('Socket.io not available');
  } catch (error) {
    console.warn("Online connect failed; falling back to offline singleplayer:", error?.message || error);
    // Create an offline shim implementing the subset we use
    const listeners = {};
    socket = {
      connected: false,
      disconnected: true,
      on: (ev, cb) => { (listeners[ev] ||= []).push(cb); },
      once: (ev, cb) => {
        const wrapper = (...a) => { cb(...a); socket.off(ev, wrapper); };
        (listeners[ev] ||= []).push(wrapper);
      },
      off: (ev, cb) => {
        if (!listeners[ev]) return;
        if (!cb) { delete listeners[ev]; return; }
        listeners[ev] = listeners[ev].filter(f => f !== cb);
      },
      emit: (ev, ...args) => { /* no-op in offline */ },
      disconnect: () => { /* no-op */ },
      // Helper to simulate events locally
      _emitLocal: (ev, payload) => { (listeners[ev] || []).forEach(cb => { try { cb(payload); } catch(_) {} }); }
    };
    window.socket = socket;
    // Initialize offline game loop pieces
    bootstrapOfflineGameplay();
    return socket;
  }
}
function setupSocketListeners() {
  if (!socket) return;
  
  socket.on('initialBlocks', (blocks) => {
    placedBlocks = blocks.map(b => ({
      ...b,
      worldX: b.gridX * GRID_SIZE,
      worldY: b.gridY * GRID_SIZE,
      // Ensure health is preserved
      health: b.health,
      maxHealth: b.maxHealth
    }));
  });


// --- Offline helpers ---
function bootstrapOfflineGameplay() {
  // Advance local game time day/night in lieu of server 'gameTime'
  if (typeof window.__offlineTimeTicker === 'undefined') {
    window.__offlineTimeTicker = setInterval(() => {
      try { gameTime = (typeof gameTime === 'number' ? gameTime : 0) + 1; } catch(_) {}
    }, 1000);
  }
  // Spawn resources and mobs if not yet spawned and player exists later
  const ensureWorld = () => {
    try {
      if (!window.__resourcesSpawnedOnce && typeof spawnAllResources === 'function') {
        spawnAllResources(); window.__resourcesSpawnedOnce = true; resourcesLoaded = true;
      }
      if (!window.__mobsSpawnedOnce && typeof spawnAllMob === 'function') {
        spawnAllMob(window.allResources, {}, (typeof gameTime === 'number' ? gameTime : 0));
        window.__mobsSpawnedOnce = true; mobloaded = true;
      }
    } catch(_) {}
  };
  // Also ensure after player creation
  const _origCreateRespawn = window.CreateRespawnPlayer;
  window.CreateRespawnPlayer = function() {
    if (_origCreateRespawn) _origCreateRespawn();
    ensureWorld();
  };
  // If player already exists, ensure world now
  ensureWorld();
}
  socket.on('blockPlaced', (block) => {
    placedBlocks.push({
      ...block,
      worldX: block.gridX * GRID_SIZE,
      worldY: block.gridY * GRID_SIZE,
      // Ensure health is preserved
      health: block.health,
      maxHealth: block.maxHealth
    });
  });

  // Add blockHealthUpdate event handler
  socket.on('blockHealthUpdate', (data) => {
    const { gridX, gridY, health, maxHealth } = data;
    const block = placedBlocks.find(b => 
      b.gridX === gridX && b.gridY === gridY
    );
    
    if (block) {
      block.health = health;
      block.maxHealth = maxHealth;
      block.lastHitTime = performance.now(); // For health bar display
    }
  });

  socket.on('blockBroken', (blockData) => {
    placedBlocks = placedBlocks.filter(b => 
      !(b.gridX === blockData.gridX && b.gridY === blockData.gridY)
    );
  });
  // Socket event handlers

  // Receive dev flag from server so clients don’t assume localhost
  // socket.on('DevTest', (flag) => {
  //   devTest = !!flag;
  // });
  


  socket.on('connect', () => {
    console.log('Connected as', socket.id);
    const nameInput = document.querySelector("#playerNameInput");
    const nameBtn = document.querySelector("#nameEntry button");
    if (nameInput) nameInput.disabled = false;
    if (nameBtn) nameBtn.disabled = false;
    window.graphicsSettings.performanceMode = false;
    window.graphicsSettings.shadows = true;
  });

  // Receive server time at a modest rate for lighting/day-night effects
  socket.on('gameTime', ({ serverTime, day, difficulty: serverDifficulty }) => {
    gameTime = serverTime;
    Day = day; // Make sure 'Day' variable exists in client scope
    difficulty = serverDifficulty; // Make sure 'difficulty' variable exists in client scope
    if (typeof serverDifficulty === 'number') {
      const newMax = Math.max(serverDifficulty, window.difficultyProgression);
      if (newMax !== window.difficultyProgression) {
        window.difficultyProgression = newMax;
        localStorage.setItem('difficulty.progression', String(newMax));
        window.dispatchEvent(new CustomEvent('difficultyProgressionChanged'));
      }
    }
  });



 

  // Apply delta updates for mobs to reduce payload size
  socket.on("mobsDelta", ({ add = [], update = [], remove = [] }) => {
    // Debug: log incoming delta for mobs
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

 
  
  socket.on('playerSelf', (playerData) => {
    console.log("player spawn");
    // Reuse existing player object if present to preserve references across modules
    let p = (typeof window !== 'undefined' && window.player) ? window.player : null;
    if (!p) {
      p = (typeof createNewPlayer === 'function') ? createNewPlayer() : {};
    }
    if (playerData && typeof playerData === 'object') {
      try { Object.assign(p, playerData); } catch(_) {}
    }
    // Normalize alive/visibility flags
    p.isDead = (typeof p.health === 'number') ? (p.health <= 0) : false;
    p.invulnerable = false;
    if (p.__hiddenBySpectator || p.size === 0) {
      p.size = p.__origSize || p.size || 32;
      delete p.__hiddenBySpectator;
      delete p.__origSize;
    }
    // Publish globally and keep players map in sync
    try { window.player = p; } catch(_) {}
    try { player = p; } catch(_) {}
    try {
      if (typeof playersMap !== 'undefined' && p && p.id) {
        playersMap[p.id] = p;
        if (typeof window !== 'undefined') window.playersMap = playersMap;
      } else if (typeof window !== 'undefined') {
        window.playersMap = window.playersMap || {};
        if (p && p.id) window.playersMap[p.id] = p;
      }
    } catch(_) {}
    isDead = p.isDead;
    resourcesLoaded = true;
    mobloaded = true;
  });

  





 
  // Receive per-client, proximity-filtered dropped items snapshot
  socket.on("droppedItems", (items) => {
    // Merge incoming items with existing droppedItems to avoid losing instant drops
    if (!Array.isArray(items)) items = [];
    if (!Array.isArray(droppedItems)) droppedItems = [];
    // Build a map of current items by id
    const itemMap = new Map(droppedItems.map(it => [it.id, it]));
    // Add or update items from the new snapshot
    for (const it of items) {
      const existing = itemMap.get(it.id);
      let n = normalizeDroppedItem ? normalizeDroppedItem({ ...it }) : { ...it };
      // Preserve local expiration if we've already started counting down client-side
      if (existing && typeof existing.expireAt === 'number') {
        n.createdAt = (typeof existing.createdAt === 'number') ? existing.createdAt : n.createdAt;
        n.lifetimeSec = (typeof existing.lifetimeSec === 'number') ? existing.lifetimeSec : n.lifetimeSec;
        n.expireAt = existing.expireAt;
      }
      itemMap.set(n.id, n);
    }
    // Remove items not present in the new snapshot
    for (const id of Array.from(itemMap.keys())) {
      if (!items.some(it => it.id === id)) {
        itemMap.delete(id);
      }
    }
    droppedItems = Array.from(itemMap.values());
  });
  
  socket.on('updatePlayerStats', (stats) => {
    if (player) Object.assign(player, stats);
  });

  socket.on('GainSoul', (amount) => {
    window.soulCurrency.add(amount);
  });

  // Low-latency item appear: merge single new item between snapshots
  socket.on("newDroppedItem", (item) => {
    if (!item || typeof item.id !== 'number') return;
    if (!Array.isArray(droppedItems)) droppedItems = [];
    const exists = droppedItems.some(it => it && it.id === item.id);
    if (!exists) droppedItems.push(normalizeDroppedItem ? normalizeDroppedItem({ ...item }) : { ...item });
  });

  // Multiplayer-only events: disabled in network-only mode
  if (ENABLE_MULTIPLAYER_CLIENT) {
    socket.on('playerMoved', (playerData) => {
      if (playerData.id !== socket.id && otherPlayers[playerData.id]) {
        otherPlayers[playerData.id].x = playerData.x;
        otherPlayers[playerData.id].y = playerData.y;
        if (typeof playerData.facingAngle === 'number') otherPlayers[playerData.id].facingAngle = playerData.facingAngle;
        if ('selectedToolType' in playerData) otherPlayers[playerData.id].selectedToolType = playerData.selectedToolType;
      }
    });

    socket.on('playerDisconnected', (id) => {
      delete otherPlayers[id];
    });
  }

  socket.on("itemDrop", ({ item, amount }) => {
    if (inventory.addItem(item, amount)) {
      showMessage(`+${amount} ${item}`);
    }
  });

  socket.on('showMessage', (text) => {
    showMessage(text, 2); // 2 seconds duration
  });

  socket.on("gainXP", (amount) => {
    gainXP(amount);
  });

  if (ENABLE_MULTIPLAYER_CLIENT) {
    socket.on("playerLevelUpdated", ({ id, level }) => {
      if (otherPlayers[id]) {
        otherPlayers[id].level = level;
      }
    });
  }

  socket.on("addItem", ({ type, amount }) => {
    if (inventory.addItem(type, amount)) {
      playPopClaim();
      showMessage(`Picked up ${amount} ${type}`);
    }
  });

  socket.on("removeDroppedItem", (itemId) => {
  if (!Array.isArray(droppedItems)) { droppedItems = []; return; }
  droppedItems = droppedItems.filter(item => item && item.id !== itemId);
  });

  socket.on('playerDied', () => {
    isDead = true;
    console.log("Player has died");
    playDeath();
    for (const [item, count] of Object.entries(inventory.items)) {
      dropItem(item, count, player);
    }
    inventory.clear();
    //I want a delay here
    player = null;
    otherPlayers = {};
  // Keep resources/mobs flags so the loop doesn't stall during respawn
    const deathScreen = document.getElementById("deathScreen");
    deathScreen.style.display = "block";
    // Add Respawn button if not already present
    let respawnBtn = document.getElementById("respawnBtn");
    if (!respawnBtn) {
      respawnBtn = document.createElement("button");
      respawnBtn.id = "respawnBtn";
      respawnBtn.textContent = "Respawn";
      respawnBtn.style.marginTop = "20px";
  respawnBtn.onclick = function() { if (typeof window.respawnNow === 'function') window.respawnNow(); };
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
      playPlayerHurt();
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
      socket.emit("pingCheck", () => { ping = performance.now() - startTime; });
    } else {
      // Offline: keep ping at 0 for UI
      ping = 0;
    }
  }, 2000);
  window.socket = socket;
}







function backToHome() {
  if (socket) {
    try { socket.disconnect(); } catch(_) {}
    socket = null;
  }
  // Full client-side reset when returning home
  if (typeof window.resetClientState === 'function') window.resetClientState();
  const serverJoin = document.getElementById("serverJoin");
  if (serverJoin) serverJoin.style.display = "none";
  const localLAN = document.getElementById("localLAN");
  if (localLAN) localLAN.style.display = "none";
  const hostPrompt = document.getElementById("hostPrompt");
  if (hostPrompt) hostPrompt.style.display = "none";
  const joinLocalPrompt = document.getElementById("joinLocalPrompt");
  if (joinLocalPrompt) joinLocalPrompt.style.display = "none";
  const nameEntry = document.getElementById("nameEntry");
  if (nameEntry) nameEntry.style.display = "none";
  const deathScreen = document.getElementById("deathScreen");
  if (deathScreen) deathScreen.style.display = "none";
  const homePage = document.getElementById("homePage");
  if (homePage) homePage.style.display = "block";
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
      retryButton.onclick = playNow; // Changed to playNow
      document.getElementById("serverJoin").appendChild(retryButton);
    }
    // Log error for diagnostics
    console.error("Server connection error:", message);
  }
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
  const deathScreen = document.getElementById("deathScreen");
  if (deathScreen) deathScreen.style.display = "none";
  // Hide respawn button if present
  const respawnBtn = document.getElementById("respawnBtn");
  if (respawnBtn) respawnBtn.style.display = "none";
  // Full client-side reset like a fresh player
  if (typeof window.resetClientState === 'function') window.resetClientState();
  const homePage = document.getElementById("homePage");
  if (homePage) homePage.style.display = "block";
  // Use correct input ID for home page
  const nameInput = document.getElementById("playerNameInputHome");
  if (nameInput) nameInput.value = "";
}



// ========================
// Game Functions
// ========================

if (typeof CYCLE_LENGTH === 'undefined') {
  var CYCLE_LENGTH = 120;
}
if (typeof DAY_LENGTH === 'undefined') {
  var DAY_LENGTH = 120;
}
if (typeof lastDayIncrement === 'undefined') {
  var lastDayIncrement = false;
}
if (typeof Day === 'undefined') {
  var Day = 0;
}


function calculateDayNightCycle() {
  if (player && gameTime >= DAY_LENGTH) {
    // if (!(window.graphicsSettings && window.graphicsSettings.performanceMode)) {
    //   ctx.save();
    //   ctx.globalAlpha = 0.28;
    //   ctx.fillStyle = '#000';
    //   ctx.fillRect(0, 0, canvas.width, canvas.height);
    //   ctx.restore();
    //   drawLightSources();
    // }
  }
  
}



// Drop settings (singleplayer)
const DROP_DESPAWN_LIFETIME_SEC = 60;     // Item lifetime before despawn (production)
const DROP_BLINK_START_SEC = 30;          // Start blinking when remaining <= 30s
const DROP_BLINK_MAX_HZ = 4;              // Cap max blink rate (per request)
// Expose for other modules (items.js/blocks.js) that need to read these at runtime
try {
  window.DROP_DESPAWN_LIFETIME_SEC = DROP_DESPAWN_LIFETIME_SEC;
  window.DROP_BLINK_START_SEC = DROP_BLINK_START_SEC;
  window.DROP_BLINK_MAX_HZ = DROP_BLINK_MAX_HZ;
} catch(_) {}

// Drop an item entity at an entity's center (player/mob/resource)
// options:
//   - pickupDelaySec: seconds before it can be picked up (default: 1 for player drop, 0 for others)
//   - dropCooldownSec: seconds before player can drop again (default: same as pickupDelaySec)
function dropItem(type, amount, entity, dropbyplayer=false, options = {}) {
  const makeDrop = (x, y, pickupDelay = 0) => {
    const nowSec = performance.now() / 1000;
    const lifetime = DROP_DESPAWN_LIFETIME_SEC;
    return {
      id: Math.floor(Math.random()*1e9),
      type, amount, x, y,
      pickupDelay,
      createdAt: nowSec,
      lifetimeSec: lifetime,
      expireAt: nowSec + lifetime,
    };
  };
  const cx = entity.x + entity.size / 2;
  const cy = entity.y + entity.size / 2;

  const defaultPickupDelay = dropbyplayer ? 1 : 0;
  const pickupDelaySec = Number.isFinite(options.pickupDelaySec) ? Math.max(0, options.pickupDelaySec) : defaultPickupDelay;
  const dropCooldownSec = Number.isFinite(options.dropCooldownSec) ? Math.max(0, options.dropCooldownSec) : (dropbyplayer ? pickupDelaySec : 0);

  // Optional: throttle player drop to prevent immediate re-drop spam
  if (dropbyplayer) {
    const now = performance.now() / 1000;
    const nextAllowed = window.__nextAllowedDropAtSec || 0;
    if (now < nextAllowed) {
      const wait = Math.max(0, (nextAllowed - now)).toFixed(1);
      if (typeof showMessage === 'function') showMessage(`Please wait ${wait}s before dropping again`);
      return false;
    }
  }

  if (dropbyplayer) {
    if (inventory.removeItem(type, amount)) {
      if (socket && socket.connected) {
        socket.emit("dropItem", { type, amount, x: cx, y: cy, pickupDelay: pickupDelaySec });
      } else {
        // Offline: create a local dropped item
        droppedItems.push(makeDrop(cx, cy, pickupDelaySec));
      }
      // Start cooldown after a successful drop
      if (dropCooldownSec > 0) {
        window.__nextAllowedDropAtSec = (performance.now() / 1000) + dropCooldownSec;
      }
      if (typeof showMessage === 'function') showMessage(`You dropped ${amount} ${type}`);
      return true;
    } else {
      if (typeof showMessage === 'function') showMessage("Failed to drop item");
      return false;
    }
  } else {
    // Non-player (e.g., mob/resource) drops spawn with slight scatter by default
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 60;
    const dx = cx + offsetX, dy = cy + offsetY;
    if (socket && socket.connected) {
      socket.emit("dropItem", { type, amount, x: dx, y: dy, pickupDelay: pickupDelaySec });
    } else {
      droppedItems.push(makeDrop(dx, dy, pickupDelaySec));
    }
    return true;
  }
}

// Ensure received items (if any in online mode) have a lifetime when used in SP
function normalizeDroppedItem(it) {
  if (!it) return it;
  const nowSec = performance.now() / 1000;
  if (typeof it.expireAt !== 'number') {
    const lifetime = typeof it.lifetimeSec === 'number' ? it.lifetimeSec : DROP_DESPAWN_LIFETIME_SEC;
    it.lifetimeSec = lifetime;
    it.createdAt = (typeof it.createdAt === 'number') ? it.createdAt : nowSec;
    it.expireAt = nowSec + lifetime;
  }
  return it;
}

function submitDropAmount() {
  const input = document.getElementById("dropAmountInput");
  const amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount < 1 || amount > currentMaxCount) {
    showMessage("Invalid amount");
    document.getElementById("dropAmountPrompt").style.display = "none";
    return;
  }
  dropItem(currentDropType, amount, player, true);
  document.getElementById("dropAmountPrompt").style.display = "none";
  document.getElementById("dropAmountInput").value = "";
}

function dropAll() {
  dropItem(currentDropType, currentMaxCount, player, true);
  document.getElementById("dropAmountPrompt").style.display = "none";
  document.getElementById("dropAmountInput").value = "";
}

// Update the promptDropAmount function
function promptDropAmount(type, maxCount) {
  playSelect();
  currentDropType = type;
  currentMaxCount = maxCount;
  const dropPrompt = document.getElementById('dropAmountPrompt');
  const input = document.getElementById("dropAmountInput");
  input.placeholder = `Amount to drop (1-${maxCount})`;
  input.max = maxCount;
  input.value = "1";
  dropPrompt.style.display = "block";
  // Position slightly above center so it doesn't cover the player
  dropPrompt.style.left = '50%';
  dropPrompt.style.top = 'calc(50% - 120px)';
  dropPrompt.style.transform = 'translate(-50%, -50%)';
  input.focus();
  
  // Add escape handler specifically for the drop prompt
  const escapeHandler = function(e) {
    if (e.key === 'Escape') {
      closeDropPrompt();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

// Dev testing
if (isDevMode()) {
  onReady(() => {
    // Always start from a clean client state in dev
    if (typeof window.resetClientState === 'function') window.resetClientState();
    // Hide all menus and show game instantly (with null checks)
    const homePage = document.getElementById("homePage");
    if (homePage) homePage.style.display = "none";
    const serverJoin = document.getElementById("serverJoin");
    if (serverJoin) serverJoin.style.display = "none";
    // Remove these old UI elements (with null checks):
    // const localLAN = document.getElementById("localLAN");
    // if (localLAN) localLAN.style.display = "none";
    // const hostPrompt = document.getElementById("hostPrompt");
    // if (hostPrompt) hostPrompt.style.display = "none";
    // const joinLocalPrompt = document.getElementById("joinLocalPrompt");
    // if (joinLocalPrompt) joinLocalPrompt.style.display = "none";
    const nameEntry = document.getElementById("nameEntry");
    if (nameEntry) nameEntry.style.display = "none";
    const deathScreen = document.getElementById("deathScreen");
    if (deathScreen) deathScreen.style.display = "none";
    
    console.log('[Dev] Auto-connect initializing...');
    // In dev mode, connect to the same host the page was served from
    // Try online first; fall back to offline
    try {
      const base = `${location.protocol}//${location.host}`;
      initializeSocket(base);
    } catch(_) { initializeSocket(null); }
    // Wait for socket connection before submitting name
    const tryLogin = () => {
      if (CreateRespawnPlayer) CreateRespawnPlayer();
      showData = false;
      console.log('[Dev] Auto-login done (offline/online)');
    };
    tryLogin();
  });
} else {
  // Minimal UI bootstrap for non-dev mode to ensure menus/buttons exist
onReady(() => {

    // Instead, just ensure home page is visible
    const nameEntry = document.getElementById('nameEntry');
    if (nameEntry && nameEntry.children.length === 0) {
      // This is no longer needed since we have the new UI
    }
    
    // Hide non-home pages on load
    ['serverJoin','nameEntry','deathScreen']
      .forEach(id => { 
        const el = document.getElementById(id); 
        if (el) el.style.display = 'none'; 
      });
      
    const homePage = document.getElementById('homePage');
    if (homePage) homePage.style.display = 'block';
  });
}

// Unified client-side respawn (used by death screen and settings panel)
window.respawnNow = function respawnNow() {
  try {
    console.log('[DEBUG] respawnNow called');
    // Always allow respawn, even if not dead
    const input = document.getElementById('playerNameInputHome');
    const name = (input && input.value.trim()) || 'Unknown';
    if (!socket || socket.disconnected) {
      showMessage("Not connected to server. Please try again.", 5);
      backToHome();
      return;
    }
    // Full reset of local state
    if (typeof window.resetClientState === 'function') { console.log('[DEBUG] Calling resetClientState'); window.resetClientState(); }
    if (typeof window.CreateRespawnPlayer === 'function') { console.log('[DEBUG] Calling CreateRespawnPlayer'); window.CreateRespawnPlayer(); }
    // Close settings panel if open
    if (window.__settingsPanel && typeof window.__settingsPanel.close === 'function') {
      console.log('[DEBUG] Closing settings panel');
      window.__settingsPanel.close();
    }
    // Hide death screen if present
    const deathScreen = document.getElementById('deathScreen');
    if (deathScreen) deathScreen.style.display = 'none';
    console.log('[DEBUG] respawnNow finished');
  } catch (e) {
    console.error('respawnNow error', e);
  }
};

// Centralized local state reset used by Home/Main and Respawn
window.resetClientState = function resetClientState() {
  try {
    // UI states
    const deathScreen = document.getElementById('deathScreen');
    if (deathScreen) deathScreen.style.display = 'none';
    // player lifecycle flags
    try { isDead = false; } catch(_) {}
    // inventory
    try { if (window.inventory && typeof window.inventory.clear === 'function') window.inventory.clear(); } catch(_) {}
    // hotbar
    try {
      if (window.hotbar) {
        window.hotbar.slots = Array.isArray(window.hotbar.slots) ? window.hotbar.slots : new Array(12).fill(null);
        // don't force selectedIndex to null here; save/load will restore it
      }
    } catch(_) {}
    // players
    try { window.otherPlayers = {}; } catch(_) {}
    try { window.player = null; } catch(_) {}
    // items
    try { window.droppedItems = []; } catch(_) {}
    // optional: clear mobs/resources caches; these will be repopulated on join
    try { if (typeof mobs !== 'undefined') mobs = {}; } catch(_) {}
    try { if (typeof mobloaded !== 'undefined') mobloaded = false; } catch(_) {}
    try {
      if (typeof window.allResources !== 'undefined') {
        for (const k of Object.keys(window.allResources)) {
          if (Array.isArray(window.allResources[k])) window.allResources[k].length = 0;
          else window.allResources[k] = [];
        }
      }
    } catch(_) {}
    try { if (typeof resourcesLoaded !== 'undefined') resourcesLoaded = false; } catch(_) {}

  } catch (e) {
    console.warn('resetClientState partial failure', e);
  }
};

function closeDropPrompt() {
  const dropPrompt = document.getElementById('dropAmountPrompt');
  if (dropPrompt) dropPrompt.style.display = 'none';
}

(function bootstrap() {
      const ready = () => (typeof initializeSocket === 'function');
      const tryInit = () => {
        if (!ready()) return setTimeout(tryInit, 50);

        // Hide canvas clicks until gameplay
        const gc = document.getElementById('gameCanvas');
        if (gc) gc.style.pointerEvents = 'none';

        const playBtn = document.getElementById('spPlayBtn');
        const backBtn = document.getElementById('spBackBtn');

  // Press Play ➜ connect to localhost:3000; if it fails we start offline
        if (playBtn) playBtn.onclick = function() {
          // Show a quick “connecting…” panel (optional)
          const join = document.getElementById('serverJoin');
          const spMenu = document.getElementById('singlePlayerMenu');
          if (spMenu) spMenu.style.display = 'none';
          if (join) join.style.display = 'block';

          // Ask once for a name (fallback to "Unknown")
          let name = localStorage.getItem('player.name') || '';
          if (!name) {
            name = prompt('Enter your name') || 'Unknown';
            try { localStorage.setItem('player.name', name); } catch(_){}
          }

          // Connect to local server (http://localhost:3000)
          // initializeSocket comes from your network.js
          initializeSocket('http://localhost:3000');  // tries online, falls back offline

          // Regardless of mode, start gameplay immediately
          if (spMenu) spMenu.style.display = 'none';
          if (join) join.style.display = 'none';
          if (CreateRespawnPlayer) CreateRespawnPlayer();
          if (gc) gc.style.pointerEvents = 'auto';
        };

        if (backBtn) backBtn.onclick = function() {
          // Go back to main index.html (like your existing flow)
          window.location.href = "../index.html";
        };
      };
      tryInit();
    })();

