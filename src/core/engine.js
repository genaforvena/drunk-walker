/**
 * Drunk Walker Core Engine
 * Independent navigation logic - works without UI
 */

export const VERSION = '3.66.6-EXP';

export const defaultConfig = {
  pace: 2000,
  kbOn: true,      // Keyboard mode ON by default
  expOn: true,     // Experimental mode ON by default (enables unstuck algorithm)
  panicThreshold: 3,
  radius: 50,
  targetX: 0.5,    // 50% of screen width
  targetY: 0.7,    // 70% of screen height
  turnDuration: 600,  // ms to hold ArrowLeft for ~60° turn (fixed)
  collectPath: true  // Path recording ENABLED by default
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
  
  // Unstuck algorithm state machine
  let unstuckState = 'IDLE';  // 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING'
  let unstuckTimer = null;
  let urlBeforeUnstuck = '';

  // Path collection (opt-in)
  let walkPath = [];
  let isPathCollectionEnabled = false;

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
  const setTurnDuration = (newDuration) => { cfg.turnDuration = newDuration; };
  const setKeyboardMode = (on) => { cfg.kbOn = on; };
  const setExperimentalMode = (on) => { cfg.expOn = on; };
  const setPolygon = (points) => { poly = points; };
  const setPathCollection = (enabled) => {
    isPathCollectionEnabled = enabled;
    cfg.collectPath = enabled;
    if (!enabled) {
      walkPath = [];  // Clear path if disabled
    }
  };
  const setWalkPath = (path) => { walkPath = path ? [...path] : []; };
  const setSteps = (count) => { steps = count; };
  const getWalkPath = () => [...walkPath];  // Return copy
  const clearWalkPath = () => { walkPath = []; };
  const recordStep = () => {
    if (isPathCollectionEnabled) {
      walkPath.push({
        url: window.location.href,
        rotation: 60  // Fixed rotation angle
      });
    }
  };

  // User interaction handlers
  const setUserMouseDown = (down) => { isUserMouseDown = down; };
  const setIsDrawing = (drawing) => { isDrawing = drawing; };

  // Action callbacks (to be provided by caller)
  let onKeyPress = null;
  let onMouseClick = null;
  let onStatusUpdate = null;
  let onLongKeyPress = null;
  let onWalkStop = null;

  const setActionHandlers = ({ keyPress, mouseClick, statusUpdate, longKeyPress, walkStop }) => {
    onKeyPress = keyPress;
    onMouseClick = mouseClick;
    onStatusUpdate = statusUpdate;
    onLongKeyPress = longKeyPress;
    onWalkStop = walkStop;
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
    
    // Record step for path collection (after movement)
    recordStep();
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
    
    // Submit walk path if collection enabled
    if (onWalkStop && isPathCollectionEnabled && walkPath.length > 0) {
      onWalkStop(getWalkPath());
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
    setTurnDuration,
    setKeyboardMode,
    setExperimentalMode,
    setPolygon,
    setPathCollection,
    setWalkPath,
    setSteps,
    getWalkPath,
    clearWalkPath,

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
