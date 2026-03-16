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
 * - Turns left with random bounded angle (30°-90°)
 * - Maintains memory of previous turns at each location (Self-Avoiding)
 * - Immediately steps forward after turn
 * - Verifies URL changed, increments stuck counter if still stuck
 */
export function createUnstuckNavigation(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate, extractLocation } = callbacks;

  let state = 'IDLE';
  let urlBeforeUnstuck = '';
  
  // Memory of turns per location (The "Self-Avoiding" part)
  const locationTurns = new Map();

  const executeUnstuck = (stuckCount, panicThreshold) => {
    if (state !== 'IDLE') return { action: 'none' };
    if (!cfg.expOn || stuckCount < panicThreshold) return { action: 'none' };

    console.log(`🚨 UNSTUCK TRIGGERED: Stuck count=${stuckCount} (threshold=${panicThreshold})`);

    const currentUrl = window.location.href;
    const currentLocation = extractLocation(currentUrl);

    urlBeforeUnstuck = currentUrl;
    state = 'TURNING';

    // Turn left with bounded randomization (~30° to ~90°)
    const baseTurnDuration = cfg.turnDuration;  // 600ms = ~60°
    const randomVariation = (Math.random() - 0.5) * 600;  // ±300ms = ±30°
    const turnDuration = Math.max(300, Math.min(900, baseTurnDuration + randomVariation));
    const turnAngle = Math.round(turnDuration / 10);

    // Logic: prev_angle + new_random. If > 360, subtract 360.
    const prevTurnAngle = locationTurns.get(currentLocation) || 0;
    let newLocationAngle = prevTurnAngle + turnAngle;
    if (newLocationAngle >= 360) newLocationAngle -= 360;
    locationTurns.set(currentLocation, newLocationAngle);

    if (onLongKeyPress) {
      onLongKeyPress('ArrowLeft', turnDuration, () => {
        console.log(`⬅️ Unstuck: Turning left ~${turnAngle}° (loc angle: ${newLocationAngle}°)`);
        state = 'MOVING';
        if (onKeyPress) onKeyPress('ArrowUp');
        console.log(`⬆️ Unstuck: Moving forward after turn`);

        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeUnstuck;

          let newStuckCount = 0;
          if (newUrl !== urlBeforeUnstuck) {
            newStuckCount = 0;
            console.log(`✅ Unstuck SUCCESS - moved to new location`);
          } else {
            newStuckCount = stuckCount + 1;
            console.log(`⚠️ Still at same location after ${turnAngle}° left turn (stuck=${newStuckCount})`);
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
      turnAngle
    };
  };

  return {
    executeUnstuck,
    isBusy: () => state !== 'IDLE',
    reset: () => {
      state = 'IDLE';
      urlBeforeUnstuck = '';
      locationTurns.clear();
    },
    getState: () => ({ state, locationTurnsCount: locationTurns.size })
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED NAVIGATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export function createNavigationController(cfg, callbacks) {
  const unstuck = createUnstuckNavigation(cfg, callbacks);

  // Global orientation (start + all turns made)
  let globalOrientation = 0;

  const tick = (context) => {
    const { stuckCount } = context || {};

    if (unstuck.isBusy()) {
      return { action: 'none', busy: true };
    }

    if (!context) return { action: 'none', busy: false };

    // ONLY trigger rotation when STUCK
    if (cfg.expOn && stuckCount >= cfg.panicThreshold) {
      const result = unstuck.executeUnstuck(stuckCount, cfg.panicThreshold);
      if (result.action !== 'none') {
        globalOrientation += result.turnAngle;
        if (globalOrientation >= 360) globalOrientation -= 360;
        console.log(`🧭 Global orientation: ${globalOrientation}°`);
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
