/**
 * Ideal Territory Integration Tests
 * 
 * Tests the ACTUAL engine and algorithm against SYNTHETIC territories.
 * Uses StreetViewMock to simulate Street View without Google.
 * 
 * KEY METRIC: How FAST the algorithm escapes/visits all locations
 * - Steps/Location: Lower is better (1.0 = perfect)
 * - Max Visits: Lower is better (2 = PLEDGE guarantee)
 * 
 * FAST VERSION: Suppresses debug output, smaller territories
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTerritoryOracle, runIntegrationTest } from './streetview-mock.js';

// Suppress debug console output during tests for speed
let originalConsole;
let nullConsole;

beforeAll(() => {
  originalConsole = console.log;
  nullConsole = () => {};
  // Only show test results, not debug output
  console.log = (...args) => {
    if (args[0] && (args[0].includes('📏') || args[0].includes('🔲') || args[0].includes('🔶') || args[0].includes('📊'))) {
      originalConsole(...args);
    } else {
      nullConsole(...args);
    }
  };
});

afterAll(() => {
  console.log = originalConsole;
});

// ============================================================================
// INTEGRATION TESTS (FAST VERSION)
// ============================================================================

describe('Ideal Territory Integration Tests', () => {

  it('should escape 100-node linear street efficiently', () => {
    const oracle = createTerritoryOracle('linear', 100);
    const results = runIntegrationTest(oracle, {}, 300);

    originalConsole('\n📏 Linear Street (100 nodes):');
    originalConsole(`   Steps/Location: ${results.stepsPerLocation.toFixed(2)} (target: <5.0)`);
    originalConsole(`   Max visits: ${results.maxVisits} (target: <100)`);

    expect(results.stepsPerLocation).toBeLessThan(5.0);
    expect(results.maxVisits).toBeLessThanOrEqual(100);
  });

  it('should escape 10x10 square grid', () => {
    const oracle = createTerritoryOracle('square', 10, 10);
    const results = runIntegrationTest(oracle, {}, 500);

    originalConsole('\n🔲 Square Grid (10x10 = 100 nodes):');
    originalConsole(`   Steps/Location: ${results.stepsPerLocation.toFixed(2)} (target: <50.0)`);
    originalConsole(`   Max visits: ${results.maxVisits} (target: <500)`);

    expect(results.stepsPerLocation).toBeLessThan(50.0);
    expect(results.maxVisits).toBeLessThanOrEqual(500);
  });

  it('should escape hexagonal grid efficiently', () => {
    const oracle = createTerritoryOracle('hex', 5);
    const results = runIntegrationTest(oracle, {}, 500);

    originalConsole('\n🔶 Hexagonal Grid (radius 5):');
    originalConsole(`   Steps/Location: ${results.stepsPerLocation.toFixed(2)} (target: <10.0)`);
    originalConsole(`   Max visits: ${results.maxVisits} (target: <1000)`);

    expect(results.stepsPerLocation).toBeLessThan(10.0);
    expect(results.maxVisits).toBeLessThanOrEqual(1000);
  });

  it('should show consistent performance', () => {
    const results = {
      linear: runIntegrationTest(createTerritoryOracle('linear', 100), {}, 300),
      square: runIntegrationTest(createTerritoryOracle('square', 10, 10), {}, 500),
      hex: runIntegrationTest(createTerritoryOracle('hex', 5), {}, 500)
    };

    originalConsole('\n📊 Performance Comparison:');
    originalConsole(`   Linear: ${results.linear.stepsPerLocation.toFixed(2)} steps/location`);
    originalConsole(`   Square: ${results.square.stepsPerLocation.toFixed(2)} steps/location`);
    originalConsole(`   Hex: ${results.hex.stepsPerLocation.toFixed(2)} steps/location`);

    expect(results.linear.stepsPerLocation).toBeLessThan(10.0);
    expect(results.square.stepsPerLocation).toBeLessThan(100.0);
    expect(results.hex.stepsPerLocation).toBeLessThan(10.0);
  });
});
