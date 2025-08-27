// Sound settings
window.soundSettings = {
  muted: localStorage.getItem('sound.muted') === 'true',
  volume: parseInt(localStorage.getItem('sound.volume') || '100', 10)
};

// Play sound with current settings
function playSound(url) {
  if (window.soundSettings.muted) return null;
  
  const sound = new Audio(url);
  sound.volume = window.soundSettings.volume / 100;
  sound.play().catch(e => console.log("Audio play error:", e));
  return sound;
}

// Play select.wav on every button click
function playSelect() {
  playSound('../Sound/select1.wav');
}

function playChopTree() {
  playSound('../Sound/choptree.wav');
}
function playBlockBreak() {
  playSound('../Sound/blockbreak.wav');
}
function playEnemyHit() {
  playSound('../Sound/enemyhit6.wav');
}

function playEnemyDeath() {
  playSound('../Sound/enemydeath.wav');
}

function playPlayerHurt() {
  playSound('../Sound/playerhurt.wav');
}

function playPopClaim() {
  playSound('../Sound/popclaim.wav');
}

function playConsume() {
  playSound('../Sound/consume.wav');
}
function playCancel() {
  playSound('../Sound/cancal1.wav');
}

function playDeath() {
  playSound('../Sound/playerdeath.wav');
}

function playBlockPlace() {
    playSound('../Sound/placeblock.wav');
}

// Export for use in other scripts
window.playChopTree = playChopTree;
window.playEnemyHit = playEnemyHit;
window.playPlayerHurt = playPlayerHurt;
window.playPopClaim = playPopClaim;
window.playConsume = playConsume;
window.playSelect = playSelect;
window.playCancel = playCancel;
window.playDeath = playDeath;
window.playBlockPlace = playBlockPlace;