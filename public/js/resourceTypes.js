// public/resourceTypes.js
let resourceTypes = {
};


let allResources = {};

let resourcesLoaded = false;

function checkOverlap(x1, y1, size1, x2, y2, size2) {
  return x1 < x2 + size2 && x1 + size1 > x2 && y1 < y2 + size2 && y1 + size1 > y2;
}

function getResourceArrayByType(type) {
  return allResources[type] || [];
}

function isCollidingWithResources(newX, newY, size = player.size) {
  const all = Object.values(allResources).flat();
  return all.some(resource =>
    resource.size > 0 &&
    checkOverlap(newX, newY, size, resource.x, resource.y, resource.size)
  );
}



function hitResourceInCone() {
  if (!player) return false;
  const coneLength = CONE_LENGTH + 20;
  const coneAngle = Math.PI / 4;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  


    const selected = hotbar.slots[hotbar.selectedIndex];
    let selectedTool = selected?.type || "hand";

    // If the selected item is NOT a valid tool, treat it as "hand"
    if (!toolDamage[selectedTool]) {
      selectedTool = "hand";
    }

  for (const [type, config] of Object.entries(resourceTypes)) {
    const list = getResourceArrayByType(type); // trees, rocks, etc.

    for (const resource of list) {
      const rx = resource.x + resource.size / 2;
      const ry = resource.y + resource.size / 2;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 255, 255, 0.92)';
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();

      if (
        resource.size > 0 &&
        pointInCone(rx, ry, centerX, centerY, player.facingAngle, coneAngle, coneLength)
      ) {
        // Check if tool is valid
        if (!config.tools.includes(selectedTool)) {
          showMessage("This tool is not effective.");
          return;
        }
        const damage = toolDamage[selectedTool] || toolDamage.hand;
        resource.health -= damage;
        lastStaminaUseTime = 0;
        const cost = 2;
        if (stamina < cost) {
          showMessage("Low Stamina");
          return;
        }
        stamina -= cost;
        socket.emit("resourceHit", {
          type,
          id: resource.id, // ensure resources have a unique id
          newHealth: resource.health,
        });

        //console.log(resource.health);
        //damage to resources
        showDamageText(rx, ry, -damage);
        if (resource.health <= 0) {
          resource.size = 0;
          resource.respawnTimer = resource.respawnTime; 
        } 
        else {
          resource.lastHitTime = performance.now(); // NEW: track when it was hit
        }

        return; // only hit one resource
      }
    }
  }
}

function drawHealthBarR(resource) {
  const config = resourceTypes[resource.type];
  if (!config || !resource.maxHealth) return;
  const health = resource.health;
  const maxHealth = resource.maxHealth;
  const hpPercent = Math.max(health / maxHealth, 0);
  const barWidth = resource.size;
  const barHeight = 5;
  const padding = 2;

  const x = resource.x;
  const y = resource.y - barHeight - padding;

  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth , barHeight);

  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);

}

function tryHitResource() {
  const now = performance.now();
  if ((now - lastHitTime)/1000 >= hitDelay && stamina > 0) {
    lastHitTime = now;
    tryHitMob();
    hitResourceInCone();
    tryAttack();
  }
}

socket.on("updateResourceHealth", ({ id, type, health }) => {
  const list = getResourceArrayByType(type);
  const resource = list.find(r => r.id === id);
  if (resource) {
    resource.health = health;
    if (health <= 0) {
      resource.size = 0;
      resource.respawnTimer = resource.respawnTime;
    }
  }
});

function drawResources() {
  const now = performance.now();

  for (const resources of Object.values(allResources)) {
    for (const r of resources) {
      if (r.size > 0) {
        ctx.fillStyle = resourceTypes[r.type].color;
        ctx.fillRect(r.x, r.y, r.size, r.size);
        

        // Draw health bar if recently hit
        if (r.lastHitTime && now - r.lastHitTime < 1000) {
          drawHealthBarR(r);
        }
      }
    }
  }
  
}
