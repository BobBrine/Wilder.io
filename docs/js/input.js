let mouseX = 0, mouseY = 0;
const keys = {};
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
});

// Hotbar selection: toggle slot or hand mode (1-9,0,-,=) -- only one handler
document.addEventListener("keydown", (e) => {
  if (!e.key || typeof e.key !== "string") return;
  // Only block hotbar keys if not typing in an input or textarea
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  const key = e.key;
  const keyMap = {
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9, '-': 10, '=': 11
  };
  if (keyMap.hasOwnProperty(key)) {
    const idx = keyMap[key];
    if (hotbar.selectedIndex === idx) {
      hotbar.selectedIndex = null; // hand mode
    } else {
      hotbar.selectedIndex = idx;
    }
    e.preventDefault();
  }
});
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
let draggedItem = null;

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
        draggedItem = { ...hotbar.slots[uiElement.index] };
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
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  handlePointerEvent({
    clientX: e.clientX,
    clientY: e.clientY,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    button: e.button
  });
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
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  if (draggingSlotIndex !== null) {
    const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
    const startX = (canvas.width - totalWidth) / 2;
    const y = canvas.height - slotSize - 20;
    let dropped = true;
    for (let i = 0; i < hotbar.slots.length; i++) {
      const x = startX + i * (slotSize + padding);
      if (mouseX >= x && mouseX <= x + slotSize && mouseY >= y && mouseY <= y + slotSize) {
        const temp = hotbar.slots[i];
        hotbar.slots[i] = hotbar.slots[draggingSlotIndex];
        hotbar.slots[draggingSlotIndex] = temp;
        hotbar.selectedIndex = i;
        dropped = false;
        break;
      }
    }
    if (dropped && hotbar.slots[draggingSlotIndex]) promptDropAmount(hotbar.slots[draggingSlotIndex].type, hotbar.slots[draggingSlotIndex].count);
  }
  draggingSlotIndex = null;
  draggedItem = null;
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
  const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
  const startX = (canvas.width - totalWidth) / 2;
  const hotbarY = canvas.height - slotSize - 20;
  
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
  const gridX = canvas.width - scoreboardWidth - gridWidth - 20;
  const gridY = gridHeight - slotSize - 75;

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


