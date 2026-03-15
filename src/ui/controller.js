/**
 * UI Controller - Control Panel Management
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '3.66.6-EXP',
    autoStart = true,
    onPathCollectionToggle = null  // Callback for path collection toggle
  } = options;

  let container = null;
  let btn = null;
  let statusEl = null;
  let stepsEl = null;
  let paceValEl = null;
  let paceSlider = null;
  let collectCheckbox = null;
  let copyPathBtn = null;
  let screensaverBtn = null;
  let updateBtn = null;
  let screensaverWindow = null;

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
    stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>STEPS: <span id="dw-steps">0</span>';
    container.appendChild(stats);
    statusEl = stats.querySelector('#dw-status');
    stepsEl = stats.querySelector('#dw-steps');

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

    // Copy path JSON button
    copyPathBtn = document.createElement('button');
    copyPathBtn.innerText = '📋 Copy Path JSON';
    copyPathBtn.style.cssText = 'width:100%;margin-top:8px;padding:6px;background:#0066cc;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
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
          copyPathBtn.innerText = '📋 Copy Path JSON';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      });
    };
    container.appendChild(copyPathBtn);

    // Screen Saver Mode button
    screensaverBtn = document.createElement('button');
    screensaverBtn.innerText = '🖥️ Screen Saver Mode';
    screensaverBtn.style.cssText = 'width:100%;margin-top:8px;padding:6px;background:#663399;color:#fff;border:none;font-weight:bold;cursor:pointer;border-radius:4px;font-size:10px;';
    screensaverBtn.onclick = () => {
      toggleScreensaverMode();
    };
    container.appendChild(screensaverBtn);

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

  // Cleanup
  const destroy = () => {
    engine.stop();
    if (container) {
      container.remove();
      container = null;
    }
  };

  // Path collection state getter
  const getPathCollectionEnabled = () => collectCheckbox ? collectCheckbox.checked : false;

  // Screen Saver Mode - opens dedicated window with persistent walker
  const toggleScreensaverMode = () => {
    if (screensaverWindow && !screensaverWindow.closed) {
      // Close existing screensaver window
      screensaverWindow.close();
      screensaverWindow = null;
      if (screensaverBtn) screensaverBtn.innerText = '🖥️ Screen Saver Mode';
      return;
    }

    // Check for existing saved session
    const existingSession = localStorage.getItem('drunkWalkerScreensaver');
    
    // Save current state to localStorage (includes walk path)
    const state = {
      isWalking: engine.isNavigating(),
      pace: engine.getConfig().pace,
      steps: engine.getSteps(),
      url: window.location.href,
      walkPath: engine.getWalkPath(),  // Save recorded path
      timestamp: Date.now()
    };
    localStorage.setItem('drunkWalkerScreensaver', JSON.stringify(state));

    // Determine which URL to open
    const targetUrl = existingSession ? 
      JSON.parse(existingSession).url :  // Restore last visited URL
      'https://www.google.com/maps?output=embed';  // Default to maps

    const width = Math.min(1200, window.screen.width * 0.8);
    const height = Math.min(900, window.screen.height * 0.8);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    screensaverWindow = window.open(
      targetUrl,
      'DrunkWalkerScreensaver',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );

    if (screensaverWindow) {
      if (screensaverBtn) screensaverBtn.innerText = '❌ Exit Screen Saver';
      
      // Inject walker script into new window after it loads
      setTimeout(() => {
        try {
          screensaverWindow.postMessage({
            type: 'DRUNK_WALKER_INIT',
            state: state
          }, '*');
          console.log('🤪 Screensaver session sent:', state.steps, 'steps,', state.walkPath?.length || 0, 'path points');
        } catch (e) {
          console.log('Note: Cross-origin restrictions may limit screensaver functionality');
        }
      }, 2000);
    } else {
      alert('Popup blocked! Please allow popups for this site to use Screen Saver Mode.');
    }
  };

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

  // Listen for screensaver window close
  const checkScreensaverWindow = setInterval(() => {
    if (screensaverWindow && screensaverWindow.closed) {
      screensaverWindow = null;
      if (screensaverBtn) screensaverBtn.innerText = '🖥️ Screen Saver Mode';
      localStorage.removeItem('drunkWalkerScreensaver');
    }
  }, 1000);

  // Cleanup
  const destroy = () => {
    clearInterval(checkScreensaverWindow);
    if (screensaverWindow && !screensaverWindow.closed) {
      screensaverWindow.close();
    }
    localStorage.removeItem('drunkWalkerScreensaver');
    engine.stop();
    if (container) {
      container.remove();
      container = null;
    }
  };

  return { init, destroy, onStatusUpdate, getPathCollectionEnabled };
}
