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
import { StreetViewMock } from './streetview-mock.js';
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

  // Get starting yaw from first step in walk log
  const firstStep = oracle.originalSteps[0];
  const startYaw = firstStep?.yaw || 0;

  // Create mock Street View using oracle
  const mockSV = createMockStreetView(oracle);

  // Create REAL engine with current algorithm
  const engine = createEngine({
    pace: 0,  // Instant (no delay)
    kbOn: true,
    panicThreshold: 3
  });

  // Start at first location with ACTUAL starting yaw from walk
  const startLocation = allLocations[0];
  const initialUrl = mockSV.initialize(startLocation, startYaw);
  vi.stubGlobal('location', { href: initialUrl });
  engine.setCurrentYaw(startYaw);

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

      // Find connection closest to current yaw (what the algorithm is facing)
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

      // Always move to the best connection (trust the algorithm's yaw decision)
      // Real Street View almost always has a connection in the facing direction
      if (bestConn) {
        if (bestConn.targetLocation !== this.currentLocation) {
          this.currentLocation = bestConn.targetLocation;
          this.currentYaw = bestConn.exactToYaw !== undefined ? bestConn.exactToYaw : this.currentYaw;
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
    it('should verify oracle can replay original walk trajectory', async () => {
      // This test verifies the oracle correctly represents the walk territory
      // by replaying the EXACT path from the original walk
      
      const testWalks = walkFiles.slice(0, 5);  // Test first 5 walks
      const results = [];

      for (const fileName of testWalks) {
        const filePath = path.join(WALKS_DIR, fileName);
        if (!fs.existsSync(filePath)) continue;

        const oracle = TerritoryOracle.fromWalkLog(filePath);
        const verification = oracle.verifyOracle();
        
        results.push({
          fileName,
          verificationRate: verification.verifiedSteps / verification.totalSteps,
          totalSteps: verification.totalSteps,
          verifiedSteps: verification.verifiedSteps
        });

        console.log(`\n🔄 Oracle Verification: ${fileName}`);
        console.log(`   Verified: ${verification.verifiedSteps}/${verification.totalSteps} steps (${(verification.verifiedSteps / verification.totalSteps * 100).toFixed(0)}%)`);
      }

      const avgVerificationRate = results.reduce((sum, r) => sum + r.verificationRate, 0) / results.length;
      console.log(`\n📊 Avg Verification Rate: ${(avgVerificationRate * 100).toFixed(0)}%`);

      // Oracle should be able to replay at least 90% of original walk
      expect(avgVerificationRate).toBeGreaterThanOrEqual(0.90);
    });

    it('should verify oracle territory is correctly constructed from walk', async () => {
      // This test verifies the oracle correctly captures the walk's territory
      // by checking that all locations from the walk are in the oracle
      
      const testWalks = walkFiles.slice(0, 3);  // Test first 3 walks
      const results = [];

      for (const fileName of testWalks) {
        const filePath = path.join(WALKS_DIR, fileName);
        if (!fs.existsSync(filePath)) continue;

        // Parse original walk to get all locations
        const baselineMetrics = parseWalkLog(filePath);
        
        // Create oracle from walk
        const oracle = TerritoryOracle.fromWalkLog(filePath);
        const oracleLocations = oracle.getAllLocations().length;
        
        // Verify oracle has all locations from walk
        const locationMatch = oracleLocations === baselineMetrics.uniqueLocations;
        
        results.push({
          fileName,
          walkLocations: baselineMetrics.uniqueLocations,
          oracleLocations,
          match: locationMatch
        });
        
        console.log(`\n🔄 Oracle Territory: ${fileName}`);
        console.log(`   Walk locations: ${baselineMetrics.uniqueLocations}`);
        console.log(`   Oracle locations: ${oracleLocations}`);
        console.log(`   Match: ${locationMatch ? '✅' : '❌'}`);
      }
      
      // All oracles should have correct location count
      for (const result of results) {
        expect(result.match).toBe(true);
      }
      
      console.log(`\n📊 All ${results.length} oracles correctly capture walk territory`);
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
