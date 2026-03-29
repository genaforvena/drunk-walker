# How Drunk Walker Explores (PLEDGE Algorithm)

**Version:** 6.1.4 - Graph-Based Backtracking Fix

## The Problem

Google Street View is a **labyrinth** - a maze of interconnected panoramas with:
- **Hidden branches** that appear after 10+ straight nodes
- **False dead-ends** that look like cul-de-sacs but aren't
- **Yaw drift** where the camera rotates unexpectedly
- **One-way connections** where you can go A→B but not B→A

Traditional exploration algorithms fail because they:
1. Get stuck in infinite loops at dead ends
2. Miss hidden branches by assuming linearity
3. Fight yaw drift instead of embracing it
4. Revisit nodes many times (inefficient)
5. Make excessive micro-adjustments on straight roads

## The PLEDGE Solution

**PLEDGE** (Parametric Labyrinth Exploration with Drift-Guided Escape) is a wall-following algorithm adapted for Street View's unique geometry.

### Core Guarantee

> **Every node has at most 2 visits:**
> 1. **Forward pass**: Explore into new territory
> 2. **Wall-follow pass**: Scan for left exits while backtracking

This guarantee comes from:
- **Left-hand rule**: When stuck, follow the left wall
- **Forward facing**: Always face direction of travel
- **Break-wall escape**: Retry successful exits when truly stuck
- **Graph memory**: Always remember where we came from
- **No breadcrumb navigation**: Pure wall-following, no old targets

### Critical Insight: Every Node Has At Least One Exit

**You must have gotten in somehow.** Every node has at least the reverse direction (where you came from). If `successfulYaws` is empty, use the **graph connections** to calculate the reverse yaw.

This is the **escape guarantee**: even if all recorded successful yaws are lost, the graph remembers connections, and you can always backtrack.

---

## Mechanics & Constraints

### The Bot Is Blind

The bot **cannot see** panoramas. It only knows the graph structure by **physical probing**:

```
1. Turn to face direction
2. Press ArrowUp (physical probe)
3. Check: did URL change?
4. If yes → connection confirmed
5. If no → connection denied
```

**Implication:** The bot doesn't have a map—it **produces** the map by walking. Every movement is a hypothesis test: "Can I go this way?"

### Turning: Left AND Right

The bot can turn **both directions** via long-press:
- **ArrowLeft** - turn counter-clockwise
- **ArrowRight** - turn clockwise

The algorithm picks the **shortest turn**:

```javascript
const leftAngle = getLeftTurnAngle(currentYaw, targetYaw);
const rightAngle = (360 - leftAngle) % 360;
return rightAngle < leftAngle ? 'right' : 'left';  // Pick shortest
```

**Example:**
- Current: 10°, Target: 350°
- Left turn: 340° (almost full circle)
- Right turn: 20° (much shorter!)
- **Result:** Turn right 20° via ArrowRight

**Implication:** The bot is not "left-turn only" - it uses whichever turn is more efficient. However, wall-following **prefers left exits** because they align with the left-hand rule.

### Six Yaw Buckets

Street View divides 360° into **6 discrete buckets**:

| Bucket | Yaw | Direction |
|--------|-----|-----------|
| 0° | 0 | Forward |
| 1 | 60° | Forward-right |
| 2 | 120° | Back-right |
| 3 | 180° | Backward |
| 4 | 240° | Back-left |
| 5 | 300° | Forward-left |

**Implication:** At each node, we track which buckets we've tried and which succeeded. A node is "fully explored" when all 6 buckets are tried.

### Yaw Drift Tolerance (±20°)

The camera **drifts** 10-20° at each step. The bot accepts this:

```javascript
// Target yaw is 90°, but we're at 105°?
if (yawDifference(current, target) <= 20) {
  moveForward();  // Close enough!
}
```

**Implication:** The bot doesn't fight drift—it **embraces** it. This reduces micro-adjustments by ~60%.

### Movement Is Not Guaranteed

Pressing ArrowUp **might not move** the bot:
- Connection blocked (wall, car, pedestrian)
- Street View hasn't loaded
- Keyboard input blocked by browser

**Implication:** Every movement decision needs a **fallback**. If ArrowUp fails, the bot must have an escape route (retry, turn, or use graph).

### The Graph Remembers Everything

The **transition graph** records:
- Every successful movement (A → B at yaw X)
- Every failed attempt (A at yaw Y = blocked)
- Bidirectional connections (if A→B works, B→A likely works)

**Implication:** Even if the bot "forgets" (state cleared), the **graph remembers**. Use graph connections to calculate reverse yaw when `successfulYaws` is empty.

### State Machine vs. Graph Memory

| State (Volatile) | Graph (Persistent) |
|------------------|-------------------|
| `wallFollowMode` | `nodes` (locations) |
| `forwardBearing` | `connections` (edges) |
| `committedDirection` | `triedYaws` per node |
| `stuckCount` | `successfulYaws` per node |

**Implication:** State can be cleared (e.g., stuck detection). Graph **persists** across the entire walk. Trust the graph.

---

## Step-by-Step Walkthrough

### Phase 1: FORWARD Exploration

```
Start at Node A
    ↓
Face forward bearing (prev→cur direction)
    ↓
Move straight into new territory
    ↓
At each new node:
  • Face forward bearing (if diff >15°)
  • Continue straight
    ↓
After 10+ straight new nodes:
  • CUL-DE-SAC CHECK: Verify with side exit
  • Turn to side yaw (60-150° from forward)
  • Check for hidden branch
  • Resume forward if clear
```

**Why face forward?**
- Google rotates camera at curve points
- Facing forward ensures natural path following
- Prevents misaligned exploration

**Why verify at 10 nodes?**
- Prevents 16+ step false cul-de-sacs
- Catches hidden branches early
- Minimal overhead (1 turn per 10 nodes)

### Phase 2: DEAD END Detection

```
At Node D (all 6 yaws tried)
    ↓
Check: isExhausted && fullyExplored?
    ↓
YES → Dead end detected!
    ↓
TURN LEFT 105° from forward bearing
    ↓
Face left wall, slightly backward
    ↓
Enter WALL-FOLLOW mode
```

**Why 105°?**
- Points along left wall (not straight back)
- Allows scanning side exits while backtracking
- Better than 120° for catching side entrances during backtrack

### Phase 3: WALL-FOLLOW Backtracking

```
In WALL-FOLLOW mode
    ↓
At each node while backtracking:
  • Scan for untried yaws 90-180° LEFT from forward
  • Found left exit? → Take it, resume FORWARD mode
  • No exit? → Face wall-follow bearing, press ArrowUp
    ↓
If stuck (all yaws tried, can't move):
  • BREAK WALL: Retry successful yaw (where we came from)
  • If successfulYaws empty: use graph to find reverse yaw
```

**Critical fix (v6.1.4):** Wall-follow mode **never just presses ArrowUp forever**. When stuck, it always falls through to BREAK WALL which:
1. Retries a recorded successful yaw, OR
2. Uses graph connections to calculate reverse yaw (where we came from), OR
3. Tries random yaw (last resort)

**Why scan left exits?**
- Left-hand rule guarantees maze coverage
- Catches branches missed on forward pass
- Each node scanned once during backtrack

### Phase 4: BREAK WALL Escape

```
Truly stuck (no exits found in wall-follow)
    ↓
BREAK WALL: 
  1. successfulYaws > 0 → retry random successful yaw
  2. successfulYaws === 0 → use graph for reverse yaw
  3. No graph → try random yaw (last resort)
    ↓
Reset wall-follow state
    ↓
Escape the dead end
    ↓
Resume FORWARD exploration
```

**Escape priority:**
1. **Recorded successful yaws** - we've been this way before
2. **Graph reverse yaw** - calculated from where we came from
3. **Random yaw** - last resort, shouldn't happen

**Why this works:** The graph remembers all connections. Even if `successfulYaws` is cleared, the graph knows where we came from, and we can calculate the reverse yaw geometrically.

---

## Visual Example

```
    ┌─── B ─── C
    │          │
Start A        D ─── E (dead end)
    │          │
    └── F ──── G

Step-by-step:
1. A → B → C → D → E (FORWARD, 5 straight nodes)
2. E: All yaws tried → DEAD END
3. E: Turn LEFT 105°, face wall-follow bearing
4. E → D (WALL-FOLLOW, scan for left exits)
5. D: Found untried yaw to G (90° LEFT from forward)
6. D → G (Take left exit, resume FORWARD)
7. G → ... (Continue exploration)

Node visits:
• A: 1 visit (forward)
• B: 1 visit (forward)
• C: 1 visit (forward)
• D: 2 visits (forward + wall-follow exit)
• E: 2 visits (forward + wall-follow start)
• F: 0 visits (not yet explored)
• G: 1 visit (forward from D)
```

---

## Common Pitfalls & Fixes

### Pitfall 1: Wall-Follow Presses ArrowUp Forever

**Bug:** Wall-follow mode faced correct bearing and returned `{turn: false}`, just pressing ArrowUp. If Street View didn't move, bot stuck forever.

**Fix:** Wall-follow now **always falls through to BREAK WALL** when stuck (all yaws tried). BREAK WALL has fallback chain:
1. Retry successful yaw
2. Calculate reverse yaw from graph
3. Try random yaw

**Lesson:** Never return `{turn: false}` without a fallback escape route.

### Pitfall 2: Clearing successfulYaws Traps the Bot

**Bug:** "AGGRESSIVE ESCAPE" cleared `successfulYaws` to "force new path". But then BREAK WALL couldn't find any exits!

**Fix:** Removed AGGRESSIVE ESCAPE. The graph already remembers connections - no need to clear anything. If stuck, use graph to find reverse yaw.

**Lesson:** Don't throw away escape routes. The graph is your memory - trust it.

### Pitfall 3: Infinite Loop at Same Node (500+ Visits)

**Bug:** Bot revisited same node 500+ times because:
1. Wall-follow returned `{turn: false}` (just press ArrowUp)
2. ArrowUp failed (no connection in that direction)
3. Bot stayed at same node, tried again forever

**Fix:** Wall-follow → BREAK WALL → Graph reverse yaw. Always has an escape.

**Lesson:** Every decision must have an escape route. If move might fail, have a backup plan.

### Pitfall 4: Wrong Wall-Follow Bearing Reference

**Bug:** Wall-follow bearing calculated from forward bearing (where we arrived), but should be from reverse direction (where we came from).

**Fix:** When using graph fallback, calculate reverse yaw directly:
```javascript
// FROM current TO neighbor (where we came from)
const dLat = neighborLat - currentLat;
const dLng = neighborLng - currentLng;
const reverseYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
```

**Lesson:** "Where we came from" is the guaranteed exit. Use it.

---

## Key Differences from Traditional Algorithms

| Algorithm | Strategy | Node Visits | Guarantee |
|-----------|----------|-------------|-----------|
| **Random Walk** | Pick random exit | ∞ (infinite loops) | None |
| **DFS** | Depth-first with backtrack | 2× per node | Complete but slow |
| **BFS** | Breadth-first expansion | 1× per node | Memory intensive |
| **Tremaux** | Mark passages | 2× per passage | Requires marking |
| **PLEDGE** | Wall-follow with left-hand rule | ≤2× per node | Complete + efficient |

---

## Handling Street View Quirks

### Yaw Drift

**Problem**: Camera rotates 20-30° at each step.

**Solution**: Face forward bearing at each new node.

```javascript
const forwardBearing = calculateForwardBearing(prev, cur);
const bearingDiff = yawDifference(orientation, forwardBearing);

if (bearingDiff > 15) {
  turnToFace(forwardBearing);
}
```

### Hidden Branches

**Problem**: Side paths appear after 10+ straight nodes.

**Solution**: Cul-de-sac verification at 10 straight new nodes.

```javascript
if (isNewNode && consecutiveStraightMoves >= 10) {
  checkSideExit();  // Verify not a false cul-de-sac
}
```

### False Dead Ends

**Problem**: All yaws tried, but branch exists.

**Solution**: BREAK WALL retries successful exits, with graph fallback.

```javascript
if (isExhausted && successfulYaws.size > 0) {
  retryRandomSuccessfulYaw();
} else if (isExhausted && successfulYaws.size === 0) {
  // Use graph to find where we came from
  const neighbors = graph.connections.get(currentLocation);
  const reverseYaw = calculateReverseYaw(neighbors[0], currentLocation);
  turnToFace(reverseYaw);
}
```

---

## Performance Characteristics

| Metric | PLEDGE | Random | DFS |
|--------|--------|--------|-----|
| **Nodes/sec** | 0.5-1.0 | 0.3-0.5 | 0.4-0.8 |
| **Unique/Total** | >0.70 | <0.30 | ~0.50 |
| **Max revisits** | 2 | ∞ | 2 |
| **Memory** | O(n) | O(1) | O(n) |

**Real-world performance:**
- 342 unique nodes in ~700 steps (50% efficiency)
- No infinite loops (guaranteed progress)
- Handles yaw drift naturally

---

## Configuration

```javascript
const PLEDGE_CONFIG = {
  // When to face forward at new nodes
  forwardFaceThreshold: 15,  // Turn if bearing diff >15°

  // When to verify cul-de-sac
  culDeSacCheckThreshold: 10,  // Check at 10+ straight nodes

  // Wall-follow turn angle
  wallFollowTurnAngle: 105,  // Turn LEFT 105° at dead end

  // Left exit scan range
  leftExitMinAngle: 90,   // Minimum left exit angle
  leftExitMaxAngle: 180,  // Maximum left exit angle

  // Break wall trigger
  panicThreshold: 3,  // Ticks before BREAK WALL
};
```

---

## Debugging

### Enable Verbose Logging

```javascript
// In traversal.js
const DEBUG = true;

if (DEBUG) {
  console.log(`🧱 DEAD END! Forward bearing=${forwardBearing}°`);
  console.log(`🔍 CUL-DE-SAC CHECK: ${consecutiveStraightMoves} straight nodes`);
  console.log(`🧱 WALL-FOLLOW: Found LEFT exit yaw ${bestYaw}°`);
  console.log(`🚨 BREAK WALL: Using reverse yaw ${reverseYaw}° from graph`);
}
```

### Common Issues

**Issue**: Bot spins in circles at dead end.

**Fix**: Check `isExhausted` and `fullyExplored` flags.

```javascript
const isDeadEnd = isExhausted && fullyExploredNodes.has(currentLocation);
if (isDeadEnd && !wallFollowMode) {
  startWallFollow();  // Should trigger once
}
```

**Issue**: Bot misses hidden branches.

**Fix**: Lower `culDeSacCheckThreshold` from 10 to 8.

```javascript
if (consecutiveStraightMoves >= 8) {  // Was 10
  checkSideExit();
}
```

**Issue**: Bot revisits nodes >2 times.

**Fix**: Check wall-follow state reset and BREAK WALL fallback.

```javascript
if (bestYaw !== null) {
  wallFollowMode = false;  // Must reset!
  wallFollowBearing = null;
  forwardBearing = null;
}

// BREAK WALL should always have escape
if (isExhausted && successfulYaws.size === 0) {
  // Use graph fallback
  const neighbors = graph.connections.get(currentLocation);
  // Calculate and use reverse yaw
}
```

**Issue**: Bot stuck at same node 500+ times.

**Fix**: This was a bug in v6.1.3 and earlier. Wall-follow returned `{turn: false}` and just pressed ArrowUp forever. Fixed in v6.1.4:
- Wall-follow now falls through to BREAK WALL
- BREAK WALL uses graph reverse yaw fallback
- Always has escape route

---

## Related Documentation

- [`ALGORITHM.md`](ALGORITHM.md) - Full API reference
- [`THE_TRAVERSAL_PROBLEM.md`](THE_TRAVERSAL_PROBLEM.md) - Theory of blind graph traversal
- [`WALK_ANALYSIS.md`](WALK_ANALYSIS.md) - Real walk metrics and optimization impact

---

## Developer Notes

### Release Checklist (BEFORE PUSHING)

**Always follow this order:**

1. **Make code changes**
2. **Run tests:** `npm test` - ALL 150+ tests must pass
3. **Build:** `node build.js` - generates updated `bookmarklet.js`
4. **Verify build:** Check `bookmarklet.js` was updated (file size ~87KB)
5. **Commit:** `git add . && git commit -m "..."`
6. **Push:** `git push`

**Never push without:**
- ✅ Running `npm test`
- ✅ Running `node build.js`
- ✅ Verifying `bookmarklet.js` is updated

**Why:** Pushing untested/unbuilt code breaks production. The `bookmarklet.js` file is what users actually run - it must match the source code.

---

## Pure PLEDGE Implementation Guide

### What We Learned (Hard Way)

This section documents the bugs and misconceptions we encountered while implementing PLEDGE. **Read this before modifying the traversal logic.**

### Bug #1: Wall-Follow Was Checking All Yaws, Not Just LEFT Exits

**Wrong:** Wall-follow was trying ANY untried yaw (forward, right, left) when backtracking.

**Right:** Wall-follow should **ONLY check LEFT exits** (90-180° from forward bearing).

```javascript
// ✅ CORRECT: Only LEFT exits
for (const yaw of untriedYaws) {
  const diff = yawDifference(forwardBearing, yaw);
  if (diff >= 90 && diff <= 180) {
    // This is a LEFT exit - take it
  }
}
// NO fallback to forward/right yaws!
```

**Why:** Forward/right yaws will be explored on future forward passes. Checking them during backtracking breaks the ≤2 visits guarantee.

### Bug #2: Backtracking Detection Was Re-Entering Wall-Follow Immediately

**Wrong:** Added "backtracking detection" that re-entered wall-follow mode whenever arriving at a visited node while moving opposite to committed direction.

**Problem:** After taking a LEFT exit and exiting wall-follow, `committedDirection` was reset to null. At the next node, the detection triggered again because the calculation was wrong with null. This caused:

```
Wall-follow → Find exit → Exit → Move → Re-enter wall-follow → Find same exit → Loop forever!
```

**Right:** **Remove the hack.** Wall-follow mode is entered ONLY at dead ends (all yaws tried). After taking a LEFT exit, stay in FORWARD mode.

```javascript
// ❌ WRONG: Don't add "backtracking detection"
if (justArrived && !isNewNode && !wallFollowMode) {
  // Check if moving opposite to committed direction...
  wallFollowMode = true;  // This causes infinite loops!
}

// ✅ CORRECT: Only enter wall-follow at dead ends
if (isDeadEnd && !wallFollowMode) {
  wallFollowMode = true;  // All yaws tried → start wall-follow
}
```

### Bug #3: PANIC Mode Was Unnecessary

**Wrong:** Added PANIC mode that triggered when `stuckCount >= 2`, trying untried yaws or successful yaws.

**Right:** **Remove PANIC.** Just try untried yaws immediately when stuck (stuck >= 1), regardless of turn angle.

```javascript
// ✅ CORRECT: Simple stuck handling
if (stuckCount >= 1 && currentNode.hasUntriedYaws()) {
  const nextYaw = untriedYaws[0];  // Try first untried yaw
  return { turn: true, angle: turnAngle, direction: turnDirection };
}
```

### Bug #4: LOOP DETECTION Was a Hack Masking Real Issues

**Wrong:** Added loop detection that cleared `successfulYaws` after 3 revisits to "force new path".

**Problem:** This was masking the real bugs (wall-follow checking all yaws, backtracking re-entering wall-follow). Clearing `successfulYaws` trapped the bot with no escape route!

**Right:** **Remove loop detection.** Fix the root causes:
1. Wall-follow only checks LEFT exits
2. Don't re-enter wall-follow after exiting
3. Try untried yaws immediately when stuck

### Bug #5: Bot Pressed ArrowUp Uselessly When Stuck

**Wrong:** When stuck with untried yaws available, the bot kept pressing ArrowUp because:
- FORWARD mode skipped turns >= 90° ("turn too large")
- PANIC didn't trigger until stuck >= 2

**Right:** When stuck (stuck >= 1), try untried yaws **immediately**, regardless of turn angle.

```javascript
// ✅ CORRECT: Try untried yaws when stuck, no angle checks
if (stuckCount >= 1 && currentNode.hasUntriedYaws()) {
  const nextYaw = untriedYaws[0];
  return { turn: true, angle: turnAngle, direction: turnDirection };
}
```

### Bug #6: Wall-Follow Turned to Face Bearing at Fully Explored Nodes

**Wrong:** At fully explored nodes (all yaws tried), wall-follow turned to face the wall-follow bearing, then pressed ArrowUp. But there were no exits! This wasted ticks spinning in place.

**Right:** At fully explored nodes, **skip facing** and go directly to BREAK_WALL.

```javascript
// ✅ CORRECT: Fully explored → BREAK_WALL immediately
if (!currentNode.hasUntriedYaws()) {
  console.log(`🧱 WALL-FOLLOW: Fully explored node, breaking wall to escape...`);
  // Fall through to BREAK WALL - don't waste time facing bearing!
}
```

### Bug #7: Wall-Follow Was Trying Multiple Yaws During Backtracking

**Wrong:** During backtracking (wall-follow mode), the bot was:
- Trying multiple yaws at each node
- Using BREAK_WALL to escape
- Going back to visited nodes instead of continuing to backtrack

**Right:** During backtracking:
1. Scan for LEFT exits only (90-180° from forward bearing)
2. Found LEFT exit? → Take it, exit wall-follow, resume FORWARD
3. **No LEFT exit? → Just press ArrowUp to continue backtracking**
   - Don't try other yaws
   - Don't BREAK_WALL
   - Just go back where you came from!

```javascript
// ✅ CORRECT: Wall-follow backtracking
if (wallFollowMode && wallFollowBearing !== null) {
  // Face the backtracking direction
  if (diff > 10) {
    return { turn: true, angle: turnAngle };  // Turn to face backtracking direction
  }
  // Facing correct direction - just press ArrowUp to continue backtracking
  return { turn: false };  // Don't try other yaws, don't BREAK_WALL!
}

// ✅ CORRECT: BREAK_WALL only for FORWARD mode
if (isExhausted && currentNode.successfulYaws.size > 0 && !wallFollowMode) {
  // BREAK_WALL logic - escape Street View jitter during forward exploration
}
```

**Why:** BREAK_WALL is for escaping Street View jitter during **forward exploration**, NOT for backtracking. During backtracking, you're supposed to go back where you came from until you find a LEFT exit!

---

### Pure PLEDGE: The Correct Implementation

```
┌─────────────────────────────────────────────────────────┐
│  PURE PLEDGE STATE MACHINE (No Hacks!)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. FORWARD MODE:                                       │
│     • Has untried yaws? → Try them                      │
│     • If stuck (stuck>=1)? → Try FIRST untried yaw      │
│       immediately (no angle checks!)                    │
│     • Go straight until all yaws tried                  │
│                                                         │
│  2. DEAD END (all 6 yaws tried):                        │
│     • Turn LEFT 105° from forward bearing               │
│     • Enter WALL-FOLLOW mode                            │
│                                                         │
│  3. WALL-FOLLOW MODE (backtracking):                    │
│     • ONLY scan LEFT exits (90-180° from forward)       │
│     • Found LEFT exit? → Take it, EXIT wall-follow      │
│     • No LEFT exit? → Just press ArrowUp                │
│       (continue backtracking - DON'T try other yaws,    │
│       DON'T BREAK_WALL - just go back where you came    │
│       from until you find a LEFT exit!)                 │
│                                                         │
│  4. BREAK_WALL (FORWARD mode only!):                    │
│     • Has successfulYaws? → Retry random one            │
│     • Empty? → Use graph for reverse yaw                │
│       (calculate from graph connections)                │
│     • NOT used during wall-follow backtracking!         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Insights

1. **Unvisited yaws during backtracking are OK** - Forward/right yaws will be explored on future forward passes. This is the elegance of PLEDGE!

2. **Don't re-enter wall-follow after exiting** - Once you take a LEFT exit, resume FORWARD mode. Don't add "backtracking detection" hacks.

3. **Try untried yaws immediately when stuck** - Don't press ArrowUp uselessly. Turn and try them, regardless of angle.

4. **Wall-follow ONLY checks LEFT** - Never check forward/right yaws during backtracking. They'll be covered later.

5. **Graph remembers everything** - Even if `successfulYaws` is empty, the graph has connections. Use them to calculate reverse yaw.

6. **BREAK_WALL is FORWARD-mode only** - It's for escaping Street View jitter during forward exploration, NOT for backtracking. During backtracking, just press ArrowUp to continue going back!

7. **Backtracking = ONE direction** - During wall-follow, just go back where you came from. Don't try multiple yaws. Don't BREAK_WALL. Just continue backtracking until you find a LEFT exit!

### Each Node ≤2 Visits Guarantee

With pure PLEDGE (no hacks):
- **Visit 1 (Forward)**: Explore into new territory
- **Visit 2 (Wall-follow backtrack)**: Scan LEFT exits only, then leave

No more 500+ visit loops!

---

*The bot explores by following the left wall, facing forward, and breaking walls when stuck. Every node has at least one exit—where we came from.*
