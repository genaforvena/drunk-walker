/**
 * Drunk Walker Core Engine
 * Independent navigation logic - works without UI
 */

export const VERSION = '3.2-EXP';

export const defaultConfig = {
  pace: 2000,
  kbOn: true,      // Keyboard mode ON by default
  expOn: false,    // Experimental mode OFF by default
  panicThreshold: 3,
  radius: 50,
  targetX: 0.5,    // 50% of screen width
  targetY: 0.7     // 70% of screen height
};

export function createEngine(config = {}) {
  const cfg = { ...defaultConfig, ...config };
  
  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let lastUrl = '';
  let stuckCount = 0;
  let isUserMouseDown = false;
  let poly = [];
  let isDrawing = false;

  // State getters
  const getStatus = () => status;
  const getSteps = () => steps;
  const getStuckCount = () => stuckCount;
  const isNavigating = () => status === 'WALKING';

  // Configuration setters
  const setPace = (newPace) => { cfg.pace = newPace; };
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

  const setActionHandlers = ({ keyPress, mouseClick, statusUpdate }) => {
    onKeyPress = keyPress;
    onMouseClick = mouseClick;
    onStatusUpdate = statusUpdate;
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
    if (isUserMouseDown || isDrawing) return;

    updateStuckDetection();

    if (onStatusUpdate) {
      onStatusUpdate(getStatusText(), steps, stuckCount);
    }

    // Execute action based on mode
    if (cfg.kbOn) {
      // Keyboard mode (DEFAULT)
      const key = (cfg.expOn && stuckCount >= cfg.panicThreshold)
        ? 'ArrowLeft'
        : 'ArrowUp';
      if (onKeyPress) onKeyPress(key);
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
    steps = 0;
    stuckCount = 0;
    lastUrl = window.location.href;

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, cfg.pace);

    if (onStatusUpdate) onStatusUpdate('WALKING', 0, 0);
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
