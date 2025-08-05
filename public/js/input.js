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

document.addEventListener('keydown', (event) => {
  if (document.getElementById('dropAmountPrompt').style.display === 'block' && event.key === 'Enter') submitDropAmount();
});

let draggingSlotIndex = null;
let draggedItem = null;

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  const uiElement = getUIElementAtMouse(e);
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

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
  if (selected?.type === "food") {
    consumeFood();
    isMouseDown = false;
    stopHitting();
    return;
  }
  isMouseDown = true;
  tryHitResource();
  startHitting();
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

function getUIElementAtMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
  const startX = (canvas.width - totalWidth) / 2;
  const hotbarY = canvas.height - slotSize - 20;
  for (let i = 0; i < hotbar.slots.length; i++) {
    const x = startX + i * (slotSize + padding);
    if (mouseX >= x && mouseX <= x + slotSize && mouseY >= hotbarY && mouseY <= hotbarY + slotSize) {
      return { type: "hotbar", index: i };
    }
  }
  const craftX = canvas.width - scoreboardWidth - 110 - 10;
  let craftY = 40;
  const craftWidth = 100;
  const craftHeight = 30;
  for (const recipe of recipes) {
    if (canCraft(recipe)) {
      if (mouseX >= craftX && mouseX <= craftX + craftWidth && mouseY >= craftY && mouseY <= craftY + craftHeight) {
        return { type: "crafting", recipe };
      }
      craftY += craftHeight + 10;
    }
  }
  return null;
}