import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEngine } from './engine.js';

/**
 * Tests for Navigation Memory (formerly Self-Avoiding)
 * 
 * In v3.69.0-EXP, "Self-Avoiding" means keeping track of turns made
 * at each location to ensure variety when stuck, but NOT turning 
 * automatically at every visited location.
 */
describe('Navigation Memory Algorithm', () => {
  let engine;
  let mockCallbacks;

  beforeEach(() => {
    mockCallbacks = {
      keyPress: vi.fn(),
      statusUpdate: vi.fn(),
      longKeyPress: vi.fn((key, duration, cb) => {
        if (cb) setTimeout(cb, 0);
      }),
      extractLocation: (url) => url.split('@')[1]?.split(',').slice(0, 2).join(',') || url
    };

    engine = createEngine({
      pace: 10,
      panicThreshold: 3,
      selfAvoiding: true
    });
    engine.setActionHandlers({
      keyPress: mockCallbacks.keyPress,
      statusUpdate: mockCallbacks.statusUpdate,
      longKeyPress: mockCallbacks.longKeyPress
    });
  });

  describe('Normal Walking', () => {
    it('should walk forward without turning at new locations', () => {
      // Step 1: New location
      engine.tick(); 
      expect(mockCallbacks.keyPress).toHaveBeenCalledWith('ArrowUp');
      expect(mockCallbacks.longKeyPress).not.toHaveBeenCalled();
    });

    it('should NOT turn automatically even if location was visited before', () => {
      const url = 'https://maps.google.com/@52.3,4.9';
      
      // Step 1: Visit location
      // Mock global window.location
      vi.stubGlobal('window', { location: { href: url } });
      engine.tick();
      expect(mockCallbacks.keyPress).toHaveBeenCalledWith('ArrowUp');
      
      // Step 2: Revisit same location (but not stuck yet)
      engine.tick();
      // Should STILL just move forward (tick 2 of 3 for stuck detection)
      expect(mockCallbacks.keyPress).toHaveBeenCalledTimes(2);
      expect(mockCallbacks.longKeyPress).not.toHaveBeenCalled();
    });
  });

  describe('Stuck Detection + Memory', () => {
    it('should only turn when stuck (stuckCount >= panicThreshold)', () => {
      const url = 'https://maps.google.com/@52.3,4.9';
      vi.stubGlobal('window', { location: { href: url } });

      // Ticks 1, 2, 3: Increment stuck count
      engine.tick(); // stuck=1
      engine.tick(); // stuck=2
      engine.tick(); // stuck=3 -> triggers unstuck

      expect(mockCallbacks.longKeyPress).toHaveBeenCalled();
      expect(mockCallbacks.longKeyPress).toHaveBeenCalledWith('ArrowLeft', expect.any(Number), expect.any(Function));
    });

    it('should pick different turn angles when stuck multiple times at same location', async () => {
      const url = 'https://maps.google.com/@52.3,4.9';
      vi.stubGlobal('window', { location: { href: url } });

      // First stuck event
      engine.tick(); // stuck=1
      engine.tick(); // stuck=2
      engine.tick(); // stuck=3 -> triggers unstuck
      
      expect(mockCallbacks.longKeyPress).toHaveBeenCalledTimes(1);
      const firstAngle = Math.round(mockCallbacks.longKeyPress.mock.calls[0][1] / 10);

      // We need to wait for the verification to complete so state returns to IDLE
      await new Promise(resolve => setTimeout(resolve, 50));

      // Reset mock to catch next turn
      mockCallbacks.longKeyPress.mockClear();

      // Second stuck event at same URL
      // stuckCount was reset by the successful "move" (even if mock)
      engine.tick(); // stuck=1
      engine.tick(); // stuck=2
      engine.tick(); // stuck=3 -> triggers unstuck again
      
      expect(mockCallbacks.longKeyPress).toHaveBeenCalledTimes(1);
      const secondAngle = Math.round(mockCallbacks.longKeyPress.mock.calls[0][1] / 10);

      // The logic is prev_angle + new_random, so they should be different
      expect(secondAngle).not.toBe(firstAngle);
    });
  });

  describe('Orientation Tracking', () => {
    it('should track global orientation across multiple turns', async () => {
      const url = 'https://maps.google.com/@52.3,4.9';
      vi.stubGlobal('window', { location: { href: url } });

      // Trigger 1st unstuck
      engine.tick(); engine.tick(); engine.tick();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger 2nd unstuck
      engine.tick(); engine.tick(); engine.tick();
      await new Promise(resolve => setTimeout(resolve, 50));

      const totalAngle = engine.getCumulativeTurnAngle();
      expect(totalAngle).toBeGreaterThan(0);
      expect(totalAngle).toBeLessThan(720); 
    });
  });
});
