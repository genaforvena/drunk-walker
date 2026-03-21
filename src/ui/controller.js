/**
 * UI Controller - Floating Buttons
 * v6.2.0-FLOAT
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '6.2.0',
    autoStart = true,
    onPathCollectionToggle = null
  } = options;

  let stepsEl = null;
  let visitedEl = null;
  let paceValEl = null;
  let startStopBtn = null;

  // Session logs storage
  const sessionLogs = [];
  const originalConsoleLog = console.log;

  console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    sessionLogs.push(`[${timestamp}] ${message}`);
    originalConsoleLog.apply(console, args);
  };

  const CSS = {
    btnBase: `
      position: fixed;
      bottom: 20px;
      padding: 10px 16px;
      background: rgba(18, 18, 20, 0.9);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #f0f0f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      z-index: 1000000;
    `,
    statBtn: `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 70px;
    `,
    statLabel: `
      font-size: 8px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `,
    statValue: `
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      font-feature-settings: "tnum";
    `,
    actionBtn: `
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `
  };

  const createUI = () => {
    // Remove any existing UI elements
    const existing = document.querySelectorAll('.dw-float-ui');
    existing.forEach(el => el.remove());

    const positions = {
      steps: { left: '20px' },
      visited: { left: '110px' },
      startStop: { left: '50%', transform: 'translateX(-50%)' },
      pace: { right: '110px' },
      savePath: { right: '20px' }
    };

    // Steps button
    const stepsBtn = document.createElement('div');
    stepsBtn.className = 'dw-float-ui';
    stepsBtn.style.cssText = CSS.btnBase + CSS.statBtn + `left: ${positions.steps.left};`;
    stepsBtn.innerHTML = `
      <span style="${CSS.statLabel}">Steps</span>
      <span id="dw-steps" style="${CSS.statValue}">0</span>
    `;
    document.body.appendChild(stepsBtn);
    stepsEl = stepsBtn.querySelector('#dw-steps');

    // Visited button
    const visitedBtn = document.createElement('div');
    visitedBtn.className = 'dw-float-ui';
    visitedBtn.style.cssText = CSS.btnBase + CSS.statBtn + `left: ${positions.visited.left};`;
    visitedBtn.innerHTML = `
      <span style="${CSS.statLabel}">Visited</span>
      <span id="dw-visited" style="${CSS.statValue}">0</span>
    `;
    document.body.appendChild(visitedBtn);
    visitedEl = visitedBtn.querySelector('#dw-visited');

    // Start/Stop button
    startStopBtn = document.createElement('button');
    startStopBtn.className = 'dw-float-ui';
    startStopBtn.style.cssText = CSS.btnBase + CSS.actionBtn + `left: ${positions.startStop.left};${positions.startStop.transform || ''}`;
    startStopBtn.innerHTML = '<span>▶</span> START';
    startStopBtn.onmouseover = () => startStopBtn.style.transform = positions.startStop.transform + ' translateY(-2px)';
    startStopBtn.onmouseout = () => startStopBtn.style.transform = positions.startStop.transform + ' translateY(0)';
    startStopBtn.onclick = () => {
      if (engine.isNavigating()) engine.stop();
      else engine.start();
      updateStartStopBtn();
    };
    document.body.appendChild(startStopBtn);

    // Pace button with slider
    const paceBtn = document.createElement('div');
    paceBtn.className = 'dw-float-ui';
    paceBtn.style.cssText = CSS.btnBase + CSS.statBtn + `right: ${positions.pace.right}; cursor: default;`;
    paceBtn.innerHTML = `
      <span style="${CSS.statLabel}">Pace</span>
      <span id="dw-pace-val" style="${CSS.statValue}">${(engine.getConfig().pace / 1000).toFixed(1)}s</span>
      <input type="range" min="500" max="5000" step="100" value="${engine.getConfig().pace}"
        style="width: 80px; margin-top: 4px; -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none;"
      />
    `;
    const paceSlider = paceBtn.querySelector('input');
    paceSlider.oninput = () => {
      paceValEl.innerText = (paceSlider.value / 1000).toFixed(1) + 's';
      engine.setPace(parseInt(paceSlider.value));
    };
    document.body.appendChild(paceBtn);
    paceValEl = paceBtn.querySelector('#dw-pace-val');

    // Save Path button
    const savePathBtn = document.createElement('button');
    savePathBtn.className = 'dw-float-ui';
    savePathBtn.style.cssText = CSS.btnBase + CSS.actionBtn + `right: ${positions.savePath.right};`;
    savePathBtn.innerHTML = '💾 SAVE';
    savePathBtn.title = 'Export Path';
    savePathBtn.onmouseover = () => savePathBtn.style.transform = 'translateY(-2px)';
    savePathBtn.onmouseout = () => savePathBtn.style.transform = 'translateY(0)';
    savePathBtn.onclick = exportPath;
    document.body.appendChild(savePathBtn);

    if (onPathCollectionToggle) onPathCollectionToggle(true);
    engine.setSelfAvoiding(true);
  };

  const updateStartStopBtn = () => {
    if (!startStopBtn) return;
    if (engine.isNavigating()) {
      startStopBtn.innerHTML = '<span>⏹</span> STOP';
      startStopBtn.style.background = 'rgba(255, 50, 50, 0.15)';
      startStopBtn.style.color = '#ff6b6b';
      startStopBtn.style.borderColor = 'rgba(255, 50, 50, 0.3)';
    } else {
      startStopBtn.innerHTML = '<span>▶</span> START';
      startStopBtn.style.background = 'rgba(18, 18, 20, 0.9)';
      startStopBtn.style.color = '#f0f0f0';
      startStopBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }
  };

  const exportPath = () => {
    const walkPath = engine.getWalkPath();
    if (walkPath.length === 0) {
      alert('No path recorded yet.');
      return;
    }
    const blob = new Blob([JSON.stringify(walkPath, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dw-path-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onStatusUpdate = (statusText, stepCount, stuckCount) => {
    if (stepsEl) stepsEl.innerText = stepCount;
    if (visitedEl) visitedEl.innerText = engine.getVisitedCount();
    updateStartStopBtn();
  };

  const init = () => {
    if (!document.body) return { destroy: () => {} };
    try {
      createUI();
      updateStartStopBtn();
      if (autoStart) engine.start();
      console.log('🟣 UI Initialized (Floating Buttons)');
      return { destroy };
    } catch (e) {
      console.error('UI Init Failed:', e);
      return { destroy: () => {} };
    }
  };

  const destroy = () => {
    engine.stop();
    document.querySelectorAll('.dw-float-ui').forEach(el => el.remove());
  };

  return { init, destroy, onStatusUpdate };
}
