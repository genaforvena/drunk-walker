/**
 * UI Controller - Control Panel Management
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '3.67.1-EXP',
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
  let collectCheckbox = null;
  let copyPathBtn = null;
  let updateBtn = null;

  // Create UI elements
  const createUI = () => {
    container = document.createElement('div');
    container.id = 'dw-ctrl-panel';
    container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';

    // Title
    const title = document.createElement('div');
    title.innerHTML = `🤪 DRUNK WALKER v${version}<hr style="border-color:#0f0">`;
    container.appendChild(title);

    // Stats
    const stats = document.createElement('div');
    stats.style.margin = '10px 0';
    stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>STEPS: <span id="dw-steps">0</span><br>VISITED: <span id="dw-visited">0</span>';
    container.appendChild(stats);
    statusEl = stats.querySelector('#dw-status');
    stepsEl = stats.querySelector('#dw-steps');
    visitedEl = stats.querySelector('#dw-visited');

    // Pace control
    const paceLabel = document.createElement('div');
    paceLabel.style.fontSize = '10px';
    paceLabel.innerHTML = 'PACE: <span id="dw-pace-val">2.0</span>s';
    container.appendChild(paceLabel);
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
    container.appendChild(paceSlider);

    // Path collection toggle (opt-in)
    const collectDiv = document.createElement('div');
    collectDiv.style.fontSize = '10px';
    collectDiv.style.marginTop = '8px';
    collectDiv.style.display = 'flex';
    collectDiv.style.alignItems = 'center';
    collectDiv.style.gap = '5px';
    collectCheckbox = document.createElement('input');
    collectCheckbox.type = 'checkbox';
    collectCheckbox.id = 'dw-record-path';
    collectCheckbox.checked = true;  // Enabled by default
    collectCheckbox.onchange = () => {
      if (onPathCollectionToggle) {
        onPathCollectionToggle(collectCheckbox.checked);
      }
    };
    const collectLabel = document.createElement('label');
    collectLabel.htmlFor = 'dw-record-path';
    collectLabel.innerText = 'Record Path';
    collectLabel.style.cursor = 'pointer';
    collectDiv.appendChild(collectCheckbox);
    collectDiv.appendChild(collectLabel);
    container.appendChild(collectDiv);

    // Self-avoiding walk toggle (opt-in)
    const selfAvoidingDiv = document.createElement('div');
    selfAvoidingDiv.style.fontSize = '10px';
    selfAvoidingDiv.style.marginTop = '4px';
    selfAvoidingDiv.style.display = 'flex';
    selfAvoidingDiv.style.alignItems = 'center';
    selfAvoidingDiv.style.gap = '5px';
    const selfAvoidingCheckbox = document.createElement('input');
    selfAvoidingCheckbox.type = 'checkbox';
    selfAvoidingCheckbox.id = 'dw-self-avoiding';
    selfAvoidingCheckbox.checked = true;  // Enabled by default
    selfAvoidingCheckbox.onchange = () => {
      engine.setSelfAvoiding(selfAvoidingCheckbox.checked);
    };
    const selfAvoidingLabel = document.createElement('label');
    selfAvoidingLabel.htmlFor = 'dw-self-avoiding';
    selfAvoidingLabel.innerText = 'Self-Avoiding Walk';
    selfAvoidingLabel.style.cursor = 'pointer';
    selfAvoidingDiv.appendChild(selfAvoidingCheckbox);
    selfAvoidingDiv.appendChild(selfAvoidingLabel);
    container.appendChild(selfAvoidingDiv);

    // Backward mode toggle (opt-in, default off)
    const backwardDiv = document.createElement('div');
    backwardDiv.style.fontSize = '10px';
    backwardDiv.style.marginTop = '4px';
    backwardDiv.style.display = 'flex';
    backwardDiv.style.alignItems = 'center';
    backwardDiv.style.gap = '5px';
    const backwardCheckbox = document.createElement('input');
    backwardCheckbox.type = 'checkbox';
    backwardCheckbox.id = 'dw-backward';
    backwardCheckbox.checked = false;  // Disabled by default
    backwardCheckbox.onchange = () => {
      engine.setBackward(backwardCheckbox.checked);
    };
    const backwardLabel = document.createElement('label');
    backwardLabel.htmlFor = 'dw-backward';
    backwardLabel.innerText = 'Backward Mode';
    backwardLabel.style.cursor = 'pointer';
    backwardDiv.appendChild(backwardCheckbox);
    backwardDiv.appendChild(backwardLabel);
    container.appendChild(backwardDiv);

    // Path export buttons (Copy + Download)
    const exportDiv = document.createElement('div');
    exportDiv.style.cssText = 'display:flex;gap:5px;margin-top:8px;';
    
    // Copy path JSON button
    copyPathBtn = document.createElement('button');
    copyPathBtn.innerText = '📋 Copy';
    copyPathBtn.style.cssText = 'flex:1;padding:6px;background:#0066cc;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    copyPathBtn.onclick = () => {
      const walkPath = engine.getWalkPath();
      if (walkPath.length === 0) {
        alert('No path recorded. Enable "Record Path" and start walking!');
        return;
      }
      const jsonStr = JSON.stringify(walkPath, null, 2);
      navigator.clipboard.writeText(jsonStr).then(() => {
        copyPathBtn.innerText = '✓ Copied!';
        setTimeout(() => {
          copyPathBtn.innerText = '📋 Copy';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      });
    };
    
    // Download path JSON button
    const downloadPathBtn = document.createElement('button');
    downloadPathBtn.innerText = '💾 Download';
    downloadPathBtn.style.cssText = 'flex:1;padding:6px;background:#28a745;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    downloadPathBtn.onclick = () => {
      const walkPath = engine.getWalkPath();
      if (walkPath.length === 0) {
        alert('No path recorded. Enable "Record Path" and start walking!');
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
        downloadPathBtn.innerText = '💾 Download';
      }, 2000);
    };
    
    exportDiv.appendChild(copyPathBtn);
    exportDiv.appendChild(downloadPathBtn);
    container.appendChild(exportDiv);

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
    container.appendChild(restoreBtn);

    // Update script button
    updateBtn = document.createElement('button');
    updateBtn.innerText = '🔄 Update Script';
    updateBtn.style.cssText = 'width:100%;margin-top:8px;padding:6px;background:#cc6600;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    updateBtn.onclick = () => {
      updateScriptFromGitHub();
    };
    container.appendChild(updateBtn);

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
    container.appendChild(btn);

    document.body.appendChild(container);
  };

  // Update button appearance based on state
  const updateButton = () => {
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

  // Path collection state getter
  const getPathCollectionEnabled = () => collectCheckbox ? collectCheckbox.checked : false;

  // Update script from GitHub
  const updateScriptFromGitHub = async () => {
    if (!updateBtn) return;
    
    const originalText = updateBtn.innerText;
    updateBtn.innerText = '⏳ Updating...';
    updateBtn.disabled = true;

    try {
      const response = await fetch('https://raw.githubusercontent.com/genaforvena/drunk-walker/main/bookmarklet-console.js');
      if (!response.ok) {
        throw new Error('Failed to fetch latest version');
      }
      
      const latestCode = await response.text();
      
      // Extract version from latest code
      const versionMatch = latestCode.match(/v([\d.]+-EXP)/);
      const latestVersion = versionMatch ? versionMatch[1] : 'unknown';
      
      // Compare with current version
      const currentVersion = version.replace('v', '').replace('-EXP', '');
      
      if (latestVersion.includes(currentVersion)) {
        updateBtn.innerText = '✓ Up to date!';
        setTimeout(() => {
          updateBtn.innerText = originalText;
          updateBtn.disabled = false;
        }, 2000);
        alert(`You're already on the latest version (v${latestVersion})`);
        return;
      }

      // Show update confirmation
      if (confirm(`New version available: v${latestVersion}\n\nThis will copy the latest script to your clipboard. Paste it into the console to update.`)) {
        await navigator.clipboard.writeText(latestCode);
        updateBtn.innerText = '✓ Copied!';
        setTimeout(() => {
          updateBtn.innerText = originalText;
          updateBtn.disabled = false;
        }, 2000);
        alert('Latest script copied to clipboard!\n\nPaste it into the console (F12) and press Enter to update.');
      } else {
        updateBtn.innerText = originalText;
        updateBtn.disabled = false;
      }
    } catch (error) {
      console.error('Update failed:', error);
      updateBtn.innerText = '❌ Failed';
      setTimeout(() => {
        updateBtn.innerText = originalText;
        updateBtn.disabled = false;
      }, 2000);
      alert('Failed to fetch update. Please check your internet connection.');
    }
  };

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
