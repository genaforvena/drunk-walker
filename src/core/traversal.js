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
 * Advanced Traversal Algorithm
 * Implements:
 * A. Weighted "Heatmap" Exploration
 * B. Systematic Search Pattern for stuck recovery
 * C. Path avoidance using breadcrumbs
 */
export function createDefaultAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  
  // State for Systematic Search Pattern (Spiral Recovery)
  let lastSearchAngle = 0;

  /**
   * Decide what to do next
   * @param {Object} context - current state
   * @returns {Object} { turn: boolean, angle?: number }
   */
  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation } = context;

    // PRIORITY 1: Systematic Search (Stuck Recovery)
    if (cfg.expOn && stuckCount >= panicThreshold) {
      // If we just got stuck, start with a small angle
      // If we stay stuck, escalate the angle to scan all directions
      if (stuckCount === panicThreshold) {
        lastSearchAngle = 30;
      } else {
        lastSearchAngle = (lastSearchAngle + 30) % 360;
        if (lastSearchAngle === 0) lastSearchAngle = 30;
      }
      
      console.log(`Systematic Search: stuckCount=${stuckCount}, angle=${lastSearchAngle}`);
      return { turn: true, angle: lastSearchAngle };
    }

    // PRIORITY 2: Weighted Exploration (Proactive Avoidance)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      // Reset search angle when not stuck
      lastSearchAngle = 0;

      // Scan 360 degrees in 30 degree increments
      const scanAngles = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
      let bestScore = Infinity;
      let bestAngle = 0;

      for (const angle of scanAngles) {
        const testOrientation = normalizeAngle(orientation + angle);
        const testLocation = predictNextLocation(currentLocation, testOrientation);
        
        if (!testLocation) continue;

        // Calculate score: Lower is better
        // 1. Visit Count (Heatmap)
        const visitCount = visitedUrls.get(testLocation) || 0;
        
        // 2. Breadcrumb Penalty (Scent) - avoid recently visited areas more strongly
        let breadcrumbPenalty = 0;
        breadcrumbs.forEach((bc, index) => {
          if (bc === testLocation) {
            // Penalty is higher for more recent breadcrumbs
            breadcrumbPenalty += (index + 1); 
          }
        });

        // 3. Forward bias: slight preference for staying the same course if everything else is equal
        const forwardBias = (angle === 0) ? -0.1 : 0;

        const score = (visitCount * 10) + breadcrumbPenalty + forwardBias;

        if (score < bestScore) {
          bestScore = score;
          bestAngle = angle;
        }
      }

      // Only turn if the best angle is NOT the current one
      if (bestAngle !== 0) {
        console.log(`Exploration Decision: angle=${bestAngle}, score=${bestScore}`);
        return { turn: true, angle: Math.abs(bestAngle) };
      }
    }

    return { turn: false };
  };

  return { decide };
}
