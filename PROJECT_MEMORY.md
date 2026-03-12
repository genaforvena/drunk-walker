# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a cross-browser extension (Firefox & Chromium-based) that automates Google Street View navigation using a "blind," coordinate-based approach. It prioritizes visual chaos and reactive exploration via cursor-relative clicks.

---

## 🏗️ System Architecture

### 1. Component Roles
- **Popup (`popup.html`, `popup.js`)**: Single-toggle START/STOP control center.
- **Background (`background.js`)**: State machine (`idle`, `navigating`, `complete`). Now configured as a `service_worker` for cross-browser support.
- **Content (`content.js`)**: Executes clicks relative to cursor or "Forward" region.

### 2. Cross-Browser Support
The project uses a `browserAPI` polyfill in all JS files:
```javascript
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
```
This ensures compatibility with both `browser.*` (Firefox) and `chrome.*` (Chromium) namespaces.

---

## 🚀 Deployment & Sharing

### Easy Sharing (GitHub Releases)
To share the extension easily:
1. **Create a GitHub Release**: Go to the GitHub repository and create a new release (e.g., `v1.2.0`).
2. **Attach the ZIP/Tarball**: Zip the core files (`manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`) and attach them to the release.
3. **Share the Link**: Users can download the zip and load it as an "Unpacked Extension" in Chrome/Edge or as a "Temporary Add-on" in Firefox.

---

## ⚡ Key Implementations & Logic

### 1. Click Algorithm (v1.2)
- **If cursor is on screen**: Target = `(mouseX, mouseY) + randomOffset(radius)`.
- **If cursor is off screen**: Target = `(screenWidth * 0.5, screenHeight * 0.7) + randomOffset(radius)`.

### 2. YOLO Mode
A high-chaos preset: Interval 1.0s, Radius 100px, Glitch effects.

---

## 🛠️ Implementation Progress

- [x] Manifest V3 Setup (Cross-browser compatible)
- [x] Background State Management (Service Worker mode)
- [x] Cursor-relative Click Simulation (v1.1)
- [x] Simplified Movement (v1.2): Default Forward.
- [x] Minimalist UI (Single Toggle)
- [x] **Cross-Browser Polyfill** (Firefox/Chromium)
- [ ] **Next Up**: Dynamic Radius scaling (increasing wobble over time)
- [ ] **Next Up**: Screen shake effects on click

---

## 📂 File Map
- `manifest.json`: Cross-browser extension config.
- `background.js`: Timing loop (Service Worker).
- `content.js`: Mouse tracking and click execution.
- `popup.js`: Toggle logic and user parameters.
- `PROJECT_MEMORY.md`: This knowledge base.
