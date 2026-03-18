/**
 * UI Controller - Control Panel Management
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '3.70.0-EXP',
    autoStart = true,
    onPathCollectionToggle = null  // Callback for path collection toggle
  } = options;

  let container = null;
  let btn = null;
  let statusEl = null;
  let stepsEl = null;
  let visitedEl = null;
  let paceValEl = null;
  let paceSlider = null;
  let downloadLogsBtn = null;
  let minimizeBtn = null;
  let mainContent = null;
  let isMinimized = false;
  
  // Session logs storage
  const sessionLogs = [];
  const originalConsoleLog = console.log;
  
  // Intercept console.log to capture logs
  console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    sessionLogs.push(`[${timestamp}] ${message}`);
    originalConsoleLog.apply(console, args);
  };

  // Create UI elements
  const createUI = () => {
    container = document.createElement('div');
    container.id = 'dw-ctrl-panel';
    container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';

    // Header with minimize button
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;';
    
    const title = document.createElement('div');
    title.innerText = `🤪 DRUNK WALKER v${version}`;
    title.style.fontSize = '12px';
    title.style.fontWeight = 'bold';
    
    minimizeBtn = document.createElement('button');
    minimizeBtn.innerText = '−';
    minimizeBtn.style.cssText = 'background:none;border:1px solid #0f0;color:#0f0;cursor:pointer;padding:0 5px;font-weight:bold;font-size:14px;';
    minimizeBtn.onclick = toggleMinimize;
    
    header.appendChild(title);
    header.appendChild(minimizeBtn);
    container.appendChild(header);

    const hr = document.createElement('hr');
    hr.id = 'dw-header-hr';
    hr.style.borderColor = '#0f0';
    container.appendChild(hr);

    // Visible Steps (Always visible or in steps section)
    const stepsLine = document.createElement('div');
    stepsLine.style.margin = '5px 0';
    stepsLine.innerHTML = 'STEPS: <span id="dw-steps">0</span>';
    container.appendChild(stepsLine);
    stepsEl = stepsLine.querySelector('#dw-steps');

    // Main Content wrapper (Toggleable)
    mainContent = document.createElement('div');
    mainContent.id = 'dw-main-content';
    
    // Remaining Stats
    const stats = document.createElement('div');
    stats.style.margin = '5px 0';
    stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>VISITED: <span id="dw-visited">0</span>';
    mainContent.appendChild(stats);
    statusEl = stats.querySelector('#dw-status');
    visitedEl = stats.querySelector('#dw-visited');

    // Pace control
    const paceLabel = document.createElement('div');
    paceLabel.style.fontSize = '10px';
    paceLabel.style.marginTop = '10px';
    paceLabel.innerHTML = 'PACE: <span id="dw-pace-val">2.0</span>s';
    mainContent.appendChild(paceLabel);
    paceValEl = paceLabel.querySelector('#dw-pace-val');

    paceSlider = document.createElement('input');
    paceSlider.type = 'range';
    paceSlider.min = '500';
    paceSlider.max = '5000';
    paceSlider.step = '100';
    paceSlider.value = engine.getConfig().pace;
    paceSlider.style.width = '100%';
    paceSlider.oninput = () => {
      const newPace = parseInt(paceSlider.value);
      if (paceValEl) paceValEl.innerText = (newPace / 1000).toFixed(1);
      engine.setPace(newPace);
    };
    mainContent.appendChild(paceSlider);

    // Path export button (Download only)
    const exportDiv = document.createElement('div');
    exportDiv.style.cssText = 'display:flex;gap:5px;margin-top:8px;';
    
    // Download path JSON button
    const downloadPathBtn = document.createElement('button');
    downloadPathBtn.innerText = '💾 Download Path';
    downloadPathBtn.style.cssText = 'flex:1;padding:6px;background:#28a745;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    downloadPathBtn.onclick = () => {
      const walkPath = engine.getWalkPath();
      if (walkPath.length === 0) {
        alert('No path recorded. Start walking!');
        return;
      }
      const jsonStr = JSON.stringify(walkPath, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `walk-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      downloadPathBtn.innerText = '✓ Downloaded!';
      setTimeout(() => {
        downloadPathBtn.innerText = '💾 Download Path';
      }, 2000);
    };
    
    exportDiv.appendChild(downloadPathBtn);
    mainContent.appendChild(exportDiv);

    // Download logs button
    const logsDiv = document.createElement('div');
    logsDiv.style.cssText = 'display:flex;gap:5px;margin-top:8px;';
    
    downloadLogsBtn = document.createElement('button');
    downloadLogsBtn.innerText = '📄 Download Logs';
    downloadLogsBtn.style.cssText = 'width:100%;padding:6px;background:#ff6600;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    downloadLogsBtn.onclick = () => {
      if (sessionLogs.length === 0) {
        alert('No logs recorded yet. Start walking to generate logs!');
        return;
      }
      
      const logContent = sessionLogs.join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `walk-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      downloadLogsBtn.innerText = '✓ Downloaded!';
      setTimeout(() => {
        downloadLogsBtn.innerText = '📄 Download Logs';
      }, 2000);
    };
    
    logsDiv.appendChild(downloadLogsBtn);
    mainContent.appendChild(logsDiv);

    // Restore Walk from JSON button
    const restoreBtn = document.createElement('button');
    restoreBtn.innerText = '📂 Restore Walk';
    restoreBtn.style.cssText = 'width:100%;margin-top:8px;padding:6px;background:#663399;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    restoreBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const walkPath = JSON.parse(event.target.result);
            if (!Array.isArray(walkPath) || walkPath.length === 0) {
              throw new Error('Invalid walk path format');
            }
            
            // Validate path structure
            const firstStep = walkPath[0];
            if (!firstStep.url && !firstStep.location) {
              throw new Error('Invalid path entries');
            }
            
            // Restore walk path
            engine.setWalkPath(walkPath);

            // Restore visited URLs from path
            engine.restoreVisitedFromPath(walkPath);

            // Navigate to last URL in path
            const lastStep = walkPath[walkPath.length - 1];
            if (lastStep.url) {
              window.location.href = lastStep.url;
            }
            
            console.log(`🤪 DRUNK WALKER: Restored walk with ${walkPath.length} steps`);
            alert(`✓ Walk restored!\n\n${walkPath.length} steps loaded\nNavigating to last position...`);
          } catch (err) {
            console.error('Failed to restore walk:', err);
            alert('❌ Failed to restore walk\n\n' + err.message + '\n\nPlease ensure the file is a valid walk JSON export.');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };
    mainContent.appendChild(restoreBtn);

    // Start/Stop button
    btn = document.createElement('button');
    btn.innerText = '▶ START';
    btn.style.cssText = 'width:100%;margin-top:10px;padding:8px;background:#0f0;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:5px;';
    btn.onclick = () => {
      if (engine.isNavigating()) {
        engine.stop();
      } else {
        engine.start();
      }
      updateButton();
    };
    mainContent.appendChild(btn);

    container.appendChild(mainContent);
    document.body.appendChild(container);
    
    // Ensure features are enabled by default as requested
    if (onPathCollectionToggle) onPathCollectionToggle(true);
    engine.setSelfAvoiding(true);
  };

  const toggleMinimize = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      mainContent.style.display = 'none';
      minimizeBtn.innerText = '+';
      container.style.minWidth = '100px';
    } else {
      mainContent.style.display = 'block';
      minimizeBtn.innerText = '−';
      container.style.minWidth = '180px';
    }
  };

  // Update button appearance based on state
  const updateButton = () => {
    if (!btn) return;
    if (engine.isNavigating()) {
      btn.innerText = '🔴 STOP';
      btn.style.background = '#f00';
    } else {
      btn.innerText = '▶ START';
      btn.style.background = '#0f0';
    }
  };

  // Status update handler
  const onStatusUpdate = (statusText, stepCount, stuckCount) => {
    if (statusEl) statusEl.innerText = statusText;
    if (stepsEl) stepsEl.innerText = stepCount;
    if (visitedEl) visitedEl.innerText = engine.getVisitedCount();
    updateButton();
  };

  // Initialize
  const init = () => {
    // Wait for DOM to be ready
    if (!document.body) {
      console.error('🤪 DRUNK WALKER: document.body not ready yet');
      return { destroy: () => {} };
    }

    try {
      createUI();
      updateButton();

      if (autoStart) {
        engine.start();
      }

      console.log('🤪 Control panel created successfully');
      return { destroy };
    } catch (error) {
      console.error('🤪 DRUNK WALKER: Failed to initialize UI:', error);
      return { destroy: () => {} };
    }
  };

  // Path collection state getter - always true now
  const getPathCollectionEnabled = () => true;

  // Cleanup
  const destroy = () => {
    engine.stop();
    if (container) {
      container.remove();
      container = null;
    }
  };

  return { init, destroy, onStatusUpdate, getPathCollectionEnabled };
}
