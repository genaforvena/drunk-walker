/**
 * UI Controller - Compact Draggable Panel
 * v6.6.0-LOGS-FIX
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '6.6.0',
    autoStart = true,
    onPathCollectionToggle = null
  } = options;

  let container = null;
  let stepsEl = null;
  let visitedEl = null;
  let paceValEl = null;
  let startStopBtn = null;

  // Session logs storage - collect from console
  const sessionLogs = [];
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  // Hook console to capture logs
  const hookConsole = () => {
    console.log = function(...args) {
      const msg = `[${new Date().toISOString().substr(11, 8)}] ${args.join(' ')}`;
      sessionLogs.push(msg);
      if (sessionLogs.length > 5000) sessionLogs.shift();
      originalConsoleLog.apply(console, args);
    };
    console.warn = function(...args) {
      const msg = `[${new Date().toISOString().substr(11, 8)}] ⚠️ ${args.join(' ')}`;
      sessionLogs.push(msg);
      if (sessionLogs.length > 5000) sessionLogs.shift();
      originalConsoleWarn.apply(console, args);
    };
    console.error = function(...args) {
      const msg = `[${new Date().toISOString().substr(11, 8)}] ❌ ${args.join(' ')}`;
      sessionLogs.push(msg);
      if (sessionLogs.length > 5000) sessionLogs.shift();
      originalConsoleError.apply(console, args);
    };
  };

  // Hook console immediately
  hookConsole();

  const makeDraggable = (element) => {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('input')) {
        return;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      element.style.cursor = 'grabbing';
      element.style.transition = 'none';
      element.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'grab';
        element.style.transition = '';
        element.style.userSelect = '';
      }
    });
  };

  const createUI = () => {
    document.querySelectorAll('.dw-float-ui').forEach(el => el.remove());

    container = document.createElement('div');
    container.className = 'dw-float-ui';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 130px;
      padding: 12px;
      background: rgba(18, 18, 20, 0.95);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      z-index: 1000000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
    `;

    // Stats row
    const statRow = document.createElement('div');
    statRow.style.cssText = `display: flex; gap: 6px;`;
    statRow.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:6px 8px;background:rgba(255,255,255,0.06);border-radius:8px;flex:1;">
        <span style="font-size:7px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;">Steps</span>
        <span id="dw-steps" style="font-size:14px;font-weight:700;color:#fff;margin-top:2px;">0</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;padding:6px 8px;background:rgba(255,255,255,0.06);border-radius:8px;flex:1;">
        <span style="font-size:7px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;">Visited</span>
        <span id="dw-visited" style="font-size:14px;font-weight:700;color:#fff;margin-top:2px;">0</span>
      </div>
    `;
    container.appendChild(statRow);
    stepsEl = statRow.querySelector('#dw-steps');
    visitedEl = statRow.querySelector('#dw-visited');

    // START/STOP button
    startStopBtn = document.createElement('button');
    startStopBtn.style.cssText = `
      width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;
      background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:8px;
      color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.5px;
    `;
    startStopBtn.innerHTML = '<span>▶</span> START';
    startStopBtn.onmouseover = () => { if (!engine.isNavigating()) startStopBtn.style.background = 'rgba(255,255,255,0.12)'; };
    startStopBtn.onmouseout = () => { if (!engine.isNavigating()) startStopBtn.style.background = 'rgba(255,255,255,0.08)'; };
    startStopBtn.onclick = (e) => {
      e.stopPropagation();
      if (engine.isNavigating()) engine.stop();
      else engine.start();
      updateStartStopBtn();
    };
    container.appendChild(startStopBtn);

    // Save Path / Save Logs row
    const saveRow = document.createElement('div');
    saveRow.style.cssText = `display: flex; gap: 6px;`;
    saveRow.innerHTML = `
      <button id="dw-save-path" style="flex:1;padding:6px 10px;font-size:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:500;cursor:pointer;transition:all 0.2s;">💾 Path</button>
      <button id="dw-save-logs" style="flex:1;padding:6px 10px;font-size:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:500;cursor:pointer;transition:all 0.2s;">📄 Logs</button>
    `;
    container.appendChild(saveRow);
    saveRow.querySelector('#dw-save-path').onclick = (e) => { e.stopPropagation(); exportPath(); };
    saveRow.querySelector('#dw-save-logs').onclick = (e) => { e.stopPropagation(); exportLogs(); };

    // Pace control
    const paceRow = document.createElement('div');
    paceRow.style.cssText = `display:flex;flex-direction:column;gap:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);`;
    paceRow.innerHTML = `
      <span style="font-size:8px;color:rgba(255,255,255,0.5);text-align:center;">Pace: <span id="dw-pace-val">${(engine.getConfig().pace / 1000).toFixed(1)}s</span></span>
      <input type="range" min="500" max="5000" step="100" value="${engine.getConfig().pace}" style="width:100%;-webkit-appearance:none;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;outline:none;cursor:pointer;" />
    `;
    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = `
      .dw-float-ui input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;background:rgba(255,255,255,0.8);border-radius:50%;cursor:pointer;}
      .dw-float-ui input[type=range]::-moz-range-thumb{width:14px;height:14px;background:rgba(255,255,255,0.8);border:none;border-radius:50%;cursor:pointer;}
    `;
    container.appendChild(sliderStyle);
    container.appendChild(paceRow);
    const paceSlider = paceRow.querySelector('input');
    paceValEl = paceRow.querySelector('#dw-pace-val');
    paceSlider.oninput = (e) => {
      e.stopPropagation();
      paceValEl.innerText = (paceSlider.value / 1000).toFixed(1) + 's';
      engine.setPace(parseInt(paceSlider.value));
    };

    document.body.appendChild(container);
    makeDraggable(container);

    if (onPathCollectionToggle) onPathCollectionToggle(true);
    engine.setSelfAvoiding(true);
  };

  const updateStartStopBtn = () => {
    if (!startStopBtn) return;
    if (engine.isNavigating()) {
      startStopBtn.innerHTML = '<span>⏹</span> STOP';
      startStopBtn.style.background = 'rgba(255, 80, 80, 0.25)';
      startStopBtn.style.color = '#ff6b6b';
      startStopBtn.style.borderColor = 'rgba(255, 80, 80, 0.4)';
    } else {
      startStopBtn.innerHTML = '<span>▶</span> START';
      startStopBtn.style.background = 'rgba(255,255,255,0.08)';
      startStopBtn.style.color = '#f0f0f0';
      startStopBtn.style.borderColor = 'rgba(255,255,255,0.12)';
    }
  };

  const exportPath = () => {
    const walkPath = engine.getWalkPath();
    if (walkPath.length === 0) { alert('No path recorded yet.'); return; }
    const blob = new Blob([JSON.stringify(walkPath, null, 2)], { type: 'application/json' });
    downloadFile(blob, `dw-path-${Date.now()}.json`);
  };

  const exportLogs = () => {
    if (sessionLogs.length === 0) { alert('No logs captured yet.'); return; }
    const blob = new Blob([sessionLogs.join('\n')], { type: 'text/plain' });
    downloadFile(blob, `dw-logs-${Date.now()}.txt`);
  };

  const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
      console.log('🟣 UI Initialized (Draggable Panel)');
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
