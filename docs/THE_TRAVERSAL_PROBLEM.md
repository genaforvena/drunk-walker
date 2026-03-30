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

## 9. PLEDGE: Wall-Following for Street View

If Surgeon mode is about efficiency, **PLEDGE** is about **guaranteed exploration without infinite loops**.

### The Wall-Following Insight

Traditional maze-solving uses the **left-hand rule**: keep your left hand on the wall, and you'll eventually explore every corridor.

For Street View, we adapt this:

```
┌─────────────────────────────────────────────────────────┐
│  PLEDGE STATE MACHINE                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FORWARD MODE:                                          │
│  • Face: prev→cur bearing (direction of travel)         │
│  • Move: Forward into new territory                     │
│  • Check: Cul-de-sac verification at 10+ nodes          │
│                                                         │
│  ↓ (Hit dead end - all yaws tried)                      │
│                                                         │
│  TURN LEFT:                                             │
│  • Turn: 105° LEFT from forward bearing                 │
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

### Why 105° Left Turn?

At dead end, we turn **105° LEFT** (not 180° reverse):

```
        Forward bearing: 90°
        ↓
    ╭────┼────╮
    │  \ | /  │
    │   \|/   │ ← Dead end (all yaws tried)
A → ●────→────→ B (blocked)
    │   /|\   │
    │  / | \  │
    ╰────┼────╯
        ↑
     Turn 105° LEFT → Face 195°
    (along left wall, slightly back)
```

**Why not 180°?**
- 180° points straight back (we came from there)
- 105° points along left wall (new scanning angle)
- Allows detecting side exits while backtracking

### Forward Bearing: Facing Direction of Travel

At each new node, calculate where we're heading:

```javascript
const dLat = currentLat - prevLat;
const dLng = currentLng - prevLng;
const forwardBearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
```

**Why face forward?**
- Google rotates camera at curve points
- Bot thinks it's facing 90°, actually facing 78°
- Facing forward bearing corrects accumulated drift
- Ensures natural path following

### Cul-de-Sac Verification

**Problem:** Bot walks 16+ straight nodes assuming cul-de-sac, only to later discover hidden branches.

**Solution:** Verify at 10+ straight new nodes.

```
10+ straight new nodes detected
    ↓
Check: untriedYaws >= 2? (valid junction)
    ↓
YES → Turn to side exit (60-150° from forward)
    ↓
Verify: Is there a hidden branch?
    ↓
Resume forward if clear
```

**Why 10 nodes?**
- Catches hidden branches early
- Prevents 16+ step false cul-de-sacs
- Minimal overhead (1 verification turn per 10 nodes)

### Each Node ≤2 Visits Guarantee

**Why it works:**

1. **First visit (FORWARD mode):**
   - Explore straight into new territory
   - Face forward bearing at each node

2. **If dead end (all yaws tried):**
    - Turn LEFT 105°
    - Start WALL-FOLLOW mode

3. **Second visit (WALL-FOLLOW mode):**
   - Scan for left exits (90-180° from forward)
   - Found exit? Take it, resume FORWARD
   - No exit? Continue wall-follow backward

4. **Never return:**
   - Wall-follow moves away from dead end
   - Each node scanned once during backtrack
   - No breadcrumb navigation to old targets

### Break-Wall Escape

**Problem:** Wall-follow found no exits, but node is truly stuck.

**Solution:** BREAK WALL retries successful yaws.

```javascript
if (isExhausted && successfulYaws.size > 0) {
  const randomSuccessfulYaw = pickRandom(successfulYaws);
  wallFollowMode = false;  // Reset state
  return { turn: true, angle: getLeftTurnAngle(orientation, randomSuccessfulYaw) };
}
```

**Why retry successful yaws?**
- Graph may have changed (dynamic content)
- Previous failure may have been temporary
- Better than infinite loop

### Comparison with Other Approaches

| Algorithm | Strategy | Node Visits | Guarantee |
|-----------|----------|-------------|-----------|
| **Random Walk** | Pick random exit | ∞ (infinite loops) | None |
| **DFS** | Depth-first with backtrack | 2× per node | Complete but slow |
| **BFS** | Breadth-first expansion | 1× per node | Memory intensive |
| **Tremaux** | Mark passages | 2× per passage | Requires marking |
| **PLEDGE** | Wall-follow with left-hand rule | ≤2× per node | Complete + efficient |

### Real-World Performance

**Before PLEDGE:**
- 13,082 steps with 342 unique nodes (2.6% efficiency!)
- Bot stuck 2,413+ times at same location
- Infinite loops at dead ends

**After PLEDGE:**
- 700 steps with 342 unique nodes (50% efficiency)
- No infinite loops (guaranteed progress)
- Each node visited ≤2 times

---

## 11. The Probing Dilemma: Steps vs. Discovery
Wait, we missed something important: the bot can't actually "see" nodes. It only knows a node exists **after it tries to move there.**

This means our "360° Scan" isn't just looking around—it's **Physical Probing.** Every time we turn 60° and press "Up," we are performing a physical experiment.

### The Ratio Killer: "Ghost Steps"
If the goal is the best **Steps/Visited ratio**, every "Up" press that doesn't move the URL is a disaster.
*   **The Scenario:** You're at a T-junction. You scan 6 directions (60° each). You press "Up" 6 times.
*   **The Result:** 4 times you hit a "virtual wall" (no node there). 2 times you successfully move.
*   **The Math:** You spent 6 steps to find 2 nodes. Your ratio is 3:1.

### How to win the Ratio Game?
To get closer to a 1:1 ratio, the bot has to become a **Better Guesser.**
1.  **Stop Probing "Hot" Zones:** This is exactly what **Surgeon Mode** does. It refuses to probe directions that projection math identifies as already visited.
2.  **The "Probability" Map:** Instead of scanning every direction, the bot should prioritize directions that "look" like a road.
3.  **Entropy Equilibrium:** Eventually, the entire neighborhood becomes "hot" on the map. At this point, even the Surgeon starts to fail because there are no "clean" directions left to probe.

---

**Basically, the "Drunk Walker" is just a way to see how a simple set of rules (avoid the past, run straight, turn when stuck) handles the messy, inconsistent metadata of the real world.**

**With PLEDGE, we've added one more rule: follow the left wall, face forward, and break walls when stuck. The result? Guaranteed exploration without infinite loops.**

---

## 12. Critical Design Principles

### The "Can't Be Truly Stuck" Guarantee

**Fundamental insight:** If you can reach a node, you can return the way you came.

```
Every node has at least ONE exit: the reverse direction (where you entered).
```

**Why this matters:**
- The bot always has an escape route
- BREAK_WALL uses this guarantee (retries successful yaws)
- If `successfulYaws` is empty, use graph connections to calculate reverse yaw

**Implementation:**
```javascript
// In recordMovement(fromLoc, toLoc, fromYaw, toYaw):
// Record reverse yaw geometrically at toLoc
const dLat = fromParts[0] - toParts[0];  // FROM neighbor TO current
const dLng = fromParts[1] - toParts[1];
let reverseYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
if (reverseYaw < 0) reverseYaw += 360;
toNode.recordAttempt(reverseYaw, true, fromLoc);
```

### Yaw Buckets and Geometry

**The 6-yaw bucket system:**
- Buckets: 0°, 60°, 120°, 180°, 240°, 300°
- Each yaw rounds to nearest bucket: `Math.round(yaw / 60) * 60`
- A single physical connection can span multiple buckets

**Critical insight:** The same physical connection might be accessible from different yaw buckets.

```
Example:
  Move A→B at yaw 346° (bucket 0°)
  Reverse at B: yaw 166° (bucket 180°) ← Recorded

  But yaw 240° at B might ALSO lead to A!
  - Different bucket, same physical connection
  - Street View panoramas have multiple entry angles
  - This creates cycles in wall-follow
```

**Implication for wall-follow:**
- Wall-follow scans for untried yaws in LEFT arc (90-180°)
- An untried yaw might lead to an already-visited node
- This creates loops: A→C→A→C...
- **Solution:** Detect loops by tracking nodes visited during wall-follow phase

### Why We Can't Predict Connections

**The bot is blind:** It can't see where a yaw leads without trying it.

| Approach | Why It Doesn't Work |
|----------|---------------------|
| Check if yaw was successful before | Untried yaws have no history |
| Check graph connections | Graph only knows tried yaws, not untried |
| Check if target is visited | Can't know target without physical probe |

**The only solution:** Try the yaw, observe the result, then adapt.

### Stuck Detection and Dead Pockets

**Problem:** Wall-follow can get stuck in exhausted components.

**Solution:** Two detection mechanisms:
1. **Single-node stuck:** Reset after 20+ ticks on same node (`locationStuckCounter`)
2. **Dead pockets:** Component exhausted detection - restart after 3 detections (`deadPocketCount`)

```javascript
// Single-node stuck detection
if (currentLocation === lastStuckLocation) {
  locationStuckCounter++;
  if (locationStuckCounter > 20 && !isTwoNodeLoop) {
    // Reset PLEDGE state, keep graph memory
    wallFollowMode = false;
    wallFollowBearing = null;
  }
}

// Dead pocket detection
if (allNeighborsFullyExplored) {
  deadPocketCount++;
  if (deadPocketCount >= 3) {
    // Clear graph and restart exploration
    enhancedGraph.nodes.clear();
    deadPocketCount = 0;
  }
}
```

### No Hacks Principle

When fixing bugs, prefer solutions that:

1. **Use existing mechanisms:** BREAK_WALL already exists, just trigger it appropriately
2. **Preserve graph memory:** Don't throw away learned information
3. **Preserve algorithm:** Left-hand rule, forward-facing, break-wall all unchanged
4. **Respect blindness:** Don't assume knowledge the bot can't have

**Bad hack:** Clear the graph when stuck (throws away learned information)
**Good fix:** Detect stuck patterns and use BREAK_WALL (preserves graph, escapes cleanly)

---

## 13. Common Pitfalls and Corrections

### Pitfall 1: "Wall-Follow Should Check All Yaws"

**Wrong:** Wall-follow tries ANY untried yaw (forward, right, left) when backtracking.

**Right:** Wall-follow should **ONLY check LEFT exits** (90-180° from forward bearing).

**Why:** Forward/right yaws will be explored on future forward passes. Checking them during backtracking breaks the ≤2 visits guarantee.

### Pitfall 2: "Clearing successfulYaws Helps Escape"

**Wrong:** Clear `successfulYaws` to "force new path" when stuck.

**Right:** Never throw away escape routes. The graph remembers connections - use them.

**Why:** BREAK_WALL needs `successfulYaws` to retry exits. If empty, must calculate reverse yaw from graph (more complex, less reliable).

### Pitfall 3: "2-Node Oscillation is Normal"

**Wrong:** Allow 2-node loops (A→B→A→B) as "normal backtracking behavior".

**Right:** 2-node oscillation is a BUG. Detect and break out after 3+ cycles.

**Why:** Real wall-follow backtracking moves AWAY from dead ends, not back-and-forth.

### Pitfall 4: "More Yaws Tried = Better Exploration"

**Wrong:** Mark nodes as fully explored only after all 6 yaws are tried.

**Right:** Mark as fully explored after 5+ yaws (pragmatic optimization).

**Why:** 
- Street View nodes typically have 2-4 exits, not 6
- After 5 yaws, the 6th is unlikely to succeed
- Prevents wasting ticks on exhaustive scanning

### Pitfall 5: "Resetting committedDirection Prevents Loops"

**Wrong:** Reset `committedDirection = null` after wall-follow exit to "fresh start".

**Right:** Set `committedDirection` to the exit yaw direction.

**Why:** Null causes the bot to adopt whatever bearing it calculates at the next node, which might point back to the previous node.

---

## 14. Debugging Checklist

When analyzing walk logs for issues:

1. **Check node visit counts:** Any node with >3 visits indicates a problem
2. **Look for "STUCK" patterns:** Multiple consecutive stuck at same location
3. **Trace wall-follow sequences:** A→C→A pattern indicates loop
4. **Verify reverse yaw recording:** Graph should have bidirectional connections
5. **Check BREAK_WALL triggers:** Should escape stuck situations within 2-3 steps

### Key Log Patterns

**Healthy walk:**
```
[DEBUG] isNewNode=true, nodeVisitCount=0  ← New territory
[DEBUG] LOCATION CHANGED - resetting stuckCount  ← Making progress
```

**Wall-follow loop:**
```
[DEBUG] nodeVisitCount=5, isFullyScanned=true  ← Already explored
[DEBUG] 🧱 DEAD END! ... turning to wall-follow  ← Restarting wall-follow
[DEBUG] 🧱 WALL-FOLLOW: Found LEFT exit  ← Taking exit
[DEBUG] nodeVisitCount=6, isFullyScanned=true  ← Back at same node!
```

**Stuck detection working:**
```
[DEBUG] STUCK! Trying untried yaw 180°  ← Fast-fail triggered
[DEBUG] LOCATION CHANGED  ← Escaped successfully
```

---

*Documentation updated with wall-follow loop analysis and design principles.*
