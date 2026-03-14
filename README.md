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

## 🌟 Key Features (v3.4-EXP)

- **🔄 Auto-Unstuck Algorithm**: When stuck, automatically turns left 60° and moves forward to recover navigation (always on).
- **📍 Optional Path Collection**: Opt-in to contribute your walk data to the global dashboard (completely optional, privacy-focused).
- **👀 Smart Observation**: Automatically pauses clicking whenever you manually drag the mouse to look around, then resumes when you release.
- **🎯 Optimized Forward-Targeting:** Default clicks at 70% height—the "sweet spot" for Street View movement.
- **⌨️ Keyboard Mode (Default):** Simulates Arrow Up key press for smoother, more reliable navigation.
- **📊 Control Panel:** Minimalist UI with **START/STOP** toggle, **Pace Slider**, path collection toggle, and live step counter.
- **🎚️ Adjustable Pace:** Speed control from 0.5 to 5.0 seconds per step.
- **💾 Session-Aware:** Recalculates screen dimensions every time you hit START.
- **🌐 Cross-Browser:** Works on Chrome, Firefox, Safari, and Edge.

---

## 📍 Path Collection (Opt-In)

**Completely optional.** Enable the "Collect Walk Path" checkbox in the control panel to contribute your walk data to the global dashboard.

**What is collected:**
- URL after each step
- Fixed rotation angle (60°)
- Timestamp when you stop walking

**What is NOT collected:**
- No IP addresses
- No personal identifiers
- No browser fingerprints
- No location data beyond Street View URLs

**Privacy:** Data is stored anonymously and used only for the global walk dashboard.

---

## 🌍 Global Walk Dashboard

View collected walks from users worldwide:

- **Total walks** collected
- **Total steps** recorded
- **Expandable walk details** showing each step's URL and rotation

**[📊 View Dashboard](/dashboard)** | **[📈 Stats API](/api/stats)**

### Backend Server Setup

To enable path collection and the dashboard:

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3000` with:
- `POST /api/submit-walk` - Submit walk data
- `GET /api/stats` - Get aggregate statistics
- `GET /api/walks` - List recent walks
- `GET /api/walk/:id` - Get walk details
- `/dashboard` - Public dashboard page

### Deployment

Deploy the server to any Node.js hosting platform (Heroku, Railway, Render, etc.):

```bash
# Example: Deploy to Railway
railway init
railway up
```

Set the `PORT` environment variable as needed.

---

## 🔄 Auto-Unstuck Algorithm

When Drunk Walker detects it's stuck (URL unchanged for 3 consecutive steps), it automatically:

1. **Turns Left 60°** - Holds ArrowLeft for 600ms
2. **Moves Forward** - Presses ArrowUp in the new direction
3. **Verifies Success** - Checks if URL changed, resets on success

The turn angle is fixed at 60° for reliable recovery.

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
