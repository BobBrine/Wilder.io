let ItemTypes = {
  hand: {
    name: "Hand",
    color: "peachpuff",
    isTool: true,
    attackRange: 50,
    attackSpeed: 0.5,
    damage: 1,
    category: 'hand',
    tier: 0
  },

  // Axes
  wooden_axe: {
    name: "Wooden Axe",
    color: "sienna",
    isTool: true,
    category: "axe",
    tier: 1,
    damage: 3,
    attackRange: 70,
    attackSpeed: 0.45
  },
  stone_axe: {
    name: "Stone Axe",
    color: "darkgray",
    isTool: true,
    category: "axe",
    tier: 2,
    damage: 5,
    attackRange: 70,
    attackSpeed: 0.45
  },
  iron_axe: {
    name: "Iron Axe",
    color: "white",
    isTool: true,
    category: "axe",
    tier: 3,
    damage: 7,
    attackRange: 70,
    attackSpeed: 0.45
  },
  gold_axe: {
    name: "Gold Axe",
    color: "gold",
    isTool: true,
    category: "axe",
    tier: 4,
    damage: 10,
    attackRange: 70,
    attackSpeed: 0.45
  },

  // Pickaxes
  wooden_pickaxe: {
    name: "Wooden Pickaxe",
    color: "sienna",
    isTool: true,
    category: "pickaxe",
    tier: 1,
    damage: 3,
    attackRange: 70,
    attackSpeed: 0.45
  },
  stone_pickaxe: {
    name: "Stone Pickaxe",
    color: "darkgray",
    isTool: true,
    category: "pickaxe",
    tier: 2,
    damage: 5,
    attackRange: 70,
    attackSpeed: 0.45
  },
  iron_pickaxe: {
    name: "Iron Pickaxe",
    color: "white",
    isTool: true,
    category: "pickaxe",
    tier: 3,
    damage: 7,
    attackRange: 70,
    attackSpeed: 0.45
  },
  gold_pickaxe: {
    name: "Gold Pickaxe",
    color: "gold",
    isTool: true,
    category: "pickaxe",
    tier: 4,
    damage: 10,
    attackRange: 70,
    attackSpeed: 0.45
  },

  // Swords
  wooden_sword: {
    name: "Wooden Sword",
    color: "sienna",
    isTool: true,
    category: "sword",
    tier: 1,
    damage: 10,
    attackRange: 70,
    attackSpeed: 0.45
  },
  stone_sword: {
    name: "Stone Sword",
    color: "darkgray",
    isTool: true,
    category: "sword",
    tier: 2,
    damage: 15,
    attackRange: 70,
    attackSpeed: 0.45
  },
  iron_sword: {
    name: "Iron Sword",
    color: "white",
    isTool: true,
    category: "sword",
    tier: 3,
    damage: 20,
    attackRange: 70,
    attackSpeed: 0.45
  },
  gold_sword: {
    name: "Gold Sword",
    color: "gold",
    isTool: true,
    category: "sword",
    tier: 4,
    damage: 25,
    attackRange: 70,
    attackSpeed: 0.45
  },
  wooden_hammer: {
    name: "Wooden Hammer",
    color: "sienna",
    isTool: true,
    category: "hammer",
    tier: 1,
    damage: 25,
    attackRange: 70,
    attackSpeed: 0.45
  },

  // Special Items
  torch: {
    name: "Torch",
    color: "yellow",
    isTool: true,
    attackRange: 50,
    attackSpeed: 0,
    damage: 1,
    category: 'hand',
    tier: 0
  },

  // Consumables
  wood: { name: "Wood", color: "green", attackSpeed: 0.5 },
  stone: { name: "Stone", color: "darkgray", attackSpeed: 0.5 },
  iron: { name: "Iron", color: "white", attackSpeed: 0.5 },
  gold: { name: "Gold", color: "gold", attackSpeed: 0.5 },
  food: { name: "Food", color: "red", attackSpeed: 0.5 },
  pure_core: { name: "Pure Core", color: "pink", attackSpeed: 0.5 },
  dark_core: { name: "Dark Core", color: "white", attackSpeed: 0.5 },
  mythic_core: { name: "Mythic Core", color: "yellow", attackSpeed: 0.5 },
  health_potion: { name: "Health Potion", color: "red", attackSpeed: 0.5 },
  strength_potion: { name: "Strength Potion", color: "orange", attackSpeed: 0.5 },
  mythic_potion: { name: "Mythic Potion", color: "purple", attackSpeed: 0.5 },
  crafting_table: { name: "Crafting Table", color: "brown", attackSpeed: 0.5 },
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
// Ensure hotbar is globally accessible in singleplayer
try { window.hotbar = hotbar; } catch(_) {}

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
  try { window.hotbar = hotbar; } catch(_) {}
  // If nothing is selected but there are items, select the first item for immediate usability
  if (hotbar.selectedIndex == null) {
    const idx = hotbar.slots.findIndex(Boolean);
    if (idx !== -1) hotbar.selectedIndex = idx;
  }
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
  'wooden_sword': swordImage,
  'stone_sword': stone_sword_Image,
  'iron_sword': iron_sword_Image,
  'gold_sword': gold_sword_Image,
  'wooden_pickaxe': wooden_pickaxe_Image,
  'stone_pickaxe': stone_pickaxe_Image,
  'iron_pickaxe': iron_pickaxe_Image,
  'gold_pickaxe': gold_pickaxe_Image,
  'wooden_axe': wooden_axe_Image,
  'stone_axe': stone_axe_Image,
  'iron_axe': iron_axe_Image,
  'gold_axe': gold_axe_Image,
  'torch': torchImage,
  'wooden_hammer': wooden_hammer_Image,
};

const healthPotionImage = new Image();
 healthPotionImage.src = '../images/health_potion.png';
const strengthPotionImage = new Image();
 strengthPotionImage.src = '../images/attack_potion.png';
const mythicPotionImage = new Image();
 mythicPotionImage.src = '../images/Raindom_potion.png';

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

// Expose image maps globally so UI render can reuse the exact same images
window.toolImages = window.toolImages || toolImages;
window.resourceImages = window.resourceImages || resourceImages;

// Ensure drop timing defaults exist early (items.js loads before main/network)
if (typeof window.DROP_DESPAWN_LIFETIME_SEC !== 'number') window.DROP_DESPAWN_LIFETIME_SEC = 60;
if (typeof window.DROP_BLINK_START_SEC !== 'number') window.DROP_BLINK_START_SEC = 30;
if (typeof window.DROP_BLINK_MAX_HZ !== 'number') window.DROP_BLINK_MAX_HZ = 4;

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
    if (selected && ItemTypes[selected.type] && player.isAttacking) {
      moveBack = true;
    } else if (!selected && player.isAttacking) {
      if (punchHand === 'left') {
        const now = performance.now();
        const attackSpeed = getAttackSpeed();
        const attackDuration = attackSpeed * 1000;
        let attackProgress = (now - (player.attackStartTime || 0)) / attackDuration;
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
      let attackProgress = (now - (player.attackStartTime || 0)) / attackDuration;
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
    if (selected && ItemTypes[selected.type] && player?.isAttacking) {
      animate = true;
    } else if (!selected && player?.isAttacking) {
      if (punchHand === 'right') animate = true;
      if (punchHand === 'left') counterMove = true;
    }
    if (animate) {
      const now = performance.now();
      const attackSpeed = getAttackSpeed();
      const attackDuration = attackSpeed * 1000;
      let attackProgress = (now - (player.attackStartTime || 0)) / attackDuration;
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
      let attackProgress = (now - (player.attackStartTime || 0)) / attackDuration;
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
          let attackProgress = (now - (player.attackStartTime || 0)) / attackDuration;
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


// Draw dropped items with 60s lifetime and last-30s blinking
// - Normalizes any item missing lifetime fields (createdAt, lifetimeSec, expireAt)
// - Prunes expired items
// - Blinking starts when remaining <= 30s and ramps frequency up to a capped max
function drawDroppedItems() {
  try {
    if (!Array.isArray(window.droppedItems) || window.droppedItems.length === 0) return;
    const nowSec = performance.now() / 1000;

    // Local defaults in case other scripts don't define constants
  const LIFETIME_SEC = (typeof window.DROP_DESPAWN_LIFETIME_SEC === 'number') ? window.DROP_DESPAWN_LIFETIME_SEC : 60;
  const BLINK_START_SEC = (typeof window.DROP_BLINK_START_SEC === 'number') ? window.DROP_BLINK_START_SEC : 30;
  const BLINK_MAX_HZ = (typeof window.DROP_BLINK_MAX_HZ === 'number') ? window.DROP_BLINK_MAX_HZ : 8; // cap
  const BASE_BLINK_HZ = 1; // production base blink

    // Normalize + prune first to avoid drawing expired
    const next = [];
    for (let i = 0; i < window.droppedItems.length; i++) {
      const it = window.droppedItems[i];
      if (!it) continue;
      // Attach lifetime metadata if missing
      if (typeof it.expireAt !== 'number') {
        const lifetime = Number.isFinite(it.lifetimeSec) ? it.lifetimeSec : LIFETIME_SEC;
        it.lifetimeSec = lifetime;
        it.createdAt = (typeof it.createdAt === 'number') ? it.createdAt : nowSec;
        it.expireAt = (typeof it.expireAt === 'number') ? it.expireAt : (it.createdAt + lifetime);
      }
      // Prune expired
      const remaining = it.expireAt - nowSec;
      if (remaining > 0) next.push(it);
    }
    window.droppedItems = next;
    if (window.droppedItems.length === 0) return;

    // Draw
    for (let i = 0; i < window.droppedItems.length; i++) {
      const it = window.droppedItems[i];
      if (!it) continue;
      const remaining = Math.max(0, it.expireAt - nowSec);
      // Reset dbg fields each frame
      it.__dbgBlinkHz = null;
      it.__dbgBlinking = false;

      // Blinking logic
      let visible = true;
      // Always show for a short grace period after spawn so it doesn't look like it vanished
      const timeSinceSpawn = (typeof it.createdAt === 'number') ? (nowSec - it.createdAt) : Infinity;
      if (timeSinceSpawn < 0.5) {
        visible = true;
      } else if (remaining <= BLINK_START_SEC) {
  // Step the blink speed across the entire blink window for a clearly visible acceleration
  // Quartiles of remaining time in the blink window: 100%-75% -> 1Hz, 75%-50% -> 2Hz, 50%-25% -> 3Hz, 25%-0% -> 4Hz
        const q75 = 0.75 * BLINK_START_SEC;
        const q50 = 0.50 * BLINK_START_SEC;
        const q25 = 0.25 * BLINK_START_SEC;
  let hz;
  if (remaining > q75) hz = 1;
  else if (remaining > q50) hz = 2;
  else if (remaining > q25) hz = 3;
  else hz = 4;
  hz = Math.min(BLINK_MAX_HZ, Math.max(BASE_BLINK_HZ, hz));
        const period = 1 / Math.max(0.001, hz);
        const timeBase = Number.isFinite(timeSinceSpawn) ? timeSinceSpawn : (nowSec);
        const phase = (timeBase % period) / period; // 0..1
        visible = phase < 0.5; // strict on/off for clear blinking
        // Store for debug overlay
        it.__dbgBlinkHz = hz;
        it.__dbgBlinking = true;
      }
      // Debug overlay: show entity state when debug mode is on (always show, even when not visible)
      try {
        const debugOn = (typeof showData !== 'undefined') ? showData : !!window.showData;
        if (debugOn) {
          const remStr = remaining.toFixed(1) + 's';
          const pdStr = (typeof it.pickupDelay === 'number' ? Math.max(0, it.pickupDelay).toFixed(1) + 's' : 'n/a');
          const hzStr = (typeof it.__dbgBlinkHz === 'number' ? it.__dbgBlinkHz.toFixed(1) + 'Hz' : '-');
          const idStr = (typeof it.id !== 'undefined' ? String(it.id) : '?');
          const stateStr = it.__dbgBlinking ? (visible ? 'BLINK:ON' : 'BLINK:OFF') : 'STEADY';
          const label = `id:${idStr} amt:${it.amount} t:${remStr} pd:${pdStr} hz:${hzStr} ${stateStr}`;
          ctx.save();
          ctx.font = "12px 'VT323', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const textW = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(it.x - (textW/2) - 6, it.y + 14, textW + 12, 16);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, it.x, it.y + 16);
          ctx.restore();
        }
      } catch (_) {}

      if (!visible) continue;

      // Pick the best image for this type
      const type = it.type;
      let img = (window.resourceImages && window.resourceImages[type]) || (window.toolImages && window.toolImages[type]) || null;

      // Draw centered at (x, y); if no image, draw a simple fallback
      if (img && img.complete && img.naturalWidth > 0) {
        const imgW = img.width;
        const imgH = img.height;
        // Optional: slight alpha pulse during blinking
        ctx.save();
        if (remaining <= BLINK_START_SEC) {
          ctx.globalAlpha = 0.9;
        }
        ctx.drawImage(img, it.x - imgW / 2, it.y - imgH / 2);
        ctx.restore();
      } else {
        // Fallback: colored square based on type
        ctx.save();
        ctx.fillStyle = (ItemTypes[type] && ItemTypes[type].color) || '#ccc';
        const s = 16;
        ctx.fillRect(it.x - s / 2, it.y - s / 2, s, s);
        ctx.restore();
      }

      // (debug overlay drawn above)
    }
  } catch (e) {
    // Avoid throwing from render path
    console.warn('drawDroppedItems error', e);
  }
}

// Update dropped items each frame regardless of player/spectator state
function updateDroppedItems(deltaTime) {
  try {
    if (!Array.isArray(window.droppedItems) || window.droppedItems.length === 0) return;
    const nowSec = performance.now() / 1000;
    const LIFETIME_SEC = (typeof window.DROP_DESPAWN_LIFETIME_SEC === 'number') ? window.DROP_DESPAWN_LIFETIME_SEC : 60;
    const next = [];
    for (let i = 0; i < window.droppedItems.length; i++) {
      const it = window.droppedItems[i];
      if (!it) continue;
      // Normalize lifetime
      if (typeof it.expireAt !== 'number') {
        const lifetime = Number.isFinite(it.lifetimeSec) ? it.lifetimeSec : LIFETIME_SEC;
        it.lifetimeSec = lifetime;
        it.createdAt = (typeof it.createdAt === 'number') ? it.createdAt : nowSec;
        it.expireAt = (typeof it.expireAt === 'number') ? it.expireAt : (it.createdAt + lifetime);
      }
      // Offline: tick pickupDelay
      if (!window.socket || !socket.connected) {
        if (typeof it.pickupDelay === 'number' && it.pickupDelay > 0) {
          it.pickupDelay = Math.max(0, it.pickupDelay - (deltaTime || 0));
        }
      }
      if ((it.expireAt - nowSec) > 0) next.push(it);
    }
    window.droppedItems = next;
  } catch (e) {
    console.warn('updateDroppedItems error', e);
  }
}

// Ensure global exposure so main.js can call these regardless of scope quirks
try {
  window.drawDroppedItems = drawDroppedItems;
  window.updateDroppedItems = updateDroppedItems;
  window.__drawDroppedItemsBlink = drawDroppedItems; // stable alias for delegations
} catch (_) {}

