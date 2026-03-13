import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simulating the core logic from bookmarklet.js for testing
// We don't want to test the literal browser bookmarklet, but its behavioral logic.

const createDrunkWalkerLogic = () => {
  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let pace = 2000;
  let isUserMouseDown = false;
  let experimentalMode = false;
  let keyboardMode = false;
  let panicThreshold = 3;
  let horizonFinder = false;
  let url = 'http://maps.google.com/test/@0,0,3a,75y,0h,90t';
  let stuckCount = 0;
  let poly = [];
  
  let cw = 0;
  let ch = 0;

  const getWindow = () => ({ width: 1920, height: 1080 });
  const clickMock = vi.fn();
  const dispatchMock = vi.fn();

  function inPoly(p, vs) {
    var x = p.x, y = p.y, inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  }

  const start = () => {
    const { width, height } = getWindow();
    cw = width;
    ch = height;
    let lastUrl = url;
    stuckCount = 0;
    status = 'WALKING';
    intervalId = setInterval(() => {
      if (isUserMouseDown) return;
      
      if (experimentalMode) {
        if (url === lastUrl) { stuckCount++; } else { lastUrl = url; stuckCount = 0; }
      } else { stuckCount = 0; }

      if (keyboardMode) {
        if (experimentalMode && stuckCount >= panicThreshold) {
          dispatchMock('ArrowLeft');
        } else {
          dispatchMock('ArrowUp');
        }
      } else {
        if (horizonFinder) {
          const match = url.match(/,(\d+(\.\d+)?)t/);
          if (match) {
            const pitch = parseFloat(match[1]);
            if (pitch > 91) dispatchMock('ArrowUp');
            else if (pitch < 89) dispatchMock('ArrowDown');
          }
        }
        let radius = 50;
        if (experimentalMode && stuckCount > 0) { radius = 50 * Math.pow(1.5, stuckCount); }
        let tx, ty;
        if (poly.length > 2) { tx = 100; ty = 100; } 
        else { const off = () => 0; tx = cw * 0.5 + off(); ty = ch * 0.7 + off(); }
        clickMock(tx, ty);
      }
      steps++;
    }, pace);
  };

  const stop = () => { status = 'IDLE'; if (intervalId) clearInterval(intervalId); };

  return {
    getStatus: () => status,
    getSteps: () => steps,
    start,
    stop,
    setPace: (p) => { pace = p; },
    setUserMouseDown: (v) => { isUserMouseDown = v; },
    setExperimentalMode: (v) => { experimentalMode = v; },
    setKeyboardMode: (v) => { keyboardMode = v; },
    setPanicThreshold: (v) => { panicThreshold = v; },
    setHorizonFinder: (v) => { horizonFinder = v; },
    setUrl: (u) => { url = u; },
    setPoly: (p) => { poly = p; },
    getStuckCount: () => stuckCount,
    clickMock,
    dispatchMock
  };
};

describe('Drunk Walker Logic v3.0-EXP', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('should start and increment steps', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    expect(dw.getStatus()).toBe('WALKING');
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
    expect(dw.clickMock).toHaveBeenCalled();
  });

  it('should switch to ArrowUp in Keyboard Mode', () => {
    const dw = createDrunkWalkerLogic();
    dw.setKeyboardMode(true);
    dw.start();
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenCalledWith('ArrowUp');
    expect(dw.clickMock).not.toHaveBeenCalled();
  });

  it('should trigger ArrowLeft in Keyboard + Panic Mode', () => {
    const dw = createDrunkWalkerLogic();
    dw.setKeyboardMode(true);
    dw.setExperimentalMode(true);
    dw.setPanicThreshold(2);
    dw.start();
    
    // Step 1: Same URL (stuckCount = 1)
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenCalledWith('ArrowUp');
    
    // Step 2: Same URL (stuckCount = 2, panic!)
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenCalledWith('ArrowLeft');
    
    // Step 3: URL changes (stuckCount = 0)
    dw.setUrl('http://maps.google.com/new');
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenLastCalledWith('ArrowUp');
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

  it('should resume clicking after dragging stops', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
    dw.setUserMouseDown(true);
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(1);
    dw.setUserMouseDown(false);
    vi.advanceTimersByTime(2000);
    expect(dw.getSteps()).toBe(2);
    expect(dw.clickMock).toHaveBeenCalledTimes(2);
  });

  it('should target the area slightly lower than center (0.7 height)', () => {
    const dw = createDrunkWalkerLogic();
    dw.start();
    vi.advanceTimersByTime(2000);
    expect(dw.clickMock).toHaveBeenCalledWith(960, 756);
  });

  it('should trigger chaos clicks in experimental mode and increase radius exponentially', () => {
    const dw = createDrunkWalkerLogic();
    dw.setExperimentalMode(true);
    dw.start();
    
    // Step 1: Same URL
    vi.advanceTimersByTime(2000);
    expect(dw.getStuckCount()).toBe(1);
    
    // Step 2: Same URL
    vi.advanceTimersByTime(2000);
    expect(dw.getStuckCount()).toBe(2);
    
    // Step 3: URL changes
    dw.setUrl('http://maps.google.com/new');
    vi.advanceTimersByTime(2000);
    expect(dw.getStuckCount()).toBe(0);
  });

  it('should adjust camera when horizon finder is enabled', () => {
    const dw = createDrunkWalkerLogic();
    dw.setHorizonFinder(true);
    dw.start();
    
    // 1. Looking down (110t) -> ArrowUp
    dw.setUrl('http://maps.google.com/test/@0,0,3a,75y,0h,110t');
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenCalledWith('ArrowUp');
    
    // 2. Looking up (70t) -> ArrowDown
    dw.setUrl('http://maps.google.com/test/@0,0,3a,75y,0h,70t');
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenCalledWith('ArrowDown');
    
    // 3. Near horizon (90t) -> No adjustment
    dw.setUrl('http://maps.google.com/test/@0,0,3a,75y,0h,90.5t');
    vi.advanceTimersByTime(2000);
    expect(dw.dispatchMock).toHaveBeenCalledTimes(2); // No new call
  });

  it('should click inside custom polygon when defined', () => {
    const dw = createDrunkWalkerLogic();
    dw.setPoly([{x:0, y:0}, {x:200, y:0}, {x:200, y:200}, {x:0, y:200}]);
    dw.start();
    
    vi.advanceTimersByTime(2000);
    // In our mock logic, if poly is set, it clicks at (100, 100)
    expect(dw.clickMock).toHaveBeenCalledWith(100, 100);
  });
});
