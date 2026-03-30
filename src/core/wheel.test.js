/**
 * Wheel Component Tests
 * Tests orientation management and turning logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWheel } from './wheel.js';

describe('Wheel', () => {
  let wheel;

  beforeEach(() => {
    wheel = createWheel({});
  });

  describe('Initialization', () => {
    it('should start at orientation 0', () => {
      expect(wheel.getOrientation()).toBe(0);
    });

    it('should reset orientation to 0', () => {
      wheel.setOrientation(180);
      expect(wheel.getOrientation()).toBe(180);

      wheel.reset();
      expect(wheel.getOrientation()).toBe(0);
    });
  });

  describe('setOrientation', () => {
    it('should set orientation directly', () => {
      wheel.setOrientation(90);
      expect(wheel.getOrientation()).toBe(90);
    });

    it('should normalize orientation to 0-359', () => {
      wheel.setOrientation(360);
      expect(wheel.getOrientation()).toBe(0);

      wheel.setOrientation(450);
      expect(wheel.getOrientation()).toBe(90);

      wheel.setOrientation(-90);
      expect(wheel.getOrientation()).toBe(270);
    });
  });

  describe('turnLeft', () => {
    it('should decrease orientation immediately (intent-based)', () => {
      wheel.setOrientation(90);
      wheel.turnLeft(30, () => {});

      expect(wheel.getOrientation()).toBe(60);
    });

    it('should wrap around at 0', () => {
      wheel.setOrientation(30);
      wheel.turnLeft(60, () => {});

      expect(wheel.getOrientation()).toBe(330);
    });

    it('should handle large turns', () => {
      wheel.setOrientation(0);
      wheel.turnLeft(180, () => {});

      expect(wheel.getOrientation()).toBe(180);
    });
  });

  describe('turnRight', () => {
    it('should increase orientation immediately (intent-based)', () => {
      wheel.setOrientation(90);
      wheel.turnRight(30, () => {});

      expect(wheel.getOrientation()).toBe(120);
    });

    it('should wrap around at 360', () => {
      wheel.setOrientation(330);
      wheel.turnRight(60, () => {});

      expect(wheel.getOrientation()).toBe(30);
    });

    it('should handle large turns', () => {
      wheel.setOrientation(0);
      wheel.turnRight(180, () => {});

      expect(wheel.getOrientation()).toBe(180);
    });
  });

  describe('Callback Handling', () => {
    it('should handle missing callbacks gracefully', () => {
      const wheelNoCallbacks = createWheel({});

      expect(() => {
        wheelNoCallbacks.turnLeft(60);
      }).not.toThrow();
    });

    it('should call callback when no onLongKeyPress', () => {
      let callbackCalled = false;
      const wheelNoCallbacks = createWheel({});
      
      wheelNoCallbacks.turnLeft(60, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(true);
    });
  });
});
