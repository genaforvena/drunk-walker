# 🤪 Drunk Walker v6.1.3 (PLEDGE Wall-Following Explorer)

https://github.com/user-attachments/assets/8dc63065-8eb7-427f-b4c4-729473e61dff


![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)
![GitHub release](https://img.shields.io/github/v/release/genaforvena/drunk-walker?label=release)
![License](https://img.shields.io/github/license/genaforvena/drunk-walker)

**[👉 Launch Instantly](https://genaforvena.github.io/drunk-walker/)**

> "The bot doesn't have a map. It learns the labyrinth by walking it—one drift at a time."

## What is this?

Drunk Walker is a sandbox experiment in **Blind Graph Traversal**. It's a bot that lives inside Google Street View, pressing "Up" and "Left" according to simple rules designed to explore every corner of the digital world.

**Key insight:** The bot is blind—it doesn't know where panoramas exist until it tries to walk there. Every movement is physical probing of the graph structure.

---

## 🧭 How It Walks: PLEDGE Algorithm

### The PLEDGE Approach

**PLEDGE** (Parametric Labyrinth Exploration with Drift-Guided Escape) is a wall-following algorithm adapted for Street View's unique geometry.

**Core guarantee:** Each node visited **at most twice**.

### Latest Improvements (v6.1.3)

**Camera Alignment Fix:**
- **Update committed direction on movement** - after turning and moving, always align to actual movement bearing
- Prevents massive realignment turns (e.g., 324° wasted turns)
- Fixed hysteresis that was preventing proper direction updates

**Wall-Follow Loop Detection:**
- **Track revisits during wall-follow** - breaks out after 3+ loop detections
- Prevents infinite cycles in highly connected territories
- Reduces max revisits from 8x to 3-4x per location

**Yaw Optimization:**
- **Removed 5-move scan timer** - eliminated wasteful micro-turns on straight roads
- **Committed direction hysteresis** - prevents oscillation (updates on movement, not just >45° diff)
- **±20° yaw tolerance** (was ±5°) - accepts natural drift
- **40° alignment threshold** (was 60°) - tracks gradual curves proactively

**Expected Impact:**
- Turns per 100 steps: ~40-50 → ~18-35
- Micro-adjustments per 100: ~8-12 → ~0-4
- Visited/Steps ratio: ~0.50 → ~0.55-0.68

**See [docs/WALK_ANALYSIS.md](docs/WALK_ANALYSIS.md) for detailed metrics from real walks.**

### State Machine

```
┌─────────────────────────────────────────────────────────┐
│  PLEDGE STATE MACHINE                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FORWARD MODE:                                          │
│  • Face: prev→cur bearing                               │
│  • Move: Forward into new territory                     │
│  • Check: Cul-de-sac verification at 10+ nodes          │
│                                                         │
│  ↓ (Hit dead end - all yaws tried)                      │
│                                                         │
│  TURN LEFT:                                             │
│  • Turn: 120° LEFT from forward bearing                 │
│  • Face: Left wall, slightly back                       │
│                                                         │
│  ↓                                                      │
│                                                         │
│  WALL-FOLLOW MODE:                                      │
│  • Scan: Left exits (90-180° from forward)              │
│  • Found exit: Take it, resume FORWARD mode             │
│                                                         │
│  ↓ (Truly stuck - no exits found)                       │
│                                                         │
│  BREAK WALL:                                            │
│  • Retry: Random successful yaw                         │
│  • Escape: The dead end                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Forward Bearing

At each new node, calculate direction of travel from previous node:

```javascript
const dLat = currentLat - prevLat;
const dLng = currentLng - prevLng;
const forwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
```

**Why face forward?**
- Google rotates camera at curve points
- Facing forward ensures natural path following
- Prevents misaligned exploration

### Cul-de-Sac Verification

After 10+ straight new nodes, verify it's not a false dead-end:

```
10+ straight new nodes detected
    ↓
Turn to side exit (60-150° from forward)
    ↓
Check for hidden branch
    ↓
Resume forward if clear
```

**Why verify at 10 nodes?**
- Prevents 16+ step false cul-de-sacs
- Catches hidden branches early
- Minimal overhead (1 turn per 10 nodes)

### Wall-Follow Backtracking

When hitting dead end (all 6 yaws tried):

1. **Turn LEFT 120°** from forward bearing
2. **Face left wall**, slightly backward
3. **Scan each node** for left exits (90-180° from forward)
4. **Found exit?** Take it, resume FORWARD mode
5. **No exit?** Continue wall-follow backward

### Break-Wall Escape

When truly stuck (wall-follow found no exits):

1. **Retry random successful yaw** (graph may have changed)
2. **Reset wall-follow state**
3. **Escape the dead end**
4. **Resume FORWARD exploration**

---

## 🗺️ The Six Yaw Buckets

We divide 360° into 6 yaw buckets (0°, 60°, 120°, 180°, 240°, 300°):

| Node Type | Tried Yaws | Action |
|-----------|------------|--------|
| **NEW** | 0-4 | Go straight, face forward bearing |
| **JUNCTION** | 2-4 untried | Potential left exit in wall-follow |
| **DEAD_END** | 6 (all tried) | Turn LEFT 120°, start wall-follow |
| **FULLY_EXPLORED** | 6 (all tried) | Skip in wall-follow scan |

**No true dead ends:** Every node has at least the reverse direction (we came from somewhere!).

---

## 🧠 Why "Drunk"?

The bot wanders without a master plan. Someone called it "Anti-Oedipus" (Deleuze reference about rhizomatic movement). They meant "Anti-Odysseus" (the hero who never gets home).

Turns out both work:
- **Anti-Oedipus** → No central map, just surface traversal
- **Anti-Odysseus** → Never returns home, each node ≤2 visits

It's a nomadic machine that produces the map by walking it.

**See [docs/ANTI-OEDIPUS.md](docs/ANTI-OEDIPUS.md)** for the full (casual) philosophical framing.

---

## 📊 Performance Metrics

| Metric | Formula | Target | Meaning |
|--------|---------|--------|---------|
| **Progress Ratio** | `unique / totalSteps` | > 0.70 | Exploration efficiency |
| **Steps/Location** | `totalSteps / unique` | < 2.0 | Inverse of progress |
| **Node Visits** | `max visits per node` | ≤ 2 | PLEDGE guarantee |

**Real-world performance:**
- 342 unique nodes in ~700 steps (50% efficiency)
- No infinite loops (guaranteed progress)
- Handles yaw drift naturally

---

## Quick Start

### Option 1: Browser Extension (Recommended)

**📦 Download Extension:**
- [Chrome/Edge ZIP](https://github.com/genaforvena/drunk-walker/archive/refs/heads/main.zip) - Extract and load unpacked
- [Firefox ZIP](https://github.com/genaforvena/drunk-walker/archive/refs/heads/main.zip) - Extract and load temporary add-on

**Install Extension from Source:**

1. **Download and extract:**
   ```bash
   git clone https://github.com/genaforvena/drunk-walker.git
   cd drunk-walker
   npm install
   npm run build
   ```

2. **Chrome/Edge:**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle top right)
   - Click **Load unpacked**
   - Select the `extension/` folder

3. **Firefox:**
   - Open `about:debugging#/runtime/this-firefox`
   - Click **Load Temporary Add-on**
   - Select `extension/manifest.json`

4. **Use it:**
   - Open [Google Maps Street View](https://www.google.com/maps)
   - Click the Drunk Walker extension icon
   - Click **START**

### Option 2: Bookmarklet (Console)

1. Go to [Google Maps Street View](https://www.google.com/maps)
2. Enter Street View mode
3. Press **F12** (Console)
4. Visit [genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)
5. Click **COPY LATEST**
6. Paste into console, press Enter
7. Use the **draggable control panel** (grab anywhere to move)

### Controls

- **START/STOP** - Begin or pause exploration
- **Steps** - Total steps taken
- **Visited** - Unique locations discovered
- **Pace** - Speed of decisions (0.5s - 5.0s)
- **💾 Path** - Export walk as JSON
- **📄 Logs** - Export session logs

---

## Documentation

### Core Concepts
- **[HOW_IT_WALKS.md](docs/HOW_IT_WALKS.md)** — **Start here!** PLEDGE algorithm, wall-following, forward bearing
- **[ALGORITHM.md](docs/ALGORITHM.md)** — Technical implementation (engine, wheel, traversal)
- **[THE_TRAVERSAL_PROBLEM.md](docs/THE_TRAVERSAL_PROBLEM.md)** — Theory of blind graph traversal
- **[WALK_ANALYSIS.md](docs/WALK_ANALYSIS.md)** — **New!** Real walk metrics and optimization impact analysis
- **[ANTI-OEDIPUS.md](docs/ANTI-OEDIPUS.md)** — Why "Drunk"? (fun philosophical framing)

### Advanced Topics
- **[SMART_NODES.md](docs/SMART_NODES.md)** — Node classification (NEW, JUNCTION, DEAD_END)
- **[SURGEON_MODE.md](docs/SURGEON_MODE.md)** — Efficiency-focused mode (1:1 steps/visited target)
- **[TRANSITION_GRAPH_LEARNING.md](docs/TRANSITION_GRAPH_LEARNING.md)** — Learning connectivity from walks
- **[src/README.md](src/README.md)** — Developer guide (build, test, deploy)

---

## ⚠️ Note

This is a technical experiment for fun. It is not a tool for mass scraping. Use it to explore the weird edges of digital maps.

**Not affiliated with Google or Google Maps.**

*Created with confused ❤️. The bot explores by following the left wall.*
