# Drunk Walker - Project Context

**Version:** 6.1.5  
**Type:** Browser-based Google Street View automation  
**License:** CC0 (Public Domain)

---

## Project Overview

Drunk Walker is a **blind graph traversal** experiment that automates exploration of Google Street View using the **PLEDGE algorithm** (Parametric Labyrinth Exploration with Drift-Guided Escape).

**Core Concept:** The bot is "blind" — it doesn't have a map. It learns the labyrinth by walking it, producing the map through physical probing.

**Key Guarantee:** Each node is visited **at most twice** (forward pass + wall-follow backtrack) via the left-hand rule maze traversal.

### Technologies

- **Vanilla JavaScript (ES6+)** - No external dependencies
- **Browser Extension** - Chrome/Edge/Brave and Firefox
- **Bookmarklet** - Runs directly in browser console
- **Vitest + jsdom** - Testing framework (162+ tests)
- **GitHub Pages** - Deployment via `index.html`

---

## Building and Running

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Build (generates bookmarklet.js + extension folders)
npm run build

# One-click release (creates new version)
npm run release X.Y.Z
```

### Build Output

| File | Purpose |
|------|---------|
| `bookmarklet.js` | Browser console version (~85 KB) |
| `extension-chrome/` | Chrome/Edge/Brave extension (uses `service_worker`) |
| `extension-firefox/` | Firefox extension (uses `scripts` array) |
| `dist/*.zip` | Distribution ZIP files for releases |

### ⚠️ Release Checklist (MUST DO BEFORE PUSHING)

**Always follow this order:**

1. **Make code changes**
2. **Run tests:** `npm test` - ALL 162+ tests must pass
3. **Build:** `npm run build` - generates `bookmarklet.js` + extensions
4. **Verify build:** Check `bookmarklet.js` was updated (file size ~85 KB)
5. **Commit:** `git add . && git commit -m "..."`
6. **Push:** `git push`

**Never push without:**
- ✅ Running `npm test`
- ✅ Running `npm run build`
- ✅ Verifying `bookmarklet.js` is updated

---

## Walk-Driven Development

**All algorithm changes MUST be based on actual walk data.**

### Workflow

```bash
# 1. Identify issue in walk log
grep "nodeVisitCount=[3-9]" walks/dw-logs-*.txt | head -20

# 2. Create walk report (docs/WALK_REPORTS.md)
# Document: pattern, sequence, root cause, proposed fix

# 3. Verify oracle works
npm test -- src/core/territory-oracle.test.js

# 4. Record baseline
npm test -- src/core/territory-oracle.test.js 2>&1 | tee before.txt

# 5. Implement fix in src/core/traversal.js

# 6. Verify improvement
npm test -- src/core/territory-oracle.test.js 2>&1 | tee after.txt
diff before.txt after.txt

# 7. Verify no regressions
npm test

# 8. Update docs/WALK_REPORTS.md with results
```

### Territory Oracle

A mock Street View that knows actual connectivity from walk logs:

```javascript
import { TerritoryOracle } from './territory-oracle.js';

const oracle = TerritoryOracle.fromWalkLog('walks/dw-logs-*.txt');
const result = oracle.tryMove(location, yawBucket);
// Returns: { success: true, targetLocation: "..." }
//       or: { success: false, reason: "blocked" }
```

**Properties:**
- **Deterministic:** Same algorithm → same results
- **Verifiable:** Oracle metrics match real walk metrics
- **Baseline-Protected:** No change should make baselines worse
- **Fast:** Pure JavaScript, no browser needed

---

## Architecture

### Project Structure

```
drunk-walker/
├── src/
│   ├── core/
│   │   ├── engine.js              # Orchestrator (state, timing)
│   │   ├── wheel.js               # Orientation handling
│   │   ├── traversal.js           # PLEDGE wall-following logic
│   │   ├── territory-oracle.js    # Mock Street View for testing
│   │   └── *.test.js              # Unit tests
│   ├── input/
│   │   └── handlers.js            # Key/mouse event simulation
│   ├── ui/
│   │   └── controller.js          # Control panel
│   └── main.js                    # Entry point
├── docs/                          # Algorithm documentation
├── walks/                         # Walk log files (*.txt)
├── extension-chrome/              # Chrome extension (built)
├── extension-firefox/             # Firefox extension (built)
├── build.js                       # Bundles src/ → bookmarklet.js
├── index.html                     # Installation site (GitHub Pages)
└── package.json                   # Dependencies
```

### PLEDGE Algorithm States

| State | Trigger | Action |
|-------|---------|--------|
| **FORWARD** | New node, untried yaws | Face forward bearing, move straight |
| **DEAD_END** | All 6 yaws tried | Turn LEFT 105°, start wall-follow |
| **WALL-FOLLOW** | Backtracking | Scan for left exits (90-180° from forward) |
| **BREAK_WALL** | Truly stuck or loop detected | Retry random successful yaw |

### Key Mechanics

| Concept | Description |
|---------|-------------|
| **6 Yaw Buckets** | Street View divides 360° into: 0°, 60°, 120°, 180°, 240°, 300° |
| **Forward Bearing** | Always face direction of travel (prev→cur) |
| **Cul-de-Sac Check** | After 10+ straight nodes, verify not a false dead-end |
| **Graph Memory** | Records every successful movement for escape routes |
| **Loop Detection** | Tracks nodes visited during wall-follow to escape cycles |

---

## Testing

### Test Files

| File | Purpose |
|------|---------|
| `engine.test.js` | Core engine state, stuck detection, turn cooldown |
| `territory-oracle.test.js` | Oracle parsing, verification, metrics, baselines |
| `real-walk-log-replay.test.js` | Real walk replay from `walks/*.txt` logs |
| `linear-escape.test.js` | Dead-end escape scenarios |
| `long-walk-simulation.test.js` | 10k/50k step progress verification |
| `transition-graph.test.js` | Graph learning verification |
| `input/handlers.test.js` | Key/mouse event simulation |
| `bundle.test.js` | Bookmarklet bundle validation |

### Verifying Optimization Changes

```bash
# Run territory oracle tests
npm test -- src/core/territory-oracle.test.js

# Compare before/after metrics
npm test -- src/core/territory-oracle.test.js 2>&1 | tee before.txt
# ... make changes ...
npm test -- src/core/territory-oracle.test.js 2>&1 | tee after.txt
diff before.txt after.txt
```

**Look for improvements in:**
- **Visited/Steps ratio** (higher = better, target: >0.55)
- **Max visits** (lower = better, target: ≤2)
- **Turns per 100** (lower = better, target: <25)

---

## Global API (Browser)

When running in the browser:

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
| **v6.1.5** | One-click release script, dual browser manifests, gh.io extension folders |
| **v6.1.4** | Territory Oracle, walk-driven development, wall-follow loop detection |
| **v6.1.0** | PLEDGE wall-following (forward → turn LEFT 105° → wall-follow → break wall) |

**Historical versions** (superseded by PLEDGE):
- **v5.x:** Smart nodes, enhanced transition graph
- **v4.x:** Surgeon mode, Hunter mode, Explorer mode

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

## Documentation

| File | Purpose |
|------|---------|
| `docs/HOW_IT_WALKS.md` | **Start here!** PLEDGE algorithm walkthrough |
| `docs/ALGORITHM.md` | Full API reference |
| `docs/WALK_REPORTS.md` | Walk reports with fix documentation |
| `docs/WALK_DRIVEN_DEVELOPMENT.md` | Walk-driven development workflow |
| `docs/THE_TRAVERSAL_PROBLEM.md` | Theory of blind graph traversal |
| `docs/ANTI-OEDIPUS.md` | Philosophical framing (fun read) |
| `src/README.md` | Developer guide |
| `RELEASE.md` | One-click release process |

---

## Repository

- **GitHub:** https://github.com/genaforvena/drunk-walker
- **Live Demo:** https://genaforvena.github.io/drunk-walker/
- **License:** CC0 (Public Domain)

---

*The bot explores by following the left wall, facing forward, and breaking walls when stuck. Every node has at least one exit—where we came from.*
