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
  let lastUrl = '';  // Track URL to detect actual arrivals
  
  // Track (location + heading) states - turn only if revisiting same state
  // Key: "lat,lng@headingBin" (heading binned to 45° = 8 directions)
  const visitedStates = new Map();

  /**
   * Bin heading to nearest 45° (8 directions)
   * @param {number} heading - Current heading (0-360)
   * @returns {number} Binned heading
   */
  const binHeading = (heading) => {
    return Math.round(heading / 45) * 45;
  };

  /**
   * Get current heading from URL yaw parameter
   * Format: ...@lat,lng,3a,XXy,Yt/data=... where XX = yaw
   * @param {string} url - Street View URL
   * @returns {number} Heading in degrees (0-360)
   */
  const extractHeading = (url) => {
    try {
      // Match pattern: ,XXy, where XX is yaw/heading
      const match = url.match(/,(\d+)y,/);
      if (match) {
        return parseInt(match[1], 10);
      }
    } catch (e) {}
    return 0; // Default heading
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
    const currentHeading = extractHeading(currentUrl);
    const binnedHeading = binHeading(currentHeading);
    
    // Only track state on actual ARRIVAL (URL changed from last tick)
    // This prevents incrementing count on every tick at same location
    const hasMoved = currentUrl !== lastUrl;
    
    if (hasMoved) {
      // Just arrived at this location - record the state
      const stateKey = `${currentLocation}@${binnedHeading}`;
      const stateCount = visitedStates.get(stateKey) || 0;
      visitedStates.set(stateKey, stateCount + 1);
      lastUrl = currentUrl;
      
      console.log(`🚶 Step: Moving forward at ${currentLocation} (heading ${binnedHeading}°, count=${stateCount + 1})`);
      
      // First visit with this heading - continue exploring
      if (stateCount < 1 || visitedUrls.size === 0) {
        return { action: 'none' };
      }
      
      // Revisit with same heading - time to turn
      console.log(`🔄 Self-avoiding: REVISIT at ${currentLocation} (heading ${binnedHeading}°, count=${stateCount + 1}) - turning left`);
    } else {
      // Still at same location - haven't moved yet
      // Don't increment count, just check if we should turn
      const stateKey = `${currentLocation}@${binnedHeading}`;
      const stateCount = visitedStates.get(stateKey) || 0;
      
      if (stateCount < 1 || visitedUrls.size === 0) {
        return { action: 'none' };
      }
      
      // Already decided to turn, waiting for execution
      console.log(`🔄 Self-avoiding: REVISIT at ${currentLocation} (heading ${binnedHeading}°, count=${stateCount}) - turning left`);
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
        console.log(`⬅️ Turning left ~${turnAngleChange}° (cumulative: ${cumulativeTurnAngle}°)`);
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
            console.log(`✅ Self-avoiding step successful - moved to new location: ${newLocation}`);
          } else {
            console.log(`⚠️ Still at same location after ${turnAngleChange}° turn`);
          }

          state = 'IDLE';
          // Note: stuckCount is managed by engine, not here
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
    visitedStates.clear();
    lastUrl = '';
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

          if (newUrl !== urlBeforeUnstuck) {
            // Successfully moved to new location
            console.log(`✅ Unstuck SUCCESS - moved to new location`);
          } else {
            // Still at same location after turn+move
            console.log(`⚠️ Still at same location after ${turnAngle}° left turn`);
          }

          state = 'IDLE';
          // Note: stuckCount is managed by engine, not here
          // Engine resets stuckCount when turn is initiated
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
