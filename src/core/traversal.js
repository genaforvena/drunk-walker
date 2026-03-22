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

/**
 * Calculate yaw from last movement (previous location → current)
 * More accurate for new node correction
 */
function calculateYawFromLastMove(previousLocation, currentLocation) {
  if (!previousLocation || !currentLocation || previousLocation === currentLocation) {
    return null;
  }
  
  const prev = previousLocation.split(',').map(Number);
  const curr = currentLocation.split(',').map(Number);
  
  const dLat = curr[0] - prev[0];
  const dLng = curr[1] - prev[1];
  
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

  /**
   * Get untried yaw closest to current orientation
   * @param {number} currentOrientation - Current yaw orientation (optional)
   * @returns {number|null} Closest untried yaw bucket, or null if all tried
   */
  getNextUntriedYaw(currentOrientation = null) {
    if (currentOrientation === null) {
      // Fallback: return first untried (old behavior)
      for (const yaw of [0, 60, 120, 180, 240, 300]) {
        if (!this.triedYaws.has(yaw)) return yaw;
      }
      return null;
    }
    
    // Find untried yaw closest to current orientation
    const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !this.triedYaws.has(y));
    if (untriedYaws.length === 0) return null;
    
    let closestYaw = untriedYaws[0];
    let closestDiff = yawDifference(currentOrientation, closestYaw);
    
    for (const yaw of untriedYaws) {
      const diff = yawDifference(currentOrientation, yaw);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestYaw = yaw;
      }
    }
    
    return closestYaw;
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

  // Progress tracking - detect when we're stuck in a local cluster
  let lastNewNodeStep = 0;  // breadcrumbs.length when we last discovered a new node
  let lastNewNodeCount = 0;  // graph.nodes count at last new node
  let consecutiveStraightMoves = 0;  // Count of consecutive straight moves (no turns)
  let lastDecisionWasTurn = false;  // Track if last decision was a turn
  let linearSegmentStart = null;  // Track start of current linear segment
  let traversedSegments = new Set();  // Segments traversed bidirectionally (format: "loc1|loc2")
  let escapeTargetLocation = null;  // Emergency escape target when stuck in loop
  let aggressiveScanCooldown = 0;  // Cooldown after aggressive scan to prevent immediate return mode
  
  // Wall-following DFS state (SIMPLE: forward → left turn → backward looking for left exit)
  let wallFollowMode = false;  // True when following left wall backward
  let wallFollowBearing = null;  // Bearing to follow (left of forward direction)
  let forwardBearing = null;  // Original forward bearing when we hit dead end

  const enhancedGraph = new EnhancedTransitionGraph();

  const decide = (context) => {
    const { stuckCount, currentLocation, previousLocation, visitedUrls, breadcrumbs, orientation, isNewNode, isFullyScanned, justArrived, nodeVisitCount } = context;

    console.log(`[DEBUG] decide() called: stuck=${stuckCount}, orientation=${Math.round(orientation)}°, loc=${currentLocation}`);
    console.log(`[DEBUG] breadcrumbs.length=${breadcrumbs.length}, graph.nodes=${enhancedGraph.nodes.size}`);
    console.log(`[DEBUG] isNewNode=${isNewNode}, isFullyScanned=${isFullyScanned}, justArrived=${justArrived}`);

    if (!preferredYaw) preferredYaw = orientation;
    if (!currentLocation) {
      console.log('[DEBUG] No location, returning no turn');
      return { turn: false };
    }

    const currentParts = currentLocation.split(',').map(Number);
    const currentNode = enhancedGraph.getOrCreate(currentLocation, currentParts[0], currentParts[1]);

    console.log(`[DEBUG] currentNode.triedYaws=${[...currentNode.triedYaws].join(',')}, hasUntried=${currentNode.hasUntriedYaws()}`);

    // Track when we discover new nodes
    if (isNewNode) {
      lastNewNodeStep = breadcrumbs.length;
      lastNewNodeCount = enhancedGraph.nodes.size;
    }

    // Detect stagnation: no new nodes for many steps
    const stepsSinceNewNode = breadcrumbs.length - lastNewNodeStep;
    const isStagnant = stepsSinceNewNode > 50 && enhancedGraph.nodes.size > 50;

    if (isStagnant) {
      console.log(`⚠️ STAGNATION: ${stepsSinceNewNode} steps since new node (graph=${enhancedGraph.nodes.size} nodes)`);
    }

    // ═══════════════════════════════════════════════════════════
    // 🗑️ AGGRESSIVE PRUNING: Mark node as fully explored when 5+ yaws tried
    // (1 yaw is how we arrived, 4+ explored = nothing new to find)
    // Also mark as dead-end if only 1 untried yaw remains (the arrival yaw)
    // ═══════════════════════════════════════════════════════════
    const untriedCount = 6 - currentNode.triedYaws.size;
    if (currentNode.triedYaws.size >= 5 || untriedCount <= 1) {
      fullyExploredNodes.add(currentLocation);
    } else if (untriedCount > 1 && fullyExploredNodes.has(currentLocation)) {
      // New yaw discovered - remove from fully explored
      fullyExploredNodes.delete(currentLocation);
    }

    // ═══════════════════════════════════════════════════════════
    // 🚫 NEW NODE: Never turn at new/unsampled nodes - go straight!
    // But first: ensure we're facing the forward direction (prev→cur)
    // ═══════════════════════════════════════════════════════════
    if (isNewNode) {
      // Calculate forward bearing from prev→cur
      let currentForwardBearing = orientation;
      if (previousLocation) {
        const prevParts = previousLocation.split(',').map(Number);
        const currentParts = currentLocation.split(',').map(Number);
        const dLat = currentParts[0] - prevParts[0];
        const dLng = currentParts[1] - prevParts[1];
        currentForwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (currentForwardBearing < 0) currentForwardBearing += 360;
      }
      
      // If not facing forward direction, turn to face it
      const bearingDiff = yawDifference(orientation, currentForwardBearing);
      if (bearingDiff > 15 && bearingDiff < 165) {
        console.log(`🧭 NEW NODE: Turning to face forward bearing ${Math.round(currentForwardBearing)}° (diff=${Math.round(bearingDiff)}°)`);
        const turnAngle = getLeftTurnAngle(orientation, currentForwardBearing);
        const turnDirection = getTurnDirection(orientation, currentForwardBearing);
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
      
      console.log('[DEBUG] NEW NODE - going straight (no turn)');
      // Remove from fully explored if it was there (fresh visit)
      fullyExploredNodes.delete(currentLocation);

      // Track consecutive straight moves
      if (!lastDecisionWasTurn) {
        consecutiveStraightMoves++;
        
        // Track linear segment (same orientation, consecutive new nodes)
        if (linearSegmentStart === null) {
          linearSegmentStart = previousLocation || currentLocation;
        }
      } else {
        consecutiveStraightMoves = 1;
        linearSegmentStart = previousLocation || currentLocation;
      }
      
      console.log(`[DEBUG] consecutiveStraightMoves=${consecutiveStraightMoves}, lastDecisionWasTurn=${lastDecisionWasTurn}`);

      // ═══════════════════════════════════════════════════════════
      // 🎯 AGGRESSIVE EXPLORATION: If we've been moving straight for
      // several nodes, stop and try a side exit before continuing!
      // This prevents walking 100+ nodes down a linear street without
      // checking side paths.
      // ═══════════════════════════════════════════════════════════
      // After 5+ consecutive straight moves, force exploration of a side exit
      // BUT: Skip aggressive scan if we're discovering new nodes (DFS priority!)
      // AND: Only trigger at HIGH-PROBABILITY junctions (≥2 untried yaws)
      if (consecutiveStraightMoves >= 5 && currentNode.hasUntriedYaws() && !isNewNode) {
        const untriedCount = 6 - currentNode.triedYaws.size;
        // Only trigger aggressive scan at junctions with ≥2 untried yaws
        // (high probability of unexplored exits)
        if (untriedCount >= 2) {
          console.log(`🎯 AGGRESSIVE SCAN triggered! consecutiveStraightMoves=${consecutiveStraightMoves}, untriedCount=${untriedCount}`);
          // Pick an untried yaw that's NOT straight ahead
          const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
          // Find yaw most different from current orientation (side exit, not forward)
          let bestSideYaw = null;
          let bestDiff = 30;  // Minimum difference to be considered "side"

          for (const yaw of untriedYaws) {
            const diff = yawDifference(orientation, yaw);
            // Prefer yaws that are 60-150° from current (side exits, not straight/back)
            if (diff >= 60 && diff <= 150 && diff > bestDiff) {
              bestDiff = diff;
              bestSideYaw = yaw;
            }
          }

          // Fallback: any untried yaw that's not straight ahead
          if (bestSideYaw === null) {
            const forwardYaw = orientation;
            for (const yaw of untriedYaws) {
              if (yawDifference(yaw, forwardYaw) >= 60) {
                bestSideYaw = yaw;
                break;
              }
            }
          }

          if (bestSideYaw !== null) {
            const diff = yawDifference(orientation, bestSideYaw);
            console.log(`  bestSideYaw=${bestSideYaw}, diff=${Math.round(diff)}°`);
            if (diff > 5 && diff < 170) {
              console.log(`🎯 AGGRESSIVE SCAN: After ${consecutiveStraightMoves} straight nodes, trying side yaw ${bestSideYaw}° (diff=${Math.round(diff)}°)`);
              const turnAngle = getLeftTurnAngle(orientation, bestSideYaw);
              const turnDirection = getTurnDirection(orientation, bestSideYaw);
              lastDecisionWasTurn = true;
              aggressiveScanCooldown = 5;  // Don't enter return mode for 5 ticks after aggressive scan
              return { turn: true, angle: turnAngle, direction: turnDirection };
            } else {
              console.log(`  Skipping: diff=${Math.round(diff)}° not in range (5, 170)`);
            }
          } else {
            console.log(`  No suitable side yaw found. untriedYaws=[${untriedYaws.join(',')}]`);
          }
        } else {
          console.log(`  Skipping aggressive scan: only ${untriedCount} untried yaw(s) - low probability junction`);
        }
      }

      lastDecisionWasTurn = false;  // Reset when going straight
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // MODE DETECTION: Are we returning (retracing) or exploring?
    // ═══════════════════════════════════════════════════════════
    const lastDifferentIndex = breadcrumbs.findLastIndex(loc => loc !== currentLocation);
    const hasBeenHereBefore = lastDifferentIndex !== -1 && breadcrumbs.slice(0, lastDifferentIndex + 1).includes(currentLocation);
    const isExhausted = !currentNode.hasUntriedYaws();

    console.log(`[DEBUG] hasBeenHereBefore=${hasBeenHereBefore}, isExhausted=${isExhausted}, fullyExplored=${fullyExploredNodes.has(currentLocation)}`);

    // ═══════════════════════════════════════════════════════════
    // 🧱 PLEDGE ALGORITHM: Simple wall-following
    // Each node visited AT MOST TWICE!
    // ═══════════════════════════════════════════════════════════
    // NO breadcrumb navigation - pure PLEDGE only!
    
    // Calculate forward bearing from prev→cur
    let currentForwardBearing = orientation;
    if (previousLocation) {
      const prevParts = previousLocation.split(',').map(Number);
      const currentParts = currentLocation.split(',').map(Number);
      const dLat = currentParts[0] - prevParts[0];
      const dLng = currentParts[1] - prevParts[1];
      currentForwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
      if (currentForwardBearing < 0) currentForwardBearing += 360;
    }
    
    // Check if we hit a dead end (fully explored node with no untried yaws)
    const isDeadEnd = isExhausted && fullyExploredNodes.has(currentLocation);
    
    // At dead end: TURN LEFT and start wall-following backward
    if (isDeadEnd && !wallFollowMode) {
      wallFollowMode = true;
      forwardBearing = currentForwardBearing;
      // Turn 120° LEFT from forward direction (face left wall, slightly back)
      wallFollowBearing = (forwardBearing + 120) % 360;
      console.log(`🧱 DEAD END! Forward bearing=${Math.round(forwardBearing)}°, turning to wall-follow bearing=${Math.round(wallFollowBearing)}°`);
    }
    
    // In wall-follow mode: look for LEFTMOST untried yaw at each node
    if (wallFollowMode && currentNode.hasUntriedYaws()) {
      const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
      
      // Find leftmost untried yaw (90-180° LEFT from forward bearing)
      let bestYaw = null;
      let bestDiff = 90;  // Minimum for "left" turn
      
      for (const yaw of untriedYaws) {
        const diff = yawDifference(forwardBearing, yaw);
        // Prefer left turns (90-180° from forward)
        if (diff >= 90 && diff <= 180 && diff > bestDiff) {
          bestDiff = diff;
          bestYaw = yaw;
        }
      }
      
      // Fallback: any untried yaw
      if (bestYaw === null && untriedYaws.length > 0) {
        bestYaw = untriedYaws[0];
        bestDiff = yawDifference(forwardBearing, bestYaw);
      }
      
      // Found left exit! Take it and resume forward mode
      if (bestYaw !== null) {
        console.log(`🧱 WALL-FOLLOW: Found LEFT exit yaw ${bestYaw}° (diff=${Math.round(bestDiff)}° from forward)`);
        const turnAngle = getLeftTurnAngle(orientation, bestYaw);
        const turnDirection = getTurnDirection(orientation, bestYaw);
        wallFollowMode = false;
        wallFollowBearing = null;
        forwardBearing = null;
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
    }
    
    // In wall-follow mode: face wall-follow bearing and move backward
    if (wallFollowMode && wallFollowBearing !== null) {
      const diff = yawDifference(orientation, wallFollowBearing);
      if (diff > 10) {
        console.log(`🧱 WALL-FOLLOW: Turning to face bearing ${Math.round(wallFollowBearing)}° (diff=${Math.round(diff)}°)`);
        const turnAngle = getLeftTurnAngle(orientation, wallFollowBearing);
        const turnDirection = getTurnDirection(orientation, wallFollowBearing);
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
      // Facing correct direction, move forward (which is backward along the path)
      console.log(`🧱 WALL-FOLLOW: Moving along left wall`);
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // 🚨 BREAK THE WALL: When truly stuck (all yaws tried, fully explored)
    // Retry ANY successful yaw - we need to escape this dead end!
    // ═══════════════════════════════════════════════════════════
    if (isExhausted && fullyExploredNodes.has(currentLocation) && currentNode.successfulYaws.size > 0) {
      const successfulYawsArray = Array.from(currentNode.successfulYaws);
      const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
      console.log(`🚨 BREAK WALL: All yaws exhausted! Retrying successful yaw ${randomSuccessfulYaw}°`);
      const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
      const turnDirection = getTurnDirection(orientation, randomSuccessfulYaw);
      consecutiveStraightMoves = 0;
      lastDecisionWasTurn = true;
      wallFollowMode = false;  // Reset wall-follow - we're breaking out!
      wallFollowBearing = null;
      forwardBearing = null;
      return { turn: true, angle: turnAngle, direction: turnDirection };
    }

    // Reset consecutive straight moves counter when we arrive at a visited node
    if (hasBeenHereBefore) {
      consecutiveStraightMoves = 0;
      lastDecisionWasTurn = false;
      linearSegmentStart = null;  // Reset segment tracking
    }

    // Decrement aggressive scan cooldown
    if (aggressiveScanCooldown > 0) {
      aggressiveScanCooldown--;
    }

    // Detect start of backtrack (hit dead end, now returning)
    // Skip return mode if we just did an aggressive scan (exploring side exit)
    const isBacktracking = (hasBeenHereBefore || isExhausted) && !navigationTarget && aggressiveScanCooldown === 0;

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

      // Navigate to nearest node with untried buckets (skip fully explored)
      const candidate = enhancedGraph.findNearestCrossroadCandidate(currentLocation, breadcrumbs);
      if (candidate) {
        const targetYaw = candidate.node.getNextUntriedYaw(orientation);
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
        // Reached target! Try an untried yaw to explore new territory
        const node = enhancedGraph.nodes.get(currentLocation);
        if (node && node.hasUntriedYaws()) {
          const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !node.triedYaws.has(y));
          
          // Prefer yaw that's different from how we arrived
          const approachYaw = (orientation + 180) % 360;
          let bestYaw = null;
          let bestDiff = 0;
          
          for (const yaw of untriedYaws) {
            const diff = yawDifference(approachYaw, yaw);
            if (diff > bestDiff) {
              bestDiff = diff;
              bestYaw = yaw;
            }
          }
          
          if (bestYaw !== null) {
            console.log(`🎯 Reached escape node! Trying untried yaw ${bestYaw}° (diff=${Math.round(bestDiff)}° from approach)`);
            const turnAngle = getLeftTurnAngle(orientation, bestYaw);
            const turnDirection = getTurnDirection(orientation, bestYaw);
            navigationTarget = null;
            escapeTargetLocation = null;
            consecutiveStraightMoves = 0;
            lastDecisionWasTurn = true;
            return { turn: true, angle: turnAngle, direction: turnDirection };
          }
        }
        
        // No untried yaws - clear target and fall through
        navigationTarget = null;
        escapeTargetLocation = null;
        turnedAtNodes.clear();
        backtrackCount = 0;
        lastBacktrackLocation = null;
      }

      // Navigate by following breadcrumbs back (graph topology, not geometry!)
      // Find the previous node in the breadcrumb trail that leads to target
      const targetIndex = breadcrumbs.lastIndexOf(navigationTarget.location);
      const currentIndex = breadcrumbs.lastIndexOf(currentLocation);

      let yawToNavigate = null;

      if (targetIndex !== -1 && currentIndex !== -1 && targetIndex < currentIndex) {
        // Navigate to previous breadcrumb (closer to target)
        const previousInPath = breadcrumbs[currentIndex - 1];
        if (previousInPath && previousInPath !== currentLocation) {
          const prevParts = previousInPath.split(',').map(Number);
          const dLat = prevParts[0] - currentParts[0];
          const dLng = prevParts[1] - currentParts[1];
          yawToNavigate = Math.atan2(dLng, dLat) * 180 / Math.PI;
          if (yawToNavigate < 0) yawToNavigate += 360;
          console.log(`[DEBUG] NAVIGATION: Following breadcrumb to ${previousInPath} (target: ${navigationTarget.location})`);
        }
      }

      // Fallback: if breadcrumb navigation failed, use geometric approach
      if (yawToNavigate === null) {
        const targetParts = navigationTarget.location.split(',').map(Number);
        const dLat = targetParts[0] - currentParts[0];
        const dLng = targetParts[1] - currentParts[1];
        yawToNavigate = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (yawToNavigate < 0) yawToNavigate += 360;
        console.log(`[DEBUG] NAVIGATION: Using geometric fallback to ${navigationTarget.location}`);
      }

      // ═══════════════════════════════════════════════════════════
      // 🎯 FORWARD MOMENTUM: If node has untried yaws close to current
      // orientation, try those FIRST before continuing navigation
      // This ensures we explore side paths instead of just passing through
      // ═══════════════════════════════════════════════════════════
      if (currentNode.hasUntriedYaws()) {
        // Calculate forward bearing (direction of travel from previous node)
        let forwardBearing = orientation;  // Default to current orientation
        if (previousLocation) {
          const prevParts = previousLocation.split(',').map(Number);
          const dLat = currentParts[0] - prevParts[0];
          const dLng = currentParts[1] - prevParts[1];
          forwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
          if (forwardBearing < 0) forwardBearing += 360;
        }
        
        // Find untried yaw closest to FORWARD BEARING (not current orientation!)
        const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
        let bestUntiredYaw = null;
        let bestDiff = 90;  // Only consider yaws within 90° of forward
        
        for (const untriedYaw of untriedYaws) {
          const diffToForward = yawDifference(forwardBearing, untriedYaw);
          if (diffToForward < bestDiff) {
            bestDiff = diffToForward;
            bestUntiredYaw = untriedYaw;
          }
        }
        
        // If we found an untried yaw within 90° of forward, try it!
        if (bestUntiredYaw !== null && bestDiff <= 90) {
          console.log(`🎯 FORWARD PRIORITY: Untired yaw ${bestUntiredYaw}° is ${Math.round(bestDiff)}° from forward bearing ${Math.round(forwardBearing)}° - trying first!`);
          const turnAngle = getLeftTurnAngle(orientation, bestUntiredYaw);
          const turnDirection = getTurnDirection(orientation, bestUntiredYaw);
          consecutiveStraightMoves = 0;  // Reset on turn
          lastDecisionWasTurn = true;
          return { turn: true, angle: turnAngle, direction: turnDirection };
        }
      }

      const diff = yawDifference(orientation, yawToNavigate);

      // If stuck while navigating, fall through to PANIC mode
      if (stuckCount >= panicThreshold) {
        console.log(`[DEBUG] Stuck while navigating (stuck=${stuckCount}), falling through to PANIC`);
        // Clear navigation target so PANIC can work
        // navigationTarget stays set but we'll handle the stuck
      } else if (diff < 30) {
        return { turn: false };  // Move forward toward target
      } else {
        const turnAngle = getLeftTurnAngle(orientation, yawToNavigate);
        const turnDirection = getTurnDirection(orientation, yawToNavigate);
        consecutiveStraightMoves = 0;  // Reset on turn
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };  // Turn toward target
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🚨 PANIC MODE: If stuck for 3+ heartbeats, MUST turn
    // ═══════════════════════════════════════════════════════════
    console.log(`[DEBUG] Checking PANIC: stuckCount=${stuckCount} >= panicThreshold=${panicThreshold}? ${stuckCount >= panicThreshold}`);
    if (stuckCount >= panicThreshold) {
      // First, try any untried yaw (closest to current orientation)
      const nextYaw = currentNode.getNextUntriedYaw(orientation);
      console.log(`[DEBUG] PANIC MODE: nextYaw=${nextYaw}, successfulYaws=${[...currentNode.successfulYaws].join(',')}`);

      if (nextYaw !== null) {
        const turnAngle = getLeftTurnAngle(orientation, nextYaw);
        const turnDirection = getTurnDirection(orientation, nextYaw);
        console.log(`🚨 PANIC! Stuck ${stuckCount}x. Trying untried yaw ${nextYaw}° (angle=${Math.round(turnAngle)}° ${turnDirection})`);
        consecutiveStraightMoves = 0;  // Reset on turn
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      } else if (currentNode.successfulYaws.size > 0) {
        // All buckets tried but still stuck - retry a successful exit
        // Pick random successful yaw (one of them must work - we came from somewhere!)
        const successfulYawsArray = Array.from(currentNode.successfulYaws);
        const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
        const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
        const turnDirection = getTurnDirection(orientation, randomSuccessfulYaw);
        console.log(`🚨 PANIC! All buckets tried. Retrying successful yaw ${randomSuccessfulYaw}° (angle=${Math.round(turnAngle)}° ${turnDirection})`);
        consecutiveStraightMoves = 0;  // Reset on turn
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
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
          const turnDirection = getTurnDirection(orientation, reverseYaw);
          console.log(`🚨 EMERGENCY! Using entryYaw ${currentNode.entryYaw}° → reverse ${reverseYaw}° (angle=${Math.round(turnAngle)}° ${turnDirection})`);
          return { turn: true, angle: turnAngle, direction: turnDirection };
        }
        
        // Last resort: stop the bot - we're truly stuck with no way out
        console.log(`🛑 CRITICAL: No escape route found. Bot cannot continue from this location.`);
        return { turn: false };  // Don't turn - let the bot stop naturally
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: At node with untried yaws - try them
    // ═══════════════════════════════════════════════════════════

    // 🎯 STAGNATION ESCAPE: If no new nodes for a while, find boundary nodes
    // Boundary = nodes with untried yaws that are furthest from current position
    if (isStagnant && !navigationTarget) {
      // Find the oldest node in breadcrumbs with untried yaws (boundary exploration)
      const currentIndex = breadcrumbs.lastIndexOf(currentLocation);
      for (let i = 0; i < Math.min(breadcrumbs.length - 1, 100); i++) {
        const oldLoc = breadcrumbs[i];
        if (oldLoc === currentLocation) continue;
        const oldNode = enhancedGraph.nodes.get(oldLoc);
        if (oldNode && oldNode.hasUntriedYaws() && !fullyExploredNodes.has(oldLoc)) {
          const targetYaw = oldNode.getNextUntriedYaw(orientation);
          navigationTarget = {
            location: oldLoc,
            targetYaw,
            distance: Math.abs(currentIndex - i)
          };
          console.log(`🎯 BOUNDARY: Stagnation escape! Targeting boundary node ${oldLoc} (${Math.abs(currentIndex - i)} steps back)`);
          isReturning = true;
          break;
        }
      }
    }

    if (currentNode.hasUntriedYaws()) {
      // Calculate forward bearing (direction of travel from previous node)
      let forwardBearing = orientation;  // Default to current orientation
      if (previousLocation) {
        const prevParts = previousLocation.split(',').map(Number);
        const currentParts = currentLocation.split(',').map(Number);
        const dLat = currentParts[0] - prevParts[0];
        const dLng = currentParts[1] - prevParts[1];
        forwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (forwardBearing < 0) forwardBearing += 360;
      }
      
      // Find untried yaw closest to FORWARD BEARING (not current orientation!)
      const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
      let bestUntiredYaw = null;
      let bestDiff = Infinity;
      
      for (const yaw of untriedYaws) {
        const diffToForward = yawDifference(forwardBearing, yaw);
        if (diffToForward < bestDiff) {
          bestDiff = diffToForward;
          bestUntiredYaw = yaw;
        }
      }

      const nextYaw = bestUntiredYaw;
      console.log(`[DEBUG] FORWARD MODE: nextYaw=${nextYaw}, forwardBearing=${Math.round(forwardBearing)}°, orientation=${Math.round(orientation)}°`);
      if (nextYaw !== null) {
        const diff = yawDifference(orientation, nextYaw);
        console.log(`[DEBUG] yaw diff=${diff}°`);
        if (diff > 5 && diff < 355) {
          console.log(`🔍 Node ${currentLocation.split(',')[0]}...: Trying yaw ${nextYaw}° (${currentNode.triedYaws.size}/6), forward bearing=${Math.round(forwardBearing)}°`);
          const turnAngle = getLeftTurnAngle(orientation, nextYaw);
          const turnDirection = getTurnDirection(orientation, nextYaw);
          consecutiveStraightMoves = 0;  // Reset on turn
          lastDecisionWasTurn = true;
          linearSegmentStart = null;  // Reset segment tracking on turn
          return { turn: true, angle: turnAngle, direction: turnDirection };
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
        consecutiveStraightMoves = 0;  // Reset on turn
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: getTurnDirection(orientation, randomSuccessfulYaw) };
      }
      // Already facing it, move forward
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // 🧭 YAW CORRECTION (LOWEST PRIORITY): Only if no other algorithm applied
    // ═══════════════════════════════════════════════════════════
    // Only correct if:
    // - Just arrived at this node (first decision here)
    // - Haven't corrected at this node yet
    // - Drift is significant (>15°)
    // - No other algorithm decision was made
    const pathYaw = previousLocation && previousLocation !== currentLocation
      ? calculateYawFromLastMove(previousLocation, currentLocation)
      : (breadcrumbs.length >= 3 ? calculateYawFromPath(breadcrumbs, currentLocation, 3) : null);
    
    const hasCorrectedHere = yawCorrectedNodes.has(currentLocation);
    
    if (pathYaw !== null && !hasCorrectedHere && justArrived) {
      const orientationDiff = yawDifference(orientation, pathYaw);
      
      // Only correct if drift is significant (>15°)
      if (orientationDiff > 15 && orientationDiff < 165) {
        yawCorrectedNodes.add(currentLocation);
        const turnDirection = getTurnDirection(orientation, pathYaw);
        console.log(`🧭 YAW CORRECTION (fallback): ${Math.round(orientation)}° → ${pathYaw}° (diff=${Math.round(orientationDiff)}°) ${turnDirection} at ${currentLocation}`);

        const turnAngle = getLeftTurnAngle(orientation, pathYaw);
        consecutiveStraightMoves = 0;  // Reset on turn
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: Go straight (no turn)
    // ═══════════════════════════════════════════════════════════
    console.log('[DEBUG] FORWARD MODE: Going straight (no turn)');
    return { turn: false };
  };

  /**
   * Determine optimal turn direction (left or right)
   * Returns 'right' if turning right is shorter, otherwise 'left'
   */
  function getTurnDirection(currentYaw, targetYaw) {
    const leftAngle = getLeftTurnAngle(currentYaw, targetYaw);
    const rightAngle = (360 - leftAngle) % 360;
    
    // Turn right if it's shorter (less than 180°)
    return rightAngle < leftAngle ? 'right' : 'left';
  }

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
