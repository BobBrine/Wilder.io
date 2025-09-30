// SaveManager - Handles persistent game data with IndexedDB + localStorage fallback
(function() {
  'use strict';

  const SAVE_VERSION = 1;
  const DB_NAME = 'WilderIOSaves';
  const DB_VERSION = 1;
  const PLAYER_STORE = 'players';
  const WORLD_STORE = 'worlds';
  const AUTOSAVE_INTERVAL = 30000; // 30 seconds

  let db = null;
  let useIndexedDB = true;
  let autosaveTimer = null;
  let autosaveStartTime = null;
  let lastSaveTime = null;
  let currentPlayerSlot = null;
  let currentWorldSlot = null;

  // Toast notification system
  function showToast(message, type = 'success') {
    const existing = document.getElementById('saveToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'saveToast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#e60000' : '#4CAF50'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: 'VT323', monospace;
      font-size: 16px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });

    // Animate out after delay
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  // Initialize IndexedDB
  function initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        useIndexedDB = false;
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        useIndexedDB = false;
        resolve(false);
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        
        if (!database.objectStoreNames.contains(PLAYER_STORE)) {
          database.createObjectStore(PLAYER_STORE, { keyPath: 'slot' });
        }
        
        if (!database.objectStoreNames.contains(WORLD_STORE)) {
          database.createObjectStore(WORLD_STORE, { keyPath: 'slot' });
        }
      };
    });
  }

  // Generic storage functions
  async function saveData(store, slot, data) {
    const saveData = {
      slot,
      version: SAVE_VERSION,
      timestamp: Date.now(),
      ...data
    };

    if (useIndexedDB && db) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.put(saveData);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      // localStorage fallback
      try {
        localStorage.setItem(`${store}_${slot}`, JSON.stringify(saveData));
        return true;
      } catch (e) {
        throw e;
      }
    }
  }

  async function loadData(store, slot) {
    if (useIndexedDB && db) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.get(slot);
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.version === SAVE_VERSION) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } else {
      // localStorage fallback
      try {
        const data = localStorage.getItem(`${store}_${slot}`);
        if (data) {
          const parsed = JSON.parse(data);
          return parsed.version === SAVE_VERSION ? parsed : null;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
  }

  async function deleteData(store, slot) {
    if (useIndexedDB && db) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.delete(slot);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      try {
        localStorage.removeItem(`${store}_${slot}`);
        return true;
      } catch (e) {
        throw e;
      }
    }
  }

  async function getAllSlots(store) {
    if (useIndexedDB && db) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.getAll();
        
        request.onsuccess = () => {
          const results = request.result.filter(item => item.version === SAVE_VERSION);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } else {
      try {
        const slots = [];
        for (let i = 0; i < 4; i++) {
          const data = localStorage.getItem(`${store}_${i}`);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.version === SAVE_VERSION) {
              slots.push(parsed);
            }
          }
        }
        return slots;
      } catch (e) {
        return [];
      }
    }
  }

  // Player data functions
  function serializePlayer() {
    if (!window.player) return null;
    
    // Ensure we're getting the latest inventory state
    let inventoryData = {};
    if (window.inventory && window.inventory.items) {
      inventoryData = JSON.parse(JSON.stringify(window.inventory.items));
    }
    
    let hotbarData = { slots: [], selectedIndex: null };
    if (window.hotbar) {
      hotbarData = {
        slots: window.hotbar.slots ? JSON.parse(JSON.stringify(window.hotbar.slots)) : [],
        selectedIndex: window.hotbar.selectedIndex
      };
    }
    
    return {
      name: window.player.name || 'Unknown',
      health: window.player.health || 100,
      maxHealth: window.player.maxHealth || 100,
      hunger: window.hunger || 100,
      stamina: window.stamina || 100,
      maxStamina: window.maxStamina || 100,
      staminaRegenSpeed: window.staminaRegenSpeed || 40,
      level: window.player.level || 1,
      xp: window.player.xp || 0,
      xpToNextLevel: window.player.xpToNextLevel || 100,
      playerdamage: window.player.playerdamage || 0,
      playerrange: window.player.playerrange || 0,
      playerknockback: window.player.playerknockback || 0,
      playerattackspeed: window.player.playerattackspeed || 0,
      facingAngle: window.player.facingAngle || 0,
      inventory: inventoryData,
      hotbar: hotbarData,
      soulCurrency: window.soulCurrency ? window.soulCurrency.get() : 0
    };
  }

  function deserializePlayer(data) {
    if (!data) return;
    
    // If a global player object already exists, mutate it to preserve references across modules
    let targetPlayer = (typeof window.player === 'object' && window.player) ? window.player : (window.createNewPlayer ? window.createNewPlayer() : {
      id: crypto.randomUUID(),
      size: 40,
      speed: 200,
      color: "blue"
    });

    Object.assign(targetPlayer, {
      name: data.name,
      health: data.health || 100,
      maxHealth: data.maxHealth || 100,
      level: data.level || 1,
      xp: data.xp || 0,
      xpToNextLevel: data.xpToNextLevel || 100,
      playerdamage: data.playerdamage || 0,
      playerrange: data.playerrange || 0,
      playerknockback: data.playerknockback || 0,
      playerattackspeed: data.playerattackspeed || 0,
      facingAngle: data.facingAngle || 0,
      // CRITICAL: Clear position - will be set by world loading
      x: undefined,
      y: undefined
    });
    // Ensure alive/visibility flags are sane on load
    if (typeof targetPlayer.health === 'number') {
      targetPlayer.isDead = targetPlayer.health <= 0 ? true : false;
    } else if (typeof targetPlayer.isDead !== 'boolean') {
      targetPlayer.isDead = false;
    }
    targetPlayer.invulnerable = false;
    if (targetPlayer.__hiddenBySpectator || targetPlayer.size === 0) {
      targetPlayer.size = targetPlayer.__origSize || targetPlayer.size || 32;
      delete targetPlayer.__hiddenBySpectator;
      delete targetPlayer.__origSize;
    }
    // Ensure the global reference points at the same object
    window.player = targetPlayer;
    
    // Ensure playersMap is updated for mobs and other systems
    try {
      if (typeof window.playersMap !== 'undefined' && targetPlayer.id) {
        window.playersMap[targetPlayer.id] = targetPlayer;
      }
    } catch(e) {
      console.warn('Failed to update playersMap:', e);
    }
    
    // Restore global stats
    if (typeof data.hunger === 'number') window.hunger = data.hunger;
    if (typeof data.stamina === 'number') window.stamina = data.stamina;
      if (typeof data.maxStamina === 'number') window.maxStamina = data.maxStamina;
      if (typeof data.staminaRegenSpeed === 'number') window.staminaRegenSpeed = data.staminaRegenSpeed;
    
      // Sync global stamina variables with player object (fallback for older saves)
      if (window.player) {
        if (typeof window.player.maxStamina === 'number' && !data.maxStamina) window.maxStamina = window.player.maxStamina;
        if (typeof window.player.staminaRegenSpeed === 'number' && !data.staminaRegenSpeed) window.staminaRegenSpeed = window.player.staminaRegenSpeed;
      }
    
    // Restore inventory
    // Ensure inventory/hotbar objects exist on window
    try { if (!window.inventory && typeof inventory !== 'undefined') window.inventory = inventory; } catch(_) {}
    try { if (!window.hotbar && typeof hotbar !== 'undefined') window.hotbar = hotbar; } catch(_) {}

    if (window.inventory) {
      // Replace items map content without replacing the inventory object
      window.inventory.items = data.inventory || {};
      console.log('Restored inventory:', data.inventory);
      if (typeof window.updateHotbarFromInventory === 'function') {
        window.updateHotbarFromInventory(window.inventory.items);
      }
    }
    
    // Restore hotbar
    if (window.hotbar) {
      // Preserve the same hotbar object; update fields only
      window.hotbar.slots = Array.isArray(data.hotbar?.slots) ? data.hotbar.slots : new Array(12).fill(null);
      window.hotbar.selectedIndex = (typeof data.hotbar?.selectedIndex === 'number' || data.hotbar?.selectedIndex === null)
        ? data.hotbar.selectedIndex : null;
      console.log('Restored hotbar:', data.hotbar || 'empty');
    }
    
    // Restore soul currency
    if (window.soulCurrency && typeof data.soulCurrency === 'number') {
      window.soulCurrency.set(data.soulCurrency);
    }
    
    // Attempt to update playersMap so other systems (mobs, etc.) track the same object
    try {
      if (typeof window.playersMap !== 'undefined' && targetPlayer.id) {
        window.playersMap[targetPlayer.id] = targetPlayer;
      }
    } catch(e) {
      console.warn('Failed to update playersMap during player load:', e);
    }

    console.log('Player deserialized:', targetPlayer);
  }

  // World data functions
  function serializeWorld() {
    console.log('=== SERIALIZING WORLD ===');
    console.log('window.allResources exists:', !!window.allResources);
    
    if (window.allResources) {
      console.log('Resource types available:', Object.keys(window.allResources));
      for (const [type, resources] of Object.entries(window.allResources)) {
        console.log(`${type}: ${Array.isArray(resources) ? resources.length : 'not array'} resources`);
      }
    }
    
    console.log('Other world data:', {
      gameTime: window.gameTime,
      Day: window.Day,
      // worldSeed is internal, kept for determinism but not surfaced in UI
      worldSeed: window.worldSeed,
      placedBlocks: window.placedBlocks?.length || 0,
      droppedItems: window.droppedItems?.length || 0,
      resourcesSpawned: window.__resourcesSpawnedOnce
    });
    
    const worldData = {
      gameTime: window.gameTime || 0,
      Day: window.Day || 0,
      difficulty: window.difficulty || 1,
      worldSeed: window.worldSeed || generateWorldSeed(),
      totalGameSeconds: window.__totalGameSeconds || 0,
      placedBlocks: window.placedBlocks ? JSON.parse(JSON.stringify(window.placedBlocks)) : [],
      droppedItems: window.droppedItems ? JSON.parse(JSON.stringify(window.droppedItems)) : [],
      // Save the current state of all resources (including destroyed ones)
      allResources: window.allResources ? JSON.parse(JSON.stringify(window.allResources)) : {},
      // Save mob state per world
      mobs: (typeof mobs !== 'undefined') ? JSON.parse(JSON.stringify(mobs)) : {},
      // Track if resources have been spawned to avoid respawning
      resourcesSpawned: window.__resourcesSpawnedOnce || false,
      // Store player positions in this world
      playerPositions: window.__worldPlayerPositions || {}
    };
    
    console.log('Final serialized world data contains:', {
      allResourcesTypes: Object.keys(worldData.allResources),
      totalResources: Object.values(worldData.allResources).reduce((sum, arr) => sum + (arr?.length || 0), 0),
      mobTypes: Object.keys(worldData.mobs),
      totalMobs: Object.values(worldData.mobs).reduce((sum, arr) => sum + (arr?.length || 0), 0)
    });
    
    return worldData;
  }

  function deserializeWorld(data) {
    if (!data) return;
    
    window.gameTime = data.gameTime || 0;
    window.Day = data.Day || 0;
    window.difficulty = data.difficulty || 1;
    window.worldSeed = data.worldSeed || generateWorldSeed();
    window.__totalGameSeconds = data.totalGameSeconds || 0;
    
      // Restore placed blocks using the block management system
      if (typeof window.setPlacedBlocks === 'function') {
        window.setPlacedBlocks(data.placedBlocks || []);
      } else if (data.placedBlocks) {
        window.placedBlocks = data.placedBlocks;
      }
    
    if (data.droppedItems) {
      window.droppedItems = data.droppedItems;
    }
    
    // Restore mob state from save data
    if (data.mobs && typeof mobs !== 'undefined') {
      Object.assign(mobs, data.mobs);
      console.log('Restored mob state from save:', Object.keys(data.mobs).length, 'mob types');
    } else if (typeof mobs !== 'undefined') {
      // Clear mobs if no saved data (new world)
      Object.keys(mobs).forEach(type => {
        mobs[type] = [];
      });
      console.log('No saved mobs found, cleared mob state for new world');
    }
    
    // Restore the exact state of resources (including destroyed ones)
    if (data.allResources) {
      window.allResources = data.allResources;
      window.__resourcesSpawnedOnce = data.resourcesSpawned || true;
      const resourceCount = Object.values(data.allResources).reduce((total, arr) => total + (arr ? arr.length : 0), 0);
      console.log('Restored allResources state from save:', Object.keys(data.allResources).length, 'types,', resourceCount, 'total resources');
    } else {
      // If no saved resources, mark as not spawned so they can be generated fresh
      window.__resourcesSpawnedOnce = false;
      console.log('No saved resources found, will spawn fresh');
    }
    
    // Restore player positions for this world
    window.__worldPlayerPositions = data.playerPositions || {};
  }

  function generateWorldSeed() {
    return Math.floor(Math.random() * 2147483647);
  }

  // Simple Spawn System - Fixed spawn at (2500, 2500) for all scenarios
  function getPlayerSpawnPosition(reason, worldSeed = null) {
    const baseX = 2500;
    const baseY = 2500;
    
    // Always spawn at base position regardless of reason
    // World switching uses saved positions, handled separately
    return { x: baseX, y: baseY };
  }



  // Main SaveManager API
  const SaveManager = {
    async init() {
      try {
        const success = await initIndexedDB();
        console.log(`SaveManager initialized with ${useIndexedDB ? 'IndexedDB' : 'localStorage'}`);
        return true;
      } catch (e) {
        console.warn('SaveManager init failed, using localStorage fallback:', e);
        useIndexedDB = false;
        return true; // Always return success to avoid blocking UI
      }
    },

    // Player slot management
    async savePlayer(slot) {
      try {
        const playerData = serializePlayer();
        if (!playerData) throw new Error('No player data to save');
        
        await saveData(PLAYER_STORE, slot, playerData);
        currentPlayerSlot = slot;
        return true;
      } catch (e) {
        console.error('Failed to save player:', e);
        throw e;
      }
    },

    async loadPlayer(slot) {
      try {
        const data = await loadData(PLAYER_STORE, slot);
        if (data) {
          deserializePlayer(data);
          currentPlayerSlot = slot;
          return true;
        }
        return false;
      } catch (e) {
        console.error('Failed to load player:', e);
        return false;
      }
    },

    async deletePlayer(slot) {
      try {
        await deleteData(PLAYER_STORE, slot);
        if (currentPlayerSlot === slot) currentPlayerSlot = null;
        return true;
      } catch (e) {
        console.error('Failed to delete player:', e);
        return false;
      }
    },

    async getAllPlayers() {
      try {
        return await getAllSlots(PLAYER_STORE);
      } catch (e) {
        console.error('Failed to get all players:', e);
        return [];
      }
    },

    // World slot management
    async saveWorld(slot) {
      try {
        // Save current player position in world data before serializing
        if (currentPlayerSlot !== null && window.player && window.player.x !== undefined && window.player.y !== undefined) {
          if (!window.__worldPlayerPositions) window.__worldPlayerPositions = {};
          window.__worldPlayerPositions[currentPlayerSlot] = {
            x: window.player.x,
            y: window.player.y,
            savedAt: Date.now()
          };
        }
        
        const worldData = serializeWorld();
        await saveData(WORLD_STORE, slot, worldData);
        currentWorldSlot = slot;
        return true;
      } catch (e) {
        console.error('Failed to save world:', e);
        throw e;
      }
    },

    async loadWorld(slot) {
      try {
        const data = await loadData(WORLD_STORE, slot);
        if (data) {
          deserializeWorld(data);
          
          // CRITICAL: Always set player position after loading world
          if (currentPlayerSlot !== null && window.player) {
            if (window.__worldPlayerPositions && window.__worldPlayerPositions[currentPlayerSlot]) {
              // Player has saved position in this world - restore it
              const savedPos = window.__worldPlayerPositions[currentPlayerSlot];
              window.player.x = savedPos.x;
              window.player.y = savedPos.y;
            } else {
              // No saved position for this player in this world - use hybrid spawn system
              const spawnPos = getPlayerSpawnPosition('FIRST_TIME', window.worldSeed);
              window.player.x = spawnPos.x;
              window.player.y = spawnPos.y;
            }
          }
          
          currentWorldSlot = slot;
          return true;
        }
        return false;
      } catch (e) {
        console.error('Failed to load world:', e);
        return false;
      }
    },

    async deleteWorld(slot) {
      try {
        await deleteData(WORLD_STORE, slot);
        if (currentWorldSlot === slot) currentWorldSlot = null;
        return true;
      } catch (e) {
        console.error('Failed to delete world:', e);
        return false;
      }
    },

    async getAllWorlds() {
      try {
        return await getAllSlots(WORLD_STORE);
      } catch (e) {
        console.error('Failed to get all worlds:', e);
        return [];
      }
    },

    // Combined save/load with position handling
    async switchToWorld(worldSlot) {
      try {
        console.log(`🔄 Position System: Switching to world ${worldSlot}`);
        
        // First, save current position in current world if we have one
        if (currentWorldSlot !== null && currentPlayerSlot !== null && window.player) {
          await this.saveWorld(currentWorldSlot);
          console.log(`💾 Position System: Saved current position before switching from world ${currentWorldSlot}`);
        }
        
        // Then load the new world (which will restore position for that world)
        const success = await this.loadWorld(worldSlot);
        if (success) {
          console.log(`✅ Position System: Successfully switched to world ${worldSlot}`);
        }
        return success;
      } catch (e) {
        console.error('Failed to switch worlds:', e);
        return false;
      }
    },

    // Combined save/load
    async saveCurrentGame() {
      try {
        if (currentPlayerSlot !== null) {
          await this.savePlayer(currentPlayerSlot);
        }
        if (currentWorldSlot !== null) {
          await this.saveWorld(currentWorldSlot);
        }
        showToast('Saved');
        return true;
      } catch (e) {
        showToast('Save failed', 'error');
        console.error('Save failed:', e);
        return false;
      }
    },

    // Autosave management
    startAutosave() {
      this.stopAutosave();
      autosaveStartTime = Date.now();
      lastSaveTime = Date.now();
      autosaveTimer = setInterval(() => {
        this.saveCurrentGame();
        lastSaveTime = Date.now();
      }, AUTOSAVE_INTERVAL);
    },

    stopAutosave() {
      if (autosaveTimer) {
        clearInterval(autosaveTimer);
        autosaveTimer = null;
        autosaveStartTime = null;
        lastSaveTime = null;
      }
    },

    // Get save countdown info for debug display
    getSaveCountdown() {
      if (!autosaveTimer || !lastSaveTime) return null;
      const elapsed = Date.now() - lastSaveTime;
      const remaining = Math.max(0, AUTOSAVE_INTERVAL - elapsed);
      return {
        remainingMs: remaining,
        remainingSeconds: Math.ceil(remaining / 1000),
        isActive: remaining > 0
      };
    },

    // Current slot getters
    getCurrentPlayerSlot() { return currentPlayerSlot; },
    getCurrentWorldSlot() { return currentWorldSlot; },
    setCurrentSlots(playerSlot, worldSlot) {
      currentPlayerSlot = playerSlot;
      currentWorldSlot = worldSlot;
    },

    // Hybrid spawn system access
    getSpawnPosition(reason, worldSeed = null) {
      return getPlayerSpawnPosition(reason, worldSeed || window.worldSeed);
    }
  };

  // Auto-save on page unload
  window.addEventListener('beforeunload', () => {
    if (currentPlayerSlot !== null || currentWorldSlot !== null) {
      // Synchronous save attempt
      try {
        SaveManager.saveCurrentGame();
      } catch (e) {
        console.warn('Failed to save on page unload:', e);
      }
    }
  });

  // Export SaveManager
  window.SaveManager = SaveManager;
})();