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
 * Extract yaw from Google Street View URL
 * URL format: ...yaw%3D<yaw_value>!7i...
 * @param {string} url - The Street View URL
 * @returns {number|null} - The yaw value or null if not found
 */
export function extractYawFromUrl(url) {
  if (!url) return null;
  const match = url.match(/yaw%3D([0-9.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract location from Google Street View URL
 * URL format: ...@<lat>,<lng>...
 * @param {string} url - The Street View URL
 * @returns {string|null} - The location as "lat,lng" or null if not found
 */
export function extractLocationFromUrl(url) {
  if (!url) return null;
  const hashMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (hashMatch) {
    return `${hashMatch[1]},${hashMatch[2]}`;
  }
  return null;
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
 * Calculate entropy of visited locations in scan directions
 * Low entropy = all directions equally "hot" (time for random exploration)
 * High entropy = clear difference between hot and cold (use normal scoring)
 */
function calculateEntropy(visitedUrls, currentLocation, orientation) {
  const scanAngles = [0, 60, -60, 120, -120, 180];
  
  const visitCounts = scanAngles.map(angle => {
    const testOrientation = normalizeAngle(orientation + angle);
    const testLocation = predictNextLocation(currentLocation, testOrientation);
    if (!testLocation) return 0;
    return visitedUrls.get(testLocation) || 0;
  });
  
  const avgVisits = visitCounts.reduce((a, b) => a + b, 0) / visitCounts.length;
  const variance = visitCounts.reduce((sum, v) => sum + Math.pow(v - avgVisits, 2), 0) / visitCounts.length;
  
  return { avgVisits, variance, visitCounts };
}

/**
 * EXPLORATION ALGORITHM (Default)
 * Focus: Heatmap avoidance and Breadcrumb scent
 */
export function createExplorationAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  let lastSearchAngle = 0;
  let extendedStuckCount = 0;
  let lowEntropyMode = false;
  let lowEntropyCounter = 0;

  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation } = context;

    // PRIORITY 0: Early Loop Detection
    // If we're returning to a location in recent breadcrumbs, escape immediately
    if (cfg.expOn && currentLocation && stuckCount === 0) {
      const recentBreadcrumbIndex = breadcrumbs.slice(-10).indexOf(currentLocation);
      if (recentBreadcrumbIndex !== -1) {
        // We're looping back! Perform 180° snap-back to escape
        console.log("🔄 LOOP DETECTED! Escaping with 180° turn");
        return { turn: true, angle: 180 };
      }
    }

    // PRIORITY 1: Systematic Search (Stuck Recovery)
    if (cfg.expOn && stuckCount >= panicThreshold) {
      extendedStuckCount = stuckCount;
      lowEntropyMode = false;
      lowEntropyCounter = 0;

      // Adaptive search: use smaller angles if stuck for too long
      let searchIncrement = 60;
      if (stuckCount >= 10) {
        searchIncrement = 30; // Fine-grained search
      }
      if (stuckCount >= 20) {
        // Random escape for extended stuck situations
        const randomAngle = Math.floor(Math.random() * 360);
        console.log(`🎲 Extended stuck (${stuckCount}), trying random angle: ${randomAngle}°`);
        return { turn: true, angle: randomAngle };
      }

      if (stuckCount === panicThreshold) {
        lastSearchAngle = searchIncrement;
      } else {
        lastSearchAngle = (lastSearchAngle + searchIncrement) % 360;
        if (lastSearchAngle === 0) lastSearchAngle = searchIncrement;
      }
      return { turn: true, angle: lastSearchAngle };
    }

    // PRIORITY 2: Entropy-Based Exploration
    // When all directions are equally "hot", switch to random exploration
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      const entropy = calculateEntropy(visitedUrls, currentLocation, orientation);
      
      // Detect low entropy: all directions similarly visited
      const isLowEntropy = entropy.variance < 3 && entropy.avgVisits > 3;
      
      if (isLowEntropy) {
        lowEntropyCounter++;
        
        // After 3+ ticks of low entropy, trigger random exploration
        if (lowEntropyCounter >= 3) {
          lowEntropyMode = true;
          const randomAngle = Math.floor(Math.random() * 360);
          console.log(`🎲 LOW ENTROPY (var=${entropy.variance.toFixed(2)}, avg=${entropy.avgVisits.toFixed(1)}), random escape: ${randomAngle}°`);
          return { turn: true, angle: randomAngle };
        }
      } else {
        lowEntropyMode = false;
        lowEntropyCounter = 0;
      }
      
      extendedStuckCount = 0;
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
          // Recent breadcrumbs get MUCH higher penalty to avoid loops
          if (bc === testLocation) breadcrumbPenalty += (100 - index * 5);
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
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation } = context;

    // PRIORITY 0: Early Loop Detection
    // If we're returning to a location in recent breadcrumbs, escape immediately
    if (cfg.expOn && currentLocation && stuckCount === 0) {
      const recentBreadcrumbIndex = breadcrumbs.slice(-10).indexOf(currentLocation);
      if (recentBreadcrumbIndex !== -1) {
        console.log("🔄 HUNTER: LOOP DETECTED! Escaping with 180° turn");
        return { turn: true, angle: 180 };
      }
    }

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

/**
 * SURGICAL SURVEYOR ALGORITHM
 * Focus: Maximizing steps/visited ratio.
 * Vetoes probing directions that are already visited.
 * 
 * KEY INSIGHT: Surgeon must escape cycles AGGRESSIVELY because its goal
 * is 1:1 steps/visited ratio. Any retracing is failure.
 */
export function createSurgicalAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  let extendedStuckCount = 0;
  let consecutiveTurns = 0;
  let lastTurnDirection = 0;

  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation, transitionGraph } = context;

    // PRIORITY 0: Use Learned Transition Graph (100% accurate for known connections)
    if (cfg.expOn && cfg.selfAvoiding && transitionGraph && currentLocation) {
      const learnedEscape = transitionGraph.findEscape(currentLocation, visitedUrls);
      if (learnedEscape) {
        // We have a learned connection to an unvisited location!
        // Calculate angle to that location
        const parts = learnedEscape.split(',');
        const targetLat = parseFloat(parts[0]);
        const targetLng = parseFloat(parts[1]);
        const currentParts = currentLocation.split(',');
        const currentLat = parseFloat(currentParts[0]);
        const currentLng = parseFloat(currentParts[1]);
        
        // Calculate angle to target
        const dLat = targetLat - currentLat;
        const dLng = targetLng - currentLng;
        let targetAngle = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (targetAngle < 0) targetAngle += 360;
        
        // Calculate turn angle from current orientation
        let turnAngle = targetAngle - orientation;
        if (turnAngle < 0) turnAngle += 360;
        if (turnAngle > 360) turnAngle -= 360;
        
        // Prefer turning over going straight if angle is significant
        if (turnAngle > 10 && turnAngle < 350) {
          console.log(`🗺️ SURGEON: Using learned connection to escape`);
          return { turn: true, angle: Math.abs(turnAngle) };
        }
      }
    }

    // PRIORITY 1: Oscillation Detection (BEFORE returning to breadcrumb)
    if (cfg.expOn && currentLocation && stuckCount === 0) {
      const recentBreadcrumbIndex = breadcrumbs.slice(-10).indexOf(currentLocation);
      if (recentBreadcrumbIndex !== -1 && recentBreadcrumbIndex < 8) {
        // We're returning to a location from 2-8 steps ago - definite loop
        console.log(`🔄 SURGEON: LOOP DETECTED (back to step -${10 - recentBreadcrumbIndex})! 180° escape`);
        consecutiveTurns = 0;
        return { turn: true, angle: 180 };
      }
    }

    // PRIORITY 2: Entropy-Based Escape (linear territory)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      const entropy = calculateEntropy(visitedUrls, currentLocation, orientation);
      
      // Surgeon uses LOWER threshold - escapes linear traps earlier
      const isLowEntropy = entropy.variance < 5 && entropy.avgVisits > 2;
      
      if (isLowEntropy) {
        consecutiveTurns++;
        
        // After 2+ ticks of low entropy, Surgeon takes action (faster than Explorer)
        if (consecutiveTurns >= 2) {
          const randomAngle = Math.floor(Math.random() * 360);
          console.log(`🎲 SURGEON: LOW ENTROPY (var=${entropy.variance.toFixed(2)}), random escape: ${randomAngle}°`);
          consecutiveTurns = 0;
          return { turn: true, angle: randomAngle };
        }
      } else {
        consecutiveTurns = 0;
      }
    }

    // PRIORITY 3: Standard Surgical Logic (veto visited)
    const isForwardVisited = currentLocation && visitedUrls.has(predictNextLocation(currentLocation, orientation));

    if (stuckCount > 0 || isForwardVisited) {
      extendedStuckCount = stuckCount;
      consecutiveTurns = 0;

      // Extended stuck handling
      if (stuckCount >= 20) {
        const randomAngle = Math.floor(Math.random() * 360);
        console.log(`🎲 SURGEON: Extended stuck (${stuckCount}), random escape: ${randomAngle}°`);
        return { turn: true, angle: randomAngle };
      }

      // Scan 360 in 60 increments (or 30 if extended stuck)
      let scanAngles = [60, -60, 120, -120, 180, 0];
      if (stuckCount >= 10) {
        // Fine-grained search with 30° increments
        scanAngles = [30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180, 0];
      }

      for (const angle of scanAngles) {
        const testOrientation = normalizeAngle(orientation + angle);
        const testLocation = predictNextLocation(currentLocation, testOrientation);

        // VETO: If we know it's visited, don't even try (don't probe)
        if (testLocation && visitedUrls.has(testLocation)) continue;
        if (testLocation && breadcrumbs.includes(testLocation)) continue;

        // Found a potentially "clean" node
        if (angle === 0) return { turn: false };
        return { turn: true, angle: Math.abs(angle) };
      }

      // If everything is visited, fall back to the "coldest" heatmap spot (Explorer logic)
      let bestScore = Infinity;
      let bestAngle = 60;
      for (const angle of [60, -60, 120, -120, 180]) {
        const testOrientation = normalizeAngle(orientation + angle);
        const testLocation = predictNextLocation(currentLocation, testOrientation);
        const score = visitedUrls.get(testLocation) || 0;
        if (score < bestScore) {
          bestScore = score;
          bestAngle = angle;
        }
      }
      return { turn: true, angle: Math.abs(bestAngle) };
    }

    consecutiveTurns = 0;
    return { turn: false };
  };

  return { decide };
}

// Default export for backward compatibility
export const createDefaultAlgorithm = createExplorationAlgorithm;
