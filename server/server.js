const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  },
  path: '/socket.io',
});
const PORT = process.env.PORT || 3000;
// Performance tuning constants (override with environment variables to tune without code changes)
// You can push further by setting env: TICK_MS=20 (50 FPS) or 16 (60 FPS) if CPU allows
const TICK_MS = Number(process.env.TICK_MS) || 25; // default ~40 FPS
const MOB_VIS_RADIUS = Number(process.env.MOB_VIS_RADIUS) || 1400; // Per-client mob visibility radius (world pixels)
// Spatial grid cell size for mob lookup (tune based on typical mob density)
const MOB_GRID_CELL = Number(process.env.MOB_GRID_CELL) || 350;
// Rate limits (per client)
// For a faster feel with more CPU, try MOBS_DELTA_MIN_MS=30 (~33 Hz)
const MOBS_DELTA_MIN_MS = Number(process.env.MOBS_DELTA_MIN_MS) || 40;    // default ~25 Hz for mobsDelta
const ITEMS_EMIT_MIN_MS = Number(process.env.ITEMS_EMIT_MIN_MS) || 100;   // max ~10 Hz for droppedItems snapshots
const PLAYERS_DELTA_MIN_MS = Number(process.env.PLAYERS_DELTA_MIN_MS) || 100; // max ~10 Hz for playersDelta
// Global rate limits
const GAME_TIME_MIN_MS = Number(process.env.GAME_TIME_MIN_MS) || 100; // emit gameTime at ~10 Hz
// Server stats logging interval (set STATS_LOG_MS=0 to disable)
const STATS_LOG_MS = Number(process.env.STATS_LOG_MS ?? 10000);

const {
  resourceTypes,
  allResources,
  spawnAllResources,
  updateResourceRespawns,
  isOverlappingAny
} = require('./resourceManager');

const {
  pond,
  mobs,
  mobtype,
  DAY_LENGTH,
  CYCLE_LENGTH,
  spawnAllMob,
  updateMobs,
  updateMobRespawns,
  setIO,
} = require('./mobdata');

// Provide io to mobdata for targeted emits (e.g., knockback)
setIO(io);

const {
  players,
} = require('./playerdata');

let gameTime = 0;
let droppedItems = [];
let nextItemId = 0;
let lastUpdate = Date.now();
let lastStaticUpdate = Date.now();
const WORLD_SIZE = 5000;
// Tick timing stats (ms)
let __tickStats = { count: 0, sum: 0, min: Infinity, max: 0 };
// Cache last sent mob snapshots per client (to emit only on change)
const lastMobsSnapshot = new Map(); // sid -> string (last full snapshot JSON)
// Cache last visible mobs as a flat map for delta computation: sid -> Map(key, mob)
const lastMobsFlat = new Map();
// Track last time a full snapshot was sent per client
const lastMobsFullAt = new Map();
// Track last time we sent mobsDelta per client
const lastMobsDeltaAt = new Map();
// Cache last sent dropped items per client
const lastItemsSnapshot = new Map(); // sid -> string
const lastItemsEmitAt = new Map(); // sid -> timestamp
// Cache last sent state per client
const lastStateSnapshot = new Map(); // sid -> string
// Cache last resources snapshot for periodic broadcasts
let lastResourcesSnapshot = "";
// Cache last per-client players map for delta (id -> minimal fields)
const lastPlayersDeltaMap = new Map(); // sid -> Map(id, obj)
const lastPlayersDeltaAt = new Map(); // sid -> timestamp
const ItemTypes = {
  // Resources
  wood: { name: "Wood", color: "green", attackSpeed: 0.35 },
  stone: { name: "Stone", color: "darkgray", attackSpeed: 0.35 },
  iron: { name: "Iron", color: "white", attackSpeed: 0.35 },
  gold: { name: "Gold", color: "gold", attackSpeed: 0.35 },
  food: { name: "Food", color: "red", attackSpeed: 0.35 },
  slime: { name: "Slime", color: "pink", attackSpeed: 0.35 },
  stick: { name: "Stick", color: "brown", attackSpeed: 0.35 },
  fur: { name: "Fur", color: "gray", attackSpeed: 0.35 },
  web: { name: "Web", color: "white", attackSpeed: 0.35 },
  paw: { name: "Paw", color: "yellow", attackSpeed: 0.35 },
  torch: { name: "Torch", color: "yellow", attackSpeed: 0.35 },
  // Tools
  wooden_axe: { name: "Wooden Axe", color: "sienna", isTool: true, category: "axe", tier: 1, damage: 5, attackRange: 50, attackSpeed: 0.3 },
  stone_axe: { name: "Stone Axe", color: "darkgray", isTool: true, category: "axe", tier: 2, damage: 10, attackRange: 50, attackSpeed: 0.3 },
  iron_axe: { name: "Iron Axe", color: "white", isTool: true, category: "axe", tier: 3, damage: 20, attackRange: 50, attackSpeed: 0.3 },
  gold_axe: { name: "Gold Axe", color: "gold", isTool: true, category: "axe", tier: 4, damage: 40, attackRange: 50, attackSpeed: 0.3 },
  wooden_pickaxe: { name: "Wooden Pickaxe", color: "sienna", isTool: true, category: "pickaxe", tier: 1, damage: 5, attackRange: 50, attackSpeed: 0.3 },
  stone_pickaxe: { name: "Stone Pickaxe", color: "darkgray", isTool: true, category: "pickaxe", tier: 2, damage: 10, attackRange: 50, attackSpeed: 0.3 },
  iron_pickaxe: { name: "Iron Pickaxe", color: "white", isTool: true, category: "pickaxe", tier: 3, damage: 20, attackRange: 50, attackSpeed: 0.3 },
  gold_pickaxe: { name: "Gold Pickaxe", color: "gold", isTool: true, category: "pickaxe", tier: 4, damage: 40, attackRange: 50, attackSpeed: 0.3 },
  wooden_sword: { name: "Wooden Sword", color: "sienna", isTool: true, category: "sword", tier: 1, damage: 5, attackRange: 50, attackSpeed: 0.3 },
  stone_sword: { name: "Stone Sword", color: "darkgray", isTool: true, category: "sword", tier: 2, damage: 10, attackRange: 50, attackSpeed: 0.3 },
  iron_sword: { name: "Iron Sword", color: "white", isTool: true, category: "sword", tier: 3, damage: 20, attackRange: 50, attackSpeed: 0.3 },
  gold_sword: { name: "Gold Sword", color: "gold", isTool: true, category: "sword", tier: 4, damage: 40, attackRange: 50, attackSpeed: 0.3 },
  hand: { name: "Hand", color: "peachpuff", attackSpeed: 0.35 },
};

// Cache busting: cache static assets aggressively; disable index so SPA shell isn't cached here
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '365d', immutable: true, index: false }));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

spawnAllResources();
spawnAllMob(allResources, players, gameTime);

// Simple spatial grid for mobs (rebuilt each tick)
// Map key: "cx,cy" -> Array of { type, ref }
let mobGrid = new Map();
function gridKey(cx, cy) { return `${cx},${cy}`; }
function rebuildMobGrid() {
  mobGrid.clear();
  for (const [type, list] of Object.entries(mobs)) {
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (!m || m.size <= 0 || m.health <= 0) continue;
      const cx = Math.floor(m.x / MOB_GRID_CELL);
      const cy = Math.floor(m.y / MOB_GRID_CELL);
      const key = gridKey(cx, cy);
      let arr = mobGrid.get(key);
      if (!arr) { arr = []; mobGrid.set(key, arr); }
      arr.push({ type, ref: m });
    }
  }
}
function gatherMobsNear(x, y, r) {
  const res = [];
  const cellMinX = Math.floor((x - r) / MOB_GRID_CELL);
  const cellMaxX = Math.floor((x + r) / MOB_GRID_CELL);
  const cellMinY = Math.floor((y - r) / MOB_GRID_CELL);
  const cellMaxY = Math.floor((y + r) / MOB_GRID_CELL);
  const r2 = r * r;
  for (let cy = cellMinY; cy <= cellMaxY; cy++) {
    for (let cx = cellMinX; cx <= cellMaxX; cx++) {
      const arr = mobGrid.get(gridKey(cx, cy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const { type, ref: m } = arr[i];
        if (!m || m.size <= 0 || m.health <= 0) continue;
        const mx = m.x + m.size / 2;
        const my = m.y + m.size / 2;
        const dx = mx - x;
        const dy = my - y;
        if (dx * dx + dy * dy <= r2) res.push({ type, mob: m });
      }
    }
  }
  return res;
}

// Simple spatial grid for dropped items (rebuilt each tick)
const ITEM_GRID_CELL = 350;
let itemGrid = new Map();
function itemGridKey(cx, cy) { return `${cx},${cy}`; }
function rebuildItemGrid() {
  itemGrid.clear();
  for (let i = 0; i < droppedItems.length; i++) {
    const it = droppedItems[i];
    if (!it) continue;
    const cx = Math.floor(it.x / ITEM_GRID_CELL);
    const cy = Math.floor(it.y / ITEM_GRID_CELL);
    const key = itemGridKey(cx, cy);
    let arr = itemGrid.get(key);
    if (!arr) { arr = []; itemGrid.set(key, arr); }
    arr.push(it);
  }
}
function gatherItemsNear(x, y, r) {
  const res = [];
  const cellMinX = Math.floor((x - r) / ITEM_GRID_CELL);
  const cellMaxX = Math.floor((x + r) / ITEM_GRID_CELL);
  const cellMinY = Math.floor((y - r) / ITEM_GRID_CELL);
  const cellMaxY = Math.floor((y + r) / ITEM_GRID_CELL);
  const r2 = r * r;
  for (let cy = cellMinY; cy <= cellMaxY; cy++) {
    for (let cx = cellMinX; cx <= cellMaxX; cx++) {
      const arr = itemGrid.get(itemGridKey(cx, cy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        const dx = it.x - x;
        const dy = it.y - y;
        if (dx * dx + dy * dy <= r2) res.push(it);
      }
    }
  }
  return res;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  // Send initial static data only to the connecting client
  socket.emit("resourceType", resourceTypes);
  socket.emit("resources", allResources);
  socket.emit("mobType", mobtype);
  socket.emit("itemTypes", ItemTypes);

  socket.on("pingCheck", (callback) => {callback();});

  socket.on('setName', (name) => {
    if (players[socket.id]) {
      delete players[socket.id];
    }
    players[socket.id] = createNewPlayer(socket.id, name);
    // Store only socket id to avoid circular reference
    players[socket.id].socketId = socket.id;
    socket.emit('currentPlayers', players);
    socket.emit('playerSelf', players[socket.id]);
    socket.broadcast.emit('newPlayer', players[socket.id]);
    // On respawn, proactively send essential world data again
    try {
      socket.emit("resourceType", resourceTypes);
      socket.emit("resources", allResources);
      socket.emit("mobType", mobtype);
      socket.emit("itemTypes", ItemTypes);
      // Send immediate proximity snapshots to avoid waiting for the next tick
      const p = players[socket.id];
      if (p) {
        const px = p.x + (p.size || 0) / 2;
        const py = p.y + (p.size || 0) / 2;
        const nearMobs = gatherMobsNear(px, py, MOB_VIS_RADIUS);
        const round1 = (v) => Math.round(v * 10) / 10;
        const round3 = (v) => Math.round(v * 1000) / 1000;
        const payload = {};
        for (let i = 0; i < nearMobs.length; i++) {
          const { type, mob: m } = nearMobs[i];
          if (!payload[type]) payload[type] = [];
          payload[type].push({
            type,
            id: m.id,
            x: round1(m.x),
            y: round1(m.y),
            profile: m.profile,
            health: Math.round(m.health),
            maxHealth: Math.round(m.maxHealth),
            size: Math.round(m.size),
            facingAngle: round3(m.facingAngle),
          });
        }
        const normalized = {};
        for (const t of Object.keys(payload).sort()) {
          normalized[t] = payload[t].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        }
        socket.compress(false).emit("mobs", normalized);
        const r = MOB_VIS_RADIUS;
        const items = gatherItemsNear(px, py, r).map(it => ({ id: it.id, type: it.type, amount: it.amount, x: round1(it.x), y: round1(it.y) }));
        items.sort((a, b) => a.id - b.id);
        socket.compress(false).emit("droppedItems", items);
      }
    } catch(_) {}
  });

  

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (p && p.health > 0) {
      p.x = data.x;
      p.y = data.y;
  socket.compress(false).volatile.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
      });
    }
  });

  //new code
  socket.on("playerLeveledUp", ({ id, level }) => {
    const p = players[socket.id];
    if (p && p.health > 0) {
      p.level = level;

      // Broadcast to all other clients
  socket.compress(false).volatile.broadcast.emit("playerLevelUpdated", {
        id: socket.id,
        level: level
      });
    }
  });

  //old code
  socket.on('resourceHit', ({ id, type, newHealth }) => handleHit(socket, allResources, type, id, newHealth, resourceTypes));
  socket.on('mobhit', ({ id, type, newHealth }) => handleHit(socket, mobs, type, id, newHealth, mobtype, true));
  socket.on('dropItem', ({ type, amount, x, y }) => handleDropItem(socket, type, amount, x, y));
  socket.on('pickupItem', itemId => handlePickupItem(socket, itemId));
  // Inside io.on('connection', (socket) => {...})
  socket.on('playerhit', ({ targetId, newHealth }) => handlePlayerHit(socket, targetId, newHealth));
  socket.on('consumeFood', ({ amount }) => handleConsumeFood(socket, amount));
  socket.on('disconnect', () => handleDisconnect(socket));

    // Remove socket reference from player on disconnect
    if (players[socket.id]) {
      delete players[socket.id].socket;
    }

});


function emitToNearby(eventName, payload, x, y, radius) {
  const r2 = radius * radius;
  for (const [sid, sock] of io.of("/").sockets) {
    const p = players[sid];
    if (!p) continue;
    const px = p.x + (p.size || 0) / 2;
    const py = p.y + (p.size || 0) / 2;
    const dx = (x + 0) - px;
    const dy = (y + 0) - py;
    if (dx * dx + dy * dy <= r2) {
      sock.compress(false).volatile.emit(eventName, payload);
    }
  }
}

// Reliable variant for important events (e.g., knockback) that shouldn't be dropped
function emitToNearbyReliable(eventName, payload, x, y, radius) {
  const r2 = radius * radius;
  for (const [sid, sock] of io.of("/").sockets) {
    const p = players[sid];
    if (!p) continue;
    const px = p.x + (p.size || 0) / 2;
    const py = p.y + (p.size || 0) / 2;
    const dx = (x + 0) - px;
    const dy = (y + 0) - py;
    if (dx * dx + dy * dy <= r2) {
      sock.compress(false).emit(eventName, payload);
    }
  }
}

let lastGameTimeEmitAt = 0;
function maybeEmitGameTime() {
  const nowMs = Date.now();
  if (nowMs - lastGameTimeEmitAt >= GAME_TIME_MIN_MS) {
    lastGameTimeEmitAt = nowMs;
    io.compress(false).volatile.emit("gameTime", gameTime);
  }
}

//update contiunous
setInterval(() => {
  const t0 = Date.now();
  const now = t0;
  const deltaTime = (now - lastUpdate) / 1000;
  lastUpdate = now;
  updatePlayers(deltaTime, now);

  gameTime = (gameTime + deltaTime) % CYCLE_LENGTH;

  // Update mobs BEFORE broadcasting so clients get freshest positions (reduces ~1 tick latency)
  updateMobs(allResources, players, deltaTime);
  // Rebuild spatial grid for fast per-client mob queries
  rebuildMobGrid();
  // Rebuild spatial grid for items
  rebuildItemGrid();
  emitVisibleMobsPerClient();
  emitVisibleDroppedItemsPerClient();
  maybeEmitGameTime();
  // Record tick duration stats
  const dtMs = Date.now() - t0;
  __tickStats.count++;
  __tickStats.sum += dtMs;
  if (dtMs < __tickStats.min) __tickStats.min = dtMs;
  if (dtMs > __tickStats.max) __tickStats.max = dtMs;
}, TICK_MS);

// Static update loop (every 10s)
setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastStaticUpdate) / 1000; // in seconds
  lastStaticUpdate = now;

  updateResourceRespawns(deltaTime);
  updateMobRespawns(deltaTime, allResources, players, gameTime);
  // Emit resources only when snapshot changes (reduces redundant bandwidth)
  try {
    const snap = JSON.stringify(allResources);
    if (snap !== lastResourcesSnapshot) {
      lastResourcesSnapshot = snap;
      io.emit("resources", allResources);
    }
  } catch (_) {
    // Fallback: emit if snapshot fails for any reason
    io.emit("resources", allResources);
  }


}, 10000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Server running on http://192.168.4.48:${PORT} (LAN accessible)`);
  // Startup config summary
  console.log('⚙️  Config:', {
    TICK_MS,
    MOB_VIS_RADIUS,
    MOB_GRID_CELL,
    ITEM_GRID_CELL: 350,
    MOBS_DELTA_MIN_MS,
    ITEMS_EMIT_MIN_MS,
    PLAYERS_DELTA_MIN_MS,
    GAME_TIME_MIN_MS,
    STATS_LOG_MS,
    WORLD_SIZE,
  });
});

function createNewPlayer(id, name) {
  const size = 32;
  let x, y;
  let attempts = 0;

  while (true) {
    x = Math.random() * (WORLD_SIZE / 5 - size);
    y = Math.random() * (WORLD_SIZE / 5 - size);
    attempts++;
    const overlapsResource = isOverlappingAny(allResources, x, y, size, size);
    const overlapsMob = isOverlappingAny(mobs, x, y, size, size);
    if (!overlapsResource && !overlapsMob) break;
    if (attempts % 1000 === 0) {
      console.warn(`⚠️ Still trying to place player ${id}, attempts: ${attempts}`);
    }
  }
  return {
    id,
    name: name || "Unnamed",
    x,
    y,
    size,
    color: "rgba(0, 0, 0, 0)",
    speed: 200,
    facingAngle: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    health: 100,
    maxHealth: 100,
    healthRegen: 10,
    lastDamageTime: null,
    isDead: false,
    maxStamina: 100,
    staminaRegenSpeed: 40,
    hunger: 100, // Add hunger
    maxHunger: 100,
    hungerDepletionSpeed: 2,
    lastHungerDepletion: Date.now(),
    
  };
}

function emitVisibleMobsPerClient() {
  for (const [sid, sock] of io.of("/").sockets) {
    const p = players[sid];
    if (!p) continue;
    const px = p.x + (p.size || 0) / 2;
    const py = p.y + (p.size || 0) / 2;
    const payload = {};
    const nearby = gatherMobsNear(px, py, MOB_VIS_RADIUS);
    // Build with rounding to stabilize JSON and reduce diff noise
    const round1 = (v) => Math.round(v * 10) / 10; // 0.1 precision
    const round3 = (v) => Math.round(v * 1000) / 1000; // for angles
    for (let i = 0; i < nearby.length; i++) {
      const { type, mob: m } = nearby[i];
      if (!payload[type]) payload[type] = [];
      payload[type].push({
        type,
        id: m.id,
        x: round1(m.x),
        y: round1(m.y),
        profile: m.profile,
        health: Math.round(m.health),
        maxHealth: Math.round(m.maxHealth),
        size: Math.round(m.size),
        facingAngle: round3(m.facingAngle),
      });
    }
    // Normalize order per type and type keys for stable snapshot
    const sortedTypes = Object.keys(payload).sort();
    const normalized = {};
    for (const t of sortedTypes) {
      normalized[t] = payload[t].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    // Delta compression: build flat maps for current and previous
    const flatNow = new Map();
    for (const [t, arr] of Object.entries(normalized)) {
      for (let i = 0; i < arr.length; i++) {
        const m = arr[i];
        flatNow.set(`${t}:${m.id}`, m);
      }
    }
    const prevFlat = lastMobsFlat.get(sid) || new Map();
    const add = [];
    const update = [];
    const remove = [];
    // Detect adds and updates
    for (const [key, mNow] of flatNow.entries()) {
      const mPrev = prevFlat.get(key);
      if (!mPrev) {
        add.push(mNow);
      } else {
        // Compare fields that can change frequently
        if (
          mNow.x !== mPrev.x ||
          mNow.y !== mPrev.y ||
          mNow.health !== mPrev.health ||
          mNow.size !== mPrev.size ||
          mNow.facingAngle !== mPrev.facingAngle ||
          mNow.profile !== mPrev.profile
        ) {
          update.push(mNow);
        }
      }
    }
    // Detect removals
    for (const [key, mPrev] of prevFlat.entries()) {
      if (!flatNow.has(key)) {
        const [type, id] = key.split(":");
        remove.push({ type, id });
      }
    }
    // Decide whether to send a full snapshot periodically or if there is no previous state
    const nowMs = Date.now();
    const lastFull = lastMobsFullAt.get(sid) || 0;
  const needFull = lastFull === 0 || (nowMs - lastFull) > 300; // Full snapshot at least every 300ms
    if (needFull) {
      const snapshot = JSON.stringify(normalized);
      lastMobsSnapshot.set(sid, snapshot);
      lastMobsFlat.set(sid, flatNow);
      lastMobsFullAt.set(sid, nowMs);
  sock.compress(false).volatile.emit("mobs", normalized);
    } else if (add.length || update.length || remove.length) {
      const lastDelta = lastMobsDeltaAt.get(sid) || 0;
      if (nowMs - lastDelta < MOBS_DELTA_MIN_MS) continue;
      lastMobsDeltaAt.set(sid, nowMs);
      // Send delta
      lastMobsFlat.set(sid, flatNow);
  // Use reliable delivery for mobsDelta to avoid visual freezes when packets drop
  sock.compress(false).emit("mobsDelta", { add, update, remove });
    }
  }
}

function emitVisibleDroppedItemsPerClient() {
  for (const [sid, sock] of io.of("/").sockets) {
    const p = players[sid];
    if (!p) continue;
    const px = p.x + (p.size || 0) / 2;
    const py = p.y + (p.size || 0) / 2;
  const r = MOB_VIS_RADIUS;
    const round1 = (v) => Math.round(v * 10) / 10;
  const visible = gatherItemsNear(px, py, r).map(it => ({ id: it.id, type: it.type, amount: it.amount, x: round1(it.x), y: round1(it.y) }));
    visible.sort((a, b) => a.id - b.id);
    const snapshot = JSON.stringify(visible);
    const nowMs = Date.now();
    if (snapshot !== lastItemsSnapshot.get(sid)) {
      const lastAt = lastItemsEmitAt.get(sid) || 0;
      if (nowMs - lastAt >= ITEMS_EMIT_MIN_MS) {
        lastItemsSnapshot.set(sid, snapshot);
        lastItemsEmitAt.set(sid, nowMs);
        sock.compress(false).volatile.emit("droppedItems", visible);
      }
    }
  }
}

function handleHit(socket, collection, type, id, newHealth, configTypes, isMob = false) {
  const list = collection[type];
  if (!list) return;
  const entity = list?.find(e => e.id === id);
  if (!entity) return;
  const damage = entity.health - newHealth;
  entity.health = newHealth;
  entity.lastHitBy = socket.id;
  if (isMob) entity.pauseTimer = 0.1;
  const config = configTypes[type];
  if (isMob && config.isAggressive) {
    entity.threatTable[socket.id] = (entity.threatTable[socket.id] || 0) + (5 + damage * 0.2);
  }
  // Target health updates only to nearby clients to reduce bandwidth
  if (isMob) {
    emitToNearby("updateMobHealth", { id, type, health: newHealth }, entity.x, entity.y, MOB_VIS_RADIUS);
  } else {
    // For resources, reuse the same radius
    emitToNearby("updateResourceHealth", { id, type, health: newHealth }, entity.x, entity.y, MOB_VIS_RADIUS);
  }
    // Emit knockback event for mob if it was hit by player
  if (isMob) {
    // Compute and store knockback on server so movement reflects it
    const attacker = players[socket.id];
    if (attacker && entity.health > 0) {
      const dx = entity.x - attacker.x;
      const dy = entity.y - attacker.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const FORCE = 320; // slightly stronger for snappier response
      const nx = dx / dist;
      const ny = dy / dist;
      entity.kbVx = nx * FORCE;
      entity.kbVy = ny * FORCE;
  entity.kbTimer = 0.3; // a touch longer to be visible
  const INITIAL_DT = 0.02; // push a bit further immediately
      // Calculate intended new position
      const intendedX = entity.x + entity.kbVx * INITIAL_DT;
      const intendedY = entity.y + entity.kbVy * INITIAL_DT;
      // Prevent mob from entering resources
  if (!isOverlappingAny(allResources, intendedX, intendedY, entity.size, entity.size)) {
        entity.x = intendedX;
        entity.y = intendedY;
      }
      // Clamp inside world (assuming WORLD_SIZE and mob has size)
      if (typeof WORLD_SIZE !== 'undefined' && entity.size) {
        const maxX = WORLD_SIZE - entity.size;
        const maxY = WORLD_SIZE - entity.size;
        if (entity.x < 0) entity.x = 0; else if (entity.x > maxX) entity.x = maxX;
        if (entity.y < 0) entity.y = 0; else if (entity.y > maxY) entity.y = maxY;
      }
    }
  // Notify only nearby clients of mob knockback
  emitToNearbyReliable('mobKnockback', { id, type, sourcePlayerId: socket.id, x: entity.x, y: entity.y, kbVx: entity.kbVx, kbVy: entity.kbVy, kbTimer: entity.kbTimer }, entity.x, entity.y, MOB_VIS_RADIUS);
  }
  if (!isMob) socket.emit("itemDrop", { item: config.drop, amount: damage });
  if (entity.health <= 0) {
    if (isMob) {
      entity.size = 0; // Set size to 0 for mobs
    } else {
      entity.sizeX = 0; // For resources or other entities
      entity.sizeY = 0;
    }
    
    entity.respawnTimer = entity.respawnTime;
    const drops = config.getDropAmount();
    if (Array.isArray(drops)) {
      drops.forEach(drop => {
        socket.emit("itemDrop", { item: drop.type, amount: drop.amount });
      });
    } else {
      socket.emit("itemDrop", { item: config.drop, amount: drops });
    }
    socket.emit("gainXP", 3);
  }
}

function handlePlayerHit(socket, targetId, newHealth) {
  const attacker = players[socket.id], target = players[targetId];
  if (!attacker || !target || target.health <= 0 || targetId === socket.id || newHealth > target.health) return;
  target.health = newHealth;
  target.lastDamageTime = Date.now();
  target.lastHitBy = socket.id;
  target.originalColor = target.originalColor || target.color || "lime";
  target.color = "red";
  setTimeout(() => target.color = target.originalColor, 100);
  // Nearby-only health updates; global changes also flow via playersDelta at a lower rate
  emitToNearby("updatePlayerHealth", { id: targetId, health: target.health }, target.x, target.y, MOB_VIS_RADIUS);
  if (target.health <= 0) {
    target.isDead = true;
    io.emit('playerDisconnected', targetId);
  }
}

function handleDropItem(socket, type, amount, x, y) {
  const item = { id: nextItemId++, type, amount, x, y, despawnTimer: 60, pickupDelay: 1 };
  droppedItems.push(item);
  // Notify only nearby clients about newly dropped item
  emitToNearby("newDroppedItem", item, x, y, MOB_VIS_RADIUS);
}

function handlePickupItem(socket, itemId) {
  const item = droppedItems.find(i => i.id === itemId), p = players[socket.id];
  if (!item || !p) return;
  const distance = Math.sqrt((p.x + p.size / 2 - item.x) ** 2 + (p.y + p.size / 2 - item.y) ** 2);
  if (distance > 26 || item.pickupDelay > 0) return;
  droppedItems = droppedItems.filter(i => i.id !== itemId);
  // Notify only nearby clients about item removal
  emitToNearby("removeDroppedItem", itemId, item.x, item.y, MOB_VIS_RADIUS);
  socket.emit("addItem", { type: item.type, amount: item.amount });
}

function handleConsumeFood(socket, amount) {
  const p = players[socket.id];
  if (!p || p.isDead || p.hunger >= p.maxHunger) return;
  p.hunger = Math.min(p.maxHunger, p.hunger + 20 * amount);
}

function handleDisconnect(socket) {
  console.log(`Player disconnected: ${socket.id}`);
  // Clear cached mob snapshot for this client
  lastMobsSnapshot.delete(socket.id);
  lastMobsFlat.delete(socket.id);
  lastMobsFullAt.delete(socket.id);
  lastMobsDeltaAt.delete(socket.id);
  lastItemsSnapshot.delete(socket.id);
  lastItemsEmitAt.delete(socket.id);
  lastStateSnapshot.delete(socket.id);
  lastPlayersDeltaMap.delete(socket.id);
  lastPlayersDeltaAt.delete(socket.id);
  delete players[socket.id];
  for (const mobList of Object.values(mobs)) {
    mobList.forEach(mob => delete mob.threatTable?.[socket.id]);
  }
  io.emit('playerDisconnected', socket.id);
}

function updatePlayers(deltaTime, now) {
  for (const [id, socket] of io.of("/").sockets) {
    const p = players[id];
    if (!p) continue;
    if (p && p.health > 0 && p.health < p.maxHealth) {
      // Regenerate health if not recently damaged and hunger > 0
      if (!p.lastDamageTime || (now - p.lastDamageTime) / 1000 >= 5) {
        if (p.hunger > 25) {
          p.health = Math.min(p.maxHealth, p.health + p.healthRegen * deltaTime);
        }
      }
    }
    // Hunger depletion every 5 seconds
    if (p.health > 0) {
      
      if (!p.lastHungerDepletion) p.lastHungerDepletion = now; // Initialize timer
      const timeSinceLastDepletion = (now - p.lastHungerDepletion) / 1000;
      if (timeSinceLastDepletion >= 5) {
        if (p.hunger > 0) {
          p.hunger = Math.max(0, p.hunger - 5); // Deplete 10 hunger every 5 seconds
          p.lastHungerDepletion = now;
        }
      }
      // Lose health if hunger is 0
      if (p.hunger <= 0) {
        p.health = Math.max(0, p.health - 1 * deltaTime); // 1 health per second
      }
    }

    const filteredPlayers = Object.fromEntries(
      Object.entries(players).filter(([pid]) => pid !== id)
    );
    const selfData = players[id] ? { 
      x: players[id].x, // Include position for reconciliation
      y: players[id].y,
      health: players[id].health,
      color: players[id].color,
      maxStamina: players[id].maxStamina,
      staminaRegenSpeed: players[id].staminaRegenSpeed,
      hunger: players[id].hunger,
      maxHunger: players[id].maxHunger,
    } : {};
    // Diffed state emit (exclude droppedItems and timestamp; items sent separately)
    // For snapshot diffing, ignore x/y movement of other players to reduce churn.
    const playersForSnap = {};
    for (const [pid, data] of Object.entries(filteredPlayers)) {
      const { x, y, ...rest } = data || {};
      playersForSnap[pid] = rest;
    }
    const selfForSnap = (() => { const { x, y, ...rest } = selfData || {}; return rest; })();
    const statePayload = {
      players: filteredPlayers,
      self: selfData,
      pond,
    };
    const stateSnap = JSON.stringify({ players: playersForSnap, self: selfForSnap, pond });
    if (stateSnap !== lastStateSnapshot.get(id)) {
      lastStateSnapshot.set(id, stateSnap);
      socket.emit("state", statePayload);
    }

    // Players delta (non-pos fields): name, level, color, health
    const curMap = new Map();
    for (const [pid, data] of Object.entries(filteredPlayers)) {
      if (!data) continue;
      curMap.set(pid, {
        id: pid,
        name: data.name,
        level: data.level,
        color: data.color,
        health: Math.round(data.health ?? 0),
      });
    }
    const prevMap = lastPlayersDeltaMap.get(id) || new Map();
    const add = [];
    const update = [];
    const remove = [];
    for (const [pid, nowObj] of curMap.entries()) {
      const prevObj = prevMap.get(pid);
      if (!prevObj) {
        add.push(nowObj);
      } else {
        if (
          nowObj.name !== prevObj.name ||
          nowObj.level !== prevObj.level ||
          nowObj.color !== prevObj.color ||
          nowObj.health !== prevObj.health
        ) {
          update.push(nowObj);
        }
      }
    }
    for (const [pid] of prevMap.entries()) {
      if (!curMap.has(pid)) remove.push({ id: pid });
    }
    if (add.length || update.length || remove.length) {
      const nowMs = Date.now();
      const lastAt = lastPlayersDeltaAt.get(id) || 0;
      if (nowMs - lastAt >= PLAYERS_DELTA_MIN_MS) {
        lastPlayersDeltaAt.set(id, nowMs);
        socket.compress(false).volatile.emit("playersDelta", { add, update, remove });
      }
    }
    lastPlayersDeltaMap.set(id, curMap);

    if (players[id] && players[id].health <= 0) {
      socket.emit('playerDied');
      delete players[id];
      io.emit('playerDisconnected', id);
    }
  }

  droppedItems = droppedItems.filter(item => {
    if (item.pickupDelay > 0) item.pickupDelay -= deltaTime;
    item.despawnTimer -= deltaTime;
    if (item.despawnTimer <= 0) {
  // Limit removal broadcast to nearby clients
  emitToNearby("removeDroppedItem", item.id, item.x, item.y, MOB_VIS_RADIUS);
      return false;
    }
    return true;
  });
}

// Helper: get counts summary
function getCounts() {
  let mobCount = 0;
  for (const list of Object.values(mobs)) {
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m && m.health > 0 && m.size > 0) mobCount++;
    }
  }
  const playerCount = Object.keys(players || {}).length;
  const itemCount = (droppedItems || []).length;
  return { playerCount, mobCount, itemCount };
}

// Helper: resource stats summary (active vs dead per type)
function getResourceStats() {
  const perType = {};
  let totalActive = 0;
  let totalDead = 0;
  for (const [type, arr] of Object.entries(allResources || {})) {
    let active = 0, dead = 0;
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (!r) continue;
        if ((r.sizeX ?? 0) > 0 && (r.sizeY ?? 0) > 0) active++; else dead++;
      }
    }
    perType[type] = { active, dead };
    totalActive += active;
    totalDead += dead;
  }
  return { totalActive, totalDead, perType };
}

// Periodic server stats log
if (STATS_LOG_MS > 0) {
  setInterval(() => {
    const { rss, heapUsed, heapTotal, external } = process.memoryUsage();
    const avg = __tickStats.count ? (__tickStats.sum / __tickStats.count) : 0;
    const { playerCount, mobCount, itemCount } = getCounts();
    const resStats = getResourceStats();
    const perTypeShort = Object.entries(resStats.perType || {})
      .map(([t, v]) => `${t}:${v.active}`)
      .join(',');
    console.log(
      `📊 Stats | players:${playerCount} mobs:${mobCount} items:${itemCount} ` +
      `res a/d:${resStats.totalActive}/${resStats.totalDead} [${perTypeShort}] ` +
      `tick(ms) avg:${avg.toFixed(2)} min:${(__tickStats.min===Infinity?0:__tickStats.min).toFixed(0)} max:${__tickStats.max.toFixed(0)} | ` +
      `mem MB rss:${(rss/1048576).toFixed(1)} heap:${(heapUsed/1048576).toFixed(1)}/${(heapTotal/1048576).toFixed(1)} ext:${(external/1048576).toFixed(1)}`
    );
    // Reset tick window every print to keep stats recent
    __tickStats = { count: 0, sum: 0, min: Infinity, max: 0 };
  }, STATS_LOG_MS);
}

