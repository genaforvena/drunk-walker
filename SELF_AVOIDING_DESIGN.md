# Self-Avoiding Walk Algorithm for Google Street View

## Problem Analysis

### Street View Navigation Characteristics

1. **Discrete Nodes**: Street View moves between fixed 360° panorama positions, not continuous space
2. **Graph Structure**: Each location has 1-4+ connected neighbors (forward, left, right, back)
3. **URL Pattern**: `https://www.google.com/maps/@lat,lng,3a,XXy,Yt/data=...`
   - `lat,lng`: Location coordinates (unique identifier)
   - `XXy`: Yaw/heading (0-360°)
   - `Yt`: Pitch/tilt
4. **Movement**: Arrow Up moves toward the center of the view (current heading)

### Why Current Self-Avoiding Fails

**Current Logic (visit counting):**
```
1. Arrive at location A → visitCount[A] = 1
2. Move forward → arrive at B → visitCount[B] = 1
3. Move forward → arrive at C → visitCount[C] = 1
4. Dead end! Turn around
5. Move forward → arrive at B → visitCount[B] = 2 → TURN!
6. But turning from B might lead back to A (also visited!)
```

**Problem:** Simple visit counting doesn't account for:
- **Direction of travel**: Arriving at B from A ≠ arriving at B from C
- **Graph topology**: Street View is a graph, not a grid
- **Heading matters**: Same location, different heading = different exit options

## Proper Self-Avoiding Algorithm for Street View

### Key Insight

Street View navigation is a **graph traversal problem**, not a spatial one. We should track:
1. **Visited edges** (transitions between nodes), not just nodes
2. **Entry direction** (which neighbor we came from)
3. **Unexplored exits** (neighbors we haven't tried)

### Proposed Algorithm: Edge-Based Self-Avoiding

```javascript
// Track visited EDGES: "fromLocation->toLocation"
const visitedEdges = new Set();

function shouldTurn(currentLocation, previousLocation) {
  const edge = `${previousLocation}->${currentLocation}`;
  
  // First time traversing this edge
  if (!visitedEdges.has(edge)) {
    visitedEdges.add(edge);
    return false; // Continue forward
  }
  
  // We've traversed this edge before = looping
  return true; // Turn to find new path
}
```

### Enhanced: Track Entry Heading

```javascript
// Track (location, entryHeading) pairs
const visitedStates = new Map(); // "lat,lng@heading" -> count

function shouldTurn(currentLocation, currentHeading) {
  const state = `${currentLocation}@${roundHeading(currentHeading)}`;
  const count = visitedStates.get(state) || 0;
  visitedStates.set(state, count + 1);
  
  // Turn if we've been here with SAME heading before
  return count >= 1;
}
```

### Best Approach: Unexplored Frontier

```javascript
// Track which locations have unexplored exits
const frontier = new Set(); // Locations with untried exits
const fullyExplored = new Set(); // All exits tried

function onMove(fromLocation, toLocation) {
  // Mark edge as traversed
  markEdgeTraversed(fromLocation, toLocation);
  
  // Add new location to frontier
  if (!fullyExplored.has(toLocation)) {
    frontier.add(toLocation);
  }
  
  // Check if current location is fully explored
  if (isFullyExplored(currentLocation)) {
    frontier.delete(currentLocation);
    fullyExplored.add(currentLocation);
  }
}

function shouldTurn() {
  // Turn if we're at a fully explored location
  return fullyExplored.has(currentLocation);
}
```

## Implementation Recommendation

For Drunk Walker's blind traversal (no map, no neighbor discovery), use **Entry State Tracking**:

```javascript
// Track (location + approximate entry heading) as state
const visitedStates = new Map();

function onArrive(location, heading) {
  // Round heading to 45° bins (8 directions)
  const binnedHeading = Math.round(heading / 45) * 45;
  const state = `${location}@${binnedHeading}`;
  
  const count = visitedStates.get(state) || 0;
  visitedStates.set(state, count + 1);
  
  return count; // 0 = first visit, 1+ = revisit
}

function shouldTurn(location, heading) {
  const revisitCount = onArrive(location, heading);
  
  // Turn only if we've been here with similar heading before
  // This allows exploring all exits before giving up
  return revisitCount >= 1;
}
```

## Why This Works

| Scenario | Simple Count | Entry State | Result |
|----------|-------------|-------------|--------|
| Arrive at A from north | count=1 | A@0°=1 | Continue |
| Leave A, return from south | count=2 | A@180°=1 | Continue ✅ |
| Return to A from north again | count=3 | A@0°=2 | **TURN** ✅ |

**Simple counting** turns on 2nd visit even if it's a different path.
**Entry state** allows exploring all approaches to a location before turning.

## Testing Checklist

- [ ] Straight corridor: Walk forward without turning
- [ ] T-junction: Explore all 3 branches
- [ ] Loop: Detect and escape circular paths
- [ ] Dead end: Turn around efficiently
- [ ] Grid: Systematic coverage without repetition
- [ ] Open plaza: Spiral outward pattern
