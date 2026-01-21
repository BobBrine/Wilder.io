// Emergency bypass for save system if it causes white screen
// Simply paste this into the browser console to disable save system and restore normal play

console.log('Bypassing save system...');

// Restore original Play button behavior
function restoreOriginalPlay() {
  const playBtn = document.getElementById('spPlayBtn');
  if (playBtn) {
    playBtn.onclick = function() {
      // Hide menu
      const menu = document.getElementById('singlePlayerMenu');
      const bg = document.getElementById('bgHomepage');
      if (menu) menu.style.display = 'none';
      if (bg) bg.style.display = 'none';
      
      // Show game
      const gameCanvas = document.getElementById('gameCanvas');
      if (gameCanvas) {
        gameCanvas.style.display = 'block';
        gameCanvas.style.pointerEvents = 'auto';
      }
      
      // Start game
      if (window.startGame) {
        window.startGame();
      } else if (window.CreateRespawnPlayer) {
        window.CreateRespawnPlayer();
      }
    };
    console.log('Original Play button restored');
  }
}

// Try to restore immediately and also after a short delay
restoreOriginalPlay();
setTimeout(restoreOriginalPlay, 1000);