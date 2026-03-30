/**
 * Traversal Algorithm v6.1.5 - PURE PLEDGE Wall-Following
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
 * Calculate angle to turn LEFT (counter-clockwise) to reach targetYaw from currentYaw
 * 
 * Example: Current=250°, Target=319°
 * - Left turn: 319 - 250 = 69° (counter-clockwise)
 * - Right turn: 360 - 69 = 291° (clockwise)
 * - This function returns: 69°
 */
function getLeftTurnAngle(currentYaw, targetYaw) {
  // LEFT turn (counter-clockwise) = current - target
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

    // Record reverse direction at toNode (geometric direction back to where we came from)
    // Calculate from coordinates, NOT from toYaw (which is Google's camera orientation after landing)
    const fromParts = fromLoc.split(',').map(Number);
    const toParts = toLoc.split(',').map(Number);
    const dLat = fromParts[0] - toParts[0];  // FROM neighbor TO current
    const dLng = fromParts[1] - toParts[1];
    let reverseYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
    if (reverseYaw < 0) reverseYaw += 360;
    reverseYaw = Math.round(reverseYaw);
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
 * PURE PLEDGE ALGORITHM v6.1.5
 */
export function createUnifiedAlgorithm(cfg) {
  const panicThreshold = cfg.panicThreshold || 3;

  // PLEDGE state
  let wallFollowMode = false;
  let wallFollowBearing = null;
  let forwardBearing = null;
  let deadPocketCount = 0;  // Track dead pocket detections before restart

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
    // 🧭 SMOOTH FORWARD BEARING: Use rolling window of 3 breadcrumbs
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
    // EXCEPTION: When justArrived, always update to current movement bearing
    // ═══════════════════════════════════════════════════════════
    if (committedDirection === null) {
      committedDirection = currentForwardBearing;
    } else if (justArrived && !isNewNode) {
      // Just moved successfully - update committed direction to match actual movement
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
      // ═══════════════════════════════════════════════════════════
      // 🧭 CAMERA ALIGNMENT: Keep camera aligned with direction
      // Reduced threshold from 60° to 40° for better curve tracking
      // This prevents large corrective turns later (e.g., 78° at node 26)
      // ═══════════════════════════════════════════════════════════
      const bearingDiff = yawDifference(orientation, effectiveBearing);
      if (bearingDiff > 40 && bearingDiff < 150) {
        console.log(`🧭 NEW NODE: Aligning camera to effective bearing ${Math.round(effectiveBearing)}° (diff=${Math.round(bearingDiff)}°)`);
        const turnAngle = getLeftTurnAngle(orientation, effectiveBearing);
        const turnDirection = getTurnDirection(orientation, effectiveBearing);
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }

      // Note: Perpendicular scan removed - wall-follow already catches missed branches
      // Scans were causing wasted turns on straight roads (e.g., 6° micro-turns)

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
    // 🔄 WALL-FOLLOW MODE: Scan for LEFT exits ONLY (90-180° from forward)
    // Pure PLEDGE: Only check left side, never right side or forward
    // ═══════════════════════════════════════════════════════════
    if (wallFollowMode && currentNode.hasUntriedYaws()) {
      const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));

      // Find leftmost untried yaw (90-180° LEFT from forward bearing)
      // ONLY consider LEFT exits - no fallback to forward/right yaws!
      let bestYaw = null;
      let bestDiff = 90;

      for (const yaw of untriedYaws) {
        const diff = yawDifference(forwardBearing, yaw);
        if (diff >= 90 && diff <= 180 && diff > bestDiff) {
          bestDiff = diff;
          bestYaw = yaw;
        }
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
      // No LEFT exit found - continue backtracking (don't try forward/right yaws!)
    }

    // In wall-follow mode: face wall-follow bearing and move
    // During backtracking, just go back where we came from (reverse direction)
    // Don't try other yaws - just press ArrowUp to continue backtracking!
    if (wallFollowMode && wallFollowBearing !== null) {
      // Face the wall-follow bearing (backtracking direction)
      const diff = yawDifference(orientation, wallFollowBearing);
      if (diff > 10) {
        console.log(`🧱 WALL-FOLLOW: Turning to face bearing ${Math.round(wallFollowBearing)}° (diff=${Math.round(diff)}°)`);
        const turnAngle = getLeftTurnAngle(orientation, wallFollowBearing);
        const turnDirection = getTurnDirection(orientation, wallFollowBearing);
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
      // Facing correct direction - check if we're actually stuck
      // CRITICAL: Check stuck FIRST before isExhausted!
      // If stuck with untried yaws, try them immediately to escape loops
      if (stuckCount >= 1 && !isExhausted) {
        const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
        if (untriedYaws.length > 0) {
          const nextYaw = untriedYaws[0];
          console.log(`🧱 WALL-FOLLOW: Stuck! Trying untried yaw ${nextYaw}° to escape`);
          const turnAngle = getLeftTurnAngle(orientation, nextYaw);
          const turnDirection = getTurnDirection(orientation, nextYaw);
          consecutiveStraightMoves = 0;
          lastDecisionWasTurn = true;
          return { turn: true, angle: turnAngle, direction: turnDirection };
        }
      }
      // If all yaws tried, fall through to BREAK_WALL
      if (isExhausted) {
        console.log(`🧱 WALL-FOLLOW: All yaws exhausted at dead end - breaking wall to escape!`);
        // Fall through to BREAK_WALL logic below
      } else {
        // Still have untried yaws - just press ArrowUp to continue backtracking
        console.log(`🧱 WALL-FOLLOW: Backtracking (press ArrowUp)`);
        return { turn: false };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🔥 DEAD POCKET DETECTION: Check if ALL neighbors are fully explored
    // If so, we're trapped in an exhausted component
    // After 3 detections, RESTART with fresh graph
    // ═══════════════════════════════════════════════════════════
    if (isExhausted && currentNode.successfulYaws.size > 0) {
      const neighbors = enhancedGraph.connections.get(currentLocation);
      if (neighbors && neighbors.size > 0) {
        let allNeighborsDead = true;
        for (const neighbor of neighbors) {
          const neighborNode = enhancedGraph.get(neighbor);
          if (neighborNode && !neighborNode.isFullyExplored) {
            allNeighborsDead = false;
            break;
          }
        }

        if (allNeighborsDead) {
          deadPocketCount++;
          console.log(`🔥 DEAD POCKET DETECTED! All ${neighbors.size} neighbors fully explored (${deadPocketCount}/3)`);

          if (deadPocketCount >= 3) {
            console.log(`🔥 DEAD POCKET ESCAPE: Component exhausted! RESTARTING exploration...`);
            console.log(`   Clearing graph memory to find new territory...`);

            // Clear the graph - start fresh
            enhancedGraph.nodes.clear();
            enhancedGraph.connections.clear();

            // Reset PLEDGE state
            wallFollowMode = false;
            wallFollowBearing = null;
            forwardBearing = null;
            deadPocketCount = 0;
            committedDirection = null;
            consecutiveStraightMoves = 0;

            console.log(`   ✅ Graph cleared! Next move will start fresh exploration`);

            // Force a random yaw to break out
            const randomYaw = [0, 60, 120, 180, 240, 300][Math.floor(Math.random() * 6)];
            const turnAngle = getLeftTurnAngle(orientation, randomYaw);
            const turnDirection = getTurnDirection(orientation, randomYaw);
            return { turn: true, angle: turnAngle, direction: turnDirection };
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 🚨 BREAK THE WALL: When truly stuck (retry successful yaw)
    // Used when:
    // 1. FORWARD mode: all yaws exhausted, escape Street View jitter
    // 2. WALL-FOLLOW mode: stuck at dead end with no backtracking exit
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
    // 🚨 FALLBACK: successfulYaws is empty but we must have gotten in somehow
    // Use graph connections to find where we came from and try reverse yaw
    // This is the ultimate escape - graph remembers connections even if successfulYaws doesn't
    // ═══════════════════════════════════════════════════════════
    if (isExhausted && currentNode.successfulYaws.size === 0) {
      const neighbors = enhancedGraph.connections.get(currentLocation);
      if (neighbors && neighbors.size > 0) {
        // Get the most recent neighbor (where we likely came from)
        const neighborLoc = Array.from(neighbors)[0];
        // Calculate yaw FROM current TO neighbor (reverse direction - where we came from)
        const currentParts = currentLocation.split(',').map(Number);
        const neighborParts = neighborLoc.split(',').map(Number);
        const dLat = neighborParts[0] - currentParts[0];  // TO neighbor
        const dLng = neighborParts[1] - currentParts[1];
        let reverseYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
        if (reverseYaw < 0) reverseYaw += 360;
        reverseYaw = Math.round(reverseYaw);

        console.log(`🚨 BREAK WALL: No successfulYaws, using reverse yaw ${reverseYaw}° from graph`);
        const turnAngle = getLeftTurnAngle(orientation, reverseYaw);
        const turnDirection = getTurnDirection(orientation, reverseYaw);
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        wallFollowMode = false;
        wallFollowBearing = null;
        forwardBearing = null;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }
      // No graph connections either - try any yaw as last resort
      console.log(`🚨 BREAK WALL: No graph connections, trying random yaw`);
      const randomYaw = [0, 60, 120, 180, 240, 300][Math.floor(Math.random() * 6)];
      const turnAngle = getLeftTurnAngle(orientation, randomYaw);
      const turnDirection = getTurnDirection(orientation, randomYaw);
      return { turn: true, angle: turnAngle, direction: turnDirection };
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD MODE: At node with untried yaws - try them
    // Pick untried yaw closest to effective bearing (committed direction)
    // If stuck (stuckCount >= 1), try ANY untried yaw regardless of angle
    // Otherwise only turn if reasonable (<90°) to avoid massive realignments
    // ═══════════════════════════════════════════════════════════
    if (currentNode.hasUntriedYaws()) {
      const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));

      // If stuck, try first untried yaw immediately (no angle checks)
      if (stuckCount >= 1) {
        const nextYaw = untriedYaws[0];
        const turnAngle = getLeftTurnAngle(orientation, nextYaw);
        const turnDirection = getTurnDirection(orientation, nextYaw);
        console.log(`🔍 STUCK! Trying untried yaw ${nextYaw}° (turn ${Math.round(turnAngle)}° ${turnDirection})`);
        consecutiveStraightMoves = 0;
        lastDecisionWasTurn = true;
        return { turn: true, angle: turnAngle, direction: turnDirection };
      }

      // Not stuck - find untried yaw closest to EFFECTIVE BEARING
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
        // 🎯 YAW ALIGNMENT: Only turn if angle is reasonable (<90°)
        // Prevents massive realignments that waste time and cause stuck detection
        // Also use ±20° tolerance to avoid micro-adjustments
        // ═══════════════════════════════════════════════════════════
        const diff = yawDifference(orientation, nextYaw);
        if (diff > 20 && diff < 90) {
          console.log(`🔍 FORWARD: Trying yaw ${nextYaw}° (diff=${Math.round(diff)}° from orientation, ${Math.round(bestDiff)}° from effective bearing)`);
          const turnAngle = getLeftTurnAngle(orientation, nextYaw);
          const turnDirection = getTurnDirection(orientation, nextYaw);
          consecutiveStraightMoves = 0;
          lastDecisionWasTurn = true;
          linearSegmentStart = null;
          return { turn: true, angle: turnAngle, direction: turnDirection };
        } else if (diff <= 20) {
          console.log('[DEBUG] Already facing target yaw (within ±20° tolerance), moving forward');
          return { turn: false };
        } else {
          // Turn too large (>90°) - don't realign, just go straight
          console.log(`[DEBUG] Skipping yaw ${nextYaw}° alignment - turn too large (${Math.round(diff)}° > 90°)`);
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
    enhancedGraph
  };
}

export const createDefaultAlgorithm = createUnifiedAlgorithm;
export const createExplorationAlgorithm = createUnifiedAlgorithm;
export const createSurgicalAlgorithm = createUnifiedAlgorithm;
export const createHunterAlgorithm = createUnifiedAlgorithm;
