# 🤪 Drunk Walker: Street View Chaos

**[👉 Launch Drunk Walker Instantly (Any Device)](https://genaforvena.github.io/drunk-walker/)**

## 🌀 What is Drunk Walker?

**Drunk Walker** is a chaotic, "blind" automation engine for Google Street View. It transforms the world's most famous mapping service into an unpredictable travelogue by simulating human-like clicks to move through the streets.

Unlike traditional navigators, Drunk Walker has no destination and no sense of direction. It simply "walks" by clicking around the center of the screen, leading to mesmerizing, often futile, and occasionally beautiful journeys.

---

## 🚀 Instant Launch (No Install)

For the fastest experience on any browser (Desktop or Mobile), use the **Developer Console** method:

1.  **[Click here for the One-Click Copy Page](https://genaforvena.github.io/drunk-walker/)**
2.  Click **COPY JS TO CLIPBOARD**.
3.  Open [Google Maps Street View](https://www.google.com/maps).
4.  Press `F12` (or `Right-Click > Inspect`) and go to the **Console** tab.
5.  Paste the code and press **Enter**.
6.  Use the on-screen control panel to **START** the walk!

---

## 🌟 Key Features (v3.3-EXP)

- **🔄 Auto-Unstuck Algorithm**: When stuck, automatically turns left 30° and moves forward to recover navigation (always on).
- **👀 Smart Observation**: Automatically pauses clicking whenever you manually drag the mouse to look around, then resumes when you release.
- **🎯 Optimized Forward-Targeting:** Default clicks at 70% height—the "sweet spot" for Street View movement.
- **⌨️ Keyboard Mode (Default):** Simulates Arrow Up key press for smoother, more reliable navigation.
- **📊 Control Panel:** Minimalist UI with **START/STOP** toggle, **Pace Slider**, and live step counter.
- **🎚️ Adjustable Pace:** Speed control from 0.5 to 5.0 seconds per step.
- **💾 Session-Aware:** Recalculates screen dimensions every time you hit START.
- **🌐 Cross-Browser:** Works on Chrome, Firefox, Safari, and Edge.

---

## 🔄 Auto-Unstuck Algorithm

When Drunk Walker detects it's stuck (URL unchanged for 3 consecutive steps), it automatically:

1. **Turns Left ~30°** - Holds ArrowLeft for 300ms
2. **Moves Forward** - Presses ArrowUp in the new direction
3. **Verifies Success** - Checks if URL changed, resets on success

This recovery sequence runs **automatically**—no configuration needed.

---

## 🛠️ Extension Installation (Optional)

For a permanent browser extension instead of the console method:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/genaforvena/drunk-walker.git
    ```
2.  **Firefox (Temporary):**
    - Go to `about:debugging` > "This Firefox" > "Load Temporary Add-on...".
    - Select `manifest.json`.
3.  **Chrome/Chromium:**
    - Go to `chrome://extensions`.
    - Enable "Developer mode" and click "Load unpacked".
    - Select the project folder.

> **Note:** The console method (above) is recommended for quick access on any device.

---

## 📚 Documentation

- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** - Detailed documentation of the auto-recovery system
- **[Spec.md](Spec.md)** - Full technical specification
- **[PROJECT_MEMORY.md](PROJECT_MEMORY.md)** - Architecture and deployment guide

---

## ⚠️ Ethical Note
This is a technical experiment and art project. It includes rate-limiting (min 0.5s interval) to avoid appearing as an automated attack on Google services. Use responsibly.

---
*Created with ❤️ and a lot of confusion.*
