let mouseX = 0;
let mouseY = 0;

const keys = {};

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});


canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

document.addEventListener("keydown", (e) => {
  const num = parseInt(e.key);
  if (!isNaN(num)) {
    if (num === 0) {
      hotbar.selectedIndex = 9; // '0' = 10th slot
    } else if (num >= 1 && num <= 9) {
      hotbar.selectedIndex = num - 1;
    }
  }
});

let draggingSlotIndex = null;
let draggedItem = null;

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

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
      if (hotbar.slots[i]) {
        draggingSlotIndex = i;
        draggedItem = { ...hotbar.slots[i] }; // Clone the item
      } else {
        // If clicking an empty slot, just select it
        hotbar.selectedIndex = i;
      }
      return; // Exit after clicking hotbar
    }
  }

  // === Crafting Button Area ===
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
        const success = craftItem(recipe);
        if (success) {
          console.log(`Crafted ${recipe.name}!`);
        } else {
          console.log(`Not enough materials to craft ${recipe.name}.`);
        }
        break;
      }

      craftY += craftHeight + 10; // spacing between buttons
    }
  }

});


canvas.addEventListener("mouseup", (e) => {
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

canvas.addEventListener("click", () => {
  hitResourceInCone();
});





