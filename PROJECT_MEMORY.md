# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a Firefox extension (Manifest V3) that automates Google Street View navigation using a "blind," coordinate-based approach. It simulates human clicks to move around, prioritizing visual chaos and reactive exploration over pathfinding.

---

## 🏗️ System Architecture

### 1. Component Roles
- **Popup (`popup.html`, `popup.js`)**: The control center. Handles user-defined parameters (Interval, Radius, Max Steps) and provides a simple **START/STOP toggle**.
- **Background (`background.js`)**: The "Brain." Maintains the primary state machine (`idle`, `navigating`, `complete`). Orchestrates the timing loop and triggers click events in the content script.
- **Content (`content.js`)**: The "Hands & Eyes." Injected into `google.com/maps`.
    - **Actions**: Executes `MouseEvent` clicks based on cursor position or screen center.
    - **Detection**: Monitors URL changes (to detect movement), checks Street View mode, and verifies Full-Screen status.
    - **Visuals**: Renders a cyberpunk HUD and "Panic/YOLO" effects directly in the page.

### 2. State Machine (`background.js`)
```javascript
{
  status: 'idle' | 'navigating' | 'complete',
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

### 1. Cursor-Relative Click Algorithm (v1.1)
The extension uses the current mouse position as the anchor for its clicks:
- **If cursor is on screen**: Target = `(mouseX, mouseY) + randomOffset(radius)`.
- **If cursor is off screen**: Target = `(screenWidth * 0.5, screenHeight * 0.5) + randomOffset(radius)`.
- **No HTML Knowledge**: Clicks are purely coordinate-based; the script never reads the DOM for buttons or arrows.

### 2. Feedback Loops
- **Stagnation Detection**: If the URL remains unchanged after a click, `stuckCount` increments. If `stuckCount >= 3`, `isPanicMode` triggers.
- **Panic Mode Logic**: Shifts targets to the far left (20% width) or far right (80% width) of the screen to attempt a turn or camera rotation.

### 3. YOLO Mode
A high-chaos preset:
- Interval: 1.0s.
- Radius: 100px.
- Visuals: Magenta glitch effects and rainbow HUD.

---

## 🧠 Reasoning & Design Decisions

### Minimalism & Simplicity
- **UI Preference**: The user prefers a minimalist interface with only essential controls. The primary interaction is a single **START/STOP toggle**.
- **No Pause**: Pause logic was removed to simplify the workflow and state management.

### Pure Coordinate Interaction
By relying on coordinates and the cursor position rather than DOM selectors, the extension remains agnostic to Google Maps' internal code updates.

### Mouse Tracking
Tracking the cursor allows for "guided chaos"—the user can influence the direction of the drunk walk by simply moving their mouse, while the extension adds the "drunken" randomness via the click radius.

---

## 🛠️ Implementation Progress

- [x] Manifest V3 Setup
- [x] Background State Management
- [x] Cursor-relative Click Simulation (v1.1)
- [x] URL-based Stagnation Detection
- [x] HUD Overlay (Vanilla CSS/JS)
- [x] Panic Mode (Side-clicking)
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
