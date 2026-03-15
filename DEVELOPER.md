# 🧑‍💻 Developer Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run tests (excludes integration test which has embedded old code)
npm test -- --exclude="src/integration.test.js"

# Build bookmarklet
npm run build

# Run tests + build (CI check)
npm test -- --exclude="src/integration.test.js" && npm run build
```

---

## Project Structure

```
drunk-walker/
├── src/
│   ├── core/
│   │   ├── engine.js        # State management, tick timing, path recording
│   │   ├── navigation.js    # Navigation strategies (self-avoiding, unstuck)
│   │   ├── engine.test.js   # Engine tests
│   │   ├── navigation.test.js # Navigation strategy tests
│   │   └── turn-and-move.test.js # Turn/move integration tests
│   ├── input/
│   │   ├── handlers.js      # Keyboard/mouse event simulation
│   │   └── handlers.test.js # Input handler tests
│   ├── ui/
│   │   └── controller.js    # Control panel UI
│   ├── main.js              # Entry point, combines all modules
│   ├── bundle.test.js       # Bundle validation tests
│   └── integration.test.js  # Integration tests (needs update)
├── server/
│   ├── server.js            # Express backend (optional)
│   ├── package.json         # Server dependencies
│   └── walks.db             # SQLite database (created on first run)
├── merge-paths.js           # Path merge utility (CLI + browser)
├── bookmarklet.js           # Built bundle (latest v3.67.1)
├── bookmarklet-console.js   # Built bundle (console-friendly)
├── index.html               # Dual-version copy page
├── dashboard.html           # Walk dashboard (requires server)
├── build.js                 # Bundles src/ → bookmarklet.js
├── vitest.config.js         # Test configuration
└── package.json             # Project dependencies
```

---

## Architecture

### Module Overview

| Module | Responsibility |
|--------|----------------|
| **Engine** (`src/core/engine.js`) | State management, tick timing, path recording, configuration |
| **Navigation** (`src/core/navigation.js`) | Movement algorithms: self-avoiding walk, unstuck recovery |
| **Handlers** (`src/input/handlers.js`) | Simulate keyboard (ArrowUp/ArrowLeft) and mouse events |
| **UI Controller** (`src/ui/controller.js`) | Control panel DOM manipulation, user interactions |
| **Main** (`src/main.js`) | Initialize engine, connect modules, expose global API |
| **Merge Paths** (`merge-paths.js`) | Combine multiple session exports, deduplicate by URL |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        MAIN ENTRY                           │
│  (initialization, module wiring, global API)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CORE ENGINE                            │
│  - State management (IDLE/WALKING)                          │
│  - Tick loop (setInterval)                                  │
│  - Path recording                                           │
│  - Stuck detection                                          │
│  - Configuration                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NAVIGATION MODULE                         │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Self-Avoiding       │  │ Unstuck             │          │
│  │ - Turn at visited   │  │ - Recovery when     │          │
│  │ - 20°-50° left      │  │   stuck (≥3 ticks)  │          │
│  │ - Immediate step    │  │ - 30°-90° left      │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INPUT HANDLERS                           │
│  - Keyboard events (ArrowUp, ArrowLeft)                     │
│  - Mouse events (click mode)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   UI CONTROLLER                             │
│  - Control panel DOM                                        │
│  - Status display                                           │
│  - User interactions                                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Engine     │────▶│   Handlers   │────▶│  Street View │
│  (state,     │     │  (simulate   │     │   (Google    │
│   tick loop) │     │   events)    │     │    Maps)     │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│  UI Control  │
│   (status,   │
│  steps,      │
│  visited)    │
└──────────────┘
```

---

## Core Engine

### State Machine

```javascript
{
  status: 'IDLE' | 'WALKING',
  steps: number,
  stuckCount: number,
  visitedUrls: Set<string>  // For self-avoiding walk
}
```

### Navigation Loop

1. Check if user is interacting (pause if true)
2. Update stuck detection (compare URLs)
3. **Call navigation.tick()** - delegates to navigation module
4. Navigation module decides: turn (self-avoiding/unstuck) or move forward
5. Record step (if path recording enabled)
6. Add URL to visitedUrls Set (if self-avoiding enabled)
7. Increment step counter

### Navigation Module (src/core/navigation.js)

The navigation module contains all movement algorithms as pluggable strategies:

**Strategies:**
- `createSelfAvoidingNavigation()` - Prefers unvisited nodes
- `createUnstuckNavigation()` - Recovery from stuck state
- `createNavigationController()` - Combines both strategies

**Navigation Decision Flow:**
```javascript
tick(context) {
  // Priority: Unstuck > Self-Avoiding > Normal movement
  if (stuckCount >= panicThreshold) {
    return unstuck.executeUnstuck();  // Turn 30°-90° left
  }
  if (atVisitedNode && selfAvoiding) {
    return selfAvoiding.executeStep();  // Turn 20°-50° left
  }
  return { action: 'move' };  // Normal forward movement
}
```

**To Change Navigation Behavior:**
Edit `src/core/navigation.js` - engine.js delegates all movement decisions there.

### Unstuck Algorithm

```javascript
// Navigation module: createUnstuckNavigation()
// Triggered when stuckCount >= 3
TURNING:   Hold ArrowLeft for random duration (300-900ms = 30°-90°)
MOVING:    Press ArrowUp immediately after turn
VERIFYING: Check if URL changed after pace interval
           ├─ Success: stuckCount = 0, resume walking
           └─ Failure: stuckCount++, retry next cycle
```

**Design Principle:** Always turn left. Consistent behavior over optimal behavior.

### Self-Avoiding Walk (v3.67.0+)

```javascript
// Navigation module: createSelfAvoidingNavigation()
executeSelfAvoidingStep() {
  if (visitedUrls.has(currentLocation)) {
    // At visited node: turn left 20°-50°
    turnLeft(random 200-500ms);
    press ArrowUp();  // Immediate step
  }
}
```

**Effect:** ~3-5x better coverage efficiency than pure random walk.

**Key Features:**
- Turns left 20°-50° at visited locations
- Immediately steps forward after turning
- Verifies URL changed before allowing next action
- Prevents continuous rotation (state machine ensures completion)

### Path Recording

```javascript
// Enabled via checkbox in UI (on by default in v3.67.0)
walkPath = [
  { url: "https://...", rotation: 60 },
  { url: "https://...", rotation: 60 }
]

// Exported as JSON via clipboard
// Merge multiple sessions: node merge-paths.js path1.json path2.json > merged.json
```

---

## Building

### Build Process

`build.js` concatenates and bundles all modules:

1. Read source files from `src/`
2. Remove ES6 imports/exports
3. Wrap in IIFE (Immediately Invoked Function Expression)
4. Output to `bookmarklet.js` and `bookmarklet-console.js`

### Build Command

```bash
npm run build
```

### Output Files

| File | Purpose |
|------|---------|
| `bookmarklet.js` | Standard build |
| `bookmarklet-console.js` | Console-friendly (uses `void` instead of IIFE) |

---

## Testing

### Test Structure

| Test File | Coverage | Status |
|-----------|----------|--------|
| `src/core/engine.test.js` | Engine initialization, state, navigation | ✅ 22 tests |
| `src/core/turn-and-move.test.js` | Turn/move integration, angle tracking | ✅ 8 tests |
| `src/core/path-recording.test.js` | Path recording, restore walks | ✅ 12 tests |
| `src/input/handlers.test.js` | Keyboard/mouse event simulation | ✅ 18 tests |
| `src/bundle.test.js` | Bundle validation (size, structure, features) | ✅ 32 tests |
| `src/validate-bundle.test.js` | Bundle feature verification | ✅ 10 tests |
| `index.test.js` | Integration (index.html, clipboard, dual-version) | ✅ 11 tests |
| `src/integration.test.js` | Full integration | ⚠️ Needs update (embedded old code) |

**Total:** 113 tests (excluding integration.test.js)

### Run Tests

```bash
# Run all tests (excluding integration test)
npm test -- --exclude="src/integration.test.js"

# Run with watch mode
npm test -- --watch

# Run specific test file
npx vitest run src/core/engine.test.js

# Run tests with coverage (if configured)
npm test -- --coverage
```

### Test Framework

- **Vitest** - Fast Vite-based test runner
- **jsdom** - Browser environment simulation
- **83 total tests** - All must pass before merge

---

## CI/CD

### GitHub Actions Workflow

File: `.github/workflows/ci.yml`

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    - Install dependencies
    - Run tests (npm test)
    - Build bookmarklet (npm run build)
    - Verify build output
```

### Build Status Badge

Add to README:

```markdown
![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)
```

---

## API Reference

### Engine API

```javascript
const engine = createEngine(config);

// State
engine.getStatus()              // 'IDLE' | 'WALKING'
engine.getSteps()               // number
engine.getStuckCount()          // number
engine.getVisitedCount()        // number (unique locations)
engine.isNavigating()           // boolean

// Configuration
engine.setPace(ms)              // Set step interval
engine.setPathCollection(enabled)  // Enable/disable path recording
engine.setSelfAvoiding(enabled)    // Enable/disable self-avoiding walk

// Actions
engine.start()
engine.stop()
engine.reset()

// Path recording
engine.getWalkPath()            // Array of {url, location, rotation}
engine.clearWalkPath()          // Clear recorded path
engine.setWalkPath(path)        // Import path from array
engine.restoreVisitedFromPath(path)  // Restore visited set from path

// Navigation (debugging)
engine.getNavigation()          // Get navigation controller instance
engine.getNavigationState()     // Get navigation state for debugging
```

### Navigation API

```javascript
// Navigation strategies (src/core/navigation.js)
const navigation = createNavigationController(cfg, callbacks);

// Main tick - returns navigation decision
const result = navigation.tick({
  currentUrl,
  visitedUrls,
  stuckCount,
  isKeyboardMode
});
// Result: { action: 'turn'|'move'|'none', busy: boolean, strategy: string }

// State
navigation.getCumulativeTurnAngle()  // Total degrees turned
navigation.resetCumulativeTurnAngle()
navigation.reset()                   // Reset all state
navigation.getState()                // Debug info
```

### UI Controller API

```javascript
const ui = createControlPanel(engine, options);

ui.init()                       // Create and show control panel
ui.destroy()                    // Remove control panel
ui.getPathCollectionEnabled()   // Check if recording is enabled
ui.onStatusUpdate               // Callback for status changes
```

### Global API

```javascript
// Exposed on window when running
window.DRUNK_WALKER = {
  engine,
  ui,
  stop()                        // Stop and cleanup
}

// Access in console
DRUNK_WALKER.engine.getConfig()
DRUNK_WALKER.engine.getVisitedCount()
DRUNK_WALKER.engine.getWalkPath()
```

### Merge Paths API

```javascript
// Node.js CLI
node merge-paths.js path1.json path2.json > merged.json

// Browser console
const merged = mergePaths([path1, path2, path3]);
console.log(JSON.stringify(merged, null, 2));

// Programmatic
const { mergePaths, deduplicatePaths } = require('./merge-paths.js');
```

---

## Debugging

### Console Access

```javascript
// Access engine directly
DRUNK_WALKER.engine.getConfig()
DRUNK_WALKER.engine.getWalkPath()

// Manual control
DRUNK_WALKER.engine.start()
DRUNK_WALKER.engine.stop()
DRUNK_WALKER.engine.tick()  // Single step
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "paceValEl is null" | Check DOM element creation order |
| Steps not incrementing | Verify `recordStep()` is called after movement |
| Unstuck not triggering | Ensure `expOn: true` in config |
| Path not recording | Check checkbox state and `setPathCollection()` |

---

## Contributing

### Before Pushing

1. Run tests: `npm test` (all 83 must pass)
2. Build: `npm run build`
3. Verify build output exists
4. Update version in `src/core/engine.js` if needed

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Run tests and build
4. Commit with descriptive message
5. Push and create PR: `gh pr create`
6. Wait for CI checks to pass
7. Merge when approved

---

## Deployment

### GitHub Pages

- **Source**: `index.html`, `bookmarklet.js` (built)
- **URL**: https://genaforvena.github.io/drunk-walker/
- **Deploy**: Automatic on push to main

### Backend Server (Optional)

```bash
cd server
npm install
npm start
```

Server provides:
- `/api/submit-walk` - POST walk data
- `/api/stats` - Get statistics
- `/dashboard` - View collected walks

---

## Version History

| Version | Name | Changes |
|---------|------|---------|
| v3.67.1-EXP | **Latest** | Navigation module refactoring, URL verification fix |
| v3.67.0-EXP | **Navigation** | Self-avoiding walk, visited counter, path merge utility |
| v3.66.6-EXP | **Vanilla** | Path recording with JSON export, fixed 60° turn (tagged stable reference) |
| v3.4-EXP | | Path recording with JSON export, fixed 60° turn |
| v3.3-EXP | | Auto-unstuck algorithm |
| v3.2-EXP | | Keyboard mode default, smart observation |
| v3.0 | | Strict autonomy, forward-default targeting |

See **[VERSIONS.md](VERSIONS.md)** for detailed version comparison.

---

## Resources

- **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)** — What it measures and how it works
- **[VERSIONS.md](VERSIONS.md)** — Version comparison and history
- **[README.md](README.md)** — User documentation
- **[Spec.md](Spec.md)** — Technical specification
- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** — Unstuck details
- **[PROJECT_MEMORY.md](PROJECT_MEMORY.md)** — Project history
