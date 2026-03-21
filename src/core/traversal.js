/**
 * Traversal Algorithms v5.4.0 - Two Mode System
 * 
 * MODE 1: FORWARD (Exploring)
 * - Go straight, no turns
 * - Until stuck >= 3 (blocked)
 * 
 * MODE 2: RETURN (Retracing)
 * - Detect: current location is in breadcrumbs (we've been here)
 * - Find: nearest node with untried yaws (crossroad candidate)
 * - Navigate: shortest path there, skip straight nodes
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

/**
 * Calculate angle to turn LEFT to reach targetYaw from currentYaw
 */
function getLeftTurnAngle(currentYaw, targetYaw) {
  let angle = (normalizeAngle(currentYaw) - normalizeAngle(targetYaw) + 360) % 360;
  return angle;
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

class NodeInfo {
  constructor(location, lat, lng, step) {
    this.location = location;
    this.lat = lat;
    this.lng = lng;
    this.triedYaws = new Set();
    this.successfulYaws = new Set();
    this.connections = new Map();
    this.isStraight = false;
    this.isCrossroad = false;
    this.isDeadEnd = false;
    this.isFullyExplored = false;
  }
  
  recordAttempt(yaw, success, targetLocation = null) {
    const bucket = Math.round(normalizeAngle(yaw) / 60) * 60 % 360;
    this.triedYaws.add(bucket);
    if (success && targetLocation) {
      this.successfulYaws.add(bucket);
      this.connections.set(bucket, targetLocation);
    }
    this.updateType();
  }
  
  updateType() {
    const exitCount = this.connections.size;
    
    // Node classification
    if (this.triedYaws.size >= 6) {
      this.isFullyExplored = true;
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
  }
  
  hasUntriedYaws() { return this.triedYaws.size < 6; }
  
  getNextUntriedYaw() {
    for (const yaw of [0, 60, 120, 180, 240, 300]) {
      if (!this.triedYaws.has(yaw)) return yaw;
    }
    return null;
  }
}

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
    const parts = location.split(',');
    const node = this.getOrCreate(location, parseFloat(parts[0]), parseFloat(parts[1]), step);
    node.recordAttempt(yaw, false, null);
  }
  
  /**
   * Find nearest node with untried yaws by walking back through breadcrumbs
   */
  findNearestCrossroadCandidate(currentLocation, breadcrumbs) {
    // Walk backwards through breadcrumbs to find first node with untried yaws
    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
      const loc = breadcrumbs[i];
      if (loc === currentLocation) continue;
      const node = this.nodes.get(loc);
      if (node && node.hasUntriedYaws()) {
        return { node, location: loc, distance: breadcrumbs.length - i };
      }
    }
    return null;
  }
  
  /**
   * Get path from current location to target through breadcrumbs
   */
  getPathToTarget(currentLocation, targetLocation, breadcrumbs) {
    const currentIndex = breadcrumbs.lastIndexOf(currentLocation);
    const targetIndex = breadcrumbs.lastIndexOf(targetLocation);
    
    if (currentIndex === -1 || targetIndex === -1) return [];
    
    // Return path from current to target (walking backwards)
    return breadcrumbs.slice(targetIndex, currentIndex + 1).reverse();
  }
}

/**
 * UNIFIED ALGORITHM v5.4.0 - Two Mode System
 */
export function createUnifiedAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;
  let preferredYaw = null;
  let lastSearchAngle = 0;
  let navigationTarget = null;  // {location, targetYaw, path}
  let isReturning = false;

  const enhancedGraph = new EnhancedTransitionGraph();

  const decide = (context) => {
    const { stuckCount, currentLocation, visitedUrls, breadcrumbs, orientation, isNewNode, isFullyScanned } = context;

    console.log(`[DEBUG] decide() called: stuck=${stuckCount}, orientation=${Math.round(orientation)}°, loc=${currentLocation}`);
    console.log(`[DEBUG] breadcrumbs.length=${breadcrumbs.length}, graph.nodes=${enhancedGraph.nodes.size}`);
    console.log(`[DEBUG] isNewNode=${isNewNode}, isFullyScanned=${isFullyScanned}`);

    if (!preferredYaw) preferredYaw = orientation;
    if (!currentLocation) {
      console.log('[DEBUG] No location, returning no turn');
      return { turn: false };
    }

    const currentParts = currentLocation.split(',').map(Number);
    const currentNode = enhancedGraph.getOrCreate(currentLocation, currentParts[0], currentParts[1]);

    console.log(`[DEBUG] currentNode.triedYaws=${[...currentNode.triedYaws].join(',')}, hasUntried=${currentNode.hasUntriedYaws()}`);

    // ═══════════════════════════════════════════════════════════
    // 🚫 NEW NODE: Never turn at new/unsampled nodes - go straight!
    // ═══════════════════════════════════════════════════════════
    if (isNewNode) {
      console.log('[DEBUG] NEW NODE - going straight (no turn)');
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // MODE DETECTION: Are we returning (retracing) or exploring?
    // ═══════════════════════════════════════════════════════════
    // Be careful with breadcrumbs containing same location multiple times due to being stuck
    const lastDifferentIndex = breadcrumbs.findLastIndex(loc => loc !== currentLocation);
    const hasBeenHereBefore = lastDifferentIndex !== -1 && breadcrumbs.slice(0, lastDifferentIndex + 1).includes(currentLocation);
    const isExhausted = !currentNode.hasUntriedYaws();

    console.log(`[DEBUG] hasBeenHereBefore=${hasBeenHereBefore}, isExhausted=${isExhausted}, navigationTarget=${navigationTarget ? 'set' : 'null'}`);

    if ((hasBeenHereBefore || isExhausted) && !navigationTarget) {
      // We're retracing! Find nearest crossroad candidate
      isReturning = true;
      const candidate = enhancedGraph.findNearestCrossroadCandidate(currentLocation, breadcrumbs);

      if (candidate) {
        const targetYaw = candidate.node.getNextUntriedYaw();
        if (targetYaw !== null) {
          navigationTarget = {
            location: candidate.location,
            targetYaw,
            distance: candidate.distance
          };
          console.log(`🔙 RETURN MODE: Navigating to crossroad candidate (${candidate.distance} steps away)`);
        }
      }
    } else if (!hasBeenHereBefore && !isExhausted) {
      isReturning = false;
    }

    // ═══════════════════════════════════════════════════════════
    // NAVIGATION MODE: Actively going to crossroad candidate
    // ═══════════════════════════════════════════════════════════
    if (navigationTarget) {
      if (currentLocation === navigationTarget.location) {
        // Reached target! Turn to face the untried yaw
        const diff = yawDifference(orientation, navigationTarget.targetYaw);
        if (diff > 5 && diff < 355) {
          console.log(`🎯 Reached crossroad! Turning to ${navigationTarget.targetYaw}°`);
          const turnAngle = getLeftTurnAngle(orientation, navigationTarget.targetYaw);
          navigationTarget = null;
          return { turn: true, angle: turnAngle };
        }
        navigationTarget = null;
        // Will be caught by smart node exploration on next tick
        return { turn: false };
      }

      // Navigate toward target (calculate yaw to target location)
      const targetParts = navigationTarget.location.split(',').map(Number);
      const dLat = targetParts[0] - currentParts[0];
      const dLng = targetParts[1] - currentParts[1];
      let yawToTarget = Math.atan2(dLng, dLat) * 180 / Math.PI;
      if (yawToTarget < 0) yawToTarget += 360;

      const diff = yawDifference(orientation, yawToTarget);
      
      // If stuck while navigating, fall through to PANIC mode
      if (stuckCount >= panicThreshold) {
        console.log(`[DEBUG] Stuck while navigating (stuck=${stuckCount}), falling through to PANIC`);
        // Clear navigation target so PANIC can work
        // navigationTarget stays set but we'll handle the stuck
      } else if (diff < 30) {
        return { turn: false };  // Move forward toward target
      } else {
        const turnAngle = getLeftTurnAngle(orientation, yawToTarget);
        return { turn: true, angle: turnAngle };  // Turn toward target
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🚨 PANIC MODE: If stuck for 3+ heartbeats, MUST turn
    // ═══════════════════════════════════════════════════════════
    console.log(`[DEBUG] Checking PANIC: stuckCount=${stuckCount} >= panicThreshold=${panicThreshold}? ${stuckCount >= panicThreshold}`);
    if (stuckCount >= panicThreshold) {
      // First, try any untried yaw
      const nextYaw = currentNode.getNextUntriedYaw();
      console.log(`[DEBUG] PANIC MODE: nextYaw=${nextYaw}, successfulYaws=${[...currentNode.successfulYaws].join(',')}`);

      if (nextYaw !== null) {
        const turnAngle = getLeftTurnAngle(orientation, nextYaw);
        console.log(`🚨 PANIC! Stuck ${stuckCount}x. Trying untried yaw ${nextYaw}° (angle=${Math.round(turnAngle)}°)`);
        return { turn: true, angle: turnAngle };
      } else if (currentNode.successfulYaws.size > 0) {
        // All buckets tried but still stuck - retry a successful exit
        // Pick random successful yaw (one of them must work - we came from somewhere!)
        const successfulYawsArray = Array.from(currentNode.successfulYaws);
        const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
        const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
        console.log(`🚨 PANIC! All buckets tried. Retrying successful yaw ${randomSuccessfulYaw}° (angle=${Math.round(turnAngle)}°)`);
        return { turn: true, angle: turnAngle };
      } else {
        // TRULY STUCK - No successful exits recorded (dead end or entry/exit bucket mismatch)
        // Log the spinning location for debugging
        console.log(`🚨 SPIN DETECTED! At ${currentLocation} - all ${currentNode.triedYaws.size} buckets tried, no successful exits!`);
        console.log(`   Tried yaw buckets: ${[...currentNode.triedYaws].join(', ')}`);
        console.log(`   This is likely a dead-end or the entry yaw bucket differs from exit bucket`);
        
        // Do a full 360° scan by turning to each cardinal direction
        const randomTurn = Math.floor(Math.random() * 360);
        const turnAngle = randomTurn;
        console.log(`🚨 PANIC! Full scan mode - random turn ${turnAngle}°`);
        return { turn: true, angle: turnAngle };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: At node with untried yaws - try them
    // ═══════════════════════════════════════════════════════════
    if (currentNode.hasUntriedYaws()) {
      const nextYaw = currentNode.getNextUntriedYaw();
      console.log(`[DEBUG] FORWARD MODE: nextYaw=${nextYaw}, orientation=${Math.round(orientation)}°`);
      if (nextYaw !== null) {
        const diff = yawDifference(orientation, nextYaw);
        console.log(`[DEBUG] yaw diff=${diff}°`);
        if (diff > 5 && diff < 355) {
          console.log(`🔍 Node ${currentLocation.split(',')[0]}...: Trying yaw ${nextYaw}° (${currentNode.triedYaws.size}/6)`);
          const turnAngle = getLeftTurnAngle(orientation, nextYaw);
          return { turn: true, angle: turnAngle };
        } else {
          // Already pointing close enough, just move forward
          console.log('[DEBUG] Already facing target yaw, moving forward');
          return { turn: false };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FALLBACK: All buckets tried but not stuck - retry successful exit
    // ═══════════════════════════════════════════════════════════
    if (currentNode.successfulYaws.size > 0) {
      const successfulYawsArray = Array.from(currentNode.successfulYaws);
      const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
      const diff = yawDifference(orientation, randomSuccessfulYaw);
      console.log(`[DEBUG] FALLBACK: Retrying successful yaw ${randomSuccessfulYaw}°, diff=${diff}°`);
      if (diff > 5 && diff < 355) {
        const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
        return { turn: true, angle: turnAngle };
      }
      // Already facing it, move forward
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: Go straight (no turn)
    // ═══════════════════════════════════════════════════════════
    console.log('[DEBUG] FORWARD MODE: Going straight (no turn)');
    return { turn: false };
  };

  return { 
    decide,
    enhancedGraph,
    isReturning: () => isReturning,
    getNavigationTarget: () => navigationTarget
  };
}

export const createDefaultAlgorithm = createUnifiedAlgorithm;
export const createExplorationAlgorithm = createUnifiedAlgorithm;
export const createSurgicalAlgorithm = createUnifiedAlgorithm;
export const createHunterAlgorithm = createUnifiedAlgorithm;
