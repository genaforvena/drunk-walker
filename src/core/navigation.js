/**
 * Navigation Strategies - Compatibility Wrapper for v4.0.0+
 * This file maintains the old API for tests and bundle validation
 * but uses the new Traversal/Wheel architecture.
 */

import { createDefaultAlgorithm } from './traversal.js';

export function createProactiveAvoidance(cfg, callbacks) {
  const algorithm = createDefaultAlgorithm(cfg);
  return {
    executeProactiveAvoidance: (yaw, loc, visited) => {
      const result = algorithm.decide({ stuckCount: 0, currentLocation: loc, visitedUrls: visited, orientation: yaw });
      return result.turn ? { action: 'turn', turnAngle: result.angle, newYaw: (yaw - result.angle + 360) % 360 } : { action: 'none' };
    },
    isBusy: () => false,
    reset: () => {},
    getState: () => ({ state: 'IDLE' })
  };
}

export function createUnstuckNavigation(cfg, callbacks) {
  const algorithm = createDefaultAlgorithm(cfg);
  return {
    executeUnstuck: (stuckCount, panicThreshold, yaw) => {
      const result = algorithm.decide({ stuckCount, currentLocation: '', visitedUrls: new Set(), orientation: yaw });
      return result.turn ? { action: 'turn', turnAngle: result.angle, newYaw: (yaw - result.angle + 360) % 360 } : { action: 'none' };
    },
    isBusy: () => false,
    reset: () => {},
    getState: () => ({ state: 'IDLE' })
  };
}

export function createNavigationController(cfg, callbacks) {
  return {
    tick: () => ({ action: 'move', strategy: 'normal', busy: false }),
    getCumulativeTurnAngle: () => 0,
    resetCumulativeTurnAngle: () => {},
    reset: () => {},
    getState: () => ({ globalOrientation: 0, proactive: { state: 'IDLE' }, unstuck: { state: 'IDLE' } })
  };
}

export default {
  createProactiveAvoidance,
  createUnstuckNavigation,
  createNavigationController
};
