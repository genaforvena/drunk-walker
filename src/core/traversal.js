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

/**
 * Calculate yaw from recent path history using linear regression
 * Returns the direction of travel based on last N steps
 */
function calculateYawFromPath(breadcrumbs, currentLocation, minSteps = 3) {
  if (!breadcrumbs || breadcrumbs.length < minSteps || !currentLocation) {
    return null;
  }
  
  // Get last N unique locations from breadcrumbs
  const uniqueLocations = [];
  const seen = new Set();
  for (let i = breadcrumbs.length - 1; i >= 0 && uniqueLocations.length < 5; i--) {
    const loc = breadcrumbs[i];
    if (!seen.has(loc)) {
      seen.add(loc);
      uniqueLocations.push(loc);
    }
  }
  
  if (uniqueLocations.length < minSteps) {
    return null;
  }
  
  // Reverse to get chronological order (oldest first)
  uniqueLocations.reverse();
  
  // Calculate total displacement from first to last
  const first = uniqueLocations[0].split(',').map(Number);
  const last = uniqueLocations[uniqueLocations.length - 1].split(',').map(Number);
  
  const dLat = last[0] - first[0];
  const dLng = last[1] - first[1];
  
  // Calculate yaw from displacement
  let yaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
  if (yaw < 0) yaw += 360;
  
  return Math.round(yaw);
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
    
    // Record forward direction at fromNode
    fromNode.recordAttempt(fromYaw, true, toLoc);
    
    // Record reverse direction at toNode (we can always go back the way we came)
    const reverseYaw = (toYaw + 180) % 360;
    toNode.recordAttempt(reverseYaw, true, fromLoc);
    
    toNode.entryYaw = toYaw;
    
    // Bidirectional connection tracking
    if (!this.connections.get(fromLoc).has(toLoc)) {
      this.connections.get(fromLoc).add(toLoc);
    }
    if (!this.connections.get(toLoc).has(fromLoc)) {
      this.connections.get(toLoc).add(fromLoc);
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
  
  // Knowledge tracking for intelligent exploration
  let turnedAtNodes = new Set();  // Nodes where we made exploration turn during CURRENT backtrack session
  let fullyExploredNodes = new Set();  // Nodes where ALL 6 buckets have been tried (never re-explore)
  let backtrackCount = 0;  // Count how many times we've backtracked
  let lastBacktrackLocation = null;  // Track where we last started backtracking from
  
  // Yaw correction tracking
  let yawCorrectedNodes = new Set();  // Nodes where we already corrected yaw (one correction per node)

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

    // Mark node as fully explored if all 6 buckets tried
    if (currentNode.triedYaws.size >= 6) {
      fullyExploredNodes.add(currentLocation);
    }

    // ═══════════════════════════════════════════════════════════
    // 🧭 YAW CORRECTION: Auto-correct drift using path history
    // ═══════════════════════════════════════════════════════════
    // Only one correction per node, especially useful for new nodes
    const pathYaw = calculateYawFromPath(breadcrumbs, currentLocation, 3);
    const hasCorrectedHere = yawCorrectedNodes.has(currentLocation);
    
    if (pathYaw !== null && !hasCorrectedHere && !isNewNode) {
      const orientationDiff = yawDifference(orientation, pathYaw);
      
      // Only correct if drift is significant (>15°)
      if (orientationDiff > 15 && orientationDiff < 165) {
        yawCorrectedNodes.add(currentLocation);
        console.log(`🧭 YAW CORRECTION: ${Math.round(orientation)}° → ${pathYaw}° (diff=${Math.round(orientationDiff)}°) at ${currentLocation}`);
        
        // Return turn to correct yaw
        const turnAngle = getLeftTurnAngle(orientation, pathYaw);
        return { turn: true, angle: turnAngle };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🚫 NEW NODE: Never turn at new/unsampled nodes - go straight!
    // ═══════════════════════════════════════════════════════════
    if (isNewNode) {
      console.log('[DEBUG] NEW NODE - going straight (no turn)');
      // Remove from fully explored if it was there (fresh visit)
      fullyExploredNodes.delete(currentLocation);
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // MODE DETECTION: Are we returning (retracing) or exploring?
    // ═══════════════════════════════════════════════════════════
    const lastDifferentIndex = breadcrumbs.findLastIndex(loc => loc !== currentLocation);
    const hasBeenHereBefore = lastDifferentIndex !== -1 && breadcrumbs.slice(0, lastDifferentIndex + 1).includes(currentLocation);
    const isExhausted = !currentNode.hasUntriedYaws();

    console.log(`[DEBUG] hasBeenHereBefore=${hasBeenHereBefore}, isExhausted=${isExhausted}, fullyExplored=${fullyExploredNodes.has(currentLocation)}`);

    // Detect start of backtrack (hit dead end, now returning)
    const isBacktracking = (hasBeenHereBefore || isExhausted) && !navigationTarget;
    
    if (isBacktracking) {
      isReturning = true;
      
      // Loop detection: if we're backtracking from same location repeatedly, STOP
      if (lastBacktrackLocation === currentLocation) {
        backtrackCount++;
        if (backtrackCount >= 3) {
          console.log(`🛑 LOOP DETECTED! Backtracked from ${currentLocation} ${backtrackCount} times. Stopping to prevent infinite loop.`);
          return { turn: false };  // Stop the bot
        }
      } else {
        backtrackCount = 0;
        lastBacktrackLocation = currentLocation;
      }
      
      // Skip fully explored nodes - we know everything about them
      if (fullyExploredNodes.has(currentLocation)) {
        console.log(`🔙 BACKTRACK: Skipping ${currentLocation} - fully explored (6/6 buckets)`);
        // Just navigate to next unexplored node
      } else if (currentNode.hasUntriedYaws() && !turnedAtNodes.has(currentLocation)) {
        // Explore this node! One turn only.
        const targetYaw = currentNode.getNextUntriedYaw();
        turnedAtNodes.add(currentLocation);
        const diff = yawDifference(orientation, targetYaw);
        if (diff > 5 && diff < 355) {
          const turnAngle = getLeftTurnAngle(orientation, targetYaw);
          console.log(`🔙 BACKTRACK: Exploring untried yaw ${targetYaw}° at ${currentLocation} (${currentNode.triedYaws.size}/6) angle=${Math.round(turnAngle)}°`);
          return { turn: true, angle: turnAngle };
        }
        console.log(`🔙 BACKTRACK: Already facing untried yaw ${targetYaw}°, moving forward`);
        return { turn: false };
      }
      
      // Navigate to nearest node with untried buckets (skip fully explored)
      const candidate = enhancedGraph.findNearestCrossroadCandidate(currentLocation, breadcrumbs);
      if (candidate) {
        const targetYaw = candidate.node.getNextUntriedYaw();
        if (targetYaw !== null) {
          navigationTarget = {
            location: candidate.location,
            targetYaw,
            distance: candidate.distance
          };
          console.log(`🔙 RETURN MODE: Navigating to crossroad ${candidate.location} (${candidate.distance} steps away)`);
        }
      }
    } else if (!hasBeenHereBefore && !isExhausted) {
      isReturning = false;
      // Reset backtrack tracking when starting fresh exploration
      turnedAtNodes.clear();
      backtrackCount = 0;
      lastBacktrackLocation = null;
      // Don't clear yawCorrectedNodes - corrections persist across sessions
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
          // Reset backtrack tracking - starting fresh exploration
          turnedAtNodes.clear();
          backtrackCount = 0;
          lastBacktrackLocation = null;
          return { turn: true, angle: turnAngle };
        }
        navigationTarget = null;
        turnedAtNodes.clear();
        backtrackCount = 0;
        lastBacktrackLocation = null;
        // Will be caught by FORWARD mode on next tick
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
        // TRULY STUCK - No successful exits recorded (shouldn't happen with bidirectional recording)
        // This means we have a data inconsistency - log error and try to recover
        console.log(`🚨 SPIN DETECTED! At ${currentLocation} - all ${currentNode.triedYaws.size} buckets tried, no successful exits!`);
        console.log(`   Tried yaw buckets: ${[...currentNode.triedYaws].join(', ')}`);
        console.log(`   This should not happen - every node should have at least the reverse direction recorded`);
        
        // Emergency: use entryYaw if available (go back the way we came)
        if (currentNode.entryYaw !== undefined && currentNode.entryYaw !== null) {
          const reverseYaw = (currentNode.entryYaw + 180) % 360;
          const turnAngle = getLeftTurnAngle(orientation, reverseYaw);
          console.log(`🚨 EMERGENCY! Using entryYaw ${currentNode.entryYaw}° → reverse ${reverseYaw}° (angle=${Math.round(turnAngle)}°)`);
          return { turn: true, angle: turnAngle };
        }
        
        // Last resort: stop the bot - we're truly stuck with no way out
        console.log(`🛑 CRITICAL: No escape route found. Bot cannot continue from this location.`);
        return { turn: false };  // Don't turn - let the bot stop naturally
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
