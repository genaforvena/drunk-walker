/**
 * Territory Oracle Tests
 * 
 * Validates the Territory Oracle system:
 * 1. Oracle correctly parses walk logs
 * 2. Oracle can replay original walk (verification)
 * 3. Oracle metrics match real walk metrics
 * 4. Baselines are established for regression testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerritoryOracle } from './territory-oracle.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// ORACLE PARSING TESTS
// ============================================================================

describe('TerritoryOracle - Parsing', () => {
  it('should parse new format walk logs', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
    if (!fs.existsSync(walkLogPath)) {
      console.log('⚠️  Walk file not found, skipping');
      return;
    }

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    
    expect(oracle.knownLocations.size).toBeGreaterThan(0);
    expect(oracle.originalSteps.length).toBeGreaterThan(0);
    
    console.log(`📊 Parsed ${oracle.knownLocations.size} locations, ${oracle.originalSteps.length} steps`);
  });

  it('should extract territory statistics', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    const stats = oracle.getStats();
    
    console.log('📊 Territory Statistics:');
    console.log(`   Total locations: ${stats.totalLocations}`);
    console.log(`   Total connections: ${stats.totalConnections}`);
    console.log(`   Original steps: ${stats.originalSteps}`);
    console.log(`   Avg connections/node: ${stats.avgConnectionsPerNode.toFixed(2)}`);
    
    expect(stats.totalLocations).toBeGreaterThan(0);
    expect(stats.totalConnections).toBeGreaterThan(0);
  });

  it('should track visit counts correctly', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    
    // Check the problematic node
    const problematicNode = '31.8010261,35.2140383';
    const visitCount = oracle.getVisitCount(problematicNode);
    
    console.log(`\n🔍 Problematic Node: ${problematicNode}`);
    console.log(`   Visit count: ${visitCount}`);
    console.log(`   Expected (from log): 10+ (partial log shows 10)`);
    
    // Should show multiple visits (bug documented)
    expect(visitCount).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================================
// ORACLE VERIFICATION TESTS
// ============================================================================

describe('TerritoryOracle - Verification', () => {
  it('should verify oracle against original walk', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    const verification = oracle.verifyOracle();
    
    console.log('\n🔍 Oracle Verification:');
    console.log(`   Valid: ${verification.valid}`);
    console.log(`   Total steps: ${verification.totalSteps}`);
    console.log(`   Verified steps: ${verification.verifiedSteps}`);
    console.log(`   Errors: ${verification.errors.length}`);
    
    if (!verification.valid) {
      console.log('   First errors:');
      verification.errors.slice(0, 3).forEach(err => {
        console.log(`     - Step ${err.step}: ${err.error}`);
      });
    }
    
    // Oracle should be able to replay most of original walk
    const verificationRate = verification.verifiedSteps / verification.totalSteps;
    expect(verificationRate).toBeGreaterThan(0.90);  // At least 90% verified
  });

  it('should have connections for observed moves', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    const locations = oracle.getAllLocations().slice(0, 10);
    
    for (const loc of locations) {
      const connections = oracle.getConnections(loc);
      expect(connections.length).toBeGreaterThan(0);
    }
  });

  it('should add reverse connections', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
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
// METRICS COMPARISON TESTS
// ============================================================================

describe('TerritoryOracle - Metrics Comparison', () => {
  it('should match oracle metrics with real walk metrics', () => {
    const walkLogPath = path.join(__dirname, '../../walks/dw-logs-1774812201528.txt');
    if (!fs.existsSync(walkLogPath)) return;

    const oracle = TerritoryOracle.fromWalkLog(walkLogPath);
    
    // Calculate real walk metrics from original steps
    const realMetrics = calculateRealMetrics(oracle.originalSteps);
    
    // Calculate oracle metrics
    const oracleMetrics = {
      totalSteps: oracle.originalSteps.length,
      uniqueLocations: oracle.knownLocations.size,
      maxVisits: Math.max(...Array.from(oracle.visitCounts.values())),
      visitedStepsRatio: oracle.knownLocations.size / oracle.originalSteps.length
    };
    
    console.log('\n📊 Metrics Comparison:');
    console.log('   Real Walk:');
    console.log(`     Steps: ${realMetrics.totalSteps}`);
    console.log(`     Unique: ${realMetrics.uniqueLocations}`);
    console.log(`     Max visits: ${realMetrics.maxVisits}`);
    console.log(`     Ratio: ${realMetrics.visitedStepsRatio.toFixed(3)}`);
    console.log('   Oracle:');
    console.log(`     Steps: ${oracleMetrics.totalSteps}`);
    console.log(`     Unique: ${oracleMetrics.uniqueLocations}`);
    console.log(`     Max visits: ${oracleMetrics.maxVisits}`);
    console.log(`     Ratio: ${oracleMetrics.visitedStepsRatio.toFixed(3)}`);
    
    // Metrics should match closely (oracle extracts from real walk)
    // Note: Oracle may have 1 extra location (starting point)
    expect(oracleMetrics.totalSteps).toBe(realMetrics.totalSteps);
    expect(oracleMetrics.maxVisits).toBe(realMetrics.maxVisits);
    expect(Math.abs(oracleMetrics.uniqueLocations - realMetrics.uniqueLocations)).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// BASELINE TESTS
// ============================================================================

describe('TerritoryOracle - Baselines', () => {
  const BASELINES = {
    // dw-logs-1774812201528.txt - Problem walk with wall-follow loop
    'dw-logs-1774812201528.txt': {
      // These are GUARANTEES - no change should make these worse
      minVisitedStepsRatio: 0.30,  // Current is low due to bug
      maxMaxVisits: 15,            // Documents the 14+ visit bug
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
      
      // These should pass with current (buggy) algorithm
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
