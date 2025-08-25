const express = require('express');
const os = require('os');
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
const TICK_MS = Number(process.env.TICK_MS) || 33; // default ~30 FPS
const MOB_VIS_RADIUS = Number(process.env.MOB_VIS_RADIUS) || 1400; // Per-client mob visibility radius (world pixels)
const RESOURCE_VIS_RADIUS = Number(process.env.RESOURCE_VIS_RADIUS) || 1400; // Per-client resource visibility radius
// Spatial grid cell size for mob lookup (tune based on typical mob density)
const MOB_GRID_CELL = Number(process.env.MOB_GRID_CELL) || 350;
// Spatial grid cell size for resource lookup (tune based on typical resource density)
const RESOURCE_GRID_CELL = Number(process.env.RESOURCE_GRID_CELL) || 350;
// Rate limits (per client)
// For a faster feel with more CPU, try MOBS_DELTA_MIN_MS=30 (~33 Hz)
const MOBS_DELTA_MIN_MS = Number(process.env.MOBS_DELTA_MIN_MS) || 40;    // default ~25 Hz for mobsDelta
const ITEMS_EMIT_MIN_MS = Number(process.env.ITEMS_EMIT_MIN_MS) || 100;   // max ~10 Hz for droppedItems snapshots
const PLAYERS_DELTA_MIN_MS = Number(process.env.PLAYERS_DELTA_MIN_MS) || 100; // max ~10 Hz for playersDelta
const RESOURCES_EMIT_MIN_MS = Number(process.env.RESOURCES_EMIT_MIN_MS) || 120; // max ~8 Hz for resources snapshots
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

let {
  difficulty,
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
let checkplayer = false;
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
// Cache last resources snapshot per client (proximity-filtered)
const lastResourcesSnapshot = new Map(); // sid -> string
const lastResourcesEmitAt = new Map(); // sid -> timestamp
// Cache last per-client players map for delta (id -> minimal fields)
const lastPlayersDeltaMap = new Map(); // sid -> Map(id, obj)
const lastPlayersDeltaAt = new Map(); // sid -> timestamp
let placedBlocks = [];
const BlockTypes = {
  'crafting_table': { maxHealth: 100 },
  // Add more block types as needed
};
const ItemTypes = {
  // Basic hand
  hand: {
    name: "Hand",
    color: "peachpuff",
    isTool: true,
    attackRange: 50,
    attackSpeed: 0.5,
    damage: 1,
    category: 'hand',
    tier: 0
  },

  // Axes
  wooden_axe: {
    name: "Wooden Axe",
    color: "sienna",
    isTool: true,
    category: "axe",
    tier: 1,
    damage: 3,
    attackRange: 70,
    attackSpeed: 0.45
  },
  stone_axe: {
    name: "Stone Axe",
    color: "darkgray",
    isTool: true,
    category: "axe",
    tier: 2,
    damage: 5,
    attackRange: 70,
    attackSpeed: 0.45
  },
  iron_axe: {
    name: "Iron Axe",
    color: "white",
    isTool: true,
    category: "axe",
    tier: 3,
    damage: 7,
    attackRange: 70,
    attackSpeed: 0.45
  },
  gold_axe: {
    name: "Gold Axe",
    color: "gold",
    isTool: true,
    category: "axe",
    tier: 4,
    damage: 10,
    attackRange: 70,
    attackSpeed: 0.45
  },

  // Pickaxes
  wooden_pickaxe: {
    name: "Wooden Pickaxe",
    color: "sienna",
    isTool: true,
    category: "pickaxe",
    tier: 1,
    damage: 3,
    attackRange: 70,
    attackSpeed: 0.45
  },
  stone_pickaxe: {
    name: "Stone Pickaxe",
    color: "darkgray",
    isTool: true,
    category: "pickaxe",
    tier: 2,
    damage: 5,
    attackRange: 70,
    attackSpeed: 0.45
  },
  iron_pickaxe: {
    name: "Iron Pickaxe",
    color: "white",
    isTool: true,
    category: "pickaxe",
    tier: 3,
    damage: 7,
    attackRange: 70,
    attackSpeed: 0.45
  },
  gold_pickaxe: {
    name: "Gold Pickaxe",
    color: "gold",
    isTool: true,
    category: "pickaxe",
    tier: 4,
    damage: 10,
    attackRange: 70,
    attackSpeed: 0.45
  },

  // Swords
  wooden_sword: {
    name: "Wooden Sword",
    color: "sienna",
    isTool: true,
    category: "sword",
    tier: 1,
    damage: 10,
    attackRange: 70,
    attackSpeed: 0.45
  },
  stone_sword: {
    name: "Stone Sword",
    color: "darkgray",
    isTool: true,
    category: "sword",
    tier: 2,
    damage: 15,
    attackRange: 70,
    attackSpeed: 0.45
  },
  iron_sword: {
    name: "Iron Sword",
    color: "white",
    isTool: true,
    category: "sword",
    tier: 3,
    damage: 20,
    attackRange: 70,
    attackSpeed: 0.45
  },
  gold_sword: {
    name: "Gold Sword",
    color: "gold",
    isTool: true,
    category: "sword",
    tier: 4,
    damage: 25,
    attackRange: 70,
    attackSpeed: 0.45
  },
  wooden_hammer: {
    name: "Wooden Hammer",
    color: "sienna",
    isTool: true,
    category: "hammer",
    tier: 1,
    damage: 25,
    attackRange: 70,
    attackSpeed: 0.45
  },

  // Special Items
  torch: {
    name: "Torch",
    color: "yellow",
    isTool: true,
    attackRange: 50,
    attackSpeed: 0,
    damage: 1,
    category: 'hand',
    tier: 0
  },

  // Consumables
  wood: { name: "Wood", color: "green", attackSpeed: 0.5 },
  stone: { name: "Stone", color: "darkgray", attackSpeed: 0.5 },
  iron: { name: "Iron", color: "white", attackSpeed: 0.5 },
  gold: { name: "Gold", color: "gold", attackSpeed: 0.5 },
  food: { name: "Food", color: "red", attackSpeed: 0.5 },
  pure_core: { name: "Pure Core", color: "pink", attackSpeed: 0.5 },
  dark_core: { name: "Dark Core", color: "white", attackSpeed: 0.5 },
  mythic_core: { name: "Mythic Core", color: "yellow", attackSpeed: 0.5 },
  health_potion: { name: "Health Potion", color: "red", attackSpeed: 0.5 },
  strength_potion: { name: "Strength Potion", color: "orange", attackSpeed: 0.5 },
  mythic_potion: { name: "Mythic Potion", color: "purple", attackSpeed: 0.5 },
  crafting_table: { name: "Crafting Table", color: "brown", attackSpeed: 0.5 },
};


// Toggle cache and behavior for development
// Set DEV_TEST=true in env to enable dev mode
const devTest = false;
const staticOptions = devTest
  ? { maxAge: 0, etag: false, lastModified: false, index: false }
  : { maxAge: '365d', immutable: true, index: false };
app.use(express.static(path.join(__dirname, '..', 'docs'), staticOptions));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'docs', 'index.html'));
});

// Expose dev flag to newly connected clients
// io.on('connection', (sock) => {
//   sock.emit('DevTest', devTest);
// });

spawnAllResources();

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

// Simple spatial grid for resources (rebuilt each tick)
let resourceGrid = new Map();
function resourceGridKey(cx, cy) { return `${cx},${cy}`; }
function rebuildResourceGrid() {
  resourceGrid.clear();
  for (const [type, list] of Object.entries(allResources)) {
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r) continue;
      const sizeX = r.sizeX || 0, sizeY = r.sizeY || 0;
      if (sizeX <= 0 || sizeY <= 0) continue; // skip dead/hidden
      const cx = Math.floor(r.x / RESOURCE_GRID_CELL);
      const cy = Math.floor(r.y / RESOURCE_GRID_CELL);
      const key = resourceGridKey(cx, cy);
      let arr = resourceGrid.get(key);
      if (!arr) { arr = []; resourceGrid.set(key, arr); }
      arr.push({ type, ref: r });
    }
  }
}
function gatherResourcesNear(x, y, r) {
  const res = [];
  const cellMinX = Math.floor((x - r) / RESOURCE_GRID_CELL);
  const cellMaxX = Math.floor((x + r) / RESOURCE_GRID_CELL);
  const cellMinY = Math.floor((y - r) / RESOURCE_GRID_CELL);
  const cellMaxY = Math.floor((y + r) / RESOURCE_GRID_CELL);
  const r2 = r * r;
  for (let cy = cellMinY; cy <= cellMaxY; cy++) {
    for (let cx = cellMinX; cx <= cellMaxX; cx++) {
      const arr = resourceGrid.get(resourceGridKey(cx, cy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const { type, ref: rsrc } = arr[i];
        const mx = rsrc.x + (rsrc.sizeX || 0) / 2;
        const my = rsrc.y + (rsrc.sizeY || 0) / 2;
        const dx = mx - x;
        const dy = my - y;
        if (dx * dx + dy * dy <= r2) res.push({ type, res: rsrc });
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
  emitVisibleDroppedItemsPerClient();
  // Send initial static data only to the connecting client
  socket.on('placeBlock', (blockData) => {
    const block = {
      ...blockData,
      id: Date.now() + Math.random().toString(36).substr(2, 9), // Unique ID
      health: BlockTypes[blockData.type].maxHealth,
      maxHealth: BlockTypes[blockData.type].maxHealth
    };
    placedBlocks.push(block);
    // Broadcast to all clients with health info
    io.emit('blockPlaced', block);
  });
  socket.on('blockHit', (data) => {
    const { gridX, gridY, damage } = data;
    const block = placedBlocks.find(b => 
      b.gridX === gridX && b.gridY === gridY
    );
    
    if (block) {
      block.health -= damage;
      
      // Broadcast health update to all clients
      io.emit('blockHealthUpdate', { 
        gridX, 
        gridY, 
        health: block.health,
        maxHealth: block.maxHealth
      });
      
      if (block.health <= 0) {
        // Remove the block
        placedBlocks = placedBlocks.filter(b => 
          !(b.gridX === gridX && b.gridY === gridY)
        );
        io.emit('blockBroken', { gridX, gridY });
      }
    }
  });
  socket.on('breakBlock', (blockData) => {
    const index = placedBlocks.findIndex(b => 
      b.gridX === blockData.gridX && b.gridY === blockData.gridY
    );
    
    if (index !== -1) {
      placedBlocks.splice(index, 1);
      socket.broadcast.emit('blockBroken', blockData);
    }
  });
  socket.emit('initialBlocks', placedBlocks.map(b => ({
    ...b,
    // Ensure health is included
    health: b.health,
    maxHealth: b.maxHealth
  })));
  socket.emit("resourceType", resourceTypes);
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
      // Send immediate proximity-filtered resources snapshot
      {
        const pp = players[socket.id];
        if (pp) {
        const px = pp.x + (pp.size || 0) / 2;
        const py = pp.y + (pp.size || 0) / 2;
        const nearRes = gatherResourcesNear(px, py, RESOURCE_VIS_RADIUS);
        const round1 = (v) => Math.round(v * 10) / 10;
        const perType = {};
        for (let i = 0; i < nearRes.length; i++) {
          const { type, res } = nearRes[i];
          if (!perType[type]) perType[type] = [];
          perType[type].push({
            id: res.id,
            type,
            x: round1(res.x),
            y: round1(res.y),
            sizeX: Math.round(res.sizeX || 0),
            sizeY: Math.round(res.sizeY || 0),
            health: Math.round(res.health || 0),
            maxHealth: Math.round(res.maxHealth || res.health || 0),
          });
        }
        const normalized = {};
        for (const t of Object.keys(perType).sort()) {
          normalized[t] = perType[t].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        }
        socket.compress(false).emit("resources", normalized);
        }
      }
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
        // Include empty arrays for all known types so client clears absent ones
        for (const t of Object.keys(mobtype)) {
          if (!normalized[t]) normalized[t] = [];
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
      if (typeof data.facingAngle === 'number') p.facingAngle = data.facingAngle;
      // Track selected tool type for remote rendering (no server logic depends on it)
      if ('selectedToolType' in data) p.selectedToolType = data.selectedToolType || null;
  socket.compress(false).volatile.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        facingAngle: typeof data.facingAngle === 'number' ? data.facingAngle : p.facingAngle,
        selectedToolType: ('selectedToolType' in data) ? data.selectedToolType : p.selectedToolType,
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
  socket.on('mobhit', ({ id, type, newHealth, knockback }) => handleHit(socket, mobs, type, id, newHealth, mobtype, true, knockback));
  socket.on('dropItem', ({ type, amount, x, y }) => handleDropItem(socket, type, amount, x, y));
  socket.on('pickupItem', itemId => handlePickupItem(socket, itemId));
  // Inside io.on('connection', (socket) => {...})
  socket.on('playerhit', ({ targetId, newHealth }) => handlePlayerHit(socket, targetId, newHealth));
  socket.on('consumeFood', ({ amount }) => handleConsumeFood(socket, amount));
  socket.on("consumePotion", ({type}) => handleConsumePotion(socket, type));
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

let day = 0;
let lastGameTimeEmitAt = 0;
let lastDayIncrement = false;
let lastDifficultyIncreaseDay = 0;

function maybeEmitGameTime() {
  const nowMs = Date.now();
  if (nowMs - lastGameTimeEmitAt >= GAME_TIME_MIN_MS) {
    lastGameTimeEmitAt = nowMs;
    io.compress(false).volatile.emit("gameTime", { serverTime: gameTime, day, difficulty });
  }
}

//update contiunous

setInterval(() => {
  const { playerCount} = getCounts();
  if (playerCount > 0) {
    const t0 = Date.now();
    const now = t0;
    const deltaTime = (now - lastUpdate) / 1000;
    lastUpdate = now;
    if (gameTime >= CYCLE_LENGTH - 1 && !lastDayIncrement) {
      day++;
      // Increase difficulty every 7 days
      if (day % 7 === 0 && day > 0 && lastDifficultyIncreaseDay !== day) {
        difficulty++;
        io.emit("GainSoul", 1);
        lastDifficultyIncreaseDay = day;
        console.log(`Difficulty increased to ${difficulty} on day ${day}`);
      }
      lastDayIncrement = true;
    }
    if (gameTime < CYCLE_LENGTH - 1) {
      lastDayIncrement = false;
    }
    gameTime = (gameTime + deltaTime) % CYCLE_LENGTH;
    maybeEmitGameTime();
    updatePlayers(deltaTime, now);

    // Update mobs BEFORE broadcasting so clients get freshest positions (reduces ~1 tick latency)
    updateMobs(allResources, players, deltaTime);
    // Rebuild spatial grid for fast per-client mob queries
    rebuildMobGrid();
    // Rebuild spatial grid for items
    rebuildItemGrid();
    // Rebuild spatial grid for resources
    rebuildResourceGrid();
    emitVisibleMobsPerClient();
    emitVisibleResourcesPerClient();
    emitVisibleDroppedItemsPerClient();
    // Record tick duration stats
    const dtMs = Date.now() - t0;
    __tickStats.count++;
    __tickStats.sum += dtMs;
    if (dtMs < __tickStats.min) __tickStats.min = dtMs;
    if (dtMs > __tickStats.max) __tickStats.max = dtMs;
  } 
}, TICK_MS);

// Static update loop (every 10s)
setInterval(() => {
  const { playerCount} = getCounts();
  if (playerCount > 0) {
    const now = Date.now();
    const deltaTime = (now - lastStaticUpdate) / 1000; // in seconds
    lastStaticUpdate = now;
    

    spawnAllResources();
    updateMobRespawns(deltaTime, allResources, players, gameTime);
    // No global broadcast of resources; proximity-filtered snapshots are sent per client more frequently.

  }
}, 10000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  try {
    const ifaces = os.networkInterfaces();
    const addrs = [];
    for (const name of Object.keys(ifaces)) {
      for (const ni of ifaces[name] || []) {
        if (ni && ni.family === 'IPv4' && !ni.internal) addrs.push(ni.address);
      }
    }
    if (addrs.length) {
      console.log('✅ LAN addresses:');
      addrs.forEach(ip => console.log(`   → http://${ip}:${PORT}`));
    } else {
      console.log('ℹ️  No non-internal IPv4 interfaces detected.');
    }
  } catch (_) {}
  // Startup config summary
  console.log('⚙️  Config:', {
    TICK_MS,
    MOB_VIS_RADIUS,
  RESOURCE_VIS_RADIUS,
    MOB_GRID_CELL,
  RESOURCE_GRID_CELL,
    ITEM_GRID_CELL: 350,
    MOBS_DELTA_MIN_MS,
  RESOURCES_EMIT_MIN_MS,
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
    speed: 175,
    facingAngle: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    health: 100,
    maxHealth: 100,
    playerdamage: 1,
    playerattackspeed: 0.15,
    playerrange: 0,
    playerknockback: 0,

    healthRegen: 0.01,
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
    const normalized = {};
    const sortedTypes = Object.keys(payload).sort();
    for (const t of sortedTypes) {
      normalized[t] = payload[t].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    // Ensure all known mob types are present (empty arrays) to clear stale client-side entries
    for (const t of Object.keys(mobtype)) {
      if (!normalized[t]) normalized[t] = [];
    }

    // Build flat map for delta computation
    const flatNow = new Map(); // key -> mob summary
    for (const t of Object.keys(normalized)) {
      const arr = normalized[t];
      for (let i = 0; i < arr.length; i++) {
        const m = arr[i];
        flatNow.set(`${t}:${m.id}`, m);
      }
    }
    const prevFlat = lastMobsFlat.get(sid) || new Map();
    const add = [];
    const update = [];
    const remove = [];

    // Detect additions and updates
    for (const [key, mNow] of flatNow.entries()) {
      const mPrev = prevFlat.get(key);
      if (!mPrev) {
        add.push(mNow);
      } else {
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

    // Decide whether to send full snapshot or deltas
    const nowMs = Date.now();
    const lastFull = lastMobsFullAt.get(sid) || 0;
    const needFull = lastFull === 0 || nowMs - lastFull > 300; // ensure periodic full refresh
    const topologyChange = add.length > 0 || remove.length > 0; // spawn/despawn near this client
    if (needFull || topologyChange) {
      const snapshot = JSON.stringify(normalized);
      lastMobsSnapshot.set(sid, snapshot);
      lastMobsFlat.set(sid, flatNow);
      lastMobsFullAt.set(sid, nowMs);
      // Reliable full snapshot
      sock.compress(false).emit("mobs", normalized);
    } else if (add.length || update.length || remove.length) {
      const lastDelta = lastMobsDeltaAt.get(sid) || 0;
      if (nowMs - lastDelta < MOBS_DELTA_MIN_MS) continue;
      lastMobsDeltaAt.set(sid, nowMs);
      lastMobsFlat.set(sid, flatNow);
      // Reliable deltas to avoid visual freezes when packets drop
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
        io.emit("droppedItems", visible);
      }
    }
  }
}

function emitVisibleResourcesPerClient() {
  for (const [sid, sock] of io.of("/").sockets) {
    const p = players[sid];
    if (!p) continue;
    const px = p.x + (p.size || 0) / 2;
    const py = p.y + (p.size || 0) / 2;
    const nearby = gatherResourcesNear(px, py, RESOURCE_VIS_RADIUS);
    const round1 = (v) => Math.round(v * 10) / 10;
    const perType = {};
    for (let i = 0; i < nearby.length; i++) {
      const { type, res } = nearby[i];
      if (!perType[type]) perType[type] = [];
      perType[type].push({
        id: res.id,
        type,
        x: round1(res.x),
        y: round1(res.y),
        sizeX: Math.round(res.sizeX || 0),
        sizeY: Math.round(res.sizeY || 0),
        health: Math.round(res.health || 0),
        maxHealth: Math.round(res.maxHealth || res.health || 0),
      });
    }
    // Normalize order and types for stable snapshot
    const normalized = {};
    for (const t of Object.keys(perType).sort()) {
      normalized[t] = perType[t].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    const snapshot = JSON.stringify(normalized);
    const nowMs = Date.now();
    if (snapshot !== lastResourcesSnapshot.get(sid)) {
      const lastAt = lastResourcesEmitAt.get(sid) || 0;
      if (nowMs - lastAt >= RESOURCES_EMIT_MIN_MS) {
        lastResourcesSnapshot.set(sid, snapshot);
        lastResourcesEmitAt.set(sid, nowMs);
  sock.compress(false).emit("resources", normalized);
      }
    }
  }
}

function handleHit(socket, collection, type, id, newHealth, configTypes, isMob = false, knockback = null) {
  const list = collection[type];
  if (!list) return;
  const entityIndex = list.findIndex(e => e.id === id);
  if (entityIndex === -1) return;
  const entity = list[entityIndex];
  if (!entity) return;
  const attacker = players[socket.id];
  const dist = Math.hypot(attacker.x - entity.x, attacker.y - entity.y);
  if (dist > 200) return;  // Increased to account for lag
  const damage = entity.health - newHealth;
  entity.health = newHealth;
  entity.lastHitBy = socket.id;
  const config = configTypes[type];
  if (isMob && config.isAggressive) {
    entity.threatTable[socket.id] = (entity.threatTable[socket.id] || 0) + (5 + damage * 0.2);
  }
  // Target health updates only to nearby clients to reduce bandwidth
  if (isMob) {
    emitToNearbyReliable("updateMobHealth", { id, type, health: newHealth }, entity.x, entity.y, MOB_VIS_RADIUS);
  } else {
    // For resources, use resource visibility radius and reliable delivery so health changes aren't dropped
    emitToNearbyReliable("updateResourceHealth", { id, type, health: newHealth }, entity.x, entity.y, RESOURCE_VIS_RADIUS);
  }
    // Emit knockback event for mob if it was hit by player
  if (isMob && entity.health > 0) {
    // Server-side knockback with smooth follow-through
    
    if (attacker && entity.health > 0) {
  const { vx, vy, duration: reqDur } = knockback || { vx: 0, vy: 0 };
  const duration = (typeof reqDur === 'number' && reqDur > 0) ? reqDur : 0.2; // match client/player knockback feel

      // Continuous knockback: schedule velocity over time; movement/collision handled in updateMobs
      const invDur = duration > 0 ? (1 / duration) : 0;
      const addVx = vx * invDur;
      const addVy = vy * invDur;
      entity.kbVx = (entity.kbVx || 0) + addVx;
      entity.kbVy = (entity.kbVy || 0) + addVy;
      entity.kbTimer = Math.max(entity.kbTimer || 0, duration);

      // Notify nearby clients that knockback started (no instant displacement to avoid double-move on client)
      emitToNearbyReliable('mobKnockback', {
        id: entity.id,
        type,
        knockbackVx: 0,
        knockbackVy: 0,
        duration,
        continuous: true
      }, entity.x, entity.y, MOB_VIS_RADIUS);
    }
  
    
  }
  if (!isMob) socket.emit("itemDrop", { item: config.drop, amount: damage });
  if (entity.health <= 0) {
    if (isMob) {
      entity.size = 0; // Set size to 0 for mobs
    } else {
      entity.sizeX = 0; // For resources or other entities
      entity.sizeY = 0;
      entity.size = 0;
    }
    list.splice(entityIndex, 1);
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
    // Immediately update dropped items for all clients after player death
  }
}

function handleDropItem(socket, type, amount, x, y) {
  const item = { id: nextItemId++, type, amount, x, y, despawnTimer: 60, pickupDelay: 1 };
  droppedItems.push(item);
  // Notify only nearby clients about newly dropped item
  // Always notify the player who caused the drop, in case they are outside the radius
  socket.emit("newDroppedItem", item);
  emitToNearbyReliable("newDroppedItem", item, x, y, MOB_VIS_RADIUS);
}

function handlePickupItem(socket, itemId) {
  const item = droppedItems.find(i => i.id === itemId), p = players[socket.id];
  if (!item || !p) return;
  const distance = Math.sqrt((p.x + p.size / 2 - item.x) ** 2 + (p.y + p.size / 2 - item.y) ** 2);
  if (distance > 26 || item.pickupDelay > 0) return;
  droppedItems = droppedItems.filter(i => i.id !== itemId);
  // Notify only nearby clients about item removal
  // socket.emit("removeDroppedItem", itemId, item.x, item.y, MOB_VIS_RADIUS);
  emitToNearbyReliable("removeDroppedItem", item.id, item.x, item.y, MOB_VIS_RADIUS);
  socket.emit("addItem", { type: item.type, amount: item.amount });
}

function handleConsumeFood(socket, amount) {
  const p = players[socket.id];
  if (!p || p.isDead || p.hunger >= p.maxHunger) return;
  p.hunger = Math.min(p.maxHunger, p.hunger + 20 * amount);
}

function handleConsumePotion(socket, type) {
  const p = players[socket.id];
  if (!p || p.isDead || !ItemTypes[type] || !type.endsWith("_potion")) return;
  let updatedStats = {};
  switch (type) {
    case "health_potion":
      p.maxHealth += 25;
      p.health += 25;
      updatedStats = { maxHealth: p.maxHealth, health: p.health };
      break;
    case "strength_potion":
      p.playerdamage += 10;
      updatedStats = { playerdamage: p.playerdamage };
      break;
    case "mythic_potion":
      let options = [];

      // Attack speed (only if below max)
      if (p.playerattackspeed < 0.45) {
        options.push("attackSpeed");
      }

      // Range (only if below max 130)
      if (p.playerrange < 130) {
        options.push("range");
      }

      // Knockback (always available, unless you want a cap too)
      options.push("knockback");

      options.push("speed");

      // Pick random from available options
      const randChoice = options[Math.floor(Math.random() * options.length)];

      // Apply upgrade
      if (randChoice === "attackSpeed") {
        p.playerattackspeed = Math.min(0.45, p.playerattackspeed + 0.1);
        updatedStats = { playerattackspeed: p.playerattackspeed };
        socket.emit('showMessage', 'Gain Attack Speed Boost! (+0.1)');
      } else if (randChoice === "range") {
        p.playerrange = Math.min(130, p.playerrange + 50);
        updatedStats = { playerrange: p.playerrange };
        socket.emit('showMessage', 'Gain Range Boost! (+50)');
      } else if (randChoice === "knockback") {
        p.playerknockback += 50;
        updatedStats = { playerknockback: p.playerknockback };
        socket.emit('showMessage', 'Gain Knockback Boost! (+50)');
      } else if (randChoice === "speed") {
        p.speed += 50;
        updatedStats = { speed: p.speed };
        socket.emit('showMessage', 'Gain Player Speed Boost! (50)');
      }
      break;

  }
  if (Object.keys(updatedStats).length > 0) {
    socket.emit('updatePlayerStats', updatedStats);
  }
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
  // If no players remain, reset game state
  if (Object.keys(players).length === 0) {
    resetGameState();
  }
}

function updatePlayers(deltaTime, now) {
  for (const [id, socket] of io.of("/").sockets) {
    const p = players[id];
    if (!p) continue;
    if (p && p.health > 0 && p.health < p.maxHealth) {
      // Regenerate health if not recently damaged and hunger > 0
      if (!p.lastDamageTime || (now - p.lastDamageTime) / 1000 >= 5) {
        if (p.hunger > 25) {
          p.health = Math.min(p.maxHealth, p.health + p.maxHealth*p.healthRegen * deltaTime);
        }
      }
    }
    // Hunger depletion every 10 seconds
    if (p.health > 0) {
      
      if (!p.lastHungerDepletion) p.lastHungerDepletion = now; // Initialize timer
      const timeSinceLastDepletion = (now - p.lastHungerDepletion) / 1000;
      if (timeSinceLastDepletion >= 10) {
        if (p.hunger > 0) {
          p.hunger = Math.max(0, p.hunger - 5); // Deplete 5 hunger every 10 seconds
          p.lastHungerDepletion = now;
          if (p.hunger <= 25) {
            socket.emit('showMessage', 'You are starving!');
          }
        }
      }
      // Lose health if hunger is 0
      if (p.hunger <= 0) {
        socket.emit('showMessage', 'You are starving!');
        p.health = Math.max(0, p.health - p.maxHealth * 0.01 * deltaTime); // lose 1 health per second

        // Track when to flash
        if (!p.lastFlash || Date.now() - p.lastFlash >= 2000) {
          p.lastFlash = Date.now();

          if (!p.originalColor) {
            p.originalColor = p.color || "defaultColor";
          }

          p.color = "rgba(255, 0, 0, 0.5)";
          setTimeout(() => {
            p.color = p.originalColor;
          }, 100);
          io.emit('playerKnockback', {
              mobX: p.x,  // could be null or same as player, since no real knockback
              mobY: p.y,
              mobId: null // no mob here
            });
        }
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
      emitToNearbyReliable("removeDroppedItem", item.id, item.x, item.y, MOB_VIS_RADIUS);
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
    if (playerCount > 0 && checkplayer) { // if player greater then 0
        updateMobRespawns(0, allResources, players, gameTime);
        checkplayer = false;
        gameTime = 0;
        day = 0;
        difficulty = 1;
    } 
    
    console.log(`(${Object.entries(mobs).map(([type, list]) => `${type}: ${list.filter(r => r.size > 0).length}`).join(', ')})`);
    console.log(
      `📊 Stats | players:${playerCount} mobs:${mobCount} items:${itemCount} ` +
      `res a/d:${resStats.totalActive}/${resStats.totalDead} [${perTypeShort}] ` +
      `tick(ms) avg:${avg.toFixed(2)} min:${(__tickStats.min===Infinity?0:__tickStats.min).toFixed(0)} max:${__tickStats.max.toFixed(0)} | ` +
      `mem MB rss:${(rss/1048576).toFixed(1)} heap:${(heapUsed/1048576).toFixed(1)}/${(heapTotal/1048576).toFixed(1)} ext:${(external/1048576).toFixed(1)}`
    );
    console.log("difficulty: " + difficulty);
    // Reset tick window every print to keep stats recent
    __tickStats = { count: 0, sum: 0, min: Infinity, max: 0 };

  }, STATS_LOG_MS);
}

// Reset game state when no players are connected
function resetGameState() {
  // Set difficulty to 1
  
  if (typeof global.difficulty !== 'undefined') {
    global.difficulty = 1;
  } else if (typeof difficulty !== 'undefined') {
    difficulty = 1;
  }
  // Remove all mobs
  for (const type in mobs) {
    mobs[type] = [];
  }
  const { mobCount } = getCounts();
  checkplayer = true;
  console.log(`Game state reset: difficulty set to 1, all mobs removed. Mob count: ${mobCount}`);
  console.log(`(${Object.entries(mobs).map(([type, list]) => `${type}: ${list.filter(r => r.size > 0).length}`).join(', ')})`);
}

