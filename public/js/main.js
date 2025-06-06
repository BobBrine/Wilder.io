const now = Date.now();
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

function update(now = performance.now()) {
  if (!player || !resourcesLoaded)  {
    requestAnimationFrame(update);
    return;
  }

  updateFPSCounter();

  const deltaTime = (now - lastUpdate) / 1000; 
  lastUpdate = now;

  clearCanvas();

  
  
  updatePlayerPosition();
  sendPlayerPosition(player.x, player.y);

  updateCamera();
  updatePlayerFacing(mouseX, mouseY);


  ctx.save();
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y); 
  //enviroment
  drawWroldborder();
  draw(); //test
  drawPlayer();
  drawOtherPlayers();
  
  ctx.restore();
  
  //ui
  drawFPSCounter(); 
  drawDamageTexts();
  drawHUD();
  drawHotbar();
  drawCraftingUI();
  drawMessage();

  requestAnimationFrame(update);
}

update();
