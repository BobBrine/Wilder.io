const inventory = {
  addItem(type, count = 1) {
    if (!this[type]) this[type] = 0;
    this[type] += count;
    updateHotbarFromInventory();  
  },
  removeItem(type, count = 1) {
    if (this[type] >= count) {
      this[type] -= count;
      updateHotbarFromInventory();  
      return true;
    }
    return false;
  },
  hasItem(type, count = 1) {
    return this[type] >= count;
  }
};

inventory.clear = function () {
  for (const key in this) {
    if (typeof this[key] === "number") {
      delete this[key];
    }
  }
  updateHotbarFromInventory(); // Refresh UI after clearing
};