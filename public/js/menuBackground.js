// Animated idle background for main menu
(function() {
  const canvas = document.getElementById('menuBgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set canvas size to fill window
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Load grass texture
  const grassImg = new Image();
  grassImg.src = 'grass.png';

  // Animation state
  let offsetX = 0;
  let offsetY = 0;
  const speed = 0.02; // slower movement

  function drawBackground() {
    if (!grassImg.complete) {
      ctx.fillStyle = '#6bbf4e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    // Zoom in: scale up grass tiles even more
  const tileSize = 512;
  const scale = 6; // slightly lower scale to reduce draw count
    offsetX += speed;
    offsetY += speed * 0.5;
    if (offsetX > tileSize) offsetX -= tileSize;
    if (offsetY > tileSize) offsetY -= tileSize;
    ctx.save();
    ctx.scale(scale, scale);
    for (let x = -tileSize; x < canvas.width / scale + tileSize; x += tileSize) {
      for (let y = -tileSize; y < canvas.height / scale + tileSize; y += tileSize) {
        ctx.drawImage(grassImg, x + offsetX, y + offsetY, tileSize, tileSize);
      }
    }
    ctx.restore();
  }

  function animate() {
    // Show background if any menu is visible (not gameplay), but NOT for dropAmountPrompt
    const menuIds = [
      'homePage',
      'serverJoin',
      'localLAN',
      'hostPrompt',
      'joinLocalPrompt',
      'nameEntry',
      'deathScreen'
    ];
    let anyMenuVisible = false;
    for (const id of menuIds) {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        anyMenuVisible = true;
        break;
      }
    }
    // Hide menu background if dropAmountPrompt is visible
    const dropPrompt = document.getElementById('dropAmountPrompt');
    if (dropPrompt && dropPrompt.style.display !== 'none') {
      anyMenuVisible = false;
    }
    const shouldShow = anyMenuVisible;
    canvas.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
      drawBackground();
    }
    requestAnimationFrame(animate);
  }

  grassImg.onload = animate;
  if (grassImg.complete) animate();
})();
