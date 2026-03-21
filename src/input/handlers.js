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
export function findStreetViewTarget() {
  // Priority order: canvas -> scene viewer -> streetview container -> document
  return document.querySelector('canvas') ||
    document.querySelector('.scene-viewer') ||
    document.querySelector('[class*="streetview"]') ||
    document.documentElement;
}

/**
 * Simulate keyboard event (keydown -> keypress -> keyup)
 * @param {string} key - Key to simulate (e.g., 'ArrowUp')
 * @param {HTMLElement} target - Target element (optional)
 */
export function simulateKeyPress(key, target = null) {
  const { keyCode, code } = KEY_CODES[key] || { keyCode: 0, code: key };

  const eventOptions = {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    location: 0,
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  };

  const targetEl = target || findStreetViewTarget();

  // Full key event sequence
  targetEl.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
  targetEl.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
  setTimeout(() => {
    targetEl.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
  }, 50);
}

/**
 * Simulate long-press keyboard event (repeated keydown/keypress)
 * Used for turning (e.g., hold ArrowLeft for 30° turn)
 * @param {string} key - Key to simulate (e.g., 'ArrowLeft')
 * @param {number} duration - How long to hold the key (ms)
 * @param {Function} callback - Called after key is released
 * @param {HTMLElement} target - Target element (optional)
 */
export function simulateLongKeyPress(key, duration, callback, target = null) {
  const { keyCode, code } = KEY_CODES[key] || { keyCode: 0, code: key };

  const baseOptions = {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    location: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  };

  const targetEl = target || findStreetViewTarget();
  const startTime = Date.now();

  // Initial Key Down
  targetEl.dispatchEvent(new KeyboardEvent('keydown', { ...baseOptions, repeat: false }));
  targetEl.dispatchEvent(new KeyboardEvent('keypress', { ...baseOptions, repeat: false }));

  // Repeat loop
  const intervalId = setInterval(() => {
    if (Date.now() - startTime >= duration) {
      clearInterval(intervalId);
      targetEl.dispatchEvent(new KeyboardEvent('keyup', { ...baseOptions, repeat: false }));
      if (callback) callback();
    } else {
      // Repeat events
      targetEl.dispatchEvent(new KeyboardEvent('keydown', { ...baseOptions, repeat: true }));
      targetEl.dispatchEvent(new KeyboardEvent('keypress', { ...baseOptions, repeat: true }));
    }
  }, 50); // Repeat every 50ms (typical browser repeat rate)
}

/**
 * Simulate mouse click at coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {boolean} showMarker - Whether to show visual marker
 */
export function simulateClick(x, y, showMarker = true) {
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
export function setupInteractionListeners(callbacks = {}) {
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
