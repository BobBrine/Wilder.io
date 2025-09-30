const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;
let lastUpdate = performance.now();
let tickTimeout = null;

function update() {
  const now = performance.now();
  let deltaTime = (now - lastUpdate) / 1000;
  if (deltaTime > 0.25) deltaTime = 0.25;

  updateFPSCounter();

  // --- Clear once per frame in device pixels ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Update game state (no camera math here) ---
  updatePlayerPosition(deltaTime);
  staminaRegen(deltaTime);
  updatePlayerFacing(mouseX, mouseY);
  updateMobRespawns(deltaTime, allResources, playersMap, gameTime);
  updateMobs(allResources, playersMap, deltaTime);

  // Mobile auto-hit helper (unchanged)
  try {
    const mode = (window.controlsSettings?.getMode?.() || 'pc');
    if (mode === 'mobile' && window.mobileControls?.aim?.()) {
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
  drawMob();
  drawPlayer();
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
