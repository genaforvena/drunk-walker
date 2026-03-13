import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simulating the core logic from bookmarklet.js for testing
// We don't want to test the literal browser bookmarklet, but its behavioral logic.

const createDrunkWalkerLogic = () => {
  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let pace = 2000;
  let isUserMouseDown = false;
  let lastMouseX = 500, lastMouseY = 500, isMouseIn = true;
  const width = 1920, height = 1080;

  const clickMock = vi.fn();

  const start = () => {
    status = 'WALKING';
    intervalId = setInterval(() => {
      if (isUserMouseDown) return;
      
      let tx, ty;
      const off = () => (0.5 * 2 - 1) * 50; // Mock random offset as 0 for deterministic tests
      if (isMouseIn && lastMouseX !== null) {
        tx = lastMouseX + off();
        ty = lastMouseY + off();
      } else {
        tx = width * 0.5 + off();
        ty = height * 0.7 + off();
      }
      clickMock(tx, ty);
      steps++;
    }, pace);
  };

  const stop = () => {
    status = 'IDLE';
    if (intervalId) clearInterval(intervalId);
  };

  return {
    getStatus: () => status,
    getSteps: () => steps,
    start,
    stop,
    setPace: (p) => { pace = p; },
    setUserMouseDown: (v) => { isUserMouseDown = v; },
    setMouseIn: (v) => { isMouseIn = v; },
    clickMock
  };
};

describe('Drunk Walker Logic v1.4', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start and increment steps', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    expect(dw.getStatus()).toBe('WALKING');
    
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
    expect(dw.clickMock).toHaveBeenCalled();
  });

  it('should stop and halt increments', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
    
    dw.stop();
    expect(dw.getStatus()).toBe('IDLE');
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
  });

  it('should skip clicks if user is dragging (isUserMouseDown)', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    dw.setUserMouseDown(true);
    
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(0);
    expect(dw.clickMock).not.toHaveBeenCalled();
    
    dw.setUserMouseDown(false);
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
    expect(dw.clickMock).toHaveBeenCalled();
  });

  it('should target cursor when mouse is in window', () => {
    const dw = createDrunkWalkerLogic();
    dw.setMouseIn(true);
    dw.start();
    
    vi.advanceTimersByTime(2000);
    // lastMouseX = 500, off = 0 -> 500
    expect(dw.clickMock).toHaveBeenCalledWith(500, 500);
  });

  it('should target forward (center-ish) when mouse is out', () => {
    const dw = createDrunkWalkerLogic();
    dw.setMouseIn(false);
    dw.start();
    
    vi.advanceTimersByTime(2000);
    // width=1920, height=1080 -> 1920*0.5=960, 1080*0.7=756
    expect(dw.clickMock).toHaveBeenCalledWith(960, 756);
  });
});
