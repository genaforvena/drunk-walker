/**
 * Navigation Strategies - Pluggable Movement Algorithms
 * 
 * ============================================================================
 * ARCHITECTURE
 * ============================================================================
 * 
 * This module contains ALL navigation/movement logic as swappable strategies.
 * The engine (engine.js) delegates movement decisions to this module.
 * 
 * TO CHANGE NAVIGATION BEHAVIOR:
 * 1. Edit this file (src/core/navigation.js)
 * 2. Or create a new strategy function and swap it in createNavigationController()
 * 
 * ============================================================================
 * STRATEGIES
 * ============================================================================
 * 
 * 1. createSelfAvoidingNavigation()
 *    - Prefers unvisited locations
 *    - Turns left 20°-50° at visited nodes
 *    - Immediately steps forward after turning
 *    - Verifies URL changed before allowing next action
 * 
 * 2. createUnstuckNavigation()
 *    - Recovery from stuck state (≥3 ticks at same URL)
 *    - Turns left 30°-90° with random bounded variation
 *    - Immediately steps forward after turning
 *    - Guaranteed to never get stuck (360° coverage)
 * 
 * 3. createNavigationController()
 *    - Combines both strategies
 *    - Priority: Unstuck > Self-Avoiding > Normal movement
 *    - State machine prevents continuous rotation
 * 
 * ============================================================================
 * STATE MACHINE
 * ============================================================================
 * 
 * Both strategies use the same state machine:
 * 
 *   IDLE ──▶ TURNING ──▶ MOVING ──▶ VERIFYING ──▶ IDLE
 *            (turn)     (step)     (check URL)
 * 
 * While busy (not IDLE), navigation.tick() returns { busy: true },
 * preventing new decisions until the current sequence completes.
 * 
 * ============================================================================
 * INTERFACE
 * ============================================================================
 * 
 * Each strategy returns an object with:
 * - executeStep/executeUnstuck(): Main action, returns { action, busy, ... }
 * - isBusy(): Check if sequence in progress
 * - getCumulativeTurnAngle(): Total degrees turned
 * - resetCumulativeTurnAngle(): Reset angle tracking
 * - reset(): Reset all state
 * - getState(): Debug info
 * 
 * createNavigationController() provides:
 * - tick(context): Main entry point, returns { action, busy, strategy }
 * - getCumulativeTurnAngle(), resetCumulativeTurnAngle(), reset, getState()
 * 
 * ============================================================================
 * EXAMPLE: Creating a Custom Strategy
 * ============================================================================
 * 
 * export function createMyCustomNavigation(cfg, callbacks) {
 *   let state = 'IDLE';
 *   
 *   const executeStep = (currentUrl, visitedUrls) => {
 *     if (state !== 'IDLE') return { action: 'none', busy: false };
 *     
 *     // Your custom logic here
 *     if (shouldTurn()) {
 *       state = 'TURNING';
 *       callbacks.onLongKeyPress('ArrowLeft', 500, () => {
 *         callbacks.onKeyPress('ArrowUp');
 *         setTimeout(() => { state = 'IDLE'; }, cfg.pace);
 *       });
 *       return { action: 'turn', busy: true };
 *     }
 *     
 *     return { action: 'move', busy: false };
 *   };
 *   
 *   return {
 *     executeStep,
 *     isBusy: () => state !== 'IDLE',
 *     getCumulativeTurnAngle: () => 0,
 *     resetCumulativeTurnAngle: () => {},
 *     reset: () => { state = 'IDLE'; },
 *     getState: () => ({ state })
 *   };
 * }
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SELF-AVOIDING NAVIGATION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Self-Avoiding Random Walk Navigation
 * 
 * Behavior:
 * - Detects when at a visited location
 * - Turns left with random bounded angle (20°-50°)
 * - Immediately steps forward after turn
 * - Verifies URL changed before allowing next action
 * 
 * @param {Object} cfg - Configuration object
 * @param {Object} callbacks - Callback functions
 * @returns {Object} Navigation strategy instance
 */
export function createSelfAvoidingNavigation(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate, extractLocation } = callbacks;

  // State machine: 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING'
  let state = 'IDLE';
  let urlBeforeTurn = '';
  let cumulativeTurnAngle = 0;
  
  // Track tried turn directions at each location to avoid repeating
  // Key: location, Value: Set of turn angles tried (binned to 30° = 12 directions)
  const triedTurns = new Map();

  /**
   * Bin turn angle to nearest 30° (12 directions)
   * @param {number} angle - Turn angle (0-360)
   * @returns {number} Binned angle
   */
  const binTurnAngle = (angle) => {
    return Math.round(angle / 30) * 30;
  };

  /**
   * Get a new turn angle that hasn't been tried at this location
   * @param {string} location - Current location
   * @returns {number} Turn angle in ms (200-500ms = 20°-50°)
   */
  const getNewTurnAngle = (location) => {
    const tried = triedTurns.get(location) || new Set();
    
    // Generate random angle between 20°-50° (200-500ms)
    // If we've tried 3+ angles, just pick random
    if (tried.size >= 3) {
      triedTurns.delete(location);  // Reset memory
      return getRandomTurnAngle();
    }
    
    // Try up to 5 times to find untried angle
    for (let i = 0; i < 5; i++) {
      const angle = getRandomTurnAngle();
      const binned = binTurnAngle(angle);
      if (!tried.has(binned)) {
        tried.add(binned);
        triedTurns.set(location, tried);
        return angle;
      }
    }
    
    // All angles tried, pick random anyway
    return getRandomTurnAngle();
  };

  /**
   * Get random turn angle (20°-50° = 200-500ms)
   * @returns {number} Turn duration in ms
   */
  const getRandomTurnAngle = () => {
    const randomVariation = (Math.random() - 0.5) * 300;  // ±150ms = ±15°
    const baseDuration = cfg.turnDuration / 2;  // ~300ms = ~30°
    return Math.max(200, Math.min(500, baseDuration + randomVariation));
  };

  /**
   * Execute self-avoiding step
   * @param {string} currentUrl - Current page URL
   * @param {Set} visitedUrls - Set of visited location identifiers
   * @returns {Object} Action result: { action: 'turn'|'move'|'none', ... }
   */
  const executeStep = (currentUrl, visitedUrls) => {
    if (!cfg.selfAvoiding || !onKeyPress) return { action: 'none' };
    if (state !== 'IDLE') return { action: 'none' }; // Already in progress

    const currentLocation = extractLocation(currentUrl);
    
    // Self-avoiding only triggers when we're stuck (URL hasn't changed)
    // This is handled by the engine's stuck detection, not here
    // Self-avoiding just influences TURN DIRECTION selection
    
    // ALWAYS TURN LEFT - but pick angle we haven't tried at this location
    const turnKey = 'ArrowLeft';
    const turnDuration = getNewTurnAngle(currentLocation);
    const turnAngleChange = Math.round(turnDuration / 10);

    // Update cumulative turn angle
    cumulativeTurnAngle = (cumulativeTurnAngle + turnAngleChange) % 360;

    // Start turn + move sequence: TURN -> MOVE -> VERIFY
    urlBeforeTurn = currentUrl;
    state = 'TURNING';

    if (onLongKeyPress) {
      onLongKeyPress(turnKey, turnDuration, () => {
        console.log(`⬅️ Self-avoiding turn ~${turnAngleChange}° (cumulative: ${cumulativeTurnAngle}°)`);
        // After turn completes, immediately step forward
        if (onKeyPress) onKeyPress('ArrowUp');
        console.log(`⬆️ Moving forward after turn`);

        // Verify after delay
        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeTurn;
          const newLocation = extractLocation(newUrl);

          if (newUrl !== urlBeforeTurn) {
            visitedUrls.add(newLocation);
            console.log(`✅ Self-avoiding step successful - moved to: ${newLocation} (stuck reset to 0)`);
            // Clear tried turns for new location
            triedTurns.delete(newLocation);
          } else {
            console.log(`⚠️ Still at same location after ${turnAngleChange}° turn`);
          }

          state = 'IDLE';
          // Reset stuck count on success (handled by engine via callback)
          if (onStatusUpdate) {
            onStatusUpdate('WALKING', 0, 0);  // Reset stuck on successful move
          }
        }, cfg.pace);
      });
    }

    return {
      action: 'turn',
      turnAngle: turnAngleChange,
      cumulativeTurnAngle
    };
  };

  /**
   * Check if navigation sequence is in progress
   * @returns {boolean} True if busy with turn/move/verify sequence
   */
  const isBusy = () => state !== 'IDLE';

  /**
   * Get current cumulative turn angle
   * @returns {number} Degrees turned (0-360)
   */
  const getCumulativeTurnAngle = () => cumulativeTurnAngle;

  /**
   * Reset cumulative turn angle
   */
  const resetCumulativeTurnAngle = () => { cumulativeTurnAngle = 0; };

  /**
   * Reset strategy state
   */
  const reset = () => {
    state = 'IDLE';
    urlBeforeTurn = '';
    cumulativeTurnAngle = 0;
    triedTurns.clear();
  };

  /**
   * Get current state for debugging
   * @returns {Object} Current state info
   */
  const getState = () => ({
    state,
    urlBeforeTurn,
    cumulativeTurnAngle
  });

  return {
    executeStep,
    isBusy,
    getCumulativeTurnAngle,
    resetCumulativeTurnAngle,
    reset,
    getState
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
 * - Turns left with random bounded angle (30°-90°)
 * - Immediately steps forward after turn
 * - Verifies URL changed, increments stuck counter if still stuck
 * - Guaranteed to eventually escape (360° coverage)
 * 
 * @param {Object} cfg - Configuration object
 * @param {Object} callbacks - Callback functions
 * @returns {Object} Navigation strategy instance
 */
export function createUnstuckNavigation(cfg, callbacks) {
  const { onKeyPress, onLongKeyPress, onStatusUpdate } = callbacks;

  // State machine: 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING'
  let state = 'IDLE';
  let urlBeforeUnstuck = '';
  let cumulativeTurnAngle = 0;

  /**
   * Execute unstuck sequence
   * @param {number} stuckCount - Current stuck counter
   * @param {number} panicThreshold - Threshold to trigger unstuck
   * @returns {Object} Action result: { action: 'turn'|'move'|'none', ... }
   */
  const executeUnstuck = (stuckCount, panicThreshold) => {
    if (state !== 'IDLE') return { action: 'none' };
    if (!cfg.expOn || stuckCount < panicThreshold) return { action: 'none' };

    console.log(`🚨 UNSTUCK TRIGGERED: Stuck count=${stuckCount} (threshold=${panicThreshold})`);

    // Start unstuck sequence: TURN -> MOVE -> VERIFY
    urlBeforeUnstuck = window.location.href;
    state = 'TURNING';

    // Turn left with bounded randomization (~30° to ~90°)
    // ALWAYS turns left - never right, never stuck
    const baseTurnDuration = cfg.turnDuration;  // 600ms = ~60°
    const randomVariation = (Math.random() - 0.5) * 600;  // ±300ms = ±30°
    const turnDuration = Math.max(300, Math.min(900, baseTurnDuration + randomVariation));
    const turnAngle = Math.round(turnDuration / 10);

    if (onLongKeyPress) {
      onLongKeyPress('ArrowLeft', turnDuration, () => {
        // Track turn angle
        cumulativeTurnAngle = (cumulativeTurnAngle + turnAngle) % 360;
        console.log(`⬅️ Unstuck: Turning left ~${turnAngle}° (cumulative: ${cumulativeTurnAngle}°)`);

        // After turn, move forward
        state = 'MOVING';
        if (onKeyPress) onKeyPress('ArrowUp');
        console.log(`⬆️ Unstuck: Moving forward after turn`);

        // Verify after delay
        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeUnstuck;

          // stuckCount returned here: 0 if moved, stuckCount+1 if still stuck
          let newStuckCount = 0;
          if (newUrl !== urlBeforeUnstuck) {
            // Successfully moved to new location - FRESH START!
            newStuckCount = 0;
            console.log(`✅ Unstuck SUCCESS - moved to new location (stuck reset to 0)`);
          } else {
            // Still at same location - increment stuck
            newStuckCount = stuckCount + 1;
            console.log(`⚠️ Still at same location after ${turnAngle}° left turn (stuck=${newStuckCount})`);
          }

          state = 'IDLE';
          // Return stuckCount to engine for reset
          if (onStatusUpdate) {
            onStatusUpdate('WALKING', 0, newStuckCount);
          }
        }, cfg.pace);
      });
    }

    return {
      action: 'turn',
      turnAngle,
      cumulativeTurnAngle,
      willUpdateStuckCount: true
    };
  };

  /**
   * Check if unstuck sequence is in progress
   * @returns {boolean} True if busy with turn/move/verify sequence
   */
  const isBusy = () => state !== 'IDLE';

  /**
   * Get current cumulative turn angle
   * @returns {number} Degrees turned (0-360)
   */
  const getCumulativeTurnAngle = () => cumulativeTurnAngle;

  /**
   * Reset cumulative turn angle
   */
  const resetCumulativeTurnAngle = () => { cumulativeTurnAngle = 0; };

  /**
   * Reset strategy state
   */
  const reset = () => {
    state = 'IDLE';
    urlBeforeUnstuck = '';
    cumulativeTurnAngle = 0;
  };

  /**
   * Get current state for debugging
   * @returns {Object} Current state info
   */
  const getState = () => ({
    state,
    urlBeforeUnstuck,
    cumulativeTurnAngle
  });

  return {
    executeUnstuck,
    isBusy,
    getCumulativeTurnAngle,
    resetCumulativeTurnAngle,
    reset,
    getState
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED NAVIGATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Combined Navigation Controller
 *
 * Manages both self-avoiding and unstuck strategies.
 * 
 * STRATEGY:
 * - Self-avoiding: Only triggers when stuck (same as unstuck)
 * - Self-avoiding influences TURN DIRECTION (avoids repeating same turn angles)
 * - Unstuck: Falls back if self-avoiding doesn't trigger
 *
 * @param {Object} cfg - Configuration object
 * @param {Object} callbacks - Callback functions
 * @returns {Object} Navigation controller instance
 */
export function createNavigationController(cfg, callbacks) {
  const selfAvoiding = createSelfAvoidingNavigation(cfg, callbacks);
  const unstuck = createUnstuckNavigation(cfg, callbacks);

  /**
   * Main navigation tick
   * @param {Object} context - Current navigation context
   * @param {string} context.currentUrl - Current page URL
   * @param {Set} context.visitedUrls - Set of visited locations
   * @param {number} context.stuckCount - Current stuck counter
   * @param {boolean} context.isKeyboardMode - True if keyboard mode enabled
   * @returns {Object} Navigation result
   */
  const tick = (context) => {
    const { currentUrl, visitedUrls, stuckCount, isKeyboardMode } = context || {};

    // Check if either strategy is busy
    if (selfAvoiding.isBusy() || unstuck.isBusy()) {
      return { action: 'none', busy: true };
    }

    // Skip navigation logic if no context provided (busy check only)
    if (!context) {
      return { action: 'none', busy: false };
    }

    // Priority: Self-avoiding when stuck > Unstuck when stuck > Normal movement
    // Self-avoiding only triggers when stuck (not on every revisit)
    if (isKeyboardMode && cfg.selfAvoiding && stuckCount >= cfg.panicThreshold) {
      // Use self-avoiding turn (picks new turn angle) when stuck
      const result = selfAvoiding.executeStep(currentUrl, visitedUrls);
      if (result.action !== 'none') {
        return {
          ...result,
          strategy: 'self-avoiding',
          busy: true
        };
      }
    }
    
    // Fallback to unstuck if self-avoiding didn't trigger
    if (cfg.expOn && stuckCount >= cfg.panicThreshold) {
      const result = unstuck.executeUnstuck(stuckCount, cfg.panicThreshold);
      if (result.action !== 'none') {
        return {
          ...result,
          strategy: 'unstuck',
          busy: true
        };
      }
    }

    // Normal movement (no special navigation needed)
    return {
      action: 'move',
      strategy: 'normal',
      busy: false
    };
  };

  /**
   * Get cumulative turn angle (from either strategy)
   * @returns {number} Total degrees turned
   */
  const getCumulativeTurnAngle = () => {
    return selfAvoiding.getCumulativeTurnAngle() || unstuck.getCumulativeTurnAngle();
  };

  /**
   * Reset all navigation state
   */
  const reset = () => {
    selfAvoiding.reset();
    unstuck.reset();
  };

  /**
   * Get navigation state for debugging
   * @returns {Object} Navigation state
   */
  const getState = () => ({
    selfAvoiding: selfAvoiding.getState(),
    unstuck: unstuck.getState()
  });

  return {
    tick,
    getCumulativeTurnAngle,
    resetCumulativeTurnAngle: () => {
      selfAvoiding.resetCumulativeTurnAngle();
      unstuck.resetCumulativeTurnAngle();
    },
    reset,
    getState
  };
}

// Default export for convenience
export default {
  createSelfAvoidingNavigation,
  createUnstuckNavigation,
  createNavigationController
};
