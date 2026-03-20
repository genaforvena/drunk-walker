/**
 * Traversal Algorithms v5.1.0 - Smart Node Exploration
 * 
 * KEY INSIGHT: We can only know a node is "straight" AFTER trying all 6 directions.
 * Until then, every node is a potential crossroad (T-junction, 4-way, etc.)
 * 
 * EXPLORATION STRATEGY:
 * 1. Forward pass: Record every node's entry/exit yaws
 * 2. At dead end: Scan ALL 6 directions to confirm
 * 3. Navigate back: Skip "straight" nodes, stop at nodes with untried yaws
 * 4. At each stop: Try ALL 6 directions (don't stop at 2 exits - could be T-shaped!)
 * 
 * NODE CLASSIFICATION (only after trying all 6 yaws):
 * - STRAIGHT: 2 exits, ~180° apart (continue walking)
 * - CROSSROAD: 3+ exits (exploration opportunity)
 * - DEAD_END: 1 exit (mark and escape)
 * - UNKNOWN: <6 yaws tried (potential crossroad - STOP HERE!)
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
 */
export function extractYawFromUrl(url) {
  if (!url) return null;
  const match = url.match(/yaw%3D([0-9.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract location from Google Street View URL
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

  const dLat = Math.cos(yawRad) * stepDistance;
  const dLng = Math.sin(yawRad) * stepDistance / Math.cos(lat * Math.PI / 180);

  const nextLat = (lat + dLat).toFixed(6);
  const nextLng = (lng + dLng).toFixed(6);

  return `${nextLat},${nextLng}`;
}

/**
 * Calculate entropy of visited locations in scan directions
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
 * NODE INFO CLASS
 * Stores metadata about each visited location
 * 
 * CRITICAL: Node type is ONLY determined after trying all 6 directions!
 * - Before 6 tries: Node is "UNKNOWN" (treat as potential crossroad)
 * - After 6 tries: Classify as STRAIGHT, CROSSROAD, or DEAD_END
 */
class NodeInfo {
  constructor(location, lat, lng, step) {
    this.location = location;
    this.lat = lat;
    this.lng = lng;
    this.firstVisitStep = step;
    this.lastVisitStep = step;
    
    // Yaw tracking
    this.triedYaws = new Set();      // All yaws we've attempted
    this.successfulYaws = new Set(); // Yaws that resulted in movement
    this.connections = new Map();    // yaw → targetLocation
    
    // Node classification (ONLY valid after trying all 6 yaws)
    this.isStraight = false;
    this.isCrossroad = false;
    this.isDeadEnd = false;
    this.isFullyExplored = false;
  }
  
  /**
   * Record a yaw attempt
   * @param {number} yaw - The yaw we tried
   * @param {boolean} success - Did we move?
   * @param {string|null} targetLocation - Where did we go?
   */
  recordAttempt(yaw, success, targetLocation = null) {
    this.triedYaws.add(normalizeAngle(yaw));
    this.lastVisitStep = Date.now();
    
    if (success && targetLocation) {
      this.successfulYaws.add(normalizeAngle(yaw));
      this.connections.set(normalizeAngle(yaw), targetLocation);
    }
    
    this.updateType();
  }
  
  /**
   * Update node classification based on tried yaws
   * ONLY classifies after all 6 directions have been tried
   */
  updateType() {
    // Can't classify until we've tried all 6 directions
    if (this.triedYaws.size < 6) {
      return;
    }
    
    this.isFullyExplored = true;
    const exitCount = this.connections.size;
    
    if (exitCount === 1) {
      this.isDeadEnd = true;
    } else if (exitCount === 2) {
      // Check if exits are ~180° apart (straight path)
      const yaws = Array.from(this.successfulYaws);
      if (yaws.length === 2) {
        const diff = yawDifference(yaws[0], yaws[1]);
        this.isStraight = diff > 150;  // ~180° ± 30° tolerance
      }
    } else if (exitCount >= 3) {
      this.isCrossroad = true;
    }
  }
  
  /**
   * Check if this node has untried directions
   * @returns {boolean} True if we should STOP here and scan
   */
  hasUntriedYaws() {
    return this.triedYaws.size < 6;
  }
  
  /**
   * Get next untried yaw
   * @returns {number|null} Next yaw to try, or null if all tried
   */
  getNextUntriedYaw() {
    const allYaws = [0, 60, 120, 180, 240, 300];
    for (const yaw of allYaws) {
      if (!this.triedYaws.has(yaw)) {
        return yaw;
      }
    }
    return null;
  }
  
  /**
   * Get all connected locations
   */
  getConnections() {
    return Array.from(this.connections.values());
  }
  
  /**
   * Get exit count (how many directions worked)
   */
  getExitCount() {
    return this.connections.size;
  }
}

/**
 * ENHANCED TRANSITION GRAPH
 * Augments the basic connection graph with node metadata
 */
class EnhancedTransitionGraph {
  constructor() {
    this.nodes = new Map();  // location → NodeInfo
    this.connections = new Map();  // location → Set<location> (backward compat)
  }
  
  /**
   * Get or create node info
   */
  getOrCreate(location, lat, lng, step = 0) {
    if (!this.nodes.has(location)) {
      this.nodes.set(location, new NodeInfo(location, lat, lng, step));
      this.connections.set(location, new Set());
    }
    return this.nodes.get(location);
  }
  
  /**
   * Get node info
   */
  get(location) {
    return this.nodes.get(location);
  }
  
  /**
   * Record movement from one location to another
   */
  recordMovement(fromLoc, toLoc, fromYaw, toYaw, step) {
    const fromNode = this.getOrCreate(fromLoc, 
      parseFloat(fromLoc.split(',')[0]), 
      parseFloat(fromLoc.split(',')[1]), 
      step
    );
    const toNode = this.getOrCreate(toLoc,
      parseFloat(toLoc.split(',')[0]),
      parseFloat(toLoc.split(',')[1]),
      step
    );
    
    // Record successful exit from fromNode
    fromNode.recordAttempt(fromYaw, true, toLoc);
    
    // Record entry to toNode
    toNode.entryYaw = toYaw;
    
    // Update backward compatibility connections
    if (!this.connections.get(fromLoc).has(toLoc)) {
      this.connections.get(fromLoc).add(toLoc);
    }
  }
  
  /**
   * Record failed movement attempt
   */
  recordFailedAttempt(location, yaw, step) {
    const node = this.getOrCreate(location,
      parseFloat(location.split(',')[0]),
      parseFloat(location.split(',')[1]),
      step
    );
    node.recordAttempt(yaw, false, null);
  }
  
  /**
   * Find nearest node with untried yaws (potential crossroad)
   * @param {string} currentLocation - Starting point
   * @param {Array<string>} pathBack - Path back to start
   * @returns {NodeInfo|null} Nearest unexplored node
   */
  findNearestUnexploredNode(currentLocation, pathBack) {
    for (const loc of pathBack) {
      const node = this.nodes.get(loc);
      if (node && !node.isFullyExplored && node.hasUntriedYaws()) {
        return node;
      }
    }
    return null;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const nodes = Array.from(this.nodes.values());
    return {
      totalNodes: nodes.length,
      fullyExplored: nodes.filter(n => n.isFullyExplored).length,
      straight: nodes.filter(n => n.isStraight).length,
      crossroads: nodes.filter(n => n.isCrossroad).length,
      deadEnds: nodes.filter(n => n.isDeadEnd).length,
      unknown: nodes.filter(n => !n.isFullyExplored).length
    };
  }
  
  /**
   * Backward compatibility - get connections for location
   */
  getConnections(location) {
    return this.connections.get(location) || new Set();
  }
  
  /**
   * Check if location is a crossroad
   */
  isCrossroad(location) {
    const node = this.nodes.get(location);
    return node ? node.isCrossroad : false;
  }
  
  /**
   * Find escape with priority (backward compatibility)
   */
  findEscapeWithPriority(currentLocation, visitedUrls) {
    const connections = this.getConnections(currentLocation);
    if (!connections || connections.size === 0) return null;
    
    const options = [];
    
    for (const connected of connections) {
      if (!visitedUrls.has(connected)) {
        const connectedNode = this.nodes.get(connected);
        const currentNode = this.nodes.get(currentLocation);
        const connectedIsCrossroad = connectedNode ? connectedNode.isCrossroad : false;
        const currentIsCrossroad = currentNode ? currentNode.isCrossroad : false;
        
        let priority = 0;
        if (currentIsCrossroad && connectedIsCrossroad) priority = 3;
        else if (connectedIsCrossroad) priority = 2;
        else if (currentIsCrossroad) priority = 1;
        
        options.push({
          location: connected,
          isCrossroad: connectedIsCrossroad,
          priority,
          yaw: currentNode ? currentNode.connections.get(connected) : null
        });
      }
    }
    
    if (options.length === 0) return null;
    
    options.sort((a, b) => b.priority - a.priority);
    return options[0];
  }
}

/**
 * UNIFIED ALGORITHM v5.1.0 - Smart Node Exploration
 * 
 * Combines direction preference with smart node exploration:
 * - Tries ALL 6 directions at each node (don't stop at 2!)
 * - Classifies nodes only after full exploration
 * - Skips "straight" nodes when navigating back
 * - Stops at nodes with untried yaws (potential crossroads)
 */
export function createUnifiedAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  let preferredYaw = null;
  let lastSearchAngle = 0;
  let extendedStuckCount = 0;
  let consecutiveTurns = 0;
  
  // Enhanced graph with node metadata
  const enhancedGraph = new EnhancedTransitionGraph();
  
  const decide = (context) => {
    const { 
      stuckCount, 
      currentLocation, 
      visitedUrls, 
      breadcrumbs, 
      orientation,
      transitionGraph 
    } = context;

    // Initialize preferred yaw from current orientation
    if (!preferredYaw) {
      preferredYaw = orientation;
    }

    // Get or create current node info
    if (!currentLocation) {
      return { turn: false };
    }
    
    const currentParts = currentLocation.split(',').map(Number);
    const currentNode = enhancedGraph.getOrCreate(
      currentLocation, 
      currentParts[0], 
      currentParts[1]
    );

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
    // This triggers when we've been stuck for multiple ticks
    if (stuckCount >= panicThreshold) {
      extendedStuckCount = stuckCount;
      consecutiveTurns = 0;

      let searchIncrement = 60;
      if (stuckCount >= 10) {
        searchIncrement = 30;  // Fine-grained search
      }
      if (stuckCount >= 20) {
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
      const isLowEntropy = entropy.variance < 5 && entropy.avgVisits > 2;
      
      if (isLowEntropy) {
        consecutiveTurns++;
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

    // PRIORITY 4: Smart Node Exploration
    // If current node has untried yaws, try them ALL (don't stop at 2!)
    if (cfg.expOn && cfg.selfAvoiding && currentNode.hasUntriedYaws()) {
      const nextYaw = currentNode.getNextUntriedYaw();
      if (nextYaw !== null) {
        const turnAngle = yawDifference(orientation, nextYaw);
        if (turnAngle > 5 && turnAngle < 355) {
          console.log(`🔍 Scanning node: trying yaw ${nextYaw}° (${currentNode.triedYaws.size}/6)`);
          return { turn: true, angle: turnAngle };
        }
      }
    }

    // PRIORITY 5: Transition Graph with Crossroad + Direction Priority
    if (cfg.expOn && cfg.selfAvoiding && currentLocation) {
      const escapeOption = enhancedGraph.findEscapeWithPriority(currentLocation, visitedUrls);
      
      if (escapeOption) {
        const learnedEscape = escapeOption.location;
        const parts = learnedEscape.split(',');
        const targetLat = parseFloat(parts[0]);
        const targetLng = parseFloat(parts[1]);
        const currentLat = parseFloat(currentParts[0]);
        const currentLng = parseFloat(currentParts[1]);
        
        const dLat = targetLat - currentLat;
        const dLng = targetLng - currentLng;
        let targetYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (targetYaw < 0) targetYaw += 360;
        
        const directionDiff = yawDifference(targetYaw, preferredYaw);
        const crossroadScore = (3 - escapeOption.priority) / 3;
        const directionScore = directionDiff / 180;
        const combinedScore = (directionScore * 0.7) + (crossroadScore * 0.3);
        
        if (combinedScore < 0.7 || escapeOption.priority >= 2) {
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

    // PRIORITY 6: Weighted Exploration with Direction Preference (fallback)
    if (cfg.expOn && cfg.selfAvoiding && currentLocation && stuckCount === 0) {
      consecutiveTurns = 0;
      
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
          if (bc === testLocation) breadcrumbPenalty += (100 - index * 5);
        });

        const predictedYaw = testOrientation;
        const directionDiff = yawDifference(predictedYaw, preferredYaw);
        const directionScore = directionDiff / 180;

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

  return { 
    decide,
    enhancedGraph  // Expose for recording movements
  };
}

// Default export for backward compatibility
export const createDefaultAlgorithm = createUnifiedAlgorithm;

// Backward compatibility aliases
export const createExplorationAlgorithm = createUnifiedAlgorithm;
export const createSurgicalAlgorithm = createUnifiedAlgorithm;
export const createHunterAlgorithm = createUnifiedAlgorithm;
