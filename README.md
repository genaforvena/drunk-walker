# 🤪 Drunk Walker v6.5.0 (Drift-Walk Labyrinth Explorer)

![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)
![GitHub release](https://img.shields.io/github/v/release/genaforvena/drunk-walker?label=release)
![License](https://img.shields.io/github/license/genaforvena/drunk-walker)

**[👉 Launch Instantly](https://genaforvena.github.io/drunk-walker/)**

> "The bot doesn't have a map. It learns the labyrinth by walking it—one drift at a time."

## What is this?

Drunk Walker is a sandbox experiment in **Blind Graph Traversal**. It's a bot that lives inside Google Street View, pressing "Up" and "Left" according to simple rules designed to explore every corner of the digital world.

**Key insight:** The bot is blind—it doesn't know where panoramas exist until it tries to walk there. Every movement is physical probing of the graph structure.

---

## 🧭 How It Walks: The Drift-Walk Model

### The Problem

Google Street View is a **graph of 360° panoramas** connected by invisible edges. To move:
1. You must be pointing **almost exactly** at the next panorama
2. Press `ArrowUp` to "walk" in that direction
3. If misaligned, nothing happens (virtual wall)

### The Drift Solution

We turn by **holding keys for milliseconds**, not by specifying degrees:
- Hold "Left" for 600ms → expect 60° turn → get 57° or 63°
- Browser lag, network latency, camera smoothing cause **accumulated drift**
- After 20 turns: bot thinks it's at 90°, actually at 78° or 103°

### Embracing Drift: The Cone Model

```
        Failed buckets (blocked)
        ↓
    ╭────┼────╮
    │  \ | /  │
    │   \|/   │ ← Successful exit at 90°
A → ●────→────→ B
    │   /|\   │
    │  / | \  │
    ╰────┼────╯
        ↑
   "Drift cone" - we know this angular range is passable
```

**Key insight:** When we walk A→B at yaw 90°, we validate the 90° bucket **plus drift tolerance** (±15-20°). This becomes **learned connectivity**.

---

## 🗺️ The Six Buckets

We divide 360° into 6 yaw buckets (0°, 60°, 120°, 180°, 240°, 300°):

| Node Type | Exits | Yaw Pattern | Behavior |
|-----------|-------|-------------|----------|
| **STRAIGHT** | 2 | ~180° apart | Skip during backtrack |
| **CROSSROAD** | 3+ | Multiple | STOP and explore! |
| **DEAD_END** | 1 | Entry only | Escape via reverse yaw |

**No true dead ends:** Every node has at least the reverse direction (we came from somewhere!).

---

## 🔄 Exploration Flow

### Forward Pass (New Territory)
```
A → B → C → D
  Try untried buckets at each node
  Record successful exits in graph
```

### Dead End → Backtrack
```
A → B → C → D (all buckets failed)
    ↓
   unexplored at B

Backtrack:
1. D → C (check untried? no) → B
2. B has untried bucket? → ONE exploration turn
3. If new area → explore! If dead-end → continue to A
```

### One-Turn Rule
During backtrack: **exactly ONE turn per visited node**
- Prevents infinite loops
- Ensures systematic exploration
- Respects drift-walk geometry

---

## 🎮 Modes

The bot adapts its strategy based on context:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **FORWARD** | New node, untried buckets | Try next untried yaw |
| **PANIC** | Stuck ≥3 heartbeats | Retry successful exits, then reverse entry yaw |
| **RETURN** | Backtracking from dead end | Check each node for untried buckets |

---

## 📊 Performance Metrics

| Metric | Formula | Target | Meaning |
|--------|---------|--------|---------|
| **Progress Ratio** | `unique / totalSteps` | > 0.70 | Exploration efficiency |
| **Steps/Location** | `totalSteps / unique` | < 2.0 | Inverse of progress |
| **Coverage** | `visited / totalInArea` | 1.0 | Complete exploration |

---

## Quick Start

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
- **[HOW_IT_WALKS.md](docs/HOW_IT_WALKS.md)** — **Start here!** Drift-walk mechanics, bucket system, exploration flow
- **[THE_TRAVERSAL_PROBLEM.md](docs/THE_TRAVERSAL_PROBLEM.md)** — Theory of blind graph traversal
- **[ALGORITHM.md](docs/ALGORITHM.md)** — Technical implementation (engine, wheel, traversal)

### Advanced Topics
- **[SMART_NODES.md](docs/SMART_NODES.md)** — Node classification (STRAIGHT, CROSSROAD, DEAD_END)
- **[SURGEON_MODE.md](docs/SURGEON_MODE.md)** — Efficiency-focused mode (1:1 steps/visited target)
- **[TRANSITION_GRAPH_LEARNING.md](docs/TRANSITION_GRAPH_LEARNING.md)** — Learning connectivity from walks
- **[src/README.md](src/README.md)** — Developer guide (build, test, deploy)

---

## ⚠️ Note

This is a technical experiment for fun. It is not a tool for mass scraping. Use it to explore the weird edges of digital maps.

**Not affiliated with Google or Google Maps.**

*Created with confused ❤️. The bot is always running away from its own breadcrumbs.*
