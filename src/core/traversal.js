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
 * EXPLORATION ALGORITHM (Default)
 * Focus: Heatmap avoidance and Breadcrumb scent
 */
export function createExplorationAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  let lastSearchAngle = 0;

  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation } = context;

    // PRIORITY 1: Systematic Search (Stuck Recovery)
    if (cfg.expOn && stuckCount >= panicThreshold) {
      if (stuckCount === panicThreshold) {
        lastSearchAngle = 60;
      } else {
        lastSearchAngle = (lastSearchAngle + 60) % 360;
        if (lastSearchAngle === 0) lastSearchAngle = 60;
      }
      return { turn: true, angle: lastSearchAngle };
    }

    // PRIORITY 2: Weighted Exploration (Proactive Avoidance)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      lastSearchAngle = 0;
      const scanAngles = [0, 60, -60, 120, -120, 180, -180];
      let bestScore = Infinity;
      let bestAngle = 0;

      for (const angle of scanAngles) {
        const testOrientation = normalizeAngle(orientation + angle);
        const testLocation = predictNextLocation(currentLocation, testOrientation);
        if (!testLocation) continue;

        const visitCount = visitedUrls.get(testLocation) || 0;
        let breadcrumbPenalty = 0;
        breadcrumbs.forEach((bc, index) => {
          if (bc === testLocation) breadcrumbPenalty += (index + 1);
        });

        const forwardBias = (angle === 0) ? -0.1 : 0;
        const score = (visitCount * 10) + breadcrumbPenalty + forwardBias;

        if (score < bestScore) {
          bestScore = score;
          bestAngle = angle;
        }
      }

      if (bestAngle !== 0) {
        return { turn: true, angle: Math.abs(bestAngle) };
      }
    }

    return { turn: false };
  };

  return { decide };
}

/**
 * CUL-DE-SAC HUNTER ALGORITHM
 * Focus: Seeking dead-ends and "High Friction" areas
 */
export function createHunterAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  
  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, orientation } = context;

    // PRIORITY 1: Snap-Back (The Dead-End Escape)
    // When we hit the panic threshold, we assume we found a dead end.
    // Instead of a search, we perform a 180 degree snap-back to escape.
    if (cfg.expOn && stuckCount >= panicThreshold) {
      console.log("🎯 CUL-DE-SAC HUNTER: Dead-end found! Performing Snap-Back escape.");
      // 180 degree turn to go back exactly where we came from
      return { turn: true, angle: 180 };
    }

    // PRIORITY 2: Curiosity-Based Sampling
    // The hunter prefers directions that it HASN'T visited yet, but it
    // doesn't care about the heatmap as much as finding "one-way" nodes.
    if (cfg.expOn && currentLocation && stuckCount === 0) {
      // Scan to find how many "exits" are available
      const scanAngles = [0, 60, 120, 180, 240, 300];
      let availableExits = 0;
      let unvisitedAngles = [];

      for (const angle of scanAngles) {
        const testOrientation = normalizeAngle(orientation + angle);
        const testLocation = predictNextLocation(currentLocation, testOrientation);
        if (testLocation && !visitedUrls.has(testLocation)) {
          unvisitedAngles.push(angle);
        }
        if (testLocation) availableExits++;
      }

      // If only 1 exit is available (and it's probably behind us), 
      // this is a "High Interest" node.
      if (availableExits <= 1) {
        console.log("🔍 CUL-DE-SAC HUNTER: High Interest node detected (1 exit).");
      }

      // Prefer unvisited directions to keep hunting
      if (unvisitedAngles.length > 0) {
        // Pick an unvisited angle that isn't 0
        const bestAngle = unvisitedAngles.find(a => a !== 0) || 0;
        if (bestAngle !== 0) {
          return { turn: true, angle: Math.abs(bestAngle) };
        }
      }
    }

    return { turn: false };
  };

  return { decide };
}

// Default export for backward compatibility
export const createDefaultAlgorithm = createExplorationAlgorithm;
