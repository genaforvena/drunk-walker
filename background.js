// Drunk Walker - Background Script
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let state = {
  status: 'idle',
  stepsTaken: 0,
  maxSteps: 1000,
  clickInterval: 3000,
  clickRadius: 50,
  tabId: null,
  isFullScreen: false,
  isStreetView: false,
  isYoloMode: false
};

// Listen for messages from popup or content scripts
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      sendResponse(state);
      break;
    
    case 'START':
      state = { ...state, ...message.payload, status: 'navigating', stepsTaken: 0 };
      startNavigation();
      sendResponse({ status: 'started' });
      break;
    
    case 'STOP':
      state.status = 'idle';
      stopNavigation();
      sendResponse({ status: 'stopped' });
      break;

    case 'UPDATE_STATUS':
      state.isStreetView = message.payload.isStreetView;
      state.isFullScreen = message.payload.isFullScreen;
      break;

    case 'FINISHED':
      state.status = 'complete';
      stopNavigation();
      break;
  }
});

let navInterval = null;

function startNavigation() {
  if (navInterval) clearInterval(navInterval);
  
  navInterval = setInterval(async () => {
    if (state.status !== 'navigating') return;

    if (state.stepsTaken >= state.maxSteps) {
      state.status = 'complete';
      clearInterval(navInterval);
      return;
    }

    // Ping content script to perform click
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url.includes('google.com/maps')) {
      state.tabId = tabs[0].id;
      
      state.stuckCount++;
      
      // Stagnation detection: If stuck for 3 clicks, enter panic mode
      if (state.stuckCount >= 3) {
        state.isPanicMode = true;
      }
      
      // Reset after 10 stuck clicks
      if (state.stuckCount >= 10) {
        state.stuckCount = 0;
        state.isPanicMode = false;
      }

      browserAPI.tabs.sendMessage(state.tabId, { 
        type: 'PERFORM_CLICK', 
        payload: { 
          radius: state.clickRadius,
          isYoloMode: state.isYoloMode
        } 
      }).catch(err => console.error("Error sending message to tab:", err));
      
      state.stepsTaken++;
    }
  }, state.clickInterval);
}

function stopNavigation() {
  if (navInterval) {
    clearInterval(navInterval);
    navInterval = null;
  }
}
