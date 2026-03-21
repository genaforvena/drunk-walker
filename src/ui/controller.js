/**
 * UI Controller - Sleek Modern Control Panel
 * v6.0.0-CYBERPUNK
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '6.0.0',
    autoStart = true,
    onPathCollectionToggle = null
  } = options;

  let container = null;
  let btn = null;
  let statusEl = null;
  let stepsEl = null;
  let visitedEl = null;
  let stuckEl = null;
  let paceValEl = null;
  let paceSlider = null;
  let mainContent = null;
  let isMinimized = false;
  
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
    panel: `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: rgba(18, 18, 20, 0.75);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: 
        0 20px 40px -10px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      color: #f0f0f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 13px;
      z-index: 1000000;
      transition: height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s;
      overflow: hidden;
      user-select: none;
    `,
    header: `
      padding: 16px 20px;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
    `,
    title: `
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `,
    badge: `
      background: rgba(0, 255, 128, 0.15);
      color: #00ff80;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      border: 1px solid rgba(0, 255, 128, 0.2);
    `,
    content: `
      padding: 20px;
    `,
    grid: `
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    `,
    statItem: `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `,
    statLabel: `
      font-size: 10px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.4);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    `,
    statValue: `
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      font-feature-settings: "tnum";
      letter-spacing: -0.5px;
    `,
    statusRow: `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    `,
    statusText: `
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      gap: 8px;
    `,
    stuckIndicator: `
      font-size: 11px;
      font-weight: 700;
      color: #ff4d4d;
      background: rgba(255, 77, 77, 0.1);
      padding: 2px 8px;
      border-radius: 100px;
      border: 1px solid rgba(255, 77, 77, 0.2);
      opacity: 0;
      transition: opacity 0.2s;
    `,
    controls: `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `,
    btnMain: `
      width: 100%;
      height: 44px;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: relative;
      overflow: hidden;
    `,
    btnSecondaryGroup: `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    `,
    btnSec: `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.8);
      height: 36px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `,
    sliderWrapper: `
      margin-top: 8px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    `,
    sliderHeader: `
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
    `,
    slider: `
      width: 100%;
      -webkit-appearance: none;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      outline: none;
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
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.left = `${initialLeft}px`;
      element.style.top = `${initialTop}px`;
      element.style.transform = 'scale(1.02)';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'grab';
        element.style.transform = 'scale(1)';
      }
    });
  };

  const createUI = () => {
    container = document.createElement('div');
    container.id = 'dw-modern-panel';
    container.style.cssText = CSS.panel;

    // Header
    const header = document.createElement('div');
    header.style.cssText = CSS.header;
    header.innerHTML = `
      <div style="${CSS.title}">
        <span>🟣</span> DRUNK WALKER
        <span style="${CSS.badge}">v${version}</span>
      </div>
      <button id="dw-min-btn" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;padding:4px;">
        <svg width="12" height="2" viewBox="0 0 12 2" fill="currentColor"><rect width="12" height="2" rx="1"/></svg>
      </button>
    `;
    container.appendChild(header);

    // Main Content
    mainContent = document.createElement('div');
    mainContent.style.cssText = CSS.content;

    // Stats Grid
    const grid = document.createElement('div');
    grid.style.cssText = CSS.grid;
    
    const createStat = (label, id, val) => `
      <div style="${CSS.statItem}">
        <span style="${CSS.statLabel}">${label}</span>
        <span id="${id}" style="${CSS.statValue}">${val}</span>
      </div>
    `;
    
    grid.innerHTML = `
      ${createStat('Steps', 'dw-steps', '0')}
      ${createStat('Visited', 'dw-visited', '0')}
      ${createStat('Pace', 'dw-pace-display', (engine.getConfig().pace/1000).toFixed(1)+'s')}
    `;
    mainContent.appendChild(grid);
    
    stepsEl = mainContent.querySelector('#dw-steps');
    visitedEl = mainContent.querySelector('#dw-visited');
    paceValEl = mainContent.querySelector('#dw-pace-display');

    // Status Row
    const statusRow = document.createElement('div');
    statusRow.style.cssText = CSS.statusRow;
    statusRow.innerHTML = `
      <div style="${CSS.statusText}">
        <div id="dw-status-dot" style="width:6px;height:6px;border-radius:50%;background:#666;"></div>
        <span id="dw-status-text">IDLE</span>
      </div>
      <span id="dw-stuck-indicator" style="${CSS.stuckIndicator}">STUCK</span>
    `;
    mainContent.appendChild(statusRow);
    
    statusEl = mainContent.querySelector('#dw-status-text');
    stuckEl = mainContent.querySelector('#dw-stuck-indicator');

    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = CSS.controls;

    btn = document.createElement('button');
    btn.style.cssText = CSS.btnMain + 'background: #fff; color: #000; box-shadow: 0 4px 12px rgba(255,255,255,0.2);';
    btn.innerHTML = '<span>▶</span> START EXPLORING';
    btn.onmouseover = () => btn.style.transform = 'translateY(-1px)';
    btn.onmouseout = () => btn.style.transform = 'translateY(0)';
    btn.onclick = () => {
      if (engine.isNavigating()) engine.stop();
      else engine.start();
      updateButton();
    };
    controls.appendChild(btn);

    const secBtns = document.createElement('div');
    secBtns.style.cssText = CSS.btnSecondaryGroup;
    
    const dlPath = document.createElement('button');
    dlPath.innerText = '💾 JSON';
    dlPath.style.cssText = CSS.btnSec;
    dlPath.onmouseover = () => dlPath.style.background = 'rgba(255,255,255,0.1)';
    dlPath.onmouseout = () => dlPath.style.background = 'rgba(255,255,255,0.05)';
    dlPath.onclick = exportPath;
    
    const dlLogs = document.createElement('button');
    dlLogs.innerText = '📄 LOGS';
    dlLogs.style.cssText = CSS.btnSec;
    dlLogs.onmouseover = () => dlLogs.style.background = 'rgba(255,255,255,0.1)';
    dlLogs.onmouseout = () => dlLogs.style.background = 'rgba(255,255,255,0.05)';
    dlLogs.onclick = exportLogs;
    
    secBtns.appendChild(dlPath);
    secBtns.appendChild(dlLogs);
    controls.appendChild(secBtns);

    // Slider
    const sliderWrap = document.createElement('div');
    sliderWrap.style.cssText = CSS.sliderWrapper;
    sliderWrap.innerHTML = `
      <div style="${CSS.sliderHeader}">
        <span>HEARTBEAT SPEED</span>
      </div>
    `;
    
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
    
    sliderWrap.appendChild(paceSlider);
    controls.appendChild(sliderWrap);
    
    mainContent.appendChild(controls);
    container.appendChild(mainContent);
    document.body.appendChild(container);

    // Minimize logic
    header.querySelector('#dw-min-btn').onclick = toggleMinimize;
    makeDraggable(container, header);

    if (onPathCollectionToggle) onPathCollectionToggle(true);
    engine.setSelfAvoiding(true);
  };

  const toggleMinimize = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      mainContent.style.display = 'none';
      container.style.width = '200px';
    } else {
      mainContent.style.display = 'block';
      container.style.width = '300px';
    }
  };

  const updateButton = () => {
    if (!btn) return;
    const dot = document.getElementById('dw-status-dot');
    if (engine.isNavigating()) {
      btn.innerHTML = '<span>⏸</span> PAUSE';
      btn.style.background = 'rgba(255, 50, 50, 0.1)';
      btn.style.color = '#ff4d4d';
      btn.style.border = '1px solid rgba(255, 50, 50, 0.3)';
      btn.style.boxShadow = 'none';
      if (dot) {
        dot.style.background = '#00ff80';
        dot.style.boxShadow = '0 0 8px #00ff80';
      }
    } else {
      btn.innerHTML = '<span>▶</span> RESUME';
      btn.style.background = '#fff';
      btn.style.color = '#000';
      btn.style.border = 'none';
      btn.style.boxShadow = '0 4px 12px rgba(255,255,255,0.2)';
      if (dot) {
        dot.style.background = '#666';
        dot.style.boxShadow = 'none';
      }
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
    if (statusEl) statusEl.innerText = statusText;
    if (stepsEl) stepsEl.innerText = stepCount;
    if (visitedEl) visitedEl.innerText = engine.getVisitedCount();
    
    if (stuckEl) {
      if (stuckCount > 0) {
        stuckEl.style.opacity = '1';
        stuckEl.innerText = `STUCK ${stuckCount}`;
      } else {
        stuckEl.style.opacity = '0';
      }
    }
    updateButton();
  };

  const init = () => {
    if (!document.body) return { destroy: () => {} };
    try {
      createUI();
      updateButton();
      if (autoStart) engine.start();
      console.log('🟣 UI Initialized (Cyberpunk Edition)');
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
