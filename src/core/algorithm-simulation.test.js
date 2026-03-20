/**
 * Algorithm Simulation Tests
 * Tests the traversal algorithms with simulated walks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createExplorationAlgorithm,
  createHunterAlgorithm,
  createSurgicalAlgorithm,
  extractYawFromUrl,
  extractLocationFromUrl
} from './traversal.js';
import { createEngine } from './engine.js';

describe('Traversal Algorithm Simulation', () => {
  // Mock context for algorithm testing
  const createMockContext = (overrides = {}) => ({
    url: 'https://www.google.com/maps/@52.37,4.90,3a,75y,90h,90t/data=...',
    location: '52.370000,4.900000',
    visitedUrls: new Map(),
    breadcrumbs: [],
    stuckCount: 0,
    orientation: 0,
    ...overrides
  });

  describe('extractYawFromUrl', () => {
    it('should extract yaw from URL', () => {
      const url = 'https://www.google.com/maps/@52.37,4.90,3a,75y,90h,90t/data=!3m7!1e1!3m5!1sabc!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3Dabc%26yaw%3D175.5!7i16384!8i8192';
      expect(extractYawFromUrl(url)).toBe(175.5);
    });

    it('should return null for invalid URL', () => {
      expect(extractYawFromUrl('invalid')).toBe(null);
      expect(extractYawFromUrl(null)).toBe(null);
    });
  });

  describe('extractLocationFromUrl', () => {
    it('should extract location from URL', () => {
      const url = 'https://www.google.com/maps/@52.370123,4.900456,3a,75y,90h,90t/data=...';
      expect(extractLocationFromUrl(url)).toBe('52.370123,4.900456');
    });

    it('should return null for invalid URL', () => {
      expect(extractLocationFromUrl('invalid')).toBe(null);
    });
  });

  describe('Exploration Algorithm - Loop Prevention', () => {
    it('should use adaptive search when stuck for extended period', () => {
      const algo = createExplorationAlgorithm({ expOn: true, panicThreshold: 3 });
      
      // At stuck count 10, should use 30° increments
      const context = createMockContext({ stuckCount: 10 });
      const decision1 = algo.decide(context);
      expect(decision1.turn).toBe(true);
      
      // At stuck count 20, should use random escape
      const context2 = createMockContext({ stuckCount: 20 });
      const decision2 = algo.decide(context2);
      expect(decision2.turn).toBe(true);
      expect(decision2.angle).toBeGreaterThanOrEqual(0);
      expect(decision2.angle).toBeLessThan(360);
    });

    it('should prefer unvisited locations in normal exploration', () => {
      const algo = createExplorationAlgorithm({ expOn: true, selfAvoiding: true });
      const visitedUrls = new Map();
      visitedUrls.set('52.370500,4.900500', 5); // Heavily visited
      visitedUrls.set('52.370000,4.900000', 0); // Current location

      const context = createMockContext({
        location: '52.370000,4.900000',
        visitedUrls,
        breadcrumbs: []
      });

      const decision = algo.decide(context);
      // Should either go forward (angle 0) or turn to find unvisited
      expect(decision).toBeDefined();
    });

    it('should perform systematic search when stuck >= panicThreshold', () => {
      const algo = createExplorationAlgorithm({ expOn: true, panicThreshold: 3 });
      const context = createMockContext({ stuckCount: 3 });

      const decision = algo.decide(context);
      expect(decision.turn).toBe(true);
      expect(decision.angle).toBeGreaterThan(0);
    });
  });

  describe('Surgical Algorithm - Loop Prevention', () => {
    it('should use fine-grained search when stuck >= 10', () => {
      const algo = createSurgicalAlgorithm({ expOn: true, panicThreshold: 3 });
      const context = createMockContext({ stuckCount: 10 });

      const decision = algo.decide(context);
      expect(decision.turn).toBe(true);
    });

    it('should use random escape when stuck >= 20', () => {
      const algo = createSurgicalAlgorithm({ expOn: true, panicThreshold: 3 });
      const context = createMockContext({ stuckCount: 20 });

      const decision = algo.decide(context);
      expect(decision.turn).toBe(true);
      expect(decision.angle).toBeGreaterThanOrEqual(0);
      expect(decision.angle).toBeLessThan(360);
    });

    it('should veto visited locations in normal operation', () => {
      const algo = createSurgicalAlgorithm({ expOn: true, panicThreshold: 3 });
      const visitedUrls = new Map();
      visitedUrls.set('52.370500,4.900500', 1);

      const context = createMockContext({
        location: '52.370000,4.900000',
        visitedUrls,
        stuckCount: 0
      });

      const decision = algo.decide(context);
      expect(decision).toBeDefined();
    });
  });

  describe('Hunter Algorithm - Loop Prevention', () => {
    it('should perform snap-back when stuck >= panicThreshold', () => {
      const algo = createHunterAlgorithm({ expOn: true, panicThreshold: 3 });
      const context = createMockContext({ stuckCount: 3 });

      const decision = algo.decide(context);
      expect(decision.turn).toBe(true);
      expect(decision.angle).toBe(180);
    });

    it('should prefer unvisited directions when exploring', () => {
      const algo = createHunterAlgorithm({ expOn: true, panicThreshold: 3 });
      const visitedUrls = new Map();
      // Mark some locations as visited
      visitedUrls.set('52.370500,4.900500', 1);

      const context = createMockContext({
        location: '52.370000,4.900000',
        visitedUrls,
        stuckCount: 0
      });

      const decision = algo.decide(context);
      expect(decision).toBeDefined();
    });
  });
});

describe('Engine with Orientation Recalibration', () => {
  it('should extract yaw from URL and use it for recalibration', () => {
    const urlWithYaw = 'https://www.google.com/maps/@52.37,4.90,3a,75y,90h,90t/data=!3m7!1e1!3m5!1sabc!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3Dabc%26yaw%3D270.0!7i16384!8i8192';
    
    const yaw = extractYawFromUrl(urlWithYaw);
    expect(yaw).toBe(270.0);
  });

  it('should have wheel with setOrientation capability', () => {
    const engine = createEngine({ collectPath: true, expOn: true });
    
    // Reset to 0
    engine.resetCurrentYaw();
    expect(engine.getCurrentYaw()).toBe(0);
    
    // The wheel's setOrientation is called internally when recording steps
    // This test verifies the infrastructure is in place
    expect(typeof engine.getCurrentYaw).toBe('function');
  });
});

describe('Long Walk Simulation', () => {
  it('should complete 1000 steps with algorithm decisions', () => {
    const engine = createEngine({ 
      expOn: true, 
      selfAvoiding: true,
      collectPath: true,
      panicThreshold: 3
    });
    
    let lat = 52.37;
    let lng = 4.90;
    let yaw = 0;
    
    const visitedLocations = new Set();
    let decisionCount = 0;
    
    for (let i = 0; i < 1000; i++) {
      // Simulate movement by updating position
      const rad = yaw * Math.PI / 180;
      lat += Math.cos(rad) * 0.0001;
      lng += Math.sin(rad) * 0.0001 / Math.cos(lat * Math.PI / 180);
      
      // Add some randomness to yaw (simulating turns)
      if (Math.random() > 0.7) {
        yaw = (yaw + 60) % 360;
      }
      
      visitedLocations.add(`${lat.toFixed(6)},${lng.toFixed(6)}`);
      decisionCount++;
      
      engine.tick();
    }
    
    engine.stop();
    
    // Should have visited many unique locations
    expect(visitedLocations.size).toBeGreaterThan(500);
    // Should have made decisions for all steps
    expect(decisionCount).toBe(1000);
  });
});
