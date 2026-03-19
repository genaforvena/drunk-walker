# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker (End of the World Finder)** is a sandbox experiment in Blind Graph Traversal. It automates Google Street View navigation via a decoupled architecture, allowing for specialized "Personas" (Explorer, Hunter, Surgeon) to search for the boundaries of the digital world.

---

## 🏗️ System Architecture (v4.2.0-EXP)

### 1. Component Roles
- **`src/core/engine.js`** — Orchestrator: state, timing, and main tick loop.
- **`src/core/wheel.js`** — Physicality: orientation management and "left-turn only" constraint.
- **`src/core/traversal.js`** — Pluggable logic: Explorer, Hunter, and Surgeon decision-making algorithms.
- **`src/input/handlers.js`** — Event simulation: keyboard and mouse input.
- **`src/ui/controller.js`** — Interface: Cyberpunk-styled control panel with mode cycling.

### 2. Test Structure
- **`src/core/engine.test.js`** — 22 tests for orchestrator logic.
- **`src/core/turn-and-move.test.js`** — Integration of physical turns and movement.
- **`src/core/self-avoiding.test.js`** — Algorithm-specific verification.
- **`src/bundle.test.js`** — Validating the built output.
- **Total: 118 tests** — All must pass before push.

---

## 🚀 Deployment & Sharing

### One-Click "No-Install" (GitHub Pages)
The primary shareable link is: **[https://genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)**
- **Method**: Direct copy of the bundled bookmarklet.
- **Execution**: Paste into **Browser Console (F12)** on any Street View page.

### GitHub Automation
- **CI/CD**: GitHub Actions runs tests and builds the bookmarklet on every push to `main`.
- **Pages**: Automatic deployment of the installation site.

---

## ⚡ Key Implementations & Logic

### 1. Traversal Personas
- **Explorer**: Uses a Weighted Heatmap and Breadcrumbs to expand into unvisited territory.
- **Hunter**: Seeks dead-ends (Cul-de-sacs) and uses 180° Snap-Back to retreat.
- **Surgeon**: Maximizes efficiency by vetoing movement toward already-visited nodes using projection math.

### 2. Sandbox Physics
- **The Tick**: Every step is a physical probe (press Up).
- **The Drift**: Browser easing and lag create stochastic noise in the orientation.
- **Entropy**: Neighborhoods eventually saturate, leading to equilibrium (randomness).

---

## 🛠️ Implementation Progress

- [x] Decoupled Architecture (v4.0) — Engine, Wheel, and Traversal split.
- [x] Traversal Personas (v4.1) — Explorer, Hunter, and Surgeon modes.
- [x] Advanced Memory (v4.2) — Heatmap (Map), Breadcrumbs (Rolling Buffer), and Projection Veto.
- [x] Comprehensive Test Suite — 118 tests covering all new logic.
- [x] One-Click Branding — Rebranded as "End of the World Finder."

---

## 📂 File Map
- `src/core/engine.js` — State & Timing
- `src/core/wheel.js` — Orientation
- `src/core/traversal.js` — Pluggable Algorithms
- `src/input/handlers.js` — Event Simulation
- `src/ui/controller.js` — UI & Mode Cycling
- `bookmarklet.js` — Auto-generated bundle
- `docs/ALGORITHM.md` — Technical math
- `docs/THE_TRAVERSAL_PROBLEM.md` — Theoretical deep dive

---

## 🧪 Testing Workflow

```bash
# Run all tests
npm test

# Build bookmarklet
node build.js
```

**All 118 tests must pass before push.**

---

## 🔐 Privacy Principles

1. **No tracking** — Zero analytics or telemetry.
2. **Local storage** — Path data stays in browser memory.
3. **User control** — Data is only shared via manual copy/download.

---

## 📝 Version History

| Version | Key Changes |
|---------|-------------|
| v4.2.0-EXP | Surgeon mode, Rebranding, Veto logic |
| v4.1.0-EXP | Hunter mode, 180° Snap-Back, Mode cycling |
| v4.0.0-EXP | Decoupled Architecture (Wheel/Traversal) |
| v3.70.0-EXP | Initial refactor attempt |
| v3.69.0-EXP | Self-avoiding walk, path merge |
