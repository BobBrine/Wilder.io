const canvas = document.getElementById("gameCanvas");
// Prefer a desynchronized, opaque context to reduce compositor latency and blending cost
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
// Reduce filtering cost when scaling images
ctx.imageSmoothingEnabled = false;

// Make canvas fill the browser window (CSS) and allow lower internal resolution via renderScale
window.zoom = window.zoom ?? 1;              // eg. 0.5 .. 3
const qualityScale = (window.graphicsSettings?.renderScale ?? 1); // optional

function beginWorldTransform() {
  const dpr = window.devicePixelRatio || 1;
  const scale = dpr * qualityScale * (window.zoom || 1);

  // IMPORTANT: camera dimensions in WORLD units
  camera.width  = canvas.width  / scale;
  camera.height = canvas.height / scale;

  // Center camera on player in WORLD space
  if (player) {
    camera.x = player.x - camera.width  / 2;
    camera.y = player.y - camera.height / 2;
  }

  // Clamp in WORLD space
  camera.x = Math.max(-100, Math.min(camera.x, WORLD_SIZE - camera.width  + 100));
  camera.y = Math.max(-100, Math.min(camera.y, WORLD_SIZE - camera.height + 100));

  // Scale then translate so (camera.x,camera.y) appears at (0,0) in device space
  // Use rounded translation to avoid subpixel “shimmer”
  const tx = Math.round(-camera.x * scale);
  const ty = Math.round(-camera.y * scale);
  ctx.setTransform(scale, 0, 0, scale, tx, ty);
  ctx.imageSmoothingEnabled = false;
}
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  // CSS size
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  // Internal bitmap = CSS × DPR (no renderScale here)
  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  // Draw UI in CSS pixels later using dpr transform
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
let gameTime = 0;
const CYCLE_LENGTH = 120;
const DAY_LENGTH = 120;
let lastDayIncrement = false;
let difficulty = 1; 
let Day = 0;
const WORLD_SIZE = 5000;

const GRID_CELL_SIZE = 100;
const GRID_COLS = Math.floor(WORLD_SIZE / GRID_CELL_SIZE);
const GRID_ROWS = Math.floor(WORLD_SIZE / GRID_CELL_SIZE);
const backgroundImage = new Image();
backgroundImage.src = '../images/grass.png'; // must be 5000x5000

// This will draw the image once at 0,0
backgroundImage.onload = function () {
  drawBackground();
};

function drawBackground() {
  ctx.save();

  const baseColor = '#116d10';

  // If camera isn't ready yet, fill using CSS pixels (DPR-aware)
  if (!camera) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // In UI/default transform, canvas is scaled by DPR, so use CSS sizes
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, cssW, cssH);

    if (backgroundImage.complete) {
      // Draw at native size; it's fine during the very first frame
      ctx.drawImage(backgroundImage, 0, 0);
    }
    ctx.restore();
    return;
  }

  // From here on, we assume WORLD TRANSFORM is active (beginWorldTransform() already called)

  // Fill the current viewport in WORLD units
  const viewW = camera.width;
  const viewH = camera.height;
  ctx.fillStyle = baseColor;
  ctx.fillRect(camera.x, camera.y, viewW, viewH);

  if (!backgroundImage.complete) { ctx.restore(); return; }

  // Clamp source rect in IMAGE space using WORLD viewport
  const srcX = Math.max(0, Math.min(camera.x, backgroundImage.width  - viewW));
  const srcY = Math.max(0, Math.min(camera.y, backgroundImage.height - viewH));
  const srcW = Math.min(viewW, backgroundImage.width  - srcX);
  const srcH = Math.min(viewH, backgroundImage.height - srcY);

  // Draw 1:1 in WORLD space
  ctx.drawImage(
    backgroundImage,
    srcX, srcY, srcW, srcH,
    srcX, srcY, srcW, srcH
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

