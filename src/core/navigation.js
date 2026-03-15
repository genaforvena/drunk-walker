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

  // State machine: 'IDLE' | 'TURNING' | 'VERIFYING'
  let state = 'IDLE';
  let urlBeforeTurn = '';
  let cumulativeTurnAngle = 0;

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
    const isCurrentVisited = visitedUrls.has(currentLocation);

    // Only turn if at visited location
    if (!isCurrentVisited || visitedUrls.size === 0) {
      return { action: 'none' };
    }

    // ALWAYS TURN LEFT - random bounded angle (~20° to ~50°)
    const turnKey = 'ArrowLeft';
    const randomVariation = (Math.random() - 0.5) * 300;  // ±150ms = ±15°
    const baseDuration = cfg.turnDuration / 2;  // ~300ms = ~30°
    const turnDuration = Math.max(200, Math.min(500, baseDuration + randomVariation));
    const turnAngleChange = Math.round(turnDuration / 10);

    // Update cumulative turn angle
    cumulativeTurnAngle = (cumulativeTurnAngle + turnAngleChange) % 360;

    // Start turn + move sequence: TURN -> MOVE -> VERIFY
    urlBeforeTurn = currentUrl;
    state = 'TURNING';

    if (onLongKeyPress) {
      onLongKeyPress(turnKey, turnDuration, () => {
        // After turn completes, immediately step forward
        if (onKeyPress) onKeyPress('ArrowUp');

        // Verify after delay
        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeTurn;
          const newLocation = extractLocation(newUrl);

          if (newUrl !== urlBeforeTurn) {
            visitedUrls.add(newLocation);
            console.log(`🤪 DRUNK WALKER: Self-avoiding step successful (turned left ~${turnAngleChange}°)`);
          } else {
            console.log(`🤪 DRUNK WALKER: Still at same location after ${turnAngleChange}° turn`);
          }

          state = 'IDLE';
          if (onStatusUpdate) {
            onStatusUpdate('WALKING', 0, 0); // Steps/stuck managed by engine
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

        // After turn, move forward
        state = 'MOVING';
        if (onKeyPress) onKeyPress('ArrowUp');

        // Verify after delay
        setTimeout(() => {
          state = 'VERIFYING';
          const newUrl = typeof window !== 'undefined' ? window.location.href : urlBeforeUnstuck;

          let newStuckCount = stuckCount;
          if (newUrl !== urlBeforeUnstuck) {
            // Successfully unstuck!
            newStuckCount = 0;
            console.log(`🤪 DRUNK WALKER: Unstuck successfully (turned left ~${turnAngle}°)!`);
          } else {
            // Still stuck - will turn left again on next attempt
            newStuckCount++;
            console.log(`🤪 DRUNK WALKER: Still stuck after ${turnAngle}° left turn (cumulative: ${cumulativeTurnAngle}°)`);
          }

          state = 'IDLE';
          if (onStatusUpdate) {
            const statusText = newStuckCount >= panicThreshold
              ? `PANIC! (STUCK ${newStuckCount})`
              : `STUCK (${newStuckCount})`;
            onStatusUpdate(statusText, 0, newStuckCount);
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
 * This is the default navigation controller used by the engine.
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

    // Priority: Unstuck > Self-Avoiding > Normal movement
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

    if (isKeyboardMode && cfg.selfAvoiding) {
      const result = selfAvoiding.executeStep(currentUrl, visitedUrls);
      if (result.action !== 'none') {
        return {
          ...result,
          strategy: 'self-avoiding',
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
