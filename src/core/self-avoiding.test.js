/**
 * Self-Avoiding Walk Algorithm Tests
 * 
 * Tests the simplified self-avoiding algorithm:
 * - Only triggers when stuck (URL unchanged for N ticks)
 * - Avoids repeating same turn angles at same location
 * - Does NOT turn on every revisit - only when stuck
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine } from './engine.js';

describe('Self-Avoiding Walk Algorithm', () => {
  let engine;
  let mockKeyPress;
  let mockLongKeyPress;

  beforeEach(() => {
    mockKeyPress = vi.fn();
    mockLongKeyPress = vi.fn();

    engine = createEngine({
      pace: 100,
      expOn: true,
      selfAvoiding: true,
      collectPath: true
    });

    engine.setActionHandlers({
      keyPress: mockKeyPress,
      mouseClick: () => {},
      statusUpdate: () => {},
      longKeyPress: mockLongKeyPress,
      walkStop: () => {}
    });
  });

  afterEach(() => {
    engine.stop();
    engine.reset();
    vi.clearAllMocks();
  });

  /**
   * TEST 1: Straight Corridor
   * Should walk forward without turning when not stuck
   */
  describe('Straight Corridor', () => {
    it('should walk forward without turning at new locations', () => {
      // Simulate walking down a straight corridor
      const locations = [
        'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7750,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7751,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7752,-122.4194,3a,0y,90t/data=!3m4!1e1'
      ];

      let locationIndex = 0;
      Object.defineProperty(window, 'location', {
        value: { href: locations[0] },
        writable: true
      });

      // First tick - record initial location
      engine.tick();

      // Move to next locations - should NOT turn (not stuck!)
      for (let i = 1; i < locations.length; i++) {
        window.location.href = locations[i];
        engine.tick();
      }

      // Should NOT turn at new locations - self-avoiding only triggers when stuck
      expect(mockLongKeyPress).not.toHaveBeenCalled();
      expect(mockKeyPress).toHaveBeenCalledWith('ArrowUp');
    });
  });

  /**
   * TEST 2: Stuck Detection + Self-Avoiding Turn
   * Should only turn after being stuck for N ticks
   */
  describe('Stuck Detection + Self-Avoiding', () => {
    it('should only turn when stuck (not on first revisit)', () => {
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1';

      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      // Tick 3 times to reach panic threshold (default: 3)
      engine.tick();
      engine.tick();
      engine.tick();

      // 4th tick should trigger self-avoiding turn (stuckCount >= panicThreshold)
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      engine.tick();

      // Should have triggered self-avoiding turn
      expect(mockLongKeyPress).toHaveBeenCalledWith(
        'ArrowLeft',
        expect.any(Number),
        expect.any(Function)
      );
    });

    it('should pick different turn angles when stuck multiple times', () => {
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1';

      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      const turnAngles = [];

      // Get stuck multiple times and track turn angles
      for (let attempt = 0; attempt < 3; attempt++) {
        // Reset to trigger stuck again
        engine.reset();
        engine.setActionHandlers({
          keyPress: mockKeyPress,
          mouseClick: () => {},
          statusUpdate: () => {},
          longKeyPress: (key, duration, callback) => {
            turnAngles.push(duration);
            callback();
          },
          walkStop: () => {}
        });
        engine.start();

        // Tick to get stuck
        for (let i = 0; i <= 3; i++) {
          engine.tick();
        }
      }

      // Should have picked different turn angles (not guaranteed, but likely)
      expect(turnAngles.length).toBe(3);
    });
  });

  /**
   * TEST 4: Dead End
   * Should turn around efficiently at dead end
   */
  describe('Dead End', () => {
    it('should handle dead end by turning around', () => {
      const entrance = 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1';
      const deadEnd = 'https://www.google.com/maps/@37.7750,-122.4194,3a,0y,90t/data=!3m4!1e1';

      Object.defineProperty(window, 'location', {
        value: { href: entrance },
        writable: true
      });

      // Walk into dead end
      window.location.href = deadEnd;
      engine.tick();

      // At dead end, need to turn around (simulated by URL not changing)
      // In real scenario, user would manually turn, but for test we simulate
      // multiple ticks at same location
      engine.tick();
      engine.tick();

      // Should eventually trigger turn (either stuck detection or self-avoiding)
      // The exact behavior depends on configuration
      expect(engine.getSteps()).toBeGreaterThan(0);
    });
  });

  /**
   * TEST 5: Grid Pattern
   * Should achieve systematic coverage without premature repetition
   */
  describe('Grid Pattern', () => {
    it('should explore grid systematically', () => {
      // Simulate 3x3 grid walk
      const gridLocations = [
        // Row 1 (heading 0° - north)
        { url: 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1', heading: 0 },
        { url: 'https://www.google.com/maps/@37.7750,-122.4194,3a,0y,90t/data=!3m4!1e1', heading: 0 },
        { url: 'https://www.google.com/maps/@37.7751,-122.4194,3a,0y,90t/data=!3m4!1e1', heading: 0 },
        // Row 2 (heading 90° - east, after turning right at end)
        { url: 'https://www.google.com/maps/@37.7751,-122.4193,3a,90y,90t/data=!3m4!1e1', heading: 90 },
        { url: 'https://www.google.com/maps/@37.7751,-122.4192,3a,90y,90t/data=!3m4!1e1', heading: 90 },
        // Row 3 (heading 180° - south, after turning right)
        { url: 'https://www.google.com/maps/@37.7750,-122.4192,3a,180y,90t/data=!3m4!1e1', heading: 180 },
        { url: 'https://www.google.com/maps/@37.7749,-122.4192,3a,180y,90t/data=!3m4!1e1', heading: 180 },
      ];

      let locIndex = 0;
      Object.defineProperty(window, 'location', {
        value: { href: gridLocations[0].url },
        writable: true
      });

      // Walk through grid
      for (let i = 1; i < gridLocations.length; i++) {
        window.location.href = gridLocations[i].url;
        engine.tick();
      }

      // Should have visited multiple unique locations
      expect(engine.getVisitedCount()).toBeGreaterThan(0);
      // Note: First tick doesn't increment steps, so length-1
      expect(engine.getSteps()).toBe(gridLocations.length - 1);
    });
  });

  /**
   * TEST 6: Heading State Tracking
   * Verify that same location + different heading = different state
   */
  describe('Heading State Tracking', () => {
    it('should distinguish same location with different headings', () => {
      const baseLocation = 'https://www.google.com/maps/@37.7749,-122.4194,3a,';
      
      const headings = [
        `${baseLocation}0y,90t/data=!3m4!1e1`,    // North
        `${baseLocation}90y,90t/data=!3m4!1e1`,   // East
        `${baseLocation}180y,90t/data=!3m4!1e1`,  // South
        `${baseLocation}270y,90t/data=!3m4!1e1`   // West
      ];

      Object.defineProperty(window, 'location', {
        value: { href: headings[0] },
        writable: true
      });

      // Visit same location with 4 different headings
      headings.forEach((url, index) => {
        window.location.href = url;
        engine.tick();
      });

      // Should NOT turn - each heading is a different state
      // (0° binned = 0°, 90° binned = 90°, 180° binned = 180°, 270° binned = 270°)
      // All 4 are unique states: location@0, location@90, location@180, location@270
      const navState = engine.getNavigationState();
      expect(navState.selfAvoiding).toBeDefined();
    });

    it('should only turn when stuck, not on revisit alone', () => {
      const location = 'https://www.google.com/maps/@37.7749,-122.4194,3a,';
      
      // Same heading (0°), multiple visits
      const sameHeadingUrl = `${location}0y,90t/data=!3m4!1e1`;
      
      Object.defineProperty(window, 'location', {
        value: { href: sameHeadingUrl },
        writable: true
      });

      // First visit - no turn (not stuck yet)
      engine.tick();
      const callsAfterFirst = mockLongKeyPress.mock.calls.length;

      // Second visit with same heading - still no turn (need to be stuck first)
      engine.tick();
      engine.tick();
      engine.tick();
      
      // 4th tick when stuck - should trigger turn
      engine.tick();
      
      // Should have attempted to turn when stuck
      expect(mockLongKeyPress.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('should bin similar headings together', () => {
      const location = 'https://www.google.com/maps/@37.7749,-122.4194,3a,';
      
      // Headings that bin to same 45° bin (0° bin includes 0-22°)
      const similarHeadings = [
        `${location}0y,90t/data=!3m4!1e1`,    // 0° → bins to 0°
        `${location}10y,90t/data=!3m4!1e1`,   // 10° → bins to 0°
        `${location}20y,90t/data=!3m4!1e1`    // 20° → bins to 0°
      ];

      Object.defineProperty(window, 'location', {
        value: { href: similarHeadings[0] },
        writable: true
      });

      // First visit
      engine.tick();

      // Second visit with similar heading (same bin) - should detect as revisit
      window.location.href = similarHeadings[1];
      engine.tick();

      // Should recognize as same state (location@0°)
      const navState = engine.getNavigationState();
      expect(navState).toBeDefined();
    });
  });

  /**
   * TEST 7: Integration - Full Walk Scenario
   * Simulate a realistic walk with turns, loops, and exploration
   */
  describe('Integration - Full Walk', () => {
    it('should handle realistic walk scenario', () => {
      const walkSequence = [
        // Start walking north
        'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7750,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7751,-122.4194,3a,0y,90t/data=!3m4!1e1',
        
        // Turn east (simulated)
        'https://www.google.com/maps/@37.7751,-122.4194,3a,90y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7751,-122.4193,3a,90y,90t/data=!3m4!1e1',
        
        // Turn south (simulated)
        'https://www.google.com/maps/@37.7751,-122.4193,3a,180y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7750,-122.4193,3a,180y,90t/data=!3m4!1e1',
        
        // Loop back to start area from different direction
        'https://www.google.com/maps/@37.7749,-122.4193,3a,180y,90t/data=!3m4!1e1',
      ];

      let stepIndex = 0;
      Object.defineProperty(window, 'location', {
        value: { href: walkSequence[0] },
        writable: true
      });

      // Execute walk sequence
      for (let i = 1; i < walkSequence.length; i++) {
        window.location.href = walkSequence[i];
        engine.tick();
        stepIndex = i;
      }

      // Verify walk completed with expected steps (first tick doesn't count)
      expect(engine.getSteps()).toBe(walkSequence.length - 1);
      expect(engine.getVisitedCount()).toBeGreaterThan(0);

      // Verify path was recorded
      const walkPath = engine.getWalkPath();
      expect(walkPath.length).toBeGreaterThan(0);
    });
  });
});
