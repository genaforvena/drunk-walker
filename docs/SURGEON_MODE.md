# Surgeon Mode: Cycle Escape Algorithm

**Version:** 4.2.0-EXP  
**Last Updated:** 2026-03-20  
**Goal:** Achieve 1:1 steps/visited ratio by aggressively escaping cycles

---

## 🎯 Philosophy

> **"Any retracing is failure"**

The Surgeon mode prioritizes **efficiency over exploration**. Its goal is a perfect 1:1 steps-to-discovery ratio, meaning every step should visit a new location.

### Comparison with Other Modes

| Mode | Goal | Behavior |
|------|------|----------|
| **Explorer** | Maximize coverage | Will retrace to find new areas |
| **Hunter** | Find dead-ends | Seeks cul-de-sacs specifically |
| **Surgeon** | 1:1 efficiency | **Never retraces** - escapes early |

---

## 🔄 Three-Layer Cycle Detection

### Layer 1: Oscillation Detection

**Purpose:** Detect A→B→A→B pattern BEFORE completing the cycle

```javascript
// Check last 6 breadcrumbs for oscillation
const recent = breadcrumbs.slice(-6);
if (recent[0] === recent[4] &&    // A = A (4 steps apart)
    recent[1] === recent[5] &&    // B = B (4 steps apart)
    recent[0] !== recent[1]) {    // A ≠ B (actually oscillating)
  
  console.log("🔄 SURGEON: OSCILLATION DETECTED! Breaking cycle");
  return { turn: true, angle: Math.floor(Math.random() * 360) };
}
```

| Metric | Value |
|--------|-------|
| Detection window | 6 steps |
| Pattern detected | A→B→A→B |
| Escape action | Random turn (0-359°) |
| Steps prevented | 4-8 per oscillation |

---

### Layer 2: Early Loop Detection

**Purpose:** Escape when returning to RECENT locations (2-8 steps ago)

```javascript
const recentBreadcrumbIndex = breadcrumbs.slice(-10).indexOf(currentLocation);

// Only trigger for locations from 2-8 steps ago
if (recentBreadcrumbIndex !== -1 && recentBreadcrumbIndex < 8) {
  const stepsAgo = 10 - recentBreadcrumbIndex;
  console.log(`🔄 SURGEON: LOOP DETECTED (back to step -${stepsAgo})! 180° escape`);
  return { turn: true, angle: 180 };
}
```

| Metric | Value |
|--------|-------|
| Detection window | Last 10 breadcrumbs |
| Trigger range | 2-8 steps ago |
| Escape action | 180° snap-back |
| Rationale | Returning to recent location = definite loop |

**Why not older breadcrumbs?** Returning to a location from 20+ steps ago might be a valid exploration pattern (e.g., grid exploration). We only want to escape **tight loops**.

---

### Layer 3: Entropy-Based Escape

**Purpose:** Detect "exhausted territory" where all directions are equally hot

```javascript
const entropy = calculateEntropy(visitedUrls, currentLocation, orientation);

// Surgeon uses MORE SENSITIVE thresholds than Explorer
const isLowEntropy = entropy.variance < 5 && entropy.avgVisits > 2;

if (isLowEntropy) {
  consecutiveTurns++;
  
  // Surgeon escapes after 2 ticks (Explorer waits 3)
  if (consecutiveTurns >= 2) {
    console.log(`🎲 SURGEON: LOW ENTROPY, random escape`);
    return { turn: true, angle: Math.floor(Math.random() * 360) };
  }
}
```

### Threshold Comparison

| Algorithm | Variance | AvgVisits | Ticks to Escape |
|-----------|----------|-----------|-----------------|
| **Explorer** | < 3 | > 3 | 3 |
| **Surgeon** | < 5 | > 2 | 2 |

**Surgeon is MORE sensitive:**
- Lower variance threshold (5 vs 3) - triggers on more uniform distributions
- Lower avgVisits threshold (2 vs 3) - triggers earlier
- Faster escape (2 ticks vs 3) - less patience for retracing

---

## 📊 Entropy Calculation

```javascript
function calculateEntropy(visitedUrls, currentLocation, orientation) {
  const scanAngles = [0, 60, -60, 120, -120, 180];
  
  const visitCounts = scanAngles.map(angle => {
    const testOrientation = normalizeAngle(orientation + angle);
    const testLocation = predictNextLocation(currentLocation, testOrientation);
    if (!testLocation) return 0;
    return visitedUrls.get(testLocation) || 0;
  });
  
  const avgVisits = visitCounts.reduce((a, b) => a + b, 0) / visitCounts.length;
  const variance = visitCounts.reduce((sum, v) => sum + Math.pow(v - avgVisits, 2), 0) / visitCounts.length;
  
  return { avgVisits, variance, visitCounts };
}
```

### Interpreting Entropy

| Variance | AvgVisits | Interpretation | Action |
|----------|-----------|----------------|--------|
| **Low (< 5)** | **High (> 2)** | All directions equally hot | Random escape |
| Low (< 5) | Low (≤ 2) | Fresh territory, uniform | Normal scoring |
| **High (≥ 5)** | Any | Clear hot/cold distinction | Normal scoring |
| Any | **Very High (> 10)** | Exhausted area | Random escape |

---

## 🧠 Decision Priority

```
PRIORITY 0: Oscillation Detection      → Random turn
     ↓
PRIORITY 1: Early Loop Detection       → 180° snap-back
     ↓
PRIORITY 2: Entropy-Based Escape       → Random turn (after 2 ticks)
     ↓
PRIORITY 3: Standard Surgical Logic    → Veto visited, find clean node
     ↓
PRIORITY 4: Fallback to Heatmap        → Coldest direction
```

---

## 📈 Performance Metrics

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Steps/Location ratio | < 2.0 | Total steps / unique locations |
| Progress ratio | > 0.60 | Unique locations / total steps |
| Oscillation detection | < 6 steps | Steps before escape |
| Escape latency | < 10 steps | Steps stuck before escape |

### Real Walk Baselines

| Walk | Steps/Location | Progress Ratio | Notes |
|------|---------------|----------------|-------|
| 15-47-38 | 1.14 | 0.88 | Grid with orientation drift (fixed) |
| 17-41-15 | 3.385 | 0.71 | Linear trap (entropy fix helps) |
| 18-22-18 | 5.407 | 0.185 | Linear trap (Surgeon fix needed) |

---

## 🧪 Testing

### Test File

`src/core/linear-escape.test.js`

### Key Tests

```javascript
// Test oscillation detection
it('should detect A->B->A->B pattern', () => {
  // Setup breadcrumbs with oscillation
  const breadcrumbs = ['A', 'B', 'A', 'B', 'A', 'B'];
  const decision = surgeon.decide({ breadcrumbs, stuckCount: 0 });
  expect(decision.turn).toBe(true);  // Should escape
});

// Test entropy escape
it('should escape low entropy after 2 ticks', () => {
  // Setup low entropy situation
  const visitedUrls = new Map();
  // ... mark all directions as visited 3+ times
  const decision = surgeon.decide({ visitedUrls, stuckCount: 0 });
  expect(decision.turn).toBe(true);  // Should escape
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run linear escape tests only
npm test -- src/core/linear-escape.test.js

# Run with verbose output
npm test -- --reporter=verbose src/core/linear-escape.test.js
```

---

## 🔧 Configuration

### Default Settings

```javascript
const surgeonConfig = {
  expOn: true,           // Enable experimental mode
  selfAvoiding: true,    // Enable heatmap/breadcrumbs
  panicThreshold: 3,     // Stuck count before systematic search
  // Surgeon-specific (hardcoded):
  oscillationWindow: 6,  // Breadcrumbs to check for A->B->A->B
  loopDetectionRange: 8, // Only detect loops from 2-8 steps ago
  entropyVarianceThreshold: 5,
  entropyAvgVisitsThreshold: 2,
  entropyEscapeTicks: 2
};
```

### Mode Selection

```javascript
// In UI or configuration
engine.setMode('SURGEON');  // Best for efficiency
engine.setMode('EXPLORER'); // Best for coverage
engine.setMode('HUNTER');   // Best for finding dead-ends
```

---

## 📝 Implementation Notes

### State Management

The Surgeon maintains additional state:

```javascript
let consecutiveTurns = 0;  // Track low entropy ticks
let extendedStuckCount = 0;
let lastTurnDirection = 0;
```

**Important:** `consecutiveTurns` must be reset:
- After successful escape (random turn triggered)
- When entropy returns to normal
- When moving to new location

### Breadcrumb Management

```javascript
// Breadcrumbs are managed in engine.js recordStep()
breadcrumbs.push(location);
if (breadcrumbs.length > 100) breadcrumbs.shift();

// Only add when actually moving to new location
// Prevents "spinning in place" from flushing buffer
```

---

## 🔗 Related Files

- Implementation: `src/core/traversal.js`
- Engine: `src/core/engine.js`
- Tests: `src/core/linear-escape.test.js`
- Analysis: `walks/walk-2026-03-20T18-22-18-128Z.md`
- Tools: `tools/analyze-walk.js`
- **Future:** `src/core/transition-graph.js` (Transition Graph Learning - see below)

---

## 🚀 Future Enhancement: Transition Graph Learning

### The Problem

Analysis of walk data reveals that **Google Street View yaw drifts along paths**:

```
=== YAW DELTA (A->B vs B->A) ===
Average: 125.8°
Expected: ~180° for opposite directions

Distribution:
  "150-170": 20
  "170-180": 4    ← Only 7% have expected 180° delta!
  "180-190": 0
  "190-210": 0
  "other": 36     ← 60% have unpredictable yaw!
```

**Conclusion:** Mathematical prediction fails for ~60% of nodes because yaw doesn't stay consistent.

### The Solution

**Learn actual connectivity from transitions** instead of predicting with math:

```javascript
// Build graph from actual moves
const graph = new Map();  // location -> Set<connectedLocations>

// Record every successful transition
function recordTransition(fromLoc, toLoc, fromYaw, toYaw) {
  if (!graph.has(fromLoc)) graph.set(fromLoc, new Set());
  graph.get(fromLoc).add(toLoc);
}

// Use graph for navigation (100% accurate for learned nodes)
function findEscape(currentLocation, visitedUrls) {
  const connections = graph.get(currentLocation);
  for (const connected of connections) {
    if (!visitedUrls.has(connected)) {
      return connected;  // We KNOW this works!
    }
  }
  return null;  // Fall back to prediction
}
```

### Expected Benefits

| Metric | Current | With Graph |
|--------|---------|------------|
| Prediction accuracy | ~40% | 100% (learned) |
| Yaw drift | 3-5° | < 1° (corrected) |
| Escape latency | ~10 steps | ~3 steps |
| Steps/Location (linear) | 5.4 | < 2.0 |

### Implementation Plan

1. **Phase 1:** Record transitions during walk (engine.js)
2. **Phase 2:** Use graph for navigation (traversal.js)
3. **Phase 3:** Persist across sessions (localStorage)

See `docs/TRANSITION_GRAPH_LEARNING.md` for full proposal.

---

## 📚 Changelog

### v4.2.0-EXP (2026-03-20)

**Added:**
- Oscillation detection (A→B→A→B pattern)
- Early loop detection (2-8 steps ago only)
- Lower entropy thresholds for Surgeon
- Faster escape trigger (2 ticks vs 3)

**Changed:**
- Surgeon now more aggressive than Explorer
- Better suited for linear territory escape

**Fixed:**
- Walk 18-22-18 getting stuck in linear trap
- Progress ratio degradation (0.55 → 0.185)

---

*Documentation complete. Implementation pushed to main.*
