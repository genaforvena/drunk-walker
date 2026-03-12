// Drunk Walker - Popup Script
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const els = {
  clickInterval: document.getElementById('click-interval'),
  intervalVal: document.getElementById('interval-val'),
  clickRadius: document.getElementById('click-radius'),
  radiusVal: document.getElementById('radius-val'),
  maxSteps: document.getElementById('max-steps'),
  statusText: document.getElementById('status-text'),
  progressText: document.getElementById('progress-text'),
  fsWarning: document.getElementById('fs-warning'),
  btnToggle: document.getElementById('btn-toggle'),
};

function updateUI(state) {
  const isNavigating = state.status === 'navigating';
  els.statusText.textContent = state.status.charAt(0).toUpperCase() + state.status.slice(1);
  els.statusText.style.color = "inherit";

  els.progressText.textContent = `${state.stepsTaken} / ${state.maxSteps} steps`;
  
  // Update toggle button
  if (isNavigating) {
    els.btnToggle.textContent = "🔴 STOP";
    els.btnToggle.style.background = "#ff4d4d";
  } else {
    els.btnToggle.textContent = "▶ START";
    els.btnToggle.style.background = "#4caf50";
  }

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
  const state = await browserAPI.runtime.sendMessage({ type: 'GET_STATE' });
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

els.btnToggle.onclick = async () => {
  const state = await browserAPI.runtime.sendMessage({ type: 'GET_STATE' });
  if (state.status === 'navigating') {
    await browserAPI.runtime.sendMessage({ type: 'STOP' });
  } else {
    await browserAPI.runtime.sendMessage({
      type: 'START',
      payload: {
        clickInterval: parseFloat(els.clickInterval.value) * 1000,
        clickRadius: parseInt(els.clickRadius.value),
        maxSteps: parseInt(els.maxSteps.value),
        isYoloMode: false
      }
    });
  }
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
    
    await browserAPI.runtime.sendMessage({
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
