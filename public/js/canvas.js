const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Make canvas fill the browser window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

// Resize canvas when window is resized
window.addEventListener('resize', resizeCanvas);

const WORLD_SIZE = 5000;
