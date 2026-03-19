/**
 * Turn and Move Integration Tests
 * Verifies that after every turn, ArrowUp is pressed to move forward
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine } from './engine.js';

describe('Turn and Move Integration', () => {
  let engine;
  let mockKeyPress;
  let mockLongKeyPress;

  beforeEach(() => {
    mockKeyPress = vi.fn();
    mockLongKeyPress = vi.fn((key, duration, callback) => {
      if (callback) callback();
    });

    engine = createEngine({
      pace: 100,  // Fast pace for testing
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
    vi.clearAllMocks();
  });

  describe('Self-Avoiding Turn and Move', () => {
    it('should NOT turn at new locations (only when stuck)', () => {
      // Self-avoiding only triggers when stuck, not on every revisit
      engine.setPathCollection(true);

      const locations = [
        'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7750,-122.4194,3a,0y,90t/data=!3m4!1e1',
        'https://www.google.com/maps/@37.7751,-122.4194,3a,0y,90t/data=!3m4!1e1'
      ];

      Object.defineProperty(window, 'location', {
        value: { href: locations[0] },
        writable: true
      });

      // Walk through new locations - should NOT turn
      for (const loc of locations) {
        window.location.href = loc;
        engine.tick();
      }

      // Should NOT have turned - only turns when stuck
      expect(mockLongKeyPress).not.toHaveBeenCalled();
      expect(mockKeyPress).toHaveBeenCalledWith('ArrowUp');
    });

    it('should turn with self-avoiding when stuck', () => {
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1';

      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      // Get stuck (3 ticks to reach threshold)
      engine.tick();
      engine.tick();
      engine.tick();

      // 4th tick triggers self-avoiding turn
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      engine.tick();

      // Should have turned
      expect(mockLongKeyPress).toHaveBeenCalledWith(
        'ArrowLeft',
        expect.any(Number),
        expect.any(Function)
      );
    });
  });

  describe('Unstuck Turn and Move', () => {
    it('should press ArrowUp immediately after unstuck turn completes', () => {
      // Simulate being stuck (same URL for multiple ticks)
      const originalHref = window.location.href;
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1';
      
      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      // Tick 3 times to trigger stuck detection (panicThreshold = 3)
      engine.tick();
      engine.tick();
      engine.tick();

      // 4th tick should trigger unstuck sequence
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        // Simulate turn completing
        setTimeout(() => {
          callback();  // This should trigger ArrowUp press
        }, 10);
      });

      engine.tick();

      // Verify ArrowLeft was pressed for unstuck turn
      expect(mockLongKeyPress).toHaveBeenCalledWith(
        'ArrowLeft',
        expect.any(Number),
        expect.any(Function)
      );

      // Wait for callback to execute
      return new Promise(resolve => {
        setTimeout(() => {
          expect(mockKeyPress).toHaveBeenCalledWith('ArrowUp');
          Object.defineProperty(window, 'location', {
            value: { href: originalHref },
            writable: true
          });
          resolve();
        }, 50);
      });
    });

    it('should increment step counter after unstuck turn', () => {
      const originalHref = window.location.href;
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1';
      
      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      // Get steps before unstuck - tick 3 times to trigger stuck
      engine.tick();  // Step 1
      engine.tick();  // Step 2
      engine.tick();  // Step 3 - triggers stuck detection
      const stepsBeforeUnstuck = engine.getSteps();

      // Mock to immediately call callback
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      // Trigger unstuck - step 4
      engine.tick();

      // Steps should be 4 now (3 before + 1 for unstuck tick)
      expect(engine.getSteps()).toBe(4);

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
      });
    });
  });

  describe('Turn Angle Tracking', () => {
    it('should track cumulative turn angle when stuck and self-avoiding triggers', () => {
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1';

      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      expect(engine.getCumulativeTurnAngle()).toBe(0);

      // Get stuck (3 ticks)
      engine.tick();
      engine.tick();
      engine.tick();

      // Mock to immediately call callback
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      // Trigger self-avoiding (4th tick when stuck)
      engine.tick();

      // Cumulative turn angle should have increased
      const turnAngle = engine.getCumulativeTurnAngle();
      expect(turnAngle).toBeGreaterThan(0);
      expect(turnAngle).toBeLessThanOrEqual(360);
    });

    it('should track cumulative turn angle for unstuck turns', () => {
      const originalHref = window.location.href;
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1';
      
      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      expect(engine.getCumulativeTurnAngle()).toBe(0);

      // Trigger stuck state (3 ticks)
      engine.tick();
      engine.tick();
      engine.tick();

      // Mock to immediately call callback
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      // Trigger unstuck
      engine.tick();

      // Cumulative turn angle should have increased (30-90 degrees for unstuck turn)
      // Note: Angle is random, so we check for a reasonable minimum
      const turnAngle = engine.getCumulativeTurnAngle();
      expect(turnAngle).toBeGreaterThan(0);
      expect(turnAngle).toBeLessThanOrEqual(360);  // Should not exceed full rotation

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
      });
    });
  });

  describe('Always Turn Left', () => {
    it('should ONLY turn left (ArrowLeft) for self-avoiding when stuck, never right', () => {
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1';

      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      // Get stuck multiple times
      for (let attempt = 0; attempt < 3; attempt++) {
        engine.reset();
        engine.setActionHandlers({
          keyPress: mockKeyPress,
          mouseClick: () => {},
          statusUpdate: () => {},
          longKeyPress: mockLongKeyPress,
          walkStop: () => {}
        });
        engine.start();

        // Tick to get stuck
        for (let i = 0; i <= 3; i++) {
          engine.tick();
        }

        mockLongKeyPress.mockClear();
        mockLongKeyPress.mockImplementation((key, duration, callback) => {
          callback();
        });
      }

      // Verify ONLY ArrowLeft was used, never ArrowRight
      const allCalls = mockLongKeyPress.mock.calls;
      allCalls.forEach(call => {
        expect(call[0]).toBe('ArrowLeft');
      });
    });

    it('should ONLY turn left (ArrowLeft) for unstuck, never right', async () => {
      const originalHref = window.location.href;
      const stuckUrl = 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1';
      
      Object.defineProperty(window, 'location', {
        value: { href: stuckUrl },
        writable: true
      });

      // Trigger stuck state
      engine.tick();
      engine.tick();
      engine.tick();

      // Trigger unstuck multiple times
      for (let i = 0; i < 3; i++) {
        mockLongKeyPress.mockClear();
        mockLongKeyPress.mockImplementation((key, duration, callback) => {
          callback();
        });
        engine.tick();
        
        // Small delay to let callback execute
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify ONLY ArrowLeft was used
      const allCalls = mockLongKeyPress.mock.calls;
      allCalls.forEach(call => {
        expect(call[0]).toBe('ArrowLeft');
      });

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
      });
    });
  });
});
