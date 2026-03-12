// Drunk Walker - Popup Script

const els = {
  origin: document.getElementById('origin'),
  destination: document.getElementById('destination'),
  clickInterval: document.getElementById('click-interval'),
  intervalVal: document.getElementById('interval-val'),
  clickRadius: document.getElementById('click-radius'),
  radiusVal: document.getElementById('radius-val'),
  maxSteps: document.getElementById('max-steps'),
  statusText: document.getElementById('status-text'),
  progressText: document.getElementById('progress-text'),
  posText: document.getElementById('pos-text'),
  distText: document.getElementById('dist-text'),
  fsWarning: document.getElementById('fs-warning'),
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnPause: document.getElementById('btn-pause'),
};

function getHaversineDistance(pos1, pos2) {
  if (!pos1 || !pos2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function parseCoords(str) {
  const parts = str.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
}

function updateUI(state) {
  els.statusText.textContent = state.status.charAt(0).toUpperCase() + state.status.slice(1);
  if (state.isPanicMode) {
    els.statusText.textContent += " (PANIC!)";
    els.statusText.style.color = "red";
  } else {
    els.statusText.style.color = "inherit";
  }

  els.progressText.textContent = `${state.stepsTaken} / ${state.maxSteps} steps`;
  
  if (state.currentPosition) {
    els.posText.textContent = `${state.currentPosition.lat.toFixed(4)}, ${state.currentPosition.lng.toFixed(4)}`;
    
    const dest = parseCoords(els.destination.value) || state.destination;
    if (dest) {
      const dist = getHaversineDistance(state.currentPosition, dest);
      els.distText.textContent = dist !== null ? `${dist.toFixed(3)} km` : '-- km';
    }
  }

  // Update button text for Pause/Resume
  els.btnPause.textContent = state.status === 'paused' ? '▶ RESUME' : '⏸ PAUSE';

  // Check full-screen reported from content script
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
  const origin = parseCoords(els.origin.value);
  const destination = parseCoords(els.destination.value);
  
  if (!origin || !destination) {
    alert("Please enter valid origin and destination coordinates.");
    return;
  }

  await browser.runtime.sendMessage({
    type: 'START',
    payload: {
      origin,
      destination,
      clickInterval: parseFloat(els.clickInterval.value) * 1000,
      clickRadius: parseInt(els.clickRadius.value),
      maxSteps: parseInt(els.maxSteps.value)
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
    // YOLO Preset: Fast interval (1s), wide radius (100px), max steps (10000)
    els.clickInterval.value = 1.0;
    els.clickRadius.value = 100;
    els.maxSteps.value = 10000;
    
    // Trigger update for UI labels
    els.intervalVal.textContent = els.clickInterval.value;
    els.radiusVal.textContent = els.clickRadius.value;
    
    // Auto-start if valid coordinates
    const origin = parseCoords(els.origin.value);
    const destination = parseCoords(els.destination.value);

    if (!origin || !destination) {
      alert("YOLO needs a destination! Enter valid coordinates.");
      return;
    }

    await browser.runtime.sendMessage({
      type: 'START',
      payload: {
        origin,
        destination,
        clickInterval: 1000,
        clickRadius: 100,
        maxSteps: 10000,
        isYoloMode: true // Flag for extra chaos
      }
    });
    refreshState();
  };
}
