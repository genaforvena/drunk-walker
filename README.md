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
│ 🤪 DRUNK WALKER v3.67.6-EXP│
├─────────────────────────────┤
│ STATUS: WALKING             │
│ STEPS: 42                   │
│ VISITED: 38                 │
│ PACE: 2.0s     [━━━━○━━━]   │
│ ☑ Record Path               │
│ ☑ Self-Avoiding Walk        │
│ [📋 Copy] [💾 Download]     │
│ [📂 Restore Walk]           │
│ [🔴 STOP]                   │
└─────────────────────────────┘
```

| Control | What It Does |
|---------|--------------|
| **START/STOP** | Begin or end the walk |
| **Pace Slider** | Adjust speed (0.5–5.0 seconds per step) |
| **Record Path** | Enable path recording (on by default) |
| **Self-Avoiding Walk** | Prefer unvisited nodes (on by default) |
| **📋 Copy** | Copy path JSON to clipboard |
| **💾 Download** | Download path as JSON file |
| **📂 Restore Walk** | Load and resume a saved walk from JSON file |
| **Visited Counter** | Shows unique locations visited |
| **Status** | Shows WALKING, STUCK, or IDLE |

---

## Features

### Always On
- **Auto-Unstuck**: Recovers automatically when stuck (60° left turn)
- **Path Recording**: Records your route automatically (can be disabled)
- **Smart Pause**: Stops when you drag to look around, resumes when done

### New in v3.67.0
- **Self-Avoiding Walk**: Prefers unvisited nodes for better coverage
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

---

## Auto-Unstuck Algorithm

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

| Feature | Vanilla (v3.66.6) | Latest (v3.67.0) |
|---------|-------------------|------------------|
| **Movement** | Random walk | Self-avoiding random walk |
| **Unstuck** | Turn left 60° | Turn left 60° |
| **Path Recording** | ✅ | ✅ |
| **Visited Counter** | ❌ | ✅ |
| **Self-Avoiding** | ❌ | ✅ (toggle) |
| **Path Merge Tool** | ❌ | ✅ |
| **Coverage Efficiency** | Baseline | ~3-5x better |
| **Best For** | Simple walks, debugging | Area mapping, exploration |

**Which version to use:**
- **Vanilla (v3.66.6)**: Classic behavior, simpler random walk, good for testing
- **Latest (v3.67.0)**: Better coverage, prefers unvisited areas, recommended for mapping

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
- **Format**: `v3.67.X-EXP` (patch version auto-increments)
- **Tags**: Git tags created for each version (e.g., `v3.67.1-exp`)
- **Releases**: GitHub releases auto-created with each version bump

See **[VERSIONS.md](VERSIONS.md)** for version history and differences.

---

## Keywords

`google-street-view` `automation` `urban-research` `walkability` `mapping` `street-view` `data-collection` `browser-automation` `spatial-data` `navigation` `random-walk` `self-avoiding-walk`

---

*Created with ❤️ and confusion.*
