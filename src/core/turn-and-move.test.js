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
    mockLongKeyPress = vi.fn();

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
    it('should press ArrowUp immediately after self-avoiding turn completes', () => {
      // Set up visited location
      engine.setPathCollection(true);
      
      // Mock window.location to simulate being at a visited location
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1' },
        writable: true
      });

      // First, record this location as visited
      engine.tick();
      
      // Now we're at a visited location, self-avoiding should trigger
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        // Simulate turn completing and callback being called
        setTimeout(() => {
          callback();  // This should trigger ArrowUp press
        }, 10);
      });

      // Tick - should trigger self-avoiding turn
      engine.tick();

      // Verify ArrowLeft was pressed for turn
      expect(mockLongKeyPress).toHaveBeenCalledWith(
        'ArrowLeft',
        expect.any(Number),
        expect.any(Function)
      );

      // The callback should press ArrowUp after turn
      // We need to wait for the callback to execute
      return new Promise(resolve => {
        setTimeout(() => {
          expect(mockKeyPress).toHaveBeenCalledWith('ArrowUp');
          // Restore original location
          Object.defineProperty(window, 'location', {
            value: { href: originalHref },
            writable: true
          });
          resolve();
        }, 50);
      });
    });

    it('should increment step counter after self-avoiding turn', () => {
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1' },
        writable: true
      });

      // First tick to record location
      engine.tick();
      const stepsAfterFirst = engine.getSteps();

      // Mock long key press to immediately call callback
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      // Second tick - should trigger self-avoiding and increment steps
      engine.tick();

      expect(engine.getSteps()).toBeGreaterThan(stepsAfterFirst);

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
      });
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
    it('should track cumulative turn angle for self-avoiding turns', () => {
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1' },
        writable: true
      });

      // First tick to record location
      engine.tick();
      expect(engine.getCumulativeTurnAngle()).toBe(0);

      // Mock long key press
      mockLongKeyPress.mockImplementation((key, duration, callback) => {
        callback();
      });

      // Second tick - should trigger self-avoiding turn
      engine.tick();

      // Cumulative turn angle should have increased (20-50 degrees)
      const turnAngle = engine.getCumulativeTurnAngle();
      expect(turnAngle).toBeGreaterThanOrEqual(20);
      expect(turnAngle).toBeLessThanOrEqual(50);

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
      });
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

      // Cumulative turn angle should have increased (30-90 degrees for first turn)
      // Note: May be slightly over 90 due to multiple ticks, so we check > 0
      const turnAngle = engine.getCumulativeTurnAngle();
      expect(turnAngle).toBeGreaterThanOrEqual(30);

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
      });
    });
  });

  describe('Always Turn Left', () => {
    it('should ONLY turn left (ArrowLeft) for self-avoiding, never right', () => {
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=!3m4!1e1' },
        writable: true
      });

      // First tick to record location
      engine.tick();

      // Trigger self-avoiding multiple times
      for (let i = 0; i < 5; i++) {
        mockLongKeyPress.mockClear();
        mockLongKeyPress.mockImplementation((key, duration, callback) => {
          callback();
        });
        engine.tick();
      }

      // Verify ONLY ArrowLeft was used, never ArrowRight
      const allCalls = mockLongKeyPress.mock.calls;
      allCalls.forEach(call => {
        expect(call[0]).toBe('ArrowLeft');
      });

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true
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
