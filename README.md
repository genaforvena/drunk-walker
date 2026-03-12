# 🤪 Drunk Walker: Street View Chaos

**Drunk Walker** is a Firefox extension that transforms Google Street View into an automated, chaotic travelogue. It navigates by blindly clicking near your cursor or the screen center, prioritizing exploration and visual chaos over accuracy.

## 🌟 Features

- **Guided Chaos:** Clicks are relative to your cursor position, allowing you to "steer" the drunken walk.
- **Center-Mode:** If the cursor leaves the window, it defaults to clicking near the screen center.
- **Stagnation Detection:** Automatically enters **Panic Mode** (shifting click targets to the sides) when it hasn't moved for 3 clicks.
- **HUD Overlay:** A cyberpunk-style in-page display showing live navigation status and target type.
- **🤪 YOLO Mode:** One-click insanity. Max speed, max radius, and screen glitch effects.
- **Manifest V3:** Built for modern browser security standards.

## 🛠 Installation

### From Source (Developer Mode)

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
- **Target:** Current Cursor Position (or Screen Center if cursor is absent).
- **Offset:** A random distance within the user-defined `Click Radius`.

If the URL doesn't change after several attempts, it enters **Panic Mode**, clicking the far sides of the screen to try and trigger a turn.

## ⚠️ Ethical Note
This is a technical experiment and art project. It includes rate-limiting (min 1s interval) to avoid appearing as an automated attack on Google services. Use responsibly.

---
*Created with ❤️ and a lot of confusion.*
