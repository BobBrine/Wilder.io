let mobtype = {};
let mobs = {};
let mobloaded = false;
let showData = false;

function getMobArrayByType(type) {
  return mobs[type] || [];
}

if (typeof socket !== "undefined" && socket) {
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
}

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
  ctx.save();
  const outerRadius = size / 2;
  const innerRadius = outerRadius * innerRadiusRatio;
  ctx.strokeStyle = "yellow";
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
  ctx.restore();
}
function drawMob() {
  // Force feet animation for all mobs for testing
  // Remove this line when you want real movement logic
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      mob.isMovingForward = true;
    }
  }
  const now = performance.now();
  // Interpolation tuning constants
  const INTERP_EXTRA_DELAY = 32; // increased delay for floatier glide (was 25)
  const MIN_BUFFER = 10; // slightly larger minimum
  const MAX_BUFFER = 55; // allow a bit more smoothing span
  const VELOCITY_BLEND = 0.08; // reduce forward lead so motion drifts smoothly
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      if (mob.health > 0) {
  // Client-side prediction removed to avoid double-push effect; server authoritative knockback only.
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  // Time-based interpolation between last and current server states
  if (mob._renderX === undefined) { mob._renderX = mob.x; mob._renderY = mob.y; }
  const nowMs = performance.now();
  const lastTime = mob._lastServerTime ?? nowMs;
  const curTime = mob._serverTime ?? nowMs;
  const rawDelta = curTime - lastTime;
  const serverDelta = Math.max(1, rawDelta); // ms
  // Dynamic buffer: proportional to serverDelta plus extra smoothing lag
  let buffer = serverDelta * 0.35 + INTERP_EXTRA_DELAY;
  buffer = Math.min(MAX_BUFFER, Math.max(MIN_BUFFER, buffer));
  const totalWindow = serverDelta + buffer; // interpolation window
  const elapsed = nowMs - curTime + buffer; // progress through window
  const interpT = Math.min(1, Math.max(0, elapsed / totalWindow));
  const fromX = mob._lastServerX !== undefined ? mob._lastServerX : mob.x;
  const fromY = mob._lastServerY !== undefined ? mob._lastServerY : mob.y;
  const toX = mob._serverX !== undefined ? mob._serverX : mob.x;
  const toY = mob._serverY !== undefined ? mob._serverY : mob.y;
  // Smooth ease (quintic) for very soft edges
  const ease = (() => { const a = interpT; return a * a * a * (a * (6 * a - 15) + 10); })();
  let targetX = fromX + (toX - fromX) * ease;
  let targetY = fromY + (toY - fromY) * ease;
  // Velocity blending: approximate velocity from last two snapshots and nudge forward slightly
  if (mob._lastServerX !== undefined && mob._lastServerY !== undefined && serverDelta > 0) {
    const vx = (toX - fromX) / (serverDelta / 1000); // px/sec
    const vy = (toY - fromY) / (serverDelta / 1000);
    const lead = (1 - ease) * VELOCITY_BLEND; // less lead as we approach end
    targetX += vx * lead * (serverDelta / 1000);
    targetY += vy * lead * (serverDelta / 1000);
  }
  // Directly assign render pos
  mob._renderX = targetX;
  mob._renderY = targetY;
  const drawX = mob._renderX;
  const drawY = mob._renderY;
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
  const centerX = drawX + mob.size / 2;
  const centerY = drawY + mob.size / 2;
        const fixedDistance = 15; // Fixed additional distance from mob's edge
        const coneLength = mob.size / 2 + fixedDistance; // Distance from center to triangle

        const triangleSize = 10; // Size of the triangle
        const coneX = centerX + Math.cos(mob.facingAngle) * coneLength;
        const coneY = centerY + Math.sin(mob.facingAngle) * coneLength;
        ctx.save();
        ctx.translate(coneX, coneY);
        ctx.rotate(mob.facingAngle);
        ctx.beginPath();
        ctx.moveTo(triangleSize / 1.5, 0); // Shorter tip for less pointy shape
        ctx.lineTo(-triangleSize / 1.5, triangleSize / 1.2); // Wider base, less steep
        ctx.lineTo(-triangleSize / 1.5, -triangleSize / 1.2); // Wider base, less steep
        ctx.closePath();
        ctx.fillStyle = "white"; // White fill for triangle
        ctx.fill();
        ctx.strokeStyle = "black"; // Black outline for triangle
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        
        // Draw mob feet (rotating with facingAngle)
        // Always use the same color for both body and feet
        // Set color based on type/profile (client-side only)
        let mobColor = "pink"; // passive default
        if (mob.type === "special_mob") mobColor = "purple";
        else if (mob.type === "aggressive_mob") {
          if (mob.profile === "speedster") mobColor = "#a4a400ff";
          else if (mob.profile === "tank") mobColor = "#4b0000ff";
          else if (mob.profile === "longRange") mobColor = "#000861ff";
          else mobColor = "#4d321eff"; // normal mob = dark red
        }
        let outlineColor;
        if (mob.type === "passive_mob") {
          outlineColor = "white";
        } else if (mob.type === "aggressive_mob") {
          outlineColor = "red";
        } else if (mob.type === "special_mob") {
          outlineColor = "yellow";
        } else {
          outlineColor = "white";
        }
        // Flash white when mob is hit (100ms)
        if (mob.lastHitTime && now - mob.lastHitTime < 100) {
          mobColor = "white";
        }
        const feetSize = mob.size / 3;
        const bodyRadius = mob.size / 2;
        // Use a fixed offset so all feet are at the same distance from the center
        const feetOffset = bodyRadius + feetSize * 0.25;
        // Four feet: left front, right front, left back, right back (relative to facingAngle)
        // Indices: 0 = left front, 1 = right front, 2 = left back, 3 = right back
        // Angles: left front (+45°), right front (-45°), left back (+135°), right back (-135°)
        const footAngles = [Math.PI/4, -Math.PI/4, (3*Math.PI)/4, -(3*Math.PI)/4];
        // Natural 4-legged walk: each foot moves with a sine wave, offset by 90°
        // Animation speed depends on mob's movement speed
        let mobSpeed = 40; // fallback default
        if (mobtype[mob.type]) {
          if (mobtype[mob.type].profiles && mob.profile && mobtype[mob.type].profiles[mob.profile]) {
            // Aggressive mob with profile
            const speedObj = mobtype[mob.type].profiles[mob.profile].speed;
            if (speedObj && typeof speedObj.min === 'number' && typeof speedObj.max === 'number') {
              mobSpeed = (speedObj.min + speedObj.max) / 2;
            }
          } else if (mobtype[mob.type].speed) {
            // Passive mob
            const speedObj = mobtype[mob.type].speed;
            if (speedObj && typeof speedObj.min === 'number' && typeof speedObj.max === 'number') {
              mobSpeed = (speedObj.min + speedObj.max) / 2;
            }
          }
        }
        // Map mobSpeed (e.g. 20-120) to walkSpeed (ms per cycle, e.g. 1800ms for slow, 600ms for fast)
        // Higher mobSpeed = faster animation (lower walkSpeed)
        const minMobSpeed = 20, maxMobSpeed = 120, minWalkSpeed = 600, maxWalkSpeed = 1800;
        const clampedMobSpeed = Math.max(minMobSpeed, Math.min(maxMobSpeed, mobSpeed));
        // Make animation much faster by multiplying speed (reduce walkSpeed)
        const speedMultiplier = 0.4; // 0.4x original walkSpeed (2.5x faster)
        const walkSpeed = (maxWalkSpeed - ((clampedMobSpeed - minMobSpeed) / (maxMobSpeed - minMobSpeed)) * (maxWalkSpeed - minWalkSpeed)) * speedMultiplier;
        const t = mob.isMovingForward ? (performance.now() % walkSpeed) / walkSpeed : 0;
        const footOffsets = footAngles.map((a, i) => {
          // phase for all feet
          const phase = t * Math.PI * 2;
          // Mirrored gait: left front (0) & right back (3) use sin(phase), right front (1) & left back (2) use sin(phase + PI)
          let walkOffset = 0;
          if (mob.isMovingForward) {
            const stepSize = 0.35; // smaller step
            if (i === 0 || i === 3) {
              walkOffset = feetSize * stepSize * Math.sin(phase);
            } else {
              walkOffset = feetSize * stepSize * Math.sin(phase + Math.PI);
            }
          }
          let x = Math.cos(a + mob.facingAngle) * feetOffset + Math.cos(mob.facingAngle) * walkOffset;
          let y = Math.sin(a + mob.facingAngle) * feetOffset + Math.sin(mob.facingAngle) * walkOffset;
          return { x, y };
        });
        for (const foot of footOffsets) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(centerX + foot.x - feetSize/2, centerY + foot.y - feetSize/2, feetSize, feetSize);
          ctx.fillStyle = mobColor;
          ctx.fill();
          ctx.strokeStyle = outlineColor;
          ctx.lineWidth = 2; // Always set lineWidth for feet
          ctx.stroke();
          ctx.restore();
        }
        // Draw mob body (rotates with facingAngle)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(mob.facingAngle);
        ctx.fillStyle = mobColor;
        if (mob.type === "passive_mob") {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 3; // Thicker outline for body
          ctx.beginPath();
          ctx.arc(0, 0, mob.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (mob.type === "aggressive_mob") {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 3;
          if (mob.profile === "speedster") {
            ctx.beginPath();
            ctx.moveTo(mob.size/2, 0);
            ctx.lineTo(-mob.size/3, mob.size/2);
            ctx.lineTo(-mob.size/3, -mob.size/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (mob.profile === "tank") {
            drawPolygon(ctx, 0, 0, mob.size, 6); // Hexagon
          } else if (mob.profile === "longRange") {
            drawPolygon(ctx, 0, 0, mob.size, 8); // Octagon
          } else {
            drawPolygon(ctx, 0, 0, mob.size * Math.SQRT2, 4, Math.PI/4); // Diamond
          }
        } else if (mob.type === "special_mob") {
          ctx.save();
          ctx.translate(0, 0);
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, mob.size / 2);
          gradient.addColorStop(0, mobColor);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.5)");
          ctx.fillStyle = gradient;
          ctx.strokeStyle = "yellow";
          ctx.lineWidth = 3;
          drawStar(ctx, 0, 0, mob.size);
          ctx.restore();
        }
        ctx.restore();
        if (showData) {
          
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
          // collider (green outline, matches collision margin from mobdata.js)
          // In mobdata.js, collision margin is: (mob.size + other.size)/2 - overlapMargin
          // For visualizing the collider, use (mob.size/2 - overlapMargin)
          const overlapMargin = mob.size * 0.4; // Must match mobdata.js
          const colliderRadius = Math.max(1, mob.size / 2 - overlapMargin); // Prevent negative/zero radius
          ctx.beginPath();
          ctx.arc(centerX, centerY, colliderRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 255, 0, 0.7)"; // Green outline for collider
          ctx.lineWidth = 2;
          ctx.stroke();

          const pcenterX = player.x + player.size / 2;
          const pcenterY = player.y + player.size / 2;
          const PoverlapMargin = player.size * 0.2; // Must match mobdata.js
          const PcolliderRadius = Math.max(1, player.size / 2 - PoverlapMargin); // Prevent negative/zero radius
          ctx.beginPath();
          ctx.arc(pcenterX, pcenterY, PcolliderRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 255, 0, 0.7)"; // Green outline for collider
          ctx.lineWidth = 2;
          ctx.stroke();

          const PoverlapMargin2 = player.size * 0.4; // Must match mobdata.js
          const PcolliderRadius2 = Math.max(1, player.size / 2 - PoverlapMargin2); // Prevent negative/zero radius
          ctx.beginPath();
          ctx.arc(pcenterX, pcenterY, PcolliderRadius2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(246, 255, 0, 1)"; // Green outline for collider
          ctx.lineWidth = 2;
          ctx.stroke();

          // hitbox (blue outline)
          const hitRadius = mob.size / 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, hitRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 128, 255, 0.7)"; // Blue outline for hit detection
          ctx.lineWidth = 2;
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

  let attackRange = 50;
  const coneAngle = ATTACK_ANGLE;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";

  const toolInfo = (ItemTypes && ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool)
    ? ItemTypes[selectedTool]
    : { category: "hand", tier: 0, damage: 1, attackRange: 50 };

  if (toolInfo.attackRange) attackRange = toolInfo.attackRange;

  let staminaSpent = false; // ✅ Track if stamina has been deducted

  for (const [type, config] of Object.entries(mobtype)) {
    const list = getMobArrayByType(type);

    for (const mob of list) {
      if (mob.size > 0 && mob.health > 0 &&
          isObjectInAttackCone(player, mob, attackRange, coneAngle)) {

        // ✅ Tool effectiveness check
        if (!config.requiredTool.categories.includes(toolInfo.category) ||
            toolInfo.tier < config.requiredTool.minTier) {
          showMessage("This tool is not effective.");
          return;
        }

        // ✅ Stamina cost ONCE
        if (!staminaSpent) {
          const cost = 10;
          if (stamina < cost) {
            showMessage("Low Stamina");
            return;
          }
          stamina -= cost;
          lastStaminaUseTime = 0;
          staminaSpent = true;
        }

        // ✅ Apply damage
        const damage = toolInfo.damage;
        mob.health -= damage;
        window.socket.emit("mobhit", { type, id: mob.id, newHealth: mob.health });
        // Client-side immediate knockback prediction for responsiveness
  // Removed local knockback prediction to prevent double visual push; wait for server event.
        showDamageText(mob.x + mob.size / 2, mob.y + mob.size / 2, -damage);
        mob.lastHitTime = performance.now();
        
        player.isAttacking = true;
        player.attackStartTime = performance.now();
      }
    }
  }
}

function isCollidingWithMobs(newX, newY, sizeX = player.size, sizeY = player.size, mobs) {
  const overlapMargin = sizeX * 0.4 ; // 40% overlap allowed, consistent with resource collision
  const { cx, cy } = getCenter(newX, newY, sizeX);
  const allMobs = Object.values(mobs).flat();
  return allMobs.some(mob => {
    if (mob.size > 0) {
      const mobColliderSize = mob.size * 0.4; 
      const offset = (mob.size - mobColliderSize) / 2; 
      const mcx = mob.x + offset + mobColliderSize / 2;
      const mcy = mob.y + offset + mobColliderSize / 2;
      const minDistX = (sizeX + mobColliderSize) / 2 - overlapMargin;
      const minDistY = (sizeY + mobColliderSize) / 2 - overlapMargin;
      return Math.abs(cx - mcx) < minDistX && Math.abs(cy - mcy) < minDistY;
    }
    return false;
  });

}
window.tryHitMob = tryHitMob;
