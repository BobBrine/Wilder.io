const inventory = {
  items: {},
  maxTypes: 12,
  addItem(type, count = 1) {
    const currentTypes = Object.keys(this.items).length;
    if (!this.items[type] && currentTypes >= this.maxTypes) {
      showMessage("Inventory full!");
      return false;
    }
    this.items[type] = (this.items[type] || 0) + count;
    updateHotbarFromInventory(this.items);
    return true;
  },
  removeItem(type, count = 1) {
    if (!this.items[type] || this.items[type] < count) return false;
    this.items[type] -= count;
    if (this.items[type] <= 0) delete this.items[type];
    updateHotbarFromInventory(this.items);
    return true;
  },
  hasItem(type, count = 1) {
    return (this.items[type] || 0) >= count;
  },
  canAddItem(type) {
    return this.items[type] !== undefined || Object.keys(this.items).length < this.maxTypes;
  },
  clear() {
    this.items = {};
    updateHotbarFromInventory(this.items);
  }
};