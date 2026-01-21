// Standalone singleplayer respawn function
window.singleplayerRespawn = function() {
  console.log('[DEBUG] singleplayerRespawn: function entered');
  try { window.gameplayPaused = false; } catch(_) {}
  // Ensure spectator is fully disabled when respawning from death flow
  try { window.exitSpectator && window.exitSpectator({ teleport: false }); } catch(_) {}
  try { if (window.spectator) { window.spectator.active = false; window.spectator.saved = null; } } catch(_) {}
  if (window.inventory) {
    console.log('[DEBUG] window.inventory exists at respawn');
  } else {
    console.log('[DEBUG] window.inventory is MISSING at respawn, re-attaching');
    if (typeof inventory !== 'undefined') window.inventory = inventory;
  }
  // Hide settings panel and death screen if present
  if (window.__settingsPanel && typeof window.__settingsPanel.close === 'function') window.__settingsPanel.close();
  const deathScreen = document.getElementById('deathScreen');
  if (deathScreen) deathScreen.style.display = 'none';
  // Hide menu and show game canvas
  const menu = document.getElementById('singlePlayerMenu');
  if (menu) menu.style.display = 'none';
  const bg = document.getElementById('bgHomepage');
  if (bg) bg.style.display = 'none';
  const gc = document.getElementById('gameCanvas');
  if (gc) gc.style.display = 'block';
  // Do NOT reset starter kit flag on respawn; only grant starter kit once per game
  // Debug: log inventory before clearing
  if (window.inventory) console.log('[DEBUG] Inventory before clear:', JSON.stringify(window.inventory.items));
  // Forcefully clear inventory object and reassign to window
  if (window.inventory) {
    window.inventory.items = {};
    if (typeof updateHotbarFromInventory === 'function') updateHotbarFromInventory(window.inventory.items);
  }
  // Debug: log inventory after clearing
  if (window.inventory) console.log('[DEBUG] Inventory after clear:', JSON.stringify(window.inventory.items));
  // Clear hotbar
  if (window.hotbar) {
    window.hotbar.slots = new Array(12).fill(null);
    window.hotbar.selectedIndex = null;
  }
  // Reset player with hybrid spawn system for death
  player = createNewPlayer();
  window.player = player;
  
  // Apply hybrid spawn system for death respawn
  if (window.SaveManager && window.SaveManager.getSpawnPosition) {
    const deathSpawn = window.SaveManager.getSpawnPosition('DEATH', window.worldSeed);
    window.player.x = deathSpawn.x;
    window.player.y = deathSpawn.y;
  } else {
    // Fallback to fixed spawn if hybrid system not available
    window.player.x = 2500;
    window.player.y = 2500;
  }
  // Ensure alive/flags sane on respawn
  try {
    window.player.isDead = false;
    window.player.invulnerable = false;
    if (window.player.__hiddenBySpectator || window.player.size === 0) {
      window.player.size = window.player.__origSize || window.player.size || 32;
      delete window.player.__hiddenBySpectator;
      delete window.player.__origSize;
    }
  } catch(_) {}
  // Ensure mobs track the current player object
  try { if (typeof playersMap !== 'undefined' && player && player.id) { playersMap[player.id] = player; } } catch(_) {}
  // Reset world
  if (typeof spawnAllResources === 'function') spawnAllResources();
  // Give starter kit
  if (typeof giveStartingItemsOnce === 'function') {
    giveStartingItemsOnce();
  }
  // Select first available hotbar slot if none
  try {
    if (window.hotbar && (window.hotbar.selectedIndex == null)) {
      const firstIdx = (window.hotbar.slots || []).findIndex(Boolean);
      if (firstIdx !== -1) window.hotbar.selectedIndex = firstIdx;
    }
  } catch(_) {}
  // Restart player state loop
  if (typeof startPlayerStateLoop === 'function') startPlayerStateLoop();
  // Optionally reset other UI/game state as needed
  console.log('[DEBUG] singleplayerRespawn: player respawned');
};

if (typeof difficultyProgression === 'undefined') {
  var difficultyProgression = Number(localStorage.getItem('difficulty.progression') || '0');
}

// One-time starting loadout for singleplayer
const STARTING_ITEMS = {
 
};

function giveStartingItemsOnce() {
  if (window.__startingItemsGranted) return;
  if (typeof inventory === 'undefined' || !inventory.addItem) return;
  for (const [item, count] of Object.entries(STARTING_ITEMS)) {
    inventory.addItem(item, count);
  }
  try { if (typeof showMessage === 'function') showMessage('Starter kit granted'); } catch (_) {}
  window.__startingItemsGranted = true;
}


function startGame() {
  // Hide the menu panel
  document.getElementById('singlePlayerMenu').style.display = 'none';
  document.getElementById('bgHomepage').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  try { window.gameplayPaused = false; } catch(_) {}
  // Always leave spectator when starting a new run, teleport to current spectator pos
  try { window.exitSpectator && window.exitSpectator({ teleport: true }); } catch(_) {}
  try { if (window.spectator) { window.spectator.active = false; window.spectator.saved = null; } } catch(_) {}
  // If a saved player was already loaded, don't overwrite it here.
  if (!window.player || !window.player.id) {
    player = createNewPlayer();
    window.player = player;
  } else {
    player = window.player;
  }
  // Ensure mobs track the current player object
  try { if (typeof playersMap !== 'undefined' && player && player.id) { playersMap[player.id] = player; } } catch(_) {}
  console.log('Player created:', player); 
  // Only spawn resources if not already spawned by save/load flow
  if (!window.__resourcesSpawnedOnce && typeof spawnAllResources === 'function') spawnAllResources();
  // Give starter kit after player creation so inventory/hotbar are ready
  // Only give starter kit for new players (no items)
  try {
    const hasItems = window.inventory && window.inventory.items && Object.keys(window.inventory.items).length > 0;
    if (!hasItems) giveStartingItemsOnce();
  } catch(_) {}
  // Start player state loop (health regen, hunger, etc.)
  if (typeof startPlayerStateLoop === 'function') startPlayerStateLoop();
}

// Show the Singleplayer menu (stay on this page, exit gameplay view)
window.showSinglePlayerMenu = function() {
  // Hide gameplay canvas, show background and menu panel
  const menu = document.getElementById('singlePlayerMenu');
  const bg = document.getElementById('bgHomepage');
  const gc = document.getElementById('gameCanvas');
  if (gc) gc.style.display = 'none';
  if (bg) bg.style.display = 'block';
  if (menu) menu.style.display = 'block';

  // Close settings panel if open
  try { window.__settingsPanel && window.__settingsPanel.close && window.__settingsPanel.close(); } catch(_) {}
  // Clear any death overlay/timer just in case
  try {
    if (window.__deathCountdownTimer) {
      clearInterval(window.__deathCountdownTimer);
      window.__deathCountdownTimer = null;
    }
    const death = document.getElementById('deathScreen');
    if (death) death.style.display = 'none';
    if (window.player && window.player.isDead) window.player.isDead = false;
  } catch (_) {}

  // Ensure mobile controls hidden if returning to menu
  try { window.mobileControls && window.mobileControls.setVisible(false); } catch(_) {}
  // Optional: Set a gameplayPaused flag for subsystems that want to check it directly
  try { window.gameplayPaused = true; } catch(_) {}
  // If we came here from gameplay, disable spectator state so returning doesn't keep you spectating
  try { window.exitSpectator && window.exitSpectator({ teleport: false }); } catch(_) {}
  try { if (window.spectator) { window.spectator.active = false; window.spectator.saved = null; } } catch(_) {}
};

// --- Spectator Mode Implementation ---
// Global spectator state
window.spectator = window.spectator || {
  active: false,
  x: 0,
  y: 0,
  speed: 500, // world units per second
  saved: null // stores paused player snapshot
};

// Helper: are we in spectator mode?
window.isSpectator = function() { return !!(window.spectator && window.spectator.active); };

// Enter spectator: hide player, freeze stats, detach camera to spectator.x/y
window.enterSpectator = function() {
  if (!window.player) return;
  if (window.spectator.active) return;
  // Save player snapshot
  window.spectator.saved = {
    x: player.x, y: player.y,
    health: player.health, hunger: player.hunger,
    isDead: player.isDead,
    facingAngle: player.facingAngle,
  };
  // Place spectator camera where the player currently is
  window.spectator.x = player.x;
  window.spectator.y = player.y;
  window.spectator.active = true;
  // Prevent mobs from targeting and damage logic uses isSpectator checks
  // Hide player visually by setting size 0 (non-collidable) and a flag
  player.__hiddenBySpectator = true;
  player.__origSize = player.size;
  player.size = 0; // invisible and non-collidable
  // Also set a generic invulnerable flag many checks can respect
  player.invulnerable = true;
  // Immediately purge aggro from all mobs targeting this player
  try {
    if (typeof mobs !== 'undefined') {
      for (const list of Object.values(mobs)) {
        for (const mob of list) {
          if (!mob) continue;
          if (mob.threatTable && player.id in mob.threatTable) {
            delete mob.threatTable[player.id];
          }
          if (mob.targetPlayerId === player.id) {
            mob.targetPlayerId = null;
            mob.currentBehavior = 'wander';
          }
        }
      }
    }
  } catch(_) { }
  // Freeze player updates via gameplayPaused only for the player systems? We keep game running, just skip player updates
  // Ensure mobile controls hidden if desired in spectator
  try { window.mobileControls && window.mobileControls.setVisible(false); } catch(_) {}
  if (window.showMessage) window.showMessage('Spectator Mode: On', 2);
};

// Exit spectator: restore player at spectator camera position and resume
window.exitSpectator = function(options) {
  const teleport = !(options && options.teleport === false);
  if (!window.spectator) return;
  if (!window.spectator.active) { window.spectator.active = false; window.spectator.saved = null; return; }
  if (teleport && window.player) {
    // Move player to spectator camera position
    player.x = window.spectator.x;
    player.y = window.spectator.y;
  }
  if (window.player) {
    // Restore size/flags
    if (player.__hiddenBySpectator) {
      player.size = player.__origSize || player.size || 40;
      delete player.__origSize;
      delete player.__hiddenBySpectator;
    }
    player.invulnerable = false;
    // Restore saved stats (health/hunger unchanged while we were spectating)
    if (window.spectator.saved) {
      player.health = window.spectator.saved.health;
      player.hunger = window.spectator.saved.hunger;
      player.isDead = window.spectator.saved.isDead;
      player.facingAngle = window.spectator.saved.facingAngle;
    }
  }
  window.spectator.active = false;
  window.spectator.saved = null;
  if (window.showMessage) window.showMessage('Spectator Mode: Off', 2);
};

// Per-frame spectator camera movement (called from main loop via hooks below)
window.updateSpectatorCamera = function(deltaTime) {
  if (!window.spectator?.active) return;
  const speed = window.spectator.speed;
  // Prefer window.keys to avoid scope issues across scripts; fallback to local 'keys' if present
  const k = (typeof window !== 'undefined' && window.keys)
    ? window.keys
    : ((typeof keys !== 'undefined') ? keys : {});
  let dx = 0, dy = 0;
  if (k['w'] || k['arrowup']) dy -= 1;
  if (k['s'] || k['arrowdown']) dy += 1;
  if (k['a'] || k['arrowleft']) dx -= 1;
  if (k['d'] || k['arrowright']) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    window.spectator.x += dx * speed * deltaTime;
    window.spectator.y += dy * speed * deltaTime;
    // Clamp spectator center in sync with camera clamp and viewport size
    const margin = 100;
    const world = (typeof WORLD_SIZE !== 'undefined') ? WORLD_SIZE : 5000;
    const camW = (typeof camera !== 'undefined' && camera && camera.width) ? camera.width : 0;
    const camH = (typeof camera !== 'undefined' && camera && camera.height) ? camera.height : 0;
    const minCenterX = -margin + camW * 0.5;
    const maxCenterX = (world - camW + margin) + camW * 0.5; // = world + margin - camW/2
    const minCenterY = -margin + camH * 0.5;
    const maxCenterY = (world - camH + margin) + camH * 0.5; // = world + margin - camH/2
    if (camW > 0) {
      window.spectator.x = Math.max(minCenterX, Math.min(window.spectator.x, maxCenterX));
    } else {
      // Fallback if camera size not initialized yet
      window.spectator.x = Math.max(-margin, Math.min(window.spectator.x, world - margin));
    }
    if (camH > 0) {
      window.spectator.y = Math.max(minCenterY, Math.min(window.spectator.y, maxCenterY));
    } else {
      window.spectator.y = Math.max(-margin, Math.min(window.spectator.y, world - margin));
    }
  }
  // Drive camera from spectator position
  if (typeof camera !== 'undefined' && camera) {
    // camera width/height will be set in beginWorldTransform; we set origin here
    camera.x = window.spectator.x - (camera.width||0) / 2;
    camera.y = window.spectator.y - (camera.height||0) / 2;
  }
};
  // Expose a global respawn function for singleplayer
  window.CreateRespawnPlayer = function() {
    // Ensure spectator is disabled when respawning via settings
    try { window.exitSpectator && window.exitSpectator({ teleport: false }); } catch(_) {}
    console.log('[DEBUG] CreateRespawnPlayer called');
    // Hide menu and show game canvas
    const menu = document.getElementById('singlePlayerMenu');
    if (menu) menu.style.display = 'none';
    const bg = document.getElementById('bgHomepage');
    if (bg) bg.style.display = 'none';
    const gc = document.getElementById('gameCanvas');
    if (gc) gc.style.display = 'block';
    try { window.gameplayPaused = false; } catch(_) {}
    // Reset player
  try { if (window.spectator) { window.spectator.active = false; window.spectator.saved = null; } } catch(_) {}
    player = createNewPlayer();
    window.player = player;
    console.log('[DEBUG] New player object:', player);
    // Ensure mobs track the current player object
    try { if (typeof playersMap !== 'undefined' && player && player.id) { playersMap[player.id] = player; } } catch(_) {}
    // Reset world
    if (typeof spawnAllResources === 'function') { console.log('[DEBUG] Spawning all resources'); spawnAllResources(); }
    // Give starter kit
    if (typeof giveStartingItemsOnce === 'function') {
      window.__startingItemsGranted = false;
      giveStartingItemsOnce();
      console.log('[DEBUG] Starter kit granted');
    }
    // Restart player state loop
    if (typeof startPlayerStateLoop === 'function') { console.log('[DEBUG] Starting player state loop'); startPlayerStateLoop(); }
    // Optionally reset other UI/game state as needed
  };