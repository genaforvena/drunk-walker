/**
 * Traversal Algorithms v5.3.0 - Stuck Type Detection
 * 
 * KEY INSIGHT: Different types of stuck require different escape strategies!
 * 
 * STUCK TYPES & RESPONSES:
 * 1. DEAD_END (hit street end) → Navigate to nearest node with untried yaws
 * 2. OSCILLATION (A→B→A→B×5) → Random turn (break pattern)
 * 3. LINEAR_TRAP (bouncing, low entropy) → Search perpendicular to preferred yaw
 * 4. LOOP (returning to old breadcrumb) → Navigate away from loop origin
 * 5. ALL_HOT (all directions equal) → Random escape
 * 
 * DETECTION WINDOWS:
 * - Oscillation: 20 steps (was 6)
 * - Breadcrumbs: 200 steps (was 100)
 * - Loop detection: 50 steps back (was 10)
 */

function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function yawDifference(yaw1, yaw2) {
  let diff = Math.abs(normalizeAngle(yaw1) - normalizeAngle(yaw2));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function extractYawFromUrl(url) {
  if (!url) return null;
  const match = url.match(/yaw%3D([0-9.]+)/);
  return match ? parseFloat(match[1]) : null;
}

export function extractLocationFromUrl(url) {
  if (!url) return null;
  const hashMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (hashMatch) {
    return `${hashMatch[1]},${hashMatch[2]}`;
  }
  return null;
}

function predictNextLocation(currentLocation, orientation, stepDistance = 0.0005) {
  if (!currentLocation || typeof currentLocation !== 'string') return null;
  const parts = currentLocation.split(',');
  if (parts.length < 2) return currentLocation;
  const [lat, lng] = parts.map(Number);
  const yawRad = orientation * Math.PI / 180;
  const dLat = Math.cos(yawRad) * stepDistance;
  const dLng = Math.sin(yawRad) * stepDistance / Math.cos(lat * Math.PI / 180);
  return `${(lat + dLat).toFixed(6)},${(lng + dLng).toFixed(6)}`;
}

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
 * STUCK TYPE DETECTOR
 * Analyzes the situation and returns the type of stuck + recommended action
 */
class StuckDetector {
  constructor() {
    this.oscillationWindow = 20;  // Was 6 - need to detect longer patterns!
    this.breadcrumbLength = 200;   // Was 100 - longer memory
    this.loopDetectionDepth = 50;  // Was 10 - detect older loops
  }

  /**
   * Analyze current situation and return stuck type
   */
  analyze(context) {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation } = context;

    // Not stuck yet - no analysis needed
    if (stuckCount < 3) {
      return { type: 'NOT_STUCK' };
    }

    // Check for each type of stuck (in priority order)

    // 1. OSCILLATION - A→B→A→B pattern (need 5+ cycles = 20 steps)
    const oscillation = this.detectOscillation(breadcrumbs);
    if (oscillation.detected) {
      return {
        type: 'OSCILLATION',
        confidence: oscillation.confidence,
        action: 'RANDOM_ESCAPE',
        details: `Pattern: ${oscillation.pattern}`
      };
    }

    // 2. LOOP - Returning to old breadcrumb
    const loop = this.detectLoop(breadcrumbs, currentLocation);
    if (loop.detected) {
      return {
        type: 'LOOP',
        confidence: loop.confidence,
        action: 'NAVIGATE_AWAY',
        details: `Back to step -${loop.stepsAgo}`
      };
    }

    // 3. LINEAR_TRAP - Low entropy, bouncing
    const entropy = calculateEntropy(visitedUrls, currentLocation, orientation);
    const isLinearTrap = entropy.variance < 3 && entropy.avgVisits > 5;
    if (isLinearTrap) {
      return {
        type: 'LINEAR_TRAP',
        confidence: 0.8,
        action: 'PERPENDICULAR_SEARCH',
        details: `var=${entropy.variance.toFixed(2)}, avg=${entropy.avgVisits.toFixed(1)}`
      };
    }

    // 4. ALL_HOT - All directions equally visited
    const allHot = entropy.variance < 2 && entropy.avgVisits > 10;
    if (allHot) {
      return {
        type: 'ALL_HOT',
        confidence: 0.9,
        action: 'RANDOM_ESCAPE',
        details: `All directions hot (avg=${entropy.avgVisits.toFixed(1)})`
      };
    }

    // 5. DEAD_END - Default for stuckCount >= 3
    return {
      type: 'DEAD_END',
      confidence: 0.7,
      action: 'NAVIGATE_TO_UNTRIED',
      details: `stuckCount=${stuckCount}`
    };
  }

  /**
   * Detect oscillation pattern (A→B→A→B×5)
   */
  detectOscillation(breadcrumbs) {
    if (breadcrumbs.length < this.oscillationWindow) {
      return { detected: false };
    }

    const recent = breadcrumbs.slice(-this.oscillationWindow);
    
    // Check for A→B→A→B pattern (at least 5 cycles)
    const A = recent[recent.length - 1];
    const B = recent[recent.length - 2];
    
    if (!A || !B || A === B) return { detected: false };

    let cycles = 0;
    for (let i = recent.length - 1; i >= 1; i -= 2) {
      if (recent[i] === A && recent[i-1] === B) {
        cycles++;
      } else {
        break;
      }
    }

    if (cycles >= 5) {
      return {
        detected: true,
        confidence: cycles / 10,  // 5 cycles = 0.5, 10 cycles = 1.0
        pattern: `${A.substring(0,10)}→${B.substring(0,10)}`
      };
    }

    return { detected: false };
  }

  /**
   * Detect loop (returning to old breadcrumb)
   */
  detectLoop(breadcrumbs, currentLocation) {
    if (!currentLocation || breadcrumbs.length < 10) {
      return { detected: false };
    }

    // Look for current location in breadcrumbs (skip recent 10 to avoid false positives)
    const searchStart = Math.max(0, breadcrumbs.length - this.breadcrumbLength);
    const searchEnd = breadcrumbs.length - 10;  // Skip recent 10
    
    for (let i = searchEnd; i >= searchStart; i--) {
      if (breadcrumbs[i] === currentLocation) {
        const stepsAgo = breadcrumbs.length - i;
        if (stepsAgo >= this.loopDetectionDepth) {
          return {
            detected: true,
            confidence: Math.min(1.0, stepsAgo / 100),
            stepsAgo
          };
        }
      }
    }

    return { detected: false };
  }
}

/**
 * NODE INFO CLASS
 */
class NodeInfo {
  constructor(location, lat, lng, step) {
    this.location = location;
    this.lat = lat;
    this.lng = lng;
    this.firstVisitStep = step;
    this.lastVisitStep = step;
    this.triedYaws = new Set();
    this.successfulYaws = new Set();
    this.connections = new Map();
    this.isStraight = false;
    this.isCrossroad = false;
    this.isDeadEnd = false;
    this.isFullyExplored = false;
  }
  
  recordAttempt(yaw, success, targetLocation = null) {
    this.triedYaws.add(normalizeAngle(yaw));
    this.lastVisitStep = Date.now();
    if (success && targetLocation) {
      this.successfulYaws.add(normalizeAngle(yaw));
      this.connections.set(normalizeAngle(yaw), targetLocation);
    }
    this.updateType();
  }
  
  updateType() {
    if (this.triedYaws.size < 6) return;
    this.isFullyExplored = true;
    const exitCount = this.connections.size;
    if (exitCount === 1) {
      this.isDeadEnd = true;
    } else if (exitCount === 2) {
      const yaws = Array.from(this.successfulYaws);
      if (yaws.length === 2) {
        this.isStraight = yawDifference(yaws[0], yaws[1]) > 150;
      }
    } else if (exitCount >= 3) {
      this.isCrossroad = true;
    }
  }
  
  hasUntriedYaws() { return this.triedYaws.size < 6; }
  
  getNextUntriedYaw() {
    for (const yaw of [0, 60, 120, 180, 240, 300]) {
      if (!this.triedYaws.has(yaw)) return yaw;
    }
    return null;
  }
  
  getExitCount() { return this.connections.size; }
}

/**
 * ENHANCED TRANSITION GRAPH
 */
class EnhancedTransitionGraph {
  constructor() {
    this.nodes = new Map();
    this.connections = new Map();
  }
  
  getOrCreate(location, lat, lng, step = 0) {
    if (!this.nodes.has(location)) {
      this.nodes.set(location, new NodeInfo(location, lat, lng, step));
      this.connections.set(location, new Set());
    }
    return this.nodes.get(location);
  }
  
  get(location) { return this.nodes.get(location); }
  
  recordMovement(fromLoc, toLoc, fromYaw, toYaw, step) {
    const fromNode = this.getOrCreate(fromLoc, parseFloat(fromLoc.split(',')[0]), parseFloat(fromLoc.split(',')[1]), step);
    const toNode = this.getOrCreate(toLoc, parseFloat(toLoc.split(',')[0]), parseFloat(toLoc.split(',')[1]), step);
    fromNode.recordAttempt(fromYaw, true, toLoc);
    toNode.entryYaw = toYaw;
    if (!this.connections.get(fromLoc).has(toLoc)) {
      this.connections.get(fromLoc).add(toLoc);
    }
  }
  
  recordFailedAttempt(location, yaw, step) {
    const node = this.getOrCreate(location, parseFloat(location.split(',')[0]), parseFloat(location.split(',')[1]), step);
    node.recordAttempt(yaw, false, null);
  }
  
  findNearestNodeWithUntriedYaws(currentLocation, breadcrumbs) {
    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
      const loc = breadcrumbs[i];
      const node = this.nodes.get(loc);
      if (node && node.hasUntriedYaws() && loc !== currentLocation) {
        return { node, location: loc, index: i };
      }
    }
    return null;
  }
  
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
  
  getConnections(location) { return this.connections.get(location) || new Set(); }
  isCrossroad(location) { const node = this.nodes.get(location); return node ? node.isCrossroad : false; }
  
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
        options.push({ location: connected, isCrossroad: connectedIsCrossroad, priority });
      }
    }
    if (options.length === 0) return null;
    options.sort((a, b) => b.priority - a.priority);
    return options[0];
  }
}

/**
 * UNIFIED ALGORITHM v5.3.0 - Stuck Type Detection
 * 
 * Based on stuck type, pick appropriate escape strategy:
 * - OSCILLATION → Random turn
 * - LOOP → Navigate away
 * - LINEAR_TRAP → Perpendicular search
 * - ALL_HOT → Random escape
 * - DEAD_END → Navigate to untried yaw
 */
export function createUnifiedAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 10;
  let preferredYaw = null;
  let lastSearchAngle = 0;
  let consecutiveTurns = 0;
  let navigationTarget = null;
  
  const detector = new StuckDetector();
  const enhancedGraph = new EnhancedTransitionGraph();
  
  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation } = context;

    if (!preferredYaw) preferredYaw = orientation;
    if (!currentLocation) return { turn: false };
    
    const currentParts = currentLocation.split(',').map(Number);
    const currentNode = enhancedGraph.getOrCreate(currentLocation, currentParts[0], currentParts[1]);

    // ═══════════════════════════════════════════════════════════
    // PRIORITY 0: SMART NODE EXPLORATION (At node with untried yaws)
    // ═══════════════════════════════════════════════════════════
    if (currentNode.hasUntriedYaws()) {
      const nextYaw = currentNode.getNextUntriedYaw();
      if (nextYaw !== null) {
        const turnAngle = yawDifference(orientation, nextYaw);
        if (turnAngle > 5 && turnAngle < 355) {
          console.log(`🔍 Smart Node: trying yaw ${nextYaw}° (${currentNode.triedYaws.size}/6)`);
          navigationTarget = null;
          return { turn: true, angle: turnAngle };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITY 0b: NAVIGATION MODE (Going to node with untried yaws)
    // ═══════════════════════════════════════════════════════════
    if (navigationTarget) {
      if (currentLocation === navigationTarget.location) {
        const turnAngle = yawDifference(orientation, navigationTarget.targetYaw);
        if (turnAngle > 5 && turnAngle < 355) {
          console.log(`🎯 Reached target! Turning to ${navigationTarget.targetYaw}°`);
          navigationTarget = null;
          return { turn: true, angle: turnAngle };
        }
        navigationTarget = null;
        return { turn: false };
      }
      
      const targetParts = navigationTarget.location.split(',').map(Number);
      const dLat = targetParts[0] - currentParts[0];
      const dLng = targetParts[1] - currentParts[1];
      let yawToTarget = Math.atan2(dLng, dLat) * 180 / Math.PI;
      if (yawToTarget < 0) yawToTarget += 360;
      
      const turnAngle = yawDifference(orientation, yawToTarget);
      if (turnAngle < 30) {
        console.log(`🧭 Navigating to ${navigationTarget.location.substring(0, 15)}...`);
        return { turn: false };
      } else {
        return { turn: true, angle: turnAngle };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STUCK TYPE DETECTION & RESPONSE
    // ═══════════════════════════════════════════════════════════
    if (stuckCount >= 3) {
      const stuckAnalysis = detector.analyze(context);
      console.log(`🔍 Stuck Type: ${stuckAnalysis.type} (${stuckAnalysis.details})`);

      switch (stuckAnalysis.action) {
        // OSCILLATION → Random escape
        case 'RANDOM_ESCAPE':
          consecutiveTurns = 0;
          return { turn: true, angle: Math.floor(Math.random() * 360) };

        // LOOP → Navigate away from loop origin
        case 'NAVIGATE_AWAY':
          // Turn 180° to escape loop
          consecutiveTurns = 0;
          return { turn: true, angle: 180 };

        // LINEAR_TRAP → Search perpendicular to preferred yaw
        case 'PERPENDICULAR_SEARCH':
          const perpYaw = normalizeAngle(preferredYaw + 90);
          const turnToPerp = yawDifference(orientation, perpYaw);
          preferredYaw = perpYaw;  // Update preferred direction
          return { turn: true, angle: turnToPerp };

        // DEAD_END → Navigate to nearest node with untried yaws
        case 'NAVIGATE_TO_UNTRIED':
          const targetInfo = enhancedGraph.findNearestNodeWithUntriedYaws(currentLocation, breadcrumbs);
          if (targetInfo && targetInfo.node.hasUntriedYaws()) {
            const targetYaw = targetInfo.node.getNextUntriedYaw();
            if (targetYaw !== null) {
              navigationTarget = { location: targetInfo.location, targetYaw };
              console.log(`🧭 Navigating to untried yaw at ${targetInfo.location.substring(0, 15)}...`);
              // Will be handled by navigation mode on next tick
              return { turn: false };
            }
          }
          // Fallback to systematic search if no untried nodes
          break;
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITY 1: TRANSITION GRAPH + DIRECTION
    // ═══════════════════════════════════════════════════════════
    const escapeOption = enhancedGraph.findEscapeWithPriority(currentLocation, visitedUrls);
    if (escapeOption) {
      const parts = escapeOption.location.split(',');
      const dLat = parseFloat(parts[0]) - currentParts[0];
      const dLng = parseFloat(parts[1]) - currentParts[1];
      let targetYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
      if (targetYaw < 0) targetYaw += 360;
      
      const directionDiff = yawDifference(targetYaw, preferredYaw);
      if (directionDiff > 10 && directionDiff < 90) {
        preferredYaw = normalizeAngle(preferredYaw + (directionDiff * 0.3));
      }
      
      const turnAngle = yawDifference(orientation, targetYaw);
      if (turnAngle > 10 && turnAngle < 350) {
        return { turn: true, angle: turnAngle };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITY 2: SYSTEMATIC SEARCH (LAST RESORT, stuck >= 10)
    // ═══════════════════════════════════════════════════════════
    if (stuckCount >= panicThreshold) {
      let searchIncrement = 60;
      if (stuckCount >= 15) searchIncrement = 30;
      if (stuckCount >= 25) {
        return { turn: true, angle: Math.floor(Math.random() * 360) };
      }
      if (stuckCount === panicThreshold) {
        lastSearchAngle = searchIncrement;
      } else {
        lastSearchAngle = (lastSearchAngle + searchIncrement) % 360;
        if (lastSearchAngle === 0) lastSearchAngle = searchIncrement;
      }
      return { turn: true, angle: lastSearchAngle };
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITY 3: WEIGHTED EXPLORATION (Fallback)
    // ═══════════════════════════════════════════════════════════
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
      const directionScore = yawDifference(testOrientation, preferredYaw) / 180;
      const score = (visitCount * 10 * 0.5) + (directionScore * 0.3) + (breadcrumbPenalty * 0.2) + (angle === 0 ? -0.1 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    if (bestAngle !== 0) {
      return { turn: true, angle: Math.abs(bestAngle) };
    }

    return { turn: false };
  };

  return { 
    decide,
    enhancedGraph,
    activateNavigationToUntriedYaw: (location, targetYaw) => {
      navigationTarget = { location, targetYaw };
      console.log(`🧭 Activating navigation to ${location.substring(0, 15)}... (yaw: ${targetYaw}°)`);
    },
    clearNavigationTarget: () => { navigationTarget = null; },
    findNearestNodeWithUntriedYaws: (currentLocation, breadcrumbs) => {
      return enhancedGraph.findNearestNodeWithUntriedYaws(currentLocation, breadcrumbs);
    }
  };
}

export const createDefaultAlgorithm = createUnifiedAlgorithm;
export const createExplorationAlgorithm = createUnifiedAlgorithm;
export const createSurgicalAlgorithm = createUnifiedAlgorithm;
export const createHunterAlgorithm = createUnifiedAlgorithm;
