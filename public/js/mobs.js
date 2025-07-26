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
function drawPolygon(ctx, x, y, size, sides, rotation = 0) {
  const angleStep = (Math.PI * 2) / sides;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep + rotation;
    const px = Math.round(x + Math.cos(angle) * size / 2);
    const py = Math.round(y + Math.sin(angle) * size / 2);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawStar(ctx, x, y, size, points = 5, innerRadiusRatio = 0.4) {
  const outerRadius = size / 2;
  const innerRadius = outerRadius * innerRadiusRatio;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const px = Math.round(x + Math.cos(angle) * radius);
    const py = Math.round(y + Math.sin(angle) * radius);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
function drawMob() {
  const now = performance.now();
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      if (mob.health > 0) {
        const coneLength = 40;
        const centerX = mob.x + mob.size / 2;
        const centerY = mob.y + mob.size / 2;
        const coneX = centerX + Math.cos(mob.facingAngle) * coneLength;
        const coneY = centerY + Math.sin(mob.facingAngle) * coneLength;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(coneX, coneY);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(mob.facingAngle);
        // Draw mob with appropriate shape
        const mobColor = mob.color || (mob.type === "special_mob" ? "white" : mob.type === "aggressive_mob" ? "red" : "green");
        ctx.fillStyle = mobColor;
        
        

        if (mob.type === "passive_mob") {
          ctx.strokeStyle = "white";
          // Circle doesn't need rotation (symmetric)
          ctx.beginPath();
          ctx.arc(0, 0, mob.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (mob.type === "aggressive_mob") {
          ctx.strokeStyle = "red";
          if (mob.profile === "speedster") {
            // Triangle (pointing right by default)
            ctx.beginPath();
            ctx.moveTo(mob.size/2, 0);
            ctx.lineTo(-mob.size/3, mob.size/2);
            ctx.lineTo(-mob.size/3, -mob.size/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();// Triangle (point up)
          } else if (mob.profile === "tank") {
            drawPolygon(ctx, 0, 0, mob.size, 6); // Hexagon
          } else if (mob.profile === "longRange") {
            drawPolygon(ctx, 0, 0, mob.size, 8); // Octagon
          } else {
            drawPolygon(ctx, 0, 0, mob.size * Math.SQRT2, 4, Math.PI/4); // Diamond
          }
        } else if (mob.type === "special_mob") {
          // Star with gradient
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, mob.size / 2);
          gradient.addColorStop(0, "white");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.5)");
          ctx.fillStyle = gradient;
          drawStar(ctx, 0, 0, mob.size);
        }
        ctx.lineWidth = 2;
        // Restore context to pre-rotation state
        ctx.restore();
        if (showMobData) {
          
          const aggroRadius = mobtype[mob.type].aggroRadius;
          const escapeRadius = mobtype[mob.type].escapeRadius;
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
          const hitRadius = mob.size / 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, hitRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; // Transparent white
          ctx.lineWidth = 1;
          ctx.stroke();
        }


        
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
  const coneLength = CONE_LENGTH; // 70
  const coneAngle = ATTACK_ANGLE; // 90 degrees

  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";
  const toolInfo = ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool ? ItemTypes[selectedTool] : { category: "hand", tier: 0, damage: 1 };

  for (const [type, config] of Object.entries(mobtype)) {
    const list = getMobArrayByType(type);
    for (const mob of list) {
      if (mob.size > 0) {
        if (isObjectInAttackCone(player, mob, coneLength, coneAngle)) {
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
          mob.health -= damage; // Optimistic update
          socket.emit("mobhit", { type, id: mob.id, newHealth: mob.health });
          showDamageText(mob.x + mob.size / 2, mob.y + mob.size / 2, -damage);
          mob.lastHitTime = performance.now();
          player.isAttacking = true;
          player.attackStartTime = performance.now();
          
        }
      }
    }
  }
}