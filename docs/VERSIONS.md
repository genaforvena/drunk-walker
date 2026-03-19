# Drunk Walker Versions

## Quick Comparison

| Version | Name | Key Feature | Status |
|---------|------|-------------|--------|
| v4.2.0-EXP | **Current** | Surgeon Mode, Decoupled Architecture | ✅ Recommended |
| v3.70.0-EXP | **Refactor** | Hunter Mode, Physical Probing | 📌 Stable |

---

## Detailed Version History

### v4.2.0-EXP (Current Latest)

**Release:** March 20, 2026

**New Features:**
- **SURGEON Mode**: Specialized efficiency algorithm that vetoes already-visited nodes using projection math.
- **End of the World Finder**: Rebranded framing focusing on "flight from the past" and boundary discovery.
- **Triple-Mode Cycling**: UI now cycles through EXPLORER, HUNTER, and SURGEON.

**Changes:**
- Optimized projection math for better veto decisions.
- Updated documentation with deep dives into traversal theory.

---

### v3.70.0-EXP

**Release:** March 16, 2026

**New Features:**
- **Minimized UI Mode**: Added a button to collapse the control panel, showing only the step counter to save screen space.
- **Simplified Interface**: Removed "Update Script" and "Copy" buttons for a cleaner layout.

**Changes:**
- Path recording and Self-Avoiding walk are now permanently enabled and the toggles have been removed from the UI.
- Improved control panel layout with a dedicated header.

**Best For:**
- Users who want a less intrusive UI while recording long walks.
- Simplified automated exploration.

---

### v3.67.0-EXP (Stable)

**Release:** Current development version

**New Features:**
- **Self-Avoiding Random Walk**: Prefers unvisited nodes when at previously visited locations
- **Visited Nodes Counter**: Shows unique locations explored in real-time
- **Path Merge Utility**: `merge-paths.js` for combining multiple session exports
- **Parallel Session Support**: Run multiple tabs from different starting points

**Changes:**
- Path recording enabled by default
- Self-avoiding walk enabled by default (toggleable)
- New `visitedUrls` Set for tracking visited locations
- `executeSelfAvoidingStep()` function for weak exploration pressure

**Behavior:**
- Still turns left 60° when stuck (unchanged)
- When at visited node, performs quick turn (~30°) to explore new direction
- Does NOT guarantee perfect coverage (still random walk with weak bias)
- Coverage efficiency: ~3-5x better than pure random walk

**UI Additions:**
- VISITED counter showing unique nodes
- Self-Avoiding Walk checkbox
- Updated status display

**Best For:**
- Area mapping and exploration
- Generating navigability data
- Neighborhood-scale analysis
- Training data generation

---

### v3.66.6-EXP (Vanilla)

**Release:** Tagged stable reference version

**Features:**
- Pure random walk behavior
- Auto-unstuck (turn left 60° when stuck)
- Path recording with JSON export
- Keyboard mode (Arrow Up simulation)
- Smart pause on user interaction

**Behavior:**
- Presses Arrow Up at regular intervals
- When stuck (3 same URLs): turns left 60°, tries to move
- No preference for visited vs unvisited nodes
- Truly random directionless walking

**Best For:**
- Simple automated walks
- Testing and debugging
- Understanding baseline behavior
- Situations where pure randomness is desired

---

## Key Differences Explained

### Movement Algorithm

| Aspect | Vanilla (v3.66.6) | Latest (v3.67.0) |
|--------|-------------------|------------------|
| **Walk Type** | Pure random walk | Self-avoiding random walk |
| **Direction Choice** | Always forward | Forward, but turns at visited nodes |
| **Memory** | None | Tracks visited URLs |
| **Coverage** | May revisit same areas | Prefers new territory |
| **Efficiency** | Baseline (1x) | ~3-5x better |

### Self-Avoiding Walk Explained

The self-avoiding walk in v3.67.0 is a **weak bias** system:

1. **Tracks visited URLs** in a Set
2. **Detects** when at a previously visited location
3. **Performs quick turn** (~30°) in random direction
4. **Continues walking** in new direction

This is NOT a perfect self-avoiding walk:
- Does NOT guarantee no revisits
- Does NOT use pathfinding
- Does NOT escape true dead ends
- Still fundamentally a random walk

The benefit: **dramatically reduces time spent circling in the same courtyard** while maintaining the simplicity of random walking.

### Unstuck Algorithm (Both Versions)

Both versions use identical unstuck behavior:

```
When stuck (same URL × 3 steps):
  1. Turn left 60° (hold ArrowLeft for 600ms)
  2. Move forward (press ArrowUp)
  3. Check if URL changed
     - Success: Reset stuck count, continue
     - Failure: Increment stuck count, retry next cycle
```

**Design Principle:** Always turn left. This ensures consistent, predictable behavior—even if the walker ends up in a circular path, it's always turning the same direction.

---

## Output Comparison

### Path Recording (Both Versions)

Both versions export the same JSON format:

```json
[
  {"url": "https://www.google.com/maps/...", "rotation": 60},
  {"url": "https://www.google.com/maps/...", "rotation": 60}
]
```

### Additional Data in v3.67.0

- **Visited count**: Available via `engine.getVisitedCount()`
- **Merge statistics**: When merging paths, reports deduplication stats

---

## Performance Comparison

| Metric | Vanilla (v3.66.6) | Latest (v3.67.0) |
|--------|-------------------|------------------|
| **Steps/hour** | ~1,800 | ~1,800 |
| **Unique nodes/hour** | ~600-900 | ~1,500-2,500 |
| **Revisit rate** | 50-70% | 20-40% |
| **Dead end recovery** | Same | Same |
| **Memory usage** | ~1 MB | ~1-3 MB (visited Set) |

**Note:** Actual performance depends on Street View density and layout complexity.

---

## Which Version to Use?

### Choose Vanilla (v3.66.6) if:
- You want pure random behavior
- You're debugging or testing
- You prefer simpler, predictable patterns
- You're studying baseline random walk properties

### Choose Latest (v3.67.0) if:
- You want to map an area efficiently
- You're generating training data
- You want to minimize revisits
- You're doing neighborhood-scale analysis
- You want to merge multiple parallel sessions

---

## Upgrade Path

**From Vanilla to Latest:**
1. Export your path from Vanilla session
2. Start Latest version
3. Import path if needed (via `engine.setWalkPath()`)
4. Enable/disable self-avoiding as needed

**Backwards Compatibility:**
- Path JSON format is identical between versions
- Merged paths work in both versions
- Settings don't transfer (start fresh)

---

## Future Versions

Planned improvements (not yet implemented):
- Adaptive turn duration based on environment
- Better dead-end detection
- Machine learning for optimal unstuck strategy
- Improved self-avoiding algorithms

---

## Version Tagging

Git tags for reference:
- `v3.66.6-exp` — Vanilla version (stable reference)
- `main` branch — Latest development version

Access specific versions:
- **Latest**: `https://raw.githubusercontent.com/genaforvena/drunk-walker/main/bookmarklet.js`
- **Vanilla**: `https://raw.githubusercontent.com/genaforvena/drunk-walker/v3.66.6-exp/bookmarklet.js`
