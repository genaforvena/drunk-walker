# Unstuck Algorithm (v3.69.0-EXP)

## Overview

When the walker detects it's stuck (URL hasn't changed for `panicThreshold` consecutive steps), it executes a recovery sequence. 

**Core Change in v3.69.0-EXP:** The algorithm now remembers previous turn attempts at each specific stuck point and increments the angle to ensure 360° coverage.

## Algorithm Flow

```
1. Detect Stuck (3 steps at same URL)
2. Retrieve previous turn angle for this URL/Location
3. Generate new random angle (30°-90°)
4. New Angle = Previous Angle + Random Angle
5. If Angle >= 360: Angle = Angle - 360
6. Turn Left (ArrowLeft) for calculated duration
7. Move Forward (ArrowUp) immediately after turn
8. Verify result after one pace interval
```

## Cumulative Turn Logic

By adding a random increment to the previous turn angle at that location, the walker is guaranteed to eventually try a direction that leads out of the "stuck" position.

```javascript
// From src/core/navigation.js
const prevTurnAngle = locationTurns.get(currentLocation) || 0;
const turnAngle = Math.round(randomTurnDuration / 10);

let newLocationAngle = prevTurnAngle + turnAngle;
if (newLocationAngle >= 360) newLocationAngle -= 360;

locationTurns.set(currentLocation, newLocationAngle);
```

## State Machine

| State | Action |
|-------|--------|
| `IDLE` | Waiting for next tick |
| `TURNING` | Holding ArrowLeft |
| `MOVING` | Pressing ArrowUp |
| `VERIFYING` | Comparing URLs |

## Global Orientation Tracking

Every unstuck turn also updates the global orientation of the walker, which is stored in the recorded path.

```javascript
globalOrientation = (globalOrientation + turnAngle) % 360;
```

## Console Output

```
🚨 UNSTUCK TRIGGERED: Stuck count=3 (threshold=3)
⬅️ Unstuck: Turning left ~65° (loc angle: 65°, global: 125°)
⬆️ Unstuck: Moving forward after turn
✅ Unstuck SUCCESS - moved to new location
```

## Rationale

The "Previous + Random" approach is superior to pure random turns because it:
1. **Prevents Oscillations**: Avoids turning back and forth between two stuck directions.
2. **Guarantees Coverage**: Ensures all 360 degrees are explored systematically but with enough randomness to avoid predictable traps.
3. **Persistent Memory**: Remembers what didn't work even if the walker leaves and returns to the same stuck spot later.
