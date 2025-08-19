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
