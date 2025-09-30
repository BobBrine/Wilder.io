// Global Escape key handler for singleplayer: drop prompt, settings panel, and menu logic
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Priority 1: Check if delete confirmation dialog is open
    const deleteDialog = document.querySelector('[data-delete-confirm-dialog="true"]');
    if (deleteDialog) {
      // Close the delete confirmation dialog (same as clicking cancel)
      const overlay = deleteDialog.closest('.delete-confirm-overlay') || deleteDialog.parentElement;
      if (overlay && overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
        if (typeof playCancel === 'function') playCancel();
      }
      return;
    }

    // Priority 2: Check if drop prompt is open
    const dropPrompt = document.getElementById('dropAmountPrompt');
    if (dropPrompt && dropPrompt.style && dropPrompt.style.display !== 'none') {
      dropPrompt.style.display = 'none';
      if (typeof playCancel === 'function') playCancel();
      return;
    }
    
    // Priority 3: Check if settings panel is open
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel && settingsPanel.style && settingsPanel.style.display !== 'none') {
      if (window.__settingsPanel && typeof window.__settingsPanel.close === 'function') {
        window.__settingsPanel.close();
      }
      return;
    }
    
    // Priority 4: Check if we're in gameplay (open settings)
    const menu = document.getElementById('singlePlayerMenu');
    const death = document.getElementById('deathScreen');
    const gameCanvas = document.getElementById('gameCanvas');
    const playerPanel = document.getElementById('playerSelectionPanel');
    const worldPanel = document.getElementById('worldSelectionPanel');
    
    if ((!menu || menu.style.display === 'none') && 
        (!death || death.style.display === 'none') && 
        (!playerPanel || playerPanel.style.display === 'none') &&
        (!worldPanel || worldPanel.style.display === 'none') &&
        gameCanvas && gameCanvas.style.display !== 'none') {
      // We're in gameplay - open settings
      if (window.__settingsPanel && typeof window.__settingsPanel.open === 'function') {
        window.__settingsPanel.open();
      }
      return;
    }
    
    // Priority 5: Menu navigation back buttons
    // Check if world selection panel is open
    if (worldPanel && worldPanel.style.display !== 'none') {
      // World Selection → Player Selection
      if (window.SaveUI && typeof window.SaveUI.showPlayerPanel === 'function') {
        window.SaveUI.showPlayerPanel();
        if (typeof playCancel === 'function') playCancel();
      }
      return;
    }
    
    // Check if player selection panel is open
    if (playerPanel && playerPanel.style.display !== 'none') {
      // Player Selection → Main Menu
      if (window.SaveUI && typeof window.SaveUI.hideAllPanels === 'function') {
        window.SaveUI.hideAllPanels();
      }
      if (menu) {
        menu.style.display = 'block';
      }
      if (typeof playCancel === 'function') playCancel();
      return;
    }
    
    // Check if main menu is open (go back to index.html)
    if (menu && menu.style.display !== 'none') {
      // Main Menu → Go back to home page
      if (typeof goBack === 'function') {
        goBack();
      }
      return;
    }
  }
});
// Fallback for singleplayer: simple drop prompt or no-op
if (typeof promptDropAmount !== 'function') {
  function promptDropAmount(type, count) {
    // Show the drop amount prompt UI
    const prompt = document.getElementById('dropAmountPrompt');
    const input = document.getElementById('dropAmountInput');
    if (!prompt || !input) {
      alert(`Drop ${count} ${type}?`);
      return;
    }
    prompt.style.display = 'block';
    // Position slightly above center so it doesn't cover the player
    prompt.style.left = '50%';
    prompt.style.top = 'calc(50% - 120px)';
    prompt.style.transform = 'translate(-50%, -50%)';
    input.value = count;
    input.max = count;
    input.min = 1;
    input.focus();
    // Store drop type/count for submit
    prompt.dataset.type = type;
    prompt.dataset.count = count;
  }

  // Called when user confirms drop
  window.submitDropAmount = function() {
    const prompt = document.getElementById('dropAmountPrompt');
    const input = document.getElementById('dropAmountInput');
    if (!prompt || !input) return;
    const type = prompt.dataset.type;
    const maxCount = parseInt(prompt.dataset.count || '1', 10);
    let amount = parseInt(input.value || '1', 10);
    if (isNaN(amount) || amount < 1) amount = 1;
    if (amount > maxCount) amount = maxCount;
    prompt.style.display = 'none';
    input.value = '';
    // Actually drop the item(s)
    if (typeof dropItemFromHotbar === 'function') {
      dropItemFromHotbar(type, amount);
    } else {
      // fallback: remove from inventory if available
      if (typeof inventory !== 'undefined' && inventory.removeItem) {
        inventory.removeItem(type, amount);
      }
    }
  };

  // Called when user clicks Drop All
  window.dropAll = function() {
    const prompt = document.getElementById('dropAmountPrompt');
    if (!prompt) return;
    const type = prompt.dataset.type;
    const maxCount = parseInt(prompt.dataset.count || '1', 10);
    prompt.style.display = 'none';
    const input = document.getElementById('dropAmountInput');
    if (input) input.value = '';
    if (typeof dropItemFromHotbar === 'function') {
      dropItemFromHotbar(type, maxCount);
    } else {
      if (typeof inventory !== 'undefined' && inventory.removeItem) {
        inventory.removeItem(type, maxCount);
      }
    }
  };
}
// Centralized API to drop from hotbar with default 1s pickup delay and cooldown
window.dropItemFromHotbar = function(type, amount, options = {}) {
  if (!window.player || window.player.isDead) return false;
  // Default behavior: player drop with 1s pickup delay; allow override via options
  const opts = {
    pickupDelaySec: (typeof options.pickupDelaySec === 'number' ? options.pickupDelaySec : 1),
    dropCooldownSec: (typeof options.dropCooldownSec === 'number' ? options.dropCooldownSec : undefined),
  };
  return dropItem(type, amount, window.player, true, opts);
};
let mouseX = 0, mouseY = 0;
// Expose keys on window so other scripts (e.g., spectator camera) can read movement reliably
const keys = {};
if (typeof window !== 'undefined') {
  window.keys = keys;
}
let isMouseDown = false;
let lastHitTime = 0;
let holdInterval = null;

const startHitting = () => {
  if (!holdInterval) holdInterval = setInterval(() => isMouseDown && tryHitResource(), 50);
};

const stopHitting = () => {
  clearInterval(holdInterval);
  holdInterval = null;
};

// Only track movement keys in keys object, not hotbar keys
window.addEventListener("keydown", (e) => {
  if (!e.key || typeof e.key !== "string") return;
  const key = e.key.toLowerCase();
  // Don't track hotbar keys in keys object to avoid sticky selection
  if (!'1234567890-='.includes(e.key)) {
    keys[key] = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (!e.key || typeof e.key !== "string") return;
  const key = e.key.toLowerCase();
  if (!'1234567890-='.includes(e.key)) {
    keys[key] = false;
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  // Set dragActive if mouse moved enough during drag
  if (draggingSlotIndex !== null && dragStartPos) {
    const dx = mouseX - dragStartPos.x;
    const dy = mouseY - dragStartPos.y;
    if (!dragActive && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dragActive = true;
    }
  }
});
document.addEventListener("keydown", function(e) {
  if (!e.key || typeof e.key !== "string") return;
  // Only block hotbar keys if not typing in an input or textarea
  var active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  var key = e.key;
  var keyMap = {
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9, '-': 10, '=': 11
  };
  if (keyMap.hasOwnProperty(key)) {
    var idx = keyMap[key];
    if (hotbar.selectedIndex === idx) {
      hotbar.selectedIndex = null; // hand mode
    } else {
      hotbar.selectedIndex = idx;
    }
    e.preventDefault();
  }
});
// Ensure draggedItem is global for ui.js
// This should be set after drag updates, e.g. in mousedown and mouseup handlers
// Allow Ctrl shortcuts on home page
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey) e.stopPropagation();
}, true);
document.addEventListener('keydown', (event) => {
  const prompt = document.getElementById('dropAmountPrompt');
  if (!prompt) return;
  if (prompt.style.display === 'block') {
    if (event.key === 'Enter') {
      submitDropAmount();
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === 'Escape' || event.key === 'Esc') {
      // Cancel/close drop prompt
      prompt.style.display = 'none';
      const input = document.getElementById('dropAmountInput');
      if (input) input.value = '';
      event.preventDefault();
      event.stopPropagation();
    }
  }
});

let draggingSlotIndex = null;
// Ensure draggedItem is global for ui.js
window.draggedItem = null;
let draggedItem = null;
let dragStartPos = null;
let dragActive = false;
// Use padding from ui.js, do not redeclare here

// New function: get touch position relative to canvas
function getTouchPosition(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

// Unified pointer handler for mouse and touch events
function handlePointerEvent(e) {
  if (e.button !== 0 && e.type !== 'touchstart') return;
  
  const rect = canvas.getBoundingClientRect();
  const clickX = e.x;
  const clickY = e.y;
  
  // Check for button clicks
  let buttonClicked = false;
  uiButtons.forEach(button => {
    if (clickX >= button.x && clickX <= button.x + button.width &&
        clickY >= button.y && clickY <= button.y + button.height) {
      button.callback();
      buttonClicked = true;
    }
  });

  // If a button was clicked, skip other interactions
  if (buttonClicked) {
    isMouseDown = false;
    stopHitting();
    return;
  }

  // Existing UI element handling
  const uiElement = getUIElementAtMouse({ clientX: e.clientX, clientY: e.clientY });
  if (uiElement) {
    if (uiElement.type === "hotbar") {
      // Toggle hotbar selection on click (same as keyboard)
      if (hotbar.selectedIndex === uiElement.index) {
        hotbar.selectedIndex = null;
      } else {
        hotbar.selectedIndex = uiElement.index;
      }
      if (hotbar.slots[uiElement.index]) {
        draggingSlotIndex = uiElement.index;
    window.draggedItem = draggedItem = { ...hotbar.slots[uiElement.index] };
      }
    } else if (uiElement.type === "crafting") {
      craftItem(uiElement.recipe);
    }
    isMouseDown = false;
    stopHitting();
    return;
  }

  // Existing food and hitting logic
  const selected = hotbar.slots[hotbar.selectedIndex];
  if (selected && BlockTypes[selected.type] && !buttonClicked && !uiElement) {
    const { gridX, gridY } = getFrontGridCell(player);
    
    if (placeBlockAt(selected.type, gridX, gridY)) {
      // Remove one block from inventory
      if (selected.count > 1) {
        selected.count--;
      } else {
        hotbar.slots[hotbar.selectedIndex] = null;
      }
    }
    
    isMouseDown = false;
    stopHitting();
    return;
  }

  if (selected?.type === "food") {
    consumeFood();
    isMouseDown = false;
    stopHitting();
    return;
  }

  if (selected?.type.endsWith("_potion")) {
    consumePotion(selected.type);
    isMouseDown = false;
    stopHitting();
    return;
  }
    
  isMouseDown = true;
  tryHitResource();
  startHitting();
}

// Mouse event handler
// Replace the current mousedown event handler with this improved version
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  dragStartPos = { x: mouseX, y: mouseY };
  dragActive = false;
  
  // Only handle left-click
  if (e.button !== 0) return;
  
  // First, check if we're clicking on a UI element
  const uiElement = getUIElementAtMouse({ clientX: e.clientX, clientY: e.clientY });
  
  if (uiElement) {
    if (uiElement.type === "hotbar") {
      // Hotbar selection logic
      hotbar.selectedIndex = uiElement.index;
      if (hotbar.slots[uiElement.index]) {
        draggingSlotIndex = uiElement.index;
        window.draggedItem = draggedItem = { ...hotbar.slots[uiElement.index] };
        dragStartPos = { x: mouseX, y: mouseY };
        dragActive = false;
      }
    } else if (uiElement.type === "crafting") {
      // Crafting logic - this should execute when clicking crafting recipes
      console.log("Crafting clicked:", uiElement.recipe.name); // Debug log
      craftItem(uiElement.recipe);
    }
    return; // Stop here if we clicked a UI element
  }
  
  // If we get here, we're not clicking on any UI element
  const selected = hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
  
  if (selected && selected.type === "food") {
    consumeFood();
  } else if (selected && selected.type && selected.type.endsWith("_potion")) {
    consumePotion(selected.type);
  } else if (selected && BlockTypes[selected.type]) {
    // Block placement logic
    const { gridX, gridY } = getFrontGridCell(player);
    if (placeBlockAt(selected.type, gridX, gridY)) {
      if (selected.count > 1) {
        selected.count--;
      } else {
        hotbar.slots[hotbar.selectedIndex] = null;
      }
    }
  } else {
    // Default action: start hitting
    isMouseDown = true;
    tryHitResource();
    startHitting();
  }
});

// Touch event handler
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const pos = getTouchPosition(touch);
    handlePointerEvent({
      clientX: pos.clientX,
      clientY: pos.clientY,
      x: pos.x,
      y: pos.y,
      button: 0
    });
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button !== 0) return;
  isMouseDown = false;
  stopHitting();
  const rect = canvas.getBoundingClientRect();
  // Use CSS pixel coordinates for hotbar detection
  const css = typeof uiCanvasSize === 'function' ? uiCanvasSize() : { w: canvas.width, h: canvas.height };
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  if (draggingSlotIndex !== null && hotbar.slots[draggingSlotIndex]) {
    const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
    const startX = (css.w - totalWidth) / 2;
    const y = css.h - slotSize - 20;
    let droppedOutside = true;
    let releasedIndex = null;
    for (let i = 0; i < hotbar.slots.length; i++) {
      const x = startX + i * (slotSize + padding);
      if (mouseX >= x && mouseX <= x + slotSize && mouseY >= y && mouseY <= y + slotSize) {
        releasedIndex = i;
        if (i !== draggingSlotIndex) {
          // Swap items if target slot has an item, move if empty
          const temp = hotbar.slots[i];
          hotbar.slots[i] = hotbar.slots[draggingSlotIndex];
          hotbar.slots[draggingSlotIndex] = temp;
          hotbar.selectedIndex = i;
        }
        droppedOutside = false;
        break;
      }
    }
    // Only drop if mouse released outside hotbar
    if (droppedOutside) {
      promptDropAmount(hotbar.slots[draggingSlotIndex].type, hotbar.slots[draggingSlotIndex].count);
    }
  }
  draggingSlotIndex = null;
  window.draggedItem = draggedItem = null;
  dragStartPos = null;
  dragActive = false;
});

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const uiElement = getUIElementAtMouse({ clientX: e.clientX, clientY: e.clientY });
  if (uiElement && uiElement.type === "hotbar" && hotbar.slots[uiElement.index]) {
    promptDropAmount(hotbar.slots[uiElement.index].type, hotbar.slots[uiElement.index].count);
  }
});

canvas.addEventListener("mouseleave", () => {
  isMouseDown = false;
  stopHitting();
});

// Handle touch end events
canvas.addEventListener("touchend", () => {
  isMouseDown = false;
  stopHitting();
});

function getUIElementAtMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  // Fix: define css for consistent sizing (matches ui.js)
  const css = typeof uiCanvasSize === 'function' ? uiCanvasSize() : { w: canvas.width, h: canvas.height };
  const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
  const startX = (css.w - totalWidth) / 2;
  const hotbarY = css.h - slotSize - 20;

  // Hotbar slots
  for (let i = 0; i < hotbar.slots.length; i++) {
    const x = startX + i * (slotSize + padding);
    if (mouseX >= x && mouseX <= x + slotSize && mouseY >= hotbarY && mouseY <= hotbarY + slotSize) {
      return { type: "hotbar", index: i };
    }
  }
  
  // Crafting grid (4x4)
  const gridCols = 4;
  const gridRows = 4;
  const cellSize = 32;
  const cellPadding = 10;
  const gridWidth = gridCols * cellSize + (gridCols - 1) * cellPadding;
  const gridHeight = gridRows * cellSize + (gridRows - 1) * cellPadding;
  const gridX = css.w - gridWidth - 20;
  const gridY = 40;

  // Check if player is near a crafting table
  const nearTable = isNearCraftingTable();
  
  // Filter recipes based on crafting table requirement
  const availableRecipes = recipes.filter(recipe => {
    // Always show recipes that don't require a table
    if (!recipe.craftingTable) return true;
    // Only show table recipes if player is near a table
    return nearTable;
  });
  
  // Get craftable and non-craftable recipes from available recipes
  const craftableRecipes = availableRecipes.filter(r => canCraft(r));
  const nonCraftableRecipes = availableRecipes.filter(r => !canCraft(r));
  
  // Combine with craftable items first
  const allRecipes = [...craftableRecipes, ...nonCraftableRecipes].slice(0, 16);
  
  for (let i = 0; i < allRecipes.length; i++) {
    const row = Math.floor(i / gridCols);
    const col = gridCols - 1 - (i % gridCols); // right-to-left
    const x = gridX + col * (cellSize + cellPadding);
    const y = gridY + row * (cellSize + cellPadding);
    
    if (mouseX >= x && mouseX <= x + cellSize && 
        mouseY >= y && mouseY <= y + cellSize) {
      return { type: "crafting", recipe: allRecipes[i] };
    }
  }
  
  return null;
}


(function(){
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const LS_KEY_SCALE = 'controls.joystickScale';
  function loadScale(){ try { return Math.max(0.6, Math.min(1.6, parseFloat(localStorage.getItem(LS_KEY_SCALE) || '1'))); } catch(_) { return 1; } }
  function saveScale(v){ try { localStorage.setItem(LS_KEY_SCALE, String(v)); } catch(_) {} }
  const state = {
    x: 0,
    y: 0,
    active: false,
    lastAngle: 0,
    visible: false,
    sprint: false,
    aim: { x: 0, y: 0, active: false, angle: 0 },
    scale: loadScale(),
  moveTouchId: null,
  aimTouchId: null,
  };

  // Create DOM elements
  const root = document.createElement('div');
  root.id = 'mobileControls';
  root.style.position = 'fixed';
  root.style.inset = '0 0 0 0';
  // Change 1: Make wrapper ignore pointer events
  root.style.pointerEvents = 'none';
  root.style.zIndex = '1000';
  root.style.display = 'none';
  root.style.touchAction = 'none';

  const joyWrap = document.createElement('div');
  joyWrap.id = 'joystickWrap';
  joyWrap.style.position = 'absolute';
  joyWrap.style.left = '20px';
  joyWrap.style.bottom = '20px';
  joyWrap.style.width = `${140 * state.scale}px`;
  joyWrap.style.height = `${140 * state.scale}px`;
  joyWrap.style.borderRadius = '50%';
  joyWrap.style.background = 'rgba(0,0,0,0.25)';
  joyWrap.style.backdropFilter = 'blur(2px)';
  // Change 2: Make container ignore pointer events
  joyWrap.style.pointerEvents = 'none';
  joyWrap.style.touchAction = 'none';

  const joyBase = document.createElement('div');
  joyBase.id = 'joystickBase';
  joyBase.style.position = 'absolute';
  joyBase.style.left = '0';
  joyBase.style.top = '0';
  joyBase.style.right = '0';
  joyBase.style.bottom = '0';
  joyBase.style.borderRadius = '50%';
  joyBase.style.border = '2px solid rgba(255,255,255,0.4)';
  // Change 3: Make base ignore pointer events
  joyBase.style.pointerEvents = 'none';

  const joyKnob = document.createElement('div');
  joyKnob.id = 'joystickKnob';
  joyKnob.style.position = 'absolute';
  joyKnob.style.left = '50%';
  joyKnob.style.top = '50%';
  joyKnob.style.width = `${56 * state.scale}px`;
  joyKnob.style.height = `${56 * state.scale}px`;
  joyKnob.style.borderRadius = '50%';
  joyKnob.style.background = 'rgba(255,255,255,0.5)';
  joyKnob.style.transform = 'translate(-50%, -50%)';
  // Change 4: Only knob responds to pointer events
  joyKnob.style.pointerEvents = 'auto';

  // Sprint button
  const sprintBtn = document.createElement('div');
  sprintBtn.id = 'sprintBtn';
  sprintBtn.textContent = 'SPRINT';
  sprintBtn.style.position = 'absolute';
  sprintBtn.style.right = '20px';
  sprintBtn.style.bottom = '30px';
  // Circle button
  sprintBtn.style.width = `${80 * state.scale}px`;
  sprintBtn.style.height = `${80 * state.scale}px`;
  sprintBtn.style.borderRadius = '50%';
  sprintBtn.style.background = 'rgba(0,0,0,0.5)';
  sprintBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
  sprintBtn.style.color = '#fff';
  sprintBtn.style.display = 'flex';
  sprintBtn.style.alignItems = 'center';
  sprintBtn.style.justifyContent = 'center';
  sprintBtn.style.fontFamily = 'Arial, sans-serif';
  sprintBtn.style.fontWeight = 'bold';
  sprintBtn.style.userSelect = 'none';
  sprintBtn.style.pointerEvents = 'auto';
  sprintBtn.style.touchAction = 'none';

  // Aim joystick replaces HIT
  const aimWrap = document.createElement('div');
  aimWrap.id = 'aimWrap';
  aimWrap.style.position = 'absolute';
  aimWrap.style.right = '20px';
  // Position aim stick above the sprint circle
  aimWrap.style.bottom = `${80 * state.scale + 50}px`;
  aimWrap.style.width = `${120 * state.scale}px`;
  aimWrap.style.height = `${120 * state.scale}px`;
  aimWrap.style.borderRadius = '50%';
  aimWrap.style.background = 'rgba(0,0,0,0.22)';
  // Change 5: Make container ignore pointer events
  aimWrap.style.pointerEvents = 'none';
  aimWrap.style.touchAction = 'none';

  const aimBase = document.createElement('div');
  aimBase.style.position = 'absolute';
  aimBase.style.left = 0; aimBase.style.top = 0; aimBase.style.right = 0; aimBase.style.bottom = 0;
  aimBase.style.borderRadius = '50%';
  aimBase.style.border = '2px solid rgba(255,255,255,0.35)';
  // Change 6: Make base ignore pointer events
  aimBase.style.pointerEvents = 'none';

  const aimKnob = document.createElement('div');
  aimKnob.style.position = 'absolute';
  aimKnob.style.left = '50%'; aimKnob.style.top = '50%';
  aimKnob.style.width = `${44 * state.scale}px`;
  aimKnob.style.height = `${44 * state.scale}px`;
  aimKnob.style.borderRadius = '50%';
  aimKnob.style.background = 'rgba(255,255,255,0.5)';
  aimKnob.style.transform = 'translate(-50%, -50%)';
  // Change 7: Only knob responds to pointer events
  aimKnob.style.pointerEvents = 'auto';

  joyWrap.appendChild(joyBase);
  joyWrap.appendChild(joyKnob);
  root.appendChild(joyWrap);
  aimWrap.appendChild(aimBase);
  aimWrap.appendChild(aimKnob);
  root.appendChild(aimWrap);
  root.appendChild(sprintBtn);
  document.body.appendChild(root);

  function setVisible(v) {
    state.visible = !!v;
    root.style.display = v ? 'block' : 'none';
  }

  // Auto-show on touch devices once game starts; hidden on menus
  setVisible(false);

  // Joystick logic
  const maxRadius = 60 * state.scale; // movement radius from center
  let dragging = false;
  let startX = 0, startY = 0;

  function setKnob(dx, dy) {
    // clamp to circle
    const len = Math.hypot(dx, dy);
    const clampedLen = Math.min(len, maxRadius);
    const nx = len > 0 ? (dx / len) * clampedLen : 0;
    const ny = len > 0 ? (dy / len) * clampedLen : 0;
    joyKnob.style.transform = `translate(${nx}px, ${ny}px)`;
    joyKnob.style.left = '50%';
    joyKnob.style.top = '50%';
    const ax = nx / maxRadius;
    const ay = ny / maxRadius;
    state.x = ax;
    state.y = ay;
    state.active = (Math.abs(ax) + Math.abs(ay)) > 0.02;
    if (state.active) state.lastAngle = Math.atan2(ay, ax);
  }

  function resetKnob() {
    joyKnob.style.transform = 'translate(-50%, -50%)';
    joyKnob.style.left = '50%';
    joyKnob.style.top = '50%';
    state.x = 0; state.y = 0; state.active = false;
  }

  function getLocalPos(e, overrideXY) {
    const rect = joyWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x, y;
    if (overrideXY) { x = overrideXY.x; y = overrideXY.y; }
    else if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    else { x = e.clientX; y = e.clientY; }
    return { dx: x - cx, dy: y - cy };
  }

  function findTouchById(touches, id){
    if (!touches) return null;
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  }

  function onStart(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.changedTouches && e.changedTouches.length) {
      // Capture this touch for the movement joystick
      const t = e.changedTouches[0];
      state.moveTouchId = t.identifier;
      dragging = true;
      const { dx, dy } = getLocalPos(e, { x: t.clientX, y: t.clientY });
      setKnob(dx, dy);
    } else {
      dragging = true;
      const { dx, dy } = getLocalPos(e);
      setKnob(dx, dy);
    }
  }
  function onMove(e) {
    if (!dragging) return; e.preventDefault();
    if (state.moveTouchId !== null && (e.touches || e.changedTouches)) {
      const t = findTouchById(e.touches || e.changedTouches, state.moveTouchId);
      if (!t) return;
      const { dx, dy } = getLocalPos(e, { x: t.clientX, y: t.clientY });
      setKnob(dx, dy);
    } else {
      const { dx, dy } = getLocalPos(e);
      setKnob(dx, dy);
    }
  }
  function onEnd(e) {
    // Only intercept if this is our tracked touch (or if we were dragging with mouse)
    if (state.moveTouchId !== null && e.changedTouches && e.changedTouches.length) {
      const t = findTouchById(e.changedTouches, state.moveTouchId);
      if (!t) return; // not our touch ending
      e.preventDefault();
      state.moveTouchId = null;
      dragging = false;
      resetKnob();
    } else if (state.moveTouchId === null && dragging) {
      // mouse end when we had started dragging
      e.preventDefault();
      dragging = false;
      resetKnob();
    }
  }

  const opts = { passive: false };
  // Change 8: Only attach events to knob elements
  joyKnob.addEventListener('touchstart', onStart, opts);
  joyKnob.addEventListener('touchmove', onMove, opts);
  joyKnob.addEventListener('touchend', onEnd, opts);
  joyKnob.addEventListener('touchcancel', onEnd, opts);
  joyKnob.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  // Track movement joystick globally so it keeps working if finger leaves the knob area
  window.addEventListener('touchmove', onMove, opts);
  window.addEventListener('touchend', onEnd, opts);
  window.addEventListener('touchcancel', onEnd, opts);

  // Sprint button handlers (press-and-hold sprint)
  const sprintOn = (e) => { e.preventDefault(); e.stopPropagation(); state.sprint = true; sprintBtn.style.background = 'rgba(0,0,0,0.75)'; };
  const sprintOff = (e) => { e.preventDefault(); e.stopPropagation(); state.sprint = false; sprintBtn.style.background = 'rgba(0,0,0,0.5)'; };
  sprintBtn.addEventListener('touchstart', sprintOn, opts);
  sprintBtn.addEventListener('touchend', sprintOff, opts);
  sprintBtn.addEventListener('touchcancel', sprintOff, opts);
  sprintBtn.addEventListener('mousedown', sprintOn);
  sprintBtn.addEventListener('mouseup', sprintOff);
  sprintBtn.addEventListener('mouseleave', sprintOff);

  // Aim joystick
  const aimMax = 50 * state.scale;
  let aiming = false;
  function aimLocalPos(e, overrideXY){
    const rect = aimWrap.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    let x, y; if (overrideXY) { x = overrideXY.x; y = overrideXY.y; }
    else if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; } else { x = e.clientX; y = e.clientY; }
    return { dx: x - cx, dy: y - cy };
  }
  function setAim(dx, dy){
    const len = Math.hypot(dx, dy);
    const cl = Math.min(len, aimMax);
    const nx = len>0 ? (dx/len)*cl : 0;
    const ny = len>0 ? (dy/len)*cl : 0;
    aimKnob.style.transform = `translate(${nx}px, ${ny}px)`;
    aimKnob.style.left = '50%'; aimKnob.style.top = '50%';
    state.aim.x = nx/aimMax; state.aim.y = ny/aimMax; state.aim.active = (Math.abs(nx)+Math.abs(ny))>2;
    if (state.aim.active) { state.aim.angle = Math.atan2(state.aim.y, state.aim.x); state.lastAngle = state.aim.angle; }
  }
  function resetAim(){ aimKnob.style.transform = 'translate(-50%, -50%)'; aimKnob.style.left='50%'; aimKnob.style.top='50%'; state.aim = { x:0,y:0,active:false,angle: state.lastAngle }; }
  function aimStart(e){
    e.preventDefault(); e.stopPropagation();
    if (e.changedTouches && e.changedTouches.length) {
      const t = e.changedTouches[0];
      state.aimTouchId = t.identifier;
      aiming = true;
      const {dx,dy}=aimLocalPos(e, { x: t.clientX, y: t.clientY });
      setAim(dx,dy);
    } else {
      aiming = true; const {dx,dy}=aimLocalPos(e); setAim(dx,dy);
    }
    try{ if (typeof tryHitResource==='function') tryHitResource(); }catch(_){ }
  }
  function aimMove(e){
    if(!aiming) return; e.preventDefault();
    if (state.aimTouchId !== null && (e.touches || e.changedTouches)) {
      const t = findTouchById(e.touches || e.changedTouches, state.aimTouchId);
      if (!t) return;
      const {dx,dy}=aimLocalPos(e, { x: t.clientX, y: t.clientY });
      setAim(dx,dy);
    } else {
      const {dx,dy}=aimLocalPos(e); setAim(dx,dy);
    }
  }
  function aimEnd(e){
    // Only intercept if this is our tracked touch (or if we were aiming with mouse)
    if (state.aimTouchId !== null && e.changedTouches && e.changedTouches.length) {
      const t = findTouchById(e.changedTouches, state.aimTouchId);
      if (!t) return; // not our touch ending
      e.preventDefault();
      state.aimTouchId = null;
      aiming=false; resetAim();
    } else if (state.aimTouchId === null && aiming) {
      // mouse end when we had started aiming
      e.preventDefault();
      aiming=false; resetAim();
    }
  }
  // Change 9: Only attach events to knob elements
  aimKnob.addEventListener('touchstart', aimStart, opts);
  aimKnob.addEventListener('touchmove', aimMove, opts);
  aimKnob.addEventListener('touchend', aimEnd, opts);
  aimKnob.addEventListener('touchcancel', aimEnd, opts);
  aimKnob.addEventListener('mousedown', aimStart);
  window.addEventListener('mousemove', aimMove);
  window.addEventListener('mouseup', aimEnd);
  // Track aim joystick globally for robust multi-touch
  window.addEventListener('touchmove', aimMove, opts);
  window.addEventListener('touchend', aimEnd, opts);
  window.addEventListener('touchcancel', aimEnd, opts);

  window.mobileControls = {
    get axis(){ return { x: state.x, y: state.y }; },
    isActive(){ return state.active; },
    getFacing(){ return state.lastAngle; },
    isSprinting(){ return !!state.sprint; },
    aim(){ return { ...state.aim }; },
    setVisible,
    setScale(v){ const s = Math.max(0.6, Math.min(1.6, Number(v)||1)); state.scale = s; saveScale(s); try{ applyScale(); }catch(_){} },
  };

  function applyScale(){
    // Update sizes based on state.scale
    joyWrap.style.width = `${140 * state.scale}px`;
    joyWrap.style.height = `${140 * state.scale}px`;
    joyKnob.style.width = `${56 * state.scale}px`;
    joyKnob.style.height = `${56 * state.scale}px`;
  // Keep sprint as a circle
  sprintBtn.style.width = `${80 * state.scale}px`;
  sprintBtn.style.height = `${80 * state.scale}px`;
    aimWrap.style.width = `${120 * state.scale}px`;
    aimWrap.style.height = `${120 * state.scale}px`;
  // Keep aim stick offset above new circular sprint
  aimWrap.style.bottom = `${80 * state.scale + 50}px`;
    aimKnob.style.width = `${44 * state.scale}px`;
    aimKnob.style.height = `${44 * state.scale}px`;
  }
  applyScale();
})();