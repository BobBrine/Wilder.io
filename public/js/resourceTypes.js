let resourceTypes = {};
let allResources = {};
let resourcesLoaded = false;

function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
  return x1 < x2 + sizeX2 && x1 + sizeX1 > x2 && y1 < y2 + sizeY2 && y1 + sizeY1 > y2;
}

function getResourceArrayByType(type) {
  return allResources[type] || [];
}

function isCollidingWithResources(newX, newY, sizeX = player.size, sizeY = player.size) {
  const all = Object.values(allResources).flat();
  return all.some(resource => resource.sizeX > 0 && resource.sizeY > 0 && 
    checkOverlap(newX, newY, sizeX, sizeY, resource.x, resource.y, resource.sizeX, resource.sizeY));
}

function hitResourceInCone() {
  if (!player) return false;
  const coneLength = CONE_LENGTH;
  const coneAngle = ATTACK_ANGLE;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";
  const toolInfo = ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool ? ItemTypes[selectedTool] : { category: "hand", tier: 0, damage: 1 };
  for (const [type, config] of Object.entries(resourceTypes)) {
    const list = getResourceArrayByType(type);
    for (const resource of list) {
      const rx = resource.x;
      const ry = resource.y;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 255, 255, 0.92)';
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      if (resource.sizeX > 0 && resource.sizeY > 0 && isObjectInAttackCone(player, resource, coneLength, coneAngle)) {
        if (!config.requiredTool.categories.includes(toolInfo.category) || toolInfo.tier < config.requiredTool.minTier) {
          showMessage("This tool is not effective.");
          return;
        }
        const damage = toolInfo.damage;
        const cost = 2;
        if (stamina < cost) {
          showMessage("Low Stamina");
          return;
        }
        stamina -= cost;
        lastStaminaUseTime = 0;
        resource.health -= damage;
        socket.emit("resourceHit", { type, id: resource.id, newHealth: resource.health });
        showDamageText(rx, ry, -damage);
        if (resource.health <= 0) {
          resource.sizeX = 0;
          resource.sizeY = 0;
          resource.respawnTimer = resource.respawnTime;
        } else {
          resource.lastHitTime = performance.now();
        }
      }
    }
  }
}

function drawHealthBarR(resource) {
  const config = resourceTypes[resource.type];
  if (!config || !resource.maxHealth) return;
  const hpPercent = Math.max(resource.health / resource.maxHealth, 0);
  const barWidth = resource.sizeX;
  const barHeight = 5;
  const padding = 2;
  const x = resource.x;
  const y = resource.y - barHeight - padding;
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
}

function tryHitResource() {
  const now = performance.now();
  if ((now - lastHitTime) / 1000 >= hitDelay && stamina > 0) {
    lastHitTime = now;
    tryHitMob();
    hitResourceInCone();
    tryAttack();
    isAttacking = true;
    attackStartTime = now;
  }
}

socket.on("updateResourceHealth", ({ id, type, health }) => {
  const list = getResourceArrayByType(type);
  const resource = list.find(r => r.id === id);
  if (resource) {
    resource.health = health;
    if (health <= 0) {
      resource.sizeX = 0;
      resource.sizeY = 0;
      resource.respawnTimer = resource.respawnTime;
    }
  }
});

function drawResources() {
  const now = performance.now();
  const dotPositions = [
    {x: 0.15, y: 0.25},  // Top-left quarter
    {x: 0.5, y: 0.75},    // Center
    {x: 0.75, y: 0.25}   // Bottom-right quarter
  ];
  for (const resources of Object.values(allResources)) {
    for (const r of resources) {
      if (r.sizeX > 0 && r.sizeY > 0) {
        if (r.type == 'food'){
          // Draw main food resource rectangle
          ctx.fillStyle = resourceTypes[r.type].color;
          ctx.fillRect(r.x, r.y, r.sizeX, r.sizeY);
          
          ctx.fillStyle = '#0f0'; // Bright green
          const dotSize = 10;
          dotPositions.forEach(pos => {
            // Calculate absolute position within the food resource
            const dotX = r.x + pos.x * r.sizeX - dotSize/2;
            const dotY = r.y + pos.y * r.sizeY - dotSize/2;
            ctx.fillRect(dotX, dotY, dotSize, dotSize);
          });
        } else {
          ctx.fillStyle = resourceTypes[r.type].color;
          ctx.fillRect(r.x, r.y, r.sizeX, r.sizeY);
        }
        if (r.lastHitTime && now - r.lastHitTime < 1000) drawHealthBarR(r);
      }
    }
  }
}