// soul.js - Handles the Soul currency (local persistent)
(function() {
  const SOUL_KEY = 'currency.soul';
  function getSoul() {
    return Number(localStorage.getItem(SOUL_KEY) || '0');
  }
  function setSoul(val) {
    localStorage.setItem(SOUL_KEY, String(Math.max(0, Math.floor(val))));
    window.dispatchEvent(new CustomEvent('soulChanged'));
  }
  function addSoul(amount) {
    setSoul(getSoul() + amount);
  }
  function resetSoul() {
    setSoul(0);
    // Also reset difficulty progression
    try {
      localStorage.setItem('difficulty.progression', '0');
      if (typeof window.difficultyProgression !== 'undefined') window.difficultyProgression = 0;
      window.dispatchEvent(new CustomEvent('difficultyProgressionChanged'));
    } catch(_) {}
  }
  // Expose API
  window.soulCurrency = {
    get: getSoul,
    set: setSoul,
    add: addSoul,
    reset: resetSoul
  };
  // Listen for reset button (if present)
  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('resetSoulBtn');
    if (btn) btn.onclick = resetSoul;
  });
})();
