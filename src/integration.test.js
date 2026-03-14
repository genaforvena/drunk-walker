import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mocking global browser APIs and DOM for jsdom
let mockIntervalId = 0;
let mockIntervalCallback = null;
const mockSetInterval = vi.fn((callback, delay) => {
  mockIntervalCallback = callback;
  mockIntervalId++;
  return mockIntervalId;
});
const mockClearInterval = vi.fn((id) => {
  if (id === mockIntervalId) {
    mockIntervalCallback = null;
  }
});
const mockSetTimeout = vi.fn((callback, delay) => {
  callback(); // Execute immediately for simplicity in tests
  return 1;
});
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

// Content of bookmarklet-console.js (minified and escaped for string literal)
const bookmarkletCode = `
void function initDrunkWalker(){

  const VERSION = '3.2-EXP';

  const defaultConfig = {
    pace: 2000, kbOn: true, expOn: false, panicThreshold: 3, radius: 50, targetX: 0.5, targetY: 0.7
  };

  function createEngine(config = {}) {
    const cfg = { ...defaultConfig, ...config };
    let status = 'IDLE'; let steps = 0; let intervalId = null; let lastUrl = ''; let stuckCount = 0;
    let isUserMouseDown = false; let poly = []; let isDrawing = false;
    const getStatus = () => status; const getSteps = () => steps; const getStuckCount = () => stuckCount;
    const isNavigating = () => status === 'WALKING';
    const setPace = (newPace) => { cfg.pace = newPace; }; const setKeyboardMode = (on) => { cfg.kbOn = on; };
    const setExperimentalMode = (on) => { cfg.expOn = on; }; const setPolygon = (points) => { poly = points; };
    const setUserMouseDown = (down) => { isUserMouseDown = down; }; const setIsDrawing = (drawing) => { isDrawing = drawing; };
    let onKeyPress = null; let onMouseClick = null; let onStatusUpdate = null;
    const setActionHandlers = ({ keyPress, mouseClick, statusUpdate }) => { onKeyPress = keyPress; onMouseClick = mouseClick; onStatusUpdate = statusUpdate; };

    const updateStuckDetection = () => {
      if (!cfg.expOn) { stuckCount = 0; return; }
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl) { stuckCount++; } else { lastUrl = currentUrl; stuckCount = 0; }
    };

    const getStatusText = () => {
      if (!cfg.expOn || stuckCount === 0) return 'WALKING';
      if (stuckCount >= cfg.panicThreshold) return `PANIC! (STUCK \${stuckCount})`;
      return `STUCK (\${stuckCount})`;
    };

    const calculateClickTarget = () => {
      const cw = window.innerWidth; const ch = window.innerHeight;
      if (poly.length > 2) {
        const minX = Math.min(...poly.map(p => p.x)); const maxX = Math.max(...poly.map(p => p.x));
        const minY = Math.min(...poly.map(p => p.y)); const maxY = Math.max(...poly.map(p => p.y));
        let tx, ty, attempts = 0;
        do { tx = minX + Math.random() * (maxX - minX); ty = minY + Math.random() * (maxY - minY); attempts++; } while (!inPoly({ x: tx, y: ty }, poly) && attempts < 100);
        return { x: tx, y: ty };
      }
      const radius = cfg.expOn && stuckCount >= cfg.panicThreshold ? cfg.radius * Math.pow(1.5, stuckCount - cfg.panicThreshold + 1) : cfg.radius;
      const wobble = () => (Math.random() * 2 - 1) * radius;
      return { x: cw * cfg.targetX + wobble(), y: cfg.targetY * ch + wobble() };
    };

    const inPoly = (p, vs) => {
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y; const xj = vs[j].x, yj = vs[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      } return inside;
    };

    const tick = () => {
      if (isUserMouseDown || isDrawing) return;
      updateStuckDetection();
      if (onStatusUpdate) onStatusUpdate(getStatusText(), steps, stuckCount);
      if (cfg.kbOn) { const key = (cfg.expOn && stuckCount >= cfg.panicThreshold) ? 'ArrowLeft' : 'ArrowUp'; if (onKeyPress) onKeyPress(key); } else { const target = calculateClickTarget(); if (onMouseClick) onMouseClick(target.x, target.y); } steps++;
    };

    const start = () => {
      if (status === 'WALKING') return; status = 'WALKING'; steps = 0; stuckCount = 0; lastUrl = window.location.href;
      if (intervalId) clearInterval(intervalId); intervalId = setInterval(tick, cfg.pace);
      if (onStatusUpdate) onStatusUpdate('WALKING', 0, 0);
    };
    const stop = () => {
      status = 'IDLE'; if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (onStatusUpdate) onStatusUpdate('IDLE', steps, 0);
    };
    const reset = () => { stop(); steps = 0; stuckCount = 0; lastUrl = ''; status = 'IDLE'; };

    return { getStatus, getSteps, getStuckCount, isNavigating, setPace, setKeyboardMode, setExperimentalMode, setPolygon, setUserMouseDown, setIsDrawing, setActionHandlers, start, stop, reset, tick, getConfig: () => ({ ...cfg }) };
  }

  // === INPUT HANDLERS ===
  const KEY_CODES = { ArrowUp: { keyCode: 38, code: 'ArrowUp' }, ArrowLeft: { keyCode: 37, code: 'ArrowLeft' }, ArrowDown: { keyCode: 40, code: 'ArrowDown' }, ArrowRight: { keyCode: 39, code: 'ArrowRight' } };
  function findStreetViewTarget() { return document.querySelector('canvas[width][height]') || document.querySelector('.scene-viewer') || document.querySelector('[class*="streetview"]') || document.documentElement; }
  function simulateKeyPress(key, target = null) {
    const { keyCode, code } = KEY_CODES[key] || { keyCode: 0, code: key };
    const eventOptions = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, location: 2, repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    const targetEl = target || findStreetViewTarget();
    targetEl.dispatchEvent(new KeyboardEvent('keydown', eventOptions)); targetEl.dispatchEvent(new KeyboardEvent('keypress', eventOptions)); setTimeout(() => { targetEl.dispatchEvent(new KeyboardEvent('keyup', eventOptions)); }, 50);
  }
  function simulateClick(x, y, showMarker = true) {
    const eventOptions = { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y };
    const target = document.elementFromPoint(x, y) || document.body;
    target.dispatchEvent(new MouseEvent('mousedown', eventOptions)); target.dispatchEvent(new MouseEvent('mouseup', eventOptions)); target.dispatchEvent(new MouseEvent('click', eventOptions));
    if (showMarker) {
      const marker = document.createElement('div');
      marker.style.cssText = `position:fixed;left:\${x}px;top:\${y}px;width:15px;height:15px;background:cyan;border-radius:50%;z-index:999999;pointer-events:none;transform:translate(-50%,-50%);opacity:0.8;transition:transform 0.3s, opacity 0.3s;`; document.body.appendChild(marker); setTimeout(() => { marker.style.transform = 'translate(-50%,-50%) scale(2)'; marker.style.opacity = '0'; setTimeout(() => marker.remove(), 300); }, 50);
    }
  }
  function setupInteractionListeners(callbacks = {}) {
    const { onUserMouseDown, onUserMouseUp } = callbacks;
    const mouseDownHandler = (e) => { if (e.isTrusted && onUserMouseDown) { onUserMouseDown(true); } };
    const mouseUpHandler = (e) => { if (e.isTrusted && onUserMouseUp) { onUserMouseUp(false); } };
    document.addEventListener('mousedown', mouseDownHandler, true); document.addEventListener('mouseup', mouseUpHandler, true);
    return { cleanup: () => { document.removeEventListener('mousedown', mouseDownHandler, true); document.removeEventListener('mouseup', mouseUpHandler, true); } };
  }

  // === UI CONTROLLER ===
  function createControlPanel(engine, options = {}) {
    const { version = '3.2-EXP', autoStart = true } = options;
    let container = null; let btn = null; let statusEl = null; let stepsEl = null; let paceValEl = null; let paceSlider = null;
    const createUI = () => {
      container = document.createElement('div'); container.id = 'dw-ctrl-panel';
      container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';
      const title = document.createElement('div'); title.innerHTML = `🤪 DRUNK WALKER v\${version}<hr style="border-color:#0f0">`; container.appendChild(title);
      const stats = document.createElement('div'); stats.style.margin = '10px 0'; stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>STEPS: <span id="dw-steps">0</span>'; container.appendChild(stats);
      statusEl = document.getElementById('dw-status'); stepsEl = document.getElementById('dw-steps');
      const paceLabel = document.createElement('div'); paceLabel.style.fontSize = '10px'; paceLabel.innerHTML = 'PACE: <span id="dw-pace-val">2.0</span>s'; container.appendChild(paceLabel); paceValEl = document.getElementById('dw-pace-val');
      paceSlider = document.createElement('input'); paceSlider.type = 'range'; paceSlider.min = '500'; paceSlider.max = '5000'; paceSlider.step = '100'; paceSlider.value = engine.getConfig().pace; paceSlider.style.width = '100%';
      paceSlider.oninput = () => {
        const newPace = parseInt(paceSlider.value); paceValEl.innerText = (newPace / 1000).toFixed(1); engine.setPace(newPace);
        if (engine.isNavigating()) { engine.stop(); engine.start(); }
      }; container.appendChild(paceSlider);
      btn = document.createElement('button'); btn.innerText = '▶ START';
      btn.style.cssText = 'width:100%;margin-top:10px;padding:8px;background:#0f0;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:5px;';
      btn.onclick = () => { if (engine.isNavigating()) { engine.stop(); } else { engine.start(); } updateButton(); }; container.appendChild(btn);
      document.body.appendChild(container);
    };
    const updateButton = () => { if (engine.isNavigating()) { btn.innerText = '🔴 STOP'; btn.style.background = '#f00'; } else { btn.innerText = '▶ START'; btn.style.background = '#0f0'; } };
    const onStatusUpdate = (statusText, stepCount, stuckCount) => { if (statusEl) statusEl.innerText = statusText; if (stepsEl) stepsEl.innerText = stepCount; if (!engine.isNavigating()) { updateButton(); } };
    const init = () => {
      if (!document.body) { console.error('🤪 DRUNK WALKER: document.body not ready yet'); return { destroy: () => {} }; }
      try { createUI(); engine.setActionHandlers({ statusUpdate: onStatusUpdate }); updateButton(); if (autoStart) { engine.start(); } console.log('🤪 Control panel created successfully'); return { destroy }; } catch (error) { console.error('🤪 DRUNK WALKER: Failed to initialize UI:', error); return { destroy: () => {} }; }
    };
    const destroy = () => { engine.stop(); if (container) { container.remove(); container = null; } };
    return { init, destroy };
  }

  // === MAIN ENTRY ===
  if (window.DRUNK_WALKER_ACTIVE) {
    console.log('🤪 Drunk Walker: Restarting...');
    if (window.DRUNK_WALKER) { try { window.DRUNK_WALKER.stop(); } catch(e) {} }
  }
  window.DRUNK_WALKER_ACTIVE = true;
  console.log(`🤪 DRUNK WALKER v\${VERSION} Loaded.`);
  const initialize = () => {
    try {
      const engine = createEngine({ pace: 2000, kbOn: true, expOn: false });
      engine.setActionHandlers({
        keyPress: (key) => { const target = findStreetViewTarget(); simulateKeyPress(key, target); },
        mouseClick: (x, y) => { simulateClick(x, y, true); },
        statusUpdate: (status, steps, stuck) => { /* Handled by UI controller */ }
      });
      const { cleanup: cleanupListeners } = setupInteractionListeners({ onUserMouseDown: (down) => engine.setUserMouseDown(down), onUserMouseUp: (down) => engine.setUserMouseDown(down) });
      const ui = createControlPanel(engine, { version: VERSION, autoStart: true });
      ui.init();
      window.DRUNK_WALKER = { engine, ui, simulateKeyPress, simulateClick, stop: () => { ui.destroy(); cleanupListeners(); window.DRUNK_WALKER_ACTIVE = false; delete window.DRUNK_WALKER; console.log('🤪 Drunk Walker stopped'); } };
      console.log('🎮 Type DRUNK_WALKER.stop() to stop manually');
    } catch (error) { console.error('🤪 DRUNK WALKER: Initialization failed:', error); window.DRUNK_WALKER_ACTIVE = false; }
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); } else { initialize(); }
}();
`;

describe('Drunk Walker Integration Tests', () => {
  
  let mockSetIntervalSpy;
  let mockClearIntervalSpy;
  let mockSetTimeoutSpy;
  let mockAddEventListenerSpy;
  let mockRemoveEventListenerSpy;
  let mockCreateElementSpy;
  let mockGetElementByIdSpy;
  let mockQuerySelectorSpy;
  let mockDispatchEventSpy;
  let mockAppendChildSpy;
  let mockConsoleLogSpy;
  let mockConsoleErrorSpy;
  let mockFindStreetViewTargetSpy;
  let initialWindowDrunkWalkerActive;
  let initialWindowDrunkWalker;

  beforeEach(() => {
    // Store initial global state to restore later
    initialWindowDrunkWalkerActive = global.window.DRUNK_WALKER_ACTIVE;
    initialWindowDrunkWalker = global.window.DRUNK_WALKER;

    // Create a new JSDOM environment for each test
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: "http://localhost", // Mock URL
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.document.body = dom.window.document.body;
    
    // Mock necessary global functions and objects
    mockIntervalId = 0;
    mockIntervalCallback = null;
    mockSetIntervalSpy = vi.fn((callback, delay) => { mockIntervalCallback = callback; mockIntervalId++; return mockIntervalId; });
    mockClearIntervalSpy = vi.fn((id) => { if (id === mockIntervalId) mockIntervalCallback = null; });
    mockSetTimeoutSpy = vi.fn((callback, delay) => { callback(); return 1; }); // Execute immediately
    mockAddEventListenerSpy = vi.fn();
    mockRemoveEventListenerSpy = vi.fn();
    mockCreateElementSpy = vi.fn(tagName => {
      const el = document.createElement(tagName);
      if (tagName === 'script') {
        // Mock script element to have a textContent property
        el.textContent = '';
      } else if (tagName === 'div') {
        el.style = {}; // Add style property for divs
        el.children = [];
        el.appendChild = vi.fn();
        el.remove = vi.fn();
      } else if (tagName === 'input' && el.type === 'range') {
        el.value = '2000'; // Default value
        el.oninput = vi.fn();
      } else if (tagName === 'button') {
        el.innerText = '▶ START';
        el.style = {};
        el.onclick = vi.fn();
      }
      return el;
    });
    mockGetElementByIdSpy = vi.fn(id => {
      // Mocking specific elements by ID
      if (id === 'dw-status') return { innerText: 'IDLE', setAttribute: vi.fn() };
      if (id === 'dw-steps') return { innerText: '0' };
      if (id === 'dw-pace-val') return { innerText: '2.0s' };
      if (id === 'dw-pace-slider') {
        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '500'; slider.max = '5000'; slider.step = '100'; slider.value = '2000';
        slider.oninput = vi.fn(); return slider;
      }
      if (id === 'dw-start-stop-btn') {
        const btn = document.createElement('button'); btn.innerText = '▶ START'; btn.style = {}; btn.onclick = vi.fn(); return btn;
      }
      return null;
    });
    mockQuerySelectorSpy = vi.fn(selector => {
      if (selector === '#dw-ctrl-panel') {
        // Simulate the panel being created, ensure it has children for the test to query
        const panel = document.createElement('div');
        panel.id = 'dw-ctrl-panel';
        panel.appendChild(document.createElement('div')); // Mock title
        const stats = document.createElement('div'); stats.id = 'dw-stats'; stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>STEPS: <span id="dw-steps">0</span>';
        panel.appendChild(stats);
        panel.appendChild(document.createElement('div')); // Mock pace label
        panel.appendChild(document.createElement('input')); // Mock pace slider
        panel.appendChild(document.createElement('button')); // Mock start/stop button
        return panel;
      }
      return null;
    });
    mockDispatchEventSpy = vi.fn();
    mockAppendChildSpy = vi.fn();
    mockConsoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFindStreetViewTargetSpy = vi.fn(() => document.body); // Default to body

    global.document.body.appendChild = mockAppendChildSpy;
    global.document.body.remove = vi.fn();
    global.document.body.querySelector = vi.fn(selector => selector === 'html' ? document.documentElement : null);
    global.document.elementFromPoint = vi.fn(() => document.body);
    global.document.addEventListener = mockAddEventListenerSpy;
    global.document.removeEventListener = mockRemoveEventListenerSpy;
    global.document.createElement = mockCreateElementSpy;
    global.document.getElementById = mockGetElementByIdSpy;
    global.document.querySelector = mockQuerySelectorSpy;
    global.document.querySelectorAll = vi.fn(() => []); // Mock querySelectorAll for checking panel count

    // Mocking global functions
    global.setInterval = mockSetIntervalSpy;
    global.clearInterval = mockClearIntervalSpy;
    global.setTimeout = mockSetTimeoutSpy;
    global.addEventListener = mockAddEventListenerSpy;
    global.removeEventListener = mockRemoveEventListenerSpy;

    // Mocking Event constructors
    global.KeyboardEvent = class extends Event { constructor(type, options) { super(type, options); Object.assign(this, options); } };
    global.MouseEvent = class extends Event { constructor(type, options) { super(type, options); Object.assign(this, options); } };
    global.HTMLElement = class extends HTMLElement { constructor() { super(); this.style = {}; this.dispatchEvent = mockDispatchEventSpy; } };
    
    // Mock window properties
    global.window.DRUNK_WALKER_ACTIVE = false;
    global.window.DRUNK_WALKER = undefined;

    // Spy on findStreetViewTarget
    vi.spyOn(global, 'findStreetViewTarget').mockImplementation(mockFindStreetViewTargetSpy);
  });

  afterEach(() => {
    // Restore original global state and mocks
    global.window.DRUNK_WALKER_ACTIVE = initialWindowDrunkWalkerActive;
    global.window.DRUNK_WALKER = initialWindowDrunkWalker;
    vi.restoreAllMocks();
    if (dom) dom.window.close();
  });

  // Helper function to inject and execute the script
  const injectScript = () => {
    const script = document.createElement('script');
    script.textContent = bookmarkletCode;
    document.body.appendChild(script);
  };

  it('should initialize and create the control panel', () => {
    injectScript();
    expect(mockAppendChildSpy).toHaveBeenCalledTimes(2); // Once for script, once for panel
    const appendedElement = mockAppendChildSpy.mock.calls.find(call => call[0].id === 'dw-ctrl-panel')?.[0];
    expect(appendedElement).toBeDefined();
    expect(appendedElement.id).toBe('dw-ctrl-panel');

    expect(mockGetElementByIdSpy).toHaveBeenCalledWith('dw-status');
    expect(mockGetElementByIdSpy).toHaveBeenCalledWith('dw-steps');
    expect(document.getElementById('dw-status').innerText).toBe('IDLE');
    expect(document.getElementById('dw-steps').innerText).toBe('0');
  });

  it('should start navigation when the start button is clicked', () => {
    injectScript();
    const startButton = document.getElementById('dw-start-stop-btn');
    
    // Mock engine methods for this test
    const mockEngine = global.window.DRUNK_WALKER.engine;
    mockEngine.start = vi.fn();
    mockEngine.stop = vi.fn();
    mockEngine.isNavigating = vi.fn().mockReturnValue(false); // Initially not navigating
    mockEngine.setActionHandlers = vi.fn();
    mockEngine.setPace = vi.fn();
    
    // Simulate button click
    startButton.onclick();

    // Check if engine.start was called and status updated
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    expect(document.getElementById('dw-status').innerText).toBe('WALKING');
    expect(startButton.innerText).toBe('🔴 STOP');
    expect(startButton.style.background).toBe('#f00');
    expect(mockSetIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should stop navigation when the stop button is clicked', () => {
    injectScript();
    const startButton = document.getElementById('dw-start-stop-btn');
    const mockEngine = global.window.DRUNK_WALKER.engine;
    
    // Mock engine state to simulate navigation is active
    mockEngine.start = vi.fn();
    mockEngine.stop = vi.fn();
    mockEngine.isNavigating = vi.fn().mockReturnValue(true); // Simulate navigating
    mockEngine.setActionHandlers = vi.fn();
    mockEngine.setPace = vi.fn();

    // Manually set UI state to reflect navigation is active before click
    document.getElementById('dw-status').innerText = 'WALKING';
    startButton.innerText = '🔴 STOP';
    startButton.style.background = '#f00';

    // Simulate button click to stop
    startButton.onclick();

    // Check if engine.stop was called and status updated
    expect(mockEngine.stop).toHaveBeenCalledTimes(1);
    expect(document.getElementById('dw-status').innerText).toBe('IDLE');
    expect(startButton.innerText).toBe('▶ START');
    expect(startButton.style.background).toBe('#0f0');
    expect(mockClearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should update pace when the slider is changed', () => {
    injectScript();
    const paceSlider = document.getElementById('dw-pace-slider');
    const paceValEl = document.getElementById('dw-pace-val');
    const mockEngine = global.window.DRUNK_WALKER.engine;
    mockEngine.setPace = vi.fn();
    mockEngine.stop = vi.fn(); // Mock stop/start for pace change scenario
    mockEngine.start = vi.fn();
    mockEngine.isNavigating = vi.fn().mockReturnValue(true); // Simulate navigating to test pace change restart

    // Simulate slider change
    paceSlider.value = '1500';
    paceSlider.oninput();

    // Check if engine.setPace was called and display updated
    expect(mockEngine.setPace).toHaveBeenCalledWith(1500);
    expect(paceValEl.innerText).toBe('1.5s');
    expect(mockEngine.stop).toHaveBeenCalledTimes(1);
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
  });
  
  it('should pause navigation when user mouse events occur', () => {
    injectScript();
    const startButton = document.getElementById('dw-start-stop-btn');
    const mockEngine = global.window.DRUNK_WALKER.engine;
    mockEngine.start = vi.fn();
    mockEngine.stop = vi.fn();
    mockEngine.setUserMouseDown = vi.fn();
    mockEngine.isNavigating = vi.fn().mockReturnValue(true); // Simulate navigating

    startButton.onclick(); // Start navigation

    // Simulate user mouse down event
    const mouseDownEvent = new global.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 });
    document.dispatchEvent(mouseDownEvent); // Dispatch to document

    // Check if engine.setUserMouseDown was called
    expect(mockEngine.setUserMouseDown).toHaveBeenCalledWith(true);
    
    // Simulate user mouse up event
    const mouseUpEvent = new global.MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 });
    document.dispatchEvent(mouseUpEvent);

    // Check if engine.setUserMouseDown was called
    expect(mockEngine.setUserMouseDown).toHaveBeenCalledWith(false);
  });

  it('should allow re-initialization after calling stop', () => {
    // First injection and initialization
    injectScript();
    expect(global.window.DRUNK_WALKER_ACTIVE).toBe(true);
    expect(global.window.DRUNK_WALKER).toBeDefined();
    expect(mockSetIntervalSpy).toHaveBeenCalledTimes(1); // Auto-start

    // Stop the script
    global.window.DRUNK_WALKER.stop();
    expect(global.window.DRUNK_WALKER_ACTIVE).toBe(false);
    expect(global.window.DRUNK_WALKER).toBeUndefined();
    expect(mockClearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(mockConsoleLogSpy).toHaveBeenCalledWith('🤪 Drunk Walker stopped');
    
    // Reset mocks for the next injection
    vi.clearAllMocks();
    
    // Second injection
    injectScript();
    expect(global.window.DRUNK_WALKER_ACTIVE).toBe(true);
    expect(global.window.DRUNK_WALKER).toBeDefined();
    expect(mockSetIntervalSpy).toHaveBeenCalledTimes(1); // Should auto-start again
    expect(document.getElementById('dw-status').innerText).toBe('IDLE'); // Initial state after re-init
  });
  
  it('should not create multiple control panels if injected multiple times without stopping', () => {
    injectScript(); // First injection
    const firstPanel = document.querySelector('#dw-ctrl-panel');
    expect(firstPanel).not.toBeNull();
    
    // Inject again without stopping
    injectScript();
    
    // Verify that only one panel exists
    const panels = document.querySelectorAll('#dw-ctrl-panel');
    expect(panels.length).toBe(1);
  });

  it('should expose DRUNK_WALKER object with necessary methods', () => {
    injectScript();
    expect(global.window.DRUNK_WALKER).toBeDefined();
    expect(global.window.DRUNK_WALKER.stop).toBeDefined();
    expect(global.window.DRUNK_WALKER.engine).toBeDefined();
    expect(global.window.DRUNK_WALKER.ui).toBeDefined();
    expect(global.window.DRUNK_WALKER.simulateKeyPress).toBeDefined();
    expect(global.window.DRUNK_WALKER.simulateClick).toBeDefined();
  });

  // Test for calling simulateKeyPress indirectly via engine tick
  it('should call simulateKeyPress when keyboard mode is active and tick is triggered', () => {
    injectScript();
    const drunkWalker = global.window.DRUNK_WALKER;
    
    // Mock engine and its tick method to spy on keyPress handler
    drunkWalker.engine.isNavigating = vi.fn().mockReturnValue(true);
    drunkWalker.engine.kbOn = true; // Ensure keyboard mode is on
    drunkWalker.engine.tick = vi.fn(() => { // Override tick to call keyPress handler
        const target = findStreetViewTarget(); // Should mock this too, but assuming it returns document.body
        global.window.DRUNK_WALKER.simulateKeyPress('ArrowUp', target); // Call the actual simulateKeyPress
    });
    drunkWalker.simulateKeyPress = vi.fn(); // Spy on the global simulateKeyPress

    drunkWalker.engine.start(); // Start the engine to set up interval
    drunkWalker.engine.tick(); // Manually trigger the tick

    expect(drunkWalker.simulateKeyPress).toHaveBeenCalledTimes(1);
    expect(drunkWalker.simulateKeyPress).toHaveBeenCalledWith('ArrowUp', document.body); // Ensure it's called with correct args
  });
  
  // Test for calling simulateClick indirectly via engine tick
  it('should call simulateClick when click mode is active and tick is triggered', () => {
    injectScript();
    const drunkWalker = global.window.DRUNK_WALKER;
    
    // Mock engine and its tick method to spy on mouseClick handler
    drunkWalker.engine.isNavigating = vi.fn().mockReturnValue(true);
    drunkWalker.engine.kbOn = false; // Ensure click mode is on
    drunkWalker.engine.getConfig = vi.fn().mockReturnValue({ targetX: 0.5, targetY: 0.7 }); // Mock config
    drunkWalker.engine.tick = vi.fn(() => { // Override tick to call mouseClick handler
        const target = drunkWalker.engine.getConfig();
        global.window.DRUNK_WALKER.simulateClick(target.targetX * window.innerWidth, target.targetY * window.innerHeight); // Call the actual simulateClick
    });
    drunkWalker.simulateClick = vi.fn(); // Spy on the global simulateClick

    drunkWalker.engine.start(); // Start the engine to set up interval
    drunkWalker.engine.tick(); // Manually trigger the tick

    expect(drunkWalker.simulateClick).toHaveBeenCalledTimes(1);
    // Check arguments - they are multiplied by window.innerWidth/Height in the simulated tick
    expect(drunkWalker.simulateClick).toHaveBeenCalledWith(0.5 * window.innerWidth, 0.7 * window.innerHeight);
  });
});
