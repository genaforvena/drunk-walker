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
- Automatically turns left 20°-50° at visited locations
- Immediately steps forward after turning
- Dramatically improves coverage efficiency
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
│ 🤪 DRUNK WALKER v3.69.0-EXP −│
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
- **Auto-Unstuck**: Recovers automatically when stuck (60° left turn)
- **Path Recording**: Saves your walk for later analysis or merging
- **Self-Avoiding Walk**: Prefers unvisited nodes for better coverage efficiency
- **Smart Pause**: Stops when you drag to look around, resumes when done

### New in v3.69.0-EXP+
- **Relative Turn Deltas**: Stores "how much we turned" not "which way we faced"
- **Escalating Left Turns**: Each return to same location adds more left turn
- **Physically Coherent**: Turns applied relative to arrival direction
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
- Current yaw/facing direction (0-360°)

**Exported JSON format:**
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

**Note:** Location coordinates are extracted from URL when needed. Turn angles are stored as `currentYaw` (facing direction after each step).

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

---

## Auto-Unstuck Algorithm

Drunk Walker detects when you're stuck (same URL for 3 consecutive steps) and automatically executes a recovery sequence using **relative turn deltas**.

### How It Works

1. **Retrieve Previous Delta**: Get the last turn delta stored for this location (default: 0° if first visit)
2. **Compute New Delta**: `baseDelta = previousDelta + random(-15°, -45°)`
3. **Apply to Current Facing**: `newYaw = normalize(currentYaw + baseDelta)`
4. **Turn Left**: Hold ArrowLeft for |baseDelta| × 10ms
5. **Immediately Step Forward**: Press ArrowUp right after turn
6. **Store Delta**: Save baseDelta for next visit to this location

### Key Features

- **Relative, Not Absolute**: Stores "I turned -30° here" not "I was facing 70° here"
- **Escalating Turns**: Each return adds more left turn (-30° → -50° → -75° → -90°)
- **Physically Coherent**: Turn is applied relative to arrival direction
- **Always Left**: Never turns right, consistent predictable behavior
- **Never Gets Stuck**: Will eventually try all 360° if needed

### Example Progression

| Visit | Arrival Facing | Previous Delta | New Delta | Exit Facing |
|-------|---------------|----------------|-----------|-------------|
| 1st | 0° (North) | 0° | -30° | 330° |
| 2nd | 180° (South) | -30° | -50° | 130° |
| 3rd | 300° (West) | -50° | -75° | 225° |

### Console Output

```
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=0
url=https://www.google.com/maps/@37.7749,-122.4194,3a,0y,90t/data=!3m4!1e1, currentYaw=330
```

**Note:** Only `url` and `currentYaw` are logged. No rotation, direction, or memory fields.

This happens automatically—no configuration needed.

---

## Compatibility

- **Browsers:** Chrome, Firefox, Safari, Edge
- **Devices:** Desktop and mobile (via console apps)
- **No installation required**

---

## Version Comparison

| Feature | Vanilla (v3.66.6) | Latest (v3.69.0-EXP+) |
|---------|-------------------|----------------------|
| **Movement** | Random walk | Self-avoiding random walk |
| **Unstuck** | Turn left 60° (absolute) | Relative deltas (escalating left) |
| **Turn Storage** | Absolute angles | Relative turn deltas |
| **Physical Coherence** | ❌ (ignores arrival) | ✅ (relative to arrival) |
| **Path Recording** | ✅ | ✅ |
| **Visited Counter** | ❌ | ✅ |
| **Self-Avoiding** | ❌ | ✅ (toggle) |
| **Path Merge Tool** | ❌ | ✅ |
| **Coverage Efficiency** | Baseline | ~3-5x better |
| **Best For** | Simple walks, debugging | Area mapping, exploration |

**Which version to use:**
- **Vanilla (v3.66.6)**: Classic behavior, simpler random walk, good for testing
- **Latest (v3.69.0-EXP+)**: Better coverage, physically coherent turns, recommended for mapping

See **[VERSIONS.md](VERSIONS.md)** for detailed version history and differences.

---

## Documentation

### User Docs
- **[docs/](docs/)** — Documentation hub
- **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)** — What it measures and how it works
- **[docs/ALGORITHM.md](docs/ALGORITHM.md)** — Complete walking algorithm guide
- **[docs/VERSIONS.md](docs/VERSIONS.md)** — Version comparison and history
- **[docs/DEVELOPER.md](docs/DEVELOPER.md)** — Developer guide (build, test, API reference)
- **[docs/Spec.md](docs/Spec.md)** — Technical specification
- **[docs/UNSTUCK_ALGORITHM.md](docs/UNSTUCK_ALGORITHM.md)** — Auto-recovery details
- **[docs/SELF_AVOIDING_DESIGN.md](docs/SELF_AVOIDING_DESIGN.md)** — Self-avoiding walk design
- **[docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md)** — Architecture & history

---

## Related Projects

- **[Google Maps Platform](https://developers.google.com/maps)** - Official Google Maps APIs
- **[OpenStreetView](https://www.openstreetview.org/)** - Open source street-level imagery
- **[Mapillary](https://www.mapillary.com/)** - Crowdsourced street-level imagery

---

## Contributing

Contributions welcome! See **[docs/DEVELOPER.md](docs/DEVELOPER.md)** for build and test instructions.

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
