// Drunk Walker - Content Script

console.log("Drunk Walker content script loaded.");

// --- HUD & Visuals ---
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
    <h2 style="margin: 0 0 10px; border-bottom: 1px solid #0f0;">DRUNK WALKER v1.0</h2>
    <div id="dw-status" style="margin-bottom: 5px;">STATUS: IDLE</div>
    <div id="dw-wobble">WOBBLE: 0%</div>
    <div id="dw-panic" style="color: red; display: none; font-weight: bold; margin-top: 5px;">⚠️ PANIC MODE ⚠️</div>
    <div id="dw-yolo" style="color: #ff00ff; display: none; font-weight: bold; margin-top: 5px; font-size: 1.2em;">🤪 YOLO MODE ACTIVE</div>
  `;
  
  document.body.appendChild(hudElement);
}

function updateHUD(status, wobble, isPanic, isYolo) {
  if (!hudElement) createHUD();
  
  document.getElementById('dw-status').innerText = `STATUS: ${status}`;
  document.getElementById('dw-wobble').innerText = `WOBBLE: ${wobble}%`;
  
  const panicEl = document.getElementById('dw-panic');
  panicEl.style.display = isPanic ? 'block' : 'none';
  if (isPanic) {
    panicEl.style.transform = `scale(${1 + Math.random() * 0.2})`; // Pulse effect
  }

  const yoloEl = document.getElementById('dw-yolo');
  yoloEl.style.display = isYolo ? 'block' : 'none';
  if (isYolo) {
    hudElement.style.borderColor = `hsl(${Date.now() % 360}, 100%, 50%)`; // Rainbow border
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

// --- Core Logic ---

// Function to simulate a click at a given coordinate
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
  
  console.log(`[Drunk Walker] Clicked at (${x}, ${y}) on element:`, element);
}

// Function to extract position from Google Maps URL
function getPositionFromURL() {
  const url = window.location.href;
  // Regex to find lat/lng in URL: @56.2908486,43.9978324
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }
  return null;
}

// Check if Street View is active (URL should contain /data= or similar or specific panorama patterns)
function isStreetView() {
  return window.location.href.includes('/@') && window.location.href.includes('3a,');
}

function isFullScreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}

// Notify background about position changes
let lastState = { lat: null, lng: null, isStreetView: false, isFullScreen: false };
setInterval(() => {
  const currentPosition = getPositionFromURL();
  const currentIsStreetView = isStreetView();
  const currentIsFullScreen = isFullScreen();

  if (currentPosition && (currentPosition.lat !== lastState.lat || currentPosition.lng !== lastState.lng || currentIsStreetView !== lastState.isStreetView || currentIsFullScreen !== lastState.isFullScreen)) {
    lastState = { ...currentPosition, isStreetView: currentIsStreetView, isFullScreen: currentIsFullScreen };
    browser.runtime.sendMessage({
      type: 'UPDATE_POSITION',
      payload: { position: currentPosition, isStreetView: currentIsStreetView, isFullScreen: currentIsFullScreen }
    });
  }
}, 1000);

// Listen for click commands from background
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PERFORM_CLICK') {
    if (!isStreetView()) {
      console.warn("[Drunk Walker] Not in Street View mode!");
      return;
    }

    const { radius, isPanicMode, isYoloMode } = message.payload;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Show HUD
    if (!hudElement) createHUD();
    updateHUD('NAVIGATING', Math.round(Math.random() * 100), isPanicMode, isYoloMode);
    
    // Yolo visual effect
    if (isYoloMode) glitchEffect();

    const randomOffset = () => (Math.random() * 2 - 1) * radius;
    
    let clickX = width * 0.5 + randomOffset();
    let clickY = height * 0.7 + randomOffset();

    if (isPanicMode) {
      // Panic Mode: Shift target region to try and unstick
      // Maybe try the sides?
      const side = Math.random() > 0.5 ? 0.3 : 0.7; // Left or Right
      clickX = width * side + randomOffset();
      clickY = height * 0.6 + randomOffset();
      console.log(`[Drunk Walker] PANIC MODE! Clicking at side: ${side === 0.3 ? 'Left' : 'Right'}`);
    }

    // Visual Click Marker
    const marker = document.createElement('div');
    marker.style.cssText = `
      position: fixed;
      left: ${clickX}px; top: ${clickY}px;
      width: 20px; height: 20px;
      background: ${isPanicMode ? 'red' : (isYoloMode ? 'magenta' : 'cyan')};
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
});
