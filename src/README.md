# 🧑‍💻 Developer Guide (v6.1.4 PLEDGE)

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests (150+ tests)
npm test

# Build bookmarklet
node build.js
```

### ⚠️ Release Checklist (MUST DO BEFORE PUSHING)

**Always follow this order:**

1. **Make code changes**
2. **Run tests:** `npm test` - ALL tests must pass
3. **Build:** `node build.js` - generates `bookmarklet.js`
4. **Verify build:** Check `bookmarklet.js` was updated (file size, timestamp)
5. **Commit:** `git add . && git commit -m "..."`
6. **Push:** `git push`

**Why this order matters:**
- Tests catch regressions BEFORE they reach users
- Build ensures `bookmarklet.js` matches source code
- Pushing untested/unbuilt code breaks production

**Never push without:**
- ✅ Running `npm test`
- ✅ Running `node build.js`
- ✅ Verifying `bookmarklet.js` is updated

---

## Walk-Driven Development Workflow

**All algorithm changes MUST be based on actual walk data.**

### Overview

The **Territory Oracle** is a mock Street View that knows the actual connectivity from walk logs. It enables deterministic replay testing without browser integration.

**Key Properties:**
1. **Deterministic:** Same algorithm → same results
2. **Verifiable:** Oracle metrics match real walk metrics  
3. **Baseline-Protected:** No change should make baselines worse
4. **Fast:** Pure JavaScript, no browser needed

### Step 1: Identify Issue from Walk Log

```bash
# Find problematic walk logs
ls -lt walks/*.txt | head -5

# Search for high visit counts (nodes visited >2 times = bug)
grep "nodeVisitCount=[3-9]" walks/dw-logs-*.txt | head -20

# Trace specific node through walk
grep "31.8010261,35.2140383" walks/dw-logs-1774812201528.txt
```

### Step 2: Create Walk Report

Before implementing any fix, create a walk report in `docs/WALK_REPORTS.md`:

```markdown
## Walk Report: [Walk ID]

**File:** `walks/dw-logs-[ID].txt`
**Issue:** [Brief description]

### Issue Identified

**Pattern:** [Describe the problematic pattern]
**Example Sequence:** [Steps X-Y showing the issue]
**Root Cause:** [Analysis of why this happens]

### Proposed Fix

**Algorithm Change:** [Describe the fix]
**Expected Impact:** [What metrics should improve]
```

### Step 3: Verify Oracle Works

Before making changes, verify the oracle correctly represents the walk:

```bash
npm test -- src/core/territory-oracle.test.js
```

Expected output:
```
✓ should parse new format walk logs
✓ should verify oracle against original walk
✓ should match oracle metrics with real walk metrics
```

### Step 4: Record Current Baseline

```bash
# Run tests and save output
npm test -- src/core/territory-oracle.test.js 2>&1 | tee baseline-before.txt
```

Key metrics to record:
- **Visited/Steps ratio:** Exploration efficiency (target: >0.55)
- **Max visits:** PLEDGE guarantee (target: ≤2)
- **Turns per 100:** Excessive turning (target: <25)
- **Stuck ratio:** Time spent stuck (target: <0.20)

### Step 5: Implement Fix

Make changes in `src/core/traversal.js`.

### Step 6: Verify Fix Improves Metrics

```bash
# Run tests again
npm test -- src/core/territory-oracle.test.js 2>&1 | tee baseline-after.txt

# Compare
diff baseline-before.txt baseline-after.txt
```

### Step 7: Verify No Regressions

```bash
# Run full test suite
npm test
```

All 150+ tests must pass.

### Step 8: Update Documentation

- Add walk report to `docs/WALK_REPORTS.md`
- Update `docs/HOW_IT_WALKS.md` with algorithm changes
- Update `docs/THE_TRAVERSAL_PROBLEM.md` with design principles

See [`docs/WALK_DRIVEN_DEVELOPMENT.md`](../docs/WALK_DRIVEN_DEVELOPMENT.md) for complete documentation.

---

## Project Structure

```
drunk-walker/
├── src/
│   ├── core/
│   │   ├── engine.js              # Orchestrator (state, timing)
│   │   ├── wheel.js               # Physicality (orientation, turning)
│   │   ├── traversal.js           # PLEDGE wall-following logic
│   │   ├── engine.test.js         # Unit tests
│   │   ├── real-walk-log-replay.test.js  # Real walk replay tests
│   │   └── ...
│   ├── input/
│   │   └── handlers.js            # Key/Mouse event simulation
│   ├── ui/
│   │   └── controller.js          # Control panel
│   └── main.js                    # Entry point
├── docs/                          # Algorithm documentation
├── walks/                         # Walk log files (*.txt)
├── build.js                       # Bundles src/ → bookmarklet.js
├── index.html                     # Installation site (GitHub Pages)
└── package.json                   # Dependencies
```

---

## Architecture: The Decoupled Stack

### 1. The Engine (`src/core/engine.js`)
The central orchestrator. It manages the `setInterval` loop and maintains the global state:
- **Steps Counter**: Physical probes made.
- **Visited Set**: Locations visited (for deduplication).
- **Breadcrumbs (Array)**: Rolling buffer (last 200 steps).
- **Stuck Detection**: Compares current and previous locations.
- **Transition Graph**: Learned connectivity (yaw buckets per node).

### 2. The Wheel (orientation handling in `traversal.js`)
Handles the "Physicality" of the bot.
- Manages the `yaw` (0-359).
- Translates degrees into `ArrowLeft` hold durations.
- Ensures all movement is "Left-Turn only."

### 3. The Traversal (`src/core/traversal.js`)
**PLEDGE Wall-Following Algorithm** (v6.1.4):

| State | Trigger | Action |
|-------|---------|--------|
| **FORWARD** | New node, untried yaws | Face forward bearing, move straight |
| **DEAD_END** | All 6 yaws tried | Turn LEFT 105°, start wall-follow |
| **WALL-FOLLOW** | Backtracking | Scan for left exits (90-180° from forward) |
| **BREAK_WALL** | Truly stuck | Retry random successful yaw |

**v6.1.4 Features:**
- Territory Oracle for deterministic testing
- Wall-follow loop detection
- Walk-driven development workflow

---

## Data Flow

```
[Engine Tick]
      │
      ▼
[Stuck Detection?] ────▶ [Update State]
      │
      ▼
[Algorithm Decide] ◀─── [Breadcrumbs + Graph]
      │
      ▼
[Turn?] ───────────────▶ [Wheel: Hold ArrowLeft]
      │
      ▼
[Move?] ───────────────▶ [Handlers: Press ArrowUp]
      │
      ▼
[Record Step] ─────────▶ [Update Graph]
```

---

## Building

The build script (`build.js`) is a custom concatenator that:
1. Reads components in order: `wheel`, `traversal`, `navigation`, `engine`, `handlers`, `controller`, `main`.
2. Strips ESM `import/export` statements.
3. Wraps the result in an IIFE.
4. Outputs to `bookmarklet.js`.

---

## Testing

We use **Vitest** with **jsdom**.

```bash
npm test
```

### Test Files

| File | Purpose |
|------|---------|
| `engine.test.js` | Core engine state, stuck detection, turn cooldown |
| `real-walk-log-replay.test.js` | **Real walk replay** - parses `walks/dw-logs-*.txt` |
| `real-walk-replay.test.js` | JSON walk replay with engine simulation |
| `linear-escape.test.js` | Linear territory escape scenarios |
| `long-walk-simulation.test.js` | 10k/50k step progress verification |
| `log-replay.test.js` | Log file parsing and replay |
| `transition-graph.test.js` | Graph learning verification |
| `input/handlers.test.js` | Key/mouse event simulation |

---

## Verifying Optimization Changes

When making algorithm changes (e.g., reducing turns, improving visited/steps ratio):

### 1. Run Real Walk Replay Tests

```bash
npm test -- src/core/real-walk-log-replay.test.js
```

This parses actual walk log files (`walks/dw-logs-*.txt`) and reports:

| Metric | Target | Meaning |
|--------|--------|---------|
| **Visited/Steps ratio** | > 0.55 | Exploration efficiency |
| **Turns per 100** | < 25 | Excessive turning |
| **Micro-adjustments/100** | < 5 | Turns < 20° (wasteful) |
| **Large turns/100** | - | Turns > 60° (corrective) |
| **Stuck ratio** | < 0.20 | Time spent stuck |

### 2. Compare Before/After

```bash
# Run test and save output
npm test -- src/core/real-walk-log-replay.test.js 2>&1 | Out-File -FilePath before.txt

# Make your changes...

# Run again and compare
npm test -- src/core/real-walk-log-replay.test.js 2>&1 | Out-File -FilePath after.txt
```

Look for improvements in:
- **Visited/Steps ratio** (higher = better)
- **Micro-adjustments/100** (lower = better)
- **Turns/100** (lower = better, but not at expense of exploration)

### 3. Check Specific Walk Files

The test automatically analyzes the 3 most recent walk files. To verify against a specific walk:

```bash
# The test output shows metrics per file:
📊 dw-logs-1774213580893.txt (319 steps):
   Unique locations: 218
   Visited/Steps ratio: 0.683    ← Target: > 0.55
   Turns per 100: 36.4           ← Expected for tight clusters
   Micro-adjustments/100: 4.1    ← Target: < 5 ✅
```

### 4. Verify No Regressions

Run full test suite:

```bash
npm test
```

All 150+ tests should pass. Key test files for optimization verification:
- `real-walk-log-replay.test.js` - Real walk metrics
- `linear-escape.test.js` - Escape from dead ends
- `long-walk-simulation.test.js` - Long-term progress

### Example: Verifying Yaw Optimization

**Change:** Increase forward face threshold from 45° to 60°

**Expected impact:**
- Fewer turns on straight roads
- Lower micro-adjustments/100
- Same or better visited/steps ratio

**Verification:**
```
Before:
  Micro-adjustments/100: 8.4
  Visited/Steps: 0.464

After:
  Micro-adjustments/100: 4.1  ✅ -51%
  Visited/Steps: 0.683        ✅ +47%
```

---

## API Reference (Global)

When running in the browser, access the engine via:
```javascript
window.DRUNK_WALKER.engine.start()  // Start exploration
window.DRUNK_WALKER.engine.stop()   // Stop
window.DRUNK_WALKER.engine.getWalkPath()      // Export JSON
window.DRUNK_WALKER.engine.getConfig()        // Read current config
```

---

## Version History

| Version | Key Changes |
|---------|-------------|
| **v6.1.4** | Territory Oracle, walk-driven development, wall-follow loop detection |
| **v6.1.3** | Camera alignment fix, wall-follow loop detection |
| **v6.1.2** | Camera alignment 40°, perpendicular yaw scan, yaw hysteresis, ±20° tolerance |
| **v6.1.0** | PLEDGE wall-following (forward → turn LEFT 105° → wall-follow → break wall) |
| **v5.1.0** | Smart nodes, enhanced transition graph |
| **v4.2.0** | Surgeon mode, veto logic, breadcrumb buffer (100 steps) |
| **v4.1.0** | Hunter mode, 180° snap-back |
| **v4.0.0** | Decoupled architecture (wheel/traversal) |

---

## Walk-Driven Development

**All algorithm changes must be based on actual walk data.**

See [`docs/WALK_REPORTS.md`](../docs/WALK_REPORTS.md) for the walk-driven development workflow and documented walk reports.

**Key principle:** Before implementing any fix:
1. Identify the issue in a walk log
2. Create a walk report with analysis
3. Propose the fix with expected impact
4. Implement and verify against the same walk log
