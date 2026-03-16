# Unstuck Algorithm (v3.69.0-EXP+)

## Overview

When the walker detects it's stuck (URL hasn't changed for `panicThreshold` consecutive steps), it executes a recovery sequence using **relative turn deltas**.

**Core Change in v3.69.0-EXP+:** The algorithm now stores *relative turn deltas* (always negative, left-only) instead of absolute angles. Each return to the same location applies a progressively sharper left turn from the current arrival facing.

---

## Algorithm Flow

```
1. Detect Stuck (URL unchanged for panicThreshold ticks, default: 3)
2. Retrieve lastTurnDelta for this location (default: 0 if first visit)
3. Compute new delta:
   baseDelta = lastTurnDelta + random(-15°, -45°)
4. Clamp to -90° maximum
5. Apply to current facing:
   newYaw = normalize(currentYaw + baseDelta)
6. Turn Left (ArrowLeft) for |baseDelta| × 10ms
7. Move Forward (ArrowUp) immediately after turn
8. Store baseDelta as lastTurnDelta for this location
9. Update currentYaw = newYaw
10. Verify result after one pace interval
```

---

## Relative Turn Logic

### Why Relative Deltas?

| Scenario | Absolute Angle (Old) | Relative Delta (New) |
|----------|---------------------|---------------------|
| **Arrive from North (0°)** | Turn to stored 70° | Apply -30° → face 330° |
| **Arrive from South (180°)** | Turn to stored 70° (wrong!) | Apply -30° → face 150° (correct) |
| **Arrive from West (270°)** | Turn to stored 70° (wrong!) | Apply -30° → face 240° (correct) |

**Key Insight:** Storing "I turned -30° here" is physically coherent regardless of arrival direction. Storing "I was facing 70° here" ignores how we arrived.

### Delta Calculation

```javascript
// From src/core/navigation.js
const prevTurnDelta = locationTurnDeltas.get(currentLocation) || 0;

// Add random left increment (-15 to -45 degrees)
const randomLeftIncrement = -15 - Math.random() * 30;

// Compute new delta (always negative, escalating)
let baseDelta = prevTurnDelta + randomLeftIncrement;

// Clamp to -90° maximum
baseDelta = Math.max(-90, baseDelta);

// Store for next visit
locationTurnDeltas.set(currentLocation, baseDelta);

// Apply to current facing
const newYaw = normalizeAngle(currentYaw + baseDelta);
```

### Example Progression

| Visit | Arrival Facing | Previous Delta | Random Increment | New Delta | Exit Facing |
|-------|---------------|----------------|------------------|-----------|-------------|
| 1st | 0° | 0° | -30° | **-30°** | 330° |
| 2nd | 180° | -30° | -20° | **-50°** | 130° |
| 3rd | 300° | -50° | -25° | **-75°** | 225° |
| 4th | 90° | -75° | -15° | **-90°** (clamped) | 0° |

---

## State Machine

| State | Trigger | Action |
|-------|---------|--------|
| `IDLE` | Waiting for tick | None |
| `TURNING` | stuckCount >= panicThreshold | Hold ArrowLeft for \|baseDelta\| × 10ms |
| `MOVING` | Turn complete | Press ArrowUp |
| `VERIFYING` | After pace interval | Check if URL changed |

### State Transitions

```
IDLE ──[stuckCount >= 3]──> TURNING ──[turn complete]──> MOVING
  ▲                                                   │
  │                                                   ▼
  └────────────[URL changed?]───────────── VERIFYING ──┘
                        ├─ Yes: stuckCount = 0, resume
                        └─ No: stuckCount++, retry
```

---

## Turn Duration

Turn duration is proportional to turn angle:

```javascript
const turnAngle = Math.abs(baseDelta);  // Magnitude (positive)
const turnDuration = Math.round(turnAngle * 10);  // 10ms per degree
const clampedDuration = Math.max(300, Math.min(900, turnDuration));
```

| Turn Angle | Duration |
|------------|----------|
| -15° | 150ms → clamped to 300ms |
| -30° | 300ms |
| -60° | 600ms |
| -90° | 900ms |

---

## Console Output

### Logging Format

Only `url` and `currentYaw` are logged:

```
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=330
```

**Removed fields:**
- No rotation
- No direction
- No memory state
- No "UNSTUCK TRIGGERED" messages

### Example Session

```
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=0
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=0
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=0
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=330
```

---

## Key Invariants

1. **lastTurnDelta is always negative** (left turn magnitude, 0 to -90°)
2. **Same location gets escalating turns** (more negative each visit)
3. **Turn is relative to arrival** (physically coherent)
4. **Random variation prevents loops** (-15 to -45 increment)
5. **Maximum -90° clamp** (never turns more than 90° left)

---

## Implementation

### Data Structure

```javascript
// Map<location, delta>
const locationTurnDeltas = new Map();

// Example:
// "37.7749,-122.4194" → -30
// "37.7750,-122.4195" → -55
```

### Angle Normalization

```javascript
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}
```

### Full Implementation

```javascript
// src/core/navigation.js
export function createUnstuckNavigation(cfg, callbacks) {
  const locationTurnDeltas = new Map();
  let state = 'IDLE';

  const executeUnstuck = (stuckCount, panicThreshold, currentYaw) => {
    const currentLocation = extractLocation(window.location.href);
    const prevTurnDelta = locationTurnDeltas.get(currentLocation) || 0;
    
    const randomLeftIncrement = -15 - Math.random() * 30;
    let baseDelta = prevTurnDelta + randomLeftIncrement;
    baseDelta = Math.max(-90, baseDelta);
    
    locationTurnDeltas.set(currentLocation, baseDelta);
    
    const newYaw = normalizeAngle(currentYaw + baseDelta);
    const turnDuration = Math.max(300, Math.min(900, Math.abs(baseDelta) * 10));
    
    onLongKeyPress('ArrowLeft', turnDuration, () => {
      console.log(`url=${currentUrl}, currentYaw=${Math.round(newYaw)}`);
      onKeyPress('ArrowUp');
      // ... verification logic
    });
    
    return { action: 'turn', turnAngle: baseDelta, newYaw };
  };
}
```

---

## Rationale

### Why This Approach Works

1. **Prevents Oscillations**
   - Old: Could turn left 60°, then right 60°, oscillating forever
   - New: Always turns more left, guaranteeing eventual escape

2. **Physically Coherent**
   - Old: "I was facing 70° here" ignores arrival direction
   - New: "I turned -30° here" applies correctly from any direction

3. **Guarantees Coverage**
   - Escalating turns ensure all 360° are eventually tried
   - Random variation prevents predictable patterns

4. **Memory Efficient**
   - Stores small negative numbers (-15 to -90)
   - One Map entry per stuck location

---

## Testing

### Unit Tests

```bash
npx vitest run src/core/turn-and-move.test.js
npx vitest run src/core/self-avoiding.test.js
```

### Manual Verification

```javascript
// In browser console, after getting stuck:
const nav = DRUNK_WALKER.engine.getNavigation();
const delta = nav.unstuck.getDeltaForLocation("37.7749,-122.4194");
console.log(delta);  // Should be negative: -30, -55, -75, etc.
```

---

## See Also

- [ALGORITHM.md](ALGORITHM.md) — Complete walking algorithm guide
- [SELF_AVOIDING_DESIGN.md](SELF_AVOIDING_DESIGN.md) — Self-avoiding walk
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — What it measures
- [DEVELOPER.md](DEVELOPER.md) — Developer guide
- [../README.md](../README.md) — User documentation
