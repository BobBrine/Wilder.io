// js/hotbar.js
const hotbar = {
  slots: new Array(12).fill(null),
  selectedIndex: 0,
};


function updateHotbarFromInventory() {
  for (let i = 0; i < hotbar.slots.length; i++) {
    const slot = hotbar.slots[i];
    if (slot) {
      slot.count = inventory[slot.type] ?? 0;
      // Remove empty slots
      if (slot.count <= 0) {
        hotbar.slots[i] = null;
      }
    }
  }

  // Add new inventory items that aren't already in hotbar
  for (const [type, count] of Object.entries(inventory)) {
    if (typeof count === "number" && count > 0) {
      const exists = hotbar.slots.some(slot => slot?.type === type);
      if (!exists) {
        for (let i = 0; i < hotbar.slots.length; i++) {
          if (!hotbar.slots[i]) {
            hotbar.slots[i] = { type, count };
            break;
          }
        }
      }
    }
  }
}
