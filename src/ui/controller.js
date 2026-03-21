/**
 * UI Controller - Compact Vertical Layout
 * v6.3.0-COMPACT
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '6.3.0',
    autoStart = true,
    onPathCollectionToggle = null
  } = options;

  let stepsEl = null;
  let visitedEl = null;
  let paceValEl = null;
  let startStopBtn = null;

  const CSS = {
    btnBase: `
      position: fixed;
      bottom: 20px;
      left: 20px;
      padding: 8px 12px;
      background: rgba(18, 18, 20, 0.95);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f0f0f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 1000000;
    `,
    statRow: `
      display: flex;
      gap: 4px;
      margin-bottom: 6px;
    `,
    statBox: `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
      min-width: 45px;
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
      padding: 6px 10px;
      text-transform: uppercase;
      font-size: 10px;
    `,
    btnRow: `
      display: flex;
      gap: 4px;
      margin-bottom: 6px;
    `,
    iconBtn: `
      padding: 4px 8px;
      font-size: 14px;
      min-width: 28px;
    `,
    slider: `
      width: 100%;
      -webkit-appearance: none;
      height: 3px;
      background: rgba(255,255,255,0.15);
      border-radius: 2px;
      outline: none;
      margin-top: 2px;
    `
  };

  const createUI = () => {
    document.querySelectorAll('.dw-float-ui').forEach(el => el.remove());

    const container = document.createElement('div');
    container.className = 'dw-float-ui';
    container.style.cssText = CSS.btnBase + `width: 110px; padding: 10px; display: flex; flex-direction: column; gap: 4px; cursor: default;`;

    // Stats row (Steps + Visited)
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
    startStopBtn.style.cssText = CSS.btnBase + CSS.actionBtn + `width: 100%; margin: 0;`;
    startStopBtn.innerHTML = '<span>▶</span> START';
    startStopBtn.onmouseover = () => startStopBtn.style.background = 'rgba(255,255,255,0.1)';
    startStopBtn.onmouseout = () => startStopBtn.style.background = 'rgba(18,18,20,0.95)';
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
      <button id="dw-save-path" style="${CSS.btnBase + CSS.iconBtn}margin:0;" title="Save Path">💾</button>
      <button id="dw-save-logs" style="${CSS.btnBase + CSS.iconBtn}margin:0;" title="Save Logs">📄</button>
    `;
    container.appendChild(saveRow);
    saveRow.querySelector('#dw-save-path').onclick = exportPath;
    saveRow.querySelector('#dw-save-logs').onclick = exportLogs;

    // Pace control
    const paceRow = document.createElement('div');
    paceRow.style.cssText = `display: flex; flex-direction: column; gap: 2px;`;
    paceRow.innerHTML = `
      <span style="${CSS.statLabel}; text-align: center;">Pace: <span id="dw-pace-val">${(engine.getConfig().pace / 1000).toFixed(1)}s</span></span>
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
      startStopBtn.style.background = 'rgba(18,18,20,0.95)';
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
      console.log('🟣 UI Initialized (Compact)');
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
