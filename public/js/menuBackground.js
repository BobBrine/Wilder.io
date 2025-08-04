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
  const speed = 0.025; // even slower movement

  function drawBackground() {
    if (!grassImg.complete) {
      ctx.fillStyle = '#6bbf4e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    // Zoom in: scale up grass tiles even more
    const tileSize = 512; // much bigger tile size for zoom
    const scale = 8; // much larger scale factor for zoom
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
    // Show background if any menu is visible (not gameplay)
    const menuIds = [
      'homePage',
      'serverJoin',
      'localLAN',
      'hostPrompt',
      'joinLocalPrompt',
      'nameEntry',
      'deathScreen',
      'dropAmountPrompt'
    ];
    let anyMenuVisible = false;
    for (const id of menuIds) {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        anyMenuVisible = true;
        break;
      }
    }
    canvas.style.display = anyMenuVisible ? 'block' : 'none';
    if (canvas.style.display === 'block') {
      drawBackground();
    }
    requestAnimationFrame(animate);
  }

  grassImg.onload = animate;
  if (grassImg.complete) animate();
})();
