# Drunk Walker Specification (v3.70.0-EXP)

## Executive Summary

**Drunk Walker** is a modular automation engine for Google Street View. It simulates physical probing (Arrow Up + Turning) to navigate an unknown digital graph. It features a decoupled architecture with a pluggable traversal algorithm, supporting multiple personas: Explorer, Hunter, and Surgeon.

---

## 1. Architecture

### 1.1 Components
- **The Engine (`engine.js`)**: Orchestrates timing, state (steps, stuckCount), and the main `tick` loop.
- **The Wheel (`wheel.js`)**: Manages physical orientation (`yaw`) and handles the "left-turn only" physical constraint.
- **The Traversal (`traversal.js`)**: Pluggable decision-making logic that chooses whether to `turn` or `move` based on the current context.

### 1.2 Personas (Modes)
- 🌍 **EXPLORER**: Expansionist mode using a weighted heatmap and breadcrumbs to find unvisited areas.
- 🏹 **HUNTER**: Topological sniper mode designed to find and tag cul-de-sacs via 180° snap-back recovery.
- 🔪 **SURGEON**: Efficiency mode that vetoes already-visited directions to maximize the steps/visited ratio.

---

## 2. Version History

| Version | Key Features |
|---------|--------------|
| v3.70.0-EXP | Decoupled Traversal/Wheel architecture, Hunter & Surgeon modes, 60° increments, Map-based heatmap, Breadcrumbs. |
| v3.69.0-EXP | Self-avoiding random walk, visited nodes memory, path merge utility |
| v3.66.6-EXP | Path recording with JSON export, fixed 60° turn angle |
| v3.3-EXP | Auto-Unstuck Algorithm (turn left 60°, move forward, verify) |

---

## 3. Functional Requirements

### 3.1 Control Panel UI

| Element | Type | Description |
|---------|------|-------------|
| START/STOP | Button | Toggle walking on/off |
| MODE | Cycle Button| Switch between EXPLORER, HUNTER, and SURGEON |
| STATUS | Text | Shows WALKING, STUCK, or IDLE |
| STEPS | Counter | Total steps taken (always visible) |
| VISITED | Counter | Unique nodes visited |
| PACE | Slider | 0.5 - 5.0 seconds between steps |
| 💾 Download Path | Button | Export recorded path as JSON |
| 📂 Restore Walk | Button | Load and resume from JSON |
| − / + | Button | Minimize/Maximize the control panel |

### 3.2 Core Algorithm (v3.70.0+ Logic)

**Physical Probing (The Tick):**
1. Wait for pace interval (default 2000ms).
2. Update **Stuck Detection** (URL comparison).
3. Algorithm `decide()`:
   - **If Turn requested**: Rotate Wheel left by X degrees (ArrowLeft duration), then press ArrowUp.
   - **If Move requested**: Press ArrowUp immediately (or click target 0.4, 0.8).
4. Record step: Update heatmap (Map) and breadcrumbs (rolling buffer of 20).
5. Increment step counter.

**Stuck Recovery (Systematic Search):**
- In Explorer mode: Escalating turns (60°, 120°, 180°...) until URL changes.
- In Hunter mode: Immediate 180° "Snap-Back" to escape dead-ends.

---

## 4. Technical Specification

### 4.1 Engine State

```javascript
{
  status: 'IDLE' | 'WALKING',
  steps: number,
  stuckCount: number,
  isBusy: boolean, // True during async turns
  visitedUrls: Map<string, number>, // location -> visitCount
  breadcrumbs: Array<string>, // Last 20 locations
  walkPath: Array<{ url: string, currentYaw: number }>
}
```

### 4.2 Configuration

```javascript
const defaultConfig = {
  pace: 2000,
  mode: 'EXPLORER',
  kbOn: true,
  expOn: true,
  panicThreshold: 3,
  targetX: 0.4, // Slight left of center
  targetY: 0.8, // Slight bottom of center
  selfAvoiding: true
};
```

---

## 5. Build Requirements

### 5.1 Components Order
1. `wheel.js`
2. `traversal.js`
3. `navigation.js` (Compatibility Layer)
4. `engine.js`
5. `handlers.js`
6. `controller.js`
7. `main.js`

---

## 6. Testing Requirements

### 6.1 Performance Target
- **118 total tests** must pass (Vitest suite).
- All modes (Explorer, Hunter, Surgeon) must be functionally verified.
