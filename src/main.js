/**
 * Drunk Walker - Main Entry Point
 * Combines core engine, input handlers, and UI
 */

import { createEngine, VERSION } from './core/engine.js';
import { simulateKeyPress, simulateLongKeyPress, simulateClick, setupInteractionListeners, findStreetViewTarget } from './input/handlers.js';
import { createControlPanel } from './ui/controller.js';
import { createExplorationMap } from './ui/exploration-map.js';
import { createAutosaver } from './experiment/autosave.js';
import { createExperiment } from './experiment/index.js';

// Global initialization lock
let __INITIALIZING__ = false;

// Global interval tracking for cleanup
window.__DRUNK_WALKER_INTERVALS__ = window.__DRUNK_WALKER_INTERVALS__ || new Set();

// Cleanup function for ALL intervals
const cleanupAllIntervals = () => {
  if (window.__DRUNK_WALKER_INTERVALS__) {
    console.log(`🤪 Cleaning up ${window.__DRUNK_WALKER_INTERVALS__.size} existing interval(s)...`);
    window.__DRUNK_WALKER_INTERVALS__.forEach(id => clearInterval(id));
    window.__DRUNK_WALKER_INTERVALS__.clear();
  }
};

// Allow restart by clearing previous instance
if (window.DRUNK_WALKER) {
  console.log('🤪 Drunk Walker: Stopping previous instance...');
  try {
    window.DRUNK_WALKER.stop();
  } catch(e) {
    console.warn('Error stopping previous instance:', e);
  }
  // Remove the global immediately to prevent race conditions
  delete window.DRUNK_WALKER;
  window.DRUNK_WALKER_ACTIVE = false;
}

// Aggressive cleanup before new instance
cleanupAllIntervals();

// Remove any existing UI panel from previous runs
const existingPanel = document.getElementById('dw-modern-panel');
if (existingPanel) {
  console.log('🤪 Removing existing UI panel...');
  existingPanel.remove();
}

// Small delay to ensure cleanup is processed by browser
setTimeout(() => {
  window.DRUNK_WALKER_ACTIVE = true;
  console.log(`🤪 DRUNK WALKER v${VERSION} Loaded.`);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}, 100);

// Wait for DOM to be ready before initializing
const initialize = () => {
  // Prevent double initialization
  if (__INITIALIZING__) {
    console.log('🤪 [initialize] Already initializing, skipping...');
    return;
  }
  __INITIALIZING__ = true;
  
  // Double-check and remove any panel that might have appeared
  const existingPanel = document.getElementById('dw-modern-panel');
  if (existingPanel) {
    console.log('🤪 [initialize] Removing panel that appeared during init...');
    existingPanel.remove();
  }
  
  try {
    // Check for screensaver mode restoration from localStorage
    let savedState = null;
    try {
      const saved = localStorage.getItem('drunkWalkerScreensaver');
      if (saved) {
        savedState = JSON.parse(saved);
        console.log('🤪 Restoring screensaver session...');
      }
    } catch (e) {
      console.log('🤪 No saved session found');
    }

    // Create engine with default config (keyboard mode ON, unstuck enabled)
    const engine = createEngine({
      pace: savedState?.pace || 2000,
      kbOn: true,      // Keyboard mode is DEFAULT
      expOn: true      // Unstuck algorithm enabled by default
    });

    // Create auto-saver for experiment resilience
    let autosaver = null;
    try {
      autosaver = createAutosaver(engine, engine.getNavigation()?.algorithm || null, {
        intervalMs: 60000,  // Save every 60 seconds
        includeGraph: true,
        includePath: true
      });
      console.log('💾 Auto-save module initialized');
    } catch (e) {
      console.warn('💾 Auto-save initialization skipped (algorithm not yet available)');
    }

    // Create experiment framework with default configuration
    let experiment = null;
    try {
      experiment = createExperiment(engine, algorithm);
      console.log('🧪 Experiment framework initialized');
    } catch (e) {
      console.warn('🧪 Experiment framework initialization skipped:', e.message);
    }

    // Restore state if coming from screensaver
    if (savedState) {
      // Restore walk path
      if (savedState.walkPath && Array.isArray(savedState.walkPath)) {
        engine.setWalkPath(savedState.walkPath);
        console.log('🤪 Restored', savedState.walkPath.length, 'path points');
      }

      // Restore steps count
      if (savedState.steps) {
        engine.setSteps(savedState.steps);
        console.log('🤪 Restored', savedState.steps, 'steps');
      }
    }

    // Set up interaction listeners (pause on user drag)
    const { cleanup: cleanupListeners } = setupInteractionListeners({
      onUserMouseDown: (down) => engine.setUserMouseDown(down),
      onUserMouseUp: (down) => engine.setUserMouseDown(down)
    });

    // Listen for screensaver initialization messages
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'DRUNK_WALKER_INIT') {
        console.log('🤪 Screensaver window initialized');
      }
    });

    // Path collection submit handler
    const submitWalkPath = async (walkPath) => {
      try {
        const payload = {
          timestamp: new Date().toISOString(),
          steps: walkPath.length,
          walkPath: walkPath
        };

        // Send to backend (fail silently if unavailable)
        await fetch('/api/submit-walk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {
          console.log('🤪 Walk path submission failed (server unavailable)');
        });
      } catch (error) {
        console.log('🤪 Walk path submission error:', error.message);
      }
    };

    // Create exploration map
    const map = createExplorationMap();
    map.init();
    
    // Create UI - this will autoStart after action handlers are set
    const ui = createControlPanel(engine, {
      version: VERSION,
      autoStart: false,  // We'll start manually after handlers are set
      onPathCollectionToggle: (enabled) => {
        engine.setPathCollection(enabled);
      }
    });

    // Set up ALL action handlers BEFORE starting
    engine.setActionHandlers({
      keyPress: (key) => {
        const target = findStreetViewTarget();
        simulateKeyPress(key, target);
      },
      mouseClick: (x, y) => {
        simulateClick(x, y, true);
      },
      longKeyPress: (key, duration, callback) => {
        const target = findStreetViewTarget();
        simulateLongKeyPress(key, duration, callback, target);
      },
      statusUpdate: (status, steps, stuckCount) => {
        ui.onStatusUpdate(status, steps, stuckCount);
        // Update map periodically (every 10 ticks)
        if (steps % 10 === 0 && map.isVisible()) {
          const transitionGraph = engine.getTransitionGraph();
          const currentLocation = engine.getWalkPath().length > 0 
            ? engine.getWalkPath()[engine.getWalkPath().length - 1].location 
            : null;
          map.render(transitionGraph, currentLocation, engine.getVisitedUrls());
        }
      },
      walkStop: submitWalkPath
    });

    // Initialize UI
    ui.init();

    // Now start walking (after everything is set up)
    engine.start();

    // Start auto-saver after engine is running
    if (autosaver) {
      autosaver.start();
      console.log('💾 Auto-save started: will backup every 60 seconds');
    }

    // Start experiment framework with default configuration
    if (experiment) {
      experiment.start({
        name: 'default-experiment',
        targetSteps: 10000,
        pace: engine.getConfig().pace || 2000,
        enableMonitoring: true
      });
      console.log('🧪 Experiment auto-started with default configuration');
      console.log('   Target: 10,000 steps');
      console.log('   Auto-save: every 60 seconds');
      console.log('   Export: every 500 steps');
      console.log('   Monitor: every 30 seconds');
      console.log('');
      console.log('Commands:');
      console.log('  DRUNK_WALKER.experiment.stop()    - Stop experiment');
      console.log('  DRUNK_WALKER.experiment.export()  - Export data now');
      console.log('  DRUNK_WALKER.experiment.stats()   - Show statistics');
    }

    // Resume screensaver session if needed (already started above)
    if (savedState?.isWalking) {
      console.log('🤪 Screensaver session restored');
    }

    // Expose for debugging/console access
    window.DRUNK_WALKER = {
      engine,
      ui,
      map,
      autosaver,  // Expose auto-saver for manual control
      experiment, // Expose experiment framework
      simulateKeyPress,
      simulateClick,
      stop: () => {
        if (experiment) experiment.stop();
        if (autosaver) autosaver.stop();
        ui.destroy();
        cleanupListeners();
        window.DRUNK_WALKER_ACTIVE = false;
        delete window.DRUNK_WALKER;
        console.log('🤪 Drunk Walker stopped');
      }
    };

    console.log('🎮 Type DRUNK_WALKER.stop() to stop manually');
  } catch (error) {
    console.error('🤪 DRUNK WALKER: Initialization failed:', error);
    window.DRUNK_WALKER_ACTIVE = false;
    __INITIALIZING__ = false;  // Reset lock on error
  }
};

// NOTE: Initialization is handled by the setTimeout above to ensure
// proper cleanup of any previous instance. The setTimeout gives the
// browser time to process the cleanup before creating a new instance.
