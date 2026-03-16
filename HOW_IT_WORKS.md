# How Drunk Walker Works

## What It Measures

Drunk Walker generates **street-level navigability data** by recording where a browser-based agent can and cannot move through Google Street View. The output is a spatial record of:

### Primary Measurements

| Data Point | What It Represents |
|------------|-------------------|
| **Visited URLs** | Locations reachable via Street View navigation |
| **Step Count** | Number of navigation attempts made |
| **Stuck Events** | Locations where forward movement failed |
| **Unstuck Success** | Whether recovery maneuvers worked |
| **Path Sequence** | Order of locations visited |
| **Orientation** | Global heading (0-360°) tracking all turns made |

---

## How It Works

### Core Mechanism

Drunk Walker automates Google Street View by simulating keyboard input:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Engine tick (every 2000ms by default)                   │
│  2. Navigation module decides: turn or move forward         │
│  3. If turn: rotate left (prev_turn + random), move forward │
│  4. If move: simulate ArrowUp key press                     │
│  5. If stuck (same URL × 3): Execute unstuck sequence       │
│  6. Repeat from step 1                                      │
└─────────────────────────────────────────────────────────────┘
```

### Architecture

```
┌─────────────────┐
│  Engine         │  State management, timing, path recording
│  (engine.js)    │
└────────┬────────┘
         │ delegates to
         ▼
┌─────────────────┐
│  Navigation     │  Movement algorithms (PLUGGABLE)
│  (navigation.js)│  - Self-avoiding walk (memory-based)
│                 │  - Unstuck recovery (angle-incrementing)
└────────┬────────┘
         │ commands
         ▼
┌─────────────────┐
│  Input Handlers │  Keyboard/mouse event simulation
│  (handlers.js)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Street View    │  Google Maps responds to key events
└─────────────────┘
```

---

## Navigation Logic (v3.69.0-EXP)

### Per-Location Memory

Both **Self-Avoiding** and **Unstuck** algorithms now maintain a memory of previous turns at each specific location.

1. **Local Angle**: `prev_angle + new_random_angle`
2. **Global Orientation**: `start_orientation + all_turns_made`
3. **Wrapping**: If any angle > 360°, subtract 360 to keep it within [0, 360).

### 1. Unstuck Sequence

Triggered when the URL hasn't changed for N steps (default: 3).

```
Step 1: TURN LEFT (30°-90°)
  - Duration = prev_duration + random(300, 900ms)
  - Ensures a new direction is tried on every attempt at this spot

Step 2: MOVE FORWARD
  - Press ArrowUp immediately after turn completes

Step 3: VERIFY
  - Check if URL changed
  - Success: Reset stuckCount
  - Failure: Increment stuckCount, retry next cycle
```

### 2. Self-Avoiding Walk

Triggered when the walker arrives at a previously visited location.

```
Step 1: TURN LEFT (20°-50°)
  - Duration = prev_duration + random(200, 500ms)
  - Biases movement away from already explored paths

Step 2: MOVE FORWARD
  - Press ArrowUp immediately after turn completes
```

---

## Input Simulation

### Keyboard Events

Drunk Walker dispatches a full keyboard event sequence:

```javascript
// Arrow Up (forward movement)
targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

// Arrow Left (turn, held for calculated duration)
// Duration is based on turn angle (approx 10ms per 1°)
targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
setTimeout(() => {
  targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
}, calculatedDuration);
```

---

## Data Recording

### Path JSON

Each step records:
- **URL**: Full Street View URL
- **Location**: Lat,Lng extracted from URL
- **Rotation**: Global orientation (0-360°)
- **Direction**: Always 'forward' (turns are combined into rotation)

---

## Performance

| Metric | Value |
|--------|-------|
| Steps per hour | ~1,800 |
| Unique nodes/hour (v3.69.0) | ~2,000-3,500 |
| Memory usage | ~2-5 MB |
| CPU usage | <5% |

---

## See Also

- **[VERSIONS.md](VERSIONS.md)** — Version history
- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** — Recovery details
- **[SELF_AVOIDING_DESIGN.md](SELF_AVOIDING_DESIGN.md)** — Navigation design
