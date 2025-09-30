// Ensure mouseX and mouseY are defined globally
if (typeof mouseX === 'undefined') window.mouseX = 0;
if (typeof mouseY === 'undefined') window.mouseY = 0;
// ...existing code...
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;
let lastUpdate = performance.now();
let tickTimeout = null;

function update() {
  const now = performance.now();
  let deltaTime = (now - lastUpdate) / 1000;
  if (deltaTime > 0.25) deltaTime = 0.25;

  // If we're not actively in gameplay (e.g., menu shown), skip world updates
  try {
    if (typeof isInGameplay === 'function' && !isInGameplay()) {
      // Keep timebase fresh to avoid a huge delta on resume
      lastUpdate = now;
      requestAnimationFrame(update);
      return;
    }
  } catch (_) {
    // If isInGameplay not available, fall through and update normally
  }

  // --- Advance day/night time offline (server will override when connected) ---
  try {
    const hasServer = !!(window.socket && window.socket.connected);
    if (!hasServer) {
      // Prefer smooth frame-based time over the old interval ticker
      if (window.__offlineTimeTicker) { try { clearInterval(window.__offlineTimeTicker); } catch(_) {} window.__offlineTimeTicker = null; }
      const dayLen = (typeof DAY_LENGTH === 'number' ? DAY_LENGTH : 120);
      const cycle = Math.max(1, dayLen * 2); // one full day+night cycle in seconds
      // Accumulate total seconds and advance cyclical gameTime
      window.__totalGameSeconds = (window.__totalGameSeconds || 0) + deltaTime;
      gameTime = (((typeof gameTime === 'number' ? gameTime : 0) + deltaTime) % cycle);
      // Compute Day as completed full cycles
      const currentCycles = Math.floor((window.__totalGameSeconds || 0) / cycle);
      if (typeof Day === 'undefined' || typeof Day !== 'number') { window.Day = 0; }
      window.Day = currentCycles;
    }
  } catch(_) {}

  updateFPSCounter();

  // --- Clear once per frame in device pixels ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Update game state (no camera math here) ---
  // Spectator: move camera independently instead of player
  try { if (window.isSpectator && window.isSpectator()) { window.updateSpectatorCamera?.(deltaTime); } else { updatePlayerPosition(deltaTime); } } catch (_) { updatePlayerPosition(deltaTime); }
  if (!(window.isSpectator && window.isSpectator())) staminaRegen(deltaTime);
  if (!(window.isSpectator && window.isSpectator())) updatePlayerFacing(mouseX, mouseY);
  updateMobRespawns(deltaTime, window.allResources, playersMap, gameTime);
  // updateMobs(window.allResources, playersMap, deltaTime);
  // Always tick dropped items timers (so they despawn/blink in spectator too)
  try { if (typeof updateDroppedItems === 'function') updateDroppedItems(deltaTime); } catch(_) {}

  // Mobile auto-hit helper (spectator can't attack)
  try {
    const mode = (window.controlsSettings?.getMode?.() || 'pc');
    if (mode === 'mobile' && !(window.isSpectator && window.isSpectator()) && window.mobileControls?.aim?.()) {
      const aim = window.mobileControls.aim();
      if (aim.active && typeof tryHitResource === 'function') tryHitResource();
    }
  } catch (_){}

  // --- WORLD PASS (scaled & translated to camera) ---
  ctx.save();
  beginWorldTransform();          // sets scale + (-camera.x,-camera.y), updates camera.w/h

  drawBackground();
  if (typeof drawPlacedBlocks === 'function') drawPlacedBlocks(ctx);
  if (typeof drawPlacementEffects === 'function') drawPlacementEffects();

  // draw order as you prefer
  drawResources();
  if (typeof drawDroppedItems === 'function') drawDroppedItems();
  drawMob();
  if (!(window.isSpectator && window.isSpectator())) drawPlayer();
  drawWorldBorder();

  // World-space helpers that should scale with zoom
  drawDamageTexts();

  // Hotbar placement preview is world-space, so keep it here
  if (hotbar && hotbar.selectedIndex !== null && hotbar.slots[hotbar.selectedIndex]) {
    const selectedType = hotbar.slots[hotbar.selectedIndex].type;
    if (typeof drawBlockPlacementPreview === 'function') {
      drawBlockPlacementPreview(ctx, player, selectedType);
    }
  }

  ctx.restore(); // leave world space

  // --- UI PASS (fixed to screen) ---
  beginUITransform();             // sets DPR-only transform; UI in CSS pixels

  drawTimeIndicator();
  drawFPSCounter();
  drawCreatorTag();
  drawStaminaBar();
  drawHUD();
  drawHotbar();
  drawCraftingUI();
  drawMessage();
  // drawButtons(); // if you want

  lastUpdate = now;
  requestAnimationFrame(update);
}
update();
