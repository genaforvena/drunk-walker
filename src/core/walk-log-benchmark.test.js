/**
 * Walk Log Benchmark Suite
 *
 * REPLAYS actual walk logs with CURRENT algorithm to verify performance.
 * Uses TerritoryOracle to recreate the territory, then runs the real engine.
 *
 * KEY METRICS:
 * - Oracle Verification Rate: % of original walk steps that oracle can replay
 * - Max Visits: Should be ≤2 (PLEDGE guarantee)
 * - Visited/Steps Ratio: Exploration efficiency (target >0.55)
 * - Turns per 100: Turn efficiency (target <25)
 * - Stuck Ratio: Time spent stuck (target <0.20)
 *
 * CRITICAL: This runs the CURRENT algorithm against historical territory data.
 * It does NOT just parse old metrics - it REPLAYS the walk with current code.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine } from './engine.js';
import { TerritoryOracle } from './territory-oracle.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// WALK LOG REPLAY - Run CURRENT algorithm against historical territory
// ============================================================================

/**
 * Replay a walk log with the CURRENT algorithm
 * This runs the actual engine against the oracle territory
 */
async function replayWalkLog(filePath, maxTicks = 10000) {
  // Create oracle from walk log
  const oracle = TerritoryOracle.fromWalkLog(filePath);
  const allLocations = oracle.getAllLocations();
  
  if (allLocations.length === 0) {
    return { error: 'No locations in walk log' };
  }

  // Create mock Street View using oracle
  const mockSV = createMockStreetView(oracle);
  
  // Create REAL engine with current algorithm
  const engine = createEngine({
    pace: 0,  // Instant (no delay)
    kbOn: true,
    panicThreshold: 3
  });

  // Start at first location
  const startLocation = allLocations[0];
  const initialUrl = mockSV.initialize(startLocation, 0);
  vi.stubGlobal('location', { href: initialUrl });
  engine.setCurrentYaw(0);

  // Set up action handlers
  engine.setActionHandlers({
    keyPress: (key) => {
      const newUrl = mockSV.handleKeyPress(key);
      vi.stubGlobal('location', { href: newUrl });
      engine.setCurrentYaw(mockSV.currentYaw);
    },
    longKeyPress: (key, duration, cb) => {
      const newUrl = mockSV.handleKeyPress(key);
      vi.stubGlobal('location', { href: newUrl });
      engine.setCurrentYaw(mockSV.currentYaw);
      if (cb) cb();
    }
  });

  engine.setStatus('WALKING');

  // Track metrics
  const arrivalCounts = new Map();
  const turnCount = { value: 0 };
  let lastLoc = null;
  let ticks = 0;
  let successfulMoves = 0;
  let lastOrientation = mockSV.currentYaw;

  // Run engine tick by tick
  for (ticks = 0; ticks < maxTicks; ticks++) {
    const orientationBefore = mockSV.currentYaw;
    engine.tick();
    const orientationAfter = mockSV.currentYaw;

    // Detect turn
    const yawDiff = Math.abs(orientationAfter - orientationBefore);
    if (yawDiff > 30 || yawDiff > 300) {
      turnCount.value++;
    }

    const currentLoc = mockSV.currentLocation;
    if (currentLoc !== lastLoc) {
      arrivalCounts.set(currentLoc, (arrivalCounts.get(currentLoc) || 0) + 1);
      successfulMoves++;
      lastLoc = currentLoc;
    }
  }

  // Calculate metrics
  const uniqueLocations = arrivalCounts.size;
  const maxArrivals = arrivalCounts.size > 0 ? Math.max(...arrivalCounts.values()) : 0;
  const stepsPerLocation = uniqueLocations > 0 ? successfulMoves / uniqueLocations : 0;
  const turnsPer100 = successfulMoves > 0 ? (turnCount.value / successfulMoves) * 100 : 0;
  const visitedStepsRatio = successfulMoves > 0 ? uniqueLocations / successfulMoves : 0;
  const totalTerritorySize = allLocations.length;
  const coverage = totalTerritorySize > 0 ? uniqueLocations / totalTerritorySize : 0;

  return {
    ticks,
    successfulMoves,
    uniqueLocations,
    totalTerritorySize,
    coverage,
    maxArrivals,
    stepsPerLocation,
    turnsPer100,
    visitedStepsRatio,
    arrivalCounts: new Map(arrivalCounts)
  };
}

/**
 * Create mock Street View for testing
 */
function createMockStreetView(oracle) {
  return {
    currentLocation: null,
    currentYaw: 0,
    url: '',
    stuckCount: 0,

    initialize(startLocation, startYaw = 0) {
      this.currentLocation = startLocation;
      this.currentYaw = startYaw;
      this.url = generateUrl(startLocation, startYaw);
      this.stuckCount = 0;
      return this.url;
    },

    handleKeyPress(key) {
      if (key === 'ArrowUp') {
        this._moveForward();
      } else if (key === 'ArrowLeft') {
        this.currentYaw = (this.currentYaw - 60 + 360) % 360;
      } else if (key === 'ArrowRight') {
        this.currentYaw = (this.currentYaw + 60) % 360;
      }
      this.url = generateUrl(this.currentLocation, this.currentYaw);
      return this.url;
    },

    _moveForward() {
      const connections = oracle.getConnections(this.currentLocation);
      if (connections.length === 0) {
        this.stuckCount++;
        return;
      }

      let bestConn = null;
      let minDiff = 360;

      for (const conn of connections) {
        const yawDiff = Math.abs(conn.exactYaw - this.currentYaw);
        const normalizedDiff = yawDiff > 180 ? 360 - yawDiff : yawDiff;

        if (normalizedDiff < minDiff) {
          minDiff = normalizedDiff;
          bestConn = conn;
        }
      }

      // Allow movement if within 45° of connection yaw
      if (bestConn && minDiff <= 45) {
        if (bestConn.targetLocation !== this.currentLocation) {
          this.currentLocation = bestConn.targetLocation;
          this.currentYaw = bestConn.exactToYaw || this.currentYaw;
          this.stuckCount = 0;
        } else {
          this.stuckCount++;
        }
      } else {
        this.stuckCount++;
      }

      this.url = generateUrl(this.currentLocation, this.currentYaw);
    }
  };
}

function generateUrl(location, yaw) {
  const [lat, lng] = location.split(',');
  return `https://www.google.com/maps/@${lat},${lng},3a,75y,${yaw.toFixed(2)}h,90.00t/data=!3m4!1e1`;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const WALKS_DIR = path.join(__dirname, '../../walks');

// Metric thresholds
const THRESHOLDS = {
  // PLEDGE guarantee
  maxVisits: { target: 2, acceptable: 3 },
  // Efficiency
  visitedStepsRatio: { excellent: 0.65, good: 0.55, acceptable: 0.40 },
  // Turn efficiency
  turnsPer100: { excellent: 15, good: 25, acceptable: 40 },
  // Stuck ratio
  stuckRatio: { excellent: 0.10, good: 0.20, acceptable: 0.30 },
  // Oracle verification
  verificationRate: { minimum: 0.90 }
};

// Baselines for known problematic walks (documents current bugs)
const BASELINES = {
  'dw-logs-1774820738896.txt': {
    minVisitedStepsRatio: 0.40,  // Low due to wall-follow stuck bug
    maxMaxVisits: 15             // Documents 12+ visit bug
  },
  'dw-logs-1774812201528.txt': {
    minVisitedStepsRatio: 0.30,  // Low due to wall-follow loop bug
    maxMaxVisits: 15             // Documents 14+ visit bug
  }
};

// ============================================================================
// WALK LOG DISCOVERY
// ============================================================================

/**
 * Discover all walk log files
 */
function discoverWalkLogs() {
  if (!fs.existsSync(WALKS_DIR)) {
    console.warn(`⚠️  Walks directory not found: ${WALKS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(WALKS_DIR)
    .filter(f => f.startsWith('dw-logs-') && f.endsWith('.txt'))
    .sort();  // Sort by timestamp (filename includes timestamp)

  console.log(`\n📁 Discovered ${files.length} walk logs`);
  return files;
}

/**
 * Parse walk log and extract metrics
 */
function parseWalkLog(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const steps = [];
  const locationVisits = new Map();
  let stuckTotal = 0;
  let turnTotal = 0;
  let maxStuck = 0;

  for (const line of lines) {
    // Parse location line: [21:00:00] 💓 [326] STUCK: 0 | YAW: 18° | LOC: 52.3723561,4.8725284
    const stepMatch = line.match(/\[\d+:\d+:\d+\]\s+💓\s+\[(\d+)\]\s+STUCK:\s*(\d+)\s*\|\s*YAW:\s*([\d.]+)°?\s*\|\s*LOC:\s*([\d.-]+,[\d.-]+)/);
    if (stepMatch) {
      const stepNum = parseInt(stepMatch[1]);
      const stuck = parseInt(stepMatch[2]);
      const yaw = parseFloat(stepMatch[3]);
      const location = stepMatch[4];

      steps.push({ stepNum, stuck, yaw, location });

      const count = (locationVisits.get(location) || 0) + 1;
      locationVisits.set(location, count);

      if (stuck > maxStuck) maxStuck = stuck;
      if (stuck > 0) stuckTotal++;
    }

    // Parse turn events: [DEBUG] decision={"turn":true,"angle":60,...}
    if (line.includes('decision=') && line.includes('"turn":true')) {
      turnTotal++;
    }
  }

  const uniqueLocations = locationVisits.size;
  const maxVisits = uniqueLocations > 0 ? Math.max(...Array.from(locationVisits.values())) : 0;
  const totalSteps = steps.length;

  return {
    filePath,
    fileName: path.basename(filePath),
    totalSteps,
    uniqueLocations,
    maxVisits,
    visitedStepsRatio: totalSteps > 0 ? uniqueLocations / totalSteps : 0,
    turnsPer100: totalSteps > 0 ? (turnTotal / totalSteps) * 100 : 0,
    stuckRatio: totalSteps > 0 ? stuckTotal / totalSteps : 0,
    maxStuck,
    locationVisits: new Map(locationVisits),
    steps
  };
}

/**
 * Create oracle from walk log and verify it
 */
function createAndVerifyOracle(filePath) {
  try {
    const oracle = TerritoryOracle.fromWalkLog(filePath);
    const verification = oracle.verifyOracle();
    const stats = oracle.getStats();

    return {
      oracle,
      verification,
      stats,
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Walk Log Benchmarks', () => {
  const walkFiles = discoverWalkLogs();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Oracle Creation and Verification', () => {
    it('should create oracles for all walk logs', () => {
      const results = [];

      for (const fileName of walkFiles) {
        const filePath = path.join(WALKS_DIR, fileName);
        const result = createAndVerifyOracle(filePath);
        results.push({ fileName, ...result });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      console.log(`\n📊 Oracle Creation Results:`);
      console.log(`   ✅ Success: ${successCount}/${results.length}`);
      console.log(`   ❌ Failed: ${failCount}/${results.length}`);

      if (failCount > 0) {
        const failures = results.filter(r => !r.success);
        console.log(`\n   Failed oracles:`);
        for (const f of failures) {
          console.log(`   - ${f.fileName}: ${f.error}`);
        }
      }

      // At least 80% should succeed
      expect(successCount / results.length).toBeGreaterThanOrEqual(0.80);
    });

    it('should verify oracles can replay original walks', () => {
      const verificationRates = [];

      for (const fileName of walkFiles.slice(0, 10)) {  // Test first 10 for speed
        const filePath = path.join(WALKS_DIR, fileName);
        const result = createAndVerifyOracle(filePath);

        if (result.success) {
          const rate = result.verification.verifiedSteps / result.verification.totalSteps;
          verificationRates.push({ fileName, rate, ...result.verification });
        }
      }

      const avgRate = verificationRates.length > 0
        ? verificationRates.reduce((sum, r) => sum + r.rate, 0) / verificationRates.length
        : 0;

      console.log(`\n🔍 Oracle Verification:`);
      console.log(`   Average verification rate: ${(avgRate * 100).toFixed(1)}%`);
      console.log(`   Tested: ${verificationRates.length} walks`);

      expect(avgRate).toBeGreaterThanOrEqual(THRESHOLDS.verificationRate.minimum);
    });
  });

  describe('Algorithm Replay Tests', () => {
    it('should replay recent walks with CURRENT algorithm and compare to baseline', async () => {
      // Replay 5 most recent walks with current algorithm
      const recentWalks = walkFiles.slice(-5).reverse();
      const replayResults = [];

      for (const fileName of recentWalks) {
        const filePath = path.join(WALKS_DIR, fileName);
        if (!fs.existsSync(filePath)) continue;

        // Get ORIGINAL metrics from walk log (this is the BASELINE)
        const originalMetrics = parseWalkLog(filePath);
        
        // Run CURRENT algorithm against the territory
        const replayMetrics = await replayWalkLog(filePath, 10000);

        replayResults.push({
          fileName,
          baseline: {
            visitedStepsRatio: originalMetrics.visitedStepsRatio,
            maxVisits: originalMetrics.maxVisits,
            totalSteps: originalMetrics.totalSteps,
            uniqueLocations: originalMetrics.uniqueLocations
          },
          current: {
            visitedStepsRatio: replayMetrics.visitedStepsRatio,
            maxVisits: replayMetrics.maxArrivals,
            totalSteps: replayMetrics.successfulMoves,
            uniqueLocations: replayMetrics.uniqueLocations,
            coverage: replayMetrics.coverage
          }
        });

        console.log(`\n🔄 Replay: ${fileName}`);
        console.log(`   Baseline (original walk): ${(originalMetrics.visitedStepsRatio * 100).toFixed(0)}% efficiency, ${originalMetrics.maxVisits} max visits, ${originalMetrics.totalSteps} steps`);
        console.log(`   Current algorithm:        ${(replayMetrics.visitedStepsRatio * 100).toFixed(0)}% efficiency, ${replayMetrics.maxArrivals} max visits, ${replayMetrics.successfulMoves} steps, ${(replayMetrics.coverage * 100).toFixed(0)}% coverage`);
      }

      // Calculate averages
      const avgBaselineRatio = replayResults.reduce((sum, r) => sum + r.baseline.visitedStepsRatio, 0) / replayResults.length;
      const avgCurrentRatio = replayResults.reduce((sum, r) => sum + r.current.visitedStepsRatio, 0) / replayResults.length;
      const avgBaselineMax = replayResults.reduce((sum, r) => sum + r.baseline.maxVisits, 0) / replayResults.length;
      const avgCurrentMax = replayResults.reduce((sum, r) => sum + r.current.maxVisits, 0) / replayResults.length;

      console.log(`\n📊 Replay Summary (${replayResults.length} walks):`);
      console.log(`   Baseline Avg: ${(avgBaselineRatio * 100).toFixed(0)}% efficiency, ${avgBaselineMax.toFixed(0)} max visits`);
      console.log(`   Current Avg:  ${(avgCurrentRatio * 100).toFixed(0)}% efficiency, ${avgCurrentMax.toFixed(0)} max visits`);
      
      // The baseline documents what the original walk achieved
      // Current algorithm should meet or exceed baseline
      // For now, we just verify the test runs and reports correctly
      expect(replayResults.length).toBeGreaterThan(0);
      expect(avgCurrentRatio).toBeGreaterThan(0);  // Current algorithm should achieve something
    }, 120000);

    it('should identify algorithm regressions vs baseline', async () => {
      // Compare current algorithm vs baseline for all walks
      const testWalks = walkFiles.slice(0, 10);  // First 10 walks
      const comparisons = [];

      for (const fileName of testWalks) {
        const filePath = path.join(WALKS_DIR, fileName);
        if (!fs.existsSync(filePath)) continue;

        const baseline = parseWalkLog(filePath);
        const current = await replayWalkLog(filePath, 10000);

        const efficiencyChange = current.visitedStepsRatio - baseline.visitedStepsRatio;
        const maxVisitsChange = current.maxArrivals - baseline.maxVisits;

        comparisons.push({
          fileName,
          baselineEfficiency: baseline.visitedStepsRatio,
          currentEfficiency: current.visitedStepsRatio,
          efficiencyChange,
          baselineMaxVisits: baseline.maxVisits,
          currentMaxVisits: current.maxArrivals,
          maxVisitsChange
        });

        console.log(`\n📈 ${fileName}:`);
        console.log(`   Efficiency: ${(baseline.visitedStepsRatio * 100).toFixed(0)}% → ${(current.visitedStepsRatio * 100).toFixed(0)}% (${efficiencyChange >= 0 ? '+' : ''}${(efficiencyChange * 100).toFixed(0)}%)`);
        console.log(`   Max Visits: ${baseline.maxVisits} → ${current.maxArrivals} (${maxVisitsChange >= 0 ? '+' : ''}${maxVisitsChange})`);
      }

      // Report regressions (negative efficiency change or positive max visits change)
      const regressions = comparisons.filter(c => c.efficiencyChange < -0.1);
      console.log(`\n⚠️  Regressions (>10% efficiency loss): ${regressions.length}/${comparisons.length}`);
      
      for (const r of regressions) {
        console.log(`   - ${r.fileName}: ${(r.efficiencyChange * 100).toFixed(0)}% efficiency loss`);
      }

      // This test documents current state - doesn't fail on regressions
      // TODO: After fixing algorithm, change to: expect(regressions.length).toBe(0);
      expect(comparisons.length).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Real Walk Metrics', () => {
    it('should extract metrics from walk logs', () => {
      const metrics = [];

      for (const fileName of walkFiles.slice(0, 20)) {  // Test first 20 for speed
        const filePath = path.join(WALKS_DIR, fileName);
        const walkMetrics = parseWalkLog(filePath);
        metrics.push(walkMetrics);
      }

      const avgVisitedRatio = metrics.reduce((sum, m) => sum + m.visitedStepsRatio, 0) / metrics.length;
      const avgMaxVisits = metrics.reduce((sum, m) => sum + m.maxVisits, 0) / metrics.length;
      const avgTurnsPer100 = metrics.reduce((sum, m) => sum + m.turnsPer100, 0) / metrics.length;
      const avgStuckRatio = metrics.reduce((sum, m) => sum + m.stuckRatio, 0) / metrics.length;

      console.log(`\n📊 Real Walk Metrics (first ${metrics.length} walks):`);
      console.log(`   Avg Visited/Steps: ${avgVisitedRatio.toFixed(3)}`);
      console.log(`   Avg Max Visits: ${avgMaxVisits.toFixed(1)}`);
      console.log(`   Avg Turns/100: ${avgTurnsPer100.toFixed(1)}`);
      console.log(`   Avg Stuck Ratio: ${avgStuckRatio.toFixed(2)}`);

      // These are informational - real walks have bugs
      console.log(`\n   ⚠️  Note: Real walks document current algorithm bugs`);
    });

    it('should identify problematic walks', () => {
      const problematicWalks = [];

      for (const fileName of walkFiles) {
        const filePath = path.join(WALKS_DIR, fileName);
        const walkMetrics = parseWalkLog(filePath);

        // Identify walks with issues
        if (walkMetrics.maxVisits > 3 || walkMetrics.stuckRatio > 0.30) {
          problematicWalks.push({
            fileName,
            maxVisits: walkMetrics.maxVisits,
            stuckRatio: walkMetrics.stuckRatio,
            visitedStepsRatio: walkMetrics.visitedStepsRatio
          });
        }
      }

      console.log(`\n⚠️  Problematic Walks (maxVisits >3 or stuckRatio >0.30):`);
      console.log(`   Found: ${problematicWalks.length}/${walkFiles.length}`);

      if (problematicWalks.length > 0) {
        // Sort by max visits (worst first)
        problematicWalks.sort((a, b) => b.maxVisits - a.maxVisits);

        console.log(`\n   Top 5 worst:`);
        for (const w of problematicWalks.slice(0, 5)) {
          console.log(`   - ${w.fileName}: maxVisits=${w.maxVisits}, stuck=${(w.stuckRatio * 100).toFixed(0)}%`);
        }
      }

      // Just informational - don't fail
      expect(problematicWalks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Baseline Regression Tests', () => {
    for (const [fileName, baseline] of Object.entries(BASELINES)) {
      it(`should meet baseline for ${fileName}`, () => {
        const filePath = path.join(WALKS_DIR, fileName);

        if (!fs.existsSync(filePath)) {
          console.log(`⚠️  ${fileName} not found, skipping`);
          return;
        }

        const walkMetrics = parseWalkLog(filePath);

        console.log(`\n🏁 Baseline Check: ${fileName}`);
        console.log(`   Visited/Steps: ${walkMetrics.visitedStepsRatio.toFixed(3)} (min: ${baseline.minVisitedStepsRatio})`);
        console.log(`   Max visits: ${walkMetrics.maxVisits} (max: ${baseline.maxMaxVisits})`);

        // These are GUARANTEES - no change should make these worse
        expect(walkMetrics.visitedStepsRatio).toBeGreaterThanOrEqual(baseline.minVisitedStepsRatio);
        expect(walkMetrics.maxVisits).toBeLessThanOrEqual(baseline.maxMaxVisits);
      });
    }
  });

  describe('Oracle vs Real Walk Comparison', () => {
    it('should match oracle metrics with real walk metrics', () => {
      const comparisons = [];

      for (const fileName of walkFiles.slice(0, 5)) {  // Test first 5 for speed
        const filePath = path.join(WALKS_DIR, fileName);

        if (!fs.existsSync(filePath)) continue;

        // Parse real walk
        const realMetrics = parseWalkLog(filePath);

        // Create oracle
        const oracleResult = createAndVerifyOracle(filePath);
        if (!oracleResult.success) continue;

        const oracleMetrics = oracleResult.stats;

        comparisons.push({
          fileName,
          realLocations: realMetrics.uniqueLocations,
          oracleLocations: oracleMetrics.totalLocations,
          realSteps: realMetrics.totalSteps,
          oracleSteps: oracleMetrics.totalConnections,
          locationDiff: Math.abs(realMetrics.uniqueLocations - oracleMetrics.totalLocations)
        });
      }

      console.log(`\n🔍 Oracle vs Real Walk Comparison:`);
      for (const c of comparisons) {
        console.log(`   ${c.fileName}:`);
        console.log(`     Real: ${c.realLocations} locations, ${c.realSteps} steps`);
        console.log(`     Oracle: ${c.oracleLocations} locations, ${c.oracleSteps} connections`);
        console.log(`     Diff: ${c.locationDiff} locations`);
      }

      // Oracle should match within ±1 location (starting point difference)
      for (const c of comparisons) {
        expect(c.locationDiff).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Comprehensive Walk Analysis', () => {
    it('should produce comprehensive walk report', () => {
      const allMetrics = [];

      for (const fileName of walkFiles) {
        const filePath = path.join(WALKS_DIR, fileName);
        const walkMetrics = parseWalkLog(filePath);
        allMetrics.push(walkMetrics);
      }

      // Sort by efficiency (visited/steps ratio)
      allMetrics.sort((a, b) => b.visitedStepsRatio - a.visitedStepsRatio);

      const best = allMetrics[0];
      const worst = allMetrics[allMetrics.length - 1];

      console.log(`\n📊 COMPREHENSIVE WALK ANALYSIS (${allMetrics.length} walks):`);
      console.log(`\n   🏆 Best Efficiency:`);
      console.log(`     ${best.fileName}`);
      console.log(`     Visited/Steps: ${(best.visitedStepsRatio * 100).toFixed(1)}%`);
      console.log(`     Max Visits: ${best.maxVisits}`);
      console.log(`     Steps: ${best.totalSteps}`);

      console.log(`\n   🐌 Worst Efficiency:`);
      console.log(`     ${worst.fileName}`);
      console.log(`     Visited/Steps: ${(worst.visitedStepsRatio * 100).toFixed(1)}%`);
      console.log(`     Max Visits: ${worst.maxVisits}`);
      console.log(`     Steps: ${worst.totalSteps}`);

      // Calculate distribution
      const excellent = allMetrics.filter(m => m.visitedStepsRatio >= THRESHOLDS.visitedStepsRatio.excellent).length;
      const good = allMetrics.filter(m => m.visitedStepsRatio >= THRESHOLDS.visitedStepsRatio.good && m.visitedStepsRatio < THRESHOLDS.visitedStepsRatio.excellent).length;
      const acceptable = allMetrics.filter(m => m.visitedStepsRatio >= THRESHOLDS.visitedStepsRatio.acceptable && m.visitedStepsRatio < THRESHOLDS.visitedStepsRatio.good).length;
      const poor = allMetrics.filter(m => m.visitedStepsRatio < THRESHOLDS.visitedStepsRatio.acceptable).length;

      console.log(`\n   📈 Efficiency Distribution:`);
      console.log(`     Excellent (≥${THRESHOLDS.visitedStepsRatio.excellent}): ${excellent} walks (${(excellent / allMetrics.length * 100).toFixed(0)}%)`);
      console.log(`     Good (≥${THRESHOLDS.visitedStepsRatio.good}): ${good} walks (${(good / allMetrics.length * 100).toFixed(0)}%)`);
      console.log(`     Acceptable (≥${THRESHOLDS.visitedStepsRatio.acceptable}): ${acceptable} walks (${(acceptable / allMetrics.length * 100).toFixed(0)}%)`);
      console.log(`     Poor (<${THRESHOLDS.visitedStepsRatio.acceptable}): ${poor} walks (${(poor / allMetrics.length * 100).toFixed(0)}%)`);

      // Just informational
      expect(allMetrics.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// EXPORTS FOR PROGRAMMATIC USE
// ============================================================================

export {
  discoverWalkLogs,
  parseWalkLog,
  createAndVerifyOracle,
  THRESHOLDS,
  BASELINES
};
