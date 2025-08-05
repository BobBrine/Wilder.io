const hotbar = {
  slots: new Array(12).fill(null),
  selectedIndex: null, // null means hand mode (no hotbar selected)
};

function updateHotbarFromInventory(items) {
  // Sync slots with inventory
  hotbar.slots = hotbar.slots.map(slot => {
    if (!slot) return null;
    const count = items[slot.type] || 0;
    return count > 0 ? { type: slot.type, count } : null;
  });

  // Fill empty slots with new items
  for (const [type, count] of Object.entries(items)) {
    if (count > 0 && !hotbar.slots.some(slot => slot?.type === type)) {
      const emptyIndex = hotbar.slots.findIndex(slot => !slot);
      if (emptyIndex !== -1) {
        hotbar.slots[emptyIndex] = { type, count };
      }
    }
  }

  // If selectedIndex is not null and slot is now empty, go to hand mode
  if (hotbar.selectedIndex !== null && !hotbar.slots[hotbar.selectedIndex]) {
    hotbar.selectedIndex = null;
  }
}