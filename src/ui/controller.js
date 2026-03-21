/**
 * UI Controller - Compact Draggable Panel
 * v6.4.0-DRAGGABLE
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '6.4.0',
    autoStart = true,
    onPathCollectionToggle = null
  } = options;

  let container = null;
  let stepsEl = null;
  let visitedEl = null;
  let paceValEl = null;
  let startStopBtn = null;

  // Session logs storage
  const sessionLogs = [];

  const CSS = {
    panel: `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 120px;
      padding: 10px;
      background: rgba(18, 18, 20, 0.95);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      z-index: 1000000;
      display: flex;
      flex-direction: column;
      gap: 6px;
      user-select: none;
    `,
    header: `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 4px;
      cursor: grab;
    `,
    statRow: `
      display: flex;
      gap: 4px;
    `,
    statBox: `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 5px;
      flex: 1;
    `,
    statLabel: `
      font-size: 7px;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
    `,
    statValue: `
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    `,
    actionBtn: `
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #f0f0f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
    `,
    btnRow: `
      display: flex;
      gap: 4px;
    `,
    iconBtn: `
      padding: 5px 8px;
      font-size: 13px;
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #f0f0f0;
      cursor: pointer;
      transition: all 0.2s;
    `,
    slider: `
      width: 100%;
      -webkit-appearance: none;
      height: 4px;
      background: rgba(255,255,255,0.15);
      border-radius: 2px;
      outline: none;
    `,
    paceLabel: `
      font-size: 8px;
      color: rgba(255,255,255,0.5);
      text-align: center;
    `
  };

  const makeDraggable = (element, handle) => {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      handle.style.cursor = 'grabbing';
      element.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
      element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'grab';
        element.style.transition = '';
      }
    });
  };

  const createUI = () => {
    document.querySelectorAll('.dw-float-ui').forEach(el => el.remove());

    container = document.createElement('div');
    container.className = 'dw-float-ui';
    container.style.cssText = CSS.panel;

    // Header with drag handle
    const header = document.createElement('div');
    header.style.cssText = CSS.header;
    header.innerHTML = `
      <span style="font-size: 10px; color: rgba(255,255,255,0.6);">🟣 DW</span>
      <span style="font-size: 9px; color: rgba(255,255,255,0.3);">⋮⋮</span>
    `;
    container.appendChild(header);

    // Stats row
    const statRow = document.createElement('div');
    statRow.style.cssText = CSS.statRow;
    statRow.innerHTML = `
      <div style="${CSS.statBox}">
        <span style="${CSS.statLabel}">Steps</span>
        <span id="dw-steps" style="${CSS.statValue}">0</span>
      </div>
      <div style="${CSS.statBox}">
        <span style="${CSS.statLabel}">Visited</span>
        <span id="dw-visited" style="${CSS.statValue}">0</span>
      </div>
    `;
    container.appendChild(statRow);
    stepsEl = statRow.querySelector('#dw-steps');
    visitedEl = statRow.querySelector('#dw-visited');

    // START/STOP button
    startStopBtn = document.createElement('button');
    startStopBtn.style.cssText = CSS.actionBtn;
    startStopBtn.innerHTML = '<span>▶</span> START';
    startStopBtn.onmouseover = () => {
      startStopBtn.style.background = 'rgba(255,255,255,0.1)';
    };
    startStopBtn.onmouseout = () => {
      startStopBtn.style.background = 'rgba(255,255,255,0.05)';
    };
    startStopBtn.onclick = () => {
      if (engine.isNavigating()) engine.stop();
      else engine.start();
      updateStartStopBtn();
    };
    container.appendChild(startStopBtn);

    // Save Path / Save Logs row
    const saveRow = document.createElement('div');
    saveRow.style.cssText = CSS.btnRow;
    saveRow.innerHTML = `
      <button id="dw-save-path" style="${CSS.iconBtn}" title="Save Path">💾 Path</button>
      <button id="dw-save-logs" style="${CSS.iconBtn}" title="Save Logs">📄 Logs</button>
    `;
    container.appendChild(saveRow);
    saveRow.querySelector('#dw-save-path').onclick = exportPath;
    saveRow.querySelector('#dw-save-logs').onclick = exportLogs;

    // Pace control
    const paceRow = document.createElement('div');
    paceRow.style.cssText = `display: flex; flex-direction: column; gap: 3px;`;
    paceRow.innerHTML = `
      <span style="${CSS.paceLabel}">Pace: <span id="dw-pace-val">${(engine.getConfig().pace / 1000).toFixed(1)}s</span></span>
      <input type="range" min="500" max="5000" step="100" value="${engine.getConfig().pace}" style="${CSS.slider}" />
    `;
    container.appendChild(paceRow);
    const paceSlider = paceRow.querySelector('input');
    paceValEl = paceRow.querySelector('#dw-pace-val');
    paceSlider.oninput = () => {
      paceValEl.innerText = (paceSlider.value / 1000).toFixed(1) + 's';
      engine.setPace(parseInt(paceSlider.value));
    };

    document.body.appendChild(container);

    // Make draggable
    makeDraggable(container, header);

    if (onPathCollectionToggle) onPathCollectionToggle(true);
    engine.setSelfAvoiding(true);
  };

  const updateStartStopBtn = () => {
    if (!startStopBtn) return;
    if (engine.isNavigating()) {
      startStopBtn.innerHTML = '<span>⏹</span> STOP';
      startStopBtn.style.background = 'rgba(255, 80, 80, 0.2)';
      startStopBtn.style.color = '#ff6b6b';
      startStopBtn.style.borderColor = 'rgba(255, 80, 80, 0.3)';
    } else {
      startStopBtn.innerHTML = '<span>▶</span> START';
      startStopBtn.style.background = 'rgba(255,255,255,0.05)';
      startStopBtn.style.color = '#f0f0f0';
      startStopBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  };

  const exportPath = () => {
    const walkPath = engine.getWalkPath();
    if (walkPath.length === 0) {
      alert('No path recorded yet.');
      return;
    }
    const blob = new Blob([JSON.stringify(walkPath, null, 2)], { type: 'application/json' });
    downloadFile(blob, `dw-path-${Date.now()}.json`);
  };

  const exportLogs = () => {
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
      console.log('🟣 UI Initialized (Draggable)');
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
