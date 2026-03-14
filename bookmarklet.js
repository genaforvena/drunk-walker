// Drunk Walker v3.3-EXP - Bundled Build
// Generated automatically by build.js
// Paste this entire code into browser console on Google Street View
// NOTE: If you see "Allow pasting?" warning, type: allow pasting

(function(){
  if (window.DRUNK_WALKER_ACTIVE) return;
  window.DRUNK_WALKER_ACTIVE = true;

  // === CORE ENGINE ===
  /**
 * Drunk Walker Core Engine
 * Independent navigation logic - works without UI
 */

const VERSION = '3.3-EXP';

const defaultConfig = {
  pace: 2000,
  kbOn: true,      // Keyboard mode ON by default
  expOn: true,     // Experimental mode ON by default (enables unstuck algorithm)
  panicThreshold: 3,
  radius: 50,
  targetX: 0.5,    // 50% of screen width
  targetY: 0.7,    // 70% of screen height
  turnDuration: 300  // ms to hold ArrowLeft for ~30° turn
};

function createEngine(config = {}) {
  const cfg = { ...defaultConfig, ...config };

  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let lastUrl = '';
  let stuckCount = 0;
  let isUserMouseDown = false;
  let poly = [];
  let isDrawing = false;
  
  // Unstuck algorithm state machine
  let unstuckState = 'IDLE';  // 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING'
  let unstuckTimer = null;
  let urlBeforeUnstuck = '';

  // State getters
  const getStatus = () => status;
  const getSteps = () => steps;
  const getStuckCount = () => stuckCount;
  const isNavigating = () => status === 'WALKING';

  // Configuration setters
  const setPace = (newPace) => {
    cfg.pace = newPace;
    // Update interval if running without resetting steps
    if (intervalId && status === 'WALKING') {
      clearInterval(intervalId);
      intervalId = setInterval(tick, cfg.pace);
    }
  };
  const setKeyboardMode = (on) => { cfg.kbOn = on; };
  const setExperimentalMode = (on) => { cfg.expOn = on; };
  const setPolygon = (points) => { poly = points; };

  // User interaction handlers
  const setUserMouseDown = (down) => { isUserMouseDown = down; };
  const setIsDrawing = (drawing) => { isDrawing = drawing; };

  // Action callbacks (to be provided by caller)
  let onKeyPress = null;
  let onMouseClick = null;
  let onStatusUpdate = null;
  let onLongKeyPress = null;

  const setActionHandlers = ({ keyPress, mouseClick, statusUpdate, longKeyPress }) => {
    onKeyPress = keyPress;
    onMouseClick = mouseClick;
    onStatusUpdate = statusUpdate;
    onLongKeyPress = longKeyPress;
  };

  // Navigation logic
  const updateStuckDetection = () => {
    if (!cfg.expOn) {
      stuckCount = 0;
      return;
    }

    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) {
      stuckCount++;
    } else {
      lastUrl = currentUrl;
      stuckCount = 0;
    }
  };

  // Unstuck algorithm state machine
  const executeUnstuckSequence = () => {
    if (unstuckState !== 'IDLE') return;
    
    // Start unstuck sequence: TURN -> MOVE -> VERIFY
    urlBeforeUnstuck = window.location.href;
    unstuckState = 'TURNING';
    
    // Step 1: Turn left (hold ArrowLeft for ~30°)
    if (onLongKeyPress) {
      onLongKeyPress('ArrowLeft', cfg.turnDuration, () => {
        // After turn, move forward
        unstuckState = 'MOVING';
        if (onKeyPress) onKeyPress('ArrowUp');
        
        // Step 3: Verify after a short delay
        setTimeout(() => {
          unstuckState = 'VERIFYING';
          const newUrl = window.location.href;
          
          if (newUrl !== urlBeforeUnstuck) {
            // Successfully unstuck!
            stuckCount = 0;
            console.log('🤪 DRUNK WALKER: Unstuck successfully!');
          } else {
            // Still stuck, increment stuck count
            stuckCount++;
            console.log('🤪 DRUNK WALKER: Still stuck after unstuck attempt');
          }
          
          unstuckState = 'IDLE';
          if (onStatusUpdate) {
            onStatusUpdate(getStatusText(), steps, stuckCount);
          }
        }, cfg.pace);
      });
    }
  };

  const getStatusText = () => {
    if (!cfg.expOn || stuckCount === 0) return 'WALKING';
    if (stuckCount >= cfg.panicThreshold) return `PANIC! (STUCK ${stuckCount})`;
    return `STUCK (${stuckCount})`;
  };

  const calculateClickTarget = () => {
    const cw = window.innerWidth;
    const ch = window.innerHeight;

    // If polygon defined, pick random point inside
    if (poly.length > 2) {
      const minX = Math.min(...poly.map(p => p.x));
      const maxX = Math.max(...poly.map(p => p.x));
      const minY = Math.min(...poly.map(p => p.y));
      const maxY = Math.max(...poly.map(p => p.y));

      let tx, ty, attempts = 0;
      do {
        tx = minX + Math.random() * (maxX - minX);
        ty = minY + Math.random() * (maxY - minY);
        attempts++;
      } while (!inPoly({ x: tx, y: ty }, poly) && attempts < 100);

      return { x: tx, y: ty };
    }

    // Default target with wobble
    const radius = cfg.expOn && stuckCount >= cfg.panicThreshold
      ? cfg.radius * Math.pow(1.5, stuckCount - cfg.panicThreshold + 1)
      : cfg.radius;

    const wobble = () => (Math.random() * 2 - 1) * radius;
    return {
      x: cw * cfg.targetX + wobble(),
      y: cfg.targetY * ch + wobble()
    };
  };

  // Polygon hit testing (kept for future use)
  const inPoly = (p, vs) => {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].x, yi = vs[i].y;
      const xj = vs[j].x, yj = vs[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Main navigation tick
  const tick = () => {
    // Skip if user is interacting
    if (isUserMouseDown || isDrawing || unstuckState !== 'IDLE') return;

    updateStuckDetection();

    if (onStatusUpdate) {
      onStatusUpdate(getStatusText(), steps, stuckCount);
    }

    // Check if stuck and need to execute unstuck sequence
    if (cfg.expOn && stuckCount >= cfg.panicThreshold) {
      executeUnstuckSequence();
      return;
    }

    // Execute action based on mode
    if (cfg.kbOn) {
      // Keyboard mode (DEFAULT)
      if (onKeyPress) onKeyPress('ArrowUp');
    } else {
      // Click mode
      const target = calculateClickTarget();
      if (onMouseClick) onMouseClick(target.x, target.y);
    }

    steps++;
  };

  // Control functions
  const start = () => {
    if (status === 'WALKING') return;

    status = 'WALKING';
    // Only reset on first start, not on resume
    if (steps === 0) {
      stuckCount = 0;
      lastUrl = window.location.href;
      unstuckState = 'IDLE';
    }

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, cfg.pace);

    if (onStatusUpdate) onStatusUpdate('WALKING', steps, stuckCount);
  };

  const stop = () => {
    status = 'IDLE';
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (onStatusUpdate) onStatusUpdate('IDLE', steps, 0);
  };

  const reset = () => {
    stop();
    steps = 0;
    stuckCount = 0;
    lastUrl = '';
    status = 'IDLE';
  };

  return {
    // State
    getStatus,
    getSteps,
    getStuckCount,
    isNavigating,

    // Configuration
    setPace,
    setKeyboardMode,
    setExperimentalMode,
    setPolygon,

    // Interaction
    setUserMouseDown,
    setIsDrawing,

    // Handlers
    setActionHandlers,

    // Control
    start,
    stop,
    reset,

    // Direct access for testing
    tick,
    getConfig: () => ({ ...cfg })
  };
}


  // === INPUT HANDLERS ===
  /**
 * Input Handlers - Keyboard and Mouse Event Simulation
 */

const KEY_CODES = {
  ArrowUp: { keyCode: 38, code: 'ArrowUp' },
  ArrowLeft: { keyCode: 37, code: 'ArrowLeft' },
  ArrowDown: { keyCode: 40, code: 'ArrowDown' },
  ArrowRight: { keyCode: 39, code: 'ArrowRight' }
};

/**
 * Find the best target element for Street View events
 */
function findStreetViewTarget() {
  // Priority order: canvas -> scene viewer -> streetview container -> document
  return document.querySelector('canvas[width][height]') ||
    document.querySelector('.scene-viewer') ||
    document.querySelector('[class*="streetview"]') ||
    document.documentElement;
}

/**
 * Simulate keyboard event (keydown -> keypress -> keyup)
 * @param {string} key - Key to simulate (e.g., 'ArrowUp')
 * @param {HTMLElement} target - Target element (optional)
 */
function simulateKeyPress(key, target = null) {
  const { keyCode, code } = KEY_CODES[key] || { keyCode: 0, code: key };

  const eventOptions = {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    location: 2,
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  };

  const targetEl = target || findStreetViewTarget();

  // Full key event sequence for maximum compatibility
  targetEl.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
  targetEl.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
  setTimeout(() => {
    targetEl.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
  }, 50);
}

/**
 * Simulate long-press keyboard event (keydown -> hold -> keyup)
 * Used for turning (e.g., hold ArrowLeft for 30° turn)
 * @param {string} key - Key to simulate (e.g., 'ArrowLeft')
 * @param {number} duration - How long to hold the key (ms)
 * @param {Function} callback - Called after key is released
 * @param {HTMLElement} target - Target element (optional)
 */
function simulateLongKeyPress(key, duration, callback, target = null) {
  const { keyCode, code } = KEY_CODES[key] || { keyCode: 0, code: key };

  const eventOptions = {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    location: 2,
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  };

  const targetEl = target || findStreetViewTarget();

  // Key down
  targetEl.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
  
  // Hold for duration, then release
  setTimeout(() => {
    targetEl.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
    if (callback) callback();
  }, duration);
}

/**
 * Simulate mouse click at coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {boolean} showMarker - Whether to show visual marker
 */
function simulateClick(x, y, showMarker = true) {
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y
  };

  const target = document.elementFromPoint(x, y) || document.body;

  target.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  target.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  target.dispatchEvent(new MouseEvent('click', eventOptions));

  // Visual feedback marker
  if (showMarker) {
    const marker = document.createElement('div');
    marker.style.cssText = `
      position:fixed;
      left:${x}px;
      top:${y}px;
      width:15px;
      height:15px;
      background:cyan;
      border-radius:50%;
      z-index:999999;
      pointer-events:none;
      transform:translate(-50%,-50%);
      opacity:0.8;
      transition:transform 0.3s, opacity 0.3s;
    `;
    document.body.appendChild(marker);
    setTimeout(() => {
      marker.style.transform = 'translate(-50%,-50%) scale(2)';
      marker.style.opacity = '0';
      setTimeout(() => marker.remove(), 300);
    }, 50);
  }
}

/**
 * Set up user interaction listeners
 * @returns {Object} Cleanup function
 */
function setupInteractionListeners(callbacks = {}) {
  const { onUserMouseDown, onUserMouseUp } = callbacks;

  const mouseDownHandler = (e) => {
    if (e.isTrusted && onUserMouseDown) {
      onUserMouseDown(true);
    }
  };

  const mouseUpHandler = (e) => {
    if (e.isTrusted && onUserMouseUp) {
      onUserMouseUp(false);
    }
  };

  document.addEventListener('mousedown', mouseDownHandler, true);
  document.addEventListener('mouseup', mouseUpHandler, true);

  return {
    cleanup: () => {
      document.removeEventListener('mousedown', mouseDownHandler, true);
      document.removeEventListener('mouseup', mouseUpHandler, true);
    }
  };
}


  // === UI CONTROLLER ===
  /**
 * UI Controller - Control Panel Management
 */

function createControlPanel(engine, options = {}) {
  const {
    version = '3.2-EXP',
    autoStart = true
  } = options;

  let container = null;
  let btn = null;
  let statusEl = null;
  let stepsEl = null;
  let paceValEl = null;
  let paceSlider = null;

  // Create UI elements
  const createUI = () => {
    container = document.createElement('div');
    container.id = 'dw-ctrl-panel';
    container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';

    // Title
    const title = document.createElement('div');
    title.innerHTML = `🤪 DRUNK WALKER v${version}<hr style="border-color:#0f0">`;
    container.appendChild(title);

    // Stats
    const stats = document.createElement('div');
    stats.style.margin = '10px 0';
    stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>STEPS: <span id="dw-steps">0</span>';
    container.appendChild(stats);
    statusEl = stats.querySelector('#dw-status');
    stepsEl = stats.querySelector('#dw-steps');

    // Pace control
    const paceLabel = document.createElement('div');
    paceLabel.style.fontSize = '10px';
    paceLabel.innerHTML = 'PACE: <span id="dw-pace-val">2.0</span>s';
    container.appendChild(paceLabel);
    paceValEl = paceLabel.querySelector('#dw-pace-val');

    paceSlider = document.createElement('input');
    paceSlider.type = 'range';
    paceSlider.min = '500';
    paceSlider.max = '5000';
    paceSlider.step = '100';
    paceSlider.value = engine.getConfig().pace;
    paceSlider.style.width = '100%';
    paceSlider.oninput = () => {
      const newPace = parseInt(paceSlider.value);
      if (paceValEl) paceValEl.innerText = (newPace / 1000).toFixed(1);
      engine.setPace(newPace);
    };
    container.appendChild(paceSlider);

    // Start/Stop button
    btn = document.createElement('button');
    btn.innerText = '▶ START';
    btn.style.cssText = 'width:100%;margin-top:10px;padding:8px;background:#0f0;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:5px;';
    btn.onclick = () => {
      if (engine.isNavigating()) {
        engine.stop();
      } else {
        engine.start();
      }
      updateButton();
    };
    container.appendChild(btn);

    document.body.appendChild(container);
  };

  // Update button appearance based on state
  const updateButton = () => {
    if (engine.isNavigating()) {
      btn.innerText = '🔴 STOP';
      btn.style.background = '#f00';
    } else {
      btn.innerText = '▶ START';
      btn.style.background = '#0f0';
    }
  };

  // Status update handler
  const onStatusUpdate = (statusText, stepCount, stuckCount) => {
    if (statusEl) statusEl.innerText = statusText;
    if (stepsEl) stepsEl.innerText = stepCount;
    updateButton();
  };

  // Initialize
  const init = () => {
    // Wait for DOM to be ready
    if (!document.body) {
      console.error('🤪 DRUNK WALKER: document.body not ready yet');
      return { destroy: () => {} };
    }

    try {
      createUI();
      updateButton();

      if (autoStart) {
        engine.start();
      }

      console.log('🤪 Control panel created successfully');
      return { destroy };
    } catch (error) {
      console.error('🤪 DRUNK WALKER: Failed to initialize UI:', error);
      return { destroy: () => {} };
    }
  };

  // Cleanup
  const destroy = () => {
    engine.stop();
    if (container) {
      container.remove();
      container = null;
    }
  };

  return { init, destroy, onStatusUpdate };
}


  // === MAIN ENTRY ===
  /**
 * Drunk Walker - Main Entry Point
 * Combines core engine, input handlers, and UI
 */





// Allow restart by clearing previous instance
if (window.DRUNK_WALKER_ACTIVE) {
  console.log('🤪 Drunk Walker: Restarting...');
  if (window.DRUNK_WALKER) {
    try { window.DRUNK_WALKER.stop(); } catch(e) {}
  }
}

window.DRUNK_WALKER_ACTIVE = true;

console.log(`🤪 DRUNK WALKER v${VERSION} Loaded.`);

// Wait for DOM to be ready before initializing
const initialize = () => {
  try {
    // Create engine with default config (keyboard mode ON, unstuck enabled)
    const engine = createEngine({
      pace: 2000,
      kbOn: true,      // Keyboard mode is DEFAULT
      expOn: true      // Unstuck algorithm enabled by default
    });

    // Create UI first to get its onStatusUpdate callback
    const ui = createControlPanel(engine, {
      version: VERSION,
      autoStart: true  // Auto-start on load
    });

    // Set up action handlers with UI callback
    engine.setActionHandlers({
      keyPress: (key) => {
        const target = findStreetViewTarget();
        simulateKeyPress(key, target);
      },
      mouseClick: (x, y) => {
        simulateClick(x, y, true);
      },
      longKeyPress: (key, duration, callback) => {
        const target = findStreetViewTarget();
        simulateLongKeyPress(key, duration, callback, target);
      },
      statusUpdate: ui.onStatusUpdate  // Connect UI status updates
    });

    // Set up interaction listeners (pause on user drag)
    const { cleanup: cleanupListeners } = setupInteractionListeners({
      onUserMouseDown: (down) => engine.setUserMouseDown(down),
      onUserMouseUp: (down) => engine.setUserMouseDown(down)
    });

    // Initialize everything
    ui.init();

    // Expose for debugging/console access
    window.DRUNK_WALKER = {
      engine,
      ui,
      simulateKeyPress,
      simulateClick,
      stop: () => {
        ui.destroy();
        cleanupListeners();
        window.DRUNK_WALKER_ACTIVE = false;
        delete window.DRUNK_WALKER;
        console.log('🤪 Drunk Walker stopped');
      }
    };

    console.log('🎮 Type DRUNK_WALKER.stop() to stop manually');
  } catch (error) {
    console.error('🤪 DRUNK WALKER: Initialization failed:', error);
    window.DRUNK_WALKER_ACTIVE = false;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

})();