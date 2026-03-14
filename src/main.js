/**
 * Drunk Walker - Main Entry Point
 * Combines core engine, input handlers, and UI
 */

import { createEngine, VERSION } from './core/engine.js';
import { simulateKeyPress, simulateClick, setupInteractionListeners, findStreetViewTarget } from './input/handlers.js';
import { createControlPanel } from './ui/controller.js';

// Prevent multiple instances
if (window.DRUNK_WALKER_ACTIVE) {
  console.log('🤪 Drunk Walker already running');
  return;
}
window.DRUNK_WALKER_ACTIVE = true;

console.log(`🤪 DRUNK WALKER v${VERSION} Loaded.`);

// Create engine with default config (keyboard mode ON)
const engine = createEngine({
  pace: 2000,
  kbOn: true,      // Keyboard mode is DEFAULT
  expOn: false
});

// Set up action handlers
engine.setActionHandlers({
  keyPress: (key) => {
    const target = findStreetViewTarget();
    simulateKeyPress(key, target);
  },
  mouseClick: (x, y) => {
    simulateClick(x, y, true);
  },
  statusUpdate: (status, steps, stuck) => {
    // Handled by UI controller
  }
});

// Set up interaction listeners (pause on user drag)
const { cleanup: cleanupListeners } = setupInteractionListeners({
  onUserMouseDown: (down) => engine.setUserMouseDown(down),
  onUserMouseUp: (down) => engine.setUserMouseDown(down)
});

// Create and initialize UI
const ui = createControlPanel(engine, {
  version: VERSION,
  autoStart: true  // Auto-start on load
});

// Initialize everything
ui.init();

// Expose for debugging/console access
window.DRUNK_WALKER = {
  engine,
  ui,
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
