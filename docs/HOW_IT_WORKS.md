# How Drunk Walker Works (v4.2.0-EXP)

## The Core Concept: Physical Probing

Drunk Walker generates **street-level navigability data** by simulating a "blind" agent that probes the world using simple physical rules. It doesn't have a map; it only knows where it is *after* it successfully moves.

### Primary Measurements

| Data Point | What It Represents |
|------------|-------------------|
| **Heatmap** | Frequency of visits to specific coordinates (Map-based) |
| **Breadcrumbs**| Rolling scent of the last 20 steps to prevent loops |
| **Physical Steps**| Number of `ArrowUp` probes made |
| **Stuck Events**| Points where the digital world (metadata) stops |
| **Orientation**| The bot's internal compass (`yaw`), which drifts over time |

---

## The Architecture: Decoupled Logic

Drunk Walker uses a modular system to separate the "body" from the "soul":

1.  **The Engine (`engine.js`)**: The "heart." Manages the tick rate, state (steps, memory), and ensures `ArrowUp` is pressed on every tick.
2.  **The Wheel (`wheel.js`)**: The "legs." Manages orientation and handles the mechanical constraint of turning (holding `ArrowLeft`).
3.  **The Traversal (`traversal.js`)**: The "brain." Pluggable algorithms that decide whether to turn or move based on the persona.

---

## The Three Personas

### 🌍 EXPLORER (The Expansionist)
- **Goal**: Find unvisited territory.
- **Logic**: Scans 360° every 60°. It projekts the next coordinate for each direction and calculates a score based on the **Heatmap** and **Breadcrumbs**.
- **Bias**: Prefers "cold" (unvisited) areas.

### 🏹 HUNTER (The Topological Sniper)
- **Goal**: Find dead-ends (Cul-de-sacs).
- **Logic**: Specifically seeks nodes with only one exit.
- **Recovery**: When a dead-end is confirmed, it performs a **180° Snap-Back** turn to retreat.

### 🔪 SURGEON (The Perfectionist)
- **Goal**: Maximize efficiency (1:1 steps-to-discovery ratio).
- **Logic**: Uses projection math to **veto** any direction it has already visited. It refuses to probe "hot" zones.

---

## Sandbox Physics & "The Drift"

Because we turn the camera by holding a key for a specific duration (ms) rather than setting a precise degree:
- **Lag & Easing**: Browser lag and Google's camera smoothing mean a 600ms turn isn't *always* 60°.
- **Drift**: This creates a slow, stochastic "drift" where the bot’s internal map eventually stops matching the camera facing.
- **Outcome**: This "noise" is actually beneficial—it prevents the bot from getting caught in mathematically perfect infinite loops.

---

## Performance

| Metric | Value |
|--------|-------|
| Steps per hour | ~1,800 (at 2s pace) |
| Memory usage | ~5-10 MB (Map-based heatmap) |
| Coverage | 5-10x better than random walk (Surgeon mode) |

---

## See Also

- [ALGORITHM.md](ALGORITHM.md) — Technical math behind the scans
- [VERSIONS.md](VERSIONS.md) — Version history
- [THE_TRAVERSAL_PROBLEM.md](THE_TRAVERSAL_PROBLEM.md) — Theoretical deep dive
- [src/README.md](../src/README.md) — How to build and extend
