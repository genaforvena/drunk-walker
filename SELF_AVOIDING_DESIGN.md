# Self-Avoiding Walk Algorithm (v3.69.0-EXP)

## Concept

The **self-avoiding random walk** in Drunk Walker is designed to maximize exploration efficiency by biasing the walker away from previously visited locations.

## Edge-Based Memory with Angle Accumulation

Instead of simple visit counting, version 3.69.0-EXP uses **Location + Heading Memory**:

### 1. Tracking State
The engine maintains a `Set` of visited locations (`lat,lng`). 
The navigation module maintains a `Map` of cumulative turn angles per location.

### 2. Decision Logic
When the walker arrives at a location:
1. Check if the location is in `visitedUrls`.
2. If **Visited**:
   - Retrieve `prev_turn_angle` for this location.
   - Generate a `new_random_angle` (20°-50°).
   - `target_angle = prev_turn_angle + new_random_angle`.
   - If `target_angle >= 360`, subtract 360.
   - Execute a left turn (`ArrowLeft`) for the corresponding duration.
   - Immediately step forward (`ArrowUp`).
   - Store the new `target_angle` for this location.
3. If **Unvisited**:
   - Move forward normally (`ArrowUp`).
   - Add location to `visitedUrls`.

## Global Orientation

The walker maintains a global orientation state that tracks the sum of all turns made since the session started:

```javascript
globalOrientation = (globalOrientation + lastTurnAngle) % 360;
```

This orientation is recorded in every step of the path export, allowing for reconstruction of the walk's geometry.

## Why This Works

| Feature | Benefit |
|---------|---------|
| **Angle Accumulation** | Prevents getting "stuck" in a preferred turn direction at a specific intersection. |
| **360° Wrapping** | Ensures the walker eventually tries all directions at a node if it keeps returning. |
| **Immediate Step** | Reduces time wasted in rotation; movement happens as soon as the heading changes. |
| **Global Tracking** | Provides a continuous heading for spatial analysis. |

## Implementation Details (navigation.js)

```javascript
const prevTurnAngle = locationTurns.get(currentLocation) || 0;
const turnAngleChange = Math.round(getRandomTurnDuration() / 10);

let newLocationAngle = prevTurnAngle + turnAngleChange;
if (newLocationAngle >= 360) newLocationAngle -= 360;

locationTurns.set(currentLocation, newLocationAngle);
```

## Testing Checklist

Verified in `src/core/self-avoiding.test.js`:
- [x] **New Locations**: No turning, straight forward movement.
- [x] **Revisited Locations**: Accumulate angle and turn left.
- [x] **Angle Wrapping**: Subtract 360 when exceeding the limit.
- [x] **Global Orientation**: Continuous tracking across multiple turns.
