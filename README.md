# 🤪 Drunk Walker

![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)

**[👉 Launch Instantly](https://genaforvena.github.io/drunk-walker/)**

## What Is It?

Drunk Walker is an automation engine for Google Street View that walks for you. It presses the **Arrow Up** key repeatedly to move forward through streets, creating an endless, directionless journey.

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
- Automatically turns left 60°
- Tries to move forward
- If successful, resumes normal walking

### 4. Record Your Path (Optional)
- Check **Record Path** to save your route
- Click **Copy Path JSON** to export
- Get a list of all URLs visited with rotation angles

### 5. Self-Avoiding Walk (New in v3.67.0)
- Automatically prefers unvisited directions when multiple forward options exist
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
│ 🤪 DRUNK WALKER v3.67.0-EXP│
├─────────────────────────────┤
│ STATUS: WALKING             │
│ STEPS: 42                   │
│ VISITED: 38                 │
│ PACE: 2.0s     [━━━━○━━━]   │
│ ☑ Record Path               │
│ ☑ Self-Avoiding Walk        │
│ [📋 Copy Path JSON]         │
│ [🔴 STOP]                   │
└─────────────────────────────┘
```

| Control | What It Does |
|---------|--------------|
| **START/STOP** | Begin or end the walk |
| **Pace Slider** | Adjust speed (0.5–5.0 seconds per step) |
| **Record Path** | Enable path recording (on by default) |
| **Self-Avoiding Walk** | Prefer unvisited nodes (on by default) |
| **Copy Path JSON** | Export your walk as JSON |
| **Step Counter** | Shows total steps taken |
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
- Rotation angle (fixed at 60°)
- Visited nodes tracked for self-avoiding walk

**Exported JSON format:**
```json
[
  {"url": "https://www.google.com/maps/...", "rotation": 60},
  {"url": "https://www.google.com/maps/...", "rotation": 60}
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

1. **Turns Left 60°** — Holds ArrowLeft key for 600ms
2. **Moves Forward** — Presses ArrowUp
3. **Checks Result** — If URL changed, continues walking; if still stuck, increments counter and tries again on next cycle

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

## ⚠️ Note

This is a technical experiment. Use responsibly.

---

*Created with ❤️ and confusion.*
