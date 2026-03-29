# 🤪 Drunk Walker

> ### A bot that walks forever through Google Street View
>
> It doesn't know where it's going. It just knows it has to keep moving.
> Never backtracking. Never arriving. Always forward into the unknown,
> one street at a time, until the world runs out.

[![Release](https://img.shields.io/github/v/release/genaforvena/drunk-walker?label=release)](https://github.com/genaforvena/drunk-walker/releases/latest)
[![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)](https://github.com/genaforvena/drunk-walker/actions)
[![License](https://img.shields.io/badge/license-CC0-blue)](LICENSE)

**[📦 Download Extension](https://github.com/genaforvena/drunk-walker/releases/latest)** • **[👉 Web Demo](https://genaforvena.github.io/drunk-walker/)**

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
| **Chrome/Edge/Brave** | [drunk-walker-chrome.zip](https://github.com/genaforvena/drunk-walker/releases/download/v6.1.5/drunk-walker-chrome.zip) (32 KB) |
| **Firefox** | [drunk-walker-firefox.zip](https://github.com/genaforvena/drunk-walker/releases/download/v6.1.5/drunk-walker-firefox.zip) (32 KB) |

**Install (Chrome/Edge):**
1. Download and extract the ZIP
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"** → select extracted folder
5. Open [Google Maps](https://www.google.com/maps) → Street View → click extension icon 🤪

**Install (Firefox):**
1. Download the **Firefox ZIP** (orange button) - NOT the Chrome ZIP
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on"**
4. Navigate to the **extracted folder** and select `manifest.json`
5. Extension loads until Firefox restarts

**⚠️ Firefox Troubleshooting:**
- If you get "Extension is invalid" error: Delete the extracted folder, **re-download the Firefox ZIP**, extract again, and try loading `manifest.json` again
- Make sure you're loading from the **Firefox ZIP folder**, not Chrome ZIP folder

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
│  TURN LEFT 105°                                         │
│  ↓                                                      │
│  WALL-FOLLOW MODE                                       │
│  • Scan for LEFT exits (90-180° from forward)           │
│  • Found exit → take it, resume FORWARD                 │
│  ↓ (Truly stuck or loop detected)                       │
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
| **Loop Detection** | Tracks nodes visited during wall-follow to escape cycles |

### Performance

| Metric | Target | Real-World (v6.1.5) |
|--------|--------|---------------------|
| Progress Ratio (unique/steps) | > 0.55 | **0.48** (149/309) |
| Steps per Location | < 2.0 | **2.07** |
| Max Revisits | ≤ 2 | ⚠️ 11 (wall-follow loop bug documented) |

**Latest walk:** 149 unique locations in 309 steps. Wall-follow loop bug identified and fix documented in WALK_REPORTS.md.

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
- **[WALK_REPORTS.md](docs/WALK_REPORTS.md)** — Walk analysis and fix documentation

### Technical
- **[ALGORITHM.md](docs/ALGORITHM.md)** — API reference (engine, wheel, traversal)
- **[THE_TRAVERSAL_PROBLEM.md](docs/THE_TRAVERSAL_PROBLEM.md)** — Theory of blind graph traversal
- **[src/README.md](src/README.md)** — Developer guide (build, test, deploy)

### Advanced
- **[SMART_NODES.md](docs/SMART_NODES.md)** — Node classification (NEW, JUNCTION, DEAD_END)
- **[WALK_DRIVEN_DEVELOPMENT.md](docs/WALK_DRIVEN_DEVELOPMENT.md)** — Walk-driven development workflow

### Philosophy
- **[ANTI-OEDIPUS.md](docs/ANTI-OEDIPUS.md)** — Philosophical framing (Deleuze, nomadic machines)

---

## Build from Source

```bash
git clone https://github.com/genaforvena/drunk-walker.git
cd drunk-walker
npm install
npm run build        # Generates bookmarklet.js + extension folders
npm test             # Run 162+ tests
```

**Build output:**
- `bookmarklet.js` - Browser console version
- `extension-chrome/` - Chrome/Edge/Brave extension (uses `service_worker`)
- `extension-firefox/` - Firefox extension (uses `scripts` array)

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
| Firefox: "Extension is invalid" | **Make sure you downloaded the Firefox ZIP**, not Chrome. Extract and load `manifest.json` from `drunk-walker-firefox/` folder |
| Firefox: Still getting error | Clear Firefox cache, restart browser, try loading from `about:debugging` again |

---

## Privacy & Legal

- ✅ Runs entirely in your browser
- ✅ No data sent to external servers
- ✅ No cookies or tracking
- ✅ Public domain (CC0)

**Not affiliated with Google or Google Maps.** This is a technical experiment for fun, not a scraping tool.

---

## Version History

| Version | Changes |
|---------|---------|
| **v6.1.5** | Dual browser manifests (Chrome/Firefox), gh.io extension folders, mandatory release checklist |
| **v6.1.4** | Territory Oracle, walk-driven development, wall-follow loop detection documented |
| **v6.1.0** | PLEDGE wall-following implementation |
| **v5.1.0** | Smart nodes, enhanced transition graph |

[View all releases →](https://github.com/genaforvena/drunk-walker/releases)

---

<div align="center">

**[📦 Download Extension](https://github.com/genaforvena/drunk-walker/releases/latest)** • **[👉 Web Demo](https://genaforvena.github.io/drunk-walker/)**

*Created with confused ❤️. The bot explores by following the left wall.*

</div>
