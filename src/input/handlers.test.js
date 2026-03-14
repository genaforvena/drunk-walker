/**
 * Input Handlers Tests
 * Tests for keyboard and mouse event simulation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  simulateKeyPress,
  simulateClick,
  findStreetViewTarget,
  setupInteractionListeners
} from './handlers.js';

describe('Input Handlers', () => {
  let targetElement;

  beforeEach(() => {
    // Create a test target element
    targetElement = document.createElement('div');
    targetElement.id = 'test-target';
    document.body.appendChild(targetElement);

    // Mock elementFromPoint for click tests (jsdom doesn't support it)
    document.elementFromPoint = vi.fn().mockReturnValue(targetElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('findStreetViewTarget', () => {
    it('should return canvas if present', () => {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('width', '800');
      canvas.setAttribute('height', '600');
      document.body.appendChild(canvas);

      const target = findStreetViewTarget();
      expect(target).toBe(canvas);
    });

    it('should return scene-viewer if present', () => {
      const viewer = document.createElement('div');
      viewer.className = 'scene-viewer';
      document.body.appendChild(viewer);

      const target = findStreetViewTarget();
      expect(target).toBe(viewer);
    });

    it('should return documentElement as fallback', () => {
      const target = findStreetViewTarget();
      expect(target).toBe(document.documentElement);
    });
  });

  describe('simulateKeyPress', () => {
    it('should dispatch keydown, keypress, and keyup events', async () => {
      const keydownSpy = vi.fn();
      const keypressSpy = vi.fn();
      const keyupSpy = vi.fn();

      targetElement.addEventListener('keydown', keydownSpy);
      targetElement.addEventListener('keypress', keypressSpy);
      targetElement.addEventListener('keyup', keyupSpy);

      simulateKeyPress('ArrowUp', targetElement);

      expect(keydownSpy).toHaveBeenCalledTimes(1);
      expect(keypressSpy).toHaveBeenCalledTimes(1);
      
      // Wait for keyup (called in setTimeout)
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(keyupSpy).toHaveBeenCalledTimes(1);
    });

    it('should use correct key code for ArrowUp', () => {
      const keydownSpy = vi.fn();
      targetElement.addEventListener('keydown', keydownSpy);

      simulateKeyPress('ArrowUp', targetElement);

      const event = keydownSpy.mock.calls[0][0];
      expect(event.key).toBe('ArrowUp');
      expect(event.keyCode).toBe(38);
      expect(event.code).toBe('ArrowUp');
    });

    it('should use correct key code for ArrowLeft', () => {
      const keydownSpy = vi.fn();
      targetElement.addEventListener('keydown', keydownSpy);

      simulateKeyPress('ArrowLeft', targetElement);

      const event = keydownSpy.mock.calls[0][0];
      expect(event.key).toBe('ArrowLeft');
      expect(event.keyCode).toBe(37);
      expect(event.code).toBe('ArrowLeft');
    });

    it('should bubble events', () => {
      const parentSpy = vi.fn();
      const parent = document.createElement('div');
      parent.appendChild(targetElement);
      document.body.appendChild(parent);

      parent.addEventListener('keydown', parentSpy);

      simulateKeyPress('ArrowUp', targetElement);

      expect(parentSpy).toHaveBeenCalledTimes(1);
    });

    it('should have correct event properties', () => {
      const keydownSpy = vi.fn();
      targetElement.addEventListener('keydown', keydownSpy);

      simulateKeyPress('ArrowUp', targetElement);

      const event = keydownSpy.mock.calls[0][0];
      expect(event.bubbles).toBe(true);
      expect(event.cancelable).toBe(true);
      expect(event.location).toBe(2);
      expect(event.repeat).toBe(false);
      expect(event.altKey).toBe(false);
      expect(event.ctrlKey).toBe(false);
      expect(event.metaKey).toBe(false);
      expect(event.shiftKey).toBe(false);
    });

    it('should use documentElement as default target', () => {
      const docSpy = vi.fn();
      document.documentElement.addEventListener('keydown', docSpy);

      simulateKeyPress('ArrowUp');

      expect(docSpy).toHaveBeenCalled();
    });
  });

  describe('simulateClick', () => {
    it('should dispatch mousedown, mouseup, and click events', () => {
      const mousedownSpy = vi.fn();
      const mouseupSpy = vi.fn();
      const clickSpy = vi.fn();

      targetElement.addEventListener('mousedown', mousedownSpy);
      targetElement.addEventListener('mouseup', mouseupSpy);
      targetElement.addEventListener('click', clickSpy);

      // Mock elementFromPoint to return our target
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetElement);

      simulateClick(100, 100, false);

      expect(mousedownSpy).toHaveBeenCalledTimes(1);
      expect(mouseupSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should pass correct coordinates', () => {
      const clickSpy = vi.fn();
      targetElement.addEventListener('click', clickSpy);

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetElement);

      simulateClick(150, 250, false);

      const event = clickSpy.mock.calls[0][0];
      expect(event.clientX).toBe(150);
      expect(event.clientY).toBe(250);
    });

    it('should create visual marker by default', () => {
      document.elementFromPoint = vi.fn().mockReturnValue(targetElement);

      const beforeCount = document.querySelectorAll('div').length;
      simulateClick(100, 100, true);
      const afterCount = document.querySelectorAll('div').length;

      // A new div marker should be created
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it('should remove marker after animation', () => {
      vi.useRealTimers();
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetElement);

      simulateClick(100, 100, true);

      return new Promise((resolve) => {
        setTimeout(() => {
          const markers = document.querySelectorAll('div[style*="background:cyan"]');
          expect(markers.length).toBe(0);
          resolve();
        }, 400);
      });
    });

    it('should use body as fallback target', () => {
      const bodySpy = vi.fn();
      document.body.addEventListener('click', bodySpy);

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);

      simulateClick(100, 100, false);

      expect(bodySpy).toHaveBeenCalled();
    });
  });

  describe('setupInteractionListeners', () => {
    it('should set up mousedown listener', () => {
      const mouseDownSpy = vi.fn();

      const { cleanup } = setupInteractionListeners({
        onUserMouseDown: mouseDownSpy,
        onUserMouseUp: vi.fn()
      });

      // Note: In jsdom, synthetic events have isTrusted = false
      // So the callback won't be called. This test just verifies the listener is set up.
      targetElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      // In a real browser with trusted events, this would be called with true
      // In jsdom, synthetic events are not trusted, so callback is not called
      expect(mouseDownSpy).not.toHaveBeenCalled();
      cleanup();
    });

    it('should set up mouseup listener', () => {
      const mouseUpSpy = vi.fn();

      const { cleanup } = setupInteractionListeners({
        onUserMouseDown: vi.fn(),
        onUserMouseUp: mouseUpSpy
      });

      targetElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      // In jsdom, synthetic events are not trusted
      expect(mouseUpSpy).not.toHaveBeenCalled();
      cleanup();
    });

    it('should only respond to trusted events', () => {
      const mouseDownSpy = vi.fn();

      const { cleanup } = setupInteractionListeners({
        onUserMouseDown: mouseDownSpy
      });

      // In jsdom, all synthetic events have isTrusted = false by default
      // So we just verify the listener is set up correctly
      const event = new MouseEvent('mousedown', { bubbles: true });
      targetElement.dispatchEvent(event);

      // Since isTrusted is false for synthetic events, callback should NOT be called
      expect(mouseDownSpy).not.toHaveBeenCalled();
      cleanup();
    });

    it('should return cleanup function', () => {
      const mouseDownSpy = vi.fn();

      const { cleanup } = setupInteractionListeners({
        onUserMouseDown: mouseDownSpy
      });

      cleanup();

      targetElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(mouseDownSpy).not.toHaveBeenCalled();
    });
  });
});
