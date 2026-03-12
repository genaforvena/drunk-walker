# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a Firefox extension (Manifest V3) that automates Google Street View navigation using a "blind," coordinate-based approach. It simulates human clicks to move forward, prioritizing visual chaos and "trying its best" over actual pathfinding.

---

## 🏗️ System Architecture

### 1. Component Roles
- **Popup (`popup.html`, `popup.js`)**: The control center. Handles user input (Origin/Destination, Interval, Radius, Max Steps) and displays real-time stats (Distance, Progress).
- **Background (`background.js`)**: The "Brain." Maintains the primary state machine (`idle`, `navigating`, `paused`, `complete`). Orchestrates the timing loop and triggers click events in the content script.
- **Content (`content.js`)**: The "Hands & Eyes." Injected into `google.com/maps`.
    - **Actions**: Executes `MouseEvent` clicks at calculated coordinates.
    - **Detection**: Parses the URL for Lat/Lng, detects Street View mode (via `3a,` in URL), and checks for Full-Screen status.
    - **Visuals**: Renders a cyberpunk HUD and "Panic/YOLO" effects directly in the page.

### 2. State Machine (`background.js`)
```javascript
{
  status: 'idle' | 'navigating' | 'paused' | 'complete',
  origin: { lat, lng },
  destination: { lat, lng },
  currentPosition: { lat, lng },
  stepsTaken: 0,
  maxSteps: 1000,
  clickInterval: 3000,
  clickRadius: 50,
  stuckCount: 0, // Increments if URL hasn't changed
  isPanicMode: boolean, // Active if stuckCount >= 3
  isYoloMode: boolean // Active via YOLO button (chaos presets)
}
```

---

## ⚡ Key Implementations & Logic

### 1. The "Blind" Click Algorithm
The extension doesn't read the DOM for arrows. It assumes the "forward" arrow is in the lower-center:
- **Default X**: `window.innerWidth * 0.5`
- **Default Y**: `window.innerHeight * 0.7`
- **Radius**: A random offset added to both X and Y.

### 2. Feedback Loops
- **Position Tracking**: Extracted from URL via regex: `@(-?\d+\.\d+),(-?\d+\.\d+)`.
- **Stagnation Detection**: If `lat`/`lng` remain unchanged for 3 consecutive clicks, `isPanicMode` triggers.
- **Panic Mode Logic**: Shifts `clickX` to the sides (30% or 70% width) to find cross-streets or turn the camera.

### 3. YOLO Mode
A high-chaos preset:
- Interval: 1.0s (minimum safe rate).
- Radius: 100px.
- Visuals: `glitchEffect()` (magenta overlays) and rainbow HUD borders.

---

## 🧠 Reasoning & Design Decisions

### Why no DOM access?
Google Maps is a complex Canvas/WebGL application. Detecting arrows via the DOM is brittle and prone to breakage. Coordinate-based clicking is more resilient to UI updates, though less "accurate."

### Full-Screen Requirement
The coordinate math (`0.5`, `0.7`) assumes the viewport is the entire Street View area. Browser chrome (address bar, bookmarks) offsets these targets. `F11` is enforced via HUD warnings.

### Rate Limiting
A hard minimum of 1s (`clickInterval`) is maintained to prevent being flagged as a bot/attack by Google's infrastructure.

---

## 🛠️ Implementation Progress

- [x] Manifest V3 Setup (Gecko/Firefox)
- [x] Background State Management
- [x] Coordinate-based Click Simulation
- [x] URL-based Position Extraction
- [x] HUD Overlay (Vanilla CSS/JS)
- [x] Panic Mode (Stuck Detection)
- [x] YOLO Mode (Chaos Presets)
- [ ] **Next Up**: Improved Destination Bearing Logic (calculating which way to turn if lost)
- [ ] **Next Up**: "Drunk-o-meter" visual indicator based on distance delta

---

## 📂 File Map
- `manifest.json`: Permissions (`activeTab`, `storage`, `scripting`) and host permissions.
- `background.js`: Interval logic and state sync.
- `content.js`: HUD, Click logic, URL parsing.
- `popup.js`: UI logic and message passing to background.
- `Spec.md`: Original technical blueprint.
