# 🤪 Drunk Walker (End of the World Finder)

![Build Status](https://github.com/genaforvena/drunk-walker/actions/workflows/ci.yml/badge.svg)
![GitHub release](https://img.shields.io/github/v/release/genaforvena/drunk-walker?label=release)
![License](https://img.shields.io/github/license/genaforvena/drunk-walker)

**[👉 Launch Instantly](https://genaforvena.github.io/drunk-walker/)**

> "The 'direction' isn't a point on a map; it's a constant flight away from the past. The bot is always running away from its own breadcrumbs until it eventually runs out of world to explore."

## What is this?

Drunk Walker is a sandbox experiment in **Blind Graph Traversal**. It’s a bot that lives inside Google Street View, pressing "Up" and "Left" according to a simple set of rules designed to find the edges of the digital world.

It doesn't have a map. It doesn't know where it's going. It only knows where it has been, and it's constantly trying to be somewhere else.

---

## The Three Personas

You can swap the bot's "soul" on the fly using the control panel:

1.  🌍 **EXPLORER (The Expansionist)**:
    Runs away from its own history. It uses a **Weighted Heatmap** to find "cold" areas and rushes into them. If it hits a wall, it does a systematic scan to find a new path.
2.  🏹 **HUNTER (The Topological Sniper)**:
    Heads toward conflict. It looks for **Cul-de-sacs** and dead-ends—places where the digital metadata stops but the world continues. When it finds one, it performs a 180° Snap-Back turn and retreats to find the next one.
3.  🔪 **SURGEON (The Perfectionist)**:
    Hates wasted energy. It uses projection math to "veto" any direction it has already visited, aiming for a perfect **1:1 steps-to-discovery ratio**.

---

## How it works (The Sandbox Logic)

*   **Memory & Scent**: The bot keeps a heatmap of every location it visits and a rolling buffer of its last 20 steps (Breadcrumbs). This creates a "scent" that pushes it toward new territory.
*   **Physical Probing**: The bot is "blind." It doesn't know a road exists until it tries to walk there. Every turn is a physical experiment.
*   **The Drift**: Because we turn by time (ms) rather than degrees, the bot’s internal compass slowly drifts. This adds a layer of stochastic uncertainty, making every walk unique.
*   **Entropy Equilibrium**: Eventually, the entire neighborhood becomes "hot" on the map. At this point, the bot reverts to pure randomness until it accidentally breaks out into a new area. Clearing the cache gives it **Amnesia**, allowing the expansion to start all over again.

---

## Quick Start

1. Go to [Google Maps Street View](https://www.google.com/maps)
2. Enter Street View mode
3. Press **F12** (Console)
4. Visit [genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)
5. Click **COPY LATEST**
6. Paste into console, press Enter
7. Click **START**

---

## Documentation

- **[THE_TRAVERSAL_PROBLEM.md](docs/THE_TRAVERSAL_PROBLEM.md)** — Deep dive into the theory (no BS edition)
- **[ALGORITHM.md](docs/ALGORITHM.md)** — The math behind the three modes
- **[DEVELOPER.md](docs/DEVELOPER.md)** — How to build and test

---

## ⚠️ Note

This is a technical experiment for fun. It is not a tool for mass scraping. Use it to explore the weird edges of digital maps.

**Not affiliated with Google or Google Maps.**

*Created with confused ❤️.*
