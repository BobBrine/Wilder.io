const mobtype = initializeMobTypes(gameTime, difficulty);
const mobs = Object.fromEntries(Object.keys(mobtype).map(type => [type, []]));

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
      if (health <= 0) {
        mob.size = 0;
        mob.respawnTimer = mob.respawnTime;
      }
    }
  });

  socket.on("mobKnockback", ({ id, type, knockbackVx, knockbackVy, duration, continuous }) => {
    const list = getMobArrayByType(type);
    const mob = list.find(m => m.id === id);
    if (mob) {
      const now = performance.now();
      // Disable client-side knockback animation; rely on server position updates only
      mob.flashEndTime = now + 150;
      mob._kbFlashUntil = now + 150;
    }
  });
}

function drawPolygon(ctx, x, y, size, sides, rotation = 0) {
  ctx.save();
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


  
  ctx.restore();
}

function drawCrystal(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = "lightblue";
  ctx.strokeStyle = "yellow";
  ctx.beginPath();
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x + size / 3, y);
  ctx.lineTo(x, y + size / 2);
  ctx.lineTo(x - size / 3, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}


function drawMob() {
  ctx.save();
  // Force feet animation for all mobs for testing
  // Remove this line when you want real movement logic
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      mob.isMovingForward = true;
    }
  }
  const now = performance.now();
  // Interpolation tuning constants
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      if (mob.health > 0) {
        // Cull off-screen mobs to reduce draw calls
        if (typeof isWorldRectOnScreen === 'function') {
          const size = mob.size || 0;
          const rx = (mob._renderX !== undefined ? mob._renderX : mob.x);
          const ry = (mob._renderY !== undefined ? mob._renderY : mob.y);
          if (!isWorldRectOnScreen(rx, ry, size, size)) {
            continue;
          }
        }
  // Client-side prediction removed to avoid double-push effect; server authoritative knockback only.
        // Optional shadows per-mob
        if (window.graphicsSettings && window.graphicsSettings.shadows) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
        } else {
          ctx.shadowColor = 'transparent';
        }
  // Smoothly follow server/logic position only (knockback animation disabled)
  if (mob._renderX === undefined) { mob._renderX = mob.x; mob._renderY = mob.y; }
  const follow = 0.35; // snappy follow to reduce visible snap-back
  const dfx = mob.x - mob._renderX;
  const dfy = mob.y - mob._renderY;
  const d2 = dfx * dfx + dfy * dfy;
  // Dead-zone to prevent micro jitter
  if (d2 < 0.25) { // ~0.5px
    mob._renderX = mob.x;
    mob._renderY = mob.y;
  } else {
    mob._renderX += dfx * follow;
    mob._renderY += dfy * follow;
  }

  const drawX = mob._renderX;
  const drawY = mob._renderY;
        if (window.graphicsSettings && window.graphicsSettings.shadows) {
          ctx.shadowBlur = 5;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
        } else {
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
        
  const centerX = drawX + mob.size / 2;
  const centerY = drawY + mob.size / 2;
        // Skip direction marker in performance mode
        if (!(window.graphicsSettings && window.graphicsSettings.performanceMode)) {
          const fixedDistance = 15; // Fixed additional distance from mob's edge
          const coneLength = mob.size / 2 + fixedDistance; // Distance from center to triangle
          const triangleSize = 10; // Size of the triangle
          const coneX = centerX + Math.cos(mob.facingAngle) * coneLength;
          const coneY = centerY + Math.sin(mob.facingAngle) * coneLength;
          ctx.save();
          ctx.translate(coneX, coneY);
          ctx.rotate(mob.facingAngle);
          ctx.beginPath();
          ctx.moveTo(triangleSize / 1.5, 0);
          ctx.lineTo(-triangleSize / 1.5, triangleSize / 1.2);
          ctx.lineTo(-triangleSize / 1.5, -triangleSize / 1.2);
          ctx.closePath();
          ctx.fillStyle = "white";
          ctx.fill();
          ctx.strokeStyle = "black";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
        
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
        // Flash white when mob is hit (100ms) or knocked back
        const isFlashing = (mob.lastHitTime && now - mob.lastHitTime < 100) || 
                          (mob._kbFlashUntil && now < mob._kbFlashUntil);
        if (isFlashing) {
          mobColor = "white";
        }
        // Skip feet animation entirely in performance mode
        if (window.graphicsSettings && window.graphicsSettings.performanceMode) {
          // no-op
        } else {
          const feetSize = mob.size / 3;
          const bodyRadius = mob.size / 2;
          // Use a fixed offset so all feet are at the same distance from the center
          const feetOffset = bodyRadius + feetSize * 0.25;
          // Four feet
          const footAngles = [Math.PI/4, -Math.PI/4, (3*Math.PI)/4, -(3*Math.PI)/4];
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
          // Draw angry eyes
          const eyeSize = mob.size / 8;
          const eyeSpacing = mob.size / 4;
          const eyeY = -eyeSize;
          
          // Left eye
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(-eyeSpacing, eyeY);
          ctx.lineTo(-eyeSpacing + eyeSize, eyeY - eyeSize);
          ctx.lineTo(-eyeSpacing + eyeSize, eyeY + eyeSize);
          ctx.closePath();
          ctx.fillStyle = "red";
          ctx.fill();
          
          // Right eye
          ctx.beginPath();
          ctx.moveTo(eyeSpacing, eyeY);
          ctx.lineTo(eyeSpacing - eyeSize, eyeY - eyeSize);
          ctx.lineTo(eyeSpacing - eyeSize, eyeY + eyeSize);
          ctx.closePath();
          ctx.fillStyle = "red";
          ctx.fill();
        } else if (mob.type === "special_mob") {
          ctx.save();
          ctx.translate(0, 0);
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, mob.size / 2);
          gradient.addColorStop(0, mobColor);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.5)");
          ctx.fillStyle = gradient;
          ctx.strokeStyle = "yellow";
          ctx.lineWidth = 3;
          drawCrystal(ctx, 0, 0, mob.size);
          ctx.restore();
        }
        
        
        ctx.restore();

        if (showData) {
          ctx.save();
          const aggroRadius = mobtype[mob.type].aggroRadius;
          const escapeRadius = mobtype[mob.type].escapeRadius;
          // mob = the instance from your mobs list, mobtype = config from "mobType" event
          const cfg = mobtype?.[mob.type] ?? {};
          const prof =
            cfg.profiles?.[mob.profile] ||
            (cfg.profiles ? Object.values(cfg.profiles)[0] : undefined);

          const mobSpeed =
            // prefer instance field from server if present
            mob.speed ??
            // then profile speed (for aggressive mobs)
            prof?.speed ??
            // then type-level default (passive/special)
            cfg.speed ??
            0;

          const mobDamage =
            mob.damage ??
            prof?.damage ??
            cfg.damage ??
            0;
          const attackSpeed = mob.attackspeed ?? prof?.attackspeed ?? cfg.attackspeed;
          ctx.beginPath();
          ctx.arc(centerX, centerY, aggroRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(centerX, centerY, escapeRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 0, 255, 0.5)";
          ctx.stroke();
          ctx.restore();
          
          if (mob.threatTable && Object.keys(mob.threatTable).length > 0) {
            const sortedThreats = Object.entries(mob.threatTable).sort(([, a], [, b]) => b - a);
            let textLines = sortedThreats.map(([name, threat]) => `${name}: ${Math.floor(threat)}`);
            if (mob.targetPlayerId) {
              const targetName = Object.entries(otherPlayers).find(([id]) => id === mob.targetPlayerId)?.[1].name ||
                                (player && player.id === mob.targetPlayerId ? player.name : 'Unknown');
              textLines = textLines.map(line => line.startsWith(targetName) ? `>${line}` : line);
            }
            const fontSize = 12;
            ctx.save();
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = "white";
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            const x = drawX;
            let y = drawY - 10;
            for (const line of textLines) {
              ctx.strokeText(line, x, y);
              ctx.fillText(line, x, y);
              y -= fontSize + 2;
            }
            ctx.restore();
          }

          ctx.save();
          ctx.fillStyle = "white";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          let yOffset = drawY - 15;
          const texts = [
            `ID: ${mob.id.slice(0, 4)}`,
            `HP: ${mob.health.toFixed(0)}/${mob.maxHealth}`,
            `Pos: ${mob.x.toFixed(0)}, ${mob.y.toFixed(0)}`,
            `Type: ${mob.type}${mob.profile ? ` (${mob.profile})` : ''}`,
            `Size: ${mob.size.toFixed(0)}`,
            `Range: ${aggroRadius?.toFixed(0) ?? 'N/A'}/${escapeRadius?.toFixed(0) ?? 'N/A'}`,
            `Speed: ${mobSpeed?.toFixed(0) ?? 'N/A'}`,
            `Damage: ${mobDamage?.toFixed(0) ?? 'N/A'}`,
            `Attack Speed: ${attackSpeed ?? 'N/A'}`

          ];
          if (mob.state) {
            texts.push(`State: ${mob.state}`);
          }
          
          for (let i = texts.length - 1; i >= 0; i--) {
            ctx.fillText(texts[i], centerX, yOffset);
            yOffset -= 12;
          }
          ctx.restore();
          
          // collider (green outline, matches collision margin from mobdata.js)
          // In mobdata.js, collision margin is: (mob.size + other.size)/2 - overlapMargin
          // For visualizing the collider, use (mob.size/2 - overlapMargin)
          const overlapMargin = mob.size * 0.4; // Must match mobdata.js
          const colliderRadius = Math.max(1, mob.size / 2 - overlapMargin); // Prevent negative/zero radius
          ctx.save();
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
          ctx.restore();
        }
        

        
        if (mob.lastHitTime && now - mob.lastHitTime < 1000) drawHealthBarM(mob);
      }
    }
  }
  ctx.restore();
}

function drawHealthBarM(mob) {
  const config = mobtype[mob.type];
  if (!config || !mob.maxHealth) return;
  ctx.save();
  const hpPercent = Math.max(mob.health / mob.maxHealth, 0);
  const barWidth = mob.size;
  const barHeight = 5;
  const padding = 2;
  const x = (mob._renderX !== undefined ? mob._renderX : mob.x);
  const y = (mob._renderY !== undefined ? mob._renderY : mob.y) - barHeight - padding;
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
  ctx.restore();
}

function tryHitMob() {
  if (!player) return;

  let attackRange = DEFAULT_ATTACK_RANGE + player.playerrange;
  const coneAngle = ATTACK_ANGLE;
  const selected = hotbar.slots[hotbar.selectedIndex];
  let selectedTool = selected?.type || "hand";

  const toolInfo = (ItemTypes && ItemTypes[selectedTool] && ItemTypes[selectedTool].isTool)
    ? ItemTypes[selectedTool]
    : { category: "hand", tier: 0, damage: 1, attackRange: 50 };

  if (toolInfo.attackRange) attackRange = toolInfo.attackRange + (player.playerrange);

  let staminaSpent = false;

  for (const [type, config] of Object.entries(mobtype)) {
    const list = getMobArrayByType(type);

    for (const mob of list) {
      if (mob.size > 0 && mob.health > 0 &&
          isObjectInAttackCone(player, mob, attackRange, coneAngle)) {
        // Allow all tools to hit mobs: swords behave normally, other tools deal 1 dmg.
        // Non-tool (hand) remains blocked by requiredTool rules.
        const isSword = toolInfo && toolInfo.category === "sword";
        const isTool = !!(toolInfo && toolInfo.isTool);
        let canHit;
        if (isSword) {
          // Sword must still satisfy requiredTool rules
          canHit = config.requiredTool.categories.includes(toolInfo.category) &&
                   toolInfo.tier >= config.requiredTool.minTier;
        } else if (isTool) {
          // Other tools can always hit (for 1 damage)
          canHit = true;
        } else {
          // Hand or non-tool: use original checks (likely blocked)
          canHit = config.requiredTool.categories.includes(toolInfo.category) &&
                   toolInfo.tier >= config.requiredTool.minTier;
        }
        if (!canHit) {
          showMessage("This tool is not effective.");
          return;
        }

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

        // Damage: swords use their normal damage; other tools only deal 1
        const damage = (toolInfo && toolInfo.category === "sword") ? (toolInfo.damage || 1) + player.playerdamage : player.playerdamage;
        mob.health -= damage;
        playEnemyHit(); // Play hit sound
        // Calculate knockback
        const dx = (mob.x + mob.size/2) - (player.x + player.size/2);
        const dy = (mob.y + mob.size/2) - (player.y + player.size/2);
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len, ny = dy / len;
  const baseKnockback = (toolInfo && toolInfo.isTool) ? 60 : 40;
  const knockbackDistance = baseKnockback + (player.playerknockback || 0);

  const knockbackDuration = 0.2; // match player knockback duration for consistency

        // Visual effects
        mob.flashEndTime = performance.now() + 100;
  const dX = (mob._renderX !== undefined ? mob._renderX : mob.x) + mob.size / 2;
  const dY = (mob._renderY !== undefined ? mob._renderY : mob.y) + mob.size / 2;
  showDamageText(dX, dY, -damage);
        mob.lastHitTime = performance.now();

        player.isAttacking = true;
        player.attackStartTime = performance.now();

  // Emit hit and requested knockback to server (no client-side animation)
        window.socket.emit("mobhit", { 
          type, 
          id: mob.id, 
          newHealth: mob.health,
          knockback: {
            vx: nx * knockbackDistance,
            vy: ny * knockbackDistance,
            duration: knockbackDuration,  // Seconds
          }
        });
        if (mob.health <= 0) {
          playEnemyDeath();
          showPlacementEffect(dX, dY, false);
          const drops = mobtype[mob.type].drop;
          const dropAmounts = mobtype[mob.type].getDropAmount;
          if (Array.isArray(drops) && Array.isArray(dropAmounts)) {
            for (let i = 0; i < drops.length; i++) {
              const dropType = drops[i];
              const amountObj = dropAmounts[i];
              dropItem(dropType, amountObj.amount, mob);
            }
          } else {
            dropItem(drops, dropAmounts, mob);
          }
        }
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
function getRandomPositionInCell(col, row, size) {
  const minX = col * GRID_CELL_SIZE;
  const minY = row * GRID_CELL_SIZE;
  const maxX = minX + GRID_CELL_SIZE - size;
  const maxY = minY + GRID_CELL_SIZE - size;
  const x = Math.random() * (maxX - minX) + minX;
  const y = Math.random() * (maxY - minY) + minY;
  return { x, y };
}


// Constants
const passiveColors = ["green", "lightblue", "pink"];
const aggressiveColors = [ "#560202ff", "#000000", "#505050ff" ];

// Helper function to generate random numbers within a range
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to generate a passive mob type with fixed, difficulty-scaled stats
function generatePassiveMobType(id, difficulty) {
  const baseTurnSpeed = Math.PI;
  const turnSpeed = baseTurnSpeed * (1 + 0.05 * (difficulty - 1)); // slower scaling
  const dropAmount = 1 * difficulty;
  const fixedHealth = 80 * (1 + 0.3 * (difficulty - 1)); // easier early game
  const fixedSpeed = 40 * (1 + 0.1 * (difficulty - 1));
  
  return {
    maxCount: 11,  // slightly more mobs at higher difficulty
    size: 30,
    health: fixedHealth,
    speed: fixedSpeed,
    color: () => passiveColors[Math.floor(Math.random() * passiveColors.length)],
    drop: "pure_core",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 10,
    getDropAmount: dropAmount,
    behavior: 'wander',
    damage: 0,
    turnSpeed,
  };
}


// Function to generate an aggressive mob type with profiles (fixed stats)
function generateAggressiveMobType(id, gameTime, difficulty, totalMaxCount = 28) {
  const baseTurnSpeed = Math.PI * 2;
  const turnSpeed = baseTurnSpeed * (1 + 0.05 * (difficulty - 1));
  const aggroRadius = 100 * (1 + 0.1 * (difficulty - 1));
  const escapeRadius = 600 * (1 + 0.1 * (difficulty - 1));
  const attackSpeedScale = 1 + 0.1 * (difficulty - 1);
  let dropAmount = 1 * difficulty;
  // Use let instead of const for count variables since they may be modified
  let balancedCount = Math.max(1, Math.floor(totalMaxCount * 0.4));
  let speedsterCount = Math.max(1, Math.floor(totalMaxCount * 0.2));
  let tankCount = Math.max(1, Math.floor(totalMaxCount * 0.2));
  let longRangeCount = Math.max(1, Math.floor(totalMaxCount * 0.2));

  // Adjust counts to sum exactly to totalMaxCount
  const sumProfileCounts = balancedCount + speedsterCount + tankCount + longRangeCount;
  const countDifference = totalMaxCount - sumProfileCounts;

  // Distribute the difference to maintain ratios as closely as possible
  if (countDifference !== 0) {
    // Define adjustment order (based on priority or largest remainder)
    const adjustOrder = [
      { key: 'balanced', count: balancedCount, ratio: 0.4 },
      { key: 'speedster', count: speedsterCount, ratio: 0.2 },
      { key: 'tank', count: tankCount, ratio: 0.2 },
      { key: 'longRange', count: longRangeCount, ratio: 0.2 }
    ].sort((a, b) => (b.count + countDifference * b.ratio) - (a.count + countDifference * a.ratio));

    // Apply adjustment
    for (let i = 0; i < Math.abs(countDifference); i++) {
      const adjustType = adjustOrder[i % adjustOrder.length].key;
      switch (adjustType) {
        case 'balanced': balancedCount += Math.sign(countDifference); break;
        case 'speedster': speedsterCount += Math.sign(countDifference); break;
        case 'tank': tankCount += Math.sign(countDifference); break;
        case 'longRange': longRangeCount += Math.sign(countDifference); break;
      }
    }
  }

  return {
    maxCount: totalMaxCount, // Use the exact totalMaxCount
    profiles: {
      tank: {
        count: tankCount,
        health: 250 * (1 + 0.3 * (difficulty - 1)),
        size: 50,
        speed: 60 * (1 + 0.1 * (difficulty - 1)),
        damage: 40 * (1 + 0.2 * (difficulty - 1)),
        attackspeed: 0.7 * attackSpeedScale,
      },
      speedster: {
        count: speedsterCount,
        health: 75 * (1 + 0.3 * (difficulty - 1)),
        size: 20,
        speed: 180 * (1 + 0.15 * (difficulty - 1)),
        damage: 20 * (1 + 0.2 * (difficulty - 1)),
        attackspeed: 1.5 * attackSpeedScale,
      },
      longRange: {
        count: longRangeCount,
        health: 115 * (1 + 0.3 * (difficulty - 1)),
        size: 25,
        speed: 90 * (1 + 0.1 * (difficulty - 1)),
        damage: 30 * (1 + 0.15 * (difficulty - 1)),
        aggroRadius: aggroRadius * 1.5,
        escapeRadius: escapeRadius * 1.5,
        attackspeed: 1 * attackSpeedScale,
      },
      balanced: {
        count: balancedCount,
        health: 150 * (1 + 0.3 * (difficulty - 1)),
        size: 30,
        speed: 100 * (1 + 0.1 * (difficulty - 1)),
        damage: 30 * (1 + 0.15 * (difficulty - 1)),
        attackspeed: 1 * attackSpeedScale,
      },
    },
    color: () => aggressiveColors[Math.floor(Math.random() * aggressiveColors.length)],
    drop: "dark_core",
    requiredTool: { categories: ["hand", "sword"], minTier: 0 },
    spawntimer: 30,
    getDropAmount: dropAmount,
    behavior: 'wander',
    isAggressive: true,
    aggroRadius,
    escapeRadius,
    turnSpeed,
  };
}


// Function to generate a special aggressive mob
function generateSpecialAggressiveMobType(id, gameTime, difficulty) {
  const turnSpeed = Math.PI * 2 * (1 + 0.05 * (difficulty - 1));
  const aggroRadius = 200 * (1 + 0.1 * (difficulty - 1));
  const escapeRadius = 400 * (1 + 0.1 * (difficulty - 1));
  const attackSpeedScale = 1 + 0.1 * (difficulty - 1);
  const dropAmount = 1 * difficulty;

  return {
    maxCount: 1,
    size: 30,
    health: 500 * (1 + 0.3 * (difficulty - 1)),
    speed: 200 * (1 + 0.1 * (difficulty - 1)),
    attackspeed: 1.5 * attackSpeedScale,
    color: "white",
    drop: ["pure_core", "dark_core", "mythic_core"],
    requiredTool: { categories: ["sword"], minTier: 0 },
    spawntimer: 60,
    getDropAmount: [
      { type: "pure_core", amount: 3 * dropAmount },
      { type: "dark_core", amount: 3 * dropAmount },
      { type: "mythic_core", amount: 1 * dropAmount },
    ],
    behavior: 'wander',
    isAggressive: true,
    aggroRadius,
    escapeRadius,
    damage: 30 * (1 + 0.2 * (difficulty - 1)),
    turnSpeed,
  };
}


// Generate mob types and update mobtype object
function initializeMobTypes(gameTime, difficulty) {
  const mobtype = {
    passive_mob: generatePassiveMobType("passive_mob", difficulty),
    aggressive_mob: generateAggressiveMobType("aggressive_mob", gameTime, difficulty),
    special_mob: generateSpecialAggressiveMobType("special_mob", gameTime, difficulty),
  };
  return mobtype;
}

// Modified createMobSpawner to handle profiles and scale attributes
function createMobSpawner(type, targetArray, isOverlapping, gameTime) {
  const config = mobtype[type];
  if (!config) return;

  const maxCount = typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount;
  let activeCount = targetArray.filter(r => r.size > 0).length;
  // For aggressive mobs, don't block spawning based on total count; handle per-profile below
  let profiles = {};
  if (type === "aggressive_mob") {
    profiles = config.profiles;
  } else {
    profiles.default = {
      // Fixed stats for non-aggressive types
      health: config.health,
      size: config.size,
      speed: config.speed,
      damage: config.damage || 0,
      aggroRadius: config.aggroRadius || 0,
      escapeRadius: config.escapeRadius || 0,
  attackspeed: config.attackspeed || 1,
    };
  }

  for (const [profileName, profile] of Object.entries(profiles)) {
  const profileMaxCount = typeof profile.count === 'function' ? profile.count(gameTime) : (typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount || 1);
  let profileActiveCount = targetArray.filter(r => r.size > 0 && r.profile === profileName).length; 

    while (profileActiveCount < profileMaxCount) {
      const health = profile.health;
      const size = profile.size;
      const damage = profile.damage ? profile.damage : 0;
      const speed = profile.speed;
  const aggroRadius = profile.aggroRadius || config.aggroRadius || 0;
      const escapeRadius = profile.escapeRadius || config.escapeRadius || 0;
  const attackspeed = profile.attackspeed || 1;

      const col = Math.floor(Math.random() * GRID_COLS);
      const row = Math.floor(Math.random() * GRID_ROWS);
      const { x, y } = getRandomPositionInCell(col, row, size);

      if (!isOverlapping(x, y, size, size)) {
        const id = crypto.randomUUID();
        const color = typeof config.color === "function" ? config.color() : config.color;
        targetArray.push({
          id,
          type,
          profile: profileName,
          x,
          y,
          size,
          health,
          maxHealth: health,
          moveSpeed: speed,
          damage,
          attackspeed,
          behavior: config.behavior,
          currentBehavior: config.behavior,
          targetPlayerId: null,
          chaseTimer: 0,
          facingAngle: Math.random() * Math.PI * 2,
          targetAngle: Math.random() * Math.PI * 2,
          turnSpeed: config.turnSpeed,
          moveTimer: Math.random() * 3 + 2,
          isTurning: true,
          respawnTimer: 0,
          respawnTime: config.spawntimer,
          damageCooldown: 0,
          threatTable: {},
          pauseTimer: 0,
          color,
          aggroRadius,
          escapeRadius,
        });
        profileActiveCount++;
        activeCount++;
      }
    }
  }
}

// Modified updateMobRespawns to handle profiles
function updateMobRespawns(deltaTime, allResources, players, gameTime) {
  for (const type in mobs) {
    const config = mobtype[type];
    const maxCount = typeof config.maxCount === 'function' ? config.maxCount(gameTime) : config.maxCount;
    const mobList = mobs[type];

    let profiles = {};
    if (type === "aggressive_mob") {
    profiles = config.profiles;
    } else {
        profiles = {
            default: {
                count: maxCount,
                health: config.health,
                size: config.size,
                speed: config.speed,
                damage: config.damage || 0,
                aggroRadius: config.aggroRadius || 0,
                escapeRadius: config.escapeRadius || 0,
                attackspeed: config.attackspeed || 1,
            }
        };
    }

    for (const r of mobList) {
      if (r.size === 0 && r.respawnTimer > 0) {
        r.respawnTimer -= deltaTime;
        if (r.respawnTimer <= 0) {
          // Ensure aggressive mobs always have a valid profile
          let profileKey = r.profile || "default";
          if (type === "aggressive_mob") {
              // For aggressive mobs, ensure we have a valid profile
              if (!r.profile || !profiles[r.profile]) {
                  const profileNames = Object.keys(profiles);
                  profileKey = profileNames[Math.floor(Math.random() * profileNames.length)];
                  r.profile = profileKey;
              }
          }
          const profile = profiles[profileKey];
          if (!profile) {
            console.warn(`Cannot respawn mob of type ${type}: missing profile '${profileKey}'`);
            continue;
          }
          const health = profile.health;
          const size = profile.size;
          const damage = profile.damage ? profile.damage : 0;
          const speed = profile.speed;
          const aggroRadius = profile.aggroRadius || config.aggroRadius || 0;
          const escapeRadius = profile.escapeRadius || config.escapeRadius || 0;
          const attackspeed = profile.attackspeed || 1;
          const color = typeof config.color === "function" ? config.color() : config.color;

          let newX, newY;
          let attempts = 0;
          const maxAttempts = 10;
          do {
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, size));
            attempts++;
            if (attempts > maxAttempts) {
              console.warn(`Failed to find valid spawn position for ${type} (${r.profile}) after ${maxAttempts} attempts.`);
              break;
            }
          } while (
            mobPositionBlocked(newX, newY, size, allResources, players, mobs, null, size * 0.4)
          );
          if (attempts <= maxAttempts) {
            r.id = crypto.randomUUID();
            r.x = newX;
            r.y = newY;
            r.size = size;
            r.health = health;
            r.maxHealth = health;
            r.moveSpeed = speed;
            r.damage = damage;
            r.attackspeed = attackspeed;
            r.color = color;
            r.aggroRadius = aggroRadius;
            r.escapeRadius = escapeRadius;
            r.respawnTimer = 0;
            r.behavior = config.behavior;
            r.currentBehavior = config.behavior;
            r.targetPlayerId = null;
            r.chaseTimer = 0;
            r.facingAngle = Math.random() * Math.PI * 2;
            r.targetAngle = Math.random() * Math.PI * 2;
            r.turnSpeed = config.turnSpeed;
            r.moveTimer = Math.random() * 3 + 2;
            r.isTurning = true;
            r.damageCooldown = 0;
            r.threatTable = {};
            r.pauseTimer = 0;
          }
        }
      }
      // If mob is dead (health <= 0) and not already in respawn, mark for respawn
      if (r.health <= 0 && r.size > 0) {
        r.size = 0;
        r.respawnTimer = r.respawnTime || (mobtype[r.type]?.spawntimer || 10);
      }
    }

    const totalInstances = mobList.length;
    if (totalInstances < maxCount) {
      const toSpawn = maxCount - totalInstances;
      for (const [profileName, profile] of Object.entries(profiles)) {
        const profileMaxCount = typeof profile.count === 'function'
          ? profile.count(gameTime)
          : (typeof profile.count === 'number' ? profile.count : 1);
        const profileCurrentCount = mobList.filter(r => r.profile === profileName && r.size > 0).length;
        const profileToSpawn = Math.min(profileMaxCount - profileCurrentCount, toSpawn);
        for (let i = 0; i < profileToSpawn; i++) {
          const health = profile.health;
          const size = profile.size;
          const damage = profile.damage ? profile.damage : 0;
          const speed = profile.speed;
          const aggroRadius = profile.aggroRadius || config.aggroRadius || 0;
          const escapeRadius = profile.escapeRadius || config.escapeRadius || 0;
          const attackspeed = profile.attackspeed || 1;
          const color = typeof config.color === "function" ? config.color() : config.color;

          let newX, newY;
          let attempts = 0;
          const maxAttempts = 10;
          do {
            const col = Math.floor(Math.random() * GRID_COLS);
            const row = Math.floor(Math.random() * GRID_ROWS);
            ({ x: newX, y: newY } = getRandomPositionInCell(col, row, size));
            attempts++;
            if (attempts > maxAttempts) {
              console.warn(`Failed to spawn new ${type} (${profileName}) after ${maxAttempts} attempts.`);
              break;
            }
          } while (
            mobPositionBlocked(newX, newY, size, allResources, players, mobs, null, size * 0.4)
          );
          if (attempts <= maxAttempts) {
            const id = crypto.randomUUID();
            mobList.push({
              id,
              type,
              profile: profileName,
              x: newX,
              y: newY,
              size,
              health,
              maxHealth: health,
              moveSpeed: speed,
              damage,
              attackspeed,
              color,
              aggroRadius,
              escapeRadius,
              behavior: config.behavior,
              currentBehavior: config.behavior,
              targetPlayerId: null,
              chaseTimer: 0,
              facingAngle: Math.random() * Math.PI * 2,
              targetAngle: Math.random() * Math.PI * 2,
              turnSpeed: config.turnSpeed,
              moveTimer: Math.random() * 3 + 2,
              isTurning: true,
              respawnTimer: 0,
              respawnTime: config.spawntimer,
              damageCooldown: 0,
              threatTable: {},
              pauseTimer: 0,
            });
          }
        }
      }
    }
  }
}

function spawnAllMob(allResources, players, gameTime) {
  let totalMobCount = 0;
  for (const type in mobs) {
    mobs[type] = mobs[type].filter(r => r.size > 0);
    createMobSpawner(
      type,
      mobs[type],
      (x, y, sizeX, sizeY) => {
        const overlapMargin = sizeX * 0.4;
        return (
          mobPositionBlocked(x, y, sizeX, allResources, players, mobs, null, overlapMargin) ||
          checkOverlap(x, y, sizeX, sizeY, pond.x, pond.y, pond.size, pond.size)
        );
      },
      gameTime
    );
    const activeCount = mobs[type].filter(r => r.size > 0).length;
    totalMobCount += activeCount;
  }
  console.log(`Total mobs spawned: ${totalMobCount} (${Object.entries(mobs).map(([type, list]) => `${type}: ${list.filter(r => r.size > 0).length}`).join(', ')})`);
}

let ioRef = null;
function setIO(ioInstance) { ioRef = ioInstance; }

// Shared centered-collider helpers (consistent with updateMobs collision rules)
function getCenterPos(x, y, size) {
  return { cx: x + size / 2, cy: y + size / 2 };
}

function mobCollideResourcesCentered(newX, newY, size, allResources, overlapMargin) {
  const { cx, cy } = getCenterPos(newX, newY, size);
  const all = Object.values(allResources || {}).flat();
  return all.some(resource => {
    if (resource.sizeX > 0 && resource.sizeY > 0) {
      const rcx = resource.x + resource.sizeX / 2;
      const rcy = resource.y + resource.sizeY / 2;
      const minDistX = (size + resource.sizeX) / 2 - overlapMargin;
      const minDistY = (size + resource.sizeY) / 2 - overlapMargin;
      return Math.abs(cx - rcx) < minDistX && Math.abs(cy - rcy) < minDistY;
    }
    return false;
  });
}

function mobCollideMobsCentered(newX, newY, size, selfMob, mobsObj, overlapMargin) {
  const { cx, cy } = getCenterPos(newX, newY, size);
  const allMobs = Object.values(mobsObj || {}).flat();
  return allMobs.some(otherMob => {
    if (otherMob !== selfMob && otherMob.size > 0) {
      const mobColliderSize = otherMob.size * 0.4;
      const offset = (otherMob.size - mobColliderSize) / 2;
      const ocx = otherMob.x + offset + mobColliderSize / 2;
      const ocy = otherMob.y + offset + mobColliderSize / 2;
      const minDistX = (size + mobColliderSize) / 2 - overlapMargin;
      const minDistY = (size + mobColliderSize) / 2 - overlapMargin;
      return Math.abs(cx - ocx) < minDistX && Math.abs(cy - ocy) < minDistY;
    }
    return false;
  });
}

function mobCollidePlayersCentered(newX, newY, size, playersObj, overlapMargin) {
  const { cx, cy } = getCenterPos(newX, newY, size);
  return Object.values(playersObj || {}).some(player => {
    if (player.size > 0) {
      const playerColliderSize = player.size * 0.6;
      const offset = (player.size - playerColliderSize) / 2;
      const pcx = player.x + offset + playerColliderSize / 2;
      const pcy = player.y + offset + playerColliderSize / 2;
      const minDistX = (size + playerColliderSize) / 2 - overlapMargin;
      const minDistY = (size + playerColliderSize) / 2 - overlapMargin;
      return Math.abs(cx - pcx) < minDistX && Math.abs(cy - pcy) < minDistY;
    }
    return false;
  });
}

function mobPositionBlocked(newX, newY, size, allResources, playersObj, mobsObj, selfMob, overlapMargin) {
  return (
    mobCollideResourcesCentered(newX, newY, size, allResources, overlapMargin) ||
    mobCollideMobsCentered(newX, newY, size, selfMob, mobsObj, overlapMargin) ||
    mobCollidePlayersCentered(newX, newY, size, playersObj, overlapMargin)
  );
}

// Helper for server: consistent collision rule used during knockback resolution
function isMobPosBlockedForServer(newX, newY, size, allResources, playersObj, mobsObj, selfMob) {
  const overlapMargin = size * 0.4; // keep in sync with client and spawn logic
  return mobPositionBlocked(newX, newY, size, allResources, playersObj, mobsObj, selfMob, overlapMargin);
}

function updateMobs(allResources, players, deltaTime) {
  for (const mobList of Object.values(mobs)) {
    for (const mob of mobList) {
      if (mob.size === 0) continue;
      const config = mobtype[mob.type];
      const mobSize = mob.size;

      if (mob.damageCooldown > 0) {
        mob.damageCooldown -= deltaTime;
      }

      if (mob.pauseTimer > 0) {
        mob.pauseTimer -= deltaTime;
        continue;
      }

      if (config.isAggressive) {
        for (const player of Object.values(players)) {
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < config.escapeRadius) {
            if (!mob.threatTable[player.id]) {
              mob.threatTable[player.id] = 0;
            }
          }
        }

        for (const playerId in mob.threatTable) {
          const player = players[playerId];
          if (!player) {
            delete mob.threatTable[playerId];
            continue;
          }
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < config.aggroRadius) {
            mob.threatTable[playerId] += 1 * deltaTime;
          } else if (distance > config.escapeRadius) {
            const decay = 2 + (mob.threatTable[playerId] / 50);
            mob.threatTable[playerId] -= decay * deltaTime;
            if (mob.threatTable[playerId] <= 0) {
              delete mob.threatTable[playerId];
            }
          }
        }

        let maxThreat = 0;
        let targetPlayerId = null;
        for (const [playerId, threat] of Object.entries(mob.threatTable)) {
          if (threat > maxThreat) {
            maxThreat = threat;
            targetPlayerId = playerId;
          }
        }

        if (targetPlayerId && maxThreat > 0) {
          mob.currentBehavior = 'chase';
          mob.targetPlayerId = targetPlayerId;
        } else {
          mob.currentBehavior = 'wander';
          mob.targetPlayerId = null;
        }
      }

      if (mob.currentBehavior === 'wander') {
        let closestDistance = Infinity;
        let closestPlayer = null;
        for (const player of Object.values(players)) {
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < config.escapeRadius && distance < closestDistance) {
            closestDistance = distance;
            closestPlayer = player;
          }
        }
        mob._wanderReaim = (mob._wanderReaim || 0) - deltaTime;
        if (closestPlayer && mob._wanderReaim <= 0) {
          mob.targetAngle = Math.atan2(closestPlayer.y - mob.y, closestPlayer.x - mob.x);
          mob._wanderReaim = 0.2;
        }
        if (mob.moveTimer <= 0 && !mob.isTurning) {
          mob.targetAngle = Math.random() * Math.PI * 2;
          mob.moveTimer = Math.random() * 3 + 2;
          mob.isTurning = true;
        } else {
          mob.moveTimer -= deltaTime;
        }
      } else if (mob.currentBehavior === 'chase') {
        if (mob.chaseTimer <= 0) {
          const targetPlayer = players[mob.targetPlayerId];
          if (targetPlayer) {
            const dx = targetPlayer.x - mob.x;
            const dy = targetPlayer.y - mob.y;
            mob.targetAngle = Math.atan2(dy, dx);
            mob.chaseTimer = 0.5;
          }
        } else {
          mob.chaseTimer -= deltaTime;
        }
      }

      const angleDiff = normalizeAngle(mob.targetAngle - mob.facingAngle);
      const turning = Math.abs(angleDiff) > 0.01;
      if (turning) {
        const maxTurn = mob.turnSpeed * deltaTime;
        mob.facingAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
        mob.isTurning = true;
      } else {
        mob.facingAngle = mob.targetAngle;
        mob.isTurning = false;
      }

      if (!mob.isTurning) {
        // Base intended movement from AI
        let moveDx = Math.cos(mob.facingAngle) * mob.moveSpeed * deltaTime;
        let moveDy = Math.sin(mob.facingAngle) * mob.moveSpeed * deltaTime;

        // Apply knockback velocity if active
        if (mob.kbTimer && mob.kbTimer > 0) {
          moveDx += (mob.kbVx || 0) * deltaTime;
          moveDy += (mob.kbVy || 0) * deltaTime;
          // Faster damping for snappier knockback
          const damp = 2.8; // increased damping for more responsive feel
          mob.kbVx *= Math.max(0, 1 - damp * deltaTime);
          mob.kbVy *= Math.max(0, 1 - damp * deltaTime);
          mob.kbTimer -= deltaTime;
          if (mob.kbTimer <= 0 || (Math.abs(mob.kbVx) + Math.abs(mob.kbVy)) < 3) {
            mob.kbTimer = 0;
            mob.kbVx = 0;
            mob.kbVy = 0;
          }
        }

        const newX = mob.x + moveDx;
        const newY = mob.y + moveDy;

        const minX = 0;
        const minY = 0;
        const maxX = WORLD_SIZE - mobSize;
        const maxY = WORLD_SIZE - mobSize;

      

        // Allow mobs to overlap resources and other mobs by a margin
        const overlapMargin = mobSize * 0.4; // 40% overlap allowed
        // Helper to get center coordinates
        function getCenter(x, y, size) {
          return { cx: x + size / 2, cy: y + size / 2 };
        }
        // Centered collision check for resources
        function isCollidingWithResourcesCentered(newX, newY, size, allResources) {
          const { cx, cy } = getCenter(newX, newY, size);
          const all = Object.values(allResources).flat();
          return all.some(resource => {
            if (resource.sizeX > 0 && resource.sizeY > 0) {
              const rcx = resource.x + resource.sizeX / 2;
              const rcy = resource.y + resource.sizeY / 2;
              const minDistX = (size + resource.sizeX) / 2 - overlapMargin;
              const minDistY = (size + resource.sizeY) / 2 - overlapMargin;
              return Math.abs(cx - rcx) < minDistX && Math.abs(cy - rcy) < minDistY;
            }
            return false;
          });
        }
        function isCollidingWithMobsCentered(newX, newY, size, selfMob) {
          const { cx, cy } = getCenter(newX, newY, size); // Center of moving mob's full size
          const allMobs = Object.values(mobs).flat();
          return allMobs.some(otherMob => {
            if (otherMob !== selfMob && otherMob.size > 0) {
              const mobColliderSize = otherMob.size * 0.4; // Use 60% of otherMob.size as collider size
              const offset = (otherMob.size - mobColliderSize) / 2; // Offset to center the collider
              const ocx = otherMob.x + offset + mobColliderSize / 2; // Center X of other mob's collider
              const ocy = otherMob.y + offset + mobColliderSize / 2; // Center Y of other mob's collider
              const minDistX = (size + mobColliderSize) / 2 - overlapMargin;
              const minDistY = (size + mobColliderSize) / 2 - overlapMargin;
              return Math.abs(cx - ocx) < minDistX && Math.abs(cy - ocy) < minDistY;
            }
            return false;
          });
        }
        // Centered collision check for players
        function isCollidingWithPlayersCentered(newX, newY, size, players) {
          const { cx, cy } = getCenter(newX, newY, size);
          return Object.values(players).some(player => {
            if (player.size > 0) {
              const playerColliderSize = player.size * 0.6;
              const offset = (player.size - playerColliderSize) / 2; // Center the smaller collider
              const playerCenterX = player.x + offset + playerColliderSize / 2;
              const playerCenterY = player.y + offset + playerColliderSize / 2;
              const minDistX = (size + playerColliderSize) / 2 - overlapMargin;
              const minDistY = (size + playerColliderSize) / 2 - overlapMargin;
              return Math.abs(cx - playerCenterX) < minDistX && Math.abs(cy - playerCenterY) < minDistY;
            }
            return false;
          });
        }

        const collideX = isCollidingWithResourcesCentered(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          allResources
        ) || isCollidingWithMobsCentered(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          mob
        ) || isCollidingWithPlayersCentered(
          Math.max(minX, Math.min(maxX, newX)),
          Math.max(minY, Math.min(maxY, mob.y)),
          mobSize,
          players
        );

        const collideY = isCollidingWithResourcesCentered(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          allResources
        ) || isCollidingWithMobsCentered(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          mob
        ) || isCollidingWithPlayersCentered(
          Math.max(minX, Math.min(maxX, mob.x)),
          Math.max(minY, Math.min(maxY, newY)),
          mobSize,
          players
        );

        if (!collideX) mob.x = Math.max(minX, Math.min(maxX, newX));
        if (!collideY) mob.y = Math.max(minY, Math.min(maxY, newY));
        // If both axes blocked (likely tight overlap) attempt gentle separation (mobs first, then resources)
  if (collideX && collideY) {
          const { cx, cy } = getCenterPos(mob.x, mob.y, mobSize);
          let bestSep = null;
          let bestScore = 0;
          // Prefer separating from overlapping mobs
          for (const other of Object.values(mobs).flat()) {
            if (other === mob || other.size <= 0) continue;
            const otherColliderSize = other.size * 0.4;
            const offset = (other.size - otherColliderSize) / 2;
            const ocx = other.x + offset + otherColliderSize / 2;
            const ocy = other.y + offset + otherColliderSize / 2;
            const minDistX = (mobSize + otherColliderSize) / 2 - overlapMargin;
            const minDistY = (mobSize + otherColliderSize) / 2 - overlapMargin;
            const dx = cx - ocx;
            const dy = cy - ocy;
            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            if (adx < minDistX && ady < minDistY) {
              const overlapX = minDistX - adx;
              const overlapY = minDistY - ady;
              const score = overlapX * overlapY;
              if (score > bestScore) {
                bestScore = score;
                bestSep = { dx, dy, overlapX, overlapY };
              }
            }
          }
          // If still stuck, push away from overlapping resources (trees/rocks)
          if (!bestSep) {
            for (const res of Object.values(allResources).flat()) {
              if (!res || res.sizeX <= 0 || res.sizeY <= 0) continue;
              const rcx = res.x + res.sizeX / 2;
              const rcy = res.y + res.sizeY / 2;
              const minDistX = (mobSize + res.sizeX) / 2 - overlapMargin;
              const minDistY = (mobSize + res.sizeY) / 2 - overlapMargin;
              const dx = cx - rcx;
              const dy = cy - rcy;
              const adx = Math.abs(dx);
              const ady = Math.abs(dy);
              if (adx < minDistX && ady < minDistY) {
                const overlapX = minDistX - adx;
                const overlapY = minDistY - ady;
                const score = overlapX * overlapY;
                if (score > bestScore) {
                  bestScore = score;
                  bestSep = { dx, dy, overlapX, overlapY };
                }
              }
            }
          }
          if (bestSep) {
            if (bestSep.overlapX < bestSep.overlapY) {
              const push = bestSep.overlapX * 0.6;
              mob.x += (bestSep.dx >= 0 ? push : -push);
            } else {
              const push = bestSep.overlapY * 0.6;
              mob.y += (bestSep.dy >= 0 ? push : -push);
            }
            mob.x = Math.max(minX, Math.min(maxX, mob.x));
            mob.y = Math.max(minY, Math.min(maxY, mob.y));
          }
        }

        // Final guarantee: if still overlapping any resource (e.g., due to idle server/no players),
        // push the mob out along the least-penetration axis so it can't remain stuck inside.
        if (mobCollideResourcesCentered(mob.x, mob.y, mobSize, allResources, overlapMargin)) {
          const { cx, cy } = getCenterPos(mob.x, mob.y, mobSize);
          let bestRes = null;
          let bestScore = 0;
          for (const res of Object.values(allResources).flat()) {
            if (!res || res.sizeX <= 0 || res.sizeY <= 0) continue;
            const rcx = res.x + res.sizeX / 2;
            const rcy = res.y + res.sizeY / 2;
            const minDistX = (mobSize + res.sizeX) / 2 - overlapMargin;
            const minDistY = (mobSize + res.sizeY) / 2 - overlapMargin;
            const dx = cx - rcx;
            const dy = cy - rcy;
            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            if (adx < minDistX && ady < minDistY) {
              const overlapX = minDistX - adx;
              const overlapY = minDistY - ady;
              const score = overlapX * overlapY;
              if (score > bestScore) {
                bestScore = score;
                bestRes = { dx, dy, overlapX, overlapY };
              }
            }
          }
          if (bestRes) {
            if (bestRes.overlapX < bestRes.overlapY) {
              const push = bestRes.overlapX * 0.8; // stronger push to fully clear resource
              mob.x += (bestRes.dx >= 0 ? push : -push);
            } else {
              const push = bestRes.overlapY * 0.8;
              mob.y += (bestRes.dy >= 0 ? push : -push);
            }
            mob.x = Math.max(minX, Math.min(maxX, mob.x));
            mob.y = Math.max(minY, Math.min(maxY, mob.y));
          }
        }
      }

      if (config.isAggressive && mob.currentBehavior === 'chase' && mob.damageCooldown <= 0 && mob.health > 0) {
        const targetPlayer = players[mob.targetPlayerId];
        if (targetPlayer) {
          if (checkOverlap(mob.x, mob.y, mob.size, mob.size, targetPlayer.x, targetPlayer.y, targetPlayer.size, targetPlayer.size)) {
            const damage = mob.damage;
            targetPlayer.health -= damage;
            targetPlayer.lastDamageTime = Date.now();
            if (!targetPlayer.originalColor) {
              targetPlayer.originalColor = targetPlayer.color || "defaultColor";
            }

            targetPlayer.color = "rgba(255, 0, 0, 0.5)";
            setTimeout(() => {
              targetPlayer.color = targetPlayer.originalColor;
            }, 100);

            if (targetPlayer.health <= 0) targetPlayer.health = 0;
            // Damage cooldown scales with mob attackspeed (higher attackspeed => shorter cooldown)
            const atk = mob.attackspeed || 1;
            mob.damageCooldown = Math.max(0.1, 1 / atk);
                // Emit knockback event using stored socketId
                if (ioRef && targetPlayer.socketId) {
                  ioRef.to(targetPlayer.socketId).emit('playerKnockback', {
                    mobX: mob.x,
                    mobY: mob.y,
                    mobId: mob.id || null
                  });
                }
          }
        }
      }
    }
  }
}


function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function checkOverlap(x1, y1, sizeX1, sizeY1, x2, y2, sizeX2, sizeY2) {
  return (
    x1 < x2 + sizeX2 &&
    x1 + sizeX1 > x2 &&
    y1 < y2 + sizeY2 &&
    y1 + sizeY1 > y2
  );
}


window.tryHitMob = tryHitMob;
