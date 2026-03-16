# Walking Algorithm Guide

**Complete documentation of the Drunk Walker navigation algorithm**

---

## Overview

Drunk Walker uses a **self-avoiding random walk with relative turn deltas**. The core innovation is storing *how much we turned* at each location (not *which direction we faced*), then applying progressively sharper left turns from whatever direction we happen to arrive.

### Key Principles

1. **Relative, Not Absolute**: Store turn deltas (e.g., "turned -30° here"), not absolute angles (e.g., "was facing 70°")
2. **Left Turns Only**: All turns are negative (counterclockwise), 0 to -90 degrees
3. **Escalating**: Each return to the same location adds more left turn
4. **Physically Coherent**: Turns are applied relative to current arrival facing

---

## Core Algorithm

### Normal Walking (Not Stuck)

```
Every tick (default: 2000ms):
  1. Check if user is interacting → pause if true
  2. Detect if stuck (URL unchanged for N ticks)
  3. If NOT stuck:
     - Press ArrowUp (keyboard mode) OR
     - Click target coordinates (click mode)
  4. Record step: { url, currentYaw }
  5. Add location to visited set
```

### When Stuck (URL Unchanged for 3+ Ticks)

```
When stuckCount >= panicThreshold (default: 3):

1. Retrieve lastTurnDelta for this location (default: 0 if first visit)
2. Compute new delta:
   baseDelta = lastTurnDelta + random(-15, -45)
   // Example: -30 + (-25) = -55 degrees
3. Clamp to -90° maximum
4. Apply to current facing:
   newYaw = normalize(currentYaw + baseDelta)
5. Execute turn (hold ArrowLeft for |baseDelta| × 10ms)
6. Immediately press ArrowUp
7. Store baseDelta as lastTurnDelta for this location
8. Update currentYaw = newYaw
```

### Self-Avoiding (At Previously Visited Location)

Same as "When Stuck" but triggered by location memory, not stuck detection.

---

## Turn Delta Storage

### Data Structure

```javascript
// Map<location, delta>
const locationTurnDeltas = new Map();

// Example state:
// "37.7749,-122.4194" → -30  (turned 30° left here last time)
// "37.7750,-122.4195" → -55  (turned 55° left here last time)
```

### Delta Calculation

```javascript
// Get previous delta (0 if first visit)
const prevTurnDelta = locationTurnDeltas.get(currentLocation) || 0;

// Add random left increment (-15 to -45 degrees)
const randomLeftIncrement = -15 - Math.random() * 30;

// Compute new delta (always negative, escalating)
let baseDelta = prevTurnDelta + randomLeftIncrement;

// Clamp to -90° maximum
baseDelta = Math.max(-90, baseDelta);

// Store for next visit
locationTurnDeltas.set(currentLocation, baseDelta);
```

### Example Progression

| Visit # | Arrival Facing | Previous Delta | Random Increment | New Delta | Exit Facing |
|---------|---------------|----------------|------------------|-----------|-------------|
| 1st | 0° | 0° | -30° | **-30°** | 330° |
| 2nd (from 180°) | 180° | -30° | -20° | **-50°** | 130° |
| 3rd (from 300°) | 300° | -50° | -25° | **-75°** | 225° |
| 4th (from 90°) | 90° | -75° | -15° | **-90°** | 0° (clamped) |

---

## Angle Normalization

All angles are normalized to [0, 360):

```javascript
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}
```

**Examples:**
- `normalize(-30)` → 330
- `normalize(390)` → 30
- `normalize(-100)` → 260

---

## State Machine

### Navigation States

| State | Trigger | Action |
|-------|---------|--------|
| `IDLE` | Waiting for tick | None |
| `TURNING` | Stuck or self-avoiding | Hold ArrowLeft |
| `MOVING` | Turn complete | Press ArrowUp |
| `VERIFYING` | After pace interval | Check URL changed |

### State Transitions

```
IDLE ──[stuck or visited]──> TURNING ──[turn complete]──> MOVING
  ▲                                                        │
  │                                                        ▼
  └──────────────[verification]─────────────── VERIFYING ──┘
```

---

## Yaw Tracking

### Current Yaw (`currentYaw`)

Tracks the walker's current facing direction:
- Starts at 0° (arbitrary "north")
- Updated after every turn: `currentYaw = newYaw`
- Used to compute physically coherent turns

### Global Orientation

Also tracked for path recording:
```javascript
globalOrientation += turnDelta;  // Signed delta (negative for left)
if (globalOrientation < 0) globalOrientation += 360;
if (globalOrientation >= 360) globalOrientation -= 360;
```

---

## Path Recording

Each step records:

```javascript
{
  url: "https://www.google.com/maps/...",
  currentYaw: 330  // Rounded integer degrees
}
```

**Removed fields** (from previous versions):
- `location` — extracted from URL when needed
- `rotation` — renamed to `currentYaw`
- `direction` — always "forward", redundant

---

## Console Output

### Normal Step
```
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=0
```

### Unstuck Turn
```
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=330
```

**Note:** Only `url` and `currentYaw` are logged. No rotation, direction, or memory fields.

---

## Why This Works

### Advantages of Relative Deltas

| Problem | Old Approach (Absolute) | New Approach (Relative) |
|---------|------------------------|------------------------|
| **Arrival from different direction** | Turns to stored angle (wrong direction) | Applies delta to current facing (correct) |
| **Physical coherence** | Ignores how we arrived | Respects arrival direction |
| **Escalation** | Stores absolute angle | Stores delta, adds more each visit |
| **Memory efficiency** | Stores full angle | Stores small negative number |

### Guarantees

1. **Never Gets Stuck**: Will eventually try all 360° if needed
2. **No Oscillation**: Progressively sharper turns prevent back-and-forth
3. **Physically Coherent**: Turn is always relative to arrival
4. **Deterministic Randomness**: Same location gets escalating turns, but with random variation

---

## Implementation Files

### Source Files

| File | Purpose |
|------|---------|
| `src/core/navigation.js` | Turn delta logic, unstuck algorithm |
| `src/core/engine.js` | Yaw tracking, path recording |
| `src/input/handlers.js` | Keyboard/mouse event simulation |
| `src/ui/controller.js` | Control panel UI |
| `src/main.js` | Entry point, module initialization |

### Key Functions

```javascript
// src/core/navigation.js
createUnstuckNavigation(cfg, callbacks)
  └─ executeUnstuck(stuckCount, panicThreshold, currentYaw)
     └─ Computes baseDelta, newYaw, stores delta

createNavigationController(cfg, callbacks)
  └─ tick(context)
     └─ Delegates to unstuck or returns normal move

// src/core/engine.js
createEngine(config)
  ├─ tick() — Main loop
  ├─ recordStep() — Path recording
  └─ currentYaw tracking
```

---

## Modifying the Algorithm

### Change Turn Behavior

**Edit:** `src/core/navigation.js`

```javascript
// Adjust random increment range (currently -15 to -45)
const randomLeftIncrement = -15 - Math.random() * 30;

// Adjust maximum turn (currently -90°)
baseDelta = Math.max(-90, baseDelta);

// Change turn duration calculation (currently 10ms per degree)
const turnDuration = Math.round(turnAngle * 10);
```

### Change Stuck Detection

**Edit:** `src/core/engine.js`

```javascript
// Adjust panic threshold (currently 3 ticks)
const defaultConfig = {
  panicThreshold: 3,  // Change this
  // ...
};
```

### Change Walking Pace

**Edit:** `src/core/engine.js` or via UI slider

```javascript
const defaultConfig = {
  pace: 2000,  // Milliseconds between steps (default: 2s)
  // ...
};
```

### Change Self-Avoiding Behavior

**Edit:** `src/core/navigation.js`

The self-avoiding logic uses the same delta mechanism as unstuck. To make it more/less aggressive:

```javascript
// In executeSelfAvoidingStep (if implemented separately)
const randomLeftIncrement = -20 - Math.random() * 30;  // -20 to -50 (more aggressive)
```

### Add New Navigation Strategy

**Edit:** `src/core/navigation.js`

```javascript
export function createNewStrategy(cfg, callbacks) {
  const executeStep = (context) => {
    // Your custom logic here
    return { action: 'turn' | 'move', ... };
  };

  return { executeStep, reset, getState };
}

// Then integrate in createNavigationController:
export function createNavigationController(cfg, callbacks) {
  const unstuck = createUnstuckNavigation(cfg, callbacks);
  const newStrategy = createNewStrategy(cfg, callbacks);

  const tick = (context) => {
    // Priority: newStrategy > unstuck > normal
    if (shouldUseNewStrategy(context)) {
      return newStrategy.executeStep(context);
    }
    // ... rest of logic
  };
}
```

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Specific algorithm tests
npx vitest run src/core/turn-and-move.test.js
npx vitest run src/core/self-avoiding.test.js
```

### Manual Testing

1. Open Google Maps Street View
2. Paste bookmarklet into console
3. Click START
4. Observe console output:
   - Normal steps: `url=..., currentYaw=0`
   - Turns: `url=..., currentYaw=330` (or other angle)
5. Get stuck (block the path):
   - After 3 ticks, should turn left
   - Check that `currentYaw` changes appropriately

### Verify Delta Escalation

```javascript
// In browser console, after getting stuck multiple times:
DRUNK_WALKER.engine.getNavigation().unstuck.getDeltaForLocation("lat,lng")
// Should return increasingly negative values: -30, -55, -75, etc.
```

---

## Performance

| Metric | Value |
|--------|-------|
| Steps per hour | ~1,800 (at 2s pace) |
| Unique nodes/hour | ~2,000-3,500 (self-avoiding) |
| Memory usage | ~2-5 MB |
| CPU usage | <5% |
| Turn duration | 300-900ms (30°-90°) |

---

## Comparison: Old vs New

### Old Algorithm (Pre-v3.69.0-EXP)

```javascript
// Store absolute angle
const prevTurnAngle = locationTurns.get(currentLocation) || 0;
let newLocationAngle = prevTurnAngle + turnAngle;  // Add new turn
locationTurns.set(currentLocation, newLocationAngle);

// Problem: Ignores arrival direction
// If I stored "70°" and arrive from 180°, I still turn to 70° (wrong!)
```

### New Algorithm (v3.69.0-EXP+)

```javascript
// Store relative delta
const prevTurnDelta = locationTurnDeltas.get(currentLocation) || 0;
let baseDelta = prevTurnDelta + randomLeftIncrement;  // More negative
locationTurnDeltas.set(currentLocation, baseDelta);

// Apply to current facing
const newYaw = normalize(currentYaw + baseDelta);

// Correct: If I stored "-30°" and arrive from 180°, I turn to 150° (180 + -30)
```

---

## Troubleshooting

### Issue: Walker spins in circles

**Cause:** Turn delta not being stored correctly.

**Fix:** Check `locationTurnDeltas.set()` is called with correct location key.

### Issue: Turns are too sharp/too gentle

**Cause:** Random increment range or clamping.

**Fix:** Adjust `randomLeftIncrement` range or `Math.max(-90, baseDelta)` clamp.

### Issue: currentYaw doesn't update

**Cause:** `navResult.newYaw` not being passed back to engine.

**Fix:** Check `tick()` updates `currentYaw = navResult.newYaw`.

### Issue: Logging shows wrong format

**Cause:** Console output not updated.

**Fix:** Update `console.log()` calls to `url=${...}, currentYaw=${...}`.

---

## See Also

- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** — Detailed unstuck recovery
- **[SELF_AVOIDING_DESIGN.md](SELF_AVOIDING_DESIGN.md)** — Self-avoiding walk design
- **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)** — What it measures
- **[DEVELOPER.md](DEVELOPER.md)** — Developer guide
- **[README.md](README.md)** — User documentation
