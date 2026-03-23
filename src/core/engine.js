/**
 * Drunk Walker Core Engine v6.1.0-SMART-PANIC
 *
 * ARCHITECTURE:
 * - Engine: State management, tick timing, path recording
 * - Wheel: Orientation management
 * - Traversal: Decision-making with PLEDGE wall-following
 */

import { createWheel } from './wheel.js';
import {
  createUnifiedAlgorithm,
  createDefaultAlgorithm,
  extractLocationFromUrl
} from './traversal.js';
import { VERSION } from '../version.js';

export { VERSION };

export const defaultConfig = {
  pace: 2000,
  kbOn: true,
  panicThreshold: 3,
  radius: 50,
  targetX: 0.4,
  targetY: 0.8,
  turnDuration: 600,
  collectPath: true,
  selfAvoiding: true
};

export function createEngine(config = {}) {
  const cfg = { ...defaultConfig, ...config };

  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let lastUrl = null;
  let lastUrlYaw = null;
  let stuckCount = 0;
  let isUserMouseDown = false;
  let poly = [];
  let isDrawing = false;

  // Path collection
  let walkPath = [];
  let isPathCollectionEnabled = cfg.collectPath;

  // Visited nodes memory
  let visitedUrls = new Map();
  let breadcrumbs = [];

  // Track previous location for movement recording
  let previousLocation = null;
  let previousYaw = null;
  let lastDifferentLocation = null;  // Track last location that was different from current

  // Keyboard block detection - when Street View blocks keyboard controls
  let keyboardBlockStuckCount = 0;  // Consecutive stuck steps with no yaw change
  let lastStuckYaw = null;  // Track yaw when stuck started
  const KEYBOARD_BLOCK_THRESHOLD = 3;  // After 3 stuck steps with same yaw, click to wake

  // Turn state - prevent oscillation
  let isTurning = false;  // True while executing a turn
  let turnCompleted = false;  // Set to true when turn finishes
  let ticksSinceTurn = 0;  // Count ticks after turn completes
  const TURNS_COOLDOWN_TICKS = 2;  // Wait 2 ticks after turn before deciding to turn again (reduced from 3)
  let awaitingStepResult = false;  // True after turn+step, waiting to see if we moved

  // Action callbacks
  let onKeyPress = null;
  let onMouseClick = null;
  let onStatusUpdate = null;
  let onLongKeyPress = null;
  let onWalkStop = null;

  const extractLocation = (url) => {
    try {
      const hashMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (hashMatch) return `${hashMatch[1]},${hashMatch[2]}`;
    } catch (e) {}
    return null;
  };

  const extractYaw = (url) => {
    if (!url) return null;
    // Match both &yaw=123 and 75y,123h formats
    const match = url.match(/yaw[=%]3D?([0-9.]+)/i) || url.match(/,([0-9.]+)h/i);
    return match ? parseFloat(match[1]) : null;
  };

  const wheelCallbacks = {
    onLongKeyPress: null
  };
  const wheel = createWheel(wheelCallbacks);

  let algorithm = createDefaultAlgorithm(cfg);

  const getStatus = () => status;
  const getSteps = () => steps;
  const getStuckCount = () => stuckCount;
  const isNavigating = () => status === 'WALKING';

  const setPace = (newPace) => {
    cfg.pace = newPace;
    if (intervalId && status === 'WALKING') {
      clearInterval(intervalId);
      intervalId = setInterval(tick, cfg.pace);
    }
  };
  const setTurnDuration = (newDuration) => { cfg.turnDuration = newDuration; };
  const setKeyboardMode = (on) => { cfg.kbOn = on; };
  const setPolygon = (newPoly) => { poly = newPoly || []; };
  const setPathCollection = (enabled) => { isPathCollectionEnabled = enabled; };
  const setWalkPath = (path) => { walkPath = path || []; };
  const setSteps = (newSteps) => { steps = newSteps; };
  const getWalkPath = () => walkPath;
  const clearWalkPath = () => { walkPath = []; };
  const getVisitedCount = () => visitedUrls.size;
  const clearVisitedUrls = () => { visitedUrls.clear(); breadcrumbs = []; };
  const isUrlVisited = (url) => visitedUrls.has(extractLocation(url));
  const getCurrentYaw = () => wheel.getOrientation();
  const resetCurrentYaw = () => wheel.setOrientation(0);
  let cumulativeTurnAngle = 0;
  const getCumulativeTurnAngle = () => cumulativeTurnAngle;
  const resetCumulativeTurnAngle = () => { cumulativeTurnAngle = 0; };

  const restoreVisitedFromPath = (path) => {
    visitedUrls.clear();
    breadcrumbs = [];
    for (const step of path) {
      const loc = extractLocation(step.url);
      if (loc) {
        visitedUrls.set(loc, (visitedUrls.get(loc) || 0) + 1);
        breadcrumbs.push(loc);
      }
    }
  };

  const setUserMouseDown = (val) => { isUserMouseDown = val; };
  const setIsDrawing = (val) => { isDrawing = val; };
  const setActionHandlers = (handlers) => {
    onKeyPress = handlers.keyPress || null;
    onMouseClick = handlers.mouseClick || null;
    onStatusUpdate = handlers.statusUpdate || null;
    onLongKeyPress = handlers.longKeyPress || null;
    onWalkStop = handlers.walkStop || null;
    
    // Update persistent wheel callbacks
    wheelCallbacks.onLongKeyPress = onLongKeyPress;
  };

  const recordStep = () => {
    if (!isPathCollectionEnabled) return;
    const currentUrl = typeof window !== 'undefined' ? window.location.href : lastUrl;
    const currentLocation = extractLocation(currentUrl);
    walkPath.push({ url: currentUrl, timestamp: Date.now() });
    if (currentLocation) {
      visitedUrls.set(currentLocation, (visitedUrls.get(currentLocation) || 0) + 1);
      if (breadcrumbs.length === 0 || breadcrumbs[breadcrumbs.length - 1] !== currentLocation) {
        breadcrumbs.push(currentLocation);
      }
      if (breadcrumbs.length > 200) breadcrumbs.shift();  // Keep last 200 for loop detection
    }
  };

  const calculateClickTarget = () => {
    const cw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const ch = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const tx = cfg.targetX * cw;
    const ty = cfg.targetY * ch;
    return { x: tx, y: ty };
  };

  const calculateTarget = () => {
    const cw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const ch = typeof window !== 'undefined' ? window.innerHeight : 1080;

    if (poly.length > 0 && isDrawing) {
      const last = poly[poly.length - 1];
      return { x: last.x * cw, y: last.y * ch };
    }

    const radius = stuckCount >= cfg.panicThreshold
      ? cfg.radius * Math.pow(1.5, stuckCount - cfg.panicThreshold + 1)
      : cfg.radius;

    const wobble = () => (Math.random() * 2 - 1) * radius;
    return {
      x: cw * cfg.targetX + wobble(),
      y: cfg.targetY * ch + wobble()
    };
  };

  const tick = () => {
    console.log(`[DEBUG] tick() START - status=${status}, isUserMouseDown=${isUserMouseDown}, isDrawing=${isDrawing}`);

    if (isUserMouseDown || isDrawing || status !== 'WALKING') {
      console.log('[DEBUG] tick() SKIP - conditions not met');
      return;
    }

    // Increment ticks since turn (for cooldown - prevent rapid re-turning)
    if (ticksSinceTurn < TURNS_COOLDOWN_TICKS + 1) {
      ticksSinceTurn++;
    }

    const currentUrl = typeof window !== 'undefined' ? window.location.href : (lastUrl || '');
    const currentLocation = extractLocation(currentUrl);
    const currentYaw = extractYaw(currentUrl);

    console.log(`[DEBUG] currentUrl=${currentUrl.substring(0, 80)}...`);
    console.log(`[DEBUG] currentLocation=${currentLocation}, currentYaw=${currentYaw}, previousLocation=${previousLocation}`);

    // 1. Stuck detection (Location based heartbeat)
    if (currentLocation && previousLocation && currentLocation === previousLocation) {
      stuckCount++;
      console.log(`[DEBUG] STUCK DETECTED - same location, stuckCount=${stuckCount}`);

      // Keyboard block detection: stuck with same yaw = controls might be blocked
      if (currentYaw !== null && currentYaw === lastStuckYaw) {
        keyboardBlockStuckCount++;
        console.log(`[DEBUG] KEYBOARD BLOCK? stuck+same yaw, count=${keyboardBlockStuckCount}/${KEYBOARD_BLOCK_THRESHOLD}`);
      } else {
        keyboardBlockStuckCount = 1;
        lastStuckYaw = currentYaw;
      }
    } else if (currentLocation && previousLocation && currentLocation !== previousLocation) {
      console.log(`[DEBUG] LOCATION CHANGED - resetting stuckCount and turn cooldown`);
      stuckCount = 0;
      ticksSinceTurn = TURNS_COOLDOWN_TICKS;  // Reset cooldown - we moved successfully
      keyboardBlockStuckCount = 0;  // Reset keyboard block counter - we moved!
      lastStuckYaw = null;
      // Track that we just arrived at a different location
      if (currentLocation !== lastDifferentLocation) {
        lastDifferentLocation = currentLocation;
      }
    }

    // 2. Sync orientation with URL ONLY if it changed since last heartbeat
    // Use 1 degree threshold to ignore minor floating point jitter
    if (currentYaw !== null && (lastUrlYaw === null || Math.abs(currentYaw - lastUrlYaw) > 1.0)) {
      console.log(`[DEBUG] Sync wheel orientation: lastUrlYaw=${lastUrlYaw}, currentYaw=${currentYaw}`);
      wheel.setOrientation(currentYaw);
      lastUrlYaw = currentYaw;
    }

    // 3. LOGGING (Critical for debugging)
    console.log(`💓 [${steps}] STUCK: ${stuckCount} | YAW: ${Math.round(wheel.getOrientation())}° | LOC: ${currentLocation}`);
    console.log(`   🔗 ${currentUrl}`);

    // 4. Record result of PREVIOUS heartbeat in the graph
    if (previousLocation && algorithm.enhancedGraph) {
      if (currentLocation && currentLocation !== previousLocation) {
        algorithm.enhancedGraph.recordMovement(
          previousLocation,
          currentLocation,
          previousYaw !== null ? previousYaw : wheel.getOrientation(),
          currentYaw || wheel.getOrientation(),
          steps
        );
      } else if (currentLocation === previousLocation) {
        // We are still at the same spot after an ArrowUp press
        algorithm.enhancedGraph.recordFailedAttempt(
          previousLocation,
          previousYaw !== null ? previousYaw : wheel.getOrientation(),
          steps
        );
      }
    }

    // 5. Decision time
    // Check if this is a new node or already visited
    const nodeVisitCount = visitedUrls.get(currentLocation) || 0;
    const isNewNode = nodeVisitCount === 0;
    const isStationary = currentLocation && previousLocation && currentLocation === previousLocation;
    
    // Track if we just arrived at this location (first tick after movement)
    const justArrived = currentLocation && previousLocation && currentLocation !== previousLocation;

    // Get node info from graph to check if fully scanned
    const nodeInfo = currentLocation ? algorithm.enhancedGraph.get(currentLocation) : null;
    const isFullyScanned = nodeInfo ? nodeInfo.triedYaws.size >= 6 : false;

    console.log(`[DEBUG] isStationary=${isStationary}, isNewNode=${isNewNode}, justArrived=${justArrived}, nodeVisitCount=${nodeVisitCount}, isFullyScanned=${isFullyScanned}`);

    // Check step result from previous turn+step attempt
    if (awaitingStepResult) {
      if (currentLocation !== previousLocation) {
        console.log('[DEBUG] Step succeeded! Location changed.');
      } else {
        console.log('[DEBUG] Step failed! Still at same location - record failed attempt.');
      }
      awaitingStepResult = false;  // Now we can make new decisions
    }

    let decision = { turn: false };

    // Make turn decisions when:
    // 1. Stationary at a node (not mid-movement) - normal case
    // 2. Just arrived at ANY node (new or visited) - allow yaw correction
    // But NOT when:
    // - Already turning
    // - Waiting for step result
    // - Turn cooldown active (UNLESS stuck >= 2, then skip cooldown for fast-fail)
    const isStuckAndShouldSkipCooldown = stuckCount >= 2;  // Fast-fail when clearly blocked
    const shouldMakeDecision = !isTurning && !awaitingStepResult &&
      (ticksSinceTurn >= TURNS_COOLDOWN_TICKS || isStuckAndShouldSkipCooldown) &&
      (isStationary || justArrived);

    if (shouldMakeDecision) {
      const context = {
        url: currentUrl,
        currentLocation: currentLocation,
        previousLocation: previousLocation,  // For yaw correction at new nodes
        visitedUrls,
        breadcrumbs,
        stuckCount,
        orientation: wheel.getOrientation(),
        isNewNode,
        isFullyScanned,
        justArrived,
        nodeVisitCount
      };

      console.log(`[DEBUG] ticksSinceTurn=${ticksSinceTurn}, calling algorithm.decide()...`);
      decision = algorithm.decide(context);
      console.log(`[DEBUG] decision=${JSON.stringify(decision)}`);
    } else if (isTurning) {
      console.log('[DEBUG] Skipping decision - already turning');
    } else if (!isStationary && !isNewNode) {
      console.log('[DEBUG] Skipping decision - moving through visited node');
    } else if (ticksSinceTurn < TURNS_COOLDOWN_TICKS && !isStuckAndShouldSkipCooldown) {
      console.log(`[DEBUG] Skipping decision - turn cooldown active (${ticksSinceTurn}/${TURNS_COOLDOWN_TICKS})`);
    } else if (isStuckAndShouldSkipCooldown) {
      console.log(`[DEBUG] FAST-FAIL: Skipping cooldown - stuck ${stuckCount}x, making decision immediately`);
    }

    // 6. Action: Turn (Left or Right)
    if (decision.turn) {
      let angle = decision.angle || 60;
      const direction = decision.direction || 'left';  // 'left' or 'right'

      // If direction is 'right', convert left-angle to right-angle
      // getLeftTurnAngle returns counter-clockwise angle
      // For clockwise (right) turn: rightAngle = 360 - leftAngle
      if (direction === 'right') {
        angle = (360 - angle) % 360;
      }

      console.log(`   🔄 ACTION: Turning ${direction.toUpperCase()} ${Math.round(angle)}°`);
      isTurning = true;
      turnCompleted = false;

      // Skip stepping when turning - let the turn complete first
      previousYaw = wheel.getOrientation();
      
      const turnCallback = () => {
        console.log('[DEBUG] Turn callback executed - pressing ArrowUp');
        isTurning = false;
        turnCompleted = true;
        ticksSinceTurn = 0;  // Reset cooldown - turn just completed
        awaitingStepResult = true;  // Wait for next tick to see if we moved

        // After turn completes, update state and trigger next tick
        previousLocation = currentLocation;
        previousYaw = wheel.getOrientation();
        lastUrl = currentUrl;
        steps++;
        recordStep();
        if (onStatusUpdate) {
          onStatusUpdate(status, steps, stuckCount);
        }
        // Trigger immediate step after turn completes
        if (cfg.kbOn) {
          if (onKeyPress) onKeyPress('ArrowUp');
        } else {
          const target = calculateClickTarget();
          if (onMouseClick) onMouseClick(target.x, target.y);
        }
      };
      
      if (direction === 'right') {
        wheel.turnRight(angle, turnCallback);
      } else {
        wheel.turnLeft(angle, turnCallback);
      }
      
      cumulativeTurnAngle += angle;
      console.log('[DEBUG] tick() RETURN EARLY - waiting for turn to complete');
      return; // Exit tick early - don't step until turn completes
    }

    // 7. Action: Always Step (The Heartbeat)
    previousLocation = currentLocation;
    previousYaw = wheel.getOrientation();
    lastUrl = currentUrl;

    // 🚨 KEYBOARD BLOCK FIX: When stuck with same yaw for N steps, click to wake
    // This works in BOTH keyboard and mouse mode - click re-engages Street View
    const isKeyboardBlocked = keyboardBlockStuckCount >= KEYBOARD_BLOCK_THRESHOLD;
    if (isKeyboardBlocked) {
      console.log(`🚨 KEYBOARD BLOCK DETECTED! stuck=${stuckCount}, sameYaw=${keyboardBlockStuckCount}x - CLICKING TO WAKE`);
      // Use mouse click to "wake up" Street View controls (works in both modes)
      const target = calculateClickTarget();
      if (onMouseClick) onMouseClick(target.x, target.y);
      // Reset counter after click - give it a chance to work
      keyboardBlockStuckCount = 0;
    }

    // Normal movement (keyboard or mouse)
    if (cfg.kbOn) {
      if (onKeyPress) onKeyPress('ArrowUp');
    } else {
      const target = calculateClickTarget();
      if (onMouseClick) onMouseClick(target.x, target.y);
    }

    steps++;
    recordStep();

    if (onStatusUpdate) {
      onStatusUpdate(status, steps, stuckCount);
    }
    console.log('[DEBUG] tick() END');
  };

  const start = () => {
    console.log(`[DEBUG] start() called - current status=${status}, intervalId=${intervalId ? 'set' : 'null'}`);
    
    // Aggressively clear any existing interval
    if (intervalId) {
      console.log('[DEBUG] start() clearing existing interval before start');
      clearInterval(intervalId);
      // Remove from global tracking
      if (window.__DRUNK_WALKER_INTERVALS__) {
        window.__DRUNK_WALKER_INTERVALS__.delete(intervalId);
      }
      intervalId = null;
    }
    
    if (status === 'WALKING') {
      console.log('[DEBUG] start() ABORT - already walking');
      return;
    }
    status = 'WALKING';
    if (steps === 0) {
      stuckCount = 0;
      lastUrl = null;
    }
    intervalId = setInterval(tick, cfg.pace);
    // Track interval globally
    if (window.__DRUNK_WALKER_INTERVALS__) {
      window.__DRUNK_WALKER_INTERVALS__.add(intervalId);
    }
    console.log(`[DEBUG] start() interval set with pace=${cfg.pace}ms`);
    if (onStatusUpdate) onStatusUpdate('WALKING', steps, stuckCount);
  };

  const stop = () => {
    status = 'IDLE';
    if (intervalId) {
      clearInterval(intervalId);
      // Remove from global tracking
      if (window.__DRUNK_WALKER_INTERVALS__) {
        window.__DRUNK_WALKER_INTERVALS__.delete(intervalId);
      }
      intervalId = null;
    }
    if (onWalkStop && isPathCollectionEnabled && walkPath.length > 0) {
      onWalkStop(getWalkPath());
    }
    if (onStatusUpdate) onStatusUpdate('IDLE', steps, 0);
  };

  const reset = () => {
    stop();
    steps = 0;
    stuckCount = 0;
    keyboardBlockStuckCount = 0;
    lastStuckYaw = null;
    lastUrl = null;
    status = 'IDLE';
    wheel.reset();
    previousLocation = null;
    previousYaw = null;
  };

  return {
    getStatus,
    getSteps,
    getStuckCount,
    isNavigating,
    setPace,
    setTurnDuration,
    setKeyboardMode,
    setPolygon,
    setPathCollection,
    setWalkPath,
    setSteps,
    getWalkPath,
    clearWalkPath,
    setSelfAvoiding: (enabled) => { cfg.selfAvoiding = enabled; },
    getVisitedCount,
    clearVisitedUrls,
    isUrlVisited,
    getVisitedUrls: () => visitedUrls,
    getCurrentYaw,
    resetCurrentYaw,
    getCumulativeTurnAngle,
    resetCumulativeTurnAngle,
    restoreVisitedFromPath,
    setUserMouseDown,
    setIsDrawing,
    setActionHandlers,
    start,
    stop,
    reset,
    tick,
    getConfig: () => ({ ...cfg }),
    getNavigation: () => null,
    getNavigationState: () => ({}),
    setAlgorithm: (newAlgorithm) => { algorithm = newAlgorithm; }
  };
}
