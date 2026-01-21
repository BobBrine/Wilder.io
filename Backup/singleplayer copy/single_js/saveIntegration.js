// Save System Integration Patch
// This file overrides certain functions to integrate with the save system

(function() {
  'use strict';

  // Override the bootstrap function to use save system
  function patchBootstrap() {
    const playBtn = document.getElementById('spPlayBtn');
    if (playBtn) {
      // Remove existing onclick handler
      playBtn.onclick = null;
      
      // Set new handler for save system
      playBtn.onclick = function() {
        try {
          if (window.SaveUI && window.SaveUI.showPlayerPanel) {
            window.SaveUI.showPlayerPanel();
          } else {
            // Fallback to original behavior if save system not loaded
            console.warn('Save system not loaded, using original startGame');
            if (window.startGame) {
              window.startGame();
            } else if (window.CreateRespawnPlayer) {
              window.CreateRespawnPlayer();
            }
            const gc = document.getElementById('gameCanvas');
            if (gc) gc.style.pointerEvents = 'auto';
          }
        } catch (e) {
          console.error('Save system failed, using fallback:', e);
          // Ultimate fallback
          try {
            if (window.startGame) {
              window.startGame();
            } else {
              // Show the game canvas at least
              const menu = document.getElementById('singlePlayerMenu');
              const bg = document.getElementById('bgHomepage');
              const gc = document.getElementById('gameCanvas');
              if (menu) menu.style.display = 'none';
              if (bg) bg.style.display = 'none';
              if (gc) {
                gc.style.display = 'block';
                gc.style.pointerEvents = 'auto';
              }
            }
          } catch (fallbackError) {
            console.error('All fallbacks failed:', fallbackError);
          }
        }
      };
    }
  }

  // Run patch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchBootstrap);
  } else {
    patchBootstrap();
  }

  // Also run patch after a short delay to ensure all scripts are loaded
  setTimeout(patchBootstrap, 100);
})();