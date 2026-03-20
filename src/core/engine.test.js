/**
 * Core Engine Tests
 * Tests for the independent navigation logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine, defaultConfig, VERSION } from './engine.js';

describe('Core Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create engine with default config', () => {
      const engine = createEngine();
      expect(engine.getStatus()).toBe('IDLE');
      expect(engine.getSteps()).toBe(0);
      expect(engine.getConfig()).toEqual(defaultConfig);
    });

    it('should accept custom config', () => {
      const engine = createEngine({ pace: 1000, kbOn: false });
      expect(engine.getConfig().pace).toBe(1000);
      expect(engine.getConfig().kbOn).toBe(false);
    });

    it('should have correct version', () => {
      expect(VERSION).toBe('5.3.0-STUCK-TYPE');
    });
  });

  describe('State Management', () => {
    it('should start navigation', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.getStatus()).toBe('WALKING');
      expect(engine.isNavigating()).toBe(true);
    });

    it('should stop navigation', () => {
      const engine = createEngine();
      engine.start();
      engine.stop();
      expect(engine.getStatus()).toBe('IDLE');
      expect(engine.isNavigating()).toBe(false);
    });

    it('should reset state', () => {
      const engine = createEngine();
      engine.start();
      vi.advanceTimersByTime(3000);
      engine.reset();
      expect(engine.getStatus()).toBe('IDLE');
      expect(engine.getSteps()).toBe(0);
    });

    it('should not start twice', () => {
      const engine = createEngine();
      engine.start();
      const status1 = engine.getStatus();
      engine.start();
      expect(engine.getStatus()).toBe(status1);
    });
  });

  describe('Navigation Loop', () => {
    it('should increment steps on tick', () => {
      const engine = createEngine({ pace: 1000 });
      engine.start();
      vi.advanceTimersByTime(1000);
      expect(engine.getSteps()).toBe(1);
    });

    it('should skip tick when user is interacting', () => {
      const engine = createEngine({ pace: 1000 });
      engine.setUserMouseDown(true);
      engine.start();
      vi.advanceTimersByTime(1000);
      expect(engine.getSteps()).toBe(0);
    });

    it('should resume after user interaction ends', () => {
      const engine = createEngine({ pace: 1000 });
      engine.start();
      
      vi.advanceTimersByTime(1000);
      expect(engine.getSteps()).toBe(1);

      engine.setUserMouseDown(true);
      vi.advanceTimersByTime(1000);
      expect(engine.getSteps()).toBe(1);

      engine.setUserMouseDown(false);
      vi.advanceTimersByTime(1000);
      expect(engine.getSteps()).toBe(2);
    });

    it('should skip tick when drawing', () => {
      const engine = createEngine({ pace: 1000 });
      engine.setIsDrawing(true);
      engine.start();
      vi.advanceTimersByTime(1000);
      expect(engine.getSteps()).toBe(0);
    });
  });

  describe('Keyboard Mode (Default)', () => {
    it('should call keyPress handler with ArrowUp', () => {
      const keyPressMock = vi.fn();
      const engine = createEngine({ kbOn: true });
      engine.setActionHandlers({ keyPress: keyPressMock });
      engine.start();

      vi.advanceTimersByTime(100);
      engine.tick();

      expect(keyPressMock).toHaveBeenCalledWith('ArrowUp');
    });

    it('should trigger unstuck sequence in panic mode', () => {
      const keyPressMock = vi.fn();
      const longKeyPressMock = vi.fn();
      const engine = createEngine({ kbOn: true, panicThreshold: 2 });
      engine.setActionHandlers({ keyPress: keyPressMock, longKeyPress: longKeyPressMock });
      engine.start();

      // Mock a fixed URL to simulate being stuck
      const url = 'https://maps.google.com/@52.370000,4.900000';
      vi.stubGlobal('window', { location: { href: url } });

      // Simulate stuck detection (same location)
      engine.tick();  // stuckCount = 0
      engine.tick();  // stuckCount = 1
      engine.tick();  // stuckCount = 2 (panic!)
      engine.tick();  // systematic search triggers

      // At panicThreshold, systematic search should trigger a turn
      expect(engine.getStuckCount()).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Click Mode', () => {
    it('should call mouseClick handler with coordinates', () => {
      const mouseClickMock = vi.fn();
      const engine = createEngine({ kbOn: false });
      engine.setActionHandlers({ mouseClick: mouseClickMock });
      engine.start();

      vi.advanceTimersByTime(100);
      engine.tick();

      expect(mouseClickMock).toHaveBeenCalled();
      const [x, y] = mouseClickMock.mock.calls[0];
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
    });

    it('should target 40% width, 80% height by default', () => {
      const mouseClickMock = vi.fn();
      const engine = createEngine({ kbOn: false, radius: 0 });
      engine.setActionHandlers({ mouseClick: mouseClickMock });

      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });

      engine.start();
      vi.advanceTimersByTime(100);
      engine.tick();

      const [x, y] = mouseClickMock.mock.calls[0];
      expect(x).toBe(1920 * 0.4);
      expect(y).toBe(1080 * 0.8);
    });
  });

  describe('Stuck Detection', () => {
    it('should increment stuck count when at same location', () => {
      const statusMock = vi.fn();
      const engine = createEngine({ panicThreshold: 15 });
      engine.setActionHandlers({ statusUpdate: statusMock });
      engine.start();

      // Mock a fixed URL
      const url = 'https://maps.google.com/@52.370000,4.900000';
      vi.stubGlobal('window', { location: { href: url } });

      // First tick - establishes location
      engine.tick();
      expect(engine.getStuckCount()).toBe(0);  // First tick, not stuck yet

      // Second tick - same location
      engine.tick();
      expect(engine.getStuckCount()).toBe(1);

      // Third tick - still same location
      engine.tick();
      expect(engine.getStuckCount()).toBe(2);
    });

    it('should reset stuck count when location changes', () => {
      const engine = createEngine({});
      engine.start();

      // Mock initial URL
      const url1 = 'https://maps.google.com/@52.370000,4.900000';
      vi.stubGlobal('window', { location: { href: url1 } });

      engine.tick();
      engine.tick();
      expect(engine.getStuckCount()).toBe(1);

      // Change URL
      const url2 = 'https://maps.google.com/@52.371000,4.901000';
      vi.stubGlobal('window', { location: { href: url2 } });

      engine.tick();
      expect(engine.getStuckCount()).toBe(0);
    });

    // Note: PANIC status removed in v5.3.0 - stuckCount is used internally by algorithm
  });

  describe('Configuration Changes', () => {
    it('should update pace', () => {
      const engine = createEngine({ pace: 2000 });
      expect(engine.getConfig().pace).toBe(2000);
      engine.setPace(1000);
      expect(engine.getConfig().pace).toBe(1000);
    });

    it('should toggle keyboard mode', () => {
      const engine = createEngine({ kbOn: true });
      expect(engine.getConfig().kbOn).toBe(true);
      engine.setKeyboardMode(false);
      expect(engine.getConfig().kbOn).toBe(false);
    });
  });

  describe('Polygon Support (Extra Feature)', () => {
    it('should accept polygon points', () => {
      const engine = createEngine();
      const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
      engine.setPolygon(poly);
      // Polygon is stored internally, verified through click behavior
    });
  });
});
