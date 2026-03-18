/**
 * Navigation Strategies - Pluggable Movement Algorithms
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PROACTIVE SELF-AVOIDING STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Proactive Self-Avoiding Algorithm - Prevent entering visited areas
 *
 * Behavior:
 * - Before moving forward, check if the next location is already visited
 * - If visited, proactively turn toward unvisited direction BEFORE getting stuck
 * - Uses lookahead to predict next position based on current heading
 * - Prefers right turns first (less common, more exploration), then left
 *
 * Key invariants:
 * - Only triggers when NOT stuck (proactive, not reactive)
 * - Scans multiple angles to find unvisited direction
 * - Falls back to unstuck algorithm if all directions are visited
 */
export function createProactiveAvoidance(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate, extractLocation } = callbacks;

  let state = 'IDLE';
  let urlBeforeTurn = '';

  // Track which directions we've tried at each location
  const locationAttempts = new Map();

  /**
   * Predict next location given current location, yaw, and step distance
   */
  const predictNextLocation = (currentLocation, yaw, stepDistance = 0.0005) => {
    const [lat, lng] = currentLocation.split(',').map(Number);
    const yawRad = yaw * Math.PI / 180;
    
    // Approximate lat/lng offset based on yaw (simplified projection)
    const dLat = Math.cos(yawRad) * stepDistance;
    const dLng = Math.sin(yawRad) * stepDistance / Math.cos(lat * Math.PI / 180);
    
    const nextLat = (lat + dLat).toFixed(6);
    const nextLng = (lng + dLng).toFixed(6);
    
    return `${nextLat},${nextLng}`;
  };

  /**
   * Check if a direction leads to visited location
   */
  const isDirectionVisited = (currentLocation, yaw, visitedUrls) => {
    const predicted = predictNextLocation(currentLocation, yaw);
    return visitedUrls.has(predicted);
  };

  /**
   * Find best unvisited direction by scanning angles
   * Returns { yaw, angle } or null if all directions visited
   */
  const findUnvisitedDirection = (currentLocation, currentYaw, visitedUrls) => {
    // Scan angles relative to current yaw: prefer perpendicular directions first
    const scanAngles = [90, -90, 45, -45, 135, -135, 180, 0];
    
    for (const angle of scanAngles) {
      const testYaw = normalizeAngle(currentYaw + angle);
      if (!isDirectionVisited(currentLocation, testYaw, visitedUrls)) {
        return { yaw: testYaw, angle };
      }
    }
    
    return null; // All directions visited
  };

  const executeProactiveAvoidance = (currentYaw, currentLocation, visitedUrls) => {
    if (state !== 'IDLE') return { action: 'none' };
    if (!cfg.expOn || !cfg.selfAvoiding) return { action: 'none' };
    if (!currentLocation) return { action: 'none' };

    // Check if forward direction leads to visited location
    const forwardVisited = isDirectionVisited(currentLocation, currentYaw, visitedUrls);
    
    if (!forwardVisited) {
      // Forward is clear, no avoidance needed
      return { action: 'none' };
    }

    // Forward leads to visited area, find alternative
    const bestDirection = findUnvisitedDirection(currentLocation, currentYaw, visitedUrls);
    
    if (!bestDirection) {
      // All directions visited, fall back to unstuck
      return { action: 'none', fallback: true };
    }

    urlBeforeTurn = window.location.href;
    state = 'TURNING';

    // Track this attempt
    const attemptsKey = currentLocation;
    const prevAttempts = locationAttempts.get(attemptsKey) || [];
    locationAttempts.set(attemptsKey, [...prevAttempts, bestDirection.angle]);

    const turnAngle = bestDirection.angle;
    const turnDuration = Math.round(Math.abs(turnAngle) * 10);
    const clampedDuration = Math.max(300, Math.min(900, turnDuration));

    if (onLongKeyPress) {
      const turnKey = turnAngle > 0 ? 'ArrowRight' : 'ArrowLeft';
      onLongKeyPress(turnKey, clampedDuration, () => {
        console.log(`proactive: url=${urlBeforeTurn}, currentYaw=${Math.round(bestDirection.yaw)}`);
        state = 'MOVING';
        if (onKeyPress) onKeyPress('ArrowUp');

        setTimeout(() => {
          state = 'IDLE';
          if (onStatusUpdate) {
            onStatusUpdate('WALKING', 0, 0);
          }
        }, cfg.pace);
      });
    }

    return {
      action: 'turn',
      turnAngle,
      newYaw: bestDirection.yaw,
      isProactive: true
    };
  };

  return {
    executeProactiveAvoidance,
    isBusy: () => state !== 'IDLE',
    reset: () => {
      state = 'IDLE';
      urlBeforeTurn = '';
      locationAttempts.clear();
    },
    getState: () => ({ state, locationAttemptsCount: locationAttempts.size })
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNSTUCK NAVIGATION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Unstuck Algorithm - Recovery from being stuck
 *
 * Behavior:
 * - Detects when stuck (URL unchanged for N ticks)
 * - Stores relative turn deltas (always negative/left) per location
 * - Applies progressively sharper left turns from current arrival facing
 * - Immediately steps forward after turn
 * - Verifies URL changed, increments stuck counter if still stuck
 *
 * Key invariants:
 * - lastTurnDelta is always negative (left turn magnitude)
 * - Same location revisited gets escalating left turn (more negative each time)
 * - Turn is always relative to how we arrived (physically coherent)
 */
export function createUnstuckNavigation(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate, extractLocation } = callbacks;

  let state = 'IDLE';
  let urlBeforeUnstuck = '';

  // Memory of relative turn deltas per location (always negative, 0 to -90 degrees)
  const locationTurnDeltas = new Map();

  const executeUnstuck = (stuckCount, panicThreshold, currentYaw) => {
    if (state !== 'IDLE') return { action: 'none' };
    if (!cfg.expOn || stuckCount < panicThreshold) return { action: 'none' };

    const currentUrl = window.location.href;
    const currentLocation = extractLocation(currentUrl);

    urlBeforeUnstuck = currentUrl;
    state = 'TURNING';

    // Get previous delta for this location (always negative or 0)
    const prevTurnDelta = locationTurnDeltas.get(currentLocation) || 0;

    // Compute baseDelta: prevDelta + random left increment (-15 to -45 degrees)
    // If first visit (prevDelta = 0), this gives fresh left turn of -15 to -45
    // If revisited, this makes turn more leftward than last time
    const randomLeftIncrement = -15 - Math.random() * 30;  // -15 to -45
    let baseDelta = prevTurnDelta + randomLeftIncrement;

    // Clamp to -90 degrees maximum (ensure we don't turn more than 90° left)
    baseDelta = Math.max(-90, baseDelta);

    // Store the delta we're using (always negative)
    locationTurnDeltas.set(currentLocation, baseDelta);

    // Apply to current arrival facing: newYaw = normalize(currentYaw + baseDelta)
    const newYaw = normalizeAngle(currentYaw + baseDelta);
    const turnAngle = Math.abs(baseDelta);  // Duration based on magnitude

    // Convert angle to duration (10ms per degree)
    const turnDuration = Math.round(turnAngle * 10);
    const clampedDuration = Math.max(300, Math.min(900, turnDuration));

    if (onLongKeyPress) {
      onLongKeyPress('ArrowLeft', clampedDuration, () => {
        console.log(`url=${currentUrl}, currentYaw=${Math.round(newYaw)}`);
        state = 'MOVING';
        if (onKeyPress) onKeyPress('ArrowUp');

        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeUnstuck;

          let newStuckCount = 0;
          if (newUrl !== urlBeforeUnstuck) {
            newStuckCount = 0;
          } else {
            newStuckCount = stuckCount + 1;
          }

          state = 'IDLE';
          if (onStatusUpdate) {
            onStatusUpdate('WALKING', 0, newStuckCount);
          }
        }, cfg.pace);
      });
    }

    return {
      action: 'turn',
      turnAngle: baseDelta,  // Return signed delta (negative for left)
      newYaw
    };
  };

  return {
    executeUnstuck,
    isBusy: () => state !== 'IDLE',
    reset: () => {
      state = 'IDLE';
      urlBeforeUnstuck = '';
      locationTurnDeltas.clear();
    },
    getState: () => ({ state, locationTurnDeltasCount: locationTurnDeltas.size }),
    getDeltaForLocation: (loc) => locationTurnDeltas.get(loc) || 0
  };
}

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED NAVIGATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export function createNavigationController(cfg, callbacks) {
  const proactive = createProactiveAvoidance(cfg, callbacks);
  const unstuck = createUnstuckNavigation(cfg, callbacks);

  // Global orientation (start + all turns made)
  let globalOrientation = 0;

  const tick = (context) => {
    const { stuckCount, currentYaw, currentLocation, visitedUrls } = context || {};

    if (proactive.isBusy() || unstuck.isBusy()) {
      return { action: 'none', busy: true };
    }

    if (!context) return { action: 'none', busy: false };

    // PRIORITY 1: Proactive avoidance (when NOT stuck)
    // Check if we should avoid visited areas before moving
    if (cfg.expOn && cfg.selfAvoiding && stuckCount === 0) {
      const result = proactive.executeProactiveAvoidance(currentYaw, currentLocation, visitedUrls);
      if (result.action === 'turn') {
        // Update global orientation with signed delta
        globalOrientation += result.turnAngle;
        if (globalOrientation < 0) globalOrientation += 360;
        if (globalOrientation >= 360) globalOrientation -= 360;
        return { ...result, strategy: 'proactive', busy: true, cumulativeTurnAngle: globalOrientation };
      }
      // If fallback: true, all directions visited - let unstuck handle it
    }

    // PRIORITY 2: Unstuck (when stuck for N ticks)
    if (cfg.expOn && stuckCount >= cfg.panicThreshold) {
      const result = unstuck.executeUnstuck(stuckCount, cfg.panicThreshold, currentYaw);
      if (result.action !== 'none') {
        // Update global orientation with signed delta (negative for left turn)
        globalOrientation += result.turnAngle;
        if (globalOrientation < 0) globalOrientation += 360;
        if (globalOrientation >= 360) globalOrientation -= 360;
        return { ...result, strategy: 'unstuck', busy: true, cumulativeTurnAngle: globalOrientation };
      }
    }

    // Normal movement (no special navigation needed)
    return { action: 'move', strategy: 'normal', busy: false };
  };

  return {
    tick,
    getCumulativeTurnAngle: () => globalOrientation,
    resetCumulativeTurnAngle: () => { globalOrientation = 0; },
    reset: () => {
      proactive.reset();
      unstuck.reset();
      globalOrientation = 0;
    },
    getState: () => ({
      globalOrientation,
      proactive: proactive.getState(),
      unstuck: unstuck.getState()
    })
  };
}

export default {
  createProactiveAvoidance,
  createUnstuckNavigation,
  createNavigationController
};
