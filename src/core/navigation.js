/**
 * Navigation Strategies - Pluggable Movement Algorithms
 */

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
  const unstuck = createUnstuckNavigation(cfg, callbacks);

  // Global orientation (start + all turns made)
  let globalOrientation = 0;

  const tick = (context) => {
    const { stuckCount, currentYaw } = context || {};

    if (unstuck.isBusy()) {
      return { action: 'none', busy: true };
    }

    if (!context) return { action: 'none', busy: false };

    // ONLY trigger rotation when STUCK
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
      unstuck.reset();
      globalOrientation = 0;
    },
    getState: () => ({
      globalOrientation,
      unstuck: unstuck.getState()
    })
  };
}

export default {
  createUnstuckNavigation,
  createNavigationController
};
