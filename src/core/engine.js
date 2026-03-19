/**
 * Drunk Walker Core Engine
 * Independent navigation logic - works without UI
 * 
 * ARCHITECTURE:
 * - Engine: State management, tick timing, path recording (this file)
 * - Wheel: Orientation management (in src/core/wheel.js)
 * - Traversal: Decision-making logic (in src/core/traversal.js)
 * 
 * TO CHANGE NAVIGATION BEHAVIOR:
 * Edit src/core/traversal.js - NOT this file
 */

import { createWheel } from './wheel.js';
import { 
  createExplorationAlgorithm, 
  createHunterAlgorithm,
  createSurgicalAlgorithm,
  createDefaultAlgorithm 
} from './traversal.js';

export const VERSION = '3.70.0-EXP';

export const defaultConfig = {
  pace: 2000,
  mode: 'EXPLORER', // Default mode
  kbOn: true,      // Keyboard mode ON by default
  expOn: true,     // Experimental mode ON by default (enables unstuck algorithm)
  panicThreshold: 3,
  radius: 50,
  targetX: 0.4,    // 40% of screen width (left of center)
  targetY: 0.8,    // 80% of screen height (lower than center)
  turnDuration: 600,  // ms to hold ArrowLeft for ~60° turn (fixed)
  collectPath: true,  // Path recording ENABLED by default
  selfAvoiding: true  // Self-avoiding walk ENABLED by default (opt-out)
};

export function createEngine(config = {}) {
  const cfg = { ...defaultConfig, ...config };

  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let lastUrl = typeof window !== 'undefined' ? window.location.href : '';
  let stuckCount = 0;
  let isUserMouseDown = false;
  let poly = [];
  let isDrawing = false;
  let isBusy = false;

  // Path collection (opt-in)
  let walkPath = [];
  let isPathCollectionEnabled = cfg.collectPath;

  // Visited nodes memory for self-avoiding walk
  let visitedUrls = new Map(); // location -> count
  let breadcrumbs = []; // last 20 locations

  // Action callbacks (to be provided by caller)
  let onKeyPress = null;
  let onMouseClick = null;
  let onStatusUpdate = null;
  let onLongKeyPress = null;
  let onWalkStop = null;

  // Extract location from Street View URL
  const extractLocation = (url) => {
    try {
      const urlObj = new URL(url);
      const hash = urlObj.hash || urlObj.pathname;
      const match = hash.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        return `${match[1]},${match[2]}`;
      }
      const placeMatch = urlObj.searchParams.get('place_id');
      if (placeMatch) {
        return `place:${placeMatch}`;
      }
      return urlObj.pathname + urlObj.hash;
    } catch (e) {
      return url;
    }
  };

  // Components
  const wheel = createWheel({
    onLongKeyPress: (key, duration, callback) => {
      if (onLongKeyPress) onLongKeyPress(key, duration, callback);
      else if (callback) callback();
    }
  });

  let algorithm = createDefaultAlgorithm(cfg);

  // State getters
  const getStatus = () => status;
  const getSteps = () => steps;
  const getStuckCount = () => stuckCount;
  const isNavigating = () => status === 'WALKING';

  // Configuration setters
  const setPace = (newPace) => {
    cfg.pace = newPace;
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
    if (!enabled) walkPath = [];
  };
  const setWalkPath = (path) => { walkPath = path ? [...path] : []; };
  const setSteps = (count) => { steps = count; };
  const getWalkPath = () => [...walkPath];
  const clearWalkPath = () => { walkPath = []; };

  const recordStep = () => {
    if (isPathCollectionEnabled) {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : lastUrl;
      const location = extractLocation(currentUrl);
      walkPath.push({
        url: currentUrl,
        currentYaw: Math.round(wheel.getOrientation())
      });
      if (cfg.selfAvoiding) {
        const count = visitedUrls.get(location) || 0;
        visitedUrls.set(location, count + 1);

        breadcrumbs.push(location);
        if (breadcrumbs.length > 20) breadcrumbs.shift();
      }
    }
  };

  const isUrlVisited = (location) => visitedUrls.has(location);
  const clearVisitedUrls = () => { visitedUrls.clear(); breadcrumbs = []; };
  const getVisitedCount = () => visitedUrls.size;
  const getCurrentYaw = () => wheel.getOrientation();
  const resetCurrentYaw = () => { wheel.reset(); };
  const getCumulativeTurnAngle = getCurrentYaw;
  const resetCumulativeTurnAngle = resetCurrentYaw;

  const restoreVisitedFromPath = (path) => {
    visitedUrls.clear();
    breadcrumbs = [];
    path.forEach(step => {
      let loc = step.location;
      if (!loc && step.url) {
        loc = extractLocation(step.url);
      }
      if (loc) {
        const count = visitedUrls.get(loc) || 0;
        visitedUrls.set(loc, count + 1);

        breadcrumbs.push(loc);
        if (breadcrumbs.length > 20) breadcrumbs.shift();
      }
    });
  };

  const setUserMouseDown = (down) => { isUserMouseDown = down; };
  const setIsDrawing = (drawing) => { isDrawing = drawing; };

  const setActionHandlers = ({ keyPress, mouseClick, statusUpdate, longKeyPress, walkStop }) => {
    onKeyPress = keyPress;
    onMouseClick = mouseClick;
    onStatusUpdate = statusUpdate;
    onLongKeyPress = longKeyPress;
    onWalkStop = walkStop;
  };

  const updateStuckDetection = () => {
    if (!cfg.expOn) {
      stuckCount = 0;
      return;
    }

    const currentUrl = typeof window !== 'undefined' ? window.location.href : lastUrl;
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
    const cw = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const ch = typeof window !== 'undefined' ? window.innerHeight : 1000;

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

    const radius = cfg.expOn && stuckCount >= cfg.panicThreshold
      ? cfg.radius * Math.pow(1.5, stuckCount - cfg.panicThreshold + 1)
      : cfg.radius;

    const wobble = () => (Math.random() * 2 - 1) * radius;
    return {
      x: cw * cfg.targetX + wobble(),
      y: cfg.targetY * ch + wobble()
    };
  };

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

  const tick = () => {
    if (isUserMouseDown || isDrawing) return;

    updateStuckDetection();

    if (onStatusUpdate) {
      onStatusUpdate(getStatusText(), steps, stuckCount);
    }

    if (isBusy) {
      // Skip decision and movement, but still count the step as "busy"
      steps++;
      recordStep();
      return;
    }

    const currentUrl = typeof window !== 'undefined' ? window.location.href : lastUrl;
    const currentLocation = extractLocation(currentUrl);

    // Get algorithm decision
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
      // Turn BEFORE pressing ArrowUp
      isBusy = true;
      wheel.turnLeft(decision.angle || 60, () => {
        // Continue with ArrowUp after turn finishes
        if (cfg.kbOn) {
          if (onKeyPress) onKeyPress('ArrowUp');
        } else {
          const target = calculateClickTarget();
          if (onMouseClick) onMouseClick(target.x, target.y);
        }
        // Step and record are handled by the main tick or here
        // Wait, if we set isBusy=true, the current tick should still count as a step
        isBusy = false;
      });
      // The tick that triggered the turn also counts as a step
      steps++;
      recordStep();
    } else {
      // Normal movement
      if (cfg.kbOn) {
        if (onKeyPress) onKeyPress('ArrowUp');
      } else {
        const target = calculateClickTarget();
        if (onMouseClick) onMouseClick(target.x, target.y);
      }
      steps++;
      recordStep();
    }
    
    console.log(`url=${currentUrl}, currentYaw=${Math.round(wheel.getOrientation())}`);
  };

  const start = () => {
    if (status === 'WALKING') return;
    status = 'WALKING';
    if (steps === 0) {
      stuckCount = 0;
      lastUrl = typeof window !== 'undefined' ? window.location.href : '';
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
    lastUrl = '';
    status = 'IDLE';
    wheel.reset();
  };

  return {
    getStatus,
    getSteps,
    getStuckCount,
    isNavigating,
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
    getVisitedCount,
    clearVisitedUrls,
    isUrlVisited,
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
    setMode: (mode) => {
      cfg.mode = mode;
      if (mode === 'HUNTER') {
        algorithm = createHunterAlgorithm(cfg);
      } else if (mode === 'SURGEON') {
        algorithm = createSurgicalAlgorithm(cfg);
      } else {
        algorithm = createExplorationAlgorithm(cfg);
      }
      console.log(`🤪 Mode changed to: ${mode}`);
    },
    // Stubs for backward compatibility
    getNavigation: () => null,
    getNavigationState: () => ({}),
    setAlgorithm: (newAlgorithm) => { algorithm = newAlgorithm; }
  };
}
