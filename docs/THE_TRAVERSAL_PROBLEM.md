# The Traversal Problem: Walking Blind in a Digital World

This project is basically a sandbox for a fun problem: how do you get a bot to walk through Google Street View without it getting stuck in a loop or spinning in a corner? On the surface, it’s just "press up and turn," but the digital world Google built has some weird rules that make this tricky.

---

## 1. The "Blind Graph" Problem
In a normal game or map, the bot knows where the roads are. In Street View, **the bot is blind.** 

The world is just a bunch of 360° bubbles (panoramas). To move, you have to be pointing *almost exactly* at the next bubble. If you're off by a few degrees, the "ArrowUp" does nothing. 
*   **The Hack:** We just guess. We scan the horizon (every 60°) and "project" where we think the next bubble might be. If we hit one, we keep going.

## 2. Dead Reckoning & The "Drift"
We turn the camera by holding "Left" for a few hundred milliseconds. 
*   **The Problem:** Because of browser lag or how Google "smooths" the camera move, holding the key for 600ms doesn't always mean a perfect 60° turn. 
*   **The Drift:** After a while, the bot thinks it's facing North, but the camera is actually pointed at a wall. This "drift" is why the bot's internal map eventually starts lying to it.

## 3. Memory & Pheromones
Nature solved the "looping" problem a long time ago. Ants leave scents (pheromones) so they don't walk in circles.
*   **Heatmap:** Every time the bot visits a spot, it adds a "count" to that location. It prefers walking into "cold" (unvisited) areas.
*   **Breadcrumbs:** We keep track of the last 20 steps. If a turn points back toward where we *just* were, the bot treats it like a bad smell and tries to find a different way.

## 4. Lévy Flights (Dashes and Sniffs)
If you watch a bot move randomly, it just jitters in place. To actually get anywhere, you need a mix:
*   **The Dash:** Run straight for as long as possible (ArrowUp).
*   **The Sniff:** If you hit a wall, stop and do a 360° scan to find a new exit.
*   Combining these is one of the best ways to explore an unknown space without a map.

## 5. The Territory Matters
The roads themselves change the difficulty:
*   **Highways:** The distance between bubbles is huge. The bot might "jump over" a side street because the next bubble is 50 meters away and the intersection was at 25 meters.
*   **Islands:** If a neighborhood only has one entrance (like a bridge), the bot will explore the whole neighborhood until it's "hot" on the map. Then, it might get trapped because the only exit—the bridge—is also "hot," and the bot is programmed to avoid hot areas.

## 6. Hunter Mode & Cul-de-sacs
Sometimes it's fun to actually *find* the dead ends. 
*   **The Signature:** A dead end is a node where only one direction (the way you came) works. 
*   **The Snap-Back:** In Hunter mode, when the bot realizes it's reached a dead end, it marks the spot and does a **180° Snap-Back turn** to run away and find the next one.

## 7. Surgeon Mode & Efficiency
If Explorer is a forager and Hunter is a sniper, the **Surgeon** is a perfectionist.
*   **The Goal:** A perfect **1:1 steps-to-discovery ratio**.
*   **The Veto:** The Surgeon uses projection math to "see" if a turn points toward a spot it already visited. If it does, the Surgeon **vetoes** the move and keeps scanning until it finds a clean node.

---

## 8. The Probing Dilemma: Steps vs. Discovery
Wait, we missed something important: the bot can't actually "see" nodes. It only knows a node exists **after it tries to move there.** 

This means our "360° Scan" isn't just looking around—it’s **Physical Probing.** Every time we turn 60° and press "Up," we are performing a physical experiment. 

### The Ratio Killer: "Ghost Steps"
If the goal is the best **Steps/Visited ratio**, every "Up" press that doesn't move the URL is a disaster. 
*   **The Scenario:** You’re at a T-junction. You scan 6 directions (60° each). You press "Up" 6 times.
*   **The Result:** 4 times you hit a "virtual wall" (no node there). 2 times you successfully move. 
*   **The Math:** You spent 6 steps to find 2 nodes. Your ratio is 3:1.

### How to win the Ratio Game?
To get closer to a 1:1 ratio, the bot has to become a **Better Guesser.**
1.  **Stop Probing "Hot" Zones:** This is exactly what **Surgeon Mode** does. It refuses to probe directions that projection math identifies as already visited.
2.  **The "Probability" Map:** Instead of scanning every direction, the bot should prioritize directions that "look" like a road.
3.  **Entropy Equilibrium:** Eventually, the entire neighborhood becomes "hot" on the map. At this point, even the Surgeon starts to fail because there are no "clean" directions left to probe.

---

**Basically, the "Drunk Walker" is just a way to see how a simple set of rules (avoid the past, run straight, turn when stuck) handles the messy, inconsistent metadata of the real world.**
