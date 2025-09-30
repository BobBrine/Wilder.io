let ItemTypes = {
  // Basic hand
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
