/**
 * Drunk Walker Core Engine
 * Independent navigation logic - works without UI
 */

export const VERSION = '3.67.1-EXP';

export const defaultConfig = {
  pace: 2000,
  kbOn: true,      // Keyboard mode ON by default
  expOn: true,     // Experimental mode ON by default (enables unstuck algorithm)
  panicThreshold: 3,
  radius: 50,
  targetX: 0.5,    // 50% of screen width
  targetY: 0.7,    // 70% of screen height
  turnDuration: 600,  // ms to hold ArrowLeft for ~60° turn (fixed)
  collectPath: true,  // Path recording ENABLED by default
  selfAvoiding: true  // Self-avoiding random walk (prefer unvisited nodes)
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
  let isPathCollectionEnabled = cfg.collectPath;  // Initialize from config (default: true)

  // Visited nodes memory for self-avoiding walk
  let visitedUrls = new Set();
  
  // Cumulative turn angle tracking
  let cumulativeTurnAngle = 0;  // Total degrees turned (for path recording)

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
  
  // Extract location from Street View URL (ignores query params that change)
  // Format: https://www.google.com/maps/@lat,lng,zoom... or place_id format
  const extractLocation = (url) => {
    try {
      const urlObj = new URL(url);
      const hash = urlObj.hash || urlObj.pathname;
      // Extract @lat,lng pattern from URL hash or pathname
      const match = hash.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        return `${match[1]},${match[2]}`;  // Return "lat,lng" as unique location
      }
      // Fallback: use place_id if available
      const placeMatch = urlObj.searchParams.get('place_id');
      if (placeMatch) {
        return `place:${placeMatch}`;
      }
      // Last resort: use full pathname
      return urlObj.pathname + urlObj.hash;
    } catch (e) {
      return url;  // Return original if parsing fails
    }
  };
  
  const recordStep = () => {
    if (isPathCollectionEnabled) {
      const currentUrl = window.location.href;
      const location = extractLocation(currentUrl);
      walkPath.push({
        url: currentUrl,
        location: location,  // Unique location identifier (lat,lng)
        rotation: cumulativeTurnAngle  // Actual cumulative turn angle
      });
      // Track visited locations for self-avoiding walk
      if (cfg.selfAvoiding) {
        visitedUrls.add(location);  // Use location, not full URL
      }
    }
  };
  const isUrlVisited = (location) => visitedUrls.has(location);
  const clearVisitedUrls = () => { visitedUrls.clear(); };
  const getVisitedCount = () => visitedUrls.size;
  const getCumulativeTurnAngle = () => cumulativeTurnAngle;
  const resetCumulativeTurnAngle = () => { cumulativeTurnAngle = 0; };

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

    // Step 1: Turn left with bounded randomization (~45° to ~75°)
    // Always turning left ensures consistent behavior in circular paths
    // Random variation prevents getting stuck in perfect loops
    const baseTurnDuration = cfg.turnDuration;  // 600ms = ~60°
    const randomVariation = (Math.random() - 0.5) * 300;  // ±150ms = ±15°
    const turnDuration = Math.max(450, Math.min(750, baseTurnDuration + randomVariation));  // Clamp to 450-750ms
    const turnAngle = Math.round(turnDuration / 10);  // Convert ms to degrees (~10ms = 1°)

    if (onLongKeyPress) {
      onLongKeyPress('ArrowLeft', turnDuration, () => {
        // Track the turn angle
        cumulativeTurnAngle = (cumulativeTurnAngle + turnAngle) % 360;
        
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
            console.log(`🤪 DRUNK WALKER: Unstuck successfully (turned left ~${turnAngle}°)!`);
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

  // Self-avoiding walk: prefer unvisited directions using turn angles
  const executeSelfAvoidingStep = () => {
    if (!cfg.selfAvoiding || !onKeyPress) return false;

    // Try to sense if current location has been visited
    const currentUrl = window.location.href;
    const currentLocation = extractLocation(currentUrl);
    const isCurrentVisited = visitedUrls.has(currentLocation);

    // If we're at a visited node, try turning to find unvisited direction
    if (isCurrentVisited && visitedUrls.size > 0) {
      // Use turn angle to decide direction - prefer turning away from current orientation
      // If we've turned a lot (>180°), prefer turning back toward original direction
      const normalizedTurn = cumulativeTurnAngle % 360;
      
      // Bias turn direction based on cumulative turn
      // This creates a spiral pattern that covers more ground
      let turnLeft;
      if (normalizedTurn > 180) {
        // Turned more than half circle - turn right to complete the loop
        turnLeft = false;
      } else {
        // Turned less than half - continue turning left
        turnLeft = true;
      }
      
      // Add some randomness (20% chance to go against the bias)
      if (Math.random() < 0.2) {
        turnLeft = !turnLeft;
      }
      
      const turnKey = turnLeft ? 'ArrowLeft' : 'ArrowRight';
      const turnDuration = cfg.turnDuration / 2;  // ~30° quick turn
      const turnAngleChange = Math.round(turnDuration / 10);  // ~30°
      
      // Update cumulative turn angle
      if (turnLeft) {
        cumulativeTurnAngle = (cumulativeTurnAngle + turnAngleChange) % 360;
      } else {
        cumulativeTurnAngle = (cumulativeTurnAngle - turnAngleChange + 360) % 360;
      }

      // Quick turn to check new direction
      if (onLongKeyPress) {
        onLongKeyPress(turnKey, turnDuration, () => {
          // After turn, will move forward on next tick
        });
        return true;
      }
    }
    return false;
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
      // Self-avoiding walk: try to turn away from visited nodes before moving
      if (cfg.selfAvoiding && executeSelfAvoidingStep()) {
        // Turned to explore, will move forward on next tick
        return;
      }
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
    cumulativeTurnAngle = 0;  // Reset turn angle on reset
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
    setSelfAvoiding: (enabled) => { cfg.selfAvoiding = enabled; },

    // Visited nodes
    getVisitedCount,
    clearVisitedUrls,
    isUrlVisited,
    
    // Turn angle tracking
    getCumulativeTurnAngle,
    resetCumulativeTurnAngle,

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
