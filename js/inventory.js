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
//give player item at the start
inventory.addItem("wood", 100);
inventory.addItem("stone", 100);
inventory.addItem("iron", 100);
inventory.addItem("gold", 100);
