const inventory = {
  addItem(type, count = 1) {
    const currentTypes = Object.keys(this).filter(key => typeof this[key] === "number").length;
    if (!this[type] && currentTypes >= 12) {
      showMessage("Inventory full!");
      return false;
    }
    if (!this[type]) this[type] = 0;
    this[type] += count;
    updateHotbarFromInventory();
    return true;
  },
  removeItem(type, count = 1) {
    if (this[type] >= count) {
      this[type] -= count;
      if (this[type] <= 0) {
        delete this[type]; // Clean up zero-count items
      }
      updateHotbarFromInventory();
      return true;
    }
    return false;
  },
  hasItem(type, count = 1) {
    return this[type] >= count;
  },
  canAddItem(type) {
    if (this[type]) return true; // Can add more of existing type
    const currentTypes = Object.keys(this).filter(key => typeof this[key] === "number").length;
    showMessage("Inventory Full");
    return currentTypes < 12;
  }
};

inventory.clear = function () {
  for (const key in this) {
    if (typeof this[key] === "number") {
      delete this[key];
    }
  }
  updateHotbarFromInventory();
};