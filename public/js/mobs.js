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
    mob.health = health;
    if (health <= 0) {
      mob.size = 0;
      mob.respawnTimer = mob.respawnTime;
    }
  }
});

let showMobData = false;
function drawMob() {
  const now = performance.now();
  
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      if (!mob.interpolated) {
        mob.interpolated = { x: mob.x, y: mob.y, targetX: mob.x, targetY: mob.y, time: now };
      }

      // Interpolate position
      const interpDuration = 200;
      const t = Math.min((now - mob.interpolated.time) / interpDuration, 1);
      const displayX = mob.interpolated.x + (mob.interpolated.targetX - mob.interpolated.x) * t;
      const displayY = mob.interpolated.y + (mob.interpolated.targetY - mob.interpolated.y) * t;

      if (mob.health > 0) {
        if (mobtype[mob.type].isAggressive) {
          const aggroRadius = mobtype[mob.type].aggroRadius;
          const escapeRadius = mobtype[mob.type].escapeRadius;
          const centerX = displayX + mob.size / 2;
          const centerY = displayY + mob.size / 2;
          
          
          if (showMobData) {
            // Draw aggro radius (red circle)
            ctx.beginPath();
            ctx.arc(centerX, centerY, aggroRadius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
            ctx.stroke();
            
            // Draw escape radius (blue circle)
            ctx.beginPath();
            ctx.arc(centerX, centerY, escapeRadius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 0, 255, 0.5)";
            ctx.stroke();
            // Draw threat table
            if (mob.threatTable && Object.keys(mob.threatTable).length > 0) {
              const sortedThreats = Object.entries(mob.threatTable)
                .sort(([, a], [, b]) => b - a); // Sort by threat descending
              let textLines = sortedThreats.map(([name, threat]) => `${name}: ${Math.floor(threat)}`);
              if (mob.targetPlayerId) {
                // Find the name of the targeted player
                const targetName = Object.entries(otherPlayers).find(
                  ([id, p]) => id === mob.targetPlayerId
                )?.[1].name || (player && player.id === mob.targetPlayerId ? player.name : 'Unknown');
                textLines = textLines.map(line => 
                  line.startsWith(targetName) ? `>${line}` : line
                );
              }
              const fontSize = 12;
              ctx.font = `${fontSize}px Arial`;
              ctx.fillStyle = "white";
              ctx.strokeStyle = "black";
              ctx.lineWidth = 1;
              const x = mob.x;
              let y = mob.y - 10; // Start above health bar
              for (const line of textLines) {
                ctx.strokeText(line, x, y);
                ctx.fillText(line, x, y);
                y -= fontSize + 2; // Move up for next line
              }
            }

          }
        }
      
        const coneLength = 40;
        const centerX = displayX + mob.size / 2;
        const centerY = displayY + mob.size / 2;
        const coneX = centerX + Math.cos(mob.facingAngle) * coneLength;
        const coneY = centerY + Math.sin(mob.facingAngle) * coneLength;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(coneX, coneY);
        ctx.stroke();
        // Draw mob
        ctx.fillStyle = mobtype[mob.type].color || "gray";
        ctx.fillRect(displayX, displayY, mob.size, mob.size);

        //draw border around mob
        ctx.strokeStyle = "red";
        ctx.strokeRect(displayX, displayY, mob.size, mob.size);        // Draw health bar if recently hit
        if (mob.lastHitTime && now - mob.lastHitTime < 1000) {
          drawHealthBar({ ...mob, x: displayX, y: displayY });
        }
      }
    }
  }
}

function drawHealthBar(mob) {
  const config = mobtype[mob.type];
  if (!config || !mob.maxHealth) return;

  const hpPercent = Math.max(mob.health / mob.maxHealth, 0);
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

  const coneLength = CONE_LENGTH + 20;
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
        mob.health -= damage;
        lastStaminaUseTime = 0;
        const cost = 10;
        if (stamina < cost) {
          showMessage("Low Stamina");
          return;
        }
        stamina -= cost;
        socket.emit("mobhit", {
          type,
          id: mob.id, 
          newHealth: mob.health,
        });
        showDamageText(mobX, mobY, -damage);
        mob.lastHitTime = performance.now(); 

        return; 
      }
    }
  }
}

