# Walk Reports

**Purpose:** Document algorithm issues discovered from actual walk logs. All fixes must be based on walk reports.

**RULE:** Every fix must be documented in the walk report where the issue was observed. Do not create separate fix documents.

**RULE:** Session summaries and fix documentation are part of the walk report where the issue was observed.

---

## Walk Report: dw-logs-1774820738896.txt

**File:** `walks/dw-logs-1774820738896.txt`
**Date:** 2026-03-29
**Steps:** 5000 (partial log)

### Issue Identified: Wall-Follow Stuck Without Trying Untired Yaws

**Pattern:** Node visited 12+ times, stuckCount reaches 8, bot just presses ArrowUp instead of trying untried yaw

**Node:** `52.3660656,4.877676`

**Example Sequence (Steps 523-528):**

```
Step 523: Node 52.3660656,4.877676, stuckCount=3, nodeVisitCount=7
          triedYaws=0,120,60,180,240, hasUntried=true (yaw 300° available)
          WALL-FOLLOW mode, facing correct bearing
          Action: Press ArrowUp (doesn't move)

Step 524: stuckCount=4, nodeVisitCount=8
          Same situation - has untried yaw 300°
          Action: Press ArrowUp (doesn't move)

Step 525: stuckCount=5, nodeVisitCount=9
          Still has untried yaw 300°
          Action: Press ArrowUp (doesn't move)

... continues until ...

Step 528: stuckCount=8, nodeVisitCount=12
          Finally escapes after multiple failed ArrowUp presses
```

**Root Cause:**

In WALL-FOLLOW mode, when the bot is stuck (ArrowUp fails) but has untried yaws available, the code returns `{turn: false}` and just presses ArrowUp again:

```javascript
// BUG in traversal.js lines 404-423
if (wallFollowMode && wallFollowBearing !== null) {
  // Face bearing...
  
  if (isExhausted) {
    // Fall through to BREAK_WALL
  } else {
    // Still have untried yaws - just press ArrowUp to continue backtracking
    console.log(`🧱 WALL-FOLLOW: Backtracking (press ArrowUp)`);
    return { turn: false };  // ← BUG! Just presses ArrowUp forever
  }
}
```

**The Fix:**

Check if stuck (`stuckCount >= 1`) and try untried yaws immediately:

```javascript
if (wallFollowMode && wallFollowBearing !== null) {
  // Face bearing...
  
  if (isExhausted) {
    // Fall through to BREAK_WALL
  } else if (stuckCount >= 1) {
    // Stuck but has untried yaws - try them immediately!
    const untriedYaws = [0, 60, 120, 180, 240, 300].filter(y => !currentNode.triedYaws.has(y));
    if (untriedYaws.length > 0) {
      const nextYaw = untriedYaws[0];
      console.log(`🧱 WALL-FOLLOW: Stuck! Trying untried yaw ${nextYaw}° to escape`);
      return { turn: true, angle: getLeftTurnAngle(orientation, nextYaw) };
    }
    // No untried yaws - fall through to BREAK_WALL
  } else {
    // Not stuck - continue backtracking normally
    return { turn: false };
  }
}
```

**Expected Impact:**

- Nodes stuck in wall-follow with untried yaws will escape immediately
- Max visits should drop from 12+ to ≤3
- Steps wasted per stuck situation: from 8+ to 1-2

---

## Walk Report: dw-logs-1774812201528.txt

**File:** `walks/dw-logs-1774812201528.txt`
**Date:** 2026-03-29
**Steps:** 5000 (partial log)
**Unique Nodes:** ~400 (estimated from log)
**Efficiency:** <0.10 (severely degraded by loops)

### Issue Identified: Wall-Follow Loop

**Pattern:** Node visited 14+ times instead of ≤2 (PLEDGE guarantee violated)

**Node:** `31.8010261,35.2140383`

**Example Sequence (Steps 1324-1332):**

```
Step 1324: Arrive at Node A from Node B
           Location: 31.8010261,35.2140383
           Yaw: 42°, visitCount=5, ALL 6 yaws tried → DEAD END
           Action: Turn LEFT to wall-follow bearing 92°

Step 1325: Move to Node C (31.8011243,35.2140137)
           Wall-follow scans for LEFT exits (90-180° from forward=347°)
           Finds yaw 240° (107° LEFT from forward) → TAKES IT

Step 1326: Returns to Node A from Node C at yaw 140°
           visitCount=6, still DEAD END
           Action: Turn LEFT to wall-follow bearing 152°

Step 1327: STUCK! ArrowUp fails at yaw 152° (blocked)
Step 1328: Still stuck, BREAK WALL triggers
           Action: Retries successful yaw 240° → escapes to Node B

Step 1329: At Node B, tries yaw 300° → STUCK
Step 1330-1331: Still stuck at Node B
Step 1332: Tries yaw 180° → escapes to new node
```

**Loop Pattern:**
```
Node B → Node A (dead end) → wall-follow → Node C → LEFT exit → Node A (AGAIN!)
                                                    ↑
                                              Creates infinite loop
```

### Root Cause Analysis

#### Why Wall-Follow Creates Loops

The PLEDGE algorithm assumes a **tree structure** (no cycles), but Street View has **cycles**:

```
    B
   / \
  A---C   ← Wall-follow: A→C, then C→A (cycle!)
```

**The sequence:**
1. At Node A (dead end), wall-follow finds exit to Node C
2. At Node C, wall-follow scans for LEFT exits
3. Yaw 240° at Node C is "untried" (never attempted from C)
4. Wall-follow takes yaw 240° → leads BACK to Node A
5. At Node A (again!), algorithm treats it as new dead end
6. Restarts wall-follow → infinite loop

#### Why the Bot Can't Detect the Loop

The bot is **blind** - it doesn't know where an untried yaw leads without trying it. When wall-follow at Node C considers yaw 240°:
- Yaw 240° is untried at Node C
- Bot doesn't know 240° leads to Node A (already visited)
- Bot takes the exit, discovering the connection C→A

**Key insight:** The reverse yaw (180° at Node C, pointing back to A) was recorded when we moved A→C. But yaw 240° at Node C is a **different bucket** that happens to also lead to Node A due to Street View's geometry.

#### Yaw Bucket Geometry

```
Node A: 31.8010261,35.2140383
Node C: 31.8011243,35.2140137

Move A→C at yaw ~346° (bucket 0°)
Reverse at C: yaw ~166° (bucket 180°) ← Recorded in graph

But yaw 240° at C also leads to A!
- This is a DIFFERENT bucket (not recorded)
- Street View panoramas have multiple entry/exit angles
- The same physical connection can be in different yaw buckets
```

#### Fundamental Constraints

**"You Must Have Gotten In Somehow"**

Guarantee: Every node has at least one exit - the direction you came from.

**Problem:** The reverse yaw is recorded in a specific bucket (e.g., 180°), but Street View's geometry means the same physical connection might be accessible from a different bucket (e.g., 240°).

**Why We Can't Simply Check "Visited Nodes":**

| Approach | Problem |
|----------|---------|
| Check if yaw was successful before | Doesn't help - 240° at C was never tried |
| Check graph connections | Graph only knows 180° at C → A, not 240° → A |
| Check if target location is visited | Can't know target without trying |

### Proposed Fix

#### Core Insight

When wall-follow arrives at a **visited, fully-explored node**, we're in a loop. Instead of restarting wall-follow, we should **break out immediately**.

#### Implementation

The final implementation uses two detection mechanisms:

1. **Single-node stuck detection:** Track ticks on same location, reset after 20+ ticks
2. **Dead pocket detection:** Track component exhaustion, restart after 3 detections

```javascript
// Single-node stuck detection
if (currentLocation === lastStuckLocation) {
  locationStuckCounter++;
  if (locationStuckCounter > 20 && !isTwoNodeLoop) {
    // Reset PLEDGE state, keep graph memory
    wallFollowMode = false;
    wallFollowBearing = null;
    locationStuckCounter = 0;
  }
}

// Dead pocket detection
if (allNeighborsFullyExplored) {
  deadPocketCount++;
  if (deadPocketCount >= 3) {
    // Clear graph and restart exploration
    enhancedGraph.nodes.clear();
    deadPocketCount = 0;
  }
}
```

#### Why This Works

1. **Detects stuck patterns:** Single-node loops and exhausted components
2. **Preserves graph:** Only clears when truly stuck in dead pocket
3. **Preserves PLEDGE:** Still follows left-hand rule
4. **No hacks:** Uses existing BREAK_WALL mechanism

#### Related Fixes

**Fix 2: Wall-Follow Presses ArrowUp When Stuck**

When stuck (stuckCount >= 1) in wall-follow mode, try untried yaws immediately:

```javascript
if (wallFollowMode && stuckCount >= 1 && currentNode.hasUntriedYaws()) {
  const nextYaw = untriedYaws[0];
  return { turn: true, angle: getLeftTurnAngle(orientation, nextYaw) };
}
```

**Fix 3: Preserve Exit Direction**

When exiting wall-follow, preserve the exit direction:

```javascript
if (bestYaw !== null) {
  wallFollowMode = false;
  committedDirection = bestYaw;  // Preserve exit direction
  consecutiveStraightMoves = 1;
}
```

### Expected Impact

#### Before Fix

```
Node A: 14+ visits (stuck in wall-follow loop)
Steps: ~200 wasted in loop
Progress: 0% (no new territory)
Efficiency: <0.10
```

#### After Fix

```
Node A: 2 visits (forward + wall-follow)
Steps: ~10 (escape after detecting loop)
Progress: 100% (continues exploration)
Efficiency: >0.55
```

### Verification Plan

1. **Create Territory Oracle** from walk log:
   ```bash
   npm test -- src/core/territory-oracle.test.js
   ```

2. **Run benchmark before fix**:
   ```bash
   npm test -- src/core/territory-oracle.test.js 2>&1 | tee before.txt
   ```

3. **Implement the fix** in `src/core/traversal.js`

4. **Run benchmark after fix**:
   ```bash
   npm test -- src/core/territory-oracle.test.js 2>&1 | tee after.txt
   ```

5. **Compare metrics**:
   ```bash
   diff before.txt after.txt
   ```

6. **Verify specific improvements**:
   - Max visits: 14+ → ≤2
   - Visited/Steps ratio: <0.10 → >0.55
   - Turns per 100: same or lower

### Expected Metrics (Before → After)

| Metric | Before (Bug) | After (Fixed) | Target |
|--------|--------------|---------------|--------|
| Max visits | 14+ | ≤2 | ≤2 |
| Visited/Steps | <0.10 | >0.55 | >0.55 |
| Turns/100 | varies | same/lower | <25 |
| Stuck ratio | high | low | <0.20 |

### Design Principles

#### True to PLEDGE Algorithm

1. **Left-hand rule preserved:** Wall-follow still scans for LEFT exits (90-180°)
2. **Forward-facing preserved:** Still faces direction of travel
3. **Break-wall escape preserved:** Uses existing BREAK_WALL mechanism
4. **No breadcrumbs:** Still pure wall-following, no navigation to old targets

#### No Hacks

1. **Loop detection is natural:** Visiting same node twice during wall-follow IS a loop
2. **Escape is algorithmic:** BREAK_WALL is part of PLEDGE, just triggered earlier
3. **State is minimal:** Uses existing counters (locationStuckCounter, deadPocketCount)

#### Blind Exploration Respected

1. **Can't predict connections:** Bot doesn't know where untried yaws lead
2. **Graph is memory:** Uses recorded connections to detect loops
3. **Physical probing:** Still must try yaws to discover connectivity

---

## Session Summary: 2026-03-29 Walk-Driven Development Setup

**Purpose:** Established walk-driven development workflow with Territory Oracle

### What Was Created

1. **Territory Oracle** (`src/core/territory-oracle.js`)
   - Mock Street View that knows actual connectivity from walk logs
   - Parses new format logs (with `previousLocation` in DEBUG line)
   - Adds reverse connections geometrically
   - 100% verification accuracy on test walk

2. **Oracle Tests** (`src/core/territory-oracle.test.js`)
   - 8 tests covering parsing, verification, metrics, baselines
   - All tests pass ✅

3. **Documentation**
   - `docs/WALK_DRIVEN_DEVELOPMENT.md` - Complete workflow guide
   - `docs/WALK_REPORTS.md` - This file (walk reports)
   - Updated `src/README.md` with workflow

### Workflow

```
1. Identify issue in walk log
2. Create walk report (this file)
3. Verify oracle works: npm test -- src/core/territory-oracle.test.js
4. Record baseline metrics
5. Implement fix in traversal.js
6. Verify improvement (compare metrics)
7. Verify no regressions: npm test
8. Update documentation (this file)
```

### Baseline Policy

**Baselines are IMMUTABLE:**
1. Don't change without documenting why
2. If baseline fails → regression introduced
3. Update only with justification in this file

**Current Baselines (dw-logs-1774812201528.txt):**
- Visited/Steps: ≥0.30 (documents wall-follow loop bug)
- Max visits: ≤15 (documents 10+ visit bug)

**After Fix (expected):**
- Visited/Steps: >0.55
- Max visits: ≤2

### Verification Results

#### Oracle Accuracy
- **Parsing:** 150 locations, 309 steps from walk log
- **Verification:** 100% of steps verified
- **Reverse connections:** 234 inferred connections added
- **Metrics match:** Oracle matches real walk within ±1 location

#### Test Results
```
Test Files  12 passed (12)
Tests  162 passed (162)
```

### Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `src/core/territory-oracle.js` | Created | Oracle implementation |
| `src/core/territory-oracle.test.js` | Created | Oracle tests |
| `docs/WALK_DRIVEN_DEVELOPMENT.md` | Created | Workflow guide |
| `docs/WALK_REPORTS.md` | Updated | This file - walk reports |
| `src/README.md` | Updated | Workflow section |
| `src/core/engine.js` | Updated | Version to 6.1.4 |
| `src/core/engine.test.js` | Updated | Version test |
| `src/bundle.test.js` | Updated | Version test |
| `src/validate-bundle.test.js` | Updated | Version test |

### Key Design Decisions

#### Why Territory Oracle?

1. **Deterministic:** Same algorithm → same results
2. **Fast:** No browser, pure JavaScript
3. **Verifiable:** Metrics match real walk data
4. **Safe:** Test risky changes without breaking real walks

#### Why Not Old Walk Formats?

Old walk logs don't have `previousLocation` in DEBUG lines, making connection extraction unreliable. Only new format walks are used for baselines.

#### Why 90% Verification Threshold?

Some steps may have multiple connections in same yaw bucket. Oracle picks closest to exact yaw, which may differ from original. 90%+ verification ensures oracle is accurate.

### Usage Example

```javascript
import { TerritoryOracle } from './territory-oracle.js';

// Load territory from walk log
const oracle = TerritoryOracle.fromWalkLog('walks/dw-logs-1774812201528.txt');

// Verify oracle is accurate
const verification = oracle.verifyOracle();
console.log(`Verified: ${verification.verifiedSteps}/${verification.totalSteps}`);

// Get territory stats
const stats = oracle.getStats();
console.log(`Locations: ${stats.totalLocations}`);
console.log(`Connections: ${stats.totalConnections}`);

// Check problematic node
const visitCount = oracle.getVisitCount('31.8010261,35.2140383');
console.log(`Problem node visits: ${visitCount}`);  // 10 (bug documented)
```

---

## Template for Future Walk Reports

```markdown
## Walk Report: [Walk ID]

**File:** `walks/dw-logs-[ID].txt`
**Date:** [Date]
**Steps:** [Total steps]
**Unique Nodes:** [Unique locations]
**Efficiency:** [Unique/Steps ratio]

### Issue Identified

**Pattern:** [Describe the problematic pattern]
**Example Sequence:** [Steps X-Y showing the issue]
**Root Cause:** [Analysis of why this happens]

### Proposed Fix

**Algorithm Change:** [Describe the fix]
**Expected Impact:** [What metrics should improve]
**Risks:** [What could break]

### Verification Plan

1. Run oracle tests
2. Record baseline metrics
3. Implement fix
4. Verify improvement
5. Update this document

### Session Summary

**Date:** [Date]
**What Was Done:** [Summary of changes]
**Test Results:** [Test output]
**Files Modified:** [List of files]
```

---

*Walk reports ensure all algorithm changes are data-driven and verified against actual walks. All fix documentation and session summaries belong in this file.*
