# How the Bot Walks: Drift-Walk Navigation in Street View

**Version:** 6.5.0  
**Last Updated:** 2026-03-21  
**Goal:** Understand the fundamental mechanics of blind graph traversal in Google Street View

---

## 🎯 The Core Problem

Google Street View is a **graph of 360° panoramas** connected by invisible edges. To move:

1. You must be pointing **almost exactly** at the next panorama
2. You press `ArrowUp` to "walk" in that direction
3. If you're not aligned correctly, nothing happens (virtual wall)

**The Challenge:** The bot has **no map**. It doesn't know where panoramas exist until it tries to walk there.

---

## 🧭 The Drift-Walk Mechanic

### Why "Drift"?

We turn the camera by **holding a key for milliseconds**, not by specifying degrees:

```javascript
// We say: "hold Left arrow for 600ms"
// We expect: "turn 60°"
// Reality: "turn 57°... or 63°... depending on browser lag"
```

**Sources of Drift:**
- Browser event timing inconsistencies
- Google's camera smoothing
- Network latency affecting key press registration
- Accumulated error over many turns

**Result:** After 20 turns, the bot thinks it's facing North (90°) but is actually pointing at 78° or 103°.

### Embracing Drift: The "Cone" Model

Instead of fighting drift, we **use it**:

```
        Failed buckets (blocked)
        ↓
    ╭────┼────╮
    │  \ | /  │
    │   \|/   │ ← Successful exit at 90°
A → ●────→────→ B
    │   /|\   │
    │  / | \  │
    ╰────┼────╯
        ↑
   "Drift cone" - we know this angular range is passable
   because we successfully walked through it
```

**Key Insight:** When we successfully walk A→B at yaw 90°, we've validated:
- The 90° bucket (obviously)
- Plus the **drift tolerance** around it (±15-20°)

This "cone" becomes part of our **learned connectivity graph**.

---

## 🗺️ The Six Buckets

We divide the 360° horizon into **6 yaw buckets**:

| Bucket | Yaw | Direction |
|--------|-----|-----------|
| 0 | 0° | North |
| 1 | 60° | Northeast |
| 2 | 120° | Southeast |
| 3 | 180° | South |
| 4 | 240° | Southwest |
| 5 | 300° | Northwest |

**At each node, we track:**
- `triedYaws` - which buckets we've attempted
- `successfulYaws` - which buckets led to movement
- `failedYaws` - which buckets hit virtual walls

**Node Classification (after all 6 buckets tried):**
- **STRAIGHT** - 2 exits, ~180° apart (entered at 0°, exited at 180°)
- **CROSSROAD** - 3+ exits (T-junction, 4-way, etc.)
- **DEAD_END** - 1 exit (only the way we came)

---

## 🔄 The Walk Cycle

### Forward Exploration

```
At NEW node with untried buckets:
1. Check: which buckets haven't been tried?
2. Pick next untried bucket (e.g., 60°)
3. Turn to face that bucket
4. Press ArrowUp
5. If URL changed → SUCCESS! Record transition
6. If URL unchanged → FAILURE! Mark bucket as blocked
```

### Hit Dead End → Backtrack

```
A → B → C → D (dead end, all buckets failed)
    ↓
   unexplored bucket at B (60° never tried)

Backtrack flow:
1. D: All buckets tried, none work → go back to C
2. C: Check - any untried buckets? No → go back to B
3. B: Check - untried bucket at 60°! → ONE exploration turn
4. If 60° leads to new area → explore it!
5. If 60° also dead-end → continue to A
```

### The One-Turn Rule

**Critical constraint:** During backtracking, we make **exactly ONE turn** at each visited node.

```
Why one turn?
- Prevents infinite loops (don't spin at every node)
- Ensures systematic exploration (check every node once)
- Respects drift-walk geometry (we know which cones are valid)
```

**Tracking:** `turnedAtNodes` Set remembers which nodes already got their exploration turn during this backtrack session.

---

## 📊 The Transition Graph

We learn **actual connectivity** from successful walks:

```javascript
// Record every successful move
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

### Graph Metadata

Each `NodeInfo` stores:

```javascript
{
  location: "52.377808,4.948425",
  lat: 52.377808,
  lng: 4.948425,
  
  triedYaws: Set([0, 60, 120, 180, 240, 300]),
  successfulYaws: Set([0, 180]),  // North and South worked
  entryYaw: 0,                     // Entered from North
  
  // Classification (only valid after 6 yaws tried)
  isStraight: true,
  isCrossroad: false,
  isDeadEnd: false,
  isFullyExplored: true
}
```

---

## 🧠 Decision Modes

### FORWAR D Mode (Exploring New Territory)

**Trigger:** At node with untried buckets, not stuck

```
Decision flow:
1. Get next untried yaw (e.g., 60°)
2. Calculate turn angle from current orientation
3. If angle difference > 5° → TURN
4. If already facing it → MOVE (ArrowUp)
```

### PANIC Mode (Stuck Recovery)

**Trigger:** `stuckCount >= 3` heartbeats

```
Priority:
1. Try any untried yaw bucket
2. If all tried → retry successful exit (random pick)
3. Emergency: use entryYaw + 180° (go back the way we came)
4. Last resort: STOP (truly stuck, no escape)
```

### RETURN Mode (Backtracking)

**Trigger:** Hit dead end, now retracing path

```
At each visited node during backtrack:
1. Check: has untried buckets AND haven't turned here yet?
2. If yes → ONE exploration turn
3. If no → continue backtracking to previous node
4. Reset turnedAtNodes when reaching crossroad
```

---

## 📈 Metrics & Performance

### Key Ratios

| Metric | Formula | Target | Meaning |
|--------|---------|--------|---------|
| **Progress Ratio** | `uniqueLocations / totalSteps` | > 0.70 | Efficiency of exploration |
| **Steps/Location** | `totalSteps / uniqueLocations` | < 2.0 | Inverse of progress |
| **Coverage** | `visitedLocations / totalInArea` | 1.0 | Complete exploration |

### Typical Walk Stats

| Walk Type | Steps | Unique | Progress Ratio | Notes |
|-----------|-------|--------|----------------|-------|
| Grid streets | 1000 | 800 | 0.80 | Good efficiency |
| Linear trap | 5000 | 900 | 0.18 | Many backtracks |
| Open area | 2000 | 1600 | 0.80 | Radial exploration |

---

## 🎮 The Labyrinth Exploration Strategy

### Territory Types

**1. Grid (Amsterdam-style)**
```
┌───┬───┬───┐
│   │   │   │
├───┼───┼───┤  → Many crossroads, multiple escape routes
│   │   │   │
└───┴───┴───┘
```

**2. Linear (Highway + exits)**
```
══════════════════  ← Main path
    │   │   │
    └───┴───┘      ← Dead-end exits
```

**3. Tree (Branching paths)**
```
    ●
   / \
  ●   ●
 / \   \
●   ●   ●  → Must backtrack to explore siblings
```

### Strategy per Territory

| Territory | Strategy | Why |
|-----------|----------|-----|
| **Grid** | Systematic DFS, one-turn backtrack | Many crossroads, don't miss branches |
| **Linear** | Quick backtrack, escape to new area | Minimize steps on known path |
| **Tree** | Full exploration of each branch | No alternative routes |

---

## 🔧 Implementation Details

### Turn Cooldown

After attempting a turn, we wait **3 ticks** before next decision:

```javascript
// In engine.js
if (ticksSinceTurn < TURNS_COOLDOWN_TICKS) {
  ticksSinceTurn++;
  return;  // Wait for cooldown
}
```

**Why?**
- Google Street View needs time to load new panorama
- Prevents "spamming" turns before movement registers
- Ensures stable state for next decision

### Yaw Bucket Angle Calculation

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
- Current: 350°
- Target: 10°
- Diff: 10 - 350 = -340 → +360 = 20°
- **Turn 20° left** (not 340° right!)

### Location Extraction

```javascript
function extractLocation(url) {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!match) return null;
  return `${match[1]},${match[2]}`;  // "52.377808,4.948425"
}
```

**Precision:** 6 decimal places (~11cm accuracy)

---

## 🧪 Testing & Debugging

### Test Scenarios

```javascript
// Test 1: Simple forward walk
it('should walk forward at new node', () => {
  const context = {
    currentLocation: 'A',
    orientation: 90,
    stuckCount: 0,
    isNewNode: true
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(false);  // Just move forward
});

// Test 2: Dead end escape
it('should escape dead end using reverse yaw', () => {
  const context = {
    currentLocation: 'D',
    orientation: 90,
    stuckCount: 3,
    entryYaw: 90  // Came from North
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  expect(decision.angle).toBe(270);  // Turn South (reverse)
});

// Test 3: Backtrack exploration
it('should explore untried bucket during backtrack', () => {
  const context = {
    currentLocation: 'B',
    orientation: 90,
    stuckCount: 0,
    hasBeenHereBefore: true,
    untriedYaws: [60]
  };
  const decision = algorithm.decide(context);
  expect(decision.turn).toBe(true);
  expect(decision.angle).toBe(330);  // Turn to 60°
});
```

### Debug Logging

```javascript
console.log(`[DEBUG] decide(): stuck=${stuckCount}, orientation=${orientation}°`);
console.log(`[DEBUG] currentNode.triedYaws=${[...triedYaws].join(',')}`);
console.log(`[DEBUG] BACKTRACK: Exploring yaw ${targetYaw}° at ${location}`);
```

**Log patterns to watch:**
- `🔙 BACKTRACK` - returning through visited nodes
- `🚨 PANIC` - stuck recovery mode
- `🎯 Reached crossroad` - arrived at exploration target
- `🛑 CRITICAL` - truly stuck, no escape

---

## 📚 Related Documentation

- **[THE_TRAVERSAL_PROBLEM.md](THE_TRAVERSAL_PROBLEM.md)** - Theory of blind graph traversal
- **[ALGORITHM.md](ALGORITHM.md)** - Technical implementation details
- **[SMART_NODES.md](SMART_NODES.md)** - Node classification system
- **[SURGEON_MODE.md](SURGEON_MODE.md)** - Efficiency-focused mode
- **[TRANSITION_GRAPH_LEARNING.md](TRANSITION_GRAPH_LEARNING.md)** - Learning connectivity from walks

---

## 🎓 Key Takeaways

1. **Drift is a feature, not a bug** - The "drift cone" validates angular ranges, not just single yaws

2. **No true dead ends** - Every node has at least the reverse direction (way we came)

3. **One turn per backtrack** - Systematic exploration without infinite loops

4. **Learn from every step** - The transition graph grows smarter with each successful move

5. **Blind but not stupid** - We don't need a map; we learn connectivity through physical probing

---

*Documentation complete. The bot walks by learning, not by knowing.*
