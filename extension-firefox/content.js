/**
 * Drunk Walker Extension - Content Script
 * Injects the Drunk Walker bundle into Google Maps Street View
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.DRUNK_WALKER_EXTENSION_INJECTED) {
    console.log('Drunk Walker already injected');
    return;
  }
  window.DRUNK_WALKER_EXTENSION_INJECTED = true;

  /**
   * Wait for DRUNK_WALKER global to be available
   */
  function waitForDrunkWalker() {
    return new Promise((resolve) => {
      if (window.DRUNK_WALKER && window.DRUNK_WALKER.engine) {
        resolve();
        return;
      }
      
      const checkInterval = setInterval(() => {
        if (window.DRUNK_WALKER && window.DRUNK_WALKER.engine) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(); // Resolve anyway to avoid hanging
      }, 5000);
    });
  }

  /**
   * Set up message listener for popup communication
   */
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'getStats':
          sendResponse({ 
            stats: getStats() 
          });
          break;
          
        case 'toggle':
          toggleDrunkWalker();
          sendResponse({ 
            stats: getStats() 
          });
          break;
          
        case 'exportPath':
          exportPath();
          sendResponse({ success: true });
          break;
          
        case 'exportLogs':
          exportLogs();
          sendResponse({ success: true });
          break;
          
        case 'inject':
          // Already injected, just confirm
          sendResponse({ success: true, alreadyInjected: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
      
      return true; // Keep message channel open
    });
  }

  /**
   * Get current stats from Drunk Walker
   */
  function getStats() {
    if (window.DRUNK_WALKER && window.DRUNK_WALKER.engine) {
      const engine = window.DRUNK_WALKER.engine;
      return {
        isRunning: engine.isNavigating?.() || false,
        steps: engine.getSteps?.() || 0,
        visited: engine.getVisitedCount?.() || 0
      };
    }
    return {
      isRunning: false,
      steps: 0,
      visited: 0
    };
  }

  /**
   * Toggle Drunk Walker on/off
   */
  function toggleDrunkWalker() {
    if (!window.DRUNK_WALKER || !window.DRUNK_WALKER.engine) {
      console.error('Drunk Walker not initialized');
      return;
    }
    
    const engine = window.DRUNK_WALKER.engine;
    
    if (engine.isNavigating?.()) {
      engine.stop();
    } else {
      engine.start();
    }
  }

  /**
   * Export walk path
   */
  function exportPath() {
    if (!window.DRUNK_WALKER || !window.DRUNK_WALKER.engine) return;
    
    const walkPath = window.DRUNK_WALKER.engine.getWalkPath?.();
    
    if (!walkPath || walkPath.length === 0) {
      console.log('No path recorded');
      return;
    }
    
    const blob = new Blob([JSON.stringify(walkPath, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dw-path-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export session logs
   */
  function exportLogs() {
    // Logs are handled by the Drunk Walker UI
    // This is a fallback if the UI isn't available
    console.log('Use the Drunk Walker UI panel to export logs');
  }

  /**
   * Initialize Drunk Walker
   * The bundle is loaded via manifest.json content_scripts
   */
  async function init() {
    try {
      // Wait for the bundle to be loaded (it's injected via manifest)
      await waitForDrunkWalker();
      
      console.log('✅ Drunk Walker initialized');
      
      // Set up message listener for popup communication
      setupMessageListener();
      
    } catch (error) {
      console.error('❌ Failed to initialize Drunk Walker:', error);
    }
  }

  // Initialize when content script loads
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
