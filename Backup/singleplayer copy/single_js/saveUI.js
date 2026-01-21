// Save/Load UI Panels - Player and World slot selection
(function() {
  'use strict';

  let selectedPlayerSlot = null;
  let selectedWorldSlot = null;

  // Create player selection panel
  function createPlayerPanel() {
    const panel = document.createElement('div');
    panel.id = 'playerSelectionPanel';
    panel.className = 'panel';
    panel.style.cssText = `
      display: none;
      min-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    panel.innerHTML = `
      <div class="menu-header">
        <h2>Select Player</h2>
      </div>
      <div class="menu-content">
        <div id="playerSlots"></div>
        <button class="danger" id="backToMainBtn" style="margin-top: 20px;">Back to Main Menu</button>
      </div>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  // Create world selection panel
  function createWorldPanel() {
    const panel = document.createElement('div');
    panel.id = 'worldSelectionPanel';
    panel.className = 'panel';
    panel.style.cssText = `
      display: none;
      min-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    panel.innerHTML = `
      <div class="menu-header">
        <h2>Select World</h2>
      </div>
      <div class="menu-content">
        <div id="worldSlots"></div>
        <button class="danger" id="backToPlayerBtn" style="margin-top: 20px;">Back to Player Selection</button>
      </div>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  // Format timestamp for display
  function formatLastPlayed(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Create slot element
  function createSlotElement(type, slotIndex, data) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'slot-container';
    slotDiv.style.cssText = `
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      margin: 10px 0;
      padding: 16px;
      transition: all 0.2s;
      cursor: pointer;
    `;

    if (data) {
      // Filled slot
      let summary;
      if (type === 'player') {
        const inventoryCount = Object.keys(data.inventory || {}).length;
        summary = `
          <div style="flex: 1;">
            <div style="font-size: 1.3em; font-weight: bold;">${data.name || 'Unknown Player'}</div>
            <div style="opacity: 0.8; margin: 4px 0;">Level ${data.level || 1} • HP: ${data.health || 100}/${data.maxHealth || 100}</div>
            <div style="opacity: 0.6; font-size: 0.9em;">Items: ${inventoryCount} • ${formatLastPlayed(data.timestamp)}</div>
            <div style="opacity: 0.6; font-size: 0.9em;">Soul: ${data.soulCurrency || 0}</div>
          </div>
        `;
      } else {
        summary = `
          <div style="flex: 1;">
            <div style="font-size: 1.3em; font-weight: bold;">World ${slotIndex + 1}</div>
            <div style="opacity: 0.8; margin: 4px 0;">Day ${data.Day || 0} • Difficulty ${data.difficulty || 1}</div>
            <div style="opacity: 0.6; font-size: 0.9em;">${formatLastPlayed(data.timestamp)}</div>
          </div>
        `;
      }

      slotDiv.innerHTML = `
        ${summary}
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="primary play-btn" style="padding: 8px 16px; min-width: 120px;">
            ${type === 'player' ? 'Select Player' : 'Select World'}
          </button>
          <button class="delete-btn" style="
            background: #e60000; 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 6px; 
            cursor: pointer;
            font-size: 18px;
          ">🗑</button>
        </div>
      `;
    } else {
      // Empty slot
      slotDiv.innerHTML = `
        <div style="flex: 1;">
          <div style="font-size: 1.3em; opacity: 0.7;">Empty Slot</div>
          <div style="opacity: 0.5;">No ${type} data</div>
        </div>
        <button class="primary create-btn" style="padding: 8px 16px; min-width: 120px;">
          Create New ${type === 'player' ? 'Player' : 'World'}
        </button>
      `;
    }

    // Hover effects
    slotDiv.addEventListener('mouseenter', () => {
      slotDiv.style.background = 'rgba(255, 255, 255, 0.15)';
      slotDiv.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    });
    slotDiv.addEventListener('mouseleave', () => {
      slotDiv.style.background = 'rgba(255, 255, 255, 0.1)';
      slotDiv.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });

    return slotDiv;
  }

  // Show confirmation dialog
  function showConfirmDialog(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'delete-confirm-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.className = 'panel';
    dialog.setAttribute('data-delete-confirm-dialog', 'true');
    dialog.style.cssText = `
      min-width: 400px;
      text-align: center;
    `;

    dialog.innerHTML = `
      <h3 style="color: #e60000; margin-bottom: 20px;">Confirm Deletion</h3>
      <p style="margin-bottom: 30px;">${message}</p>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button class="danger confirm-delete">Delete</button>
        <button class="primary cancel-delete">Cancel</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector('.confirm-delete').onclick = () => {
      document.body.removeChild(overlay);
      onConfirm();
    };

    dialog.querySelector('.cancel-delete').onclick = () => {
      document.body.removeChild(overlay);
    };

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
  }

  // Populate player slots
  async function populatePlayerSlots() {
    const container = document.getElementById('playerSlots');
    if (!container) return;
    
    container.innerHTML = '';

    try {
      let playerData = [];
      if (window.SaveManager && window.SaveManager.getAllPlayers) {
        playerData = await window.SaveManager.getAllPlayers();
      }
      
      const playerMap = {};
      playerData.forEach(player => playerMap[player.slot] = player);

      for (let i = 0; i < 4; i++) {
        const data = playerMap[i];
        const slotElement = createSlotElement('player', i, data);
        
        if (data) {
          // Existing player slot
          const playBtn = slotElement.querySelector('.play-btn');
          const deleteBtn = slotElement.querySelector('.delete-btn');
          
          if (playBtn) {
            playBtn.onclick = () => {
              selectedPlayerSlot = i;
              showWorldPanel();
            };
          }
          
          if (deleteBtn) {
            deleteBtn.onclick = (e) => {
              e.stopPropagation();
              showConfirmDialog(
                'Are you sure you want to delete this player data? This cannot be undone.',
                async () => {
                  try {
                    if (window.SaveManager && window.SaveManager.deletePlayer) {
                      await window.SaveManager.deletePlayer(i);
                    }
                    populatePlayerSlots();
                  } catch (e) {
                    console.error('Failed to delete player:', e);
                  }
                }
              );
            };
          }
        } else {
          // Empty slot
          const createBtn = slotElement.querySelector('.create-btn');
          if (createBtn) {
            createBtn.onclick = () => {
              selectedPlayerSlot = i;
              createNewPlayer(i);
            };
          }
        }
        
        container.appendChild(slotElement);
      }
    } catch (e) {
      console.error('Error populating player slots:', e);
      // Create basic empty slots on error
      for (let i = 0; i < 4; i++) {
        const slotElement = createSlotElement('player', i, null);
        const createBtn = slotElement.querySelector('.create-btn');
        if (createBtn) {
          createBtn.onclick = () => {
            selectedPlayerSlot = i;
            createNewPlayer(i);
          };
        }
        container.appendChild(slotElement);
      }
    }
  }

  // Populate world slots
  async function populateWorldSlots() {
    const container = document.getElementById('worldSlots');
    container.innerHTML = '';

    const worldData = await window.SaveManager.getAllWorlds();
    const worldMap = {};
    worldData.forEach(world => worldMap[world.slot] = world);

    for (let i = 0; i < 4; i++) {
      const data = worldMap[i];
      const slotElement = createSlotElement('world', i, data);
      
      if (data) {
        // Existing world slot
        const playBtn = slotElement.querySelector('.play-btn');
        const deleteBtn = slotElement.querySelector('.delete-btn');
        
        playBtn.onclick = () => {
          selectedWorldSlot = i;
          startGameWithSlots();
        };
        
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          showConfirmDialog(
            'Are you sure you want to delete this world data? This cannot be undone.',
            async () => {
              await window.SaveManager.deleteWorld(i);
              populateWorldSlots();
            }
          );
        };
      } else {
        // Empty slot
        const createBtn = slotElement.querySelector('.create-btn');
        createBtn.onclick = () => {
          selectedWorldSlot = i;
          createNewWorld(i);
        };
      }
      
      container.appendChild(slotElement);
    }
  }

  // Create new player
  async function createNewPlayer(slot) {
    try {
      // Clear any existing inventory/hotbar state to prevent leakage from previous players
      if (window.inventory) {
        window.inventory.items = {};
      }
      if (window.hotbar) {
        window.hotbar.slots = new Array(12).fill(null);
        window.hotbar.selectedIndex = null;
      }
      // Reset starter kit flag for this new player
      window.__startingItemsGranted = false;
      
      // Create a basic player and save immediately
      window.player = window.createNewPlayer ? window.createNewPlayer() : {
        id: crypto.randomUUID(),
        x: 2500,
        y: 2500,
        size: 40,
        speed: 200,
        color: "blue",
        health: 100,
        maxHealth: 100,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        name: 'New Player'
      };
      
      // Clear any existing player state and initialize fresh state
      clearPlayerState();
      // Ensure alive and not spectating/invulnerable
      if (window.player) {
        window.player.isDead = false;
        window.player.invulnerable = false;
        if (window.player.__hiddenBySpectator || window.player.size === 0) {
          window.player.size = window.player.__origSize || window.player.size || 32;
          delete window.player.__hiddenBySpectator;
          delete window.player.__origSize;
        }
      }
      
      // Initialize soul currency if available
      if (window.soulCurrency) {
        window.soulCurrency.set(0);
      }
      
      // Give starter kit (flag was reset at start of function)
      if (typeof window.giveStartingItemsOnce === 'function') {
        // Ensure inventory is available
        if (typeof window.inventory !== 'undefined') {
          window.giveStartingItemsOnce();
          console.log('Starter kit given to new player');
        }
      }

      // Sync hotbar and force UI redraw so it appears immediately
      if (typeof window.updateHotbarFromInventory === 'function' && window.inventory?.items) {
        window.updateHotbarFromInventory(window.inventory.items);
      }
      // Select first available hotbar slot if none
      if (window.hotbar && (window.hotbar.selectedIndex == null)) {
        const firstIdx = (window.hotbar.slots || []).findIndex(Boolean);
        if (firstIdx !== -1) window.hotbar.selectedIndex = firstIdx;
      }
      if (typeof window.drawHUD === 'function') window.drawHUD();
      if (typeof window.drawHotbar === 'function') window.drawHotbar();

      await window.SaveManager.savePlayer(slot);
      showWorldPanel();
    } catch (e) {
      console.error('Failed to create new player:', e);
      alert('Failed to create new player. Please try again.');
    }
  }

  // Create new world
  async function createNewWorld(slot) {
    try {
      // Reset any existing seeded RNG state first
      if (typeof window.resetWorldSeed === 'function') {
        window.resetWorldSeed();
      }
      
      // Initialize world data
      window.gameTime = 0;
      window.Day = 0;
      window.difficulty = 1;
      // Generate a unique seed using timestamp + random to ensure uniqueness
      window.worldSeed = Math.floor(Date.now() * Math.random()) % 2147483647;
      
      // Re-initialize the seeded RNG with the new world seed
      if (typeof window.initializeWorldSeed === 'function') {
        window.initializeWorldSeed();
        console.log('Initialized new world seed:', window.worldSeed);
      }
      window.__totalGameSeconds = 0;
      
        // Clear placed blocks for new world
        if (typeof window.clearAllBlocks === 'function') {
          window.clearAllBlocks();
        } else {
          window.placedBlocks = [];
        }
      
      window.droppedItems = [];
      
      // Clear mobs for new world
      if (typeof mobs !== 'undefined') {
        Object.keys(mobs).forEach(type => {
          mobs[type] = [];
        });
        console.log('Cleared mobs for new world');
      }
      
      // Clear and reset resources for new world
      if (window.allResources) {
        Object.keys(window.allResources).forEach(type => {
          window.allResources[type] = [];
        });
        console.log('Cleared resources for new world');
      }
      window.__resourcesSpawnedOnce = false;
      
      // Initialize empty resource state for new world without breaking references
      if (!window.allResources) window.allResources = {};
      if (typeof window.ensureAllResourceTypes === 'function') {
        window.ensureAllResourceTypes();
      } else {
        // Fallback: ensure keys exist
        for (const t of ['food','wood','stone','iron','gold']) {
          if (!Array.isArray(window.allResources[t])) window.allResources[t] = [];
        }
      }
      window.__resourcesSpawnedOnce = false;
      
      // CRITICAL: Reset player position using hybrid spawn system for new world BEFORE saving
      if (window.player) {
        const spawnPos = window.SaveManager.getSpawnPosition ? window.SaveManager.getSpawnPosition('NEW_WORLD') : { x: 2500, y: 2500 };
        window.player.x = spawnPos.x;
        window.player.y = spawnPos.y;
      }
      
      await window.SaveManager.saveWorld(slot);
      startGameWithSlots();
    } catch (e) {
      console.error('Failed to create new world:', e);
      alert('Failed to create new world. Please try again.');
    }
  }

  // Clear player-specific state to ensure player individuality
  function clearPlayerState() {
    // Clear player-specific global variables
    window.hunger = 100;
    window.stamina = 100;
    window.maxStamina = 100;
    window.staminaRegenSpeed = 40;
    
    // Clear inventory and hotbar
    if (window.inventory) {
      if (typeof window.inventory.clear === 'function') {
        window.inventory.clear();
      } else if (window.inventory.items) {
        window.inventory.items = {};
      }
    }
    
    if (window.hotbar) {
      window.hotbar.slots = new Array(12).fill(null);
      window.hotbar.selectedIndex = null;
    }
    
    // Reset soul currency
    if (window.soulCurrency) {
      window.soulCurrency.set(0);
    }
    
    console.log('Cleared player state for player isolation');
  }

  // Clear world state to ensure world individuality
  function clearWorldState() {
    // Clear world-specific global variables
    window.gameTime = 0;
    window.Day = 0;
    window.__totalGameSeconds = 0;
    window.placedBlocks = [];
    window.droppedItems = [];
    
    // Clear timers that might be running
    if (window.__deathCountdownTimer) {
      clearInterval(window.__deathCountdownTimer);
      window.__deathCountdownTimer = null;
    }
    if (window.__offlineTimeTicker) {
      clearInterval(window.__offlineTimeTicker);
      window.__offlineTimeTicker = null;
    }
    
    // Reset gameplay state
    try {
      window.gameplayPaused = false;
      if (window.spectator) {
        window.spectator.active = false;
        window.spectator.saved = null;
      }
    } catch(_) {}
    
    // Clear mobs
    if (typeof mobs !== 'undefined') {
      Object.keys(mobs).forEach(type => {
        mobs[type] = [];
      });
    }
    
    // Clear resources (they will be reloaded from save or generated fresh)
    if (window.allResources) {
      Object.keys(window.allResources).forEach(type => {
        window.allResources[type] = [];
      });
    }
    window.__resourcesSpawnedOnce = false;
    
    // Reset the seeded RNG so it will be re-initialized with the loaded world's seed
    if (typeof window.resetWorldSeed === 'function') {
      window.resetWorldSeed();
    }
    
    console.log('Cleared world state for world isolation');
  }

  // Start game with selected slots
  async function startGameWithSlots() {
    try {
      // Clear any existing world and player state before loading
      clearWorldState();
      clearPlayerState();
      
      // Set current slots in SaveManager FIRST
      window.SaveManager.setCurrentSlots(selectedPlayerSlot, selectedWorldSlot);
      
      // Load the selected player and world data
      await window.SaveManager.loadPlayer(selectedPlayerSlot);
      await window.SaveManager.loadWorld(selectedWorldSlot);
      
      // Final position verification and correction
      if (window.player && window.SaveManager.getCurrentPlayerSlot() !== null && window.SaveManager.getCurrentWorldSlot() !== null) {
        const currentPlayerSlot = window.SaveManager.getCurrentPlayerSlot();
        
        if (window.__worldPlayerPositions && window.__worldPlayerPositions[currentPlayerSlot]) {
          const savedPos = window.__worldPlayerPositions[currentPlayerSlot];
          if (window.player.x !== savedPos.x || window.player.y !== savedPos.y) {
            window.player.x = savedPos.x;
            window.player.y = savedPos.y;
          }
        } else {
          const spawnPos = window.SaveManager.getSpawnPosition ? window.SaveManager.getSpawnPosition('WORLD_SWITCH', window.worldSeed) : { x: 2500, y: 2500 };
          if (window.player.x !== spawnPos.x || window.player.y !== spawnPos.y) {
            window.player.x = spawnPos.x;
            window.player.y = spawnPos.y;
          }
        }
      }
      
      // Hide all panels and show game
      hideAllPanels();
      const menu = document.getElementById('singlePlayerMenu');
      if (menu) menu.style.display = 'none';
      const bg = document.getElementById('bgHomepage');
      if (bg) bg.style.display = 'none';
      const gc = document.getElementById('gameCanvas');
      if (gc) {
        gc.style.display = 'block';
        gc.style.pointerEvents = 'auto';
      }
      
      // Ensure gameplay isn't paused
  try { window.gameplayPaused = false; } catch(_) {}
  // Ensure player is alive for first frame if health > 0
  try { if (window.player && window.player.health > 0) window.player.isDead = false; } catch(_) {}
      
      // Handle resource spawning - always ensure resources are available
      console.log('=== RESOURCE SPAWNING CHECK ===');
      console.log('window.allResources exists:', !!window.allResources);
      console.log('window.allResources keys:', window.allResources ? Object.keys(window.allResources) : 'none');
      // Ensure keys exist without breaking references
      try {
        if (typeof window.ensureAllResourceTypes === 'function') {
          window.ensureAllResourceTypes();
          console.log('Ensured resource type keys exist:', Object.keys(window.allResources));
        }
      } catch (e) { console.warn('ensureAllResourceTypes failed:', e); }
      
      const hasResources = window.allResources && Object.keys(window.allResources).length > 0;
      console.log('hasResources (has keys):', hasResources);
      
      if (hasResources) {
        console.log('Resource details:');
        for (const [type, resources] of Object.entries(window.allResources)) {
          console.log(`  ${type}: ${Array.isArray(resources) ? resources.length : 'not array'} resources`);
        }
      }
      
      const hasResourcesWithContent = hasResources && Object.values(window.allResources).some(arr => arr && arr.length > 0);
      console.log('hasResourcesWithContent (has actual resources):', hasResourcesWithContent);
      
      if (!hasResourcesWithContent) {
        // Spawn fresh resources using the world's seed for consistent generation
        // Ensure the seeded RNG is properly initialized
        if (typeof window.initializeWorldSeed === 'function') {
          window.initializeWorldSeed();
        }
        try {
          if (typeof window.spawnAllResources === 'function') {
            window.spawnAllResources();
            window.__resourcesSpawnedOnce = true;
            console.log('Spawned fresh resources using seed:', window.worldSeed);
          } else {
            console.warn('spawnAllResources is not available on window yet');
          }
        } catch (e) {
          console.error('Error while spawning resources:', e);
        }
      } else {
        // Using saved resources
        // Resources loaded from save, ensure spawned flag is set
        window.__resourcesSpawnedOnce = true;
        // Also initialize the seed for any future resource operations
        if (typeof window.initializeWorldSeed === 'function') {
          window.initializeWorldSeed();
        }
      }
      
      // Ensure player gets starter kit only for brand-new players (no inventory)
      try {
        const hasAnyItems = window.inventory && window.inventory.items && Object.keys(window.inventory.items).length > 0;
        if (!hasAnyItems && typeof window.giveStartingItemsOnce === 'function') {
          window.giveStartingItemsOnce();
        }
      } catch(_) {}

      // After loading player/inventory or giving starter kit, ensure hotbar UI reflects items
      try {
        if (window.inventory && typeof window.updateHotbarFromInventory === 'function') {
          window.updateHotbarFromInventory(window.inventory.items || {});
          console.log('Hotbar synchronized with inventory. Slots:', (window.hotbar?.slots || []).filter(Boolean).length,
                      'Selected:', window.hotbar?.selectedIndex);
          // If no selected slot but there is at least one item, select first slot for immediate UI feedback
          if (window.hotbar && (window.hotbar.selectedIndex == null)) {
            const firstIdx = (window.hotbar.slots || []).findIndex(Boolean);
            if (firstIdx !== -1) window.hotbar.selectedIndex = firstIdx;
          }
        }
      } catch (e) {
        console.warn('Failed to sync hotbar after start:', e);
      }
      
      // Start player state loop (health regen, etc.)
      if (typeof window.startPlayerStateLoop === 'function') {
        window.startPlayerStateLoop();
      }
      
      // Ensure mobs are spawned and tracking player
      try {
        if (typeof window.spawnAllMob === 'function' && window.allResources) {
          // Only spawn mobs if resources are available
          const resourceCount = Object.values(window.allResources).reduce((total, arr) => total + (arr ? arr.length : 0), 0);
          if (resourceCount > 0) {
            console.log('Spawning mobs with', resourceCount, 'resources available');
            window.spawnAllMob(window.allResources, {}, window.gameTime || 0);
          } else {
            console.log('Skipping mob spawn - no resources available yet');
          }
        }
        // Ensure playersMap is updated
        if (typeof window.playersMap !== 'undefined' && window.player && window.player.id) {
          window.playersMap[window.player.id] = window.player;
        }
      } catch(e) {
        console.warn('Failed to setup mobs:', e);
        // Try basic mob initialization without resources
        try {
          if (typeof window.mobs !== 'undefined') {
            window.mobs = window.mobs || [];
          }
        } catch(e2) {
          console.warn('Failed basic mob setup:', e2);
        }
      }
      
      // Start autosave
      window.SaveManager.startAutosave();
      
      console.log(`Game started with Player Slot ${selectedPlayerSlot} and World Slot ${selectedWorldSlot}`);
    } catch (e) {
      console.error('Failed to start game:', e);
      alert('Failed to start game. Please try again.');
    }
  }

  // Panel management
  function showPlayerPanel() {
    try {
      hideAllPanels();
      const panel = document.getElementById('playerSelectionPanel') || createPlayerPanel();
      panel.style.display = 'block';
      
      // Hide main menu
      const mainMenu = document.getElementById('singlePlayerMenu');
      if (mainMenu) mainMenu.style.display = 'none';
      
      // Wire up back button
      const backBtn = document.getElementById('backToMainBtn');
      if (backBtn) {
        backBtn.onclick = () => {
          hideAllPanels();
          // Show main menu again
          if (mainMenu) mainMenu.style.display = 'block';
        };
      }
      
      populatePlayerSlots().catch(e => {
        console.error('Failed to populate player slots:', e);
        // Show empty slots on error
        const container = document.getElementById('playerSlots');
        if (container) {
          container.innerHTML = '<p style="color: #ff6666;">Error loading save data. You can still create new players.</p>';
          // Add 4 empty slots
          for (let i = 0; i < 4; i++) {
            const slotElement = createSlotElement('player', i, null);
            const createBtn = slotElement.querySelector('.create-btn');
            if (createBtn) {
              createBtn.onclick = () => {
                selectedPlayerSlot = i;
                createNewPlayer(i);
              };
            }
            container.appendChild(slotElement);
          }
        }
      });
    } catch (e) {
      console.error('Failed to show player panel:', e);
      // Fallback to original game start
      if (window.startGame) {
        window.startGame();
      }
    }
  }

  function showWorldPanel() {
    hideAllPanels();
    const panel = document.getElementById('worldSelectionPanel') || createWorldPanel();
    panel.style.display = 'block';
    populateWorldSlots();
    
    // Wire up back button
    const backBtn = document.getElementById('backToPlayerBtn');
    if (backBtn) {
      backBtn.onclick = showPlayerPanel;
    }
  }

  function hideAllPanels() {
    const playerPanel = document.getElementById('playerSelectionPanel');
    const worldPanel = document.getElementById('worldSelectionPanel');
    if (playerPanel) playerPanel.style.display = 'none';
    if (worldPanel) worldPanel.style.display = 'none';
  }

  // Export functions for use by main game
  window.SaveUI = {
    showPlayerPanel,
    hideAllPanels,
    
    // Debug functions for testing
    testDeathPanel: () => {
      if (window.player) {
        window.player.health = 0;
        window.player.isDead = false; // Trigger death detection
        console.log('Death panel test triggered');
      }
    },
    
    giveStarterKit: () => {
      if (window.giveStartingItemsOnce) {
        window.__startingItemsGranted = false;
        window.giveStartingItemsOnce();
        console.log('Starter kit given manually');
      }
    },
    
    forceSave: () => {
      if (window.SaveManager && window.SaveManager.saveCurrentGame) {
        window.SaveManager.saveCurrentGame();
        console.log('Manual save triggered');
      }
    },
    
    // Debug: Check what's currently in save data
    checkSaveData: async () => {
      if (window.SaveManager) {
        const players = await window.SaveManager.getAllPlayers();
        const worlds = await window.SaveManager.getAllWorlds();
        console.log('=== SAVE DATA CHECK ===');
        console.log('Saved players:', players);
        console.log('Saved worlds:', worlds);
        console.log('Current player:', window.player);
        console.log('Current allResources keys:', Object.keys(window.allResources || {}));
        console.log('Current allResources content:', window.allResources);
        console.log('Current placedBlocks:', window.placedBlocks?.length || 0, 'blocks');
        console.log('Current droppedItems:', window.droppedItems?.length || 0, 'items');
        console.log('Current inventory:', window.inventory?.items);
        console.log('Current hotbar:', window.hotbar);
        console.log('Current hunger/stamina:', window.hunger, window.stamina);
        console.log('Resources spawned flag:', window.__resourcesSpawnedOnce);
      }
    },
    
    // Force save and show what was saved
    forceSaveAndCheck: async () => {
      if (window.SaveManager && window.SaveManager.saveCurrentGame) {
        console.log('=== SAVING CURRENT STATE ===');
        console.log('Player before save:', window.player);
        console.log('Inventory before save:', window.inventory?.items);
        console.log('Resources before save:', Object.keys(window.allResources || {}));
        
        await window.SaveManager.saveCurrentGame();
        console.log('Manual save completed');
        
        setTimeout(() => {
          window.SaveUI.checkSaveData();
        }, 1000);
      }
    },
    
    // Test loading current slots to verify save/load works
    testLoadCurrentSlots: async () => {
      const currentPlayer = window.SaveManager.getCurrentPlayerSlot();
      const currentWorld = window.SaveManager.getCurrentWorldSlot();
      
      if (currentPlayer !== null && currentWorld !== null) {
        console.log('=== TESTING LOAD CURRENT SLOTS ===');
        console.log('Loading player slot:', currentPlayer);
        console.log('Loading world slot:', currentWorld);
        
        await window.SaveManager.loadPlayer(currentPlayer);
        await window.SaveManager.loadWorld(currentWorld);
        
        console.log('After load - Player:', window.player);
        console.log('After load - Inventory:', window.inventory?.items);
        console.log('After load - Resources:', Object.keys(window.allResources || {}));
        console.log('After load - Resource counts:', Object.fromEntries(
          Object.entries(window.allResources || {}).map(([k, v]) => [k, v?.length || 0])
        ));
      } else {
        console.log('No current slots set');
      }
    },
    
    // Show what will be saved right now
    showCurrentGameState: () => {
      console.log('=== CURRENT GAME STATE ===');
      console.log('Player position:', window.player?.x, window.player?.y);
      console.log('Player health:', window.player?.health, '/', window.player?.maxHealth);
      console.log('Inventory item count:', Object.keys(window.inventory?.items || {}).length);
      console.log('Resources by type:', Object.fromEntries(
        Object.entries(window.allResources || {}).map(([k, v]) => [k, v?.length || 0])
      ));
      console.log('Placed blocks:', window.placedBlocks?.length || 0);
      console.log('Dropped items:', window.droppedItems?.length || 0);
  // Seed is internal; no need to log
      console.log('Game time:', window.gameTime);
    },
    
    // Check what's actually in the saved data right now
    checkSavedDataNow: async () => {
      const currentPlayer = window.SaveManager.getCurrentPlayerSlot();
      const currentWorld = window.SaveManager.getCurrentWorldSlot();
      
      if (currentPlayer !== null && currentWorld !== null) {
        console.log('=== CHECKING SAVED DATA ===');
        try {
          const playerData = await window.SaveManager.getPlayerData(currentPlayer);
          const worldData = await window.SaveManager.getWorldData(currentWorld);
          
          console.log('Saved player data exists:', !!playerData);
          if (playerData) {
            console.log('Player position in save:', playerData.x, playerData.y);
            console.log('Player inventory items:', Object.keys(playerData.inventory || {}).length);
          }
          
          console.log('Saved world data exists:', !!worldData);
          if (worldData) {
            // Seed is internal; no need to log
            console.log('Resources in save:', worldData.allResources ? Object.keys(worldData.allResources) : 'none');
            if (worldData.allResources) {
              for (const [type, resources] of Object.entries(worldData.allResources)) {
                console.log(`  ${type}: ${Array.isArray(resources) ? resources.length : 'not array'} resources`);
                if (Array.isArray(resources) && resources.length > 0) {
                  console.log(`    First ${type}:`, resources[0]);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error checking saved data:', error);
        }
      } else {
        console.log('No current slots set');
      }
    }
  };

  // Initialize SaveManager when this script loads - with error handling
  function initSaveSystem() {
    try {
      if (window.SaveManager && window.SaveManager.init) {
        window.SaveManager.init().then(() => {
          console.log('Save system initialized successfully');
        }).catch(e => {
          console.warn('Save system init failed, using fallback:', e);
        });
      } else {
        console.warn('SaveManager not available, save system disabled');
      }
    } catch (e) {
      console.error('Failed to initialize save system:', e);
    }
  }

  // Try to init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSaveSystem);
  } else {
    initSaveSystem();
  }

  // Also try after a delay to ensure all scripts loaded
  setTimeout(initSaveSystem, 500);

  // Export debug functions to window for testing
  window.debugSaveSystem = {
    forceSave: window.SaveUI.forceSave,
    checkSaveData: window.SaveUI.checkSaveData,
    testLoadCurrentSlots: window.SaveUI.testLoadCurrentSlots,
    showCurrentGameState: window.SaveUI.showCurrentGameState,
    checkSavedDataNow: window.SaveUI.checkSavedDataNow,
    
    // Quick check of current resources
    checkCurrentResources: () => {
      console.log('=== CURRENT RESOURCES IN MEMORY ===');
      console.log('window.allResources exists:', !!window.allResources);
      if (window.allResources) {
        console.log('Types:', Object.keys(window.allResources));
        for (const [type, resources] of Object.entries(window.allResources)) {
          console.log(`${type}:`, Array.isArray(resources) ? resources.length : 'not array', 'resources');
          if (Array.isArray(resources) && resources.length > 0) {
            console.log(`  First ${type}:`, resources[0]);
          }
        }
      }
      console.log('window.__resourcesSpawnedOnce:', window.__resourcesSpawnedOnce);
    },
    
    // Try to trigger a save and see what gets saved
    testSaveNow: async () => {
      console.log('=== TESTING SAVE RIGHT NOW ===');
      
      // First check current state
      window.debugSaveSystem.checkCurrentResources();
      window.debugSaveSystem.showCurrentGameState();
      
      // Try to save
      try {
        await window.SaveManager.saveWorld(window.SaveManager.getCurrentWorldSlot() || 0);
        console.log('World save completed');
        
        await window.SaveManager.savePlayer(window.SaveManager.getCurrentPlayerSlot() || 0);
        console.log('Player save completed');
      } catch (error) {
        console.error('Save failed:', error);
      }
    }
  };
})();