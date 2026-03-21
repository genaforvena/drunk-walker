/**
 * UI Controller - Control Panel Management
 * v5.9.0-UI-OVERHAUL
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '5.9.0',
    autoStart = true,
    onPathCollectionToggle = null
  } = options;

  let container = null;
  let btn = null;
  let statusEl = null;
  let stepsEl = null;
  let visitedEl = null;
  let paceValEl = null;
  let paceSlider = null;
  let mainContent = null;
  let isMinimized = false;
  
  // Session logs storage
  const sessionLogs = [];
  const originalConsoleLog = console.log;
  
  // Intercept console.log
  console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    sessionLogs.push(`[${timestamp}] ${message}`);
    originalConsoleLog.apply(console, args);
  };

  // Styles
  const CSS = {
    panel: `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 280px;
      background: rgba(10, 10, 10, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 255, 0, 0.3);
      border-radius: 12px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 255, 0, 0.1);
      color: #e0e0e0;
      font-family: 'Segoe UI', 'Roboto', monospace;
      font-size: 13px;
      z-index: 1000000;
      transition: height 0.3s ease;
      overflow: hidden;
      user-select: none;
    `,
    header: `
      padding: 12px 15px;
      background: rgba(0, 255, 0, 0.05);
      border-bottom: 1px solid rgba(0, 255, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
    `,
    title: `
      font-weight: 700;
      color: #0f0;
      letter-spacing: 0.5px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    `,
    module: `
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `,
    grid: `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    `,
    statBox: `
      background: rgba(255, 255, 255, 0.03);
      padding: 8px;
      border-radius: 6px;
      text-align: center;
    `,
    statLabel: `
      display: block;
      font-size: 10px;
      color: #888;
      margin-bottom: 2px;
      text-transform: uppercase;
    `,
    statValue: `
      display: block;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      font-family: monospace;
    `,
    btnPrimary: `
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 5px;
    `,
    btnSecondary: `
      background: rgba(255, 255, 255, 0.05);
      color: #ccc;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      width: 100%;
      margin-top: 5px;
      transition: background 0.2s;
    `,
    sliderContainer: `
      margin-top: 10px;
    `,
    sliderLabel: `
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 11px;
      color: #aaa;
    `,
    slider: `
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      outline: none;
      -webkit-appearance: none;
    `
  };

  // Draggable logic
  const makeDraggable = (element, handle) => {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      // Calculate initial position relative to viewport
      const rect = element.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      
      handle.style.cursor = 'grabbing';
      
      // Remove 'right' and 'bottom' positioning to allow free movement via 'left'/'top'
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.left = `${initialLeft}px`;
      element.style.top = `${initialTop}px`;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      handle.style.cursor = 'grab';
    });
  };

  const createUI = () => {
    container = document.createElement('div');
    container.id = 'dw-panel';
    container.style.cssText = CSS.panel;

    // --- HEADER ---
    const header = document.createElement('div');
    header.style.cssText = CSS.header;
    
    const titleArea = document.createElement('div');
    titleArea.style.cssText = CSS.title;
    titleArea.innerHTML = '<span>🤪</span> DRUNK WALKER';
    
    const minBtn = document.createElement('button');
    minBtn.innerHTML = '−';
    minBtn.style.cssText = 'background:none;border:none;color:#0f0;font-size:16px;cursor:pointer;padding:0 5px;';
    minBtn.onclick = toggleMinimize;

    header.appendChild(titleArea);
    header.appendChild(minBtn);
    container.appendChild(header);

    // --- MAIN CONTENT ---
    mainContent = document.createElement('div');
    
    // Module 1: Status Grid
    const statusMod = document.createElement('div');
    statusMod.style.cssText = CSS.module;
    
    const grid = document.createElement('div');
    grid.style.cssText = CSS.grid;
    
    const createStat = (label, id, def) => {
      const el = document.createElement('div');
      el.style.cssText = CSS.statBox;
      el.innerHTML = `<span style="${CSS.statLabel}">${label}</span><span id="${id}" style="${CSS.statValue}">${def}</span>`;
      return { container: el, val: el.querySelector(`#${id}`) };
    };

    const s1 = createStat('STEPS', 'dw-steps', '0');
    stepsEl = s1.val;
    const s2 = createStat('VISITED', 'dw-visited', '0');
    visitedEl = s2.val;
    
    grid.appendChild(s1.container);
    grid.appendChild(s2.container);
    
    const statusLine = document.createElement('div');
    statusLine.style.cssText = 'margin-top:10px;text-align:center;font-size:11px;color:#aaa;';
    statusLine.innerHTML = 'STATUS: <span id="dw-status" style="color:#fff;font-weight:bold;">IDLE</span>';
    statusMod.appendChild(grid);
    statusMod.appendChild(statusLine);
    statusEl = statusLine.querySelector('#dw-status');
    
    mainContent.appendChild(statusMod);

    // Module 2: Primary Controls
    const ctrlMod = document.createElement('div');
    ctrlMod.style.cssText = CSS.module;
    
    btn = document.createElement('button');
    btn.innerText = 'START WALKING';
    btn.style.cssText = CSS.btnPrimary + 'background:#0f0;color:#000;box-shadow:0 0 10px rgba(0,255,0,0.3);';
    btn.onmouseover = () => btn.style.transform = 'translateY(-1px)';
    btn.onmouseout = () => btn.style.transform = 'translateY(0)';
    btn.onclick = () => {
      if (engine.isNavigating()) engine.stop();
      else engine.start();
      updateButton();
    };
    
    ctrlMod.appendChild(btn);
    mainContent.appendChild(ctrlMod);

    // Module 3: Settings
    const setMod = document.createElement('div');
    setMod.style.cssText = CSS.module;
    
    const sliderBox = document.createElement('div');
    sliderBox.style.cssText = CSS.sliderContainer;
    
    const labelLine = document.createElement('div');
    labelLine.style.cssText = CSS.sliderLabel;
    labelLine.innerHTML = '<span>HEARTBEAT PACE</span><span id="dw-pace-val">2.0s</span>';
    paceValEl = labelLine.querySelector('#dw-pace-val');
    
    paceSlider = document.createElement('input');
    paceSlider.type = 'range';
    paceSlider.min = '500';
    paceSlider.max = '5000';
    paceSlider.step = '100';
    paceSlider.value = engine.getConfig().pace;
    paceSlider.style.cssText = CSS.slider;
    paceSlider.oninput = () => {
      const val = parseInt(paceSlider.value);
      paceValEl.innerText = (val/1000).toFixed(1) + 's';
      engine.setPace(val);
    };
    
    sliderBox.appendChild(labelLine);
    sliderBox.appendChild(paceSlider);
    setMod.appendChild(sliderBox);
    mainContent.appendChild(setMod);

    // Module 4: Data Actions
    const dataMod = document.createElement('div');
    dataMod.style.cssText = CSS.module + 'border-bottom:none;';
    
    const dlPathBtn = document.createElement('button');
    dlPathBtn.innerText = '💾 EXPORT PATH JSON';
    dlPathBtn.style.cssText = CSS.btnSecondary;
    dlPathBtn.onmouseover = () => dlPathBtn.style.background = 'rgba(255,255,255,0.1)';
    dlPathBtn.onmouseout = () => dlPathBtn.style.background = 'rgba(255,255,255,0.05)';
    dlPathBtn.onclick = exportPath;

    const dlLogsBtn = document.createElement('button');
    dlLogsBtn.innerText = '📄 EXPORT LOGS TXT';
    dlLogsBtn.style.cssText = CSS.btnSecondary;
    dlLogsBtn.onmouseover = () => dlLogsBtn.style.background = 'rgba(255,255,255,0.1)';
    dlLogsBtn.onmouseout = () => dlLogsBtn.style.background = 'rgba(255,255,255,0.05)';
    dlLogsBtn.onclick = exportLogs;

    dataMod.appendChild(dlPathBtn);
    dataMod.appendChild(dlLogsBtn);
    mainContent.appendChild(dataMod);

    container.appendChild(mainContent);
    document.body.appendChild(container);

    // Initialize drag
    makeDraggable(container, header);
    
    if (onPathCollectionToggle) onPathCollectionToggle(true);
    engine.setSelfAvoiding(true);
  };

  const toggleMinimize = () => {
    isMinimized = !isMinimized;
    const btn = container.querySelector('button');
    if (isMinimized) {
      mainContent.style.display = 'none';
      btn.innerText = '+';
      container.style.width = '180px';
    } else {
      mainContent.style.display = 'block';
      btn.innerText = '−';
      container.style.width = '280px';
    }
  };

  const updateButton = () => {
    if (!btn) return;
    if (engine.isNavigating()) {
      btn.innerText = 'PAUSE HEARTBEAT';
      btn.style.background = 'rgba(255, 50, 50, 0.9)';
      btn.style.color = '#fff';
      btn.style.boxShadow = '0 0 10px rgba(255,0,0,0.3)';
    } else {
      btn.innerText = 'START WALKING';
      btn.style.background = '#0f0';
      btn.style.color = '#000';
      btn.style.boxShadow = '0 0 10px rgba(0,255,0,0.3)';
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
    if (sessionLogs.length === 0) {
      alert('No logs recorded yet.');
      return;
    }
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
    if (statusEl) statusEl.innerText = statusText + (stuckCount > 0 ? ` (STUCK ${stuckCount})` : '');
    if (stepsEl) stepsEl.innerText = stepCount;
    if (visitedEl) visitedEl.innerText = engine.getVisitedCount();
    updateButton();
  };

  const init = () => {
    if (!document.body) return { destroy: () => {} };
    try {
      createUI();
      updateButton();
      if (autoStart) engine.start();
      console.log('🤪 UI Initialized');
      return { destroy };
    } catch (e) {
      console.error('UI Init Failed:', e);
      return { destroy: () => {} };
    }
  };

  const destroy = () => {
    engine.stop();
    if (container) container.remove();
  };

  return { init, destroy, onStatusUpdate };
}
