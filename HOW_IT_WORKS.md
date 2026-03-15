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

### What This Reveals

1. **Navigable Space**: URLs that loaded = valid Street View positions
2. **Connectivity**: Which positions link to which others
3. **Dead Ends**: Where the walker got stuck repeatedly
4. **Coverage Density**: How thoroughly an area was explored
5. **Pedestrian-Scale Network**: Walkable paths at human eye level

---

## How It Works

### Core Mechanism

Drunk Walker automates Google Street View by simulating keyboard input:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Simulate Arrow Up key press                             │
│  2. Street View attempts to move forward                    │
│  3. If successful: URL changes, record step                 │
│  4. If stuck (same URL × 3): Execute unstuck sequence       │
│  5. Repeat from step 1                                      │
└─────────────────────────────────────────────────────────────┘
```

### Technical Flow

```
┌──────────────┐
│   START      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Wait (pace)  │  ← Configurable delay (default: 2000ms)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Check: Stuck?│──Yes──▶┌─────────────┐
└──────┬───────┘        │ Unstuck     │
       │ No             │ (turn left) │
       │                └──────┬──────┘
       ▼                       │
┌──────────────┐               │
│ Press ArrowUp│◀──────────────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Record Step  │  ← Save URL + rotation
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Loop back   │
└──────────────┘
```

---

## Input Simulation

### Keyboard Events

Drunk Walker dispatches a full keyboard event sequence:

```javascript
// Arrow Up (forward movement)
targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
targetEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'ArrowUp' }));
setTimeout(() => {
  targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
}, 50);

// Arrow Left (turn when stuck, held for 600ms)
targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
setTimeout(() => {
  targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
}, 600);
```

### Why Keyboard Simulation?

- **Native behavior**: Street View responds to arrow keys by default
- **No API needed**: Works without Google Maps API keys
- **Human-like timing**: Simulates actual user interaction
- **Browser compatibility**: Works across Chrome, Firefox, Safari, Edge

---

## Stuck Detection

### Algorithm

```javascript
let stuckCount = 0;
let lastUrl = '';

function updateStuckDetection() {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) {
    stuckCount++;  // Still at same location
  } else {
    lastUrl = currentUrl;
    stuckCount = 0;  // Moved successfully
  }
}
```

### Threshold

- **Default**: 3 consecutive steps at same URL
- **Rationale**: Allows for slow-loading views while catching real dead ends
- **Status display**: Shows `STUCK (1)`, `STUCK (2)`, `STUCK (3)`, then `PANIC!`

---

## Unstuck Sequence

When stuck count reaches threshold:

```
Step 1: TURN LEFT 60°
  - Hold ArrowLeft for 600ms
  - Rotates view ~60 degrees counterclockwise

Step 2: MOVE FORWARD
  - Press ArrowUp once
  - Attempts to move in new direction

Step 3: VERIFY
  - Wait one pace interval (2000ms)
  - Check if URL changed
  - Success: Reset stuckCount, resume walking
  - Failure: stuckCount++, retry next cycle
```

### Why Always Left?

**Design Principle:** Consistent behavior over optimal behavior.

- Predictable recovery pattern
- Easier to debug and understand
- Eventually covers all directions through repeated application
- Even in circles, always turning same direction

---

## Self-Avoiding Walk (v3.67.0+)

### Concept

A **self-avoiding random walk** prefers unvisited nodes while maintaining randomness. It's a weak bias, not perfect avoidance.

### Implementation

```javascript
let visitedUrls = new Set();

function executeSelfAvoidingStep() {
  const currentUrl = window.location.href;
  const isCurrentVisited = visitedUrls.has(currentUrl);
  
  if (isCurrentVisited && visitedUrls.size > 0) {
    // At visited node: turn to explore
    const turnRight = Math.random() < 0.5;
    const turnKey = turnRight ? 'ArrowRight' : 'ArrowLeft';
    
    // Quick turn (~30°)
    onLongKeyPress(turnKey, cfg.turnDuration / 2, () => {});
    return true;
  }
  return false;  // No turn needed
}
```

### Behavior

| Situation | Action |
|-----------|--------|
| At new node | Move forward normally |
| At visited node | Quick turn (~30°), then move |
| Multiple unstuck attempts | Keep turning left 60° each time |

### Coverage Improvement

Pure random walk tends to:
- Revisit same courtyard repeatedly
- Circle in open plazas
- Waste steps on already-mapped areas

Self-avoiding walk:
- Reduces revisits by ~40-60%
- Explores new territory faster
- Still can't escape true dead ends

---

## Path Recording

### Data Structure

```javascript
walkPath = [
  {
    url: "https://www.google.com/maps/@37.7749,-122.4194,3a,75y,90t/data=...",
    rotation: 60  // Fixed rotation angle
  },
  // ... more steps
];
```

### When Recorded

- After each successful step (URL change)
- Only if "Record Path" checkbox is enabled
- Stored in browser memory (not sent anywhere)

### Export Format

JSON array, copyable to clipboard:

```json
[
  {"url": "https://www.google.com/maps/...", "rotation": 60},
  {"url": "https://www.google.com/maps/...", "rotation": 60}
]
```

---

## Multi-Session Merge

### Purpose

Combine path data from multiple parallel sessions to:
- Cover larger areas faster
- Map from multiple entry points
- Reduce total exploration time

### How It Works

```bash
# Run session 1 (export path1.json)
# Run session 2 (export path2.json)
# Run session 3 (export path3.json)

# Merge all three
node merge-paths.js path1.json path2.json path3.json > merged.json
```

### Deduplication

```javascript
function deduplicatePaths(paths) {
  const seen = new Set();
  const result = [];
  
  for (const step of paths) {
    if (!seen.has(step.url)) {
      seen.add(step.url);
      result.push(step);
    }
  }
  return result;
}
```

**Result:** Combined path with duplicate URLs removed.

---

## What It Doesn't Measure

### Limitations

| Not Measured | Why |
|--------------|-----|
| Physical distance | Street View jumps between fixed positions |
| Travel time | All steps take same time regardless of real distance |
| Accessibility | No curb cuts, slopes, or obstacles detected |
| Safety | No lighting, visibility, or crime data |
| Quality | No image quality or recency assessment |
| True connectivity | Can't detect gates, fences, or locked areas |

### What It Can't Do

- **Escape true dead ends**: If no forward path exists in any direction, it stays stuck
- **Cross gaps**: Can't jump between disconnected Street View areas
- **Detect private property**: May record publicly visible private spaces
- **Replace field work**: Ground truth still needed for accessibility audits

---

## Data Quality Considerations

### Factors Affecting Coverage

1. **Street View Density**: Urban areas = more positions, rural = sparse
2. **Recency**: Older imagery may have changed
3. **Weather**: Snow, construction can block paths
4. **Time of Day**: Some areas have limited coverage times
5. **Image Stitching**: Sometimes creates false connections

### Validation

For research use:
- Cross-reference with satellite imagery
- Spot-check problematic areas manually
- Compare with official walkability scores
- Validate against ground-truth surveys

---

## Use Cases

### Urban Research

- Generate walkability heatmaps
- Identify pedestrian infrastructure gaps
- Study street network connectivity
- Map opportunity zones

### Machine Learning

- Training data for navigation models
- Street-level image datasets
- Path planning algorithms
- Accessibility prediction

### Personal Projects

- Document neighborhood changes
- Plan walking routes
- Explore unfamiliar areas
- Create interactive maps

---

## Privacy & Ethics

### What's Collected

- Street View URLs (public data)
- Navigation sequence
- Step timestamps (optional)

### What's NOT Collected

- User location or IP
- Personal identifiers
- Browsing history
- Account information

### Responsible Use

- Respect Google's Terms of Service
- Don't overload servers (use reasonable pace)
- Don't scrape at industrial scale
- Don't use for surveillance purposes

---

## Performance

### Typical Metrics

| Metric | Value |
|--------|-------|
| Steps per hour | ~1,800 |
| Unique nodes/hour (v3.66.6) | ~600-900 |
| Unique nodes/hour (v3.67.0) | ~1,500-2,500 |
| Memory usage | ~1-3 MB |
| CPU usage | <5% (background tab) |

### Optimization Tips

1. **Use latest version**: Self-avoiding walk is significantly more efficient
2. **Adjust pace**: Faster pace = more steps, but more stuck events
3. **Multiple sessions**: Run 3-5 tabs from different starting points
4. **Merge results**: Combine exports for complete coverage

---

## Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Not moving | Not in Street View mode | Enter Street View first |
| Constantly stuck | Dead end or private area | Manually reposition |
| High CPU | Too many tabs | Limit to 3-5 sessions |
| Path not recording | Checkbox unchecked | Enable "Record Path" |
| Export empty | No steps recorded | Walk more, then export |

---

## Technical Requirements

- **Browser**: Chrome, Firefox, Safari, Edge (recent versions)
- **JavaScript**: ES6+ support required
- **Memory**: ~5 MB per session
- **Network**: Required for Street View loading
- **Permissions**: None (runs in console)

---

## See Also

- **[VERSIONS.md](VERSIONS.md)** — Version comparison
- **[Spec.md](Spec.md)** — Full technical specification
- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** — Recovery details
- **[README.md](README.md)** — Quick start guide
