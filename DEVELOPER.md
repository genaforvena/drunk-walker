# 🧑‍💻 Developer Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build bookmarklet
npm run build

# Run tests + build (CI check)
npm run ci
```

---

## Project Structure

```
drunk-walker/
├── src/
│   ├── core/
│   │   ├── engine.js        # Navigation logic, state machine, unstuck algorithm
│   │   └── engine.test.js   # Engine tests
│   ├── input/
│   │   ├── handlers.js      # Keyboard/mouse event simulation
│   │   └── handlers.test.js # Input handler tests
│   ├── ui/
│   │   └── controller.js    # Control panel UI
│   ├── main.js              # Entry point, combines all modules
│   ├── bundle.test.js       # Bundle validation tests
│   └── integration.test.js  # Integration tests
├── server/
│   ├── server.js            # Express backend (optional)
│   ├── package.json         # Server dependencies
│   └── walks.db             # SQLite database (created on first run)
├── bookmarklet.js           # Built bundle (regular)
├── bookmarklet-console.js   # Built bundle (console-friendly)
├── index.html               # One-click copy page
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
| **Engine** (`src/core/engine.js`) | Core navigation loop, state management, unstuck algorithm, path recording |
| **Handlers** (`src/input/handlers.js`) | Simulate keyboard (ArrowUp/ArrowLeft) and mouse events |
| **UI Controller** (`src/ui/controller.js`) | Control panel DOM manipulation, user interactions |
| **Main** (`src/main.js`) | Initialize engine, connect modules, expose global API |

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
│    steps)    │
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
  unstuckState: 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING'
}
```

### Navigation Loop

1. Check if user is interacting (pause if true)
2. Update stuck detection (compare URLs)
3. If stuck ≥ 3 steps: execute unstuck sequence
4. Otherwise: press ArrowUp
5. Record step (if path recording enabled)
6. Increment step counter

### Unstuck Algorithm

```javascript
// Triggered when stuckCount >= 3
TURNING:   Hold ArrowLeft for 600ms (~60° turn)
MOVING:    Press ArrowUp
VERIFYING: Check if URL changed
           ├─ Success: stuckCount = 0, resume walking
           └─ Failure: stuckCount++, retry next cycle
```

### Path Recording

```javascript
// Enabled via checkbox in UI
walkPath = [
  { url: "https://...", rotation: 60 },
  { url: "https://...", rotation: 60 }
]

// Exported as JSON via clipboard
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

| Test File | Coverage |
|-----------|----------|
| `src/core/engine.test.js` | Engine initialization, state management, navigation loop, unstuck |
| `src/input/handlers.test.js` | Keyboard/mouse event simulation |
| `src/bundle.test.js` | Bundle validation (size, structure, features) |
| `index.test.js` | Integration tests (index.html, clipboard) |

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npx vitest run src/core/engine.test.js
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
engine.getStatus()        // 'IDLE' | 'WALKING'
engine.getSteps()         // number
engine.getStuckCount()    // number
engine.isNavigating()     // boolean

// Configuration
engine.setPace(ms)        // Set step interval
engine.setPathCollection(enabled)  // Enable/disable path recording

// Actions
engine.start()
engine.stop()
engine.reset()

// Path recording
engine.getWalkPath()      // Array of {url, rotation}
engine.clearWalkPath()    // Clear recorded path
```

### UI Controller API

```javascript
const ui = createControlPanel(engine, options);

ui.init()                 // Create and show control panel
ui.destroy()              // Remove control panel
ui.getPathCollectionEnabled()  // Check if recording is enabled
```

### Global API

```javascript
// Exposed on window when running
window.DRUNK_WALKER = {
  engine,
  ui,
  stop()                  // Stop and cleanup
}
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

| Version | Changes |
|---------|---------|
| v3.4-EXP | Path recording with JSON export, fixed 60° turn |
| v3.3-EXP | Auto-unstuck algorithm |
| v3.2-EXP | Keyboard mode default, smart observation |
| v3.0 | Strict autonomy, forward-default targeting |

---

## Resources

- [README.md](README.md) - User documentation
- [Spec.md](Spec.md) - Technical specification
- [UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md) - Unstuck details
- [PROJECT_MEMORY.md](PROJECT_MEMORY.md) - Project history
