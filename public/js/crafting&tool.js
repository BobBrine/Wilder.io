const toolDamage = {
  hand: 1, // Default if no tool

  // Wooden tools
  wooden_axe: 5,
  wooden_pickaxe: 5,
  wooden_sword: 5,
  // Stone tools (x2 = 10)
  stone_axe: 10,
  stone_pickaxe: 10,
  stone_sword: 10,

  // Iron tools (x2 = 20)
  iron_axe: 20,
  iron_pickaxe: 20,
  iron_sword: 20,

  // Gold tools (x2 = 40)
  gold_axe: 40,
  gold_pickaxe: 40,
  gold_sword: 40,
};

const recipes = [
  {
    name: "Torch",
    cost: { wood: 5 },
    output: { type: "torch", count: 1 },
    itemColor: "yellow"
  },
  // Wooden tools
  {
    name: "Wooden Axe",
    cost: { wood: 12 },
    output: { type: "wooden_axe", count: 1 },
    itemColor: "sienna"
  },
  {
    name: "Wooden Sword",
    cost: { wood: 15 },
    output: { type: "wooden_sword", count: 1 },
    itemColor: "sienna"
  },
  {
    name: "Wooden Pick",
    cost: { wood: 15 },
    output: { type: "wooden_pickaxe", count: 1 },
    itemColor: "sienna"
  },

  // Stone tools
  {
    name: "Stone Axe",
    cost: { wood: 24, stone: 15 },
    output: { type: "stone_axe", count: 1 },
    itemColor: "darkgray"
  },
  {
    name: "Stone Sword",
    cost: { wood: 24, stone: 20 },
    output: { type: "stone_sword", count: 1 },
    itemColor: "darkgray"
  },
  {
    name: "Stone Pick",
    cost: { wood: 24, stone: 20 },
    output: { type: "stone_pickaxe", count: 1 },
    itemColor: "darkgray"
  },

  // Iron tools
  {
    name: "Iron Axe",
    cost: { wood: 36, iron: 15 },
    output: { type: "iron_axe", count: 1 },
    itemColor: "white"
  },
  {
    name: "Iron Sword",
    cost: { wood: 36, iron: 20 },
    output: { type: "iron_sword", count: 1 },
    itemColor: "white"
  },
  {
    name: "Iron Pick",
    cost: { wood: 36, iron: 20 },
    output: { type: "iron_pickaxe", count: 1 },
    itemColor: "white"
  },

  // Gold tools
  {
    name: "Gold Axe",
    cost: { wood: 50, gold: 15 },
    output: { type: "gold_axe", count: 1 },
    itemColor: "gold"
  },
  {
    name: "Gold Sword",
    cost: { wood: 50, gold: 20 },
    output: { type: "gold_sword", count: 1 },
    itemColor: "gold"
  },
  {
    name: "Gold Pick",
    cost: { wood: 50, gold: 20 },
    output: { type: "gold_pickaxe", count: 1 },
    itemColor: "gold"
  }
];



function canCraft(recipe) {
  const required = recipe.cost;
  // Use inventory.hasItem to check if enough resources
  return Object.keys(required).every(key => inventory.hasItem(key, required[key]));
}

function craftItem(recipe) {
  if (!canCraft(recipe)) return false;
  
  const output = recipe.output;
  const currentTypes = Object.keys(inventory).filter(key => typeof inventory[key] === "number").length;
  const removedTypes = Object.keys(recipe.cost).filter(key => inventory[key] === recipe.cost[key]).length;
  const willAddNewType = !inventory[output.type];

  const typesAfterCrafting = currentTypes - removedTypes + (willAddNewType ? 1 : 0);

  if (typesAfterCrafting > 12) {
    showMessage("Inventory full! Cannot craft item.");
    return false;
  }
  // Deduct cost using inventory.removeItem
  for (const key in recipe.cost) {
    inventory.removeItem(key, recipe.cost[key]);
  }

  // Add crafted item using inventory.addItem
  inventory.addItem(output.type, output.count);

  return true;
}
