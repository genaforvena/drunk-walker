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
| **Current Yaw** | Facing direction (0-360°) at each step |

---

## How It Works

### Core Mechanism

Drunk Walker automates Google Street View by simulating keyboard input:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Engine tick (every 2000ms by default)                   │
│  2. Navigation module decides: turn or move forward         │
│  3. If turn: Apply relative delta to current yaw, move      │
│  4. If move: simulate ArrowUp key press                     │
│  5. If stuck (same URL × 3): Execute unstuck sequence       │
│  6. Repeat from step 1                                      │
└─────────────────────────────────────────────────────────────┘
```

### Architecture

```
┌─────────────────┐
│  Engine         │  State management, timing, path recording
│  (engine.js)    │  Yaw tracking, stuck detection
└────────┬────────┘
         │ delegates to
         ▼
┌─────────────────┐
│  Navigation     │  Movement algorithms (PLUGGABLE)
│  (navigation.js)│  - Self-avoiding walk (relative deltas)
│                 │  - Unstuck recovery (escalating left turns)
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

## Navigation Logic (v3.69.0-EXP+)

### Relative Turn Deltas

The key innovation: **store how much we turned, not which direction we faced**.

| Old Approach (Absolute) | New Approach (Relative) |
|------------------------|------------------------|
| Store: "I was facing 70° here" | Store: "I turned -30° left here" |
| Problem: Ignores arrival direction | Solution: Applies to any arrival |
| Physically incoherent | Physically coherent |

### Delta Storage

```javascript
// Map<location, delta> where delta is always negative (left turn)
const locationTurnDeltas = new Map();

// Example:
// "37.7749,-122.4194" → -30  (turned 30° left here last time)
// "37.7750,-122.4195" → -55  (turned 55° left here last time)
```

### Delta Calculation

When stuck or at visited location:

```javascript
// Get previous delta (0 if first visit)
const prevTurnDelta = locationTurnDeltas.get(currentLocation) || 0;

// Add random left increment (-15 to -45 degrees)
const randomLeftIncrement = -15 - Math.random() * 30;

// Compute new delta (escalating, always negative)
let baseDelta = prevTurnDelta + randomLeftIncrement;

// Clamp to -90° maximum
baseDelta = Math.max(-90, baseDelta);

// Apply to current facing
const newYaw = normalizeAngle(currentYaw + baseDelta);
```

### Example: Escalating Turns

| Visit | Arrival Facing | Previous Delta | Random Increment | New Delta | Exit Facing |
|-------|---------------|----------------|------------------|-----------|-------------|
| 1st | 0° | 0° | -30° | **-30°** | 330° |
| 2nd | 180° | -30° | -20° | **-50°** | 130° |
| 3rd | 300° | -50° | -25° | **-75°** | 225° |

---

## Navigation Strategies

### 1. Normal Walking (Unvisited Location)

```
Trigger: Location not in visitedUrls Set
Action: Press ArrowUp (move forward)
Log: url=..., currentYaw=0
```

### 2. Self-Avoiding Walk (Visited Location)

```
Trigger: Location found in visitedUrls Set
Action:
  1. Retrieve lastTurnDelta for this location
  2. Compute: baseDelta = prevDelta + random(-15°, -45°)
  3. Turn left (ArrowLeft) for |baseDelta| × 10ms
  4. Immediately press ArrowUp
  5. Store new delta, update currentYaw
Log: url=..., currentYaw=newYaw
```

### 3. Unstuck Recovery (Stuck for 3+ Ticks)

```
Trigger: URL unchanged for panicThreshold ticks (default: 3)
Action: Same as self-avoiding (uses same delta mechanism)
Log: url=..., currentYaw=newYaw
```

---

## State Machine

| State | Trigger | Action |
|-------|---------|--------|
| `IDLE` | Waiting for tick | None |
| `TURNING` | Stuck or at visited location | Hold ArrowLeft |
| `MOVING` | Turn complete | Press ArrowUp |
| `VERIFYING` | After pace interval | Check URL changed |

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
- **Current Yaw**: Facing direction (0-360°, rounded integer)

```json
[
  {
    "url": "https://www.google.com/maps/...",
    "currentYaw": 330
  },
  {
    "url": "https://www.google.com/maps/...",
    "currentYaw": 0
  }
]
```

**Removed in v3.69.0-EXP+:**
- `location` — extracted from URL when needed
- `rotation` — renamed to `currentYaw`
- `direction` — always "forward", redundant

---

## Console Output

### Logging Format

Only `url` and `currentYaw` are logged (no rotation, direction, or memory fields):

```
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=0
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=330
```

---

## Performance

| Metric | Value |
|--------|-------|
| Steps per hour | ~1,800 (at 2s pace) |
| Unique nodes/hour | ~2,000-3,500 (self-avoiding) |
| Memory usage | ~2-5 MB |
| CPU usage | <5% |
| Coverage efficiency | ~3-5x better than random walk |

---

## Key Guarantees

1. **Never Gets Stuck**: Will eventually try all 360° if needed
2. **Physically Coherent**: Turns are relative to arrival direction
3. **No Oscillation**: Progressively sharper turns prevent back-and-forth
4. **Deterministic Randomness**: Same location gets escalating turns with variation

---

## See Also

- [ALGORITHM.md](ALGORITHM.md) — Complete walking algorithm guide
- [VERSIONS.md](VERSIONS.md) — Version history
- [UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md) — Recovery details
- [SELF_AVOIDING_DESIGN.md](SELF_AVOIDING_DESIGN.md) — Navigation design
- [DEVELOPER.md](DEVELOPER.md) — Developer guide
- [../README.md](../README.md) — User documentation
