# 🤪 Drunk Walker: Street View Chaos

**[👉 Launch Drunk Walker Instantly (Any Device)](https://genaforvena.github.io/drunk-walker/)**

## 🌀 What is Drunk Walker?

**Drunk Walker** is a chaotic, "blind" automation engine for Google Street View. It transforms the world’s most famous mapping service into an unpredictable travelogue by simulating human-like clicks to move through the streets.

Unlike traditional navigators, Drunk Walker has no destination and no sense of direction. It simply "walks" by clicking around the center of the screen, leading to mesmerizing, often futile, and occasionally beautiful journeys.

### How it works:
- **Blind Navigation:** It treats Street View as a black box, using pure screen coordinates around the center to trigger movement.
- **Smart Observation:** It automatically pauses whenever you drag the mouse to look around, letting you take control of the perspective without interference.
- **Adjustable Pace:** Control the chaos with an on-screen pace slider.

---

## 🌟 Features

- **Center-Targeting:** Always clicks in the central region of the viewport.
- **HUD Control Panel:** A cyberpunk-style overlay with START/STOP and Pace controls.
- **HUD Overlay:** A cyberpunk-style in-page display showing live navigation status and target type.
- **🤪 YOLO Mode:** One-click insanity. Max speed, max radius, and screen glitch effects.
- **Manifest V3:** Built for modern browser security standards.

## 🚀 Instant Launch (No Install)

For the fastest experience on any browser, use the **Developer Console** method:

**[👉 Click here for the One-Click Copy Page](https://genaforvena.github.io/drunk-walker/)**

1. Click **COPY JS TO CLIPBOARD**.
2. Open Street View, press `F12`, and paste the code into the **Console**.

## 🛠 Extension Installation (Desktop)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/genaforvena/drunk-walker.git
    cd drunk-walker
    ```
2.  **Open Firefox** and navigate to `about:debugging`.
3.  Click on **"This Firefox"** in the left sidebar.
4.  Click **"Load Temporary Add-on..."**.
5.  Select the `manifest.json` file from the cloned directory.

## 🚀 How to Use

1.  Navigate to [Google Maps](https://www.google.com/maps).
2.  Enter **Street View**.
3.  Click the **Drunk Walker** icon in your toolbar.
4.  Adjust **Click Interval** and **Click Radius**.
5.  Hit **START** and move your mouse to "guide" the walk, or go full chaos with **YOLO MODE**.
6.  **Important:** Press `F11` to enter Full-Screen mode for the best coordinate accuracy.

## 🧠 The Algorithm

Drunk Walker treats Street View as a black box. It doesn't read the DOM; it simply dispatches click events:
- **Target:** Current Cursor Position (or Screen Lower-Center if cursor is absent).
- **Offset:** A random distance within the user-defined `Click Radius`.

The algorithm is intentionally "blind" and relies on the user to correct direction if the walker gets stuck.

## ⚠️ Ethical Note
This is a technical experiment and art project. It includes rate-limiting (min 1s interval) to avoid appearing as an automated attack on Google services. Use responsibly.

---
*Created with ❤️ and a lot of confusion.*
