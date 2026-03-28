# 🤪 Drunk Walker

> ### A bot that walks forever through Google Street View
> 
> It doesn't know where it's going. It just knows it has to keep moving.
> Never backtracking. Never arriving. Always forward into the unknown,
> one street at a time, until the world runs out.

[![Release](https://img.shields.io/github/v/release/genaforvena/drunk-walker?label=release)](https://github.com/genaforvena/drunk-walker/releases/latest)
[![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)](https://github.com/genaforvena/drunk-walker/actions)
[![License](https://img.shields.io/github/license/genaforvena/drunk-walker)](LICENSE)

**[📦 Download Extension](https://github.com/genaforvena/drunk-walker/releases/latest)** • **[👉 Web Demo](https://genaforvena.github.io/drunk-walker/)** • **[🎨 Visual Simulation](https://claude.ai/public/artifacts/7e23ea9e-5108-4fd6-abe0-b6c0c4aa80e7)**

---

## What Is This?

Drunk Walker is a **blind graph traversal** experiment living inside Google Street View. It presses keyboard arrows according to the **PLEDGE algorithm** (Parametric Labyrinth Exploration with Drift-Guided Escape), exploring the digital world without a map.

**The bot is blind** — it doesn't know where panoramas exist until it tries to walk there. Every movement is physical probing of the graph structure. It produces the map by walking it.

![Drunk Walker in action](https://github.com/user-attachments/assets/8dc63065-8eb7-427f-b4c4-729473e61dff)

---

## Quick Start

### Option 1: Browser Extension (Recommended)

| Browser | Download |
|---------|----------|
| **Chrome/Edge/Brave** | [drunk-walker-chrome.zip](https://github.com/genaforvena/drunk-walker/releases/download/v6.1.4/drunk-walker-chrome.zip) (32 KB) |
| **Firefox** | [drunk-walker-firefox.zip](https://github.com/genaforvena/drunk-walker/releases/download/v6.1.4/drunk-walker-firefox.zip) (32 KB) |

**Install (Chrome/Edge):**
1. Download and extract the ZIP
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"** → select extracted folder
5. Open [Google Maps](https://www.google.com/maps) → Street View → click extension icon 🤪

**Install (Firefox):**
1. Download and extract the ZIP
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on"** → select `manifest.json`
4. Extension loads until Firefox restarts

### Option 2: Bookmarklet (Console)

1. Visit [genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)
2. Click **"COPY BOOKMARKLET"**
3. Open Google Maps Street View
4. Press `F12` → Console tab → paste and press Enter
5. Control panel appears → click **START**

---

## How It Walks

### PLEDGE Algorithm

The bot uses wall-following to guarantee exploration with each location visited **at most twice**:

```
┌─────────────────────────────────────────────────────────┐
│  FORWARD MODE                                           │
│  • Face direction of travel (prev→cur bearing)          │
│  • Move straight into new territory                     │
│  ↓ (All 6 yaws tried - dead end)                        │
│  TURN LEFT 120°                                         │
│  ↓                                                      │
│  WALL-FOLLOW MODE                                       │
│  • Scan for LEFT exits (90-180° from forward)           │
│  • Found exit → take it, resume FORWARD                 │
│  ↓ (Truly stuck)                                        │
│  BREAK WALL                                             │
│  • Retry successful yaw from graph memory               │
└─────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Concept | Description |
|---------|-------------|
| **6 Yaw Buckets** | Street View divides 360° into: 0°, 60°, 120°, 180°, 240°, 300° |
| **Forward Bearing** | Always face direction of travel (prev→cur) |
| **Cul-de-Sac Check** | After 10+ straight nodes, verify not a false dead-end |
| **Graph Memory** | Records every successful movement for escape routes |

### Performance

| Metric | Target | Real-World |
|--------|--------|------------|
| Progress Ratio (unique/steps) | > 0.70 | ~0.55-0.68 |
| Steps per Location | < 2.0 | ~1.5-1.8 |
| Max Revisits | ≤ 2 | ✅ Guaranteed |

**Example:** 342 unique nodes in ~700 steps (50% efficiency, no infinite loops)

---

## Why "Drunk"?

The bot wanders without a master plan. Someone called it "Anti-Oedipus" (Deleuze reference about rhizomatic movement). They meant "Anti-Odysseus" (the hero who never gets home).

Turns out both work:
- **Anti-Oedipus** → No central map, just surface traversal
- **Anti-Odysseus** → Never returns home, each node ≤2 visits

It's a nomadic machine that produces the map by walking it.

📖 **[Read the philosophical framing →](docs/ANTI-OEDIPUS.md)**

---

## Documentation

### Getting Started
- **[HOW_IT_WALKS.md](docs/HOW_IT_WALKS.md)** — PLEDGE algorithm deep-dive
- **[WALK_ANALYSIS.md](docs/WALK_ANALYSIS.md)** — Real walk metrics and optimization

### Technical
- **[ALGORITHM.md](docs/ALGORITHM.md)** — API reference (engine, wheel, traversal)
- **[THE_TRAVERSAL_PROBLEM.md](docs/THE_TRAVERSAL_PROBLEM.md)** — Theory of blind graph traversal
- **[src/README.md](src/README.md)** — Developer guide (build, test, deploy)

### Advanced
- **[SMART_NODES.md](docs/SMART_NODES.md)** — Node classification (NEW, JUNCTION, DEAD_END)
- **[SURGEON_MODE.md](docs/SURGEON_MODE.md)** — Efficiency-focused mode
- **[TRANSITION_GRAPH_LEARNING.md](docs/TRANSITION_GRAPH_LEARNING.md)** — Learning connectivity

---

## Build from Source

```bash
git clone https://github.com/genaforvena/drunk-walker.git
cd drunk-walker
npm install
npm run build        # Generates bookmarklet.js + extension bundle
npm run extension:package  # Creates ZIP files for release
npm test             # Run 150+ tests
```

---

## Controls

| Control | Action |
|---------|--------|
| **START/STOP** | Begin or pause exploration |
| **Steps** | Total movements made |
| **Visited** | Unique locations discovered |
| **Pace** | Decision speed (0.5s - 5.0s) |
| **💾 Path** | Export walk as JSON |
| **📄 Logs** | Export session logs |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not showing | Ensure you're on `google.com/maps` in Street View mode |
| Not starting | Refresh page, check console (F12) for errors |
| Panel not visible | Resize browser window, try STOP → START |
| Firefox add-on missing | Reload from `about:debugging` after browser restart |

---

## Privacy & Legal

- ✅ Runs entirely in your browser
- ✅ No data sent to external servers
- ✅ No cookies or tracking
- ✅ Open source (MIT license)

**Not affiliated with Google or Google Maps.** This is a technical experiment for fun, not a scraping tool.

---

## Version History

| Version | Changes |
|---------|---------|
| **v6.1.4** | Browser extension release, camera alignment fix, loop detection |
| **v6.1.0** | PLEDGE wall-following implementation |
| **v5.1.0** | Smart nodes, enhanced transition graph |

[View all releases →](https://github.com/genaforvena/drunk-walker/releases)

---

<div align="center">

**[📦 Download Extension](https://github.com/genaforvena/drunk-walker/releases/latest)** • **[👉 Web Demo](https://genaforvena.github.io/drunk-walker/)** • **[🎨 Visual Simulation](https://claude.ai/public/artifacts/7e23ea9e-5108-4fd6-abe0-b6c0c4aa80e7)**

*Created with confused ❤️. The bot explores by following the left wall.*

</div>
