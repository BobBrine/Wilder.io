const camera = {
  x: 0,
  y: 0,
  width: canvas.width,
  height: canvas.height
};

function updateCamera() {
  // Center the camera on the player
  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;

  camera.x = Math.max(-100, Math.min(camera.x, WORLD_WIDTH - canvas.width + 100));
  camera.y = Math.max(-100, Math.min(camera.y, WORLD_HEIGHT - canvas.height + 100));
}
