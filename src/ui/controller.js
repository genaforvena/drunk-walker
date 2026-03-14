/**
 * UI Controller - Control Panel Management
 */

export function createControlPanel(engine, options = {}) {
  const {
    version = '3.2-EXP',
    autoStart = true
  } = options;

  let container = null;
  let btn = null;
  let statusEl = null;
  let stepsEl = null;
  let paceValEl = null;
  let paceSlider = null;
  let turnValEl = null;
  let turnSlider = null;

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

    // Turn duration control
    const turnLabel = document.createElement('div');
    turnLabel.style.fontSize = '10px';
    turnLabel.style.marginTop = '8px';
    turnLabel.innerHTML = 'TURN: <span id="dw-turn-val">60</span>°';
    container.appendChild(turnLabel);
    turnValEl = turnLabel.querySelector('#dw-turn-val');

    turnSlider = document.createElement('input');
    turnSlider.type = 'range';
    turnSlider.min = '150';
    turnSlider.max = '1200';
    turnSlider.step = '50';
    turnSlider.value = engine.getConfig().turnDuration;
    turnSlider.style.width = '100%';
    turnSlider.oninput = () => {
      const newDuration = parseInt(turnSlider.value);
      if (turnValEl) turnValEl.innerText = Math.round(newDuration / 10);
      engine.setTurnDuration(newDuration);
    };
    container.appendChild(turnSlider);

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

  return { init, destroy, onStatusUpdate };
}
