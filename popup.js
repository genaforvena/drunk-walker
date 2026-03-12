// Drunk Walker - Popup Script

const els = {
  clickInterval: document.getElementById('click-interval'),
  intervalVal: document.getElementById('interval-val'),
  clickRadius: document.getElementById('click-radius'),
  radiusVal: document.getElementById('radius-val'),
  maxSteps: document.getElementById('max-steps'),
  statusText: document.getElementById('status-text'),
  progressText: document.getElementById('progress-text'),
  fsWarning: document.getElementById('fs-warning'),
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnPause: document.getElementById('btn-pause'),
};

function updateUI(state) {
  els.statusText.textContent = state.status.charAt(0).toUpperCase() + state.status.slice(1);
  if (state.isPanicMode) {
    els.statusText.textContent += " (PANIC!)";
    els.statusText.style.color = "red";
  } else {
    els.statusText.style.color = "inherit";
  }

  els.progressText.textContent = `${state.stepsTaken} / ${state.maxSteps} steps`;
  
  // Update button text for Pause/Resume
  els.btnPause.textContent = state.status === 'paused' ? '▶ RESUME' : '⏸ PAUSE';

  // Check status reported from content script
  if (!state.isFullScreen && state.status !== 'idle') {
    els.fsWarning.style.display = 'block';
    els.fsWarning.textContent = "⚠️ NOT IN FULL-SCREEN MODE!";
  } else if (!state.isStreetView && state.status !== 'idle') {
    els.fsWarning.style.display = 'block';
    els.fsWarning.textContent = "⚠️ NOT IN STREET VIEW!";
  } else {
    els.fsWarning.style.display = 'none';
  }
}

async function refreshState() {
  const state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  updateUI(state);
}

// Initial state fetch
refreshState();
setInterval(refreshState, 1000);

// Event Listeners
els.clickInterval.oninput = () => {
  els.intervalVal.textContent = els.clickInterval.value;
};

els.clickRadius.oninput = () => {
  els.radiusVal.textContent = els.clickRadius.value;
};

els.btnStart.onclick = async () => {
  await browser.runtime.sendMessage({
    type: 'START',
    payload: {
      clickInterval: parseFloat(els.clickInterval.value) * 1000,
      clickRadius: parseInt(els.clickRadius.value),
      maxSteps: parseInt(els.maxSteps.value),
      isYoloMode: false
    }
  });
  refreshState();
};

els.btnStop.onclick = async () => {
  await browser.runtime.sendMessage({ type: 'STOP' });
  refreshState();
};

els.btnPause.onclick = async () => {
  await browser.runtime.sendMessage({ type: 'PAUSE' });
  refreshState();
};

const btnYolo = document.getElementById('btn-yolo');
if (btnYolo) {
  btnYolo.onclick = async () => {
    // YOLO Preset
    els.clickInterval.value = 1.0;
    els.clickRadius.value = 100;
    els.maxSteps.value = 10000;
    
    els.intervalVal.textContent = els.clickInterval.value;
    els.radiusVal.textContent = els.clickRadius.value;
    
    await browser.runtime.sendMessage({
      type: 'START',
      payload: {
        clickInterval: 1000,
        clickRadius: 100,
        maxSteps: 10000,
        isYoloMode: true
      }
    });
    refreshState();
  };
}
