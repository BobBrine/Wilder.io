let ItemTypes = {
  hand: { isTool: true, attackRange: 50, attackSpeed: 0.35, damage: 1, category: 'hand', tier: 0 },
  wooden_axe: { isTool: true, attackRange: 70, attackSpeed: 0.05, damage: 3, category: 'axe', tier: 1 },
  wooden_pickaxe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 3, category: 'pickaxe', tier: 1 },
  wooden_sword: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 99999999, category: 'sword', tier: 1 },
  stone_axe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 5, category: 'axe', tier: 2 },
  stone_pickaxe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 5, category: 'pickaxe', tier: 2 },
  stone_sword: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 7, category: 'sword', tier: 2 },
  iron_axe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 7, category: 'axe', tier: 3 },
  iron_pickaxe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 7, category: 'pickaxe', tier: 3 },
  iron_sword: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 10, category: 'sword', tier: 3 },
  gold_axe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 10, category: 'axe', tier: 4 },
  gold_pickaxe: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 10, category: 'pickaxe', tier: 4 },
  gold_sword: { isTool: true, attackRange: 70, attackSpeed: 0.35, damage: 15, category: 'sword', tier: 4 },
};

const recipes = [
  { name: "Torch", cost: { wood: 5 }, output: { type: "torch", count: 1 } },
  { name: "Wooden Axe", cost: { wood: 12 }, output: { type: "wooden_axe", count: 1 } },
  { name: "Wooden Sword", cost: { wood: 15 }, output: { type: "wooden_sword", count: 1 } },
  { name: "Wooden Pick", cost: { wood: 15 }, output: { type: "wooden_pickaxe", count: 1 } },
  { name: "Stone Axe", cost: { wood: 24, stone: 15, wooden_axe: 1 }, output: { type: "stone_axe", count: 1 } },
  { name: "Stone Sword", cost: { wood: 24, stone: 20, wooden_sword: 1 }, output: { type: "stone_sword", count: 1 } },
  { name: "Stone Pick", cost: { wood: 24, stone: 20, wooden_pickaxe: 1 }, output: { type: "stone_pickaxe", count: 1 } },
  { name: "Iron Axe", cost: { wood: 36, iron: 15, stone_axe: 1 }, output: { type: "iron_axe", count: 1 } },
  { name: "Iron Sword", cost: { wood: 36, iron: 20, stone_sword: 1 }, output: { type: "iron_sword", count: 1 } },
  { name: "Iron Pick", cost: { wood: 36, iron: 20, stone_pickaxe: 1 }, output: { type: "iron_pickaxe", count: 1 } },
  { name: "Gold Axe", cost: { wood: 50, gold: 15, iron_axe: 1 }, output: { type: "gold_axe", count: 1 } },
  { name: "Gold Sword", cost: { wood: 50, gold: 20, iron_sword: 1 }, output: { type: "gold_sword", count: 1 } },
  { name: "Gold Pick", cost: { wood: 50, gold: 20, iron_pickaxe: 1 }, output: { type: "gold_pickaxe", count: 1 } }
];

function canCraft(recipe) {
  const required = recipe.cost;
  return Object.keys(required).every(key => inventory.hasItem(key, required[key]));
}

function craftItem(recipe) {
  if (!canCraft(recipe)) {
    showMessage("Not enough resources to craft!");
    return false;
  }
  const output = recipe.output;
  if (!inventory.canAddItem(output.type)) {
    showMessage("Inventory full! Cannot craft item.");
    return false;
  }
  for (const [key, amount] of Object.entries(recipe.cost)) {
    inventory.removeItem(key, amount);
  }
  inventory.addItem(output.type, output.count);
  showMessage(`Crafted ${output.count} ${output.type}!`);
  return true;
}
