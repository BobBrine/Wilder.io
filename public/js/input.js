let mouseX = 0;
let mouseY = 0;

const keys = {};

let isMouseDown = false;
let lastHitTime = 0;

let holdInterval = null;

// Configurable delay between hits (e.g., 200ms)
const hitDelay = 250;

const startHitting = () => {
  if (!holdInterval) {
    holdInterval = setInterval(() => {
      if (isMouseDown) {
        tryHitResource();
      }
    }, 50); // Check often, but throttle with `tryHitResource()`
  }
};


const stopHitting = () => {
  clearInterval(holdInterval);
  holdInterval = null;
};




window.addEventListener("keydown", (e) => {
  if (!e.key || typeof e.key !== "string" || typeof keys === "undefined") return;
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  if (!e.key || typeof e.key !== "string" || typeof keys === "undefined") return;
  keys[e.key.toLowerCase()] = false;
});



canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

document.addEventListener("keydown", (e) => {
  if (!e.key || typeof e.key !== "string") return;

  const key = e.key.toLowerCase();

  if (typeof keys !== "undefined") {
    keys[key] = true;
  }

  const num = parseInt(e.key, 10);
  if (!isNaN(num) && typeof hotbar !== "undefined") {
    if (num === 0) {
      hotbar.selectedIndex = 9;
    } else if (num >= 1 && num <= 9) {
      hotbar.selectedIndex = num - 1;
    }
  }
});


let draggingSlotIndex = null;
let draggedItem = null;

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // only left click

  const uiElement = getUIElementAtMouse(e);

  if (uiElement) {
    // Handle UI clicks

    if (uiElement.type === "hotbar") {
      hotbar.selectedIndex = uiElement.index;

      // Start dragging if there is an item in that slot
      if (hotbar.slots[uiElement.index]) {
        draggingSlotIndex = uiElement.index;
        draggedItem = { ...hotbar.slots[uiElement.index] };
      }
    } else if (uiElement.type === "crafting") {
      // Craft the recipe clicked
      craftItem(uiElement.recipe);
    }

    // Since clicked UI, do NOT hit resource
    isMouseDown = false;
    stopHitting();

    return; // Stop here, don't start hitting
  }

  // Not clicking UI → start hitting resource
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
    const slotSize = 40;
    const padding = 4;
    const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
    const startX = (canvas.width - totalWidth) / 2;
    const y = canvas.height - slotSize - 10;

    for (let i = 0; i < hotbar.slots.length; i++) {
      const x = startX + i * (slotSize + padding);
      if (
        mouseX >= x &&
        mouseX <= x + slotSize &&
        mouseY >= y &&
        mouseY <= y + slotSize
      ) {
        // Swap items
        const temp = hotbar.slots[i];
        hotbar.slots[i] = hotbar.slots[draggingSlotIndex];
        hotbar.slots[draggingSlotIndex] = temp;

        // Also select the clicked slot
        hotbar.selectedIndex = i;
        break;
      }
    }
    
  }

  draggingSlotIndex = null;
  draggedItem = null;
});

// Also stop hitting if mouse leaves canvas
canvas.addEventListener("mouseleave", () => {
  isMouseDown = false;
  stopHitting();
});

function getUIElementAtMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // === Check Hotbar ===
  const slotSize = 40;
  const padding = 4;
  const totalWidth = (slotSize + padding) * hotbar.slots.length - padding;
  const startX = (canvas.width - totalWidth) / 2;
  const hotbarY = canvas.height - slotSize - 10;

  for (let i = 0; i < hotbar.slots.length; i++) {
    const x = startX + i * (slotSize + padding);
    if (
      mouseX >= x &&
      mouseX <= x + slotSize &&
      mouseY >= hotbarY &&
      mouseY <= hotbarY + slotSize
    ) {
      return { type: "hotbar", index: i };
    }
  }

  // === Check Crafting UI ===
  let craftX = canvas.width - 110;
  let craftY = 10;
  const craftWidth = 140;
  const craftHeight = 30;

  for (const recipe of recipes) {
    if (canCraft(recipe)) {
      if (
        mouseX >= craftX &&
        mouseX <= craftX + craftWidth &&
        mouseY >= craftY &&
        mouseY <= craftY + craftHeight
      ) {
        return { type: "crafting", recipe };
      }
      craftY += craftHeight + 10;
    }
  }

  return null;
}







