# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a Firefox extension (Manifest V3) that automates Google Street View navigation using a "blind," coordinate-based approach. It simulates human clicks to move around, prioritizing visual chaos and reactive exploration over pathfinding.

---

## 🏗️ System Architecture

### 1. Component Roles
- **Popup (`popup.html`, `popup.js`)**: The control center. Handles user-defined parameters (Interval, Radius, Max Steps) and provides a simple **START/STOP toggle**.
- **Background (`background.js`)**: The "Brain." Maintains the primary state machine (`idle`, `navigating`, `complete`). Orchestrates the timing loop and triggers click events in the content script.
- **Content (`content.js`)**: The "Hands & Eyes." Injected into `google.com/maps`.
    - **Actions**: Executes `MouseEvent` clicks based on cursor position or the "Forward" target.
    - **Detection**: Monitors Street View mode and verifies Full-Screen status.
    - **Visuals**: Renders a cyberpunk HUD and "YOLO" effects directly in the page.

### 2. State Machine (`background.js`)
```javascript
{
  status: 'idle' | 'navigating' | 'complete',
  stepsTaken: 0,
  maxSteps: 1000,
  clickInterval: 3000,
  clickRadius: 50,
  isYoloMode: boolean // Active via YOLO button (chaos presets)
}
```

---

## ⚡ Key Implementations & Logic

### 1. Click Algorithm (v1.2)
The extension targets its clicks based on user influence:
- **If cursor is on screen**: Target = `(mouseX, mouseY) + randomOffset(radius)`. This allows the user to "steer" the walk.
- **If cursor is off screen**: Target = `(screenWidth * 0.5, screenHeight * 0.7) + randomOffset(radius)`. This defaults to the "Forward" arrow region.
- **No Panic Mode**: The script no longer attempts to detect if it's stuck or shift to side-clicking. It maintains its path unless directed by the mouse.

### 2. YOLO Mode
A high-chaos preset:
- Interval: 1.0s.
- Radius: 100px.
- Visuals: Magenta glitch effects and rainbow HUD.

---

## 🧠 Reasoning & Design Decisions

### Minimalism & Simplicity
- **UI Preference**: Minimalist interface with a single **START/STOP toggle**.
- **Intentional Movement**: The removal of "Panic Mode" simplifies the logic to focus on user-guided steering vs. default forward movement. It assumes the user will correct the direction if the walker gets "stuck."

### Pure Coordinate Interaction
By relying on coordinates and the cursor position rather than DOM selectors, the extension remains agnostic to Google Maps' internal code updates.

---

## 🛠️ Implementation Progress

- [x] Manifest V3 Setup
- [x] Background State Management
- [x] Cursor-relative Click Simulation (v1.1)
- [x] **Simplified Movement (v1.2)**: Removed Panic Mode, default to Forward.
- [x] HUD Overlay (Vanilla CSS/JS)
- [x] YOLO Mode
- [x] **Minimalist UI** (Start/Stop Toggle)
- [ ] **Next Up**: Dynamic Radius scaling (increasing wobble over time)
- [ ] **Next Up**: Screen shake effects on click

---

## 📂 File Map
- `manifest.json`: Extension config and permissions.
- `background.js`: Timing loop and global state.
- `content.js`: Mouse tracking, HUD, and click execution.
- `popup.js`: User parameter control and toggle logic.
- `PROJECT_MEMORY.md`: This knowledge base.
