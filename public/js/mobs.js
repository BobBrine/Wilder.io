let mobtype = {};
let mobs = {};
let mobloaded = false;

function getMobArrayByType(type) {
  return mobs[type] || [];
}

socket.on("updateMobHealth", ({ id, type, health }) => {
  const list = getMobArrayByType(type);
  const mob = list.find(r => r.id === id);
  if (mob) {
    mob.health = health;
    console.log(mob.maxHealth);
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
      if (mob.health > 0) {
        if (mobtype[mob.type].isAggressive && showMobData) {
          const aggroRadius = mobtype[mob.type].aggroRadius;
          const escapeRadius = mobtype[mob.type].escapeRadius;
          const centerX = mob.x + mob.size / 2;
          const centerY = mob.y + mob.size / 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, aggroRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(centerX, centerY, escapeRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 0, 255, 0.5)";
          ctx.stroke();
          if (mob.threatTable && Object.keys(mob.threatTable).length > 0) {
            const sortedThreats = Object.entries(mob.threatTable).sort(([, a], [, b]) => b - a);
            let textLines = sortedThreats.map(([name, threat]) => `${name}: ${Math.floor(threat)}`);
            if (mob.targetPlayerId) {
              const targetName = Object.entries(otherPlayers).find(([id]) => id === mob.targetPlayerId)?.[1].name || 
                                (player && player.id === mob.targetPlayerId ? player.name : 'Unknown');
              textLines = textLines.map(line => line.startsWith(targetName) ? `>${line}` : line);
            }
            const fontSize = 12;
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = "white";
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            const x = mob.x;
            let y = mob.y - 10;
            for (const line of textLines) {
              ctx.strokeText(line, x, y);
              ctx.fillText(line, x, y);
              y -= fontSize + 2;
            }
          }
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
        ctx.fillStyle = mobtype[mob.type].color || "gray";
        ctx.fillRect(mob.x, mob.y, mob.size, mob.size);
        ctx.strokeStyle = "red";
        ctx.strokeRect(mob.x, mob.y, mob.size, mob.size);
        if (mob.lastHitTime && now - mob.lastHitTime < 1000) drawHealthBarM(mob);
      }
    }
  }
}

function drawHealthBarM(mob) {
  const config = mobtype[mob.type];
  if (!config || !mob.maxHealth) return;

  const hpPercent = Math.max(mob.health / mob.maxHealth, 0);
  const barWidth = mob.size;
  const barHeight = 5;
  const padding = 2;
  const x = mob.x;
  const y = mob.y - barHeight - padding;
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
}

function tryHitMob() {
  if (!player) return;
  const coneLength = CONE_LENGTH + 20;
  const coneAngle = Math.PI / 4;
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";
  const toolInfo = ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool ? ItemTypes[selectedTool] : { category: "hand", tier: 0, damage: 1 };
  for (const [type, config] of Object.entries(mobtype)) {
    const list = getMobArrayByType(type);
    for (const mob of list) {
      const mobX = mob.x + mob.size / 2;
      const mobY = mob.y + mob.size / 2;
      if (mob.size > 0 && pointInCone(mobX, mobY, centerX, centerY, player.facingAngle, coneAngle, coneLength)) {
        if (!config.requiredTool.categories.includes(toolInfo.category) || toolInfo.tier < config.requiredTool.minTier) {
          showMessage("This tool is not effective.");
          return;
        }
        const damage = toolInfo.damage;
        const cost = 10;
        if (stamina < cost) {
          showMessage("Low Stamina");
          return;
        }
        stamina -= cost;
        lastStaminaUseTime = 0;
        mob.health -= damage;
        
        socket.emit("mobhit", { type, id: mob.id, newHealth: mob.health });
        showDamageText(mobX, mobY, -damage);
        mob.lastHitTime = performance.now();
        return;
      }
    }
  }
}