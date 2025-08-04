const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Make canvas fill the browser window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const WORLD_SIZE = 5000;
const backgroundImage = new Image();
backgroundImage.src = 'grass.png'; // must be 5000x5000

// This will draw the image once at 0,0
backgroundImage.onload = function () {
  drawBackground();
};

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(backgroundImage, 0, 0); // No scaling or repetition
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
