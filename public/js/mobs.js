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
