# Walking Algorithm Guide (v6.1.5 PLEDGE)

**Comprehensive documentation of the PLEDGE Wall-Following Traversal Engine**

---

## Architecture Overview

The v6.1.5 PLEDGE algorithm uses **systematic wall-following** for guaranteed maze exploration with each node visited **at most twice**.

### v6.1.5 Changes

**Territory Oracle System:**
- Mock Street View for deterministic algorithm testing
- All changes verified against actual walk data
- Walk-driven development workflow

**Wall-Follow Loop Detection:**
- Track nodes visited during wall-follow phase
- Break out when loop detected (visiting same node twice)
- Prevents infinite loops in cyclic territories

### Core Principles

1. **Forward First**: Always explore new territory before backtracking
2. **Left-Hand Rule**: When stuck, follow the left wall
3. **Break Wall**: When truly stuck, retry any successful exit
4. **No Breadcrumbs**: Pure PLEDGE - no navigation to old targets

### 1. The Engine (`engine.js`)
- **Orchestrator**: Manages the main `tick` loop (pace)
- **State Store**: Holds `steps`, `stuckCount`, `visitedUrls` (Set)
- **Sensors**: Extracts current location from URL and detects if walker is "stuck"
- **Transition Graph**: Records every successful movement
- **Safety**: Pauses during user interaction (dragging/drawing)
- **Turn Cooldown**: Waits 3 ticks after turn before next decision

### 2. The Wheel (orientation handling)
- **Orientation**: Manages current `yaw` (0-359°)
- **Physicality**: Handles "left-turn only" constraint via `ArrowLeft` long-presses
- **Normalization**: Ensures all angles stay within [0, 360) range
- **Drift Tolerance**: Accepts ±15-20° deviation from target yaw

### 3. The Traversal Algorithm (`traversal.js`)
- **PLEDGE Implementation**: Wall-following with forward-facing
- **Forward Bearing**: Always face direction of travel (prev→cur)
- **Dead-End Detection**: All 6 yaws tried → turn LEFT 105°
- **Wall-Follow Mode**: Scan for left exits (90-180° from forward)
- **Loop Detection**: Track nodes visited during wall-follow phase
- **Break-Wall Escape**: Retry successful yaw when truly stuck

---

## PLEDGE Algorithm States

```
┌─────────────────────────────────────────────────────────┐
│  PLEDGE STATE MACHINE                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FORWARD MODE:                                          │
│  • Face: prev→cur bearing                               │
│  • Move: Forward into new territory                     │
│  • Check: Cul-de-sac verification at 10+ straight nodes │
│                                                         │
│  ↓ (Hit dead end - all yaws tried)                      │
│                                                         │
│  TURN LEFT:                                             │
│  • Turn: 105° LEFT from forward bearing                 │
│  • Face: Left wall, slightly back                       │
│                                                         │
│  ↓                                                      │
│                                                         │
│  WALL-FOLLOW MODE:                                      │
│  • Scan: Left exits (90-180° from forward)              │
│  • At each node: Check for untried left yaw             │
│  • Found exit: Take it, resume FORWARD mode             │
│                                                         │
│  ↓ (Truly stuck - no exits found)                       │
│                                                         │
│  BREAK WALL:                                            │
│  • Retry: Random successful yaw                         │
│  • Reset: Wall-follow state                             │
│  • Escape: The dead end                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### A. Forward Bearing

**Definition**: Direction of travel from previous node to current node.

```javascript
// Calculate forward bearing from prev→cur
const dLat = currentLat - prevLat;
const dLng = currentLng - prevLng;
const forwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
```

**Usage**:
- At new nodes: Turn to face forward bearing (if diff >15°)
- In wall-follow: Reference for left exits (90-180° from forward)

### B. The Six Yaw Buckets

We divide 360° into 6 buckets (0°, 60°, 120°, 180°, 240°, 300°):

```javascript
const YAW_BUCKETS = [0, 60, 120, 180, 240, 300];
```

**At each node, we track:**
- `triedYaws` - which buckets we've attempted
- `successfulYaws` - which buckets led to movement
- `isFullyExplored` - all 6 yaws tried (5+ = dead end)

### C. Node Classification

| Type | Tried Yaws | Action |
|------|------------|--------|
| **NEW** | 0-4 | Go straight, face forward bearing |
| **JUNCTION** | 2-4 untried | Potential left exit in wall-follow |
| **DEAD_END** | 6 (all tried) | Turn LEFT 105°, start wall-follow |
| **FULLY_EXPLORED** | 6 (all tried) | Skip in wall-follow scan |

### D. Each Node ≤2 Visits Guarantee

**Why it works:**
1. **First visit**: Forward mode, explore straight
2. **If dead end**: Turn LEFT, wall-follow backward
3. **Second visit**: Scan for left exit, take if found
4. **No exit**: Continue wall-follow, never return

---

## Decision Modes

### FORWARD Mode (Exploring New Territory)

**Trigger:** At new node with untried buckets

```javascript
if (isNewNode) {
  // Calculate forward bearing from prev→cur
  const forwardBearing = calculateForwardBearing(previousLocation, currentLocation);
  
  // Face forward direction (if not already)
  const bearingDiff = yawDifference(orientation, forwardBearing);
  if (bearingDiff > 15 && bearingDiff < 165) {
    return { turn: true, angle: getLeftTurnAngle(orientation, forwardBearing) };
  }
  
  // Cul-de-sac verification at 10+ straight new nodes
  if (consecutiveStraightMoves >= 10 && currentNode.hasUntriedYaws()) {
    const sideYaw = findSideYaw(forwardBearing, currentNode.triedYaws);
    if (sideYaw !== null) {
      return { turn: true, angle: getLeftTurnAngle(orientation, sideYaw) };
    }
  }
  
  // Continue forward
  return { turn: false };
}
```

### DEAD_END Detection (Start Wall-Follow)

**Trigger:** All yaws tried, node fully explored

```javascript
const isDeadEnd = isExhausted && fullyExploredNodes.has(currentLocation);

if (isDeadEnd && !wallFollowMode) {
  wallFollowMode = true;
  forwardBearing = currentForwardBearing;
// Turn 105° LEFT from forward direction
   wallFollowBearing = (forwardBearing + 105) % 360;
  
  return { turn: true, angle: getLeftTurnAngle(orientation, wallFollowBearing) };
}
```

### WALL-FOLLOW Mode (Left-Hand Rule)

**Trigger:** `wallFollowMode === true`

**Loop Detection:** Track nodes visited during current wall-follow phase to detect cycles.

```javascript
// Track nodes visited during wall-follow phase
let wallFollowNodes = new Set();

if (wallFollowMode && currentNode.hasUntriedYaws()) {
  const untriedYaws = [0, 60, 120, 180, 240, 300]
    .filter(y => !currentNode.triedYaws.has(y));

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

  // Found left exit! Take it and resume FORWARD mode
  if (bestYaw !== null) {
    wallFollowMode = false;
    wallFollowBearing = null;
    forwardBearing = null;
    committedDirection = bestYaw;  // Preserve exit direction
    wallFollowNodes.clear();  // Reset loop tracking
    return { turn: true, angle: getLeftTurnAngle(orientation, bestYaw) };
  }
}

// Loop detection: arrived at visited, fully-explored node during wall-follow
if (wallFollowMode && !isNewNode && currentNode.isFullyExplored) {
  if (wallFollowNodes.has(currentLocation)) {
    // LOOP DETECTED! Break out using BREAK_WALL
    console.log(`🚨 WALL-FOLLOW LOOP! Breaking out...`);
    wallFollowMode = false;
    wallFollowBearing = null;
    // Fall through to BREAK_WALL logic
  }
  wallFollowNodes.add(currentLocation);
}

// Continue wall-follow: face wall-follow bearing
if (wallFollowMode && wallFollowBearing !== null) {
  const diff = yawDifference(orientation, wallFollowBearing);
  if (diff > 10) {
    return { turn: true, angle: getLeftTurnAngle(orientation, wallFollowBearing) };
  }
  
  // Check if stuck (ArrowUp failed) - try untried yaws
  if (stuckCount >= 1 && currentNode.hasUntriedYaws()) {
    const nextYaw = untriedYaws[0];
    return { turn: true, angle: getLeftTurnAngle(orientation, nextYaw) };
  }
  
  return { turn: false };  // First attempt - press ArrowUp
}
```

### BREAK WALL (Escape Truly Stuck)

**Trigger:** All yaws tried, wall-follow found no exits

```javascript
if (isExhausted && fullyExploredNodes.has(currentLocation) && 
    currentNode.successfulYaws.size > 0) {
  const successfulYawsArray = Array.from(currentNode.successfulYaws);
  const randomSuccessfulYaw = successfulYawsArray[
    Math.floor(Math.random() * successfulYawsArray.length)
  ];
  
  // Reset wall-follow state
  wallFollowMode = false;
  wallFollowBearing = null;
  forwardBearing = null;
  
  return { turn: true, angle: getLeftTurnAngle(orientation, randomSuccessfulYaw) };
}
```

---

## Math & Logic

### 1. Forward Bearing Calculation

```javascript
function calculateForwardBearing(prevLoc, currLoc) {
  const prevParts = prevLoc.split(',').map(Number);
  const currParts = currLoc.split(',').map(Number);
  const dLat = currParts[0] - prevParts[0];
  const dLng = currParts[1] - prevParts[1];
  let bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
  if (bearing < 0) bearing += 360;
  return bearing;
}
```

### 2. Angle Normalization

```javascript
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}
```

### 3. Left Turn Angle Calculation

```javascript
function getLeftTurnAngle(currentOrientation, targetYaw) {
  let diff = targetYaw - currentOrientation;

  // Normalize to [-180, 180]
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Convert to left-turn angle (positive = turn left)
  if (diff < 0) diff += 360;

  return diff;
}
```

**Example:**
- Current: 350°, Target: 10°
- Diff: 10 - 350 = -340 → +360 = 20°
- **Turn 20° left** (not 340° right!)

### 4. Yaw Difference

```javascript
function yawDifference(a, b) {
  let diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
```

---

## State Machine

| State | Context | Decision |
|-------|---------|----------|
| **FORWARD** | `isNewNode && hasUntriedYaws` | Face forward, move straight |
| **CUL-DE-SAC-CHECK** | `isNewNode && consecutiveStraightMoves >= 10` | Verify with side exit |
| **DEAD-END-TURN** | `isExhausted && fullyExplored && !wallFollowMode` | Turn LEFT 105° |
| **WALL-FOLLOW** | `wallFollowMode === true` | Scan for left exits (90-180°) |
| **BREAK-WALL** | `isExhausted && successfulYaws.size > 0` | Retry random successful yaw |
| **STUCK** | `all buckets tried, no successful exits` | STOP (no escape route) |

---

## Enhanced Transition Graph

### NodeInfo Class

```javascript
class NodeInfo {
  constructor(location, lat, lng, step) {
    this.location = location;
    this.lat = lat;
    this.lng = lng;
    this.step = step;

    // Yaw tracking
    this.triedYaws = new Set();
    this.successfulYaws = new Set();

    // Classification
    this.isFullyExplored = false;
  }

  recordAttempt(yaw, success) {
    this.triedYaws.add(yaw);
    if (success) {
      this.successfulYaws.add(yaw);
    }
    // Mark as fully explored when 5+ yaws tried (pragmatic optimization)
    // Street View nodes typically have 2-4 exits, not 6
    // After 5 yaws, the 6th is unlikely to succeed
    if (this.triedYaws.size >= 5) {
      this.isFullyExplored = true;
    }
  }

  hasUntriedYaws() {
    return this.triedYaws.size < 6;
  }
}
```

**Note on `isFullyExplored` threshold:**

The threshold of 5 yaws (not 6) is a **pragmatic optimization**:
- Street View nodes typically have 2-4 exits, not 6
- After trying 5 yaws, the 6th is unlikely to succeed
- Prevents wasting ticks on exhaustive scanning
- Still allows escape via BREAK_WALL (uses `successfulYaws`)

---

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `panicThreshold` | 3 | Ticks before BREAK WALL mode |
| `selfAvoiding` | true | Enables visited tracking |
| `pace` | 2000ms | Time between decisions |
| `turnsCooldownTicks` | 3 | Ticks to wait after turn |
| `stepDistance` | ~10m | Estimated distance between panoramas |
| `forwardFaceThreshold` | 15° | Turn to face forward if diff >15° |
| `culDeSacCheckThreshold` | 10 | Verify at 10+ straight new nodes |

---

## Developer Guide: Changing the Logic

To experiment with a new algorithm:

1. Open `src/core/traversal.js`
2. Modify the `decide(context)` function
3. You have access to:
   - `visitedUrls` (Set) - visited locations
   - `breadcrumbs` (Array) - rolling buffer of last 200 steps
   - `orientation` - current yaw (0-360°)
   - `enhancedGraph` - learned connectivity graph
   - `wallFollowMode` - current wall-follow state
   - `forwardBearing` - direction of travel
4. Return `{ turn: true, angle: X }` to turn, or `{ turn: false }` to move forward

### Example: Custom Wall-Follow Angle

```javascript
const decide = (context) => {
  const { currentLocation, orientation, stuckCount, breadcrumbs } = context;

// Example: Change wall-follow turn angle from 105° to 115°
   if (isDeadEnd && !wallFollowMode) {
     wallFollowBearing = (forwardBearing + 115) % 360;  // Was 105°
     return { turn: true, angle: getLeftTurnAngle(orientation, wallFollowBearing) };
   }

  // Default PLEDGE logic
  return pledgeDecide(context);
};
```

---

## Why This Works

| Problem | Old Approach | PLEDGE Approach |
|---------|-------------|-----------------|
| **Dead ends** | Random turns, infinite spin | Turn LEFT 105°, wall-follow |
| **Backtracking** | Step-by-step scan | Wall-follow with left-hand rule |
| **Yaw drift** | Fight it (fails) | Face forward bearing at each node |
| **False cul-de-sacs** | Missed branches | Verification at 10+ straight nodes |
| **Loops** | Heatmap avoidance | Each node ≤2 visits guarantee |
| **Truly stuck** | No escape | BREAK WALL retries successful exits |

---

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/core/log-replay.test.js

# Run with verbose output
npm test -- --reporter=verbose
```

### Key Test Scenarios

```javascript
// Test 1: Forward exploration with facing
it('should face forward bearing at new node', () => {
  const context = {
    currentLocation: 'A',
    previousLocation: 'B',
    orientation: 90,
    stuckCount: 0,
    isNewNode: true
  };
  const decision = algorithm.decide(context);
  // Should turn to face forward bearing if not aligned
});

// Test 2: Dead end detection and wall-follow start
it('should turn LEFT 120° at dead end', () => {
  const context = {
    currentLocation: 'D',
    orientation: 90,
    stuckCount: 0,
    isExhausted: true,
    fullyExplored: true
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  // Should turn LEFT ~105° from forward bearing
});

// Test 3: Wall-follow left exit detection
it('should find and take left exit in wall-follow mode', () => {
  const context = {
    currentLocation: 'B',
    orientation: 210,
    wallFollowMode: true,
    forwardBearing: 90,
    untriedYaws: [180]  // 90° LEFT from forward
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  // Should take yaw 180° (left exit)
});

// Test 4: Cul-de-sac verification
it('should verify at 10+ straight new nodes', () => {
  const context = {
    currentLocation: 'K',
    orientation: 180,
    isNewNode: true,
    consecutiveStraightMoves: 10,
    untriedYaws: [60, 120]
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  // Should check side exit
});
```

---

## Related Files

- **Core:** `src/core/engine.js`, `src/core/traversal.js`
- **Tests:** `src/core/engine.test.js`, `src/core/log-replay.test.js`
- **Docs:** `docs/HOW_IT_WALKS.md`

---

*Documentation complete. The bot explores by following the left wall.*
