# 🧑‍💻 Developer Guide (v4.2.0-EXP)

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests (118 tests)
npm test

# Build bookmarklet
node build.js
```

---

## Project Structure

```
drunk-walker/
├── src/
│   ├── core/
│   │   ├── engine.js        # Orchestrator (state, timing)
│   │   ├── wheel.js         # Physicality (orientation, turning)
│   │   ├── traversal.js     # Logic (Explorer, Hunter, Surgeon)
│   │   ├── navigation.js    # Compatibility Layer (stubs)
│   │   ├── engine.test.js   # Unit tests
│   │   └── turn-and-move.test.js # Integration tests
│   ├── input/
│   │   └── handlers.js      # Key/Mouse event simulation
│   ├── ui/
│   │   └── controller.js    # Control panel (Personas UI)
│   └── main.js              # Entry point
├── build.js                 # Bundles src/ → bookmarklet.js
├── index.html               # Installation site (GitHub Pages)
└── package.json             # Dependencies
```

---

## Architecture: The Decoupled Stack

### 1. The Engine (`src/core/engine.js`)
The central orchestrator. It manages the `setInterval` loop and maintains the global state:
- **Steps Counter**: Physical probes made.
- **Heatmap (Map)**: Long-term spatial memory.
- **Breadcrumbs (Array)**: Short-term rolling buffer (last 20).
- **Stuck Detection**: Compares current and previous URLs.

### 2. The Wheel (`src/core/wheel.js`)
Handles the "Physicality" of the bot. 
- Manages the `yaw` (0-359).
- Translates degrees into `ArrowLeft` hold durations.
- Ensures all movement is "Left-Turn only."

### 3. The Traversal (`src/core/traversal.js`)
The "Pluggable Brain." Every tick, the engine passes the current state to the algorithm, which returns `{ turn: boolean, angle: X }`.
- **Explorer**: Weighted Heatmap + Breadcrumbs.
- **Hunter**: Seek dead-ends + 180° Snap-Back.
- **Surgeon**: Veto movement to visited nodes via projection math.

---

## Data Flow

```
[Engine Tick] 
      │
      ▼
[Stuck Detection?] ────▶ [Update State]
      │
      ▼
[Algorithm Decide] ◀─── [Heatmap + Breadcrumbs]
      │
      ▼
[Turn?] ───────────────▶ [Wheel: Hold ArrowLeft]
      │
      ▼
[Move?] ───────────────▶ [Handlers: Press ArrowUp]
      │
      ▼
[Record Step] ─────────▶ [Update Path JSON]
```

---

## Building

The build script (`build.js`) is a custom concatenator that:
1. Reads components in order: `wheel`, `traversal`, `navigation`, `engine`, `handlers`, `controller`, `main`.
2. Strips ESM `import/export` statements.
3. Wraps the result in an IIFE.
4. Outputs to `bookmarklet.js` and `bookmarklet-console.js`.

---

## Testing

We use **Vitest** with **jsdom**.
- Total Tests: **118**
- Coverage: Core state, Physical turns, Persona logic, and Bundle integrity.

```bash
npm test
```

---

## API Reference (Global)

When running in the browser, access the engine via:
```javascript
window.DRUNK_WALKER.engine.setMode('SURGEON') // Swap logic on the fly
window.DRUNK_WALKER.engine.getWalkPath()      // Export JSON
window.DRUNK_WALKER.engine.getConfig()       // Read current pace/mode
```
