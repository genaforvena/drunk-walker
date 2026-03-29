/**
 * Drunk Walker Extension Popup
 * Matches the style and functionality of the in-page control panel
 */

const MAPS_URLS = [
  'https://www.google.com/maps',
  'https://maps.google.com'
];

const statusContainer = document.getElementById('statusContainer');
const messageEl = document.getElementById('message');

let isConnected = false;
let isRunning = false;
let steps = 0;
let visited = 0;

// Check if user is currently on Google Maps
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showNotOnMaps();
      return null;
    }

    const isMaps = MAPS_URLS.some(url => tab.url.startsWith(url));
    
    if (!isMaps) {
      showNotOnMaps();
      return null;
    }

    return tab;
  } catch (error) {
    console.error('Error checking tab:', error);
    showNotOnMaps();
    return null;
  }
}

function showNotOnMaps() {
  statusContainer.innerHTML = `
    <div class="not-on-maps">
      🗺️ Open Google Maps Street View to use Drunk Walker
    </div>
    <button id="openMapsBtn" class="btn btn-primary">Open Google Maps</button>
  `;
  
  document.getElementById('openMapsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.google.com/maps' });
  });
}

function showControls() {
  statusContainer.innerHTML = `
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-label">Steps</div>
        <div class="stat-value" id="stepsValue">${steps}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Visited</div>
        <div class="stat-value" id="visitedValue">${visited}</div>
      </div>
    </div>
    
    <div class="status-row">
      <span class="status-label">Status</span>
      <span class="status-value ${isRunning ? 'running' : 'stopped'}" id="statusValue">
        ${isRunning ? '🟢 Running' : '⏸ Stopped'}
      </span>
    </div>
    
    <button id="toggleBtn" class="btn btn-primary ${isRunning ? 'running' : ''}">
      ${isRunning ? '⏹ STOP' : '▶ START'}
    </button>
    
    <div class="btn-group">
      <button id="savePathBtn" class="btn btn-secondary">💾 Path</button>
      <button id="saveLogsBtn" class="btn btn-secondary">📄 Logs</button>
    </div>
    
    <div class="instructions">
      <strong>HOW TO RUN:</strong>
      <ol>
        <li>Open Street View in your browser</li>
        <li>Click START to begin exploration</li>
        <li>Use the draggable panel on the page for pace control</li>
      </ol>
    </div>
  `;

  // Toggle button
  document.getElementById('toggleBtn').addEventListener('click', async () => {
    const tab = await checkCurrentTab();
    if (!tab) return;

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      updateUI(response.stats);
    } catch (error) {
      showMessage('Click START on the page panel', 'error');
    }
  });

  // Save path button
  document.getElementById('savePathBtn').addEventListener('click', async () => {
    const tab = await checkCurrentTab();
    if (!tab) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'exportPath' });
      showMessage('✓ Path exported!');
    } catch (error) {
      showMessage('No path recorded yet', 'error');
    }
  });

  // Save logs button
  document.getElementById('saveLogsBtn').addEventListener('click', async () => {
    const tab = await checkCurrentTab();
    if (!tab) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'exportLogs' });
      showMessage('✓ Logs exported!');
    } catch (error) {
      showMessage('No logs captured yet', 'error');
    }
  });
}

function updateUI(stats) {
  if (!stats) return;
  
  isRunning = stats.isRunning;
  steps = stats.steps;
  visited = stats.visited;
  
  const statusValue = document.getElementById('statusValue');
  const stepsValue = document.getElementById('stepsValue');
  const visitedValue = document.getElementById('visitedValue');
  const toggleBtn = document.getElementById('toggleBtn');

  if (statusValue) {
    statusValue.textContent = isRunning ? '🟢 Running' : '⏸ Stopped';
    statusValue.className = `status-value ${isRunning ? 'running' : 'stopped'}`;
  }
  
  if (stepsValue) stepsValue.textContent = steps;
  if (visitedValue) visitedValue.textContent = visited;
  
  if (toggleBtn) {
    toggleBtn.innerHTML = isRunning ? '⏹ STOP' : '▶ START';
    toggleBtn.className = `btn btn-primary ${isRunning ? 'running' : ''}`;
  }
}

function showMessage(text, type = 'success') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  setTimeout(() => {
    messageEl.className = 'message';
  }, 3000);
}

async function getStats() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return null;

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
    return response.stats;
  } catch (error) {
    return null;
  }
}

// Initialize popup
async function init() {
  const tab = await checkCurrentTab();
  
  if (tab) {
    try {
      const stats = await getStats();
      
      if (stats) {
        isRunning = stats.isRunning;
        steps = stats.steps;
        visited = stats.visited;
        isConnected = true;
        showControls();
      } else {
        // Content script not loaded yet, offer to help
        statusContainer.innerHTML = `
          <div class="instructions" style="margin-bottom: 10px;">
            <strong>GET STARTED:</strong>
            <p style="margin: 5px 0;">Make sure you're in Street View mode, then:</p>
          </div>
          <button id="refreshBtn" class="btn btn-primary">🔄 Refresh Status</button>
        `;

        document.getElementById('refreshBtn').addEventListener('click', async () => {
          const stats = await getStats();
          if (stats) {
            isRunning = stats.isRunning;
            steps = stats.steps;
            visited = stats.visited;
            isConnected = true;
            showControls();
          } else {
            showMessage('Still waiting for Street View...', 'error');
          }
        });
      }
    } catch (error) {
      showNotOnMaps();
    }
  }
}

// Initialize on popup open
init();

// Refresh stats every 2 seconds if popup stays open
setInterval(async () => {
  if (isConnected) {
    const stats = await getStats();
    if (stats) {
      updateUI(stats);
    }
  }
}, 2000);
