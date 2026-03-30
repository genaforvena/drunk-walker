# Territory Escape Benchmark Suite

**Version:** 1.0  
**Purpose:** Comprehensive testing of bot's territory escape capabilities without running real walks

---

## Overview

The Territory Escape Benchmark Suite provides **17+ synthetic scenarios** and **65+ real walk log tests** to validate the PLEDGE algorithm's escape capabilities. All tests use the **REAL engine** and **REAL algorithm** with mock Street View, enabling rapid iteration without browser integration.

### Key Features

- **100% Deterministic:** Same algorithm → same results (no Street View jitter)
- **Fast Execution:** Pure JavaScript, no browser needed
- **Comprehensive Coverage:** Difficulty ladder, edge cases, stress tests, real walks
- **Detailed Metrics:** Escape rate, max visits, steps/location, turn efficiency
- **Baseline Protection:** Prevents regressions on known problematic walks

---

## Test Suite Structure

### 1. Difficulty Ladder (8 Levels)

Progressive complexity to test algorithm at different challenge levels:

| Level | Name | Description | Target |
|-------|------|-------------|--------|
| 1 | Linear 10 | Simple 10-node straight path | Baseline |
| 2 | T-Junction | Single decision point | Basic navigation |
| 3 | Cul-de-Sac | Dead end escape | Backtracking |
| 4 | Double Cul-de-Sac | Two dead ends in sequence | Multiple escapes |
| 5 | Grid 5x5 with Dead Ends | Grid with blocked paths | Complex decisions |
| 6 | L-Shaped Maze | Corridor with 90° turn | Turn handling |
| 7 | Complex City | Multiple blocks with alleys | Real-world simulation |
| 8 | Figure-8 | Two loops connected | Cycle handling |

### 2. Edge Cases (6 Scenarios)

Specific trap patterns that challenge the algorithm:

| Scenario | Purpose | Expected Behavior |
|----------|---------|-------------------|
| Oscillation Trap | 2-node cycle during backtracking | Max visits ≤3 |
| Roundabout | Central hub with 4 exits | Correct exit selection |
| Narrow Corridor | Long path with periodic side exits | Ignore distractions |
| Blocked Grid | 8x8 grid with 20% random blocks | Pathfinding around obstacles |
| Tree Structure | Pure branching with no cycles | No infinite loops |
| Multi-Exit Roundabout | 4-arm roundabout with traps | Escape from dead end |

### 3. Stress Tests (3 Large-scale Scenarios)

Test algorithm scalability under load:

| Scenario | Size | Max Ticks | Purpose |
|----------|------|-----------|---------|
| Linear 1000 | 1000 nodes | 20,000 | Long-term memory |
| Grid 50x50 | 2500 nodes | 100,000 | Exploration efficiency |
| Complex Maze 20x20 | ~300 nodes | 100,000 | Maze-solving endurance |

### 4. Walk Log Benchmarks (65+ Real Walks)

Tests against actual walk data from `walks/` directory:

- **Oracle Creation:** Verify all walk logs can be parsed
- **Oracle Verification:** Ensure 90%+ replay accuracy
- **Real Walk Metrics:** Extract efficiency, stuck ratio, max visits
- **Baseline Regression:** Prevent degradation on known problematic walks
- **Comprehensive Analysis:** Distribution of efficiency across all walks

---

## Metrics

### Primary Metrics

| Metric | Formula | Target | Excellent | Good | Acceptable |
|--------|---------|--------|-----------|------|------------|
| **Escape Success** | reached exit? | ✅ Yes | - | - | - |
| **Max Visits** | max(arrivals per node) | ≤2 | ≤2 | ≤3 | ≤5 |
| **Steps/Location** | total steps / unique locations | <5.0 | <2.0 | <5.0 | <10.0 |
| **Turns/100** | (turns / steps) × 100 | <25 | <15 | <25 | <40 |
| **Coverage** | visited / total territory | >80% | >90% | >80% | >50% |

### Secondary Metrics (Walk Logs)

| Metric | Formula | Target |
|--------|---------|--------|
| **Visited/Steps Ratio** | unique locations / total steps | >0.55 |
| **Stuck Ratio** | stuck steps / total steps | <0.20 |
| **Oracle Verification** | verified steps / total steps | >0.90 |

---

## Running Tests

### Full Test Suite

```bash
# Run all tests (151 tests)
npm test
```

### Specific Test Files

```bash
# Territory escape benchmarks (18 tests)
npm test -- src/core/territory-escape.test.js

# Walk log benchmarks (8 tests)
npm test -- src/core/walk-log-benchmark.test.js

# City grid benchmarks (3 tests)
npm test -- src/core/city-grid-benchmark.test.js

# Territory ideal tests (4 tests)
npm test -- src/core/territory-ideal.test.js
```

### Dashboard and Reporting

```bash
# Generate walk log analysis report
node src/core/benchmark-dashboard.js analyze-walks

# Generate benchmark report (JSON)
node src/core/benchmark-dashboard.js generate-report --format=json

# Generate benchmark report (Markdown)
node src/core/benchmark-dashboard.js generate-report --format=md

# Show detailed output
node src/core/benchmark-dashboard.js analyze-walks --verbose
```

---

## Test Output Example

```
📊 Linear 10:
   ✅ Escape: YES
   📍 Coverage: 100.0% (11/11)
   📈 Steps/Location: 1.00
   🔄 Max Visits: 1
   ↩️  Turns/100: 0.0

📊 Cul-de-Sac:
   ✅ Escape: YES
   📍 Coverage: 100.0% (15/15)
   📈 Steps/Location: 1.07
   🔄 Max Visits: 2
   ↩️  Turns/100: 14.3

💪 Linear 1000:
   ✅ Escape: YES
   📍 Coverage: 100.0% (1001/1001)
   📈 Steps/Location: 1.00
   🔄 Max Visits: 1
   ⏱️  Ticks: 2000

📊 COMPREHENSIVE WALK ANALYSIS (53 walks):
   🏆 Best Efficiency:
     dw-logs-1774129363995.txt
     Visited/Steps: 100.0%
     Max Visits: 1
     Steps: 25

   🐌 Worst Efficiency:
     dw-logs-1774156290259.txt
     Visited/Steps: 0.4%
     Max Visits: 278
     Steps: 278

   📈 Efficiency Distribution:
     Excellent (≥0.65): 14 walks (26%)
     Good (≥≥0.55): 12 walks (23%)
     Acceptable (≥0.4): 14 walks (26%)
     Poor (<0.4): 13 walks (25%)
```

---

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `src/core/territory-escape.test.js` | Main benchmark suite (17+ scenarios) | ~850 |
| `src/core/walk-log-benchmark.test.js` | Walk log analysis (65+ walks) | ~400 |
| `src/core/benchmark-dashboard.js` | Dashboard and reporting CLI | ~500 |
| `docs/TERRITORY_ESCAPE_BENCHMARKS.md` | This documentation | - |

---

## Workflow: Rapid Algorithm Iteration

### 1. Make Algorithm Change

Edit `src/core/traversal.js` with your fix or optimization.

### 2. Run Targeted Tests

```bash
# Quick sanity check (fast tests only)
npm test -- src/core/territory-escape.test.js

# Check for regressions on real walks
npm test -- src/core/walk-log-benchmark.test.js
```

### 3. Review Metrics

Look for improvements in:
- **Max Visits:** Should decrease (target: ≤2)
- **Steps/Location:** Should decrease (target: <2.0)
- **Escape Rate:** Should increase (target: 100%)
- **Turns/100:** Should decrease (target: <15)

### 4. Verify No Regressions

```bash
# Full test suite
npm test

# Check baselines
npm test -- src/core/walk-log-benchmark.test.js 2>&1 | grep "Baseline Check"
```

### 5. Generate Report

```bash
# Save comprehensive report
node src/core/benchmark-dashboard.js generate-report --format=md
```

---

## Baseline Policy

### Protected Baselines

Some walks document current algorithm bugs. These baselines are **IMMUTABLE**:

| Walk | Min Visited/Steps | Max Max Visits | Documents |
|------|-------------------|----------------|-----------|
| `dw-logs-1774820738896.txt` | 0.40 | 15 | Wall-follow stuck bug |
| `dw-logs-1774812201528.txt` | 0.30 | 15 | Wall-follow loop bug |

### Updating Baselines

**After fixing a bug:**
1. Document the fix in `docs/WALK_REPORTS.md`
2. Update baseline with justification
3. Verify improvement with before/after comparison

```bash
# Before fix
npm test -- src/core/walk-log-benchmark.test.js 2>&1 | tee before.txt

# After fix
npm test -- src/core/walk-log-benchmark.test.js 2>&1 | tee after.txt

# Compare
diff before.txt after.txt
```

---

## Troubleshooting

### Test Fails on Specific Scenario

1. **Check territory connectivity:**
   ```javascript
   const connections = oracle.getConnections(location);
   console.log(connections);  // Should show valid exits
   ```

2. **Verify mock Street View:**
   ```javascript
   // Test movement manually
   mockSV.initialize(startLoc, startYaw);
   mockSV.handleKeyPress('ArrowUp');
   console.log(mockSV.currentLocation);  // Should have moved
   ```

3. **Check algorithm decision:**
   ```bash
   # Enable debug logging
   npm test -- src/core/territory-escape.test.js 2>&1 | grep "decide()"
   ```

### Walk Log Parsing Fails

1. **Verify log format:**
   ```bash
   head -20 walks/dw-logs-*.txt
   # Should have: [21:00:00] 💓 [326] STUCK: 0 | YAW: 18° | LOC: ...
   ```

2. **Check regex pattern:**
   ```javascript
   // In walk-log-benchmark.test.js
   const stepMatch = line.match(/\[\d+:\d+:\d+\]\s+💓\s+\[(\d+)\]\s+STUCK:\s*(\d+)\s*\|.../);
   ```

### Stress Tests Timeout

Stress tests have relaxed requirements:
- **Max Visits:** ≤9 (3× normal limit)
- **Coverage:** Not enforced (may not finish in time)
- **Purpose:** Measure algorithm health under load, not completion

---

## Performance Benchmarks

### Test Execution Times

| Suite | Tests | Duration | Avg per Test |
|-------|-------|----------|--------------|
| Territory Escape | 18 | ~35s | 1.9s |
| Walk Log | 8 | ~2s | 0.25s |
| City Grid | 3 | ~3s | 1.0s |
| Territory Ideal | 4 | ~1s | 0.25s |
| **Total** | **151** | **~45s** | **0.3s** |

### Memory Usage

- **Synthetic scenarios:** <50 MB
- **Walk log analysis:** <100 MB
- **Stress tests:** <200 MB

---

## Future Enhancements

### Planned Additions

1. **Visual Debugger:** Interactive territory visualization
2. **Scenario Generator:** Procedural territory generation
3. **Performance Profiling:** CPU/memory tracking per scenario
4. **Comparison Mode:** Side-by-side algorithm version comparison
5. **CI Integration:** Automated benchmark tracking

### Contributing

To add new scenarios:
1. Add generator to `TerritoryGenerators` object
2. Add test to appropriate suite
3. Document expected behavior
4. Update this documentation

---

## Related Documentation

- `docs/WALK_DRIVEN_DEVELOPMENT.md` - Walk-driven development workflow
- `docs/WALK_REPORTS.md` - Walk reports and bug documentation
- `docs/HOW_IT_WALKS.md` - PLEDGE algorithm explanation
- `src/README.md` - Developer guide

---

*The Territory Escape Benchmark Suite enables rapid algorithm iteration without running real walks. All changes should be validated against this suite before deployment.*
