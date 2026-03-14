# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a cross-browser extension (Firefox & Chromium-based) and a standalone Bookmarklet that automates Google Street View navigation using a "blind," coordinate-based approach. It prioritizes visual chaos and reactive exploration via cursor-relative clicks.

---

## 🏗️ System Architecture

### 1. Component Roles
- **Popup (`popup.html`, `popup.js`)**: Single-toggle START/STOP control center.
- **Background (`background.js`)**: State machine (`idle`, `navigating`, `complete`). Now configured as a `service_worker` for cross-browser support.
- **Content (`content.js`)**: Executes clicks relative to cursor or "Forward" region.
- **Bookmarklet (`bookmarklet.js`)**: A standalone version of the navigation logic that works on any device.

### 2. Cross-Browser & Multi-Device Support
- **Polyfill**: Uses `browserAPI` to bridge `browser.*` and `chrome.*` namespaces.
- **Bookmarklet**: Provides a "one-click" experience on mobile and desktop via `index.html`.

---

## 🚀 Deployment & Sharing

### One-Click "No-Install" (GitHub Pages)
The primary shareable link is: **[https://genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)**
- **Method**: Single button to **Copy JS to Clipboard**.
- **Execution**: User pastes into the **Browser Console (F12)** on a Street View page.
- **Benefits**: Works instantly on any modern browser without installation or store approvals.

### GitHub Automation (User Preference)
- **Prefer `gh` CLI**: The user prefers using the GitHub CLI (`gh`) for automating repository settings, creating releases, and enabling GitHub Pages.
- **Bypass Jekyll**: A `.nojekyll` file is used to ensure simple HTML deployment on Pages.
- **Mandatory Testing**: Run `npm test` before every push to ensure no regressions in core logic (Start/Stop, Drag-detection, Targeting).
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) automatically runs tests on every push to `main`.
- **CRITICAL: Post-Push Verification**: ALWAYS verify that the live GitHub Pages site (`https://genaforvena.github.io/drunk-walker/`) matches the local version AFTER pushing.
    - Check the deployment status using `gh run list`.
    - Use `curl` to verify the version string in the live HTML.
    - If deployment fails or version is outdated, do not consider the task finished.

---

## ⚡ Key Implementations & Logic

### 1. Click Algorithm (v3.1-EXP)
- **Control Panel**: Injected UI with **START/STOP**, **PACE slider**, **EXPERIMENTAL MODE**, **LEVEL URL**, **SHOW HORIZON**, and **DRAW CLICK AREA**.
- **Experimental Mode**: 
    - **URL-Stuck Detection**: Tracks `window.location.href`.
    - **Exponential Chaos Recovery**: When stuck, the click radius grows exponentially.
- **Horizon Finder & Guides**: 
    - **LEVEL URL**: Directly modifies URL pitch to 90t.
    - **SHOW HORIZON**: Toggles a red line guide at 50% screen height.
- **Draw Click Area**: 
    - **Selection**: User draws a polygon on a canvas overlay.
    - **Targeting**: Clicks are randomly picked within the polygon.
- **Drag Detection (Smart Observation)**: Automated clicks are paused if `isUserMouseDown` is true (detected via `isTrusted` mousedown events). This allows users to manually look around without interference.
- **Targeting**: Default clicks at 70% height (`screenWidth * 0.5, screenHeight * 0.7`).
- **Session-Based**: Dimensions recalculated on every START.

### 2. YOLO Mode
A high-chaos preset (Extension only): Interval 1.0s, Radius 100px, Glitch effects.

---

## 🛠️ Implementation Progress

- [x] Manifest V3 Setup (Cross-browser compatible)
- [x] Background State Management (Service Worker mode)
- [x] Cursor-relative Click Simulation (v1.1) [DEPRECATED in v2.4, but restored interaction in v3.0]
- [x] Simplified Movement (v1.2): Default Forward.
- [x] Minimalist UI (Single Toggle)
- [x] **One-Click Installation Page** (GitHub Pages)
- [x] **Bookmarklet Version** (Mobile Support)
- [x] **Experimental Mode (v2.0)**: URL-stuck detection and chaos recovery.
- [x] **Keyboard Mode (v3.0)**: Simulates "Arrow Up" navigation instead of clicks.
- [x] **Panic Mode (v3.0)**: Triggers 30° left turn (Arrow Left) if stuck, with adjustable threshold.
- [x] **Horizon Finder (v2.1)**: Auto-pitch adjustment via URL parsing.
- [x] **Leveling & Horizon Guides (v2.2)**: Manual leveling tools.
- [x] **Draw Click Area (v2.3)**: Polygon-based click targeting.
- [x] **Smart Observation (v3.0)**: Restored drag-detection pause logic.
- [ ] **Next Up**: Dynamic Radius scaling (increasing wobble over time)
- [ ] **Next Up**: Screen shake effects on click

---

## 📂 File Map
- `manifest.json`: Cross-browser extension config.
- `background.js`: Timing loop (Service Worker).
- `content.js`: Mouse tracking and click execution.
- `popup.js`: Toggle logic and user parameters.
- `index.html`: One-click installation page.
- `PROJECT_MEMORY.md`: This knowledge base.
