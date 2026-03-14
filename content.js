// Drunk Walker - Content Script
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

console.log("Drunk Walker content script loaded.");

let hudElement = null;

function createHUD() {
  if (hudElement) return;
  
  hudElement = document.createElement('div');
  hudElement.id = 'drunk-walker-hud';
  hudElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: #0f0;
    font-family: 'Courier New', monospace;
    padding: 15px;
    border: 2px solid #0f0;
    border-radius: 8px;
    z-index: 99999;
    pointer-events: none;
    text-shadow: 0 0 5px #0f0;
    min-width: 200px;
  `;
  
  hudElement.innerHTML = `
  <h2 style="margin: 0 0 10px; border-bottom: 1px solid #0f0;">DRUNK WALKER v3.0</h2>
  <div id="dw-status" style="margin-bottom: 5px;">STATUS: IDLE</div>
  <div id="dw-target" style="margin-bottom: 5px;">TARGET: FORWARD</div>
  <div id="dw-mode" style="margin-bottom: 5px;">MODE: CLICK</div>
  <div id="dw-yolo" style="color: #ff00ff; display: none; font-weight: bold; margin-top: 5px; font-size: 1.2em;">🤪 YOLO MODE ACTIVE</div>
  `;
  document.body.appendChild(hudElement);
}

function updateHUD(status, targetType, isYolo, mode) {
  if (!hudElement) createHUD();
  
  document.getElementById('dw-status').innerText = `STATUS: ${status}`;
  document.getElementById('dw-target').innerText = `TARGET: ${targetType}`;
  document.getElementById('dw-mode').innerText = `MODE: ${mode}`;
  
  const yoloEl = document.getElementById('dw-yolo');
  yoloEl.style.display = isYolo ? 'block' : 'none';
  if (isYolo) {
    hudElement.style.borderColor = `hsl(${Date.now() % 360}, 100%, 50%)`; 
    hudElement.style.boxShadow = `0 0 10px hsl(${Date.now() % 360}, 100%, 50%)`;
  } else {
      hudElement.style.borderColor = '#0f0';
      hudElement.style.boxShadow = 'none';
  }
}

function glitchEffect() {
  const glitch = document.createElement('div');
  glitch.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(255, 0, 255, 0.1);
    z-index: 99998;
    pointer-events: none;
    mix-blend-mode: exclusion;
  `;
  document.body.appendChild(glitch);
  setTimeout(() => glitch.remove(), 100);
}

function simulateClick(x, y) {
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y
  };

  const mousedown = new MouseEvent('mousedown', eventOptions);
  const mouseup = new MouseEvent('mouseup', eventOptions);
  const click = new MouseEvent('click', eventOptions);

  const element = document.elementFromPoint(x, y) || document.body;

  element.dispatchEvent(mousedown);
  element.dispatchEvent(mouseup);
  element.dispatchEvent(click);
}

function simulateKeyPress(key) {
  const keyCodes = {
    ArrowUp: { keyCode: 38, code: 'ArrowUp' },
    ArrowLeft: { keyCode: 37, code: 'ArrowLeft' },
    ArrowDown: { keyCode: 40, code: 'ArrowDown' },
    ArrowRight: { keyCode: 39, code: 'ArrowRight' }
  };

  const { keyCode, code } = keyCodes[key] || { keyCode: 0, code: key };

  const eventOptions = {
    key: key,
    code: code,
    keyCode: keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    view: window,
    location: 2
  };

  const target = document.documentElement;

  target.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
  setTimeout(() => {
    target.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
  }, 50);
}

function isStreetView() {
  return window.location.href.includes('/@') && window.location.href.includes('3a,');
}

function isFullScreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}

let lastState = { isStreetView: false, isFullScreen: false, url: "" };
setInterval(() => {
  const currentIsStreetView = isStreetView();
  const currentIsFullScreen = isFullScreen();
  const currentUrl = window.location.href;

  if (currentIsStreetView !== lastState.isStreetView || currentIsFullScreen !== lastState.isFullScreen || currentUrl !== lastState.url) {
    lastState = { isStreetView: currentIsStreetView, isFullScreen: currentIsFullScreen, url: currentUrl };
    browserAPI.runtime.sendMessage({
      type: 'UPDATE_STATUS',
      payload: { isStreetView: currentIsStreetView, isFullScreen: currentIsFullScreen, urlChanged: true }
    });
  }
}, 1000);

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PERFORM_ACTION' || message.type === 'PERFORM_CLICK') {
    if (!isStreetView()) return;

    const { radius, isYoloMode, isKeyboardMode, isPanicMode, stuckCount } = message.payload;
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (!hudElement) createHUD();
    
    let status = isPanicMode ? `STUCK (${stuckCount})` : 'NAVIGATING';
    let targetType = 'FORWARD';
    let mode = isKeyboardMode ? 'KEYBOARD' : 'CLICK';

    if (isKeyboardMode) {
      if (isPanicMode) {
        targetType = 'TURN LEFT';
        simulateKeyPress('ArrowLeft');
      } else {
        targetType = 'FORWARD';
        simulateKeyPress('ArrowUp');
      }
      updateHUD(status, targetType, isYoloMode, mode);
      if (isYoloMode) glitchEffect();
    } else {
      const randomOffset = () => (Math.random() * 2 - 1) * (radius || 50);
      
      const clickX = width * 0.5 + randomOffset();
      const clickY = height * 0.7 + randomOffset();
      
      updateHUD(status, targetType, isYoloMode, mode);
      if (isYoloMode) glitchEffect();

      const marker = document.createElement('div');
      marker.style.cssText = `
        position: fixed;
        left: ${clickX}px; top: ${clickY}px;
        width: 20px; height: 20px;
        background: ${isYoloMode ? 'magenta' : 'cyan'};
        border-radius: 50%;
        transform: translate(-50%, -50%);
        z-index: 100000;
        pointer-events: none;
        opacity: 0.8;
        transition: transform 0.2s, opacity 0.5s;
      `;
      document.body.appendChild(marker);
      setTimeout(() => {
        marker.style.transform = 'translate(-50%, -50%) scale(2)';
        marker.style.opacity = '0';
        setTimeout(() => marker.remove(), 500);
      }, 50);

      simulateClick(clickX, clickY);
    }
  }
});
