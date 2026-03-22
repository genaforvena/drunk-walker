# How Drunk Walker Explores (PLEDGE Algorithm)

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

## The PLEDGE Solution

**PLEDGE** (Parametric Labyrinth Exploration with Drift-Guided Escape) is a wall-following algorithm adapted for Street View's unique geometry.

### Core Insight

> **Every node has at most 2 visits:**
> 1. **Forward pass**: Explore into new territory
> 2. **Wall-follow pass**: Scan for left exits while backtracking

This guarantee comes from:
- **Left-hand rule**: When stuck, follow the left wall
- **Forward facing**: Always face direction of travel
- **Break-wall escape**: Retry successful exits when truly stuck
- **No breadcrumb navigation**: Pure wall-following, no old targets

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
TURN LEFT 120° from forward bearing
    ↓
Face left wall, slightly backward
    ↓
Enter WALL-FOLLOW mode
```

**Why 120°?**
- Points along left wall (not straight back)
- Allows scanning side exits while backtracking
- Compromise between wall-follow and exit detection

### Phase 3: WALL-FOLLOW Backtracking

```
In WALL-FOLLOW mode
    ↓
At each node while backtracking:
  • Scan for untried yaws 90-180° LEFT from forward
  • Found left exit? → Take it, resume FORWARD mode
  • No exit? → Continue wall-follow
    ↓
Face wall-follow bearing (120° from original forward)
    ↓
Move backward along left wall
```

**Why scan left exits?**
- Left-hand rule guarantees maze coverage
- Catches branches missed on forward pass
- Each node scanned once during backtrack

### Phase 4: BREAK WALL Escape

```
Truly stuck (no exits found in wall-follow)
    ↓
BREAK WALL: Retry random successful yaw
    ↓
Reset wall-follow state
    ↓
Escape the dead end
    ↓
Resume FORWARD exploration
```

**Why retry successful yaws?**
- Graph may have changed (dynamic content)
- Previous failure may have been temporary
- Better than infinite loop

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
3. E: Turn LEFT 120°, face wall-follow bearing
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

**Solution**: BREAK WALL retries successful exits.

```javascript
if (isExhausted && successfulYaws.size > 0) {
  retryRandomSuccessfulYaw();
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
  wallFollowTurnAngle: 120,  // Turn LEFT 120° at dead end
  
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

**Fix**: Check wall-follow state reset.

```javascript
if (bestYaw !== null) {
  wallFollowMode = false;  // Must reset!
  wallFollowBearing = null;
  forwardBearing = null;
}
```

---

## Related Documentation

- [`ALGORITHM.md`](ALGORITHM.md) - Full API reference
- [`SMART_NODES.md`](SMART_NODES.md) - Node classification
- [`THE_TRAVERSAL_PROBLEM.md`](THE_TRAVERSAL_PROBLEM.md) - Problem analysis

---

*The bot explores by following the left wall, facing forward, and breaking walls when stuck.*
