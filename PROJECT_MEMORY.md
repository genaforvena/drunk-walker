# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a standalone Bookmarklet that automates Google Street View navigation by pressing Arrow Up repeatedly. It includes automatic unstuck recovery and optional path recording.

---

## 🏗️ System Architecture (v3.4-EXP)

### 1. Component Roles
- **`src/core/engine.js`** — Navigation logic, unstuck state machine, path recording
- **`src/input/handlers.js`** — Keyboard/mouse event simulation (simulateKeyPress, simulateLongKeyPress)
- **`src/ui/controller.js`** — Control panel UI (START/STOP, pace slider, record path checkbox, copy JSON button)
- **`src/main.js`** — Entry point, combines all modules
- **`bookmarklet.js`** — Auto-generated bundle from `npm run build`
- **`index.html`** — One-click copy page (fetches bookmarklet from GitHub)

### 2. Test Structure
- **`src/core/engine.test.js`** — 22 tests for navigation logic and unstuck algorithm
- **`src/input/handlers.test.js`** — 18 tests for event simulation
- **`src/bundle.test.js`** — 29 tests validating bundled output
- **`index.test.js`** — 14 integration tests
- **Total: 83 tests** — All must pass before push

---

## 🚀 Deployment & Sharing

### One-Click "No-Install" (GitHub Pages)
The primary shareable link is: **[https://genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)**
- **Method**: Single button to **Copy JS to Clipboard**
- **Execution**: User pastes into **Browser Console (F12)** on Street View page
- **Benefits**: Works instantly on any modern browser without installation

### GitHub Automation
- **Prefer `gh` CLI**: User prefers GitHub CLI for repo automation
- **Bypass Jekyll**: `.nojekyll` file ensures simple HTML deployment
- **Mandatory Testing**: Run `npm test` before every push
- **CI/CD**: GitHub Actions runs tests and build on every push to main

---

## ⚡ Key Implementations & Logic

### 1. Navigation Algorithm (v3.4-EXP)
- **Movement**: Presses ArrowUp at configurable intervals (default 2000ms)
- **Unstuck**: Automatic when URL unchanged for 3 steps
  - Turn left 60° (hold ArrowLeft for 600ms)
  - Move forward (press ArrowUp)
  - Verify URL changed
- **Path Recording**: Opt-in checkbox, stores {url, rotation: 60} per step
- **Smart Pause**: Pauses on user mousedown, resumes on release

### 2. Control Panel Features
- **START/STOP** button (green/red)
- **Pace Slider** (0.5–5.0 seconds)
- **Record Path** checkbox (off by default)
- **Copy Path JSON** button (exports to clipboard)
- **Status display** (WALKING, STUCK, IDLE)
- **Step counter**

### 3. Unstuck State Machine
```
IDLE → TURNING (hold ArrowLeft 600ms) → MOVING (press ArrowUp) → VERIFYING (check URL) → IDLE
```

---

## 🛠️ Implementation Progress

- [x] Modular Architecture (v3.2) — Core engine, input handlers, UI controller
- [x] Comprehensive Test Suite — 83 tests covering all modules
- [x] Bundle Validation Tests — Verify bookmarklet.js output
- [x] CI/CD Pipeline — GitHub Actions runs tests on every push
- [x] Keyboard Mode Default — Simulates Arrow Up for navigation
- [x] Smart Observation — Pauses on user drag
- [x] One-Click Installation Page — GitHub Pages with clipboard copy
- [x] Auto-Unstuck Algorithm (v3.3) — Turn left 60°, move forward, verify
- [x] Path Recording (v3.4) — Local storage, JSON export
- [x] Documentation Update — README, Spec, DEVELOPER.md

---

## 📂 File Map
- `src/core/engine.js` — Navigation logic with unstuck state machine
- `src/input/handlers.js` — Keyboard/mouse event simulation
- `src/ui/controller.js` — Control panel management
- `src/main.js` — Entry point
- `bookmarklet.js` — Auto-generated bundle
- `bookmarklet-console.js` — Console-friendly bundle
- `index.html` — One-click installation page
- `dashboard.html` — Walk dashboard (requires server)
- `server/` — Optional backend (Express + SQLite)
- `build.js` — Bundles src/ → bookmarklet.js
- `DEVELOPER.md` — Developer documentation
- `Spec.md` — Technical specification
- `PROJECT_MEMORY.md` — This knowledge base

---

## 🧪 Testing Workflow

```bash
# Run all tests
npm test

# Build bookmarklet
npm run build

# CI check (tests + build)
npm run ci
```

**All 83 tests must pass before merge.**

---

## 📊 Build Status

CI runs on every push to main:
- Install dependencies
- Run tests (vitest)
- Build bookmarklet (build.js)
- Verify output files

Badge for README:
```markdown
![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)
```

---

## 🔐 Privacy Principles

1. **No tracking** — No analytics, no telemetry
2. **Local storage** — Path data stays in browser memory
3. **Opt-in only** — Recording disabled by default
4. **No identifiers** — No IP logging, no fingerprints
5. **User control** — Manual copy to share data

---

## 📝 Version History

| Version | Key Changes |
|---------|-------------|
| v3.4-EXP | Path recording with JSON export, fixed 60° turn |
| v3.3-EXP | Auto-unstuck algorithm |
| v3.2-EXP | Keyboard mode default, smart observation |
| v3.0 | Strict autonomy, forward-default targeting |
