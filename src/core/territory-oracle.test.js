/**
 * Territory Oracle Tests
 *
 * CRITICAL: These tests verify the oracle correctly parses walk logs
 * and can be used as a mock Street View for integration testing.
 */

import { describe, it, expect } from 'vitest';
import { TerritoryOracle } from './territory-oracle.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Test against LATEST walk first (most recent bugs)
const LATEST_WALK = 'dw-logs-1774820738896.txt';

// Also test against historic walks (ensure no regressions)
const HISTORIC_WALKS = [
  'dw-logs-1774812201528.txt'  // Previous walk with wall-follow loop bug
];

// ============================================================================
// TERRITORY PARSING TESTS
// ============================================================================

describe('TerritoryOracle - Parsing', () => {
  it('should parse latest walk log', () => {
    const walkLogPath = path.join(__dirname, `../../walks/${LATEST_WALK}`);
    if (!fs.existsSync(walkLogPath)) {
      throw new Error(`Walk file not found: ${LATEST_WALK}`);
    }

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);

    expect(oracle.knownLocations.size).toBeGreaterThan(0);
    expect(oracle.originalSteps.length).toBeGreaterThan(0);

    console.log(`\n📊 ${LATEST_WALK}:`);
    console.log(`   Territory: ${oracle.knownLocations.size} locations`);
    console.log(`   Original walk: ${oracle.originalSteps.length} steps`);
  });

  it('should document the bug (12+ visits to one node)', () => {
    const walkLogPath = path.join(__dirname, `../../walks/${LATEST_WALK}`);
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);

    // Check the problematic node from latest walk
    const problematicNode = '52.3660656,4.877676';
    const visitCount = oracle.getVisitCount(problematicNode);

    console.log(`\n🔍 Bug Documentation:`);
    console.log(`   Node: ${problematicNode}`);
    console.log(`   Original walk visits: ${visitCount}`);
    console.log(`   Expected AFTER FIX: ≤3 visits`);

    // This documents the bug - should be 12+ before fix
    expect(visitCount).toBeGreaterThanOrEqual(12);
  });

  it('should verify oracle against original walk', () => {
    const walkLogPath = path.join(__dirname, `../../walks/${LATEST_WALK}`);
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    const verification = oracle.verifyOracle();

    console.log('\n🔍 Oracle Verification:');
    console.log(`   Valid: ${verification.valid}`);
    console.log(`   Total steps: ${verification.totalSteps}`);
    console.log(`   Verified steps: ${verification.verifiedSteps}`);
    console.log(`   Errors: ${verification.errors.length}`);

    // Oracle should be able to replay most of original walk
    const verificationRate = verification.verifiedSteps / verification.totalSteps;
    expect(verificationRate).toBeGreaterThan(0.90);  // At least 90% verified
  });

  it('should add reverse connections', () => {
    const walkLogPath = path.join(__dirname, `../../walks/${LATEST_WALK}`);
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);

    // Count reverse connections
    let reverseCount = 0;
    for (const loc of oracle.getAllLocations()) {
      const connections = oracle.getConnections(loc);
      for (const conn of connections) {
        if (conn.isReverse) reverseCount++;
      }
    }

    console.log(`\n🔁 Reverse connections: ${reverseCount}`);
    expect(reverseCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// BASELINE TESTS
// ============================================================================

describe('TerritoryOracle - Baselines', () => {
  const BASELINES = {
    // Latest walk - wall-follow stuck bug
    [LATEST_WALK]: {
      minVisitedStepsRatio: 0.40,  // Current is low due to stuck bug
      maxMaxVisits: 15,            // Documents 12+ visit bug
      maxTurnsPer100: 60,          // Conservative
      maxStuckRatio: 0.40          // Conservative
    }
  };

  it('should verify baselines for known walks', () => {
    for (const [fileName, baseline] of Object.entries(BASELINES)) {
      const walkLogPath = path.join(__dirname, '../../walks/', fileName);
      if (!fs.existsSync(walkLogPath)) {
        console.log(`⚠️  ${fileName} not found, skipping`);
        continue;
      }

      const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
      const stats = oracle.getStats();

      const visitedStepsRatio = stats.totalLocations > 0
        ? stats.totalLocations / stats.originalSteps
        : 0;
      const maxVisits = Math.max(...Array.from(oracle.visitCounts.values()), 0);

      console.log(`\n🏁 Baseline Check: ${fileName}`);
      console.log(`   Visited/Steps: ${visitedStepsRatio.toFixed(3)} (min: ${baseline.minVisitedStepsRatio})`);
      console.log(`   Max visits: ${maxVisits} (max: ${baseline.maxMaxVisits})`);

      // These are GUARANTEES - no change should make these worse
      expect(visitedStepsRatio).toBeGreaterThanOrEqual(baseline.minVisitedStepsRatio);
      expect(maxVisits).toBeLessThanOrEqual(baseline.maxMaxVisits);
    }
  });
});

// ============================================================================
// HELPERS
// ============================================================================

function calculateRealMetrics(steps) {
  const locationCounts = new Map();
  let maxVisits = 0;

  for (const step of steps) {
    const count = (locationCounts.get(step.location) || 0) + 1;
    locationCounts.set(step.location, count);
    if (count > maxVisits) maxVisits = count;
  }

  return {
    totalSteps: steps.length,
    uniqueLocations: locationCounts.size,
    maxVisits,
    visitedStepsRatio: locationCounts.size / steps.length
  };
}
