import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simulating the core logic from bookmarklet.js for testing
// We don't want to test the literal browser bookmarklet, but its behavioral logic.

const createDrunkWalkerLogic = () => {
  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let pace = 2000;
  let isUserMouseDown = false;
  let lastMouseX = 500, lastMouseY = 500;
  // Dynamic window mock
  const getWindow = () => ({ width: 1920, height: 1080 });

  const clickMock = vi.fn();

  const start = () => {
    status = 'WALKING';
    intervalId = setInterval(() => {
      if (isUserMouseDown) return;
      
      const { width, height } = getWindow();
      let tx, ty;
      const off = () => 0; // Mock random offset as 0
      if (lastMouseX !== null && lastMouseY !== null) {
        tx = lastMouseX + off();
        ty = lastMouseY + off();
      } else {
        // True center
        tx = width * 0.5 + off();
        ty = height * 0.5 + off();
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
    setMouseCoords: (x, y) => { lastMouseX = x; lastMouseY = y; },
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

  it('should target cursor when mouse is active', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    
    vi.advanceTimersByTime(2000);
    expect(dw.clickMock).toHaveBeenCalledWith(500, 500);
  });

  it('should target true center (0.5, 0.5) when mouse is absent', () => {
    const dw = createDrunkWalkerLogic();
    dw.setMouseCoords(null, null);
    dw.start();
    
    vi.advanceTimersByTime(2000);
    // width=1920, height=1080 -> 1920*0.5=960, 1080*0.5=540
    expect(dw.clickMock).toHaveBeenCalledWith(960, 540);
  });
});
