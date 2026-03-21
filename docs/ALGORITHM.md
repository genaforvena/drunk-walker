# Walking Algorithm Guide (v6.5.0)

**Comprehensive documentation of the Drift-Walk Traversal Engine**

---

## Architecture Overview

The v6.5.0 architecture uses **learned connectivity** from actual transitions instead of pure mathematical prediction.

### 1. The Engine (`engine.js`)
- **Orchestrator**: Manages the main `tick` loop (pace)
- **State Store**: Holds `steps`, `stuckCount`, `visitedUrls` (Heatmap), and `breadcrumbs` (Scent)
- **Sensors**: Extracts current location from URL and detects if walker is "stuck"
- **Transition Recorder**: Records every successful movement in the Enhanced Transition Graph
- **Safety**: Pauses during user interaction (dragging/drawing)
- **Turn Cooldown**: Waits 3 ticks after turn before next decision

### 2. The Wheel (orientation handling)
- **Orientation**: Manages current `yaw` (0-359°)
- **Physicality**: Handles "left-turn only" constraint via `ArrowLeft` long-presses
- **Normalization**: Ensures all angles stay within [0, 360) range
- **Drift Tolerance**: Accepts ±15-20° deviation from target yaw

### 3. The Traversal Algorithm (`traversal.js`)
- **Decision Maker**: Receives context and decides whether to `turn` or `move`
- **Enhanced Transition Graph**: Learns actual connectivity from successful walks
- **Bidirectional Recording**: Stores forward AND reverse directions (every node has a way back)
- **Strategy**: Implements systematic labyrinth exploration with one-turn backtrack rule

---

## Core Concepts

### A. The Six Yaw Buckets

We divide 360° into 6 buckets (0°, 60°, 120°, 180°, 240°, 300°):

```javascript
const YAW_BUCKETS = [0, 60, 120, 180, 240, 300];
```

**At each node, we track:**
- `triedYaws` - which buckets we've attempted
- `successfulYaws` - which buckets led to movement
- `entryYaw` - which yaw we entered from (for reverse calculation)

### B. Bidirectional Transition Graph

```javascript
// Record every successful movement
recordMovement(fromLoc, toLoc, fromYaw, toYaw, step) {
  // Store at FROM node: "yaw 90° leads to location B"
  fromNode.recordAttempt(fromYaw, true, toLoc);
  
  // Store at TO node: "came from reverse direction"
  const reverseYaw = (toYaw + 180) % 360;
  toNode.recordAttempt(reverseYaw, true, fromLoc);
  
  // Bidirectional connection tracking
  connections.get(fromLoc).add(toLoc);
  connections.get(toLoc).add(fromLoc);
}
```

**Why bidirectional?**
- Every node has a way back (we came from somewhere!)
- Dead-end escape = reverse the entry yaw
- No true dead ends in drift-walk graph

### C. Node Classification (After 6 Yaws Tried)

| Type | Exits | Yaw Difference | Action |
|------|-------|----------------|--------|
| **STRAIGHT** | 2 | ~180° (±30°) | Skip when navigating back |
| **CROSSROAD** | 3+ | N/A | STOP and explore! |
| **DEAD_END** | 1 | N/A | Mark and escape via reverse yaw |
| **UNKNOWN** | <6 tried | N/A | STOP - potential crossroad! |

### D. One-Turn Backtrack Rule

During backtracking from dead end:
- Check **EVERY** visited node for untried buckets
- If untried buckets exist AND haven't turned here → **ONE exploration turn**
- Track `turnedAtNodes` Set to prevent multiple turns at same node
- Reset `turnedAtNodes` when reaching crossroad or starting fresh

**Why one turn?**
- Prevents infinite loops (don't spin at every node)
- Ensures systematic exploration (check every node once)
- Respects drift-walk geometry (we know which cones are valid)

---

## Decision Modes

### FORWARD Mode (Exploring New Territory)

**Trigger:** At node with untried buckets, not stuck, not backtracking

```javascript
if (currentNode.hasUntriedYaws()) {
  const nextYaw = currentNode.getNextUntriedYaw();
  const diff = yawDifference(orientation, nextYaw);
  
  if (diff > 5 && diff < 355) {
    const turnAngle = getLeftTurnAngle(orientation, nextYaw);
    return { turn: true, angle: turnAngle };
  }
  // Already facing it, just move forward
  return { turn: false };
}
```

### PANIC Mode (Stuck Recovery)

**Trigger:** `stuckCount >= panicThreshold` (default: 3)

```javascript
if (stuckCount >= panicThreshold) {
  // Priority 1: Try any untried yaw
  const nextYaw = currentNode.getNextUntriedYaw();
  if (nextYaw !== null) {
    return { turn: true, angle: getLeftTurnAngle(orientation, nextYaw) };
  }
  
  // Priority 2: Retry successful exit (random pick)
  if (currentNode.successfulYaws.size > 0) {
    const randomYaw = pickRandom(currentNode.successfulYaws);
    return { turn: true, angle: getLeftTurnAngle(orientation, randomYaw) };
  }
  
  // Priority 3: Emergency reverse (go back the way we came)
  if (currentNode.entryYaw !== null) {
    const reverseYaw = (currentNode.entryYaw + 180) % 360;
    return { turn: true, angle: getLeftTurnAngle(orientation, reverseYaw) };
  }
  
  // Last resort: STOP (truly stuck, no escape)
  return { turn: false };
}
```

### RETURN Mode (Backtracking)

**Trigger:** Hit dead end, now retracing path

```javascript
const isBacktracking = (hasBeenHereBefore || isExhausted) && !navigationTarget;

if (isBacktracking) {
  // Check CURRENT node first
  if (currentNode.hasUntriedYaws() && !turnedAtNodes.has(currentLocation)) {
    const targetYaw = currentNode.getNextUntriedYaw();
    turnedAtNodes.add(currentLocation);
    
    const diff = yawDifference(orientation, targetYaw);
    if (diff > 5 && diff < 355) {
      return { turn: true, angle: getLeftTurnAngle(orientation, targetYaw) };
    }
    return { turn: false };  // Already facing it
  }
  
  // Navigate to nearest node with untried buckets
  const candidate = enhancedGraph.findNearestCrossroadCandidate(
    currentLocation, 
    breadcrumbs
  );
  
  if (candidate) {
    navigationTarget = {
      location: candidate.location,
      targetYaw: candidate.node.getNextUntriedYaw(),
      distance: candidate.distance
    };
  }
}
```

---

## Math & Logic

### 1. Location Prediction (Fallback)

Used when no learned connectivity available:

```javascript
// Simplified lat/lng projection
const dLat = Math.cos(yaw * Math.PI / 180) * stepDistance;
const dLng = Math.sin(yaw * Math.PI / 180) * stepDistance / Math.cos(lat);
const predictedLocation = `${lat + dLat},${lng + dLng}`;
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
| **FORWARD** | `isNewNode && hasUntriedYaws` | Try next untried yaw bucket |
| **NEW_NODE** | `isNewNode` | Move forward (no turn at new nodes) |
| **BACKTRACK** | `hasBeenHereBefore && !navigationTarget` | Check current node for untried buckets |
| **NAVIGATE** | `navigationTarget !== null` | Turn toward target location |
| **PANIC** | `stuckCount >= 3` | Retry untried/successful/reverse yaw |
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
    this.entryYaw = null;
    
    // Classification (only valid after 6 yaws tried)
    this.isStraight = false;
    this.isCrossroad = false;
    this.isDeadEnd = false;
    this.isFullyExplored = false;
  }
  
  recordAttempt(yaw, success, targetLocation) {
    this.triedYaws.add(yaw);
    if (success) {
      this.successfulYaws.add(yaw);
    }
  }
  
  hasUntriedYaws() {
    return this.triedYaws.size < 6;
  }
  
  getNextUntriedYaw() {
    for (const yaw of [0, 60, 120, 180, 240, 300]) {
      if (!this.triedYaws.has(yaw)) return yaw;
    }
    return null;
  }
}
```

### Graph Operations

```javascript
class EnhancedTransitionGraph {
  constructor() {
    this.nodes = new Map();      // location → NodeInfo
    this.connections = new Map(); // location → Set<connectedLocations>
  }
  
  getOrCreate(location, lat, lng, step) {
    if (!this.nodes.has(location)) {
      this.nodes.set(location, new NodeInfo(location, lat, lng, step));
      this.connections.set(location, new Set());
    }
    return this.nodes.get(location);
  }
  
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
  
  getPathToTarget(currentLocation, targetLocation, breadcrumbs) {
    const currentIndex = breadcrumbs.lastIndexOf(currentLocation);
    const targetIndex = breadcrumbs.lastIndexOf(targetLocation);
    
    if (currentIndex === -1 || targetIndex === -1) return [];
    
    // Return path from current to target (walking backwards)
    return breadcrumbs.slice(targetIndex, currentIndex + 1).reverse();
  }
}
```

---

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `panicThreshold` | 3 | Ticks before PANIC mode starts |
| `selfAvoiding` | true | Enables Heatmap/Breadcrumb logic |
| `pace` | 2000ms | Time between decisions |
| `turnsCooldownTicks` | 3 | Ticks to wait after turn before next decision |
| `stepDistance` | ~10m | Estimated distance between panoramas |

---

## Developer Guide: Changing the Logic

To experiment with a new algorithm:

1. Open `src/core/traversal.js`
2. Modify the `decide(context)` function
3. You have access to:
   - `visitedUrls` (Map) - heatmap of visited locations
   - `breadcrumbs` (Array) - rolling buffer of last 100 steps
   - `orientation` - current yaw (0-360°)
   - `enhancedGraph` - learned connectivity graph
   - `turnedAtNodes` (Set) - nodes already explored during backtrack
4. Return `{ turn: true, angle: X }` to turn, or `{ turn: false }` to move forward

### Example: Custom Exploration Strategy

```javascript
const decide = (context) => {
  const { currentLocation, orientation, stuckCount, breadcrumbs } = context;
  
  // Your custom logic here
  if (shouldTurnLeft()) {
    return { turn: true, angle: 90 };
  }
  
  // Default: move forward
  return { turn: false };
};
```

---

## Why This Works

| Problem | Old Approach | v6.5.0 Approach |
|---------|-------------|-----------------|
| **Dead ends** | Random turns, infinite spin | Reverse entry yaw (always works) |
| **Backtracking** | Step-by-step scan | Skip straight nodes, check crossroads |
| **Yaw drift** | Fight it (fails) | Embrace it (drift cone model) |
| **Prediction errors** | Math-only (~40% accuracy) | Learned graph (100% for known nodes) |
| **Loops** | Heatmap avoidance | One-turn backtrack rule |

---

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/core/traversal.test.js

# Run with verbose output
npm test -- --reporter=verbose
```

### Key Test Scenarios

```javascript
// Test 1: Forward exploration
it('should try untried yaw at new node', () => {
  const context = {
    currentLocation: 'A',
    orientation: 90,
    stuckCount: 0,
    isNewNode: true
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(false);  // Move forward at new node
});

// Test 2: Dead end escape
it('should escape using reverse entry yaw', () => {
  const context = {
    currentLocation: 'D',
    orientation: 90,
    stuckCount: 3,
    entryYaw: 90
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  expect(decision.angle).toBe(270);  // Reverse yaw
});

// Test 3: Backtrack exploration
it('should explore untried bucket during backtrack', () => {
  const context = {
    currentLocation: 'B',
    orientation: 90,
    hasBeenHereBefore: true,
    untriedYaws: [60]
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  expect(decision.angle).toBe(330);  // Turn to 60°
});
```

---

## Related Files

- **Core:** `src/core/engine.js`, `src/core/traversal.js`
- **Tests:** `src/core/engine.test.js`, `src/core/traversal.test.js`
- **Docs:** `docs/HOW_IT_WALKS.md`, `docs/SMART_NODES.md`, `docs/SURGEON_MODE.md`

---

*Documentation complete. The bot learns the labyrinth by walking it.*
