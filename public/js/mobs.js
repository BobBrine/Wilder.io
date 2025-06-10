let mobtype ={};

let mobs = {}; // mobId -> { x, y, type, etc. }

let mobloaded = false;

function getMobArrayByType(type) {
  return mobs[type] || [];
}


socket.on("updateMobHealth", ({ id, type, health }) => {
  const list = getMobArrayByType(type);
  const mob = list.find(r => r.id === id);
  if (mob) {
    mob.hp = health;
    if (health <= 0) {
      mob.size = 0;
      mob.respawnTimer = mob.respawnTime;
    }
  }
});


function drawMob() {
  const now = Date.now();
  
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      if (mob.size > 0) {
        if (mobtype[mob.type].isAggressive) {
          const aggroRadius = mobtype[mob.type].aggroRadius;
          const escapeRadius = mobtype[mob.type].escapeRadius;
          const centerX = mob.x + mob.size / 2;
          const centerY = mob.y + mob.size / 2;
          
          // Draw aggro radius (red circle)
          ctx.beginPath();
          ctx.arc(centerX, centerY, aggroRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; // Semi-transparent red
          ctx.stroke();
          
          // Draw escape radius (blue circle)
          ctx.beginPath();
          ctx.arc(centerX, centerY, escapeRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 0, 255, 0.5)"; // Semi-transparent blue
          ctx.stroke();
        }
      
        const coneLength = 40;
        const centerX = mob.x + mob.size / 2;
        const centerY = mob.y + mob.size / 2;
        const coneX = centerX + Math.cos(mob.facingAngle) * coneLength;
        const coneY = centerY + Math.sin(mob.facingAngle) * coneLength;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(coneX, coneY);
        ctx.stroke();
        // Draw mob
        ctx.fillStyle = mobtype[mob.type].color || "gray";
        ctx.fillRect(mob.x, mob.y, mob.size, mob.size);

        // Draw health bar if recently hit
        if (mob.lastHitTime && now - mob.lastHitTime < 1000) {
          drawHealthBar(mob);
        }
      }
    }
  }
}

function drawHealthBar(mob) {
  const config = mobtype[mob.type];
  if (!config || !mob.maxHealth) return;

  const hpPercent = Math.max(mob.hp / mob.maxHealth, 0);
  const barWidth = mob.size;
  const barHeight = 5;
  const padding = 2;

  const x = mob.x;
  const y = mob.y - barHeight - padding;

  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth , barHeight);

  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
}




function tryHitMob() {
  if (!player) return; // safety check

  const coneLength = CONE_LENGTH;
  const coneAngle = Math.PI / 4;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";

  if (!toolDamage[selectedTool]) {
    selectedTool = "hand";
  }

  for (const [type, config] of Object.entries(mobtype)) {
    const list = getMobArrayByType(type); 
    for (const mob of list) {
        const mobX = mob.x + mob.size / 2;
        const mobY = mob.y + mob.size / 2;


      if (
        mob.size > 0 &&
        pointInCone(mobX, mobY, centerX, centerY, player.facingAngle, coneAngle, coneLength)
      ) {
        // Check if tool is valid
        if (!config.tools.includes(selectedTool)) {
          showMessage("This tool is not effective.");
          return;
        }
        const damage = toolDamage[selectedTool] || toolDamage.hand;
        mob.hp -= damage;
        socket.emit("mobhit", {
          type,
          id: mob.id, 
          newHealth: mob.hp,
        });
        showDamageText(mobX, mobY, damage);
        mob.lastHitTime = Date.now(); 

        return; 
      }
    }
  }
}

