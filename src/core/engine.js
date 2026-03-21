/**
 * Drunk Walker Core Engine v5.3.0-STUCK-TYPE
 * 
 * ARCHITECTURE:
 * - Engine: State management, tick timing, path recording
 * - Wheel: Orientation management
 * - Traversal: Decision-making with stuck type detection
 */

import { createWheel } from './wheel.js';
import {
  createUnifiedAlgorithm,
  createDefaultAlgorithm,
  extractLocationFromUrl
} from './traversal.js';

export const VERSION = '5.4.1-STUCK-FIX';

export const defaultConfig = {
  pace: 2000,
  kbOn: true,
  panicThreshold: 10,
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
  let stuckCount = 0;
  let isUserMouseDown = false;
  let poly = [];
  let isDrawing = false;
  let isBusy = false;

  // Path collection
  let walkPath = [];
  let isPathCollectionEnabled = cfg.collectPath;

  // Visited nodes memory
  let visitedUrls = new Map();
  let breadcrumbs = [];

  // Track previous location for movement recording
  let previousLocation = null;
  let previousYaw = null;

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
    const match = url.match(/yaw[=%]3D?([0-9.]+)/i);
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
    if (isUserMouseDown || isDrawing || isBusy || status !== 'WALKING') return;

    const currentUrl = typeof window !== 'undefined' ? window.location.href : (lastUrl || '');
    const currentLocation = extractLocation(currentUrl);
    const currentYaw = extractYaw(currentUrl);

    // Sync internal orientation with URL if possible (helps logs and logic)
    if (currentYaw !== null && lastUrl === null) {
      wheel.setOrientation(currentYaw);
    }

    // 1. Stuck detection (URL hasn't changed since last tick)
    if (lastUrl !== null && currentUrl === lastUrl) {
      stuckCount++;
    } else {
      stuckCount = 0;
    }

    // 2. Record what happened since last tick in the graph
    if (previousLocation && algorithm.enhancedGraph) {
      if (currentLocation && currentLocation !== previousLocation) {
        // Successfully moved to a new bubble
        algorithm.enhancedGraph.recordMovement(
          previousLocation,
          currentLocation,
          previousYaw !== null ? previousYaw : wheel.getOrientation(),
          currentYaw || wheel.getOrientation(),
          steps
        );
      } else if (currentLocation === previousLocation && lastUrl !== null) {
        // Failed to move
        algorithm.enhancedGraph.recordFailedAttempt(
          previousLocation,
          previousYaw !== null ? previousYaw : wheel.getOrientation(),
          steps
        );
      }
    }

    // 3. Prepare context for decision
    previousLocation = currentLocation;

    const context = {
      url: currentUrl,
      location: currentLocation,
      visitedUrls,
      breadcrumbs,
      stuckCount,
      orientation: wheel.getOrientation()
    };

    const decision = algorithm.decide(context);

    if (decision.turn) {
      isBusy = true;
      wheel.turnLeft(decision.angle || 60, () => {
        // Save the NEW yaw we are pointing at before pressing ArrowUp
        previousYaw = wheel.getOrientation();
        if (cfg.kbOn) {
          if (onKeyPress) onKeyPress('ArrowUp');
        } else {
          const target = calculateClickTarget();
          if (onMouseClick) onMouseClick(target.x, target.y);
        }
        isBusy = false;
        // Update lastUrl AFTER turn might have changed it (via onKeyPress/navigation)
        lastUrl = typeof window !== 'undefined' ? window.location.href : currentUrl;
      });
      steps++;
      recordStep();
      cumulativeTurnAngle += decision.angle || 60;
    } else {
      // Save current yaw before pressing ArrowUp
      previousYaw = wheel.getOrientation();
      if (cfg.kbOn) {
        if (onKeyPress) onKeyPress('ArrowUp');
      } else {
        const target = calculateClickTarget();
        if (onMouseClick) onMouseClick(target.x, target.y);
      }
      steps++;
      recordStep();
      lastUrl = currentUrl;
    }

    // Update status EVERY tick (live numbers)
    if (onStatusUpdate) {
      onStatusUpdate(status, steps, stuckCount);
    }

    console.log(`url=${currentUrl}, currentYaw=${Math.round(wheel.getOrientation())}, stuck=${stuckCount}`);
  };

  const start = () => {
    if (status === 'WALKING') return;
    status = 'WALKING';
    if (steps === 0) {
      stuckCount = 0;
      lastUrl = null;
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
    if (onWalkStop && isPathCollectionEnabled && walkPath.length > 0) {
      onWalkStop(getWalkPath());
    }
    if (onStatusUpdate) onStatusUpdate('IDLE', steps, 0);
  };

  const reset = () => {
    stop();
    steps = 0;
    stuckCount = 0;
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
