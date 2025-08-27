const canvas = document.getElementById("gameCanvas");
// Prefer a desynchronized, opaque context to reduce compositor latency and blending cost
window.canvas = document.getElementById("gameCanvas");
window.ctx = window.canvas.getContext("2d", { alpha: false, desynchronized: true });
// Reduce filtering cost when scaling images
ctx.imageSmoothingEnabled = false;

// Make canvas fill the browser window (CSS) and allow lower internal resolution via renderScale
function resizeCanvas() {
    const scale = (window.graphicsSettings && typeof window.graphicsSettings.renderScale === 'number')
      ? Math.max(0.5, Math.min(1, window.graphicsSettings.renderScale))
      : 1;
    // CSS size (visual size)
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    // Backing store size (internal resolution)
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    // Reset any transforms that might be set during draws
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ...existing code...
const backgroundImage = new Image();
backgroundImage.src = 'images/grass.png'; // must be 5000x5000

// This will draw the image once at 0,0
backgroundImage.onload = function () {
  drawBackground();
};

function drawBackground() {
  ctx.save();
  // Always paint a dark-green base so uncovered areas aren't black (alpha:false context)
  const baseColor = '#116d10'; // dark green
  // If camera isn't ready yet (during initial load), draw full-canvas base and optional image
  if (typeof camera === 'undefined' || camera == null) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (backgroundImage.complete) ctx.drawImage(backgroundImage, 0, 0);
    ctx.restore();
    return;
  }
  // With camera active, fill the current viewport in world coords first
  ctx.fillStyle = baseColor;
  ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height);
  if (!backgroundImage.complete) { ctx.restore(); return; }
  // Only draw the visible portion of the background (viewport) in world space
  // World transform is already applied by main.js before calling drawBackground.
  // Compute source rect based on camera viewport to avoid drawing the entire 5000x5000 each frame.
  const viewX = Math.max(0, Math.min(camera.x, backgroundImage.width - canvas.width));
  const viewY = Math.max(0, Math.min(camera.y, backgroundImage.height - canvas.height));
  const viewW = Math.min(canvas.width, backgroundImage.width - viewX);
  const viewH = Math.min(canvas.height, backgroundImage.height - viewY);

  // Draw the subsection of the background image mapped 1:1 into world coords over the base
  ctx.drawImage(
    backgroundImage,
    viewX, viewY, viewW, viewH,
    viewX, viewY, viewW, viewH
  );
  ctx.restore();
}

//button
let uiButtons = [];
function createButton(x, y, text, callback, image = null) {
  const button = {
    x: x,
    y: y,
    text: text,
    image: image,
    width: image ? image.width : 100,
    height: image ? image.height : 40,
    callback: callback
  };
  uiButtons.push(button);
}

// Helper: check if a world-space rectangle is visible on screen (with optional margin)
function isWorldRectOnScreen(x, y, w, h, margin = 64) {
  if (typeof camera === 'undefined' || !camera) return true;
  const camX = camera.x - margin,
        camY = camera.y - margin,
        camW = camera.width + margin * 2,
        camH = camera.height + margin * 2;
  return x < camX + camW && x + w > camX && y < camY + camH && y + h > camY;
}

const camera = {
  x: 0,
  y: 0,
  width: canvas.width,
  height: canvas.height
};

function updateCamera() {
  if (!player) return;
  // Center the camera on the player
  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;

  camera.x = Math.max(-100, Math.min(camera.x, WORLD_SIZE - canvas.width + 100));
  camera.y = Math.max(-100, Math.min(camera.y, WORLD_SIZE - canvas.height + 100));
  camera.width = canvas.width;
  camera.height = canvas.height;
}

