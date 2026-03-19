/**
 * Traversal algorithms for Drunk Walker
 * This is where decision-making logic lives
 */

/**
 * Normalizes angle to 0-359
 */
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Predict next location given current location, orientation, and step distance
 */
function predictNextLocation(currentLocation, orientation, stepDistance = 0.0005) {
  if (!currentLocation || typeof currentLocation !== 'string') return null;
  const parts = currentLocation.split(',');
  if (parts.length < 2) return currentLocation;

  const [lat, lng] = parts.map(Number);
  const yawRad = orientation * Math.PI / 180;
  
  // Approximate lat/lng offset based on yaw (simplified projection)
  const dLat = Math.cos(yawRad) * stepDistance;
  const dLng = Math.sin(yawRad) * stepDistance / Math.cos(lat * Math.PI / 180);
  
  const nextLat = (lat + dLat).toFixed(6);
  const nextLng = (lng + dLng).toFixed(6);
  
  return `${nextLat},${nextLng}`;
}

/**
 * Default Algorithm: Simple stuck detection and proactive avoidance
 */
export function createDefaultAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;

  /**
   * Decide what to do next
   * @param {Object} context - current state
   * @returns {Object} { turn: boolean, angle?: number }
   */
  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, orientation } = context;

    // PRIORITY 1: Unstuck (when stuck for N ticks)
    if (cfg.expOn && stuckCount >= panicThreshold) {
      // Escalating turn: more stuck = sharper turn
      // Always turn left (negative delta in old code, here positive angle to turnLeft)
      const angle = 30 + Math.random() * 60; // 30 to 90 degrees
      return { turn: true, angle };
    }

    // PRIORITY 2: Proactive avoidance (if enabled, only when NOT stuck)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      // Check if forward direction leads to visited location
      const nextLocation = predictNextLocation(currentLocation, orientation);
      
      if (nextLocation && nextLocation !== currentLocation && visitedUrls.has(nextLocation)) {
        // Forward leads to visited area, find alternative
        // Scan angles relative to current orientation: prefer perpendicular/backwards
        const scanAngles = [90, -90, 180, 45, -45];
        
        for (const angle of scanAngles) {
          const testOrientation = normalizeAngle(orientation + angle);
          const testLocation = predictNextLocation(currentLocation, testOrientation);
          if (testLocation && !visitedUrls.has(testLocation)) {
            return { turn: true, angle: Math.abs(angle) };
          }
        }
        
        // If all directions visited, just turn a default amount
        return { turn: true, angle: 90 };
      }
    }

    return { turn: false };
  };

  return { decide };
}
