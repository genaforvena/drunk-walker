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
│   │   ├── engine.js        # Navigation logic, state machine, unstuck, self-avoiding walk
│   │   └── engine.test.js   # Engine tests
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
├── bookmarklet.js           # Built bundle (latest v3.67.0)
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
| **Engine** (`src/core/engine.js`) | Core navigation loop, state management, unstuck algorithm, self-avoiding walk, path recording |
| **Handlers** (`src/input/handlers.js`) | Simulate keyboard (ArrowUp/ArrowLeft/ArrowRight) and mouse events |
| **UI Controller** (`src/ui/controller.js`) | Control panel DOM manipulation, user interactions, version display |
| **Main** (`src/main.js`) | Initialize engine, connect modules, expose global API, manage startup sequence |
| **Merge Paths** (`merge-paths.js`) | Combine multiple session exports, deduplicate by URL |

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
  unstuckState: 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING',
  visitedUrls: Set<string>  // New in v3.67.0
}
```

### Navigation Loop

1. Check if user is interacting (pause if true)
2. Update stuck detection (compare URLs)
3. If stuck ≥ 3 steps: execute unstuck sequence (turn left 60°)
4. If self-avoiding enabled and at visited node: turn ~30° to explore
5. Otherwise: press ArrowUp
6. Record step (if path recording enabled)
7. Add URL to visitedUrls Set (if self-avoiding enabled)
8. Increment step counter

### Unstuck Algorithm

```javascript
// Triggered when stuckCount >= 3
TURNING:   Hold ArrowLeft for 600ms (~60° turn left)
MOVING:    Press ArrowUp
VERIFYING: Check if URL changed
           ├─ Success: stuckCount = 0, resume walking
           └─ Failure: stuckCount++, retry next cycle
```

**Design Principle:** Always turn left. Consistent behavior over optimal behavior.

### Self-Avoiding Walk (v3.67.0+)

```javascript
// Weak bias toward unvisited nodes
executeSelfAvoidingStep() {
  if (visitedUrls.has(currentUrl)) {
    // At visited node: quick turn to explore
    turnLeftOrRight(30°);
  }
  // Continue forward
}
```

**Effect:** ~3-5x better coverage efficiency than pure random walk.

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
| `src/core/engine.test.js` | Engine initialization, state, navigation, unstuck, self-avoiding | ✅ 22 tests |
| `src/input/handlers.test.js` | Keyboard/mouse event simulation | ✅ 18 tests |
| `src/bundle.test.js` | Bundle validation (size, structure, features) | ✅ 32 tests |
| `index.test.js` | Integration (index.html, clipboard, dual-version) | ✅ 11 tests |
| `src/integration.test.js` | Full integration | ⚠️ Needs update (embedded old code) |

**Total:** 83 tests (excluding integration.test.js)

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
engine.getVisitedCount()        // number (v3.67.0+)
engine.isNavigating()           // boolean

// Configuration
engine.setPace(ms)              // Set step interval
engine.setPathCollection(enabled)  // Enable/disable path recording
engine.setSelfAvoiding(enabled)    // Enable/disable self-avoiding walk (v3.67.0+)

// Actions
engine.start()
engine.stop()
engine.reset()

// Path recording
engine.getWalkPath()            // Array of {url, rotation}
engine.clearWalkPath()          // Clear recorded path
engine.setWalkPath(path)        // Import path from array
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
| v3.67.0-EXP | **Latest** | Self-avoiding walk, visited counter, path merge utility |
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
