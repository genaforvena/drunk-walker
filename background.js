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
  isYoloMode: false,
  isExperimentalMode: false,
  isKeyboardMode: false,
  panicThreshold: 3,
  stuckCount: 0,
  isPanicMode: false,
  lastUrl: ""
};

// Listen for messages from popup or content scripts
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      sendResponse(state);
      break;
    
    case 'START':
      state = { ...state, ...message.payload, status: 'navigating', stepsTaken: 0, stuckCount: 0, isPanicMode: false, lastUrl: "" };
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
      const currentUrl = tabs[0].url;

      if (state.isExperimentalMode) {
        if (currentUrl === state.lastUrl) {
          state.stuckCount++;
        } else {
          state.stuckCount = 0;
          state.lastUrl = currentUrl;
        }

        if (state.stuckCount >= state.panicThreshold) {
          state.isPanicMode = true;
        } else {
          state.isPanicMode = false;
        }
      } else {
        state.stuckCount = 0;
        state.isPanicMode = false;
      }

      // Calculate radius with exponential chaos if in click mode and panic mode
      let currentRadius = state.clickRadius;
      if (state.isExperimentalMode && state.isPanicMode && !state.isKeyboardMode) {
        currentRadius = state.clickRadius * Math.pow(1.5, state.stuckCount - state.panicThreshold + 1);
      }

      browserAPI.tabs.sendMessage(state.tabId, { 
        type: 'PERFORM_ACTION', 
        payload: { 
          radius: currentRadius,
          isYoloMode: state.isYoloMode,
          isKeyboardMode: state.isKeyboardMode,
          isPanicMode: state.isPanicMode,
          stuckCount: state.stuckCount
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
