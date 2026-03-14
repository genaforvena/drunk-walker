# 🤪 Drunk Walker: Street View Chaos

**[👉 Launch Drunk Walker Instantly (Any Device)](https://genaforvena.github.io/drunk-walker/)**

## 🌀 What is Drunk Walker?

**Drunk Walker** is a chaotic, "blind" automation engine for Google Street View. It transforms the world’s most famous mapping service into an unpredictable travelogue by simulating human-like clicks to move through the streets.

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

## 🌟 Key Features (v3.1-EXP)

- **Draw Click Area:** Draw a custom polygon on the screen to define exactly where the walker should click.
- **Smart Observation:** Automatically pauses clicking whenever you manually drag the mouse to look around or change perspective, then resumes when you release.
- **Leveling Tools:** Use "LEVEL URL" to instantly flatten your view or "SHOW HORIZON" to toggle a visual guide.
- **Experimental Mode:** Detects if you're stuck and triggers exponential chaos recovery.
- **Optimized Forward-Targeting:** Default behavior clicks at 70% height—the "sweet spot" for Street View movement.
- **Persistent Control Panel:** Injects a minimalist UI into the page with a **START/STOP** toggle, **Pace Slider**, and **Experimental Toggle**.
- **Session-Aware:** Recalculates screen dimensions every time you hit START, ensuring perfect centering even after window resizes.
- **Cross-Browser:** Works via Console or Extension on Chrome, Firefox, Safari, and Edge.

---

## 🛠 Extension Installation (Desktop)

If you prefer a permanent extension over the console method:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/genaforvena/drunk-walker.git
    ```
2.  **Firefox:** 
    - Go to `about:debugging` > "This Firefox" > "Load Temporary Add-on...".
    - Select `manifest.json`.
3.  **Chrome/Chromium:** 
    - Go to `chrome://extensions`.
    - Enable "Developer mode" and click "Load unpacked".
    - Select the project folder.

---

## ⚠️ Ethical Note
This is a technical experiment and art project. It includes rate-limiting (min 0.5s interval) to avoid appearing as an automated attack on Google services. Use responsibly.

---
*Created with ❤️ and a lot of confusion.*
