
let difficultyProgression = Number(localStorage.getItem('difficulty.progression') || '0');


function startGame() {
  // Hide the menu panel
  document.getElementById('singlePlayerMenu').style.display = 'none';
  document.getElementById('bgHomepage').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  player = createNewPlayer();
  spawnAllResources();
  console.log('Player created:', player); 
}