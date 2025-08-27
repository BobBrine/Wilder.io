let ItemTypes = {

};

const recipes = [
  { name: "Crafting Table", cost: { wood: 7 }, output: { type: "crafting_table", count: 1 } },
  { name: "Torch", cost: { wood: 5 }, output: { type: "torch", count: 1 } },
  { name: "Wooden Axe", cost: { wood: 12 }, output: { type: "wooden_axe", count: 1 }, craftingTable: true },
  { name: "Wooden Sword", cost: { wood: 15 }, output: { type: "wooden_sword", count: 1 }, craftingTable: true },
  { name: "Wooden Pick", cost: { wood: 15 }, output: { type: "wooden_pickaxe", count: 1 }, craftingTable: true },
  { name: "Wooden Hammer", cost: { wood: 18 }, output: { type: "wooden_hammer", count: 1 }, craftingTable: true },
  { name: "Stone Axe", cost: { wood: 24, stone: 15, wooden_axe: 1 }, output: { type: "stone_axe", count: 1 }, craftingTable: true },
  { name: "Stone Sword", cost: { wood: 24, stone: 20, wooden_sword: 1 }, output: { type: "stone_sword", count: 1 }, craftingTable: true },
  { name: "Stone Pick", cost: { wood: 24, stone: 20, wooden_pickaxe: 1 }, output: { type: "stone_pickaxe", count: 1 }, craftingTable: true },
  { name: "Iron Axe", cost: { wood: 36, iron: 15, stone_axe: 1 }, output: { type: "iron_axe", count: 1 }, craftingTable: true },
  { name: "Iron Sword", cost: { wood: 36, iron: 20, stone_sword: 1 }, output: { type: "iron_sword", count: 1 }, craftingTable: true },
  { name: "Iron Pick", cost: { wood: 36, iron: 20, stone_pickaxe: 1 }, output: { type: "iron_pickaxe", count: 1 }, craftingTable: true },
  { name: "Gold Axe", cost: { wood: 50, gold: 15, iron_axe: 1 }, output: { type: "gold_axe", count: 1 }, craftingTable: true },
  { name: "Gold Sword", cost: { wood: 50, gold: 20, iron_sword: 1 }, output: { type: "gold_sword", count: 1 }, craftingTable: true },
  { name: "Gold Pick", cost: { wood: 50, gold: 20, iron_pickaxe: 1 }, output: { type: "gold_pickaxe", count: 1 }, craftingTable: true },
  { name: "Health Potion", cost: { pure_core: 10 }, output: { type: "health_potion", count: 1 }, craftingTable: true },
  { name: "Strength Potion", cost: { dark_core: 10 }, output: { type: "strength_potion", count: 1 }, craftingTable: true },
  { name: "Mythic Potion", cost: { mythic_core: 1, pure_core: 5, dark_core: 5, soul: 1 }, output: { type: "mythic_potion", count: 1 }, craftingTable: true },
];

function canCraft(recipe) {
  // Check if recipe requires crafting table and player is not near one
  if (recipe.craftingTable && !isNearCraftingTable()) {
    return false;
  }
  
  const required = recipe.cost;
  return Object.keys(required).every(key => {
    if (key === 'soul') {
      return window.soulCurrency.get() >= required[key];
    } else {
      return inventory.hasItem(key, required[key]);
    }
  });
}


function craftItem(recipe) {
  if (!canCraft(recipe)) {
    playCancel();
    showMessage("Not enough resources to craft!");
    return false;
  }
  const output = recipe.output;
  if (!inventory.canAddItem(output.type)) {
    playCancel();
    showMessage("Inventory full! Cannot craft item.");
    return false;
  }
  for (const [key, amount] of Object.entries(recipe.cost)) {
    if (key === 'soul') {
      window.soulCurrency.set(window.soulCurrency.get() - amount);
    } else {
      inventory.removeItem(key, amount);
    }
  }
  inventory.addItem(output.type, output.count);
  playSelect();
  showMessage(`Crafted ${output.count} ${output.type}!`);
  return true;
}
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

  // Do NOT auto-deselect hotbar when attacking or if slot is empty; stay in hand mode as long as user is on an empty slot.
  // Only set selectedIndex to null if the user removes an item from a slot they are currently on (handled elsewhere if needed).
}

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

const pureCoreImage = new Image();
pureCoreImage.src = '../images/pure_core.png';
const darkCoreImage = new Image();
darkCoreImage.src = '../images/dark_core.png';
const mythicCoreImage = new Image();
mythicCoreImage.src = '../images/mythic_core.png';
// Load hand image
const handImage = new Image();
handImage.src = "../images/hand.png";
let handImageLoaded = false;
handImage.onload = () => {
  handImageLoaded = true;
};

// Load sword image
const swordImage = new Image();
swordImage.src = '../images/wooden_sword.png'; // Adjust path as needed
const stone_sword_Image = new Image();
stone_sword_Image.src = '../images/stone_sword.png';
const iron_sword_Image = new Image();
iron_sword_Image.src = '../images/iron_sword.png';
const gold_sword_Image = new Image();
gold_sword_Image.src = '../images/gold_sword.png';

// Load pickaxe image
const wooden_pickaxe_Image = new Image();
wooden_pickaxe_Image.src = '../images/wooden_pickaxe.png'; // Adjust path as needed
const stone_pickaxe_Image = new Image();
stone_pickaxe_Image.src = '../images/stone_pickaxe.png';
const iron_pickaxe_Image = new Image();
iron_pickaxe_Image.src = '../images/iron_pickaxe.png';
const gold_pickaxe_Image = new Image();
gold_pickaxe_Image.src = '../images/gold_pickaxe.png';

// Load axe image
const wooden_axe_Image = new Image();
wooden_axe_Image.src = '../images/wooden_axe.png'; // Adjust path as needed
const stone_axe_Image = new Image();
stone_axe_Image.src = '../images/stone_axe.png';
const iron_axe_Image = new Image();
iron_axe_Image.src = '../images/iron_axe.png';
const gold_axe_Image = new Image();
gold_axe_Image.src = '../images/gold_axe.png';

const wooden_hammer_Image = new Image();
wooden_hammer_Image.src = '../images/wooden_hammer.png';

// Load wood image
const woodImage = new Image();
woodImage.src = '../images/wood.png'; // Adjust path as needed
let woodImageLoaded = false;
woodImage.onload = () => {
    woodImageLoaded = true;
};

// Load food image
const foodImage = new Image();
foodImage.src = '../images/food.png';
let foodImageLoaded = false;
foodImage.onload = () => {
    foodImageLoaded = true;
};

const torchImage = new Image();
torchImage.src = '../images/torch.png';
let torchImageLoaded = false;
torchImage.onload = () => {
    torchImageLoaded = true;
};

const stoneImage = new Image();
stoneImage.src = '../images/stone.png';
let stoneImageLoaded = false;
stoneImage.onload = () => {
    stoneImageLoaded = true;
};

const ironImage = new Image();
ironImage.src = '../images/iron.png';
const goldImage = new Image();
goldImage.src = '../images/gold.png';

const craftingImage = new Image();
craftingImage.src = '../images/craftingtable.png';
let craftingImageLoaded = false;
craftingImage.onload = () => {
    craftingImageLoaded = true;
};

const toolImages = {
  'stone_sword': stone_sword_Image,
  'iron_sword': iron_sword_Image,
  'gold_sword': gold_sword_Image,
  'wooden_pickaxe': wooden_pickaxe_Image,
  'stone_pickaxe': stone_pickaxe_Image,
  'iron_pickaxe': iron_pickaxe_Image,
  'wooden_axe': wooden_axe_Image,
  'iron_axe': iron_axe_Image,
  'torch': torchImage,
  'wooden_hammer': wooden_hammer_Image,
};

const healthPotionImage = new Image();
healthPotionImage.src = 'images/health_potion.png';
const strengthPotionImage = new Image();
strengthPotionImage.src = 'images/attack_potion.png';
const mythicPotionImage = new Image();
mythicPotionImage.src = 'images/Raindom_potion.png';

const resourceImages = {
  'wood': woodImage,
  'stone': stoneImage,
  'iron': ironImage,
  'gold': goldImage,
  'food': foodImage,
  'pure_core': pureCoreImage,
  'dark_core': darkCoreImage,
  'mythic_core': mythicCoreImage,
  'health_potion': healthPotionImage,
  'strength_potion': strengthPotionImage,
  'mythic_potion': mythicPotionImage,
  'crafting_table': craftingImage,
};

function drawTool(centerX, centerY, attackRange) {
  // Draw left hand
  if (handImageLoaded) {
    const handScale = player.size / 32;
    let handXOffset = player.size * 0.75;
    let handYOffset = -player.size * 0.55;
    let handAngle = -Math.PI / 8;
    const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.facingAngle + Math.PI / 2);
    ctx.rotate(handAngle);
    let localX = -handXOffset;
    let localY = handYOffset;
    let moveBack = false;
    if (selected && ItemTypes[selected.type] && isAttacking) {
      moveBack = true;
    } else if (!selected && isAttacking) {
      if (punchHand === 'left') {
        const now = performance.now();
        const attackSpeed = getAttackSpeed();
        const attackDuration = attackSpeed * 1000;
        let attackProgress = (now - attackStartTime) / attackDuration;
        function bezier(t, p0, p1, p2) {
          return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
        }
        const startX = -handXOffset;
        const startY = handYOffset;
        const punchLength = attackRange - 10;
        const angleOffset = Math.PI / 18;
        const cosA = Math.cos(angleOffset);
        const sinA = Math.sin(angleOffset);
        let rawEndX = -player.size * 0.03;
        let rawEndY = -punchLength;
        let rawControlX = -handXOffset * 0.07;
        let rawControlY = -punchLength * 0.99;
        const endX = rawEndX * cosA - rawEndY * sinA;
        const endY = rawEndX * sinA + rawEndY * cosA;
        const controlX = rawControlX * cosA - rawControlY * sinA;
        const controlY = rawControlX * sinA + rawControlY * cosA;
        if (attackProgress <= 0.5) {
          const t = attackProgress / 0.5;
          localX = bezier(t, startX, controlX, endX);
          localY = bezier(t, startY, controlY, endY);
        } else {
          const t = (attackProgress - 0.5) / 0.5;
          localX = bezier(1 - t, startX, controlX, endX);
          localY = bezier(1 - t, startY, controlY, endY);
        }
      } else if (punchHand === 'right') {
        moveBack = true;
      }
    }
    if (moveBack) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      const attackProgress = Math.min((now - attackStartTime) / attackDuration, 1);
      const backAmount = player.size * 0.25 * Math.sin(Math.PI * attackProgress);
      localX = -handXOffset - backAmount;
      localY = handYOffset + backAmount * 0.5;
    }
    ctx.translate(localX, localY);
    ctx.drawImage(
      handImage,
      -handImage.width / 2 * handScale,
      -handImage.height / 2 * handScale,
      handImage.width * handScale,
      handImage.height * handScale
    );
    ctx.restore();
  }

  // Draw right hand with item/tool
  if (handImageLoaded) {
    const handScale = player.size / 32;
    let handXOffset = player.size * 0.8;
    let handYOffset = -player.size * 0.55;
    let handAngle = Math.PI / 8;
    const selected = hotbar && hotbar.selectedIndex !== null ? hotbar.slots[hotbar.selectedIndex] : null;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.facingAngle + Math.PI / 2);
    ctx.rotate(handAngle);
    let localX = handXOffset;
    let localY = handYOffset;
    let animate = false;
    let counterMove = false;
    if (selected && ItemTypes[selected.type] && isAttacking) {
      animate = true;
    } else if (!selected && isAttacking) {
      if (punchHand === 'right') animate = true;
      if (punchHand === 'left') counterMove = true;
    }
    if (animate) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      let attackProgress = (now - attackStartTime) / attackDuration;
      function bezier(t, p0, p1, p2) {
        return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
      }
      const startX = handXOffset;
      const startY = handYOffset;
      const punchLength = attackRange - 10;
      const angleOffset = -Math.PI / 18;
      const cosA = Math.cos(angleOffset);
      const sinA = Math.sin(angleOffset);
      let rawEndX = player.size * 0.03;
      let rawEndY = -punchLength;
      let rawControlX = handXOffset * 0.07;
      let rawControlY = -punchLength * 0.99;
      const endX = rawEndX * cosA - rawEndY * sinA;
      const endY = rawEndX * sinA + rawEndY * cosA;
      const controlX = rawControlX * cosA - rawControlY * sinA;
      const controlY = rawControlX * sinA + rawControlY * cosA;
      if (attackProgress <= 0.5) {
        const t = attackProgress / 0.5;
        localX = bezier(t, startX, controlX, endX);
        localY = bezier(t, startY, controlY, endY);
      } else {
        const t = (attackProgress - 0.5) / 0.5;
        localX = bezier(1 - t, startX, controlX, endX);
        localY = bezier(1 - t, startY, controlY, endY);
      }
    } else if (counterMove) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      const attackProgress = Math.min((now - attackStartTime) / attackDuration, 1);
      const backAmount = player.size * 0.25 * Math.sin(Math.PI * attackProgress);
      localX = handXOffset + backAmount;
      localY = handYOffset + backAmount * 0.5;
    }
    ctx.translate(localX, localY);
    if (selected && ItemTypes[selected.type]) {
      const toolImage = toolImages[selected.type];
      const resourceImage = resourceImages[selected.type];

      if (ItemTypes[selected.type].isTool && toolImage && toolImage.complete) {
        const scale = 1;
        const imgWidth = toolImage.width * scale;
        const imgHeight = toolImage.height * scale;
        ctx.save();
        let toolAngle = Math.PI * 1.5 + Math.PI / 8;
        if (isAttacking) {
          const now = performance.now();
          const attackSpeed = getAttackSpeed();
          const attackDuration = attackSpeed * 1000;
          let attackProgress = (now - attackStartTime) / attackDuration;
          if (attackProgress > 1) attackProgress = 1;
          toolAngle -= (Math.PI / 2) * (1 - attackProgress);
        }
        ctx.rotate(toolAngle);
        const toolOffsetX = 10;
        const toolOffsetY = 6;
        ctx.translate(toolOffsetX, toolOffsetY);
        ctx.drawImage(
          toolImage,
          -imgWidth / 2,
          -imgHeight,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else if (resourceImage && resourceImage.complete) {
          const scale = 1;
          const imgWidth = resourceImage.width * scale;
          const imgHeight = resourceImage.height * scale;
          ctx.save();
          ctx.rotate((Math.PI * 2) - Math.PI/8);
          ctx.translate(0, -12);
          ctx.drawImage(
            resourceImage,
            -imgWidth / 2,
            -imgHeight / 2,
            imgWidth,
            imgHeight
          );
          ctx.restore();
      } else {
        ctx.save();
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = ItemTypes[selected.type].color || 'gray';
        ctx.fillRect(-6, -24, 12, 48);
        ctx.restore();
      }
    }
    ctx.drawImage(
      handImage,
      -handImage.width / 2 * handScale,
      -handImage.height / 2 * handScale,
      handImage.width * handScale,
      handImage.height * handScale
    );
    ctx.restore();
  }
}

