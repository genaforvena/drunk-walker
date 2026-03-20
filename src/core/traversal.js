/**
 * Traversal algorithms for Drunk Walker
 * This is where decision-making logic lives
 * 
 * UNIFIED ALGORITHM (v5.0.0):
 * Combines direction preference with heatmap avoidance
 * - Prefers unvisited locations (heatmap)
 * - Prefers directions aligned with preferred yaw
 * - Adjusts preferred yaw when blocked or user drags
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
 * Calculate yaw difference between two angles (0-180°)
 */
function yawDifference(yaw1, yaw2) {
  let diff = Math.abs(normalizeAngle(yaw1) - normalizeAngle(yaw2));
  if (diff > 180) diff = 360 - diff;
  return diff;
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
 * UNIFIED ALGORITHM (v5.0.0)
 * Combines direction preference with heatmap avoidance and crossroad prioritization
 * 
 * Scoring formula:
 * score = (heatmapScore * 0.5) + (directionScore * 0.3) + (crossroadScore * 0.2)
 * 
 * - Lower score = better direction to explore
 * - heatmapScore: visited count + breadcrumb penalty
 * - directionScore: yaw difference from preferred direction
 * - crossroadScore: priority from transition graph (0-3)
 */
export function createUnifiedAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  let preferredYaw = null;
  let lastSearchAngle = 0;
  let extendedStuckCount = 0;
  let lowEntropyMode = false;
  let lowEntropyCounter = 0;
  let consecutiveTurns = 0;

  const decide = (context) => {
    const { 
      stuckCount, 
      currentLocation, 
      visitedUrls, 
      breadcrumbs, 
      orientation,
      transitionGraph 
    } = context;

    // Initialize preferred yaw from current orientation on first call
    if (!preferredYaw) {
      preferredYaw = orientation;
    }

    // PRIORITY 0: Oscillation Detection (A->B->A->B pattern)
    if (cfg.expOn && stuckCount === 0 && breadcrumbs.length >= 6) {
      const recent = breadcrumbs.slice(-6);
      if (recent[0] === recent[4] && recent[1] === recent[5] && recent[0] !== recent[1]) {
        console.log("🔄 OSCILLATION DETECTED! Breaking cycle with random turn");
        consecutiveTurns = 0;
        return { turn: true, angle: Math.floor(Math.random() * 360) };
      }
    }

    // PRIORITY 1: Early Loop Detection (returning to recent breadcrumb)
    if (cfg.expOn && currentLocation && stuckCount === 0) {
      const recentBreadcrumbIndex = breadcrumbs.slice(-10).indexOf(currentLocation);
      if (recentBreadcrumbIndex !== -1 && recentBreadcrumbIndex < 8) {
        console.log(`🔄 LOOP DETECTED (back to step -${10 - recentBreadcrumbIndex})! 180° escape`);
        consecutiveTurns = 0;
        return { turn: true, angle: 180 };
      }
    }

    // PRIORITY 2: Systematic Search (Stuck Recovery)
    if (cfg.expOn && stuckCount >= panicThreshold) {
      extendedStuckCount = stuckCount;
      lowEntropyMode = false;
      lowEntropyCounter = 0;
      consecutiveTurns = 0;

      // Adaptive search: use smaller angles if stuck for too long
      let searchIncrement = 60;
      if (stuckCount >= 10) {
        searchIncrement = 30; // Fine-grained search
      }
      if (stuckCount >= 20) {
        // Random escape for extended stuck situations
        const randomAngle = Math.floor(Math.random() * 360);
        console.log(`🎲 Extended stuck (${stuckCount}), random escape: ${randomAngle}°`);
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

    // PRIORITY 3: Entropy-Based Escape (linear territory)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      const entropy = calculateEntropy(visitedUrls, currentLocation, orientation);
      
      // Lower threshold - escapes linear traps earlier
      const isLowEntropy = entropy.variance < 5 && entropy.avgVisits > 2;
      
      if (isLowEntropy) {
        consecutiveTurns++;
        
        // After 2+ ticks of low entropy, take action
        if (consecutiveTurns >= 2) {
          const randomAngle = Math.floor(Math.random() * 360);
          console.log(`🎲 LOW ENTROPY (var=${entropy.variance.toFixed(2)}), random escape: ${randomAngle}°`);
          consecutiveTurns = 0;
          return { turn: true, angle: randomAngle };
        }
      } else {
        consecutiveTurns = 0;
      }
    }

    // PRIORITY 4: Transition Graph with Crossroad + Direction Priority
    if (cfg.expOn && cfg.selfAvoiding && transitionGraph && currentLocation) {
      // Use crossroad-prioritized escape
      const escapeOption = transitionGraph.findEscapeWithPriority(currentLocation, visitedUrls);
      
      if (escapeOption) {
        const learnedEscape = escapeOption.location;
        
        // Calculate yaw to target location
        const parts = learnedEscape.split(',');
        const targetLat = parseFloat(parts[0]);
        const targetLng = parseFloat(parts[1]);
        const currentParts = currentLocation.split(',');
        const currentLat = parseFloat(currentParts[0]);
        const currentLng = parseFloat(currentParts[1]);
        
        // Calculate angle to target
        const dLat = targetLat - currentLat;
        const dLng = targetLng - currentLng;
        let targetYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (targetYaw < 0) targetYaw += 360;
        
        // Calculate yaw difference from preferred direction
        const directionDiff = yawDifference(targetYaw, preferredYaw);
        
        // Hybrid scoring: combine crossroad priority with direction alignment
        // Lower score = better option
        const crossroadScore = (3 - escapeOption.priority) / 3;  // 0-1, lower is better
        const directionScore = directionDiff / 180;  // 0-1, lower is better (aligned with preferred)
        
        // Combined score: 70% direction, 30% crossroad priority
        const combinedScore = (directionScore * 0.7) + (crossroadScore * 0.3);
        
        // Only use if score is reasonable (not too far from preferred)
        if (combinedScore < 0.7 || escapeOption.priority >= 2) {
          // Gently adjust preferred direction toward successful path
          if (directionDiff > 10 && directionDiff < 90) {
            preferredYaw = normalizeAngle(preferredYaw + (directionDiff * 0.3));
          }
          
          const turnAngle = yawDifference(orientation, targetYaw);
          if (turnAngle > 10 && turnAngle < 350) {
            if (escapeOption.priority > 0) {
              console.log(`🗺️ Crossroad priority ${escapeOption.priority} escape (dir diff: ${directionDiff.toFixed(0)}°)`);
            }
            return { turn: true, angle: turnAngle };
          }
        }
      }
    }

    // PRIORITY 5: Weighted Exploration with Direction Preference (fallback)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      lowEntropyCounter = 0;
      extendedStuckCount = 0;
      
      const scanAngles = [0, 60, -60, 120, -120, 180, -180];
      let bestScore = Infinity;
      let bestAngle = 0;

      for (const angle of scanAngles) {
        const testOrientation = normalizeAngle(orientation + angle);
        const testLocation = predictNextLocation(currentLocation, testOrientation);
        if (!testLocation) continue;

        // Heatmap score: visited count + breadcrumb penalty
        const visitCount = visitedUrls.get(testLocation) || 0;
        let breadcrumbPenalty = 0;
        breadcrumbs.forEach((bc, index) => {
          // Recent breadcrumbs get MUCH higher penalty to avoid loops
          if (bc === testLocation) breadcrumbPenalty += (100 - index * 5);
        });

        // Direction score: yaw difference from preferred
        const predictedYaw = testOrientation;
        const directionDiff = yawDifference(predictedYaw, preferredYaw);
        const directionScore = directionDiff / 180;  // 0-1

        // Combined score: 50% heatmap, 30% direction, 20% breadcrumb
        const heatmapScore = visitCount * 10;
        const forwardBias = (angle === 0) ? -0.1 : 0;
        const score = (heatmapScore * 0.5) + (directionScore * 0.3) + (breadcrumbPenalty * 0.2) + forwardBias;

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

// Default export for backward compatibility
export const createDefaultAlgorithm = createUnifiedAlgorithm;

// Backward compatibility aliases (will be removed in future)
export const createExplorationAlgorithm = createUnifiedAlgorithm;
export const createSurgicalAlgorithm = createUnifiedAlgorithm;
export const createHunterAlgorithm = createUnifiedAlgorithm;
