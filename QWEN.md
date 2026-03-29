# Drunk Walker - Project Context

## Project Overview

**Drunk Walker** is a browser-based experiment in **Blind Graph Traversal** using Google Street View. It's a bot that navigates panoramas by pressing keyboard inputs (ArrowUp/ArrowLeft/ArrowRight) according to the **PLEDGE algorithm** (Parametric Labyrinth Exploration with Drift-Guided Escape).

**Core insight:** The bot is "blind" — it doesn't have a map. It learns the labyrinth by walking it, producing the map through physical traversal.

**Key guarantee:** Each node is visited **at most twice** (forward pass + wall-follow backtrack).

### Technologies
- **Vanilla JavaScript (ES6+)** - No external dependencies
- **Browser Console Bookmarklet** - Runs directly in Google Maps Street View
- **Vitest + jsdom** - Testing framework
- **GitHub Pages** - Deployment via `index.html`

### Architecture

```
src/
├── core/
│   ├── engine.js       # Orchestrator (state, timing, transition graph)
│   ├── wheel.js        # Orientation handling (yaw management)
│   ├── traversal.js    # PLEDGE wall-following algorithm
│   └── navigation.js   # Compatibility layer
├── input/
│   └── handlers.js     # Keyboard/mouse event simulation
├── ui/
│   ├── controller.js   # Draggable control panel
│   └── exploration-map.js  # Visual exploration display
└── main.js             # Entry point
```

---

## Building and Running

### Prerequisites
```bash
npm install
```

### Build (Generates `bookmarklet.js`)
```bash
npm run build
# or
node build.js
```

⚠️ **bookmarklet.js is AUTO-GENERATED** - Never edit directly. Always run build after source changes.

### Run Tests
```bash
# Run all tests (excludes integration tests)
npm test

# Watch mode
npm run test:watch

# Run specific test file
npm test -- src/core/engine.test.js
```

### Manual Testing in Browser
1. Open [Google Maps Street View](https://www.google.com/maps)
2. Enter Street View mode
3. Press **F12** to open Console
4. Copy contents of `bookmarklet.js`
5. Paste into console and press Enter
6. Use the draggable control panel to START/STOP exploration

---

## Development Workflow

### Release Checklist (BEFORE PUSHING)
1. Make code changes in `src/`
2. **Run tests:** `npm test` — ALL 150+ tests must pass
3. **Build:** `node build.js` — generates `bookmarklet.js`
4. **Verify build:** Check `bookmarklet.js` was updated (file size ~87KB)
5. Commit: `git add . && git commit -m "..."`
6. Push: `git push`

**Never push without running tests and build** — `bookmarklet.js` is what users actually run.

### Code Style
- **Vanilla JavaScript (ES6+)** — No frameworks, no dependencies
- **Browser-first** — Works in browser console
- **Minimal comments** — Self-documenting code preferred
- **Module pattern** — ES modules in `src/`, stripped during build

---

## Key Concepts

### PLEDGE Algorithm States

| State | Trigger | Action |
|-------|---------|--------|
| **FORWARD** | New node, untried yaws | Face forward bearing, move straight |
| **DEAD_END** | All 6 yaws tried | Turn LEFT 105°, start wall-follow |
| **WALL-FOLLOW** | Backtracking | Scan for left exits (90-180° from forward) |
| **BREAK_WALL** | Truly stuck | Retry random successful yaw |

### Six Yaw Buckets
Street View divides 360° into 6 discrete buckets: 0°, 60°, 120°, 180°, 240°, 300°

### Transition Graph
The engine learns connectivity by recording:
- Every successful movement (A → B at yaw X)
- Every failed attempt (A at yaw Y = blocked)
- Bidirectional connections

### Performance Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **Progress Ratio** | `unique / totalSteps` | > 0.55 |
| **Steps/Location** | `totalSteps / unique` | < 2.0 |
| **Turns per 100** | `turns / steps * 100` | < 25 |
| **Micro-adjustments/100** | small turns / steps * 100 | < 5 |

---

## Testing

### Test Files

| File | Purpose |
|------|---------|
| `engine.test.js` | Core engine state, stuck detection, turn cooldown |
| `real-walk-log-replay.test.js` | Real walk replay from `walks/*.txt` logs |
| `linear-escape.test.js` | Dead-end escape scenarios |
| `long-walk-simulation.test.js` | 10k/50k step progress verification |
| `transition-graph.test.js` | Graph learning verification |
| `input/handlers.test.js` | Key/mouse event simulation |
| `bundle.test.js` | Bookmarklet bundle validation |

### Verifying Optimization Changes

```bash
# Run real walk replay tests
npm test -- src/core/real-walk-log-replay.test.js

# Compare before/after metrics
npm test -- src/core/real-walk-log-replay.test.js 2>&1 | tee before.txt
# ... make changes ...
npm test -- src/core/real-walk-log-replay.test.js 2>&1 | tee after.txt
```

Look for improvements in:
- **Visited/Steps ratio** (higher = better)
- **Turns/100** (lower = better)
- **Micro-adjustments/100** (lower = better)

---

## Documentation

| File | Description |
|------|-------------|
| `docs/HOW_IT_WALKS.md` | **Start here!** PLEDGE algorithm walkthrough |
| `docs/ALGORITHM.md` | Full API reference |
| `docs/WALK_REPORTS.md` | Walk analysis and fix documentation |
| `docs/WALK_DRIVEN_DEVELOPMENT.md` | Walk-driven development workflow |
| `docs/THE_TRAVERSAL_PROBLEM.md` | Theory of blind graph traversal |
| `docs/ANTI-OEDIPUS.md` | Philosophical framing (fun read) |
| `src/README.md` | Developer guide |

---

## Common Pitfalls

### ❌ Wall-Follow Presses ArrowUp Forever
**Fix:** Wall-follow must fall through to BREAK_WALL when stuck. BREAK_WALL has fallback chain:
1. Retry successful yaw
2. Calculate reverse yaw from graph
3. Try random yaw

### ❌ Clearing successfulYaws Traps the Bot
**Fix:** Don't throw away escape routes. The graph remembers all connections.

### ❌ Infinite Loop at Same Node (500+ Visits)
**Fix:** Ensure wall-follow → BREAK_WALL → graph reverse yaw. Always has an escape.

### ❌ Wrong Wall-Follow Bearing Reference
**Fix:** Calculate reverse yaw from graph connections when `successfulYaws` is empty.

---

## Global API (Browser)

When running in browser:
```javascript
window.DRUNK_WALKER.engine.start()      // Start exploration
window.DRUNK_WALKER.engine.stop()       // Stop
window.DRUNK_WALKER.engine.getWalkPath() // Export JSON path
window.DRUNK_WALKER.engine.getConfig()   // Read current config
```

---

## Version History

| Version | Key Changes |
|---------|-------------|
| **v6.1.4** | Graph-based backtracking fix |
| **v6.1.3** | Camera alignment fix, wall-follow loop detection |
| **v6.1.2** | 40° camera alignment, perpendicular yaw scan, yaw hysteresis |
| **v6.1.0** | PLEDGE wall-following implementation |
| **v5.1.0** | Smart nodes, enhanced transition graph |

---

## Repository Info

- **GitHub:** https://github.com/genaforvena/drunk-walker
- **Live Demo:** https://genaforvena.github.io/drunk-walker/
- **License:** CC0 (Public Domain)
