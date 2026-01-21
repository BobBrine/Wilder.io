// Chunk-based world streaming system
(function() {
  'use strict';

  // Chunk configuration
  const CHUNK_SIZE = 500; // pixels per chunk (LCM of block grid 32 and resource grid 100)
  const LOAD_RADIUS = 1; // load chunks within 1 chunk of player (creates 3x3 grid)
  const MAX_CACHED_CHUNKS = 50; // LRU cache size for unloaded chunks
  const MOB_RESPAWN_COOLDOWN_MS = 4000; // cooldown before mobs can respawn in a chunk after it unloads

  // Chunk storage
  const loadedChunks = new Map(); // Map<chunkKey, chunkData>
  const chunkCache = new Map(); // LRU cache for unloaded chunks
  let lastPlayerChunkX = null;
  let lastPlayerChunkY = null;
  let __resourceGenGuard = false;

  // Convert world coordinates to chunk coordinates
  function getChunkCoords(worldX, worldY) {
    return {
      chunkX: Math.floor(worldX / CHUNK_SIZE),
      chunkY: Math.floor(worldY / CHUNK_SIZE)
    };
  }

  // Convert chunk coordinates to world bounds
  function getChunkBounds(chunkX, chunkY) {
    return {
      minX: chunkX * CHUNK_SIZE,
      minY: chunkY * CHUNK_SIZE,
      maxX: (chunkX + 1) * CHUNK_SIZE,
      maxY: (chunkY + 1) * CHUNK_SIZE
    };
  }

  // World bounds helper (0..WORLD_SIZE)
  function getWorldSize() {
    try {
      if (typeof WORLD_SIZE === 'number') return WORLD_SIZE;
      if (typeof window !== 'undefined' && typeof window.WORLD_SIZE === 'number') return window.WORLD_SIZE;
    } catch(_) {}
    return 5000; // default fallback
  }
  function isRectWithinWorld(x, y, w, h) {
    const max = getWorldSize();
    return x >= 0 && y >= 0 && (x + w) <= max && (y + h) <= max;
  }
  function doesChunkIntersectWorld(chunkX, chunkY) {
    const b = getChunkBounds(chunkX, chunkY);
    const max = getWorldSize();
    // intersects if any overlap with [0,max]x[0,max]
    const overlapsX = b.minX < max && b.maxX > 0;
    const overlapsY = b.minY < max && b.maxY > 0;
    return overlapsX && overlapsY;
  }

  // Generate unique key for chunk
  function getChunkKey(chunkX, chunkY) {
    return `${chunkX},${chunkY}`;
  }

  // Create empty chunk data structure
  function createEmptyChunk(chunkX, chunkY) {
    return {
      chunkX,
      chunkY,
      resources: {
        food: [],
        wood: [],
        stone: [],
        iron: [],
        gold: []
      },
      mobs: [], // stored mob states when chunk is unloaded
      terrain: null, // will hold biome/elevation data for this chunk
      placedBlocks: [],
      lastAccessed: Date.now(),
      generated: false,
      mobsGenerated: false, // track if initial mobs have been spawned
      // Mob respawn control
      mobRespawnAt: 0, // timestamp when mobs are allowed to spawn again
      mobSpawnSalt: 0 // increases after each unload to vary spawn positions across visits
    };
  }

  // Run a function with Math.random and getRandomValue temporarily bound to a provided RNG
  function withChunkRandom(rng, fn) {
    const savedRandom = Math.random;
    const savedGetRandom = (typeof window !== 'undefined') ? window.getRandomValue : undefined;
    try {
      Math.random = rng;
      if (typeof window !== 'undefined') window.getRandomValue = rng;
      return fn();
    } finally {
      Math.random = savedRandom;
      if (typeof window !== 'undefined' && typeof savedGetRandom !== 'undefined') {
        window.getRandomValue = savedGetRandom;
      }
    }
  }

  // Spawn safe zone helpers: use actual world spawn if available; also avoid current player position
  let __cachedSpawn = null;
  function getWorldSpawnCenter() {
    // Cache per worldSeed
    const seed = (typeof window !== 'undefined') ? window.worldSeed : null;
    if (__cachedSpawn && __cachedSpawn.seed === seed) return __cachedSpawn.pos;
    let pos = null;
    try {
      if (window.SaveManager && typeof window.SaveManager.getSpawnPosition === 'function') {
        pos = window.SaveManager.getSpawnPosition('FIRST_TIME', seed);
      }
    } catch(_) {}
    if (!pos) {
      // Fallback mirrors SaveManager default: center of chunk (5,5)
      const baseChunkX = 5, baseChunkY = 5;
      const centerX = (baseChunkX * CHUNK_SIZE) + (CHUNK_SIZE / 2);
      const centerY = (baseChunkY * CHUNK_SIZE) + (CHUNK_SIZE / 2);
      pos = { x: centerX, y: centerY };
    }
    __cachedSpawn = { seed, pos };
    return pos;
  }

  const PLAYER_SPAWN_SAFE_RADIUS = 96; // px
  function overlapsSpawnSafeZone(x, y, w, h) {
    const { x: sx, y: sy } = getWorldSpawnCenter();
    const spawnLeft = sx - PLAYER_SPAWN_SAFE_RADIUS;
    const spawnRight = sx + PLAYER_SPAWN_SAFE_RADIUS;
    const spawnTop = sy - PLAYER_SPAWN_SAFE_RADIUS;
    const spawnBottom = sy + PLAYER_SPAWN_SAFE_RADIUS;
    const left = x, right = x + w, top = y, bottom = y + h;
    return (left < spawnRight && right > spawnLeft && top < spawnBottom && bottom > spawnTop);
  }

  function overlapsCurrentPlayer(x, y, w, h) {
    try {
      const p = window.player;
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return false;
      const ps = Math.max(1, p.size || 32);
      return checkOverlap(x, y, w, h, p.x, p.y, ps, ps);
    } catch(_) { return false; }
  }

  // Generate resources for a specific chunk using seed + chunk coordinates
  function generateChunkResources(chunk) {
    if (chunk.generated) return; // Already generated
    if (__resourceGenGuard) return; // Prevent re-entrancy
    __resourceGenGuard = true;
    
    console.log(`Generating resources for chunk (${chunk.chunkX}, ${chunk.chunkY})`);
    
    // Create a deterministic seed for this chunk using world seed + chunk coords
    const chunkSeed = (window.worldSeed || 12345) + (chunk.chunkX * 73856093) + (chunk.chunkY * 19349663);
    const chunkRng = createSeededRNG(chunkSeed);
    
    const bounds = getChunkBounds(chunk.chunkX, chunk.chunkY);
    const blockSize = (typeof window !== 'undefined' && typeof window.GRID_SIZE === 'number')
      ? window.GRID_SIZE
      : 32;
    
    // Generate resources for each type within chunk bounds
    for (const [resourceType, config] of Object.entries(resourceTypes)) {
  // Scale down for chunk-based spawning; reduce density and try at least one per type
  const targetCount = Math.max(1, Math.floor(config.maxCount / 50));
      
      for (let i = 0; i < targetCount; i++) {
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
          attempts++;
          
          // Generate position within chunk bounds (snap to block grid if requested)
          let x, y;
          
          // Get size for resource (deterministic per chunk via chunkRng)
          let sizeX, sizeY;
          if (typeof config.sizeStrategy === 'function') {
            const s = withChunkRandom(chunkRng, () => config.sizeStrategy());
            sizeX = s.sizeX; sizeY = s.sizeY;
          } else {
            sizeX = (typeof config.sizeX === 'function') ? withChunkRandom(chunkRng, () => config.sizeX()) : config.sizeX;
            sizeY = (typeof config.sizeY === 'function') ? withChunkRandom(chunkRng, () => config.sizeY()) : config.sizeY;
          }

          // If the resource should align to the block grid, round size and snap position
          const alignToBlock = !!(config && config.alignToBlockGrid);
          if (alignToBlock) {
            sizeX = Math.max(blockSize, Math.round(sizeX / blockSize) * blockSize);
            sizeY = Math.max(blockSize, Math.round(sizeY / blockSize) * blockSize);
            // compute integer grid range within this chunk so resource stays fully inside chunk
            const minCol = Math.ceil(bounds.minX / blockSize);
            const maxCol = Math.floor((bounds.maxX - sizeX) / blockSize);
            const minRow = Math.ceil(bounds.minY / blockSize);
            const maxRow = Math.floor((bounds.maxY - sizeY) / blockSize);
            if (minCol > maxCol || minRow > maxRow) {
              // Can't fit this resource with current size; try next attempt
              continue;
            }
            const col = Math.floor(chunkRng() * (maxCol - minCol + 1)) + minCol;
            const row = Math.floor(chunkRng() * (maxRow - minRow + 1)) + minRow;
            x = col * blockSize;
            y = row * blockSize;
          } else {
            // Free placement (non-grid-aligned)
            x = bounds.minX + chunkRng() * (bounds.maxX - bounds.minX);
            y = bounds.minY + chunkRng() * (bounds.maxY - bounds.minY);
          }
          
          // Ensure resource fits within chunk
          if (x + sizeX > bounds.maxX || y + sizeY > bounds.maxY) {
            continue;
          }

          // Ensure resource is fully within world bounds
          if (!isRectWithinWorld(x, y, sizeX, sizeY)) {
            continue;
          }
          
          // Check biome suitability
          let biomeSuitable = true;
          if (typeof window.canResourceSpawnAtLocation === 'function') {
            biomeSuitable = window.canResourceSpawnAtLocation(x, y, resourceType);
          }
          
          // Check spawn chance (sample with chunkRng only)
          let spawnChanceCheck = true;
          if (typeof window.getResourceSpawnChance === 'function') {
            // Evaluate spawn chance function without altering global RNG
            const chance = window.getResourceSpawnChance(x, y, resourceType);
            spawnChanceCheck = chunkRng() < chance;
          }
          
          if (biomeSuitable && spawnChanceCheck) {
            // Build a combined list of all existing resources in this chunk (all types)
            const existingResources = [];
            for (const arr of Object.values(chunk.resources)) {
              if (Array.isArray(arr) && arr.length) existingResources.push(...arr);
            }

            // Check overlap with any resource already placed in this chunk (any type)
            let overlaps = existingResources.some(existing =>
              checkOverlap(x, y, sizeX, sizeY, existing.x, existing.y, existing.sizeX, existing.sizeY)
            );

            // Also avoid overlapping with currently loaded resources from other loaded chunks (global)
            if (!overlaps && window.allResources) {
              outerRes: for (const arr of Object.values(window.allResources)) {
                for (const r of arr) {
                  if (r.sizeX > 0 && r.sizeY > 0 && checkOverlap(x, y, sizeX, sizeY, r.x, r.y, r.sizeX, r.sizeY)) { overlaps = true; break outerRes; }
                }
              }
            }

            // Also avoid overlapping with currently loaded mobs (global), if any
            if (!overlaps && window.mobs) {
              for (const mobArr of Object.values(window.mobs)) {
                if (!Array.isArray(mobArr)) continue;
                for (let mi = 0; mi < mobArr.length; mi++) {
                  const m = mobArr[mi];
                  const mSize = m && (m.size || 0);
                  if (m && mSize > 0 && checkOverlap(x, y, sizeX, sizeY, m.x, m.y, mSize, mSize)) { overlaps = true; break; }
                }
                if (overlaps) break;
              }
            }

            // Ensure resource does not overlap player spawn safe area
            if (!overlaps && overlapsSpawnSafeZone(x, y, sizeX, sizeY)) {
              overlaps = true;
            }

            // Also prevent spawning directly on current player position
            if (!overlaps && overlapsCurrentPlayer(x, y, sizeX, sizeY)) {
              overlaps = true;
            }
            
            if (!overlaps) {
              const initialHealth = (typeof config.health === 'function')
                ? withChunkRandom(chunkRng, () => config.health())
                : config.health;
              chunk.resources[resourceType].push({
                id: crypto.randomUUID(),
                type: resourceType,
                x,
                y,
                sizeX,
                sizeY,
                health: initialHealth,
                maxHealth: initialHealth,
                respawnTimer: 0,
                respawnTime: config.spawntimer
              });
              break;
            }
          }
        }
      }
    }
    
  // Mark as generated AFTER all resources are actually created
  chunk.generated = true;
    console.log(`Generated chunk (${chunk.chunkX}, ${chunk.chunkY}) with resources:`, 
      Object.entries(chunk.resources).map(([type, arr]) => `${type}:${arr.length}`).join(', '));
    __resourceGenGuard = false;
  }

  // Generate mobs for a specific chunk using seed + chunk coordinates
  function generateChunkMobs(chunk) {
    if (chunk.mobsGenerated) return; // Already generated

    // Respect cooldown: if not yet time to respawn, skip generation now
    const now = Date.now();
    if (chunk.mobRespawnAt && now < chunk.mobRespawnAt) {
      // Leave mobsGenerated as false so we can try again later while chunk stays loaded
      console.log(`Skipping mob spawn for chunk (${chunk.chunkX}, ${chunk.chunkY}) - cooldown ${Math.ceil((chunk.mobRespawnAt - now)/1000)}s left`);
      return;
    }

    console.log(`Generating mobs for chunk (${chunk.chunkX}, ${chunk.chunkY})`);

    // Create a deterministic seed for this chunk using world seed + chunk coords + offset
  const salt = (chunk.mobSpawnSalt || 0) * 1337; // change positions between visits
  const session = (typeof window !== 'undefined' && typeof window.__mobSessionSalt === 'number') ? window.__mobSessionSalt : 0;
  const chunkSeed = (window.worldSeed || 12345) + (chunk.chunkX * 83492773) + (chunk.chunkY * 29417397) + 987654321 + salt + session;
    const chunkRng = createSeededRNG(chunkSeed);

  const bounds = getChunkBounds(chunk.chunkX, chunk.chunkY);

    // Get mob types from existing mob system
    if (!window.mobtype || typeof window.mobtype !== 'object') {
      console.warn('Mob types not available for chunk generation');
      chunk.mobsGenerated = true;
      return;
    }

    const mobTypes = Object.keys(window.mobtype);
  // Reduce per-chunk mob count to lower both passive and aggressive density
  const mobsPerChunkBase = 1; // Base number of mobs per chunk (was 2)
  // Add probability that a chunk spawns no mobs at all to further thin density
  const chunkSpawnChance = 0.6; // 60% chance to spawn mobs in this chunk

    // Build a weighted list for mob type selection to make special mobs rarer
    const typeWeights = mobTypes.map(t => {
      const cfg = window.mobtype[t] || {};
      const w = typeof cfg.spawnWeight === 'number' ? cfg.spawnWeight : 1;
      return { t, w: Math.max(0, w) };
    }).filter(e => e.w > 0);
    const totalW = typeWeights.reduce((s, e) => s + e.w, 0) || 1;
    function pickMobType() {
      let r = chunkRng() * totalW;
      for (let i = 0; i < typeWeights.length; i++) {
        const e = typeWeights[i];
        if ((r -= e.w) <= 0) return e.t;
      }
      return typeWeights[typeWeights.length - 1].t;
    }

    // Soft cap special mobs across loaded chunks to keep them rare on-screen
    const SPECIAL_TYPE = 'special_mob';
    const PASSIVE_TYPE = 'passive_mob';
    function countCurrentSpecials() {
      let n = 0;
      try {
        if (window.mobs && Array.isArray(window.mobs[SPECIAL_TYPE])) n += window.mobs[SPECIAL_TYPE].length;
        for (const ch of loadedChunks.values()) {
          if (Array.isArray(ch.mobs)) n += ch.mobs.filter(m => m && m.type === SPECIAL_TYPE).length;
        }
      } catch(_) {}
      return n;
    }
    function countPassivesInChunk() {
      let n = 0;
      if (Array.isArray(chunk.mobs)) n += chunk.mobs.filter(m => m && m.type === PASSIVE_TYPE).length;
      return n;
    }
    const specialCap = 1; // at most 1 special around the player area
    const passivePerChunkCap = 1; // at most 1 passive mob per chunk

    // Roll whether this chunk spawns mobs this cycle
    if (chunkRng() >= chunkSpawnChance) {
      chunk.mobsGenerated = true;
      console.log(`Chunk (${chunk.chunkX}, ${chunk.chunkY}) rolled no-mob spawn this cycle`);
      return;
    }

    for (let i = 0; i < mobsPerChunkBase; i++) {
      let attempts = 0;
      const maxAttempts = 20;

      while (attempts < maxAttempts) {
        attempts++;

        // Pick a random mob type
        // Pick a mob type by weight, but respect special cap
        let mobType = pickMobType();
        if (mobType === SPECIAL_TYPE && countCurrentSpecials() >= specialCap) {
          // Re-pick from non-special types
          const nonSpecial = typeWeights.filter(e => e.t !== SPECIAL_TYPE);
          const tw = nonSpecial.reduce((s, e) => s + e.w, 0) || 1;
          let r = chunkRng() * tw;
          for (let i = 0; i < nonSpecial.length; i++) { const e = nonSpecial[i]; if ((r -= e.w) <= 0) { mobType = e.t; break; } }
        }
        // Enforce per-chunk cap for passive mobs
        if (mobType === PASSIVE_TYPE && countPassivesInChunk() >= passivePerChunkCap) {
          // Re-pick from non-passive types
          const nonPassive = typeWeights.filter(e => e.t !== PASSIVE_TYPE);
          const tw2 = nonPassive.reduce((s, e) => s + e.w, 0) || 1;
          let r2 = chunkRng() * tw2;
          for (let i = 0; i < nonPassive.length; i++) { const e = nonPassive[i]; if ((r2 -= e.w) <= 0) { mobType = e.t; break; } }
        }
        const mobConfig = window.mobtype[mobType];
        
        if (!mobConfig) continue;

        // Generate position within chunk bounds
        const margin = 32; // Keep mobs away from chunk edges
        const x = bounds.minX + margin + chunkRng() * (bounds.maxX - bounds.minX - 2 * margin);
        const y = bounds.minY + margin + chunkRng() * (bounds.maxY - bounds.minY - 2 * margin);

        const size = mobConfig.size || 32;

        // Ensure mob spawn within world bounds
        if (!isRectWithinWorld(x, y, size, size)) {
          continue; // try another position
        }

        // Restrict special mobs to river biome only
        if (mobType === SPECIAL_TYPE && typeof window.getBiomeAtPosition === 'function') {
          const biome = window.getBiomeAtPosition(x + size * 0.5, y + size * 0.5);
          const biomeId = biome && (biome.id || biome.name || '').toString().toLowerCase();
          if (biomeId !== 'river') {
            continue; // not a river tile, try another position
          }
        }

  // Check if position is valid (not overlapping resources or player/spawn)
        let validPosition = true;
        // First check against this chunk's resources (available immediately)
        const allChunkResources = [];
        for (const arr of Object.values(chunk.resources)) {
          if (Array.isArray(arr) && arr.length) allChunkResources.push(...arr);
        }
        for (let ri = 0; ri < allChunkResources.length; ri++) {
          const r = allChunkResources[ri];
          if (r.sizeX > 0 && r.sizeY > 0 && checkOverlap(x, y, size, size, r.x, r.y, r.sizeX, r.sizeY)) {
            validPosition = false; break;
          }
        }
        // Also check against already-loaded global resources (adjacent chunks may overlap across borders)
        if (validPosition && window.allResources) {
          outer: for (const resources of Object.values(window.allResources)) {
            for (const r of resources) {
              if (r.sizeX > 0 && r.sizeY > 0 && checkOverlap(x, y, size, size, r.x, r.y, r.sizeX, r.sizeY)) { validPosition = false; break outer; }
            }
          }
        }

        // Avoid mob spawning in spawn safe zone
        if (validPosition && overlapsSpawnSafeZone(x, y, size, size)) {
          validPosition = false;
        }

        // Avoid mob spawning directly on the current player
        if (validPosition && overlapsCurrentPlayer(x, y, size, size)) {
          validPosition = false;
        }

        if (validPosition) {
          // Create mob state that matches existing mob system
          // Map to fields expected by updateMobs/drawMob
          const mobState = {
            id: crypto.randomUUID(),
            type: mobType,
            x: x,
            y: y,
            size: size,
            health: mobConfig.health || 100,
            maxHealth: mobConfig.health || 100,
            // updateMobs uses moveSpeed; keep speed as fallback
            speed: mobConfig.speed || 60,
            moveSpeed: mobConfig.speed || 60,
            damage: mobConfig.damage || 10,
            attackspeed: mobConfig.attackspeed || 1,
            color: mobConfig.color || '#ff0000',
            // AI state
            behavior: mobConfig.behavior || 'wander',
            currentBehavior: mobConfig.behavior || 'wander',
            targetPlayerId: null,
            chaseTimer: 0,
            facingAngle: Math.random() * Math.PI * 2,
            targetAngle: Math.random() * Math.PI * 2,
            turnSpeed: mobConfig.turnSpeed || Math.PI,
            moveTimer: Math.random() * 3 + 2,
            isTurning: true,
            isMovingForward: false,
            pauseTimer: 0,
            damageCooldown: 0,
            threatTable: {},
            // Animation state
            animationTime: 0,
            lastMoveTime: Date.now()
          };

          // Attach default radii and profile if present (aggressive type)
          if (mobConfig.aggroRadius) mobState.aggroRadius = mobConfig.aggroRadius;
          if (mobConfig.escapeRadius) mobState.escapeRadius = mobConfig.escapeRadius;
          if (mobConfig.profiles) {
            const profNames = Object.keys(mobConfig.profiles);
            if (profNames.length) {
              const chosen = profNames[Math.floor(chunkRng() * profNames.length)];
              mobState.profile = chosen;
              const prof = mobConfig.profiles[chosen];
              if (prof) {
                mobState.size = prof.size || mobState.size;
                mobState.health = prof.health || mobState.health;
                mobState.maxHealth = mobState.health;
                mobState.moveSpeed = prof.speed || mobState.moveSpeed;
                mobState.speed = mobState.moveSpeed;
                mobState.damage = prof.damage || mobState.damage;
                mobState.attackspeed = prof.attackspeed || mobState.attackspeed;
                if (prof.aggroRadius) mobState.aggroRadius = prof.aggroRadius;
                if (prof.escapeRadius) mobState.escapeRadius = prof.escapeRadius;
              }
            }
          }

          chunk.mobs.push(mobState);
          console.log(`Generated ${mobType} mob at (${Math.floor(x)}, ${Math.floor(y)}) in chunk (${chunk.chunkX}, ${chunk.chunkY})`);
          break;
        }
      }
    }

    chunk.mobsGenerated = true;
    console.log(`Generated chunk (${chunk.chunkX}, ${chunk.chunkY}) with ${chunk.mobs.length} mobs`);
  }

  // Load mobs from chunk into global mobs array
  function loadChunkMobs(chunk) {
    if (!window.mobs || typeof window.mobs !== 'object') {
      console.warn('Global mobs array not available');
      return;
    }

    console.log(`Loading ${chunk.mobs.length} mobs from chunk (${chunk.chunkX}, ${chunk.chunkY})`);

    // Add each saved mob to the appropriate global array
    for (const mobState of chunk.mobs) {
      const mobType = mobState.type;
      if (window.mobs[mobType]) {
        window.mobs[mobType].push(mobState);
        console.log(`Loaded ${mobType} mob at (${Math.floor(mobState.x)}, ${Math.floor(mobState.y)})`);
      }
    }
  }

  // Save mobs from global array into chunk and remove them from global array
  function unloadChunkMobs(chunk) {
    if (!window.mobs || typeof window.mobs !== 'object') {
      return;
    }

    const bounds = getChunkBounds(chunk.chunkX, chunk.chunkY);
    const savedMobs = [];
    let removedCount = 0;

    // Find and remove mobs that are within this chunk's bounds
    for (const [mobType, mobArray] of Object.entries(window.mobs)) {
      if (!Array.isArray(mobArray)) continue;

      // Filter out mobs in this chunk and save their states
      for (let i = mobArray.length - 1; i >= 0; i--) {
        const mob = mobArray[i];
        if (mob.x >= bounds.minX && mob.x < bounds.maxX && 
            mob.y >= bounds.minY && mob.y < bounds.maxY) {
          
          // Save mob state
          savedMobs.push({
            id: mob.id || crypto.randomUUID(),
            type: mobType,
            x: mob.x,
            y: mob.y,
            size: mob.size,
            health: mob.health,
            maxHealth: mob.maxHealth,
            speed: mob.speed,
            damage: mob.damage,
            attackspeed: mob.attackspeed,
            color: mob.color,
            // AI state
            targetX: mob.targetX,
            targetY: mob.targetY,
            isMovingForward: mob.isMovingForward,
            pauseTimer: mob.pauseTimer,
            damageCooldown: mob.damageCooldown,
            // Animation state
            animationTime: mob.animationTime,
            lastMoveTime: mob.lastMoveTime
          });

          // Remove from global array
          mobArray.splice(i, 1);
          removedCount++;
        }
      }
    }

    chunk.mobs = savedMobs;
    console.log(`Unloaded chunk (${chunk.chunkX}, ${chunk.chunkY}): saved ${savedMobs.length} mobs, removed ${removedCount} from global arrays`);
  }

  // Remove all mobs currently in a specific chunk from global arrays
  function removeMobsInChunk(chunkX, chunkY) {
    if (!window.mobs) return 0;
    const bounds = getChunkBounds(chunkX, chunkY);
    let removed = 0;
    for (const [mobType, mobArray] of Object.entries(window.mobs)) {
      if (!Array.isArray(mobArray)) continue;
      for (let i = mobArray.length - 1; i >= 0; i--) {
        const m = mobArray[i];
        if (m.x >= bounds.minX && m.x < bounds.maxX && m.y >= bounds.minY && m.y < bounds.maxY) {
          mobArray.splice(i, 1); removed++;
        }
      }
    }
    if (removed) console.log(`Removed ${removed} mobs from center chunk (${chunkX}, ${chunkY})`);
    return removed;
  }

  // Optional helper (unused now): remove mobs in a specific center chunk
  function enforceCenterChunkNoMobs(centerX, centerY) {
    // Intentionally no-op by default; we prevent spawning in center chunk
    // but don't force-despawn existing mobs to avoid pop-in during combat.
    // removeMobsInChunk(centerX, centerY);
  }

  // Load/generate a chunk
  function loadChunk(chunkX, chunkY, options) {
    const allowMobSpawn = !options || options.allowMobSpawn !== false;
    const key = getChunkKey(chunkX, chunkY);
    
    if (loadedChunks.has(key)) {
      // Already loaded, just update access time
      loadedChunks.get(key).lastAccessed = Date.now();
      return loadedChunks.get(key);
    }
    
    // Check if chunk is in cache
    let chunk;
    if (chunkCache.has(key)) {
      chunk = chunkCache.get(key);
      chunkCache.delete(key); // Remove from cache since we're loading it
      console.log(`Restored chunk (${chunkX}, ${chunkY}) from cache`);
    } else {
      // Create new chunk
      chunk = createEmptyChunk(chunkX, chunkY);
      console.log(`Created new chunk (${chunkX}, ${chunkY})`);
    }
    
    // Generate terrain/biome for this chunk if not already done
    if (!chunk.terrain && window.worldGenerator && typeof window.worldGenerator.getTerrainChunk === 'function') {
      chunk.terrain = window.worldGenerator.getTerrainChunk(chunkX, chunkY);
      // Optionally, log terrain info for debug
      // console.log(`Generated terrain for chunk (${chunkX}, ${chunkY})`, chunk.terrain);
    }

    // Generate resources if not already done
    generateChunkResources(chunk);

    // Spawn mobs only if allowed for this chunk (not the player's center chunk)
    if (allowMobSpawn) {
      generateChunkMobs(chunk);
      loadChunkMobs(chunk);
    }
    
    // Add to loaded chunks
    chunk.lastAccessed = Date.now();
    loadedChunks.set(key, chunk);
    
    return chunk;
  }

  // Unload a chunk (move to cache)
  function unloadChunk(chunkX, chunkY) {
    const key = getChunkKey(chunkX, chunkY);
    const chunk = loadedChunks.get(key);
    
    if (!chunk) return;
    
    console.log(`Unloading chunk (${chunkX}, ${chunkY})`);
    
    // Despawn mobs when chunk unloads (do not cache)
    if (window.mobs) {
      const bounds = getChunkBounds(chunkX, chunkY);
      let removed = 0;
      for (const [mobType, mobArray] of Object.entries(window.mobs)) {
        if (!Array.isArray(mobArray)) continue;
        for (let i = mobArray.length - 1; i >= 0; i--) {
          const m = mobArray[i];
          if (m.x >= bounds.minX && m.x < bounds.maxX && m.y >= bounds.minY && m.y < bounds.maxY) {
            mobArray.splice(i, 1); removed++;
          }
        }
      }
      if (removed) console.log(`Despawned ${removed} mobs from chunk (${chunkX}, ${chunkY}) on unload`);
    }

  // Set respawn cooldown and increase salt so next spawn differs
  chunk.mobRespawnAt = Date.now() + MOB_RESPAWN_COOLDOWN_MS;
  chunk.mobSpawnSalt = (chunk.mobSpawnSalt || 0) + 1;

  // Clear any stored mobs so we don't restore later
  if (chunk.mobs && chunk.mobs.length) chunk.mobs = [];
  chunk.mobsGenerated = false;
    
    // Add to cache (LRU)
    chunkCache.set(key, chunk);
    
    // Remove from loaded chunks
    loadedChunks.delete(key);
    
    // Maintain cache size limit
    if (chunkCache.size > MAX_CACHED_CHUNKS) {
      // Remove oldest cached chunk
      const oldestKey = Array.from(chunkCache.keys())[0];
      chunkCache.delete(oldestKey);
      console.log(`Evicted oldest chunk from cache: ${oldestKey}`);
    }
  }

  // Get chunks that should be loaded for a given player position
  function getRequiredChunks(playerX, playerY) {
    const { chunkX: centerX, chunkY: centerY } = getChunkCoords(playerX, playerY);
    const required = [];
    
    console.log(`Getting required chunks for player at (${playerX}, ${playerY}) - center chunk (${centerX}, ${centerY}), radius ${LOAD_RADIUS}`);
    
    for (let x = centerX - LOAD_RADIUS; x <= centerX + LOAD_RADIUS; x++) {
      for (let y = centerY - LOAD_RADIUS; y <= centerY + LOAD_RADIUS; y++) {
        if (doesChunkIntersectWorld(x, y)) {
          required.push({ chunkX: x, chunkY: y });
          console.log(`  Will load chunk (${x}, ${y})`);
        } else {
          console.log(`  Skipping chunk (${x}, ${y}) - outside world bounds`);
        }
      }
    }
    
    console.log(`Total required chunks: ${required.length} (should be 9 for 3x3)`);
    return required;
  }

  // Update loaded chunks based on player position
  function updateLoadedChunks(playerX, playerY, forceUpdate = false) {
    const { chunkX: currentChunkX, chunkY: currentChunkY } = getChunkCoords(playerX, playerY);
    
    // Skip if player hasn't moved to a different chunk (unless forced)
    if (!forceUpdate && currentChunkX === lastPlayerChunkX && currentChunkY === lastPlayerChunkY) {
      return;
    }
    
    console.log(`Player moved to chunk (${currentChunkX}, ${currentChunkY}) ${forceUpdate ? '(forced)' : ''}`);
    
    const requiredChunks = getRequiredChunks(playerX, playerY);
    const requiredKeys = new Set(requiredChunks.map(c => getChunkKey(c.chunkX, c.chunkY)));
    
    console.log(`Required chunk keys:`, Array.from(requiredKeys));
    console.log(`Currently loaded chunk keys:`, Array.from(loadedChunks.keys()));
    
    // Load new chunks; do not spawn mobs in the player's center chunk
    requiredChunks.forEach(({ chunkX, chunkY }) => {
      const isCenter = (chunkX === currentChunkX && chunkY === currentChunkY);
      loadChunk(chunkX, chunkY, { allowMobSpawn: !isCenter });
    });
    
    // Unload chunks that are no longer needed
    const toUnload = [];
    for (const [key, chunk] of loadedChunks.entries()) {
      if (!requiredKeys.has(key)) {
        toUnload.push({ chunkX: chunk.chunkX, chunkY: chunk.chunkY });
      }
    }
    
    console.log(`Chunks to unload:`, toUnload.map(c => `(${c.chunkX}, ${c.chunkY})`));
    
    toUnload.forEach(({ chunkX, chunkY }) => {
      unloadChunk(chunkX, chunkY);
    });

    // Backfill terrain for any loaded chunks that missed it (e.g., generator became ready later)
    if (window.worldGenerator && typeof window.worldGenerator.getTerrainChunk === 'function') {
      for (const ch of loadedChunks.values()) {
        if (!ch.terrain) {
          ch.terrain = window.worldGenerator.getTerrainChunk(ch.chunkX, ch.chunkY);
        }
      }
    }

    // Ensure ring chunks (non-center) have mobs spawned when allowed (after cooldown)
    for (const chunk of loadedChunks.values()) {
      const isCenter = (chunk.chunkX === currentChunkX && chunk.chunkY === currentChunkY);
      if (isCenter) continue; // never spawn in center chunk
      if (!chunk.mobsGenerated) {
        // Try to spawn if cooldown passed
        generateChunkMobs(chunk);
        if (chunk.mobsGenerated && chunk.mobs && chunk.mobs.length) {
          loadChunkMobs(chunk);
        }
      }
    }

    // Despawn any mobs that live outside of currently loaded chunks
    pruneMobsOutsideLoadedChunks();

  // Update global resource arrays with currently loaded chunks
    updateGlobalResourceArrays();

    // Final safety: remove any resources that still overlap the player or spawn zone
    const removed = cullResourcesOverlappingPlayerAndSpawn();
    if (removed > 0) {
      // Refresh globals after cull
      updateGlobalResourceArrays();
      console.log(`Culled ${removed} overlapping resources near player/spawn`);
    }

    // Optional safety: remove any mobs that ended up overlapping resources (resources win)
    const mobsRemoved = cullMobsOverlappingResources();
    if (mobsRemoved > 0) {
      console.log(`Culled ${mobsRemoved} mobs overlapping resources`);
    }
    
    console.log(`Final loaded chunks:`, Array.from(loadedChunks.keys()));
    
    lastPlayerChunkX = currentChunkX;
    lastPlayerChunkY = currentChunkY;
  }

  // Remove resources overlapping the current player or spawn safe zone across loaded chunks
  function cullResourcesOverlappingPlayerAndSpawn() {
    let removed = 0;
    for (const chunk of loadedChunks.values()) {
      for (const type of Object.keys(chunk.resources)) {
        const arr = chunk.resources[type];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const before = arr.length;
        chunk.resources[type] = arr.filter(r => {
          if (!r || r.sizeX <= 0 || r.sizeY <= 0) return false; // drop invalid
          if (overlapsSpawnSafeZone(r.x, r.y, r.sizeX, r.sizeY)) return false;
          if (overlapsCurrentPlayer(r.x, r.y, r.sizeX, r.sizeY)) return false;
          return true;
        });
        removed += (before - chunk.resources[type].length);
      }
    }
    return removed;
  }

  // Remove mobs that overlap any loaded resource to prevent mob-resource stacking
  function cullMobsOverlappingResources() {
    if (!window.mobs || !window.allResources) return 0;
    // Build a flat list of resource rects from loaded chunks (already synced in allResources)
    const resLists = Object.values(window.allResources);
    const resourceRects = [];
    for (const list of resLists) {
      if (!Array.isArray(list)) continue;
      for (const r of list) {
        if (!r || r.sizeX <= 0 || r.sizeY <= 0) continue;
        resourceRects.push({ x: r.x, y: r.y, w: r.sizeX, h: r.sizeY });
      }
    }
    if (!resourceRects.length) return 0;

    let removed = 0;
    for (const [type, arr] of Object.entries(window.mobs)) {
      if (!Array.isArray(arr)) continue;
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i];
        if (!m) { arr.splice(i, 1); removed++; continue; }
        const mx = m.x, my = m.y, ms = m.size || 32;
        // quick reject using loaded chunk bounds: ensure mob is inside some loaded chunk
        let inLoadedChunk = false;
        for (const ch of loadedChunks.values()) {
          const b = getChunkBounds(ch.chunkX, ch.chunkY);
          if (mx >= b.minX && mx < b.maxX && my >= b.minY && my < b.maxY) { inLoadedChunk = true; break; }
        }
        if (!inLoadedChunk) continue;
        // check overlap against any resource rect
        let overlaps = false;
        for (let k = 0; k < resourceRects.length; k++) {
          const r = resourceRects[k];
          if (checkOverlap(mx, my, ms, ms, r.x, r.y, r.w, r.h)) { overlaps = true; break; }
        }
        if (overlaps) { arr.splice(i, 1); removed++; }
      }
    }
    return removed;
  }

  // Update global window.allResources with currently loaded chunks
  function updateGlobalResourceArrays() {
    // Clear existing resources
    if (!window.allResources) window.allResources = {};
    
    const resourceTypes = ['food', 'wood', 'stone', 'iron', 'gold'];
    resourceTypes.forEach(type => {
      window.allResources[type] = [];
    });
    
    // Add resources from all loaded chunks
    for (const chunk of loadedChunks.values()) {
      resourceTypes.forEach(type => {
        if (chunk.resources[type]) {
          window.allResources[type].push(...chunk.resources[type]);
        }
      });
    }
    
    console.log('Updated global resources from loaded chunks:', 
      Object.entries(window.allResources).map(([type, arr]) => `${type}:${arr.length}`).join(', '));
  }

  // Remove any mobs that are not inside currently loaded chunks (hard clamp)
  function pruneMobsOutsideLoadedChunks() {
    if (!window.mobs) return;
    // Build set of loaded bounds for quick inclusion test
    const loaded = Array.from(loadedChunks.values());
    if (!loaded.length) return;
    const max = getWorldSize();
    const inLoaded = (x, y) => {
      // also enforce world bounds
      if (x < 0 || y < 0 || x > max || y > max) return false;
      for (let i = 0; i < loaded.length; i++) {
        const c = loaded[i];
        const b = getChunkBounds(c.chunkX, c.chunkY);
        if (x >= b.minX && x < b.maxX && y >= b.minY && y < b.maxY) return true;
      }
      return false;
    };

    let removed = 0;
    for (const [type, arr] of Object.entries(window.mobs)) {
      if (!Array.isArray(arr)) continue;
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i];
        if (!inLoaded(m.x, m.y)) { arr.splice(i, 1); removed++; }
      }
    }
    if (removed) console.log(`Pruned ${removed} mobs outside loaded chunks`);

    // After pruning, try to spawn mobs in ring chunks if cooldown has elapsed, even if player hasn't changed chunks
    for (const ch of loaded) {
      const isCenter = (ch.chunkX === lastPlayerChunkX && ch.chunkY === lastPlayerChunkY);
      if (isCenter) continue; // never spawn in center
      if (!ch.mobsGenerated) {
        const before = (ch.mobs && ch.mobs.length) || 0;
        generateChunkMobs(ch);
        const after = (ch.mobs && ch.mobs.length) || 0;
        if (after > before && ch.mobsGenerated) {
          loadChunkMobs(ch);
        }
      }
    }
  }

  // Get debug info about loaded chunks
  function getChunkDebugInfo() {
    return {
      loadedCount: loadedChunks.size,
      cachedCount: chunkCache.size,
      loadedChunks: Array.from(loadedChunks.keys()),
      cachedChunks: Array.from(chunkCache.keys()),
      playerChunk: lastPlayerChunkX !== null ? `(${lastPlayerChunkX}, ${lastPlayerChunkY})` : 'none'
    };
  }

  // Helper function for overlap checking (copy from resourceTypes.js)
  function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
    return x1 < x2 + sizeX2 && x1 + sizeX1 > x2 && y1 < y2 + sizeY2 && y1 + sizeY1 > y2;
  }

  // Helper function for seeded RNG (copy from resourceTypes.js)
  function createSeededRNG(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Export chunk manager API
  window.ChunkManager = {
    updateLoadedChunks,
    getChunkDebugInfo,
    getChunkCoords,
    getChunkBounds,
    enforceCenterChunkNoMobs,
    pruneMobsOutsideLoadedChunks,
    CHUNK_SIZE,
    LOAD_RADIUS,
    // Despawn all mobs and reset spawn state so next entry gets fresh mobs
    clearAllMobsAndResetFresh: function() {
      try {
        // Clear global mobs
        if (window.mobs && typeof window.mobs === 'object') {
          for (const [t, arr] of Object.entries(window.mobs)) {
            if (Array.isArray(arr)) window.mobs[t] = [];
          }
        }
        // Reset mob state in loaded chunks
        for (const ch of Array.from(loadedChunks.values())) {
          ch.mobs = [];
          ch.mobsGenerated = false;
          ch.mobRespawnAt = 0;        // allow immediate spawn next time
          ch.mobSpawnSalt = (ch.mobSpawnSalt || 0) + 1; // vary positions
        }
        console.log('All mobs cleared; chunk mob state reset for fresh spawns');
      } catch (e) {
        console.warn('Failed to clear mobs/reset:', e);
      }
    },
    // Expose loadedChunks for terrain access (read-only)
    getLoadedChunks: () => loadedChunks,
    // Accessors for rendering/logic
    getChunkData: function(chunkX, chunkY) {
        const key = getChunkKey(chunkX, chunkY);
        return loadedChunks.get(key) || null;
      },
      getLoadedChunkKeys: function() {
        return Array.from(loadedChunks.keys());
      },
  };

  console.log('ChunkManager initialized');
})();