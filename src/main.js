/**
 * Drunk Walker - Main Entry Point
 * Combines core engine, input handlers, and UI
 */

import { createEngine, VERSION } from './core/engine.js';
import { simulateKeyPress, simulateLongKeyPress, simulateClick, setupInteractionListeners, findStreetViewTarget } from './input/handlers.js';
import { createControlPanel } from './ui/controller.js';
import { createExplorationMap } from './ui/exploration-map.js';

// Allow restart by clearing previous instance
if (window.DRUNK_WALKER_ACTIVE) {
  console.log('🤪 Drunk Walker: Restarting...');
  if (window.DRUNK_WALKER) {
    try { window.DRUNK_WALKER.stop(); } catch(e) {}
  }
}

window.DRUNK_WALKER_ACTIVE = true;

console.log(`🤪 DRUNK WALKER v${VERSION} Loaded.`);

// Wait for DOM to be ready before initializing
const initialize = () => {
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

    // Resume screensaver session if needed (already started above)
    if (savedState?.isWalking) {
      console.log('🤪 Screensaver session restored');
    }

    // Expose for debugging/console access
    window.DRUNK_WALKER = {
      engine,
      ui,
      map,
      simulateKeyPress,
      simulateClick,
      stop: () => {
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
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
