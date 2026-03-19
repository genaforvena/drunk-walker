# Walking Algorithm Guide (v4.2.0+)

**Comprehensive documentation of the Advanced Traversal Engine**

---

## Architecture Overview

The v4.0.0+ architecture decouples state management from decision-making logic, allowing for rapid experimentation with navigation strategies.

### 1. The Engine (`engine.js`)
- **Orchestrator**: Manages the main `tick` loop (pace).
- **State Store**: Holds `steps`, `stuckCount`, `visitedUrls` (Heatmap), and `breadcrumbs` (Scent).
- **Sensors**: Extracts the current location from the URL and detects if the walker is "stuck".
- **Safety**: Pauses operations during user interaction (dragging/drawing).

### 2. The Wheel (`wheel.js`)
- **Orientation**: Manages the current `yaw` (0-359°).
- **Physicality**: Handles the "left-turn only" constraint by simulating `ArrowLeft` long-presses.
- **Normalization**: Ensures all angles stay within the [0, 360) range.

### 3. The Traversal Algorithm (`traversal.js`)
- **Decision Maker**: A pluggable component that receives the current context and decides whether to `turn` or `move`.
- **Strategy**: Implements Weighted Heatmaps, Breadcrumbs, and Systematic Search.

---

## Core Strategies

### A. Weighted "Heatmap" Exploration
Instead of a simple visited set, the engine maintains a `Map<Location, VisitCount>`.

1. **Scan**: On every tick, the algorithm "looks" in 6 directions (every 60°).
2. **Predict**: It projects the next coordinate for each direction using a fixed `stepDistance`.
3. **Score**: It calculates a score for each direction:
   - `Score = (VisitCount * 10) + BreadcrumbPenalty + ForwardBias`
4. **Decide**: It selects the direction with the **lowest score** (the "coldest" territory).

### B. Long-Term "Scent" (Breadcrumbs)
To prevent oscillation and "ping-ponging" between two nearby points:

- The engine stores a rolling buffer of the last 20 locations (`breadcrumbs`).
- During the scoring phase, any direction pointing toward a location in the breadcrumb list receives a penalty proportional to how recently that location was visited.
- This forces the walker to prefer paths that lead *away* from its recent trail.

### C. Systematic Search Pattern (Stuck Recovery)
When the walker is genuinely stuck (e.g., hitting a wall or a dead-end):

1. **Trigger**: `stuckCount >= panicThreshold` (default: 3).
2. **Escalation**: Instead of turning randomly, it performs a systematic sweep:
   - 1st stuck tick: Turn 60°
   - 2nd stuck tick: Turn 120°
   - 3rd stuck tick: Turn 180°
   - ...and so on until the URL changes.
3. **Reset**: Once the walker successfully moves (URL changes), the search pattern resets.

### D. Surgical Surveyor (Ratio Mode)
A specialized mode focused on maximum efficiency (Steps/Visited ratio).

1. **Veto Logic**: Unlike other modes, the Surveyor uses projection math to **veto** any direction that points toward a visited location.
2. **Ghost Step Prevention**: It refuses to press "Up" if it knows the target bubble is already in the heatmap.
3. **Scan-First**: If the forward direction is visited, it scans 360° and picks the first "clean" direction it finds.

---

## Math & Logic

### 1. Location Prediction
Used to "see" into the future before actually moving:
```javascript
// Simplified lat/lng projection
dLat = cos(yaw) * distance;
dLng = sin(yaw) * distance / cos(lat);
```

### 2. Angle Normalization
Ensures we don't end up with negative angles or angles > 360:
```javascript
angle = angle % 360;
if (angle < 0) angle += 360;
```

---

## State Machine

| State | Context | Decision |
|-------|---------|----------|
| **Normal** | `stuckCount == 0` | Scan 360°, pick lowest heatmap/breadcrumb score. |
| **Stuck** | `stuckCount > 0` | Maintain course, hope for late load. |
| **Panic** | `stuckCount >= 3`| Start Systematic Search (60°, 120°, 180°...). |

---

## Why This is Better

| Problem | Old Approach (v3.x) | New Approach (v4.x) |
|---------|---------------------|---------------------|
| **Loops** | Random chance to escape | Heatmap forces exit to "cold" areas. |
| **Oscillation** | Could flip 180° back and forth | Breadcrumbs penalize recent path. |
| **Stuck Recovery**| Random turns (can take many tries) | Systematic sweep guarantees checking all exits. |
| **Experimentation**| Logic hardcoded in engine | Simply swap `traversal.js` logic. |

---

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `panicThreshold` | 3 | Ticks before Systematic Search starts. |
| `selfAvoiding` | true | Enables Heatmap/Breadcrumb logic. |
| `pace` | 2000ms | Time between decisions. |

---

## Developer Guide: Changing the Logic

To experiment with a new algorithm:
1. Open `src/core/traversal.js`.
2. Modify the `decide(context)` function.
3. You have access to `visitedUrls` (Map), `breadcrumbs` (Array), and `orientation`.
4. Return `{ turn: true, angle: X }` to turn, or `{ turn: false }` to move forward.
