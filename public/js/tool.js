// Load hand image
const handImage = new Image();
handImage.src = "/images/hand.png";
let handImageLoaded = false;
handImage.onload = () => {
  handImageLoaded = true;
};

// Load sword image
const swordImage = new Image();
swordImage.src = '/images/wooden_sword.png'; // Adjust path as needed
const stone_sword_Image = new Image();
stone_sword_Image.src = '/images/stone_sword.png';
const iron_sword_Image = new Image();
iron_sword_Image.src = '/images/iron_sword.png';
const gold_sword_Image = new Image();
gold_sword_Image.src = '/images/gold_sword.png';

// Load pickaxe image
const wooden_pickaxe_Image = new Image();
wooden_pickaxe_Image.src = '/images/wooden_pickaxe.png'; // Adjust path as needed
const stone_pickaxe_Image = new Image();
stone_pickaxe_Image.src = '/images/stone_pickaxe.png';
const iron_pickaxe_Image = new Image();
iron_pickaxe_Image.src = '/images/iron_pickaxe.png';
const gold_pickaxe_Image = new Image();
gold_pickaxe_Image.src = '/images/gold_pickaxe.png';

// Load axe image
const wooden_axe_Image = new Image();
wooden_axe_Image.src = '/images/wooden_axe.png'; // Adjust path as needed
const stone_axe_Image = new Image();
stone_axe_Image.src = '/images/stone_axe.png';
const iron_axe_Image = new Image();
iron_axe_Image.src = '/images/iron_axe.png';
const gold_axe_Image = new Image();
gold_axe_Image.src = '/images/gold_axe.png';

// Load wood image
const woodImage = new Image();
woodImage.src = '/images/wood.png'; // Adjust path as needed
let woodImageLoaded = false;
woodImage.onload = () => {
    woodImageLoaded = true;
};

// Load food image
const foodImage = new Image();
foodImage.src = '/images/food.png';
let foodImageLoaded = false;
foodImage.onload = () => {
    foodImageLoaded = true;
};

const torchImage = new Image();
torchImage.src = '/images/torch.png';
let torchImageLoaded = false;
torchImage.onload = () => {
    torchImageLoaded = true;
};

const stoneImage = new Image();
stoneImage.src = '/images/stone.png';
let stoneImageLoaded = false;
stoneImage.onload = () => {
    stoneImageLoaded = true;
};

const ironImage = new Image();
ironImage.src = '/images/iron.png';
const goldImage = new Image();
goldImage.src = '/images/gold.png';

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
};

const resourceImages = {
    'wood': woodImage,
    'stone': stoneImage,
    'iron': ironImage,
    'gold': goldImage,
    'food': foodImage,
    
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
    if (selected && isAttacking) {
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
