# Walk-Driven Development Guide

**Purpose:** All algorithm changes must be verified against actual walk data using the Territory Oracle system.

---

## Overview

The **Territory Oracle** is a mock Street View that knows the actual connectivity from walk logs. It enables deterministic replay testing without browser integration.

### Key Properties

1. **Deterministic:** Same algorithm → same results (no Street View jitter)
2. **Verifiable:** Oracle metrics match real walk metrics
3. **Baseline-Protected:** No change should make baselines worse
4. **Fast:** Pure JavaScript, no browser needed

---

## Workflow

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

Create a walk report in `docs/WALK_REPORTS.md`:

```markdown
## Walk Report: dw-logs-1774812201528.txt

**Issue:** Wall-follow loop - node visited 10+ times (should be ≤2)

**Pattern:**
```
Node B → Node A (dead end) → wall-follow → Node C → LEFT exit → Node A (AGAIN!)
```

**Root Cause:** Wall-follow takes untried yaw that leads back to visited node.

**Proposed Fix:** Track nodes visited during wall-follow phase, break out on loop.

**Expected Impact:**
- Max visits: 10+ → ≤2
- Visited/Steps: 0.48 → >0.55
```

### Step 3: Verify Oracle Works

Before making any changes, verify the oracle correctly represents the walk:

```bash
npm test -- src/core/territory-oracle.test.js
```

Expected output:
```
✓ should parse new format walk logs
✓ should verify oracle against original walk
✓ should match oracle metrics with real walk metrics
✓ should verify baselines for known walks
```

### Step 4: Record Current Baseline

The oracle extracts metrics from the actual walk. These become the baseline:

```bash
# Run tests and save output
npm test -- src/core/territory-oracle.test.js 2>&1 | tee baseline-before.txt
```

Key metrics to record:
- **Visited/Steps ratio:** Exploration efficiency
- **Max visits:** Should be ≤2 (PLEDGE guarantee)
- **Turns per 100:** Excessive turning indicator
- **Stuck ratio:** Time spent stuck

### Step 5: Implement Fix

Make changes in `src/core/traversal.js`.

### Step 6: Verify Fix Improves Metrics

```bash
# Run tests again
npm test -- src/core/territory-oracle.test.js 2>&1 | tee baseline-after.txt

# Compare
diff baseline-before.txt baseline-after.txt
```

Expected improvements:
- Max visits: 10+ → ≤2
- Visited/Steps: 0.48 → >0.55

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

---

## Territory Oracle API

### Creating Oracle from Walk Log

```javascript
import { TerritoryOracle } from './territory-oracle.js';

const oracle = TerritoryOracle.fromWalkLog('walks/dw-logs-1774812201528.txt');
```

### Querying Territory

```javascript
// Get all locations
const locations = oracle.getAllLocations();

// Get visit count for a location
const count = oracle.getVisitCount('31.8010261,35.2140383');

// Get connections from a location
const connections = oracle.getConnections(location);
// Returns: [{ yawBucket, targetLocation, isReverse, exactYaw }, ...]
```

### Simulating Movement

```javascript
// Try to move at yaw bucket
const result = oracle.tryMove(location, yawBucket, exactYaw);
// Returns: { success: true, targetLocation: '...', isReverse: false }
//      or: { success: false, reason: 'blocked' }
```

### Verifying Oracle

```javascript
const verification = oracle.verifyOracle();
console.log(`Valid: ${verification.valid}`);
console.log(`Verified: ${verification.verifiedSteps}/${verification.totalSteps}`);
```

---

## Baseline Policy

### What Are Baselines?

Baselines are **minimum acceptable metrics** for each walk territory. They document:
- Current performance (including bugs)
- Expected behavior after fixes

### Baseline Rules

1. **Baselines are IMMUTABLE** - Don't change without documenting why
2. **If baseline fails** - Your change introduced a regression
3. **To update baseline** - Document justification in WALK_REPORTS.md

### Example Baseline

```javascript
const BASELINES = {
  'dw-logs-1774812201528.txt': {
    // BEFORE FIX (documents the bug)
    minVisitedStepsRatio: 0.30,  // Low due to wall-follow loop
    maxMaxVisits: 15,            // Documents 14+ visit bug
    
    // AFTER FIX (update these)
    // minVisitedStepsRatio: 0.55,
    // maxMaxVisits: 2,
  }
};
```

---

## Test Files

| File | Purpose |
|------|---------|
| `territory-oracle.test.js` | Oracle parsing, verification, metrics |
| `territory-baseline.test.js` | Baseline regression tests |

---

## Debugging

### Oracle Parsing Issues

If oracle doesn't parse walk log:
```bash
# Check log format
head -20 walks/dw-logs-*.txt

# Should have: [DEBUG] currentLocation=X,Y, currentYaw=Z, previousLocation=A,B
```

### Verification Failures

If oracle can't verify walk:
```javascript
const verification = oracle.verifyOracle();
console.log(verification.errors);
```

Common issues:
- Missing connections (log format issue)
- Multiple connections in same yaw bucket (expected)

### Metric Mismatches

If oracle metrics don't match real walk:
```javascript
// Oracle may have 1 extra location (starting point)
expect(Math.abs(oracleLocations - realLocations)).toBeLessThanOrEqual(1);
```

---

## Example: Wall-Follow Loop Fix

### Before Fix

```bash
npm test -- src/core/territory-oracle.test.js 2>&1 | tee before.txt
```

Output:
```
📊 Metrics Comparison:
   Real Walk:
     Max visits: 11
     Ratio: 0.482
```

### After Fix

```bash
npm test -- src/core/territory-oracle.test.js 2>&1 | tee after.txt
```

Expected output:
```
📊 Metrics Comparison:
   Real Walk:
     Max visits: 2
     Ratio: 0.650
```

### Comparison

```bash
diff before.txt after.txt
```

---

## Related Documentation

- `docs/WALK_REPORTS.md` - Walk reports and analysis
- `docs/THE_TRAVERSAL_PROBLEM.md` - Design principles
- `docs/HOW_IT_WALKS.md` - Algorithm documentation
- `src/core/territory-oracle.js` - Oracle implementation

---

*Walk-driven development ensures all algorithm changes are verified against actual data.*
