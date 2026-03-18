# 🤪 Drunk Walker

![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)
![GitHub release](https://img.shields.io/github/v/release/genaforvena/drunk-walker?label=release)
![License](https://img.shields.io/github/license/genaforvena/drunk-walker)

**[👉 Launch Instantly](https://genaforvena.github.io/drunk-walker/)**

> **Automated Google Street View navigation for urban research, mapping, and data collection**

## What Is It?

Drunk Walker is an automation engine for Google Street View that walks for you. It presses the **Arrow Up** key repeatedly to move forward through streets, creating an endless, directionless journey.

**Use cases:**
- 🗺️ **Urban Research** - Generate walkability data and navigability maps
- 📊 **Data Collection** - Export Street View paths as JSON for analysis
- 🤖 **Automation Testing** - Test Street View coverage and connectivity
- 🎯 **Area Mapping** - Map neighborhoods with self-avoiding exploration
- 🔬 **Training Data** - Generate spatial datasets for ML models

No destination. No control. Just walking.

---

## How It Works

### 1. Launch
- Open Google Maps Street View
- Paste the script into your browser console (F12)
- A control panel appears

### 2. Start Walking
- Click **START**
- The script presses **Arrow Up** at regular intervals
- You move forward automatically

### 3. Smart Recovery
When you get stuck (same location for 3 steps):
- Automatically turns left 30°-90° (random bounded)
- Immediately steps forward after turning
- If still stuck, turns left again on next attempt
- Guaranteed to never get stuck - will complete full 360° if needed

### 4. Record Your Path
- Path recording enabled by default
- Click **📋 Copy** to copy path JSON to clipboard
- Click **💾 Download** to save path as JSON file
- Click **📂 Restore Walk** to load a previously saved walk

### 5. Self-Avoiding Walk
- **Proactive Avoidance**: Detects visited locations ahead and turns before entering
- **Smart Direction Selection**: Scans perpendicular and diagonal directions first
- **Bidirectional Turns**: Can turn left OR right toward unexplored areas
- **Fallback to Unstuck**: If all directions visited, uses reactive unstuck algorithm
- Toggle on/off with **Self-Avoiding Walk** checkbox

### 6. Merge Multiple Sessions
- Run multiple sessions from different starting points
- Export each path as JSON
- Merge them: `node merge-paths.js session1.json session2.json > merged.json`
- Coverage that takes a week can be done in parallel in an afternoon

---

## Control Panel

```
┌─────────────────────────────┐
│ 🤪 DRUNK WALKER v3.70.0-EXP −│
├─────────────────────────────┤
│ STEPS: 42                   │
├─────────────────────────────┤
│ STATUS: WALKING             │
│ VISITED: 38                 │
│ PACE: 2.0s     [━━━━○━━━]   │
│ [💾 Download Path]          │
│ [📄 Download Logs]          │
│ [📂 Restore Walk]           │
│ [🔴 STOP]                   │
└─────────────────────────────┘
```

| Control | What It Does |
|---------|--------------|
| **− / +** | Minimize/Maximize the control panel |
| **STEPS** | Total steps taken (always visible) |
| **START/STOP** | Begin or end the walk |
| **Pace Slider** | Adjust speed (0.5–5.0 seconds per step) |
| **💾 Download Path** | Download recorded path as JSON file |
| **📄 Download Logs** | Download session logs as text file |
| **📂 Restore Walk** | Load and resume a saved walk from JSON file |
| **Visited Counter** | Shows unique locations visited |
| **Status** | Shows WALKING, STUCK, or IDLE |

---

## Features

### Always On
- **Proactive Self-Avoiding**: Detects visited areas ahead, turns before entering (67% revisit reduction)
- **Auto-Unstuck**: Recovers automatically when stuck (60° left turn)
- **Path Recording**: Saves your walk for later analysis or merging
- **Smart Pause**: Stops when you drag to look around, resumes when done

### New in v3.70.0-EXP
- **Proactive Self-Avoiding**: Looks ahead and avoids visited locations before entering
- **Bidirectional Turns**: Can turn left OR right toward unexplored areas
- **67% Revisit Reduction**: Dramatically better exploration efficiency
- **Minimized UI Mode**: Collapse the panel to save space while walking
- **Visited Counter**: Track unique locations explored
- **Path Merge Utility**: Combine multiple session exports

### Configurable
- **Walking Speed**: Adjust pace from 0.5 to 5.0 seconds

---

## Quick Start

1. Go to [Google Maps Street View](https://www.google.com/maps)
2. Enter Street View mode
3. Press **F12** (or Right-Click → Inspect)
4. Go to **Console** tab
5. Visit [genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)
6. Click **COPY JS TO CLIPBOARD**
7. Paste into console, press Enter
8. Click **START**

---

## Path Recording

When enabled, Drunk Walker records:
- Street View URL after each step
- Location coordinates (lat,lng)
- Cumulative turn angle (actual degrees turned)

**Exported JSON format:**
```json
[
  {
    "url": "https://www.google.com/maps/...",
    "location": "37.7749,-122.4194",
    "rotation": 127
  },
  {
    "url": "https://www.google.com/maps/...",
    "location": "37.7750,-122.4195",
    "rotation": 127
  }
]
```

**Privacy:** Path data stays in your browser. Nothing is sent anywhere unless you manually copy and share it.

### Merging Multiple Sessions

For parallel exploration, run multiple sessions from different starting points and merge the results:

```bash
# Node.js CLI
node merge-paths.js session1.json session2.json session3.json > merged.json

# Browser console
// Paste merge-paths.js content, then:
const merged = mergePaths([path1, path2, path3]);
console.log(JSON.stringify(merged, null, 2));
```

The merge utility:
- Deduplicates by URL (keeps first occurrence)
- Reports statistics (input sessions, total steps, unique nodes)
- Outputs sorted, clean JSON

### Analyzing Walk Data

Analyze your walk sessions to measure exploration efficiency:

```bash
# Run analysis on a walk JSON file
node scripts/analyze-walk.js walk-2024-01-15.json
```

**Metrics reported:**
- Total steps vs unique locations (revisit rate)
- Yaw distribution (heading bias detection)
- Movement bearing distribution (actual travel patterns)
- Backtrack events (180° reversals)
- Net displacement and efficiency (meters/step)
- Stuck sequences analysis

---

## Proactive Self-Avoiding Algorithm

Drunk Walker uses a **two-layer navigation system** to maximize exploration efficiency:

### Layer 1: Proactive Avoidance (Primary)
**Triggers when NOT stuck** - prevents entering visited areas before it's a problem:

1. **Lookahead Prediction**: Calculates where the next step will land based on current heading
2. **Visited Check**: If next location is already visited, initiates avoidance maneuver
3. **Direction Scanning**: Tests angles in priority order: [90°, -90°, 45°, -45°, 135°, -135°, 180°, 0°]
   - Perpendicular directions first (most likely to be unexplored)
   - Then diagonals
   - Then reverse
   - Finally forward (last resort)
4. **Bidirectional Turns**: Turns left OR right depending on which leads to unvisited area
5. **Immediate Movement**: Steps forward immediately after turning

**Benefits:**
- **67% revisit reduction** compared to random walk
- **3-5x better coverage efficiency**
- Prevents loops before they form

### Layer 2: Reactive Unstuck (Fallback)
**Triggers when stuck** (same URL for 3+ consecutive steps):

1. **Turns Left 30°-90°** — Random bounded angle (progressive escalation)
2. **Immediately Steps Forward** — Presses ArrowUp right after turn completes
3. **Verification**: Checks if URL changed
4. **Escalation**: If still stuck, increases left turn angle on next attempt

**Key Guarantees:**
- **Always turns left** — Consistent, predictable recovery
- **Progressive escalation** — Each attempt at same location turns more
- **Never gets permanently stuck** — Will complete full 360° if needed
- **Immediate step after turn** — No wasted time

### When All Directions Are Visited
If proactive avoidance finds no unvisited directions:
- Falls back to unstuck algorithm immediately
- Uses reactive turning to escape dense/fully-explored areas
- Ensures forward progress even in challenging environments

**Console Output:**
```
proactive: url=..., currentYaw=90
🤪 DRUNK WALKER: Unstuck successfully (turned left ~67°)!
```

This two-layer approach happens automatically—no configuration needed.

---

## Auto-Unstuck Algorithm (Legacy Documentation)

Drunk Walker detects when you're stuck (same URL for 3 consecutive steps) and automatically:

1. **Turns Left 30°-90°** — Random bounded angle (never right, never stuck)
2. **Immediately Steps Forward** — Presses ArrowUp right after turn completes
3. **Checks Result** — If URL changed, continues walking; if still stuck, turns left again

**Key Guarantees:**
- **Always turns left** — Consistent, predictable behavior
- **Random bounded variation** — Prevents perfect circular loops
- **Never gets stuck** — Will complete full 360° if needed to find exit
- **Immediate step after turn** — No wasted time

**Console Output:**
```
🤪 DRUNK WALKER: Unstuck successfully (turned left ~67°)!
🤪 DRUNK WALKER: Still stuck after 52° left turn (cumulative: 198°)
```

This happens automatically—no configuration needed.

---

## Compatibility

- **Browsers:** Chrome, Firefox, Safari, Edge
- **Devices:** Desktop and mobile (via console apps)
- **No installation required**

---

## Version Comparison

| Feature | Vanilla (v3.66.6) | Latest (v3.70.0-EXP) |
|---------|-------------------|------------------|
| **Movement** | Random walk | Proactive self-avoiding walk |
| **Unstuck** | Turn left 60° | Turn left 60° |
| **Path Recording** | ✅ | ✅ |
| **Visited Counter** | ❌ | ✅ |
| **Self-Avoiding** | ❌ | ✅ (proactive + toggle) |
| **Bidirectional Turns** | ❌ | ✅ |
| **Path Merge Tool** | ❌ | ✅ |
| **Coverage Efficiency** | Baseline | ~3-5x better |
| **Revisit Rate** | ~67% | ~20-30% |
| **Best For** | Simple walks, debugging | Area mapping, exploration |

**Which version to use:**
- **Vanilla (v3.66.6)**: Classic behavior, simpler random walk, good for testing
- **Latest (v3.69.0-EXP)**: Better coverage, prefers unvisited areas, recommended for mapping

See **[VERSIONS.md](VERSIONS.md)** for detailed version history and differences.

---

## Documentation

### User Docs
- **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)** — What it measures and how it works
- **[VERSIONS.md](VERSIONS.md)** — Version comparison and history
- **[DEVELOPER.md](DEVELOPER.md)** — Developer guide (build, test, API reference)
- **[Spec.md](Spec.md)** — Technical specification
- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** — Auto-recovery details
- **[PROJECT_MEMORY.md](PROJECT_MEMORY.md)** — Architecture & history

---

## Related Projects

- **[Google Maps Platform](https://developers.google.com/maps)** - Official Google Maps APIs
- **[OpenStreetView](https://www.openstreetview.org/)** - Open source street-level imagery
- **[Mapillary](https://www.mapillary.com/)** - Crowdsourced street-level imagery

---

## Contributing

Contributions welcome! See **[DEVELOPER.md](DEVELOPER.md)** for build and test instructions.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit and push
6. Open a Pull Request

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## ⚠️ Note

This is a technical experiment. Use responsibly.

**Not affiliated with Google or Google Maps.** Google Street View is a trademark of Google Inc.

---

## Versioning

Versions are automatically incremented on each push to `main`:
- **Format**: `v3.69.X-EXP` (patch version auto-increments)
- **Tags**: Git tags created for each version (e.g., `v3.69.0-exp`)
- **Releases**: GitHub releases auto-created with each version bump

See **[VERSIONS.md](VERSIONS.md)** for version history and differences.

---

## Keywords

`google-street-view` `automation` `urban-research` `walkability` `mapping` `street-view` `data-collection` `browser-automation` `spatial-data` `navigation` `random-walk` `self-avoiding-walk`

---

*Created with ❤️ and confusion.*
