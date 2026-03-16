/**
 * Navigation Strategies - Pluggable Movement Algorithms
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SELF-AVOIDING NAVIGATION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

export function createSelfAvoidingNavigation(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate, extractLocation } = callbacks;

  let state = 'IDLE';
  let urlBeforeTurn = '';
  
  // Track cumulative turn angle for each location (local memory)
  const locationTurns = new Map();

  const getRandomTurnAngle = () => {
    const randomVariation = (Math.random() - 0.5) * 300;  // ±150ms = ±15°
    const baseDuration = cfg.turnDuration / 2;  // ~300ms = ~30°
    return Math.max(200, Math.min(500, baseDuration + randomVariation));
  };

  const executeStep = (currentUrl, visitedUrls) => {
    if (!cfg.selfAvoiding || !onKeyPress) return { action: 'none' };
    if (state !== 'IDLE') return { action: 'none' };

    const currentLocation = extractLocation(currentUrl);
    
    // Logic: prev_angle + new_random. If > 360, subtract 360.
    const prevTurnAngle = locationTurns.get(currentLocation) || 0;
    const turnDuration = getRandomTurnAngle();
    const turnAngleChange = Math.round(turnDuration / 10);

    let newLocationAngle = prevTurnAngle + turnAngleChange;
    if (newLocationAngle >= 360) newLocationAngle -= 360;
    locationTurns.set(currentLocation, newLocationAngle);

    urlBeforeTurn = currentUrl;
    state = 'TURNING';

    if (onLongKeyPress) {
      onLongKeyPress('ArrowLeft', turnDuration, () => {
        console.log(`⬅️ Self-avoiding turn ~${turnAngleChange}° (loc angle: ${newLocationAngle}°)`);
        if (onKeyPress) onKeyPress('ArrowUp');
        console.log(`⬆️ Moving forward after turn`);

        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeTurn;
          const newLocation = extractLocation(newUrl);

          if (newUrl !== urlBeforeTurn) {
            visitedUrls.add(newLocation);
            console.log(`✅ Self-avoiding step successful - moved to: ${newLocation}`);
          } else {
            console.log(`⚠️ Still at same location after ${turnAngleChange}° turn`);
          }

          state = 'IDLE';
          if (onStatusUpdate) {
            onStatusUpdate('WALKING', 0, 0);
          }
        }, cfg.pace);
      });
    }

    return {
      action: 'turn',
      turnAngle: turnAngleChange
    };
  };

  return {
    executeStep,
    isBusy: () => state !== 'IDLE',
    reset: () => {
      state = 'IDLE';
      urlBeforeTurn = '';
      locationTurns.clear();
    },
    getState: () => ({ state, locationTurnsCount: locationTurns.size })
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNSTUCK NAVIGATION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

export function createUnstuckNavigation(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate, extractLocation } = callbacks;

  let state = 'IDLE';
  let urlBeforeUnstuck = '';
  
  // Memory of turns per location
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
  const selfAvoiding = createSelfAvoidingNavigation(cfg, callbacks);
  const unstuck = createUnstuckNavigation(cfg, callbacks);

  // Global orientation (start + all turns made)
  let globalOrientation = 0;

  const tick = (context) => {
    const { currentUrl, visitedUrls, stuckCount, isKeyboardMode } = context || {};

    if (selfAvoiding.isBusy() || unstuck.isBusy()) {
      return { action: 'none', busy: true };
    }

    if (!context) return { action: 'none', busy: false };

    // 1. UNSTUCK - URL hasn't changed
    if (cfg.expOn && stuckCount >= cfg.panicThreshold) {
      const result = unstuck.executeUnstuck(stuckCount, cfg.panicThreshold);
      if (result.action !== 'none') {
        globalOrientation += result.turnAngle;
        if (globalOrientation >= 360) globalOrientation -= 360;
        console.log(`🧭 Global orientation: ${globalOrientation}°`);
        return { ...result, strategy: 'unstuck', busy: true, cumulativeTurnAngle: globalOrientation };
      }
    }

    // 2. SELF-AVOIDING - At a visited location
    const currentLocation = callbacks.extractLocation(currentUrl);
    if (isKeyboardMode && cfg.selfAvoiding && visitedUrls.has(currentLocation)) {
      const result = selfAvoiding.executeStep(currentUrl, visitedUrls);
      if (result.action !== 'none') {
        globalOrientation += result.turnAngle;
        if (globalOrientation >= 360) globalOrientation -= 360;
        console.log(`🧭 Global orientation: ${globalOrientation}°`);
        return { ...result, strategy: 'self-avoiding', busy: true, cumulativeTurnAngle: globalOrientation };
      }
    }

    return { action: 'move', strategy: 'normal', busy: false };
  };

  return {
    tick,
    getCumulativeTurnAngle: () => globalOrientation,
    resetCumulativeTurnAngle: () => { globalOrientation = 0; },
    reset: () => {
      selfAvoiding.reset();
      unstuck.reset();
      globalOrientation = 0;
    },
    getState: () => ({
      globalOrientation,
      selfAvoiding: selfAvoiding.getState(),
      unstuck: unstuck.getState()
    })
  };
}

export default {
  createSelfAvoidingNavigation,
  createUnstuckNavigation,
  createNavigationController
};
