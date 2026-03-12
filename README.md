# 🤪 Drunk Walker: Street View Chaos

**Drunk Walker** is a Firefox extension that transforms Google Street View into an automated, chaotic travelogue. It attempts to navigate from an origin to a destination by blindly clicking where it thinks "forward" is.

## 🌟 Features

- **Progressive Optimistic Clicking:** Simulates human-like clicks to trigger Street View movement.
- **Stagnation Detection:** Automatically enters **Panic Mode** (shifting click targets) when it hasn't moved for 3 clicks.
- **HUD Overlay:** A cyberpunk-style in-page display showing live "Wobble" stats and navigation status.
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

### From Source (Permanent)
To keep the extension after restarting Firefox, you must [sign the extension](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) or use Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false`.

## 🚀 How to Use

1.  Navigate to [Google Maps](https://www.google.com/maps).
2.  Enter **Street View** at your starting location.
3.  Click the **Drunk Walker** icon in your toolbar.
4.  Enter your **Origin** and **Destination** (latitude, longitude format).
5.  Adjust **Click Interval** and **Click Radius**.
6.  Hit **START** or go full chaos with **YOLO MODE**.
7.  **Important:** Press `F11` to enter Full-Screen mode for the best "blind" navigation accuracy.

## 🧠 The Algorithm

Drunk Walker treats Street View as a black box. It doesn't read the DOM to find arrows; it assumes the "forward" arrow is roughly in the lower-center of the screen:
- **Target X:** 50% width ± radius
- **Target Y:** 70% height ± radius

If the URL doesn't change after several attempts, it enters **Panic Mode**, clicking the sides of the screen to try and find a new street.

## ⚠️ Ethical Note
This is a technical experiment and art project. It includes rate-limiting (min 1s interval) to avoid appearing as an automated attack on Google services. Use responsibly.

---
*Created with ❤️ and a lot of confusion.*
