// Simple on-screen joystick and action button for mobile
// Exposes window.mobileControls with properties:
// - axis: { x: -1..1, y: -1..1 }
// - isActive(): boolean
// - setVisible(bool)
// - getFacing(): number radians, based on last drag direction (fallbacks to 0)
// - attackPressed: boolean (momentary)

(function(){
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const LS_KEY_SCALE = 'controls.joystickScale';
  function loadScale(){ try { return Math.max(0.6, Math.min(1.6, parseFloat(localStorage.getItem(LS_KEY_SCALE) || '1'))); } catch(_) { return 1; } }
  function saveScale(v){ try { localStorage.setItem(LS_KEY_SCALE, String(v)); } catch(_) {} }
  const state = {
    x: 0,
    y: 0,
    active: false,
    lastAngle: 0,
    visible: false,
    sprint: false,
    aim: { x: 0, y: 0, active: false, angle: 0 },
    scale: loadScale(),
  moveTouchId: null,
  aimTouchId: null,
  };

  // Create DOM elements
  const root = document.createElement('div');
  root.id = 'mobileControls';
  root.style.position = 'fixed';
  root.style.inset = '0 0 0 0';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '1000';
  root.style.display = 'none';
  root.style.touchAction = 'none';

  const joyWrap = document.createElement('div');
  joyWrap.id = 'joystickWrap';
  joyWrap.style.position = 'absolute';
  joyWrap.style.left = '20px';
  joyWrap.style.bottom = '20px';
  joyWrap.style.width = `${140 * state.scale}px`;
  joyWrap.style.height = `${140 * state.scale}px`;
  joyWrap.style.borderRadius = '50%';
  joyWrap.style.background = 'rgba(0,0,0,0.25)';
  joyWrap.style.backdropFilter = 'blur(2px)';
  joyWrap.style.pointerEvents = 'auto';
  joyWrap.style.touchAction = 'none';

  const joyBase = document.createElement('div');
  joyBase.id = 'joystickBase';
  joyBase.style.position = 'absolute';
  joyBase.style.left = '0';
  joyBase.style.top = '0';
  joyBase.style.right = '0';
  joyBase.style.bottom = '0';
  joyBase.style.borderRadius = '50%';
  joyBase.style.border = '2px solid rgba(255,255,255,0.4)';

  const joyKnob = document.createElement('div');
  joyKnob.id = 'joystickKnob';
  joyKnob.style.position = 'absolute';
  joyKnob.style.left = '50%';
  joyKnob.style.top = '50%';
  joyKnob.style.width = `${56 * state.scale}px`;
  joyKnob.style.height = `${56 * state.scale}px`;
  joyKnob.style.borderRadius = '50%';
  joyKnob.style.background = 'rgba(255,255,255,0.5)';
  joyKnob.style.transform = 'translate(-50%, -50%)';

  // Sprint button
  const sprintBtn = document.createElement('div');
  sprintBtn.id = 'sprintBtn';
  sprintBtn.textContent = 'SPRINT';
  sprintBtn.style.position = 'absolute';
  sprintBtn.style.right = '20px';
  sprintBtn.style.bottom = '30px';
  // Circle button
  sprintBtn.style.width = `${80 * state.scale}px`;
  sprintBtn.style.height = `${80 * state.scale}px`;
  sprintBtn.style.borderRadius = '50%';
  sprintBtn.style.background = 'rgba(0,0,0,0.5)';
  sprintBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
  sprintBtn.style.color = '#fff';
  sprintBtn.style.display = 'flex';
  sprintBtn.style.alignItems = 'center';
  sprintBtn.style.justifyContent = 'center';
  sprintBtn.style.fontFamily = 'Arial, sans-serif';
  sprintBtn.style.fontWeight = 'bold';
  sprintBtn.style.userSelect = 'none';
  sprintBtn.style.pointerEvents = 'auto';
  sprintBtn.style.touchAction = 'none';

  // Aim joystick replaces HIT
  const aimWrap = document.createElement('div');
  aimWrap.id = 'aimWrap';
  aimWrap.style.position = 'absolute';
  aimWrap.style.right = '20px';
  // Position aim stick above the sprint circle
  aimWrap.style.bottom = `${80 * state.scale + 50}px`;
  aimWrap.style.width = `${120 * state.scale}px`;
  aimWrap.style.height = `${120 * state.scale}px`;
  aimWrap.style.borderRadius = '50%';
  aimWrap.style.background = 'rgba(0,0,0,0.22)';
  aimWrap.style.pointerEvents = 'auto';
  aimWrap.style.touchAction = 'none';

  const aimBase = document.createElement('div');
  aimBase.style.position = 'absolute';
  aimBase.style.left = 0; aimBase.style.top = 0; aimBase.style.right = 0; aimBase.style.bottom = 0;
  aimBase.style.borderRadius = '50%';
  aimBase.style.border = '2px solid rgba(255,255,255,0.35)';

  const aimKnob = document.createElement('div');
  aimKnob.style.position = 'absolute';
  aimKnob.style.left = '50%'; aimKnob.style.top = '50%';
  aimKnob.style.width = `${44 * state.scale}px`;
  aimKnob.style.height = `${44 * state.scale}px`;
  aimKnob.style.borderRadius = '50%';
  aimKnob.style.background = 'rgba(255,255,255,0.5)';
  aimKnob.style.transform = 'translate(-50%, -50%)';

  joyWrap.appendChild(joyBase);
  joyWrap.appendChild(joyKnob);
  root.appendChild(joyWrap);
  aimWrap.appendChild(aimBase);
  aimWrap.appendChild(aimKnob);
  root.appendChild(aimWrap);
  root.appendChild(sprintBtn);
  document.body.appendChild(root);

  function setVisible(v) {
    state.visible = !!v;
    root.style.display = v ? 'block' : 'none';
  }

  // Auto-show on touch devices once game starts; hidden on menus
  setVisible(false);

  // Joystick logic
  const maxRadius = 60 * state.scale; // movement radius from center
  let dragging = false;
  let startX = 0, startY = 0;

  function setKnob(dx, dy) {
    // clamp to circle
    const len = Math.hypot(dx, dy);
    const clampedLen = Math.min(len, maxRadius);
    const nx = len > 0 ? (dx / len) * clampedLen : 0;
    const ny = len > 0 ? (dy / len) * clampedLen : 0;
    joyKnob.style.transform = `translate(${nx}px, ${ny}px)`;
    joyKnob.style.left = '50%';
    joyKnob.style.top = '50%';
    const ax = nx / maxRadius;
    const ay = ny / maxRadius;
    state.x = ax;
    state.y = ay;
    state.active = (Math.abs(ax) + Math.abs(ay)) > 0.02;
    if (state.active) state.lastAngle = Math.atan2(ay, ax);
  }

  function resetKnob() {
    joyKnob.style.transform = 'translate(-50%, -50%)';
    joyKnob.style.left = '50%';
    joyKnob.style.top = '50%';
    state.x = 0; state.y = 0; state.active = false;
  }

  function getLocalPos(e, overrideXY) {
    const rect = joyWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x, y;
    if (overrideXY) { x = overrideXY.x; y = overrideXY.y; }
    else if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    else { x = e.clientX; y = e.clientY; }
    return { dx: x - cx, dy: y - cy };
  }

  function findTouchById(touches, id){
    if (!touches) return null;
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  }

  function onStart(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.changedTouches && e.changedTouches.length) {
      // Capture this touch for the movement joystick
      const t = e.changedTouches[0];
      state.moveTouchId = t.identifier;
      dragging = true;
      const { dx, dy } = getLocalPos(e, { x: t.clientX, y: t.clientY });
      setKnob(dx, dy);
    } else {
      dragging = true;
      const { dx, dy } = getLocalPos(e);
      setKnob(dx, dy);
    }
  }
  function onMove(e) {
    if (!dragging) return; e.preventDefault();
    if (state.moveTouchId !== null && (e.touches || e.changedTouches)) {
      const t = findTouchById(e.touches || e.changedTouches, state.moveTouchId);
      if (!t) return;
      const { dx, dy } = getLocalPos(e, { x: t.clientX, y: t.clientY });
      setKnob(dx, dy);
    } else {
      const { dx, dy } = getLocalPos(e);
      setKnob(dx, dy);
    }
  }
  function onEnd(e) {
    // Only intercept if this is our tracked touch (or if we were dragging with mouse)
    if (state.moveTouchId !== null && e.changedTouches && e.changedTouches.length) {
      const t = findTouchById(e.changedTouches, state.moveTouchId);
      if (!t) return; // not our touch ending
      e.preventDefault();
      state.moveTouchId = null;
      dragging = false;
      resetKnob();
    } else if (state.moveTouchId === null && dragging) {
      // mouse end when we had started dragging
      e.preventDefault();
      dragging = false;
      resetKnob();
    }
  }

  const opts = { passive: false };
  joyWrap.addEventListener('touchstart', onStart, opts);
  joyWrap.addEventListener('touchmove', onMove, opts);
  joyWrap.addEventListener('touchend', onEnd, opts);
  joyWrap.addEventListener('touchcancel', onEnd, opts);
  joyWrap.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  // Track movement joystick globally so it keeps working if finger leaves the knob area
  window.addEventListener('touchmove', onMove, opts);
  window.addEventListener('touchend', onEnd, opts);
  window.addEventListener('touchcancel', onEnd, opts);

  // Sprint button handlers (press-and-hold sprint)
  const sprintOn = (e) => { e.preventDefault(); e.stopPropagation(); state.sprint = true; sprintBtn.style.background = 'rgba(0,0,0,0.75)'; };
  const sprintOff = (e) => { e.preventDefault(); e.stopPropagation(); state.sprint = false; sprintBtn.style.background = 'rgba(0,0,0,0.5)'; };
  sprintBtn.addEventListener('touchstart', sprintOn, opts);
  sprintBtn.addEventListener('touchend', sprintOff, opts);
  sprintBtn.addEventListener('touchcancel', sprintOff, opts);
  sprintBtn.addEventListener('mousedown', sprintOn);
  sprintBtn.addEventListener('mouseup', sprintOff);
  sprintBtn.addEventListener('mouseleave', sprintOff);

  // Aim joystick
  const aimMax = 50 * state.scale;
  let aiming = false;
  function aimLocalPos(e, overrideXY){
    const rect = aimWrap.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    let x, y; if (overrideXY) { x = overrideXY.x; y = overrideXY.y; }
    else if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; } else { x = e.clientX; y = e.clientY; }
    return { dx: x - cx, dy: y - cy };
  }
  function setAim(dx, dy){
    const len = Math.hypot(dx, dy);
    const cl = Math.min(len, aimMax);
    const nx = len>0 ? (dx/len)*cl : 0;
    const ny = len>0 ? (dy/len)*cl : 0;
    aimKnob.style.transform = `translate(${nx}px, ${ny}px)`;
    aimKnob.style.left = '50%'; aimKnob.style.top = '50%';
    state.aim.x = nx/aimMax; state.aim.y = ny/aimMax; state.aim.active = (Math.abs(nx)+Math.abs(ny))>2;
    if (state.aim.active) { state.aim.angle = Math.atan2(state.aim.y, state.aim.x); state.lastAngle = state.aim.angle; }
  }
  function resetAim(){ aimKnob.style.transform = 'translate(-50%, -50%)'; aimKnob.style.left='50%'; aimKnob.style.top='50%'; state.aim = { x:0,y:0,active:false,angle: state.lastAngle }; }
  function aimStart(e){
    e.preventDefault(); e.stopPropagation();
    if (e.changedTouches && e.changedTouches.length) {
      const t = e.changedTouches[0];
      state.aimTouchId = t.identifier;
      aiming = true;
      const {dx,dy}=aimLocalPos(e, { x: t.clientX, y: t.clientY });
      setAim(dx,dy);
    } else {
      aiming = true; const {dx,dy}=aimLocalPos(e); setAim(dx,dy);
    }
    try{ if (typeof tryHitResource==='function') tryHitResource(); }catch(_){ }
  }
  function aimMove(e){
    if(!aiming) return; e.preventDefault();
    if (state.aimTouchId !== null && (e.touches || e.changedTouches)) {
      const t = findTouchById(e.touches || e.changedTouches, state.aimTouchId);
      if (!t) return;
      const {dx,dy}=aimLocalPos(e, { x: t.clientX, y: t.clientY });
      setAim(dx,dy);
    } else {
      const {dx,dy}=aimLocalPos(e); setAim(dx,dy);
    }
  }
  function aimEnd(e){
    // Only intercept if this is our tracked touch (or if we were aiming with mouse)
    if (state.aimTouchId !== null && e.changedTouches && e.changedTouches.length) {
      const t = findTouchById(e.changedTouches, state.aimTouchId);
      if (!t) return; // not our touch ending
      e.preventDefault();
      state.aimTouchId = null;
      aiming=false; resetAim();
    } else if (state.aimTouchId === null && aiming) {
      // mouse end when we had started aiming
      e.preventDefault();
      aiming=false; resetAim();
    }
  }
  aimWrap.addEventListener('touchstart', aimStart, opts);
  aimWrap.addEventListener('touchmove', aimMove, opts);
  aimWrap.addEventListener('touchend', aimEnd, opts);
  aimWrap.addEventListener('touchcancel', aimEnd, opts);
  aimWrap.addEventListener('mousedown', aimStart);
  window.addEventListener('mousemove', aimMove);
  window.addEventListener('mouseup', aimEnd);
  // Track aim joystick globally for robust multi-touch
  window.addEventListener('touchmove', aimMove, opts);
  window.addEventListener('touchend', aimEnd, opts);
  window.addEventListener('touchcancel', aimEnd, opts);

  window.mobileControls = {
    get axis(){ return { x: state.x, y: state.y }; },
    isActive(){ return state.active; },
    getFacing(){ return state.lastAngle; },
    isSprinting(){ return !!state.sprint; },
    aim(){ return { ...state.aim }; },
    setVisible,
    setScale(v){ const s = Math.max(0.6, Math.min(1.6, Number(v)||1)); state.scale = s; saveScale(s); try{ applyScale(); }catch(_){} },
  };

  function applyScale(){
    // Update sizes based on state.scale
    joyWrap.style.width = `${140 * state.scale}px`;
    joyWrap.style.height = `${140 * state.scale}px`;
    joyKnob.style.width = `${56 * state.scale}px`;
    joyKnob.style.height = `${56 * state.scale}px`;
  // Keep sprint as a circle
  sprintBtn.style.width = `${80 * state.scale}px`;
  sprintBtn.style.height = `${80 * state.scale}px`;
    aimWrap.style.width = `${120 * state.scale}px`;
    aimWrap.style.height = `${120 * state.scale}px`;
  // Keep aim stick offset above new circular sprint
  aimWrap.style.bottom = `${80 * state.scale + 50}px`;
    aimKnob.style.width = `${44 * state.scale}px`;
    aimKnob.style.height = `${44 * state.scale}px`;
  }
  applyScale();
})();
