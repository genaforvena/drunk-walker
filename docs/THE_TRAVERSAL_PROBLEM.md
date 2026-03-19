# The Traversal Problem: Walking Blind in a Digital World

So, you've built a bot that walks through Google Street View. On the surface, it sounds simple: "just press up and turn occasionally." But as we've discovered, this is actually a deep, classic problem in computer science and robotics. 

Here is a breakdown of what makes this so tricky, what the "known" problems are, and why our "Drunk Walker" is more sophisticated than it looks.

---

## 1. The "Blind Graph" Problem
In most algorithms (like A* or BFS), you have a map. You know where the roads are. In Street View, **the bot is blind.** 

The world isn't a continuous grid; it's a **Sparse Geometric Graph**. Nodes (panoramas) only exist where the Google car actually drove. To move from Point A to Point B, your camera must be pointed *almost exactly* at Point B. If you're off by 5 degrees, the "ArrowUp" might do nothing.

*   **The Challenge:** How do you find an exit you can't see?
*   **Our Solution:** Probabilistic sampling. We scan the horizon (currently every 60°) and "guess" where the next node might be using projection math.

## 2. Dead Reckoning & The "Drift"
In the old days of sailing, "Dead Reckoning" was how sailors estimated their position based on their last known spot, their speed, and their heading.

*   **The Problem:** If your compass is off by 1% every time you turn, after 100 turns, you're facing the complete wrong way. 
*   **The "Drift":** Because we turn by holding a key for a duration (e.g., 600ms for 60°), browser lag and easing effects mean we never turn *exactly* 60°. Over time, the bot’s internal "mental map" (the Yaw) drifts away from the actual camera facing.
*   **The Result:** The Heatmap starts thinking we're walking North into a "cold" area, while the camera is actually walking West into a "hot" area.

## 3. The Exploration-Exploitation Trade-off
This is a classic "Multi-Armed Bandit" problem from Reinforcement Learning.

*   **Exploitation:** Following a known path (the big highway). It's easy and fast.
*   **Exploration:** Turning off into a random side street. It's risky and you might get stuck.
*   **The Trap:** If you prioritize exploration too much, you get stuck in "corners" (Local Optima) because you refuse to walk back through a "visited" area to find a new exit. You end up trapped in a neighborhood because the only way out is a road you've already seen.

## 4. Ant Trails & Pheromones
Nature solved the "looping" problem millions of years ago. Ants leave pheromone trails. If an ant smells a strong trail, it knows "I've been here too much" and tries a different path.

*   **Our Breadcrumbs:** We keep a list of the last 20 locations. This is our "scent." By penalizing directions that point toward our recent trail, we stop the bot from oscillating back and forth on the same street.

## 5. Lévy Flights vs. Brownian Motion
If you watch a dust mote in a sunbeam, it moves totally randomly (Brownian Motion). It never gets anywhere. If you watch a shark hunting or a bee foraging, they use **Lévy Flights**.

*   **The Pattern:** Long, straight "dashes" followed by clusters of intense, short-distance "sniffing."
*   **Our Version:** Our "Always ArrowUp" is the dash. Our "Systematic Search" (turning 60°, 120°, 180° when stuck) is the intense sniffing. This mix is mathematically proven to be one of the best ways to search an unknown territory.

---

## Why the "Drunk Walker" approach works
By combining a **Weighted Heatmap** (long-term memory) with **Breadcrumbs** (short-term scent) and **Systematic Search** (recovery), we are essentially building a "Self-Avoiding Correlated Random Walk." 

It’s not just a bot pressing keys; it’s a probabilistic agent trying to solve a hidden graph under conditions of high uncertainty and sensor drift. 

## 6. The Territory: High-Speed Traps and Urban Islands
The algorithm doesn't live in a vacuum; it lives on the roads Google chose to drive. The specific "territory" changes the rules of the game.

### The "Highway Effect" (Node Density)
In Street View, nodes aren't spaced evenly. On a highway, you might jump 50 meters in one click. In a city, it's 5 meters. 
*   **The Problem:** Our prediction math uses a fixed "step distance." If we overleap a side street because the nodes are too far apart, we'll never "see" the intersection. The highway becomes a "river" that is very hard to jump out of.

### The "Island" Problem (Topology)
Imagine a neighborhood connected to the main city by a single bridge. 
*   **The Trap:** The bot enters the neighborhood, explores it, and turns the whole area "hot" on the Heatmap. To leave, it must cross the bridge—but the bridge is also "hot." 
*   **The Loop:** Because the bot is programmed to avoid hot areas, it might avoid the only exit (the bridge) and stay trapped in the neighborhood forever, searching for a "colder" exit that doesn't exist.

### Urban Canyons & The "Click"
In narrow streets, the geometry of the "sphere" we are standing in is warped. 
*   **The Problem:** Clicking slightly off-center (to the bottom-left) might work perfectly on a wide road to "hug" the lane, but in a narrow alley, that same click might hit a wall or a parked car's metadata, resulting in no movement. The territory redefines what our coordinates actually do.

---

**Next time you see the Walker spinning on a bridge, remember: it might be experiencing a "Topological Trap" where its own memory is preventing its escape!**
