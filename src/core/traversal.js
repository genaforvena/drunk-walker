/**
 * Traversal Algorithm v6.1.0 - PURE PLEDGE Wall-Following
 *
 * SIMPLE PLEDGE: FORWARD → TURN LEFT 120° → WALL-FOLLOW → BREAK WALL
 * NO breadcrumb navigation - pure wall-following only!
 *
 * Key features:
 * - Forward bearing (prev→cur) at new nodes
 * - Cul-de-sac verification at end of straight line
 * - Each node visited AT MOST TWICE
 * - Clear state when stuck >10 steps on 1-2 nodes
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

/**
 * Calculate yaw from last movement (previous location → current)
 */
function calculateYawFromLastMove(previousLocation, currentLocation) {
  if (!previousLocation || !currentLocation || previousLocation === currentLocation) {
    return null;
  }

  const prev = previousLocation.split(',').map(Number);
  const curr = currentLocation.split(',').map(Number);

  const dLat = curr[0] - prev[0];
  const dLng = curr[1] - prev[1];

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
    this.isFullyExplored = false;
  }

  recordAttempt(yaw, success, targetLocation = null) {
    const bucket = Math.round(normalizeAngle(yaw) / 60) * 60 % 360;
    this.triedYaws.add(bucket);
    if (success && targetLocation) {
      this.successfulYaws.add(bucket);
    }
    // Mark as fully explored when 5+ yaws tried
    if (this.triedYaws.size >= 5) {
      this.isFullyExplored = true;
    }
  }

  hasUntriedYaws() { return this.triedYaws.size < 6; }
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
}

/**
 * PURE PLEDGE ALGORITHM v6.1.0
 */
export function createUnifiedAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;

  // PLEDGE state
  let wallFollowMode = false;
  let wallFollowBearing = null;
  let forwardBearing = null;

  // Complete stuck detection - clear state when looping on same 1-2 nodes
  let locationStuckCounter = 0;
  let lastStuckLocation = null;
  let secondLastStuckLocation = null;

  // Progress tracking
  let consecutiveStraightMoves = 0;
  let lastDecisionWasTurn = false;
  let linearSegmentStart = null;

  // ═══════════════════════════════════════════════════════════
  // 🧭 COMMITTED DIRECTION: Hysteresis to prevent oscillation
  // Only change committed direction when bearing differs by >45°
  // ═══════════════════════════════════════════════════════════
  let committedDirection = null;

  const enhancedGraph = new EnhancedTransitionGraph();

  const decide = (context) => {
    const { stuckCount, currentLocation, previousLocation, visitedUrls, breadcrumbs, orientation, isNewNode, isFullyScanned, justArrived, nodeVisitCount } = context;

    console.log(`[DEBUG] decide() called: stuck=${stuckCount}, orientation=${Math.round(orientation)}°, loc=${currentLocation}`);
    console.log(`[DEBUG] breadcrumbs.length=${breadcrumbs.length}, graph.nodes=${enhancedGraph.nodes.size}`);
    console.log(`[DEBUG] isNewNode=${isNewNode}, isFullyScanned=${isFullyScanned}, justArrived=${justArrived}`);

    // ═══════════════════════════════════════════════════════════
    // 🚨 COMPLETE STUCK DETECTION: Clear state when stuck >20 steps on single node
    // DO NOT clear on 2-node loop - this is NORMAL behavior when backtracking!
    // ═══════════════════════════════════════════════════════════
    if (currentLocation === lastStuckLocation || currentLocation === secondLastStuckLocation) {
      locationStuckCounter++;

      // Detect 2-node loop (oscillating between same 2 locations)
      // This is NORMAL during wall-follow backtracking - don't clear graph!
      const isTwoNodeLoop = currentLocation === secondLastStuckLocation &&
                           previousLocation === lastStuckLocation;

      // Only clear state when stuck on SINGLE node for >20 steps (real stuck)
      if (locationStuckCounter > 20 && !isTwoNodeLoop) {
        console.log(`🚨 SINGLE-NODE STUCK DETECTED! stuckCounter=${locationStuckCounter}, location=${lastStuckLocation}`);
        console.log(`   Clearing PLEDGE state (keeping graph memory)...`);

        // Clear PLEDGE state ONLY - keep the graph (learned yaw info is valuable!)
        wallFollowMode = false;
        wallFollowBearing = null;
        forwardBearing = null;
        committedDirection = null;  // Reset committed direction
        consecutiveStraightMoves = 0;
        linearSegmentStart = null;
        locationStuckCounter = 0;
        lastStuckLocation = null;
        secondLastStuckLocation = null;

        // DO NOT clear enhancedGraph - we need to remember which yaws we tried!
        // enhancedGraph.nodes.clear();  // REMOVED - this was causing revisits!
        // enhancedGraph.connections.clear();  // REMOVED

        console.log(`   ✅ PLEDGE state cleared - graph preserved, continuing exploration`);
      }
    } else {
      // Location changed - reset stuck counter
      secondLastStuckLocation = lastStuckLocation;
      lastStuckLocation = currentLocation;
      locationStuckCounter = 1;
    }

    if (!currentLocation) {
      console.log('[DEBUG] No location, returning no turn');
      return { turn: false };
    }

    const currentParts = currentLocation.split(',').map(Number);
    const currentNode = enhancedGraph.getOrCreate(currentLocation, currentParts[0], currentParts[1]);

    console.log(`[DEBUG] currentNode.triedYaws=${[...currentNode.triedYaws].join(',')}, hasUntried=${currentNode.hasUntriedYaws()}`);

    // ═══════════════════════════════════════════════════════════
    // 🧭 SMOOTH FORWARD BEARING: Use rolling window of 2-3 breadcrumbs
    // This smooths yaw adjustments and reduces jittery turning
    // ═══════════════════════════════════════════════════════════
    let currentForwardBearing = orientation;
    if (previousLocation) {
      // Use rolling window: prefer 3-point average if available, else 2-point
      const windowSize = Math.min(3, breadcrumbs.length);
      if (windowSize >= 2) {
        // Get the last N locations from breadcrumbs
        const recentLocs = breadcrumbs.slice(-windowSize);
        if (recentLocs.length >= 2) {
          const first = recentLocs[0].split(',').map(Number);
          const last = recentLocs[recentLocs.length - 1].split(',').map(Number);
          const dLat = last[0] - first[0];
          const dLng = last[1] - first[1];
          // Only use smoothed bearing if we have meaningful displacement (>1m)
          if (Math.abs(dLat) > 0.0001 || Math.abs(dLng) > 0.0001) {
            currentForwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
            if (currentForwardBearing < 0) currentForwardBearing += 360;
          }
        }
      }
      // Fallback to prev→cur if window calculation didn't work
      if (currentForwardBearing === orientation) {
        const prevParts = previousLocation.split(',').map(Number);
        const dLat = currentParts[0] - prevParts[0];
        const dLng = currentParts[1] - prevParts[1];
        currentForwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (currentForwardBearing < 0) currentForwardBearing += 360;
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🧭 COMMITTED DIRECTION: Apply hysteresis to prevent oscillation
    // Only update committed direction when bearing differs by >45°
    // This prevents micro-adjustments on straight roads
    // ═══════════════════════════════════════════════════════════
    if (committedDirection === null) {
      committedDirection = currentForwardBearing;
    } else {
      const committedDiff = yawDifference(committedDirection, currentForwardBearing);
      if (committedDiff > 45) {
        // Significant direction change - update committed direction
        committedDirection = currentForwardBearing;
      }
      // Otherwise, keep using committed direction (ignore minor bearing changes)
    }

    // Use committedDirection for decision making (not raw currentForwardBearing)
    const effectiveBearing = committedDirection;

    // ═══════════════════════════════════════════════════════════
    // 🆕 NEW NODE: Face forward bearing, go straight
    // ═══════════════════════════════════════════════════════════
    if (isNewNode) {
      // 🚨 FULL 360° SCAN: On FIRST forward pass, verify ALL untried yaws before continuing
      // This catches side branches that were missed during forward pass
      // Only applies to unexplored nodes (nodeVisitCount === 0)
      if (nodeVisitCount === 0 && currentNode.triedYaws.size < 6 && consecutiveStraightMoves >= 5) {
        const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
        if (untriedYaws.length > 0) {
          // 🎯 SMART SCAN: Sort untried yaws by turn cost (smallest turn first)
          // This finds exits faster with fewer wasted turns
          const sortedYaws = [...untriedYaws].sort((a, b) => {
            const turnA = yawDifference(orientation, a);
            const turnB = yawDifference(orientation, b);
            return turnA - turnB;  // Smallest turn first
          });
          const chosenYaw = sortedYaws[0];
          console.log(`🔍 FULL 360° SCAN: First visit, ${consecutiveStraightMoves} straight moves, checking yaw ${chosenYaw}° (turn=${yawDifference(orientation, chosenYaw).toFixed(0)}°, untried: ${untriedYaws.join(',')})`);
          const turnAngle = getLeftTurnAngle(orientation, chosenYaw);
          const turnDirection = getTurnDirection(orientation, chosenYaw);
          consecutiveStraightMoves = 0;  // Reset counter
          lastDecisionWasTurn = true;
          return { turn: true, angle: turnAngle, direction: turnDirection };
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 🧭 INCREASED THRESHOLD: Only turn for significant direction changes
      // Changed from 45° to 60° to reduce micro-adjustments on straight roads
      // ═══════════════════════════════════════════════════════════
      const bearingDiff = yawDifference(orientation, effectiveBearing);
      if (bearingDiff > 60 && bearingDiff < 150) {
        console.log(`🧭 NEW NODE: Turning to face effective bearing ${Math.round(effectiveBearing)}° (diff=${Math.round(bearingDiff)}°)`);
        const turnAngle = getLeftTurnAngle(orientation, effectiveBearing);
        const turnDirection = getTurnDirection(orientation, effectiveBearing);
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }

      // ═══════════════════════════════════════════════════════════
      // 🚫 SKIP YAW BUCKET ALIGNMENT ON STRAIGHT ROADS
      // If 3+ consecutive straight moves, don't micro-adjust to yaw buckets
      // Only turn if truly blocked or at a new junction
      // ═══════════════════════════════════════════════════════════
      if (consecutiveStraightMoves >= 3) {
        // Already committed to a direction, keep going straight
        // Only turn if this is a fresh node with no tried yaws
        if (currentNode.triedYaws.size === 0) {
          // First time here, might need to align
        } else {
          // Been going straight, don't micro-adjust
          consecutiveStraightMoves++;
          lastDecisionWasTurn = false;
          return { turn: false };
        }
      }

      console.log('[DEBUG] NEW NODE - going straight (no turn)');

      // Track consecutive straight moves
      if (!lastDecisionWasTurn) {
        consecutiveStraightMoves++;
        if (linearSegmentStart === null) {
          linearSegmentStart = previousLocation || currentLocation;
        }
      } else {
        consecutiveStraightMoves = 1;
        linearSegmentStart = previousLocation || currentLocation;
      }

      lastDecisionWasTurn = false;
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // 🧱 DEAD END DETECTION: All yaws tried → TURN LEFT 105°
    // This is the END OF STRAIGHT LINE - start wall-following
    // ═══════════════════════════════════════════════════════════
    const isExhausted = !currentNode.hasUntriedYaws();
    const isDeadEnd = isExhausted && currentNode.isFullyExplored;

    if (isDeadEnd && !wallFollowMode) {
      wallFollowMode = true;
      forwardBearing = currentForwardBearing;
      // Turn 105° LEFT from forward direction (face left wall, slightly back)
      // Reduced from 120° to 105° to better catch side entrances during backtrack
      wallFollowBearing = (forwardBearing + 105) % 360;
      console.log(`🧱 DEAD END! Forward bearing=${Math.round(forwardBearing)}°, turning to wall-follow bearing=${Math.round(wallFollowBearing)}°`);
    }

    // ═══════════════════════════════════════════════════════════
    // 🔄 WALL-FOLLOW MODE: Scan for LEFT exits (90-180° from forward)
    // ═══════════════════════════════════════════════════════════
    if (wallFollowMode && currentNode.hasUntriedYaws()) {
      const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));

      // Find leftmost untried yaw (90-180° LEFT from forward bearing)
      let bestYaw = null;
      let bestDiff = 90;

      for (const yaw of untriedYaws) {
        const diff = yawDifference(forwardBearing, yaw);
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

      // Found left exit! Take it and resume FORWARD mode
      if (bestYaw !== null) {
        console.log(`🧱 WALL-FOLLOW: Found LEFT exit yaw ${bestYaw}° (diff=${Math.round(bestDiff)}° from forward)`);
        const turnAngle = getLeftTurnAngle(orientation, bestYaw);
        const turnDirection = getTurnDirection(orientation, bestYaw);
        wallFollowMode = false;
        wallFollowBearing = null;
        forwardBearing = null;
        committedDirection = null;  // Reset committed direction for new forward phase
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
    }

    // In wall-follow mode: face wall-follow bearing and move
    if (wallFollowMode && wallFollowBearing !== null) {
      const diff = yawDifference(orientation, wallFollowBearing);
      if (diff > 10) {
        console.log(`🧱 WALL-FOLLOW: Turning to face bearing ${Math.round(wallFollowBearing)}° (diff=${Math.round(diff)}°)`);
        const turnAngle = getLeftTurnAngle(orientation, wallFollowBearing);
        const turnDirection = getTurnDirection(orientation, wallFollowBearing);
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
      // 🚨 STUCK IN WALL-FOLLOW: Node is fully explored, can't move forward
      // Trigger BREAK WALL logic to retry a successful yaw
      if (!currentNode.hasUntriedYaws() && currentNode.successfulYaws.size > 0) {
        console.log(`🧱 WALL-FOLLOW: Stuck at fully explored node, breaking wall...`);
        // Fall through to BREAK WALL logic below
      } else {
        console.log(`🧱 WALL-FOLLOW: Moving along left wall`);
        return { turn: false };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🚨 BREAK THE WALL: When truly stuck, retry successful yaw
    // ═══════════════════════════════════════════════════════════
    if (isExhausted && currentNode.successfulYaws.size > 0) {
      const successfulYawsArray = Array.from(currentNode.successfulYaws);
      const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
      console.log(`🚨 BREAK WALL: All yaws exhausted! Retrying successful yaw ${randomSuccessfulYaw}°`);
      const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
      const turnDirection = getTurnDirection(orientation, randomSuccessfulYaw);
      consecutiveStraightMoves = 0;
      lastDecisionWasTurn = true;
      wallFollowMode = false;
      wallFollowBearing = null;
      forwardBearing = null;
      return { turn: true, angle: turnAngle, direction: turnDirection };
    }

    // ═══════════════════════════════════════════════════════════
    // 🚨 PANIC MODE: If stuck for 2+ heartbeats, MUST turn (reduced from 3)
    // With fast-fail cooldown skip, we can trigger earlier
    // ═══════════════════════════════════════════════════════════
    if (stuckCount >= 2) {
      // First, try any untried yaw
      const nextYaw = currentNode.getNextUntriedYaw?.(orientation) || getNextUntriedYaw(currentNode, orientation);

      if (nextYaw !== null) {
        const turnAngle = getLeftTurnAngle(orientation, nextYaw);
        const turnDirection = getTurnDirection(orientation, nextYaw);
        console.log(`🚨 PANIC! Stuck ${stuckCount}x. Trying untried yaw ${nextYaw}°`);
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      } else if (currentNode.successfulYaws.size > 0) {
        const successfulYawsArray = Array.from(currentNode.successfulYaws);
        const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
        const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
        const turnDirection = getTurnDirection(orientation, randomSuccessfulYaw);
        console.log(`🚨 PANIC! Retrying successful yaw ${randomSuccessfulYaw}°`);
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: At node with untried yaws - try them
    // ═══════════════════════════════════════════════════════════
    if (currentNode.hasUntriedYaws()) {
      const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));

      // Find untried yaw closest to EFFECTIVE BEARING (committed direction)
      let bestUntiredYaw = null;
      let bestDiff = Infinity;

      for (const yaw of untriedYaws) {
        const diffToForward = yawDifference(effectiveBearing, yaw);
        if (diffToForward < bestDiff) {
          bestDiff = diffToForward;
          bestUntiredYaw = yaw;
        }
      }

      const nextYaw = bestUntiredYaw;
      if (nextYaw !== null) {
        // ═══════════════════════════════════════════════════════════
        // 🎯 WIDENED YAW TOLERANCE: Accept ±20° drift (was ±5°)
        // Changed from (diff > 5 && diff < 355) to (diff > 20 && diff < 340)
        // This prevents micro-adjustments when already roughly aligned
        // ═══════════════════════════════════════════════════════════
        const diff = yawDifference(orientation, nextYaw);
        if (diff > 20 && diff < 340) {
          console.log(`🔍 FORWARD: Trying yaw ${nextYaw}° (diff=${Math.round(diff)}° from orientation, ${Math.round(bestDiff)}° from effective bearing)`);
          const turnAngle = getLeftTurnAngle(orientation, nextYaw);
          const turnDirection = getTurnDirection(orientation, nextYaw);
          consecutiveStraightMoves = 0;
          lastDecisionWasTurn = true;
          linearSegmentStart = null;
          return { turn: true, angle: turnAngle, direction: turnDirection };
        } else {
          console.log('[DEBUG] Already facing target yaw (within ±20° tolerance), moving forward');
          return { turn: false };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FALLBACK: Retry successful exit
    // ═══════════════════════════════════════════════════════════
    if (currentNode.successfulYaws.size > 0) {
      const successfulYawsArray = Array.from(currentNode.successfulYaws);
      const randomSuccessfulYaw = successfulYawsArray[Math.floor(Math.random() * successfulYawsArray.length)];
      const diff = yawDifference(orientation, randomSuccessfulYaw);
      if (diff > 5 && diff < 355) {
        const turnAngle = getLeftTurnAngle(orientation, randomSuccessfulYaw);
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: getTurnDirection(orientation, randomSuccessfulYaw) };
      }
      return { turn: false };
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: Go straight (no turn)
    // ═══════════════════════════════════════════════════════════
    console.log('[DEBUG] FORWARD MODE: Going straight (no turn)');
    return { turn: false };
  };

  // Helper function for getNextUntriedYaw
  function getNextUntriedYaw(node, currentOrientation) {
    if (!node.hasUntriedYaws()) return null;
    
    const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !node.triedYaws.has(y));
    if (untriedYaws.length === 0) return null;

    if (currentOrientation === null) {
      return untriedYaws[0];
    }

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

  /**
   * Determine optimal turn direction (left or right)
   */
  function getTurnDirection(currentYaw, targetYaw) {
    const leftAngle = getLeftTurnAngle(currentYaw, targetYaw);
    const rightAngle = (360 - leftAngle) % 360;
    return rightAngle < leftAngle ? 'right' : 'left';
  }

  return {
    decide,
    enhancedGraph,
    isReturning: () => false,  // PLEDGE doesn't have return mode
    getNavigationTarget: () => null
  };
}

export const createDefaultAlgorithm = createUnifiedAlgorithm;
export const createExplorationAlgorithm = createUnifiedAlgorithm;
export const createSurgicalAlgorithm = createUnifiedAlgorithm;
export const createHunterAlgorithm = createUnifiedAlgorithm;
