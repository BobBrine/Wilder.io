let lastUpdate = performance.now();
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawWroldborder()
{
  ctx.strokeStyle = "red"; // or any color you want
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function update() {
  const now = performance.now();
  const deltaTime = (now - lastUpdate) / 1000;
  if (!player || !resourcesLoaded)  {
    requestAnimationFrame(update);
    return;
  }
  

  updateFPSCounter();

  
  clearCanvas();
 

  
  
  updatePlayerPosition(deltaTime);
  sendPlayerPosition(player.x, player.y);
  staminaRegen(deltaTime);
  updateCamera();
  updatePlayerFacing(mouseX, mouseY);


  ctx.save();
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y); 
  //enviroment
  draw(); 
  drawWroldborder();
  drawPlayer();
  drawOtherPlayers();
  
  ctx.restore();
  
  //ui
  if (gameTime >= DAY_LENGTH) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Slightly darker overlay
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLightSources();
  }
  drawTimeIndicator();

  drawFPSCounter(); 
  drawCreatorTag();
  drawDamageTexts();
  drawStaminaBar();

  drawHUD();
  drawHotbar();
  drawCraftingUI();
  drawMessage();

  requestAnimationFrame(update);
  lastUpdate = now;
}

update();
